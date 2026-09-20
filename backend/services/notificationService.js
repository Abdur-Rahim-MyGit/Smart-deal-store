import crypto from "crypto";
import NotificationTemplate from "../models/NotificationTemplate.js";
import Campaign from "../models/Campaign.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Subscriber from "../models/Subscriber.js";
import { clientUrl, notify, notifyMany, sendEmail } from "../utils/notify.js";

/**
 * Built-in wording for every automatic notification. Admins can override the title, message
 * and email/SMS switches per event; {{placeholders}} are filled in when it's sent. In-app
 * notifications are always kept, and each person's own email/SMS settings still apply.
 */
export const DEFAULT_TEMPLATES = [
  {
    key: "order_placed",
    name: "Order placed",
    audience: "Customer",
    type: "order",
    title: "Order placed",
    message: "Your order {{orderId}} (AED {{total}}) has been placed.",
    variables: ["orderId", "total"],
    email: false,
    sms: false,
  },
  {
    key: "order_confirmed",
    name: "Order confirmed",
    audience: "Customer",
    type: "order",
    title: "Order confirmed",
    message: "Your order {{orderId}} has been confirmed and is being prepared.",
    variables: ["orderId"],
    email: false,
    sms: false,
  },
  {
    key: "order_processing",
    name: "Order being packed",
    audience: "Customer",
    type: "order",
    title: "Order processing",
    message: "Your order {{orderId}} is being packed.",
    variables: ["orderId"],
    email: false,
    sms: false,
  },
  {
    key: "order_shipped",
    name: "Order shipped",
    audience: "Customer",
    type: "order",
    title: "Order shipped",
    message: "Your order {{orderId}} is on its way.",
    variables: ["orderId"],
    email: true,
    sms: false,
  },
  {
    key: "order_out_for_delivery",
    name: "Out for delivery",
    audience: "Customer",
    type: "order",
    title: "Out for delivery",
    message: "Your order {{orderId}} is out for delivery today.",
    variables: ["orderId"],
    email: true,
    sms: true,
  },
  {
    key: "order_delivered",
    name: "Order delivered",
    audience: "Customer",
    type: "order",
    title: "Order delivered",
    message: "Your order {{orderId}} has been delivered. Enjoy!",
    variables: ["orderId"],
    email: true,
    sms: true,
  },
  {
    key: "order_cancelled",
    name: "Order cancelled by the store",
    audience: "Customer",
    type: "order",
    title: "Order cancelled",
    message: "Your order {{orderId}} was cancelled. {{reason}}",
    variables: ["orderId", "reason"],
    email: true,
    sms: false,
  },
  {
    key: "return_approved",
    name: "Return approved",
    audience: "Customer",
    type: "order",
    title: "Return approved",
    message: "Your return for {{orderId}} was approved. {{refund}}",
    variables: ["orderId", "refund"],
    email: true,
    sms: true,
  },
  {
    key: "return_declined",
    name: "Return declined",
    audience: "Customer",
    type: "order",
    title: "Return request declined",
    message: "Your return for {{orderId}} was declined: {{reason}}",
    variables: ["orderId", "reason"],
    email: true,
    sms: false,
  },
  {
    key: "refund_sent",
    name: "Bank transfer refund sent",
    audience: "Customer",
    type: "order",
    title: "Refund sent",
    message:
      "We sent AED {{amount}} for {{orderId}} to your IBAN ending {{ibanLast4}}. Reference: {{reference}}.",
    variables: ["amount", "orderId", "ibanLast4", "reference"],
    email: true,
    sms: true,
  },
  {
    key: "ticket_reply",
    name: "Support reply",
    audience: "Customer",
    type: "support",
    title: "Support replied to your ticket",
    message: "{{ticketId}}: {{excerpt}}",
    variables: ["ticketId", "excerpt"],
    email: true,
    sms: false,
  },
  {
    key: "seller_new_order",
    name: "New order for a seller",
    audience: "Seller",
    type: "order",
    title: "New order received",
    message: "Order {{orderId}} includes your products. Please confirm it.",
    variables: ["orderId"],
    email: true,
    sms: false,
  },
  {
    key: "seller_order_cancelled",
    name: "Order cancelled (seller)",
    audience: "Seller",
    type: "order",
    title: "Order cancelled",
    message: "Order {{orderId}} was cancelled — no need to ship it.",
    variables: ["orderId"],
    email: true,
    sms: false,
  },
  {
    key: "seller_low_stock",
    name: "Low stock alert",
    audience: "Seller",
    type: "stock",
    title: "{{stockStatus}}",
    message: "{{product}} ({{sku}}) has {{stock}} unit(s) left.",
    variables: ["stockStatus", "product", "sku", "stock"],
    email: true,
    sms: false,
  },
];

const DEFAULTS = new Map(DEFAULT_TEMPLATES.map((template) => [template.key, template]));
const CACHE_MS = 60 * 1000;
let cache = { at: 0, overrides: new Map() };

export function clearTemplateCache() {
  cache = { at: 0, overrides: new Map() };
}

async function overrides() {
  if (Date.now() - cache.at < CACHE_MS) return cache.overrides;
  const rows = await NotificationTemplate.find().lean();
  cache = { at: Date.now(), overrides: new Map(rows.map((row) => [row.key, row])) };
  return cache.overrides;
}

/** A template with any admin override applied. */
export async function getTemplate(key) {
  const base = DEFAULTS.get(key);
  if (!base) throw new Error(`Unknown notification template: ${key}`);
  const override = (await overrides()).get(key);
  return override
    ? {
        ...base,
        title: override.title,
        message: override.message,
        email: override.email,
        sms: override.sms,
        customised: true,
        updatedAt: override.updatedAt,
      }
    : { ...base, customised: false };
}

export const renderTemplate = (text, vars = {}) =>
  String(text)
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name) => (vars[name] ?? "").toString())
    .replace(/\s{2,}/g, " ")
    .trim();

/** Sends an automatic notification using its (possibly customised) template. */
export async function sendTemplated(key, recipients, vars = {}, { link } = {}) {
  try {
    const template = await getTemplate(key);
    const payload = {
      type: template.type,
      title: renderTemplate(template.title, vars),
      message: renderTemplate(template.message, vars),
      link,
    };
    const ids = (Array.isArray(recipients) ? recipients : [recipients]).filter(Boolean);
    await notifyMany(ids, payload, { email: template.email, sms: template.sms });
  } catch (error) {
    console.error(`[notify] template ${key} failed:`, error.message);
  }
}

/* ---------------- Newsletter unsubscribe ---------------- */

const unsubscribeKey = () => `smart-deal-unsubscribe:${process.env.JWT_SECRET || ""}`;
export const unsubscribeToken = (email) =>
  crypto.createHmac("sha256", unsubscribeKey()).update(String(email).toLowerCase()).digest("hex");

export function unsubscribeUrl(email) {
  const api = (process.env.PUBLIC_API_URL || "").replace(/\/$/, "");
  const base = api || `http://localhost:${process.env.PORT || 5050}/api`;
  return `${base}/public/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubscribeToken(email)}`;
}

/* ---------------- Campaigns ---------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Customer ids (opted in to offers) for a campaign audience, or subscriber emails. */
export async function resolveAudience(audience) {
  if (audience.type === "subscribers") {
    const subscribers = await Subscriber.find({ isActive: { $ne: false } })
      .select("email")
      .lean();
    return { emails: subscribers.map((row) => row.email), userIds: [] };
  }

  const filter = {
    role: "Customer",
    status: "Active",
    deletedAt: null,
    "notificationPrefs.marketing": true,
  };
  if (audience.type === "emirate")
    filter.addresses = { $elemMatch: { isDefault: true, emirate: audience.emirate } };
  if (["recent_buyers", "lapsed"].includes(audience.type)) {
    const since = new Date(Date.now() - (audience.days || 30) * DAY_MS);
    const buyers = await Order.distinct("user", { createdAt: { $gte: since } });
    filter._id = audience.type === "recent_buyers" ? { $in: buyers } : { $nin: buyers };
  }
  const users = await User.find(filter).select("_id").lean();
  return { userIds: users.map((user) => user._id), emails: [] };
}

/** Sends a campaign once; safe to call concurrently (only one caller claims it). */
export async function deliverCampaign(campaignId) {
  const campaign = await Campaign.findOneAndUpdate(
    { _id: campaignId, status: "Scheduled" }, // Only one caller can move it on
    { $set: { status: "Sending" } },
    { new: true },
  );
  if (!campaign) return;
  try {
    const { userIds, emails } = await resolveAudience(campaign.audience);
    const link = campaign.link || undefined;
    for (const id of userIds) {
      // In-app always; email and SMS only for people who opted in to offers.
      await notify(
        id,
        { type: "promo", title: campaign.title, message: campaign.message, link },
        { email: campaign.channels.email, sms: campaign.channels.sms, marketing: true },
      );
    }
    for (const email of emails) {
      const target = link
        ? `${clientUrl()}${link.startsWith("/") ? link : `/${link}`}`
        : clientUrl();
      sendEmail(
        email,
        campaign.title,
        `${campaign.message}\n\nShop now: ${target}\n\nUnsubscribe: ${unsubscribeUrl(email)}`,
      );
    }
    campaign.set({
      status: "Sent",
      sentAt: new Date(),
      recipientCount: userIds.length + emails.length,
    });
  } catch (error) {
    campaign.set({ status: "Failed", error: error.message });
  }
  await campaign.save();
}

/** Checks every minute for scheduled campaigns that are due. */
export function startCampaignScheduler() {
  const tick = async () => {
    try {
      const due = await Campaign.find({ status: "Scheduled", scheduledFor: { $lte: new Date() } })
        .select("_id")
        .lean();
      for (const campaign of due) await deliverCampaign(campaign._id);
    } catch (error) {
      console.error("[campaigns] scheduler failed:", error.message);
    }
  };
  const timer = setInterval(tick, 60 * 1000);
  timer.unref?.();
  void tick();
  return timer;
}
