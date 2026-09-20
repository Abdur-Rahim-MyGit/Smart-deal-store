import crypto from "crypto";
import NotificationTemplate from "../models/NotificationTemplate.js";
import Campaign, { CAMPAIGN_AUDIENCES } from "../models/Campaign.js";
import Subscriber from "../models/Subscriber.js";
import User, { EMIRATES } from "../models/User.js";
import { asyncHandler, badRequest, isObjectId, notFound } from "../utils/http.js";
import { assertPhone, normalizePhone } from "../utils/validation.js";
import { audit, sendSms } from "../utils/notify.js";
import {
  DEFAULT_TEMPLATES,
  clearTemplateCache,
  deliverCampaign,
  getTemplate,
  resolveAudience,
  unsubscribeToken,
} from "../services/notificationService.js";

const placeholders = (text) =>
  [...String(text).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]);

/* ---------------- Templates ---------------- */

// @route GET /api/admin/notifications/templates
export const listTemplates = asyncHandler(async (_req, res) => {
  const templates = await Promise.all(DEFAULT_TEMPLATES.map((entry) => getTemplate(entry.key)));
  res.json({
    success: true,
    templates: templates.map((template) => ({
      ...template,
      defaults: DEFAULT_TEMPLATES.find((entry) => entry.key === template.key),
    })),
  });
});

// @route PUT /api/admin/notifications/templates/:key — body: { title, message, email, sms }
export const updateTemplate = asyncHandler(async (req, res) => {
  const base = DEFAULT_TEMPLATES.find((entry) => entry.key === req.params.key);
  if (!base) throw notFound("Unknown notification");
  const title = String(req.body.title ?? "").trim();
  const message = String(req.body.message ?? "").trim();
  if (title.length < 2 || title.length > 120) throw badRequest("The title needs 2–120 characters");
  if (message.length < 2 || message.length > 600)
    throw badRequest("The message needs 2–600 characters");
  const unknown = [...placeholders(title), ...placeholders(message)].filter(
    (name) => !base.variables.includes(name),
  );
  if (unknown.length) {
    throw badRequest(
      `Unknown placeholder {{${unknown[0]}}}. This notification can use: ${base.variables.map((name) => `{{${name}}}`).join(", ")}`,
    );
  }

  await NotificationTemplate.findOneAndUpdate(
    { key: base.key },
    {
      $set: {
        title,
        message,
        email: Boolean(req.body.email),
        sms: Boolean(req.body.sms),
        updatedBy: req.user._id,
      },
    },
    { upsert: true, new: true },
  );
  clearTemplateCache();
  await audit(req, "notification.template", {
    entityType: "NotificationTemplate",
    summary: base.key,
  });
  res.json({ success: true, message: "Notification saved", template: await getTemplate(base.key) });
});

// @route DELETE /api/admin/notifications/templates/:key — back to the built-in wording
export const resetTemplate = asyncHandler(async (req, res) => {
  const base = DEFAULT_TEMPLATES.find((entry) => entry.key === req.params.key);
  if (!base) throw notFound("Unknown notification");
  await NotificationTemplate.deleteOne({ key: base.key });
  clearTemplateCache();
  await audit(req, "notification.template_reset", {
    entityType: "NotificationTemplate",
    summary: base.key,
  });
  res.json({
    success: true,
    message: "Back to the default wording",
    template: await getTemplate(base.key),
  });
});

/* ---------------- Delivery channels ---------------- */

function channelStatus() {
  const email =
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
      ? { connected: true, provider: `SMTP (${process.env.SMTP_HOST})` }
      : process.env.RESEND_API_KEY
        ? { connected: true, provider: "Resend" }
        : { connected: false, provider: "Server log only" };
  return {
    email: { ...email, from: process.env.EMAIL_FROM || "Smart Deal <no-reply@smartdeal.ae>" },
    // SMS sending isn't connected to a provider yet; messages are written to the server log.
    sms: {
      connected: false,
      provider: "Server log only",
      note: process.env.TWILIO_ACCOUNT_SID
        ? "Twilio credentials are set, but sending through Twilio isn't built yet."
        : "Add an SMS provider to send texts.",
    },
    inApp: { connected: true, provider: "In-app notifications with live updates" },
  };
}

// @route GET /api/admin/notifications/channels
export const getChannels = asyncHandler(async (_req, res) => {
  res.json({ success: true, channels: channelStatus() });
});

// @route POST /api/admin/notifications/test-sms — body: { phone }
export const sendTestSms = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  assertPhone(phone);
  await sendSms(phone, "Smart Deal test message: your SMS settings work.");
  await audit(req, "settings.test_sms", { entityType: "Setting", summary: phone });
  res.json({
    success: true,
    message: channelStatus().sms.connected
      ? `Test SMS sent to ${phone}`
      : `No SMS provider is connected, so the test message was written to the server log`,
  });
});

/* ---------------- Campaigns ---------------- */

function readCampaign(body) {
  const title = String(body.title ?? "").trim();
  const message = String(body.message ?? "").trim();
  if (title.length < 2 || title.length > 120) throw badRequest("The title needs 2–120 characters");
  if (message.length < 5 || message.length > 600)
    throw badRequest("The message needs 5–600 characters");
  const link = String(body.link ?? "").trim() || undefined;
  if (link && !/^(\/|https:\/\/)/.test(link))
    throw badRequest("Links must be a store path like /search?flash=true or start with https://");

  const type = body.audience?.type;
  if (!CAMPAIGN_AUDIENCES.includes(type)) throw badRequest("Choose who should receive it");
  const audience = { type };
  if (type === "emirate") {
    if (!EMIRATES.includes(body.audience.emirate)) throw badRequest("Choose an emirate");
    audience.emirate = body.audience.emirate;
  }
  if (["recent_buyers", "lapsed"].includes(type)) {
    const days = Number(body.audience.days);
    if (!Number.isInteger(days) || days < 1 || days > 365)
      throw badRequest("Pick a period between 1 and 365 days");
    audience.days = days;
  }

  // Newsletter subscribers only have an email address.
  const channels =
    type === "subscribers"
      ? { email: true, sms: false }
      : { email: Boolean(body.channels?.email), sms: Boolean(body.channels?.sms) };

  let scheduledFor = new Date();
  if (body.scheduledFor) {
    scheduledFor = new Date(body.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) throw badRequest("Invalid send time");
    if (scheduledFor.getTime() < Date.now() - 60 * 1000)
      throw badRequest("Pick a send time in the future");
  }
  return { title, message, link, audience, channels, scheduledFor };
}

// @route GET /api/admin/campaigns
export const listCampaigns = asyncHandler(async (_req, res) => {
  const campaigns = await Campaign.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("createdBy", "name")
    .lean();
  res.json({ success: true, campaigns });
});

// @route POST /api/admin/campaigns/preview — body: { audience } → recipient count
export const previewCampaign = asyncHandler(async (req, res) => {
  const { audience } = readCampaign({ title: "Preview", message: "Preview", ...req.body });
  const { userIds, emails } = await resolveAudience(audience);
  res.json({ success: true, recipients: userIds.length + emails.length });
});

// @route POST /api/admin/campaigns — sends now, or at scheduledFor
export const createCampaign = asyncHandler(async (req, res) => {
  const data = readCampaign(req.body);
  const campaign = await Campaign.create({ ...data, status: "Scheduled", createdBy: req.user._id });
  const sendNow = campaign.scheduledFor.getTime() <= Date.now() + 30 * 1000;
  await audit(req, "campaign.create", {
    entityType: "Campaign",
    entityId: campaign._id,
    summary: `${campaign.title} → ${campaign.audience.type}${sendNow ? "" : ` at ${campaign.scheduledFor.toISOString()}`}`,
  });
  // Large audiences take a while, so sending continues after the response.
  if (sendNow) setImmediate(() => void deliverCampaign(campaign._id));
  res.status(201).json({
    success: true,
    message: sendNow ? "Campaign is sending" : "Campaign scheduled",
    campaign,
  });
});

// @route PUT /api/admin/campaigns/:id/cancel — only before it's sent
export const cancelCampaign = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw badRequest("Invalid campaign");
  const campaign = await Campaign.findOneAndUpdate(
    { _id: req.params.id, status: "Scheduled" },
    { $set: { status: "Cancelled" } },
    { new: true },
  );
  if (!campaign) throw badRequest("Only scheduled campaigns can be cancelled");
  await audit(req, "campaign.cancel", {
    entityType: "Campaign",
    entityId: campaign._id,
    summary: campaign.title,
  });
  res.json({ success: true, message: "Campaign cancelled", campaign });
});

/* ---------------- Newsletter unsubscribe (public) ---------------- */

// @route GET /api/public/newsletter/unsubscribe?email=&token=
export const unsubscribeNewsletter = asyncHandler(async (req, res) => {
  const email = String(req.query.email || "")
    .toLowerCase()
    .trim();
  const token = String(req.query.token || "");
  const expected = unsubscribeToken(email);
  const valid =
    email &&
    token.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));

  if (valid) {
    await Subscriber.updateOne({ email }, { $set: { isActive: false } });
    await User.updateOne({ email }, { $set: { "notificationPrefs.marketing": false } });
  }
  res
    .status(valid ? 200 : 400)
    .type("html")
    .send(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Smart Deal</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5"><h1 style="font-size:1.4rem">${valid ? "You're unsubscribed" : "This link isn't valid"}</h1><p>${valid ? "You won't get offers and promotions from Smart Deal any more. Order and account messages still arrive." : "The unsubscribe link is incomplete or has been changed. Use the link from the latest email."}</p></body>`,
    );
});
