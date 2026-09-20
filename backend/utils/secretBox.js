import crypto from "crypto";

/*
 * Encrypts small secrets at rest (AES-256-GCM). The key comes from MFA_ENCRYPTION_KEY, or is
 * derived from JWT_SECRET when that isn't set. Changing the key makes stored secrets unreadable,
 * so affected admins would need to set up two-step sign-in again.
 */
function key() {
  const material = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || "";
  return crypto.createHash("sha256").update(`smart-deal-mfa:${material}`).digest();
}

export function seal(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
}

export function unseal(sealed) {
  if (!sealed) return null;
  try {
    const [iv, tag, body] = String(sealed)
      .split(".")
      .map((part) => Buffer.from(part, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null; // Wrong key or tampered value
  }
}
