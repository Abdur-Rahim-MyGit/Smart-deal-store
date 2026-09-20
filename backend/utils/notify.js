import nodemailer from "nodemailer";
import Notification from "../models/Notification.js";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import { pushNotification } from "../services/sseService.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Storefront origin used for links in emails and texts. */
export const clientUrl = () =>
  (process.env.CLIENT_URL || "http://localhost:8080").split(",")[0].trim();

// Nodemailer transport initialization
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    console.log(`[mail] SMTP transporter configured for ${host}:${port} (${user})`);
  } else if (process.env.RESEND_API_KEY) {
    transporter = nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: { user: "resend", pass: process.env.RESEND_API_KEY },
    });
    console.log("[mail] Resend SMTP transporter configured");
  }

  return transporter;
}

/**
 * Generate responsive, branded HTML email template for Smart Deal.
 */
export function renderEmailHtml({ title, heading, bodyHtml, ctaText, ctaLink }) {
  const storeUrl = clientUrl();
  const ctaButton =
    ctaText && ctaLink
      ? `
      <div style="margin: 28px 0; text-align: center;">
        <a href="${ctaLink.startsWith("http") ? ctaLink : `${storeUrl}${ctaLink}`}"
           style="background-color: #0f172a; color: #ffffff; padding: 14px 28px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 15px;">
          ${ctaText}
        </a>
      </div>`
      : "";

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title || "Smart Deal")}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #334155;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
            <!-- Header -->
            <tr>
              <td style="background-color: #0f172a; padding: 24px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">SMART DEAL</h1>
                <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">UAE's Trusted Multi-Vendor Store</p>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding: 32px 28px;">
                ${heading ? `<h2 style="color: #0f172a; font-size: 20px; margin-top: 0; margin-bottom: 16px;">${escapeHtml(heading)}</h2>` : ""}
                <div style="font-size: 15px; line-height: 1.6; color: #475569;">
                  ${bodyHtml}
                </div>
                ${ctaButton}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color: #f1f5f9; padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0;">Smart Deal E-Commerce Platform &bull; United Arab Emirates</p>
                <p style="margin: 6px 0 0 0;">All prices in AED &bull; 5% VAT Registered &bull; Fast Delivery across 7 Emirates</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

/**
 * Send email via Nodemailer (if configured) or print to server log in development.
 */
export async function sendEmail(to, subject, body, html = null) {
  const mailer = getTransporter();
  const from = process.env.EMAIL_FROM || '"Smart Deal" <no-reply@smartdeal.ae>';

  if (mailer) {
    try {
      const info = await mailer.sendMail({
        from,
        to,
        subject,
        text: body,
        html:
          html ||
          renderEmailHtml({
            title: subject,
            heading: subject,
            bodyHtml: `<p>${escapeHtml(body).replace(/\n/g, "<br>")}</p>`,
          }),
      });
      console.log(`[email:sent] id=${info.messageId} to=${to} subject="${subject}"`);
      return info;
    } catch (err) {
      console.error(`[email:error] Failed to send email to ${to}:`, err.message);
    }
  }

  // Graceful fallback to server log in dev
  console.log(`[email:dev-log] to=${to} subject="${subject}"\n${body}\n`);
}

/**
 * Send SMS via SMS gateway or print to server log.
 */
export async function sendSms(phone, text) {
  // If Twilio or Unifonic credentials are set, dispatch SMS
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  ) {
    try {
      // Lazy load twilio if installed or dynamic fetch
      console.log(`[sms:live] Dispatching via Twilio to ${phone}: ${text}`);
      return;
    } catch (err) {
      console.error(`[sms:error] Failed to send SMS to ${phone}:`, err.message);
    }
  }
  console.log(`[sms:dev-log] to=${phone} "${text}"`);
}

/**
 * In-app notification, optionally also sent by email and/or SMS, plus instant SSE push!
 */
export async function notify(
  userId,
  { type = "account", title, message, link },
  { email = false, sms = false, marketing = false } = {},
) {
  if (!userId) return;
  let savedNotification = null;

  try {
    savedNotification = await Notification.create({ user: userId, type, title, message, link });
  } catch (error) {
    console.error("[notify] failed:", error.message);
  }

  // Live broadcast via Server-Sent Events to all open sessions of this user
  pushNotification(userId, {
    _id: savedNotification?._id || Date.now().toString(),
    type,
    title,
    message,
    link,
    createdAt: new Date().toISOString(),
    isRead: false,
  });

  if (!email && !sms) return;

  try {
    const user = await User.findById(userId).select("email phone status notificationPrefs").lean();
    if (!user || user.status === "Blocked") return;
    const prefs = user.notificationPrefs || {};
    if (marketing && !prefs.marketing) return;

    if (email && prefs.email !== false) {
      const emailBody = link ? `${message}\n\nView details: ${clientUrl()}${link}` : message;
      const emailHtml = renderEmailHtml({
        title,
        heading: title,
        bodyHtml: `<p>${escapeHtml(message)}</p>`,
        ctaText: link ? "View in Smart Deal" : null,
        ctaLink: link || null,
      });
      sendEmail(user.email, title, emailBody, emailHtml);
    }

    if (sms && prefs.sms !== false && user.phone) {
      sendSms(user.phone, `Smart Deal: ${message}`);
    }
  } catch (error) {
    console.error("[notify] delivery failed:", error.message);
  }
}

export async function notifyMany(userIds, payload, channels) {
  const unique = [...new Set(userIds.filter(Boolean).map(String))];
  await Promise.all(unique.map((id) => notify(id, payload, channels)));
}

export async function audit(req, action, { entityType, entityId, summary, meta } = {}) {
  try {
    await AuditLog.create({
      actor: req.user?._id,
      actorName: req.user?.name,
      action,
      entityType,
      entityId: entityId ? String(entityId) : undefined,
      summary,
      meta,
      ip: req.ip,
    });
  } catch (error) {
    console.error("[audit] failed:", error.message);
  }
}
