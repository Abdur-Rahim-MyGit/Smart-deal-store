import crypto from "crypto";

/*
 * Time-based one-time passwords (RFC 6238, SHA-1, 6 digits, 30 s) — the codes authenticator
 * apps such as Google Authenticator, Microsoft Authenticator and 1Password show.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text) {
  const clean = String(text)
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export const generateSecret = () => base32Encode(crypto.randomBytes(20));

export function totp(secret, timeMs = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / 1000 / STEP_SECONDS)));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** Accepts the current code or one step either side, to allow for clock drift. */
export function verifyTotp(secret, code, { window = 1, timeMs = Date.now() } = {}) {
  const digits = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(digits)) return false;
  for (let step = -window; step <= window; step += 1) {
    const expected = totp(secret, timeMs + step * STEP_SECONDS * 1000);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(digits))) return true;
  }
  return false;
}

export function otpauthUrl(secret, account, issuer = "Smart Deal") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}
