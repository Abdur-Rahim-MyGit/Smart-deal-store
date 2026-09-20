/** Shared validation and redirect helpers for the auth screens. */
import type { Role } from "@/lib/types";

/** Mirrors the backend's normalizePhone: "050 123 4567" → "+971501234567". */
export function normalizePhone(raw: string): string {
  let phone = String(raw ?? "").replace(/[\s()-]/g, "");
  if (phone.startsWith("00971")) phone = `+${phone.slice(2)}`;
  else if (phone.startsWith("971")) phone = `+${phone}`;
  else if (phone.startsWith("0")) phone = `+971${phone.slice(1)}`;
  return phone;
}

export const UAE_PHONE_RE = /^\+971\d{8,9}$/;
export const isUaePhone = (phone: string): boolean => UAE_PHONE_RE.test(normalizePhone(phone));

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (value: string): boolean => EMAIL_RE.test(value.trim());

/** UAE IBANs are "AE" followed by 21 digits. */
export const isUaeIban = (value: string): boolean =>
  /^AE\d{21}$/.test(value.replace(/\s/g, "").toUpperCase());

export interface PasswordRule {
  label: string;
  met: boolean;
}

/** The same five rules the API enforces, so the checklist never lies. */
export function passwordRules(password: string): PasswordRule[] {
  return [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One number", met: /\d/.test(password) },
    { label: "One symbol (! @ # …)", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export const isStrongPassword = (password: string): boolean =>
  passwordRules(password).every((rule) => rule.met);

/**
 * Where to send someone once they are signed in. An explicit `redirect` is only
 * honoured when it is a path on this site, otherwise the role decides.
 */
export function resolveRedirect(redirect: string | undefined, role: Role): string {
  if (redirect && redirect.startsWith("/")) return redirect;
  if (role === "Admin") return "/admin-dashboard";
  if (role === "Vendor") return "/vendor-dashboard";
  return "/";
}
