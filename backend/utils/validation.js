import { badRequest } from "./http.js";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const UAE_PHONE_RE = /^\+971\d{8,9}$/;

/** Accepts "050 123 4567", "971501234567" or "+971501234567" and returns +971XXXXXXXXX. */
export function normalizePhone(raw) {
  if (!raw) return raw;
  let phone = String(raw).replace(/[\s()-]/g, "");
  if (phone.startsWith("00971")) phone = `+${phone.slice(2)}`;
  else if (phone.startsWith("971")) phone = `+${phone}`;
  else if (phone.startsWith("0")) phone = `+971${phone.slice(1)}`;
  return phone;
}

export function assertEmail(email) {
  if (!email || !EMAIL_RE.test(String(email)))
    throw badRequest("Please enter a valid email address");
}

export function assertPhone(phone) {
  if (!phone || !UAE_PHONE_RE.test(phone))
    throw badRequest("Please enter a valid UAE mobile number (+971XXXXXXXXX)");
}

/** 8+ chars with upper, lower, digit and special character. */
export function assertStrongPassword(password) {
  const value = String(password || "");
  const problems = [];
  if (value.length < 8) problems.push("at least 8 characters");
  if (!/[A-Z]/.test(value)) problems.push("an uppercase letter");
  if (!/[a-z]/.test(value)) problems.push("a lowercase letter");
  if (!/\d/.test(value)) problems.push("a number");
  if (!/[^A-Za-z0-9]/.test(value)) problems.push("a special character");
  if (problems.length) throw badRequest(`Password must contain ${problems.join(", ")}`);
}

export function requireFields(body, fields) {
  const missing = fields.filter(
    (field) => body?.[field] === undefined || body?.[field] === null || body?.[field] === "",
  );
  if (missing.length) throw badRequest(`Missing required field(s): ${missing.join(", ")}`);
}

const BANNED_WORDS = ["scam", "fraud", "idiot", "stupid", "crypto", "http://", "https://", "www."];

export const containsBannedWords = (text) =>
  BANNED_WORDS.some((word) => String(text).toLowerCase().includes(word));
