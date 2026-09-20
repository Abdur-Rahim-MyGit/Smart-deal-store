import crypto from "crypto";
import jwt from "jsonwebtoken";
import { totp } from "./totp.js";
import { unseal } from "./secretBox.js";

const CHALLENGE_TTL = "5m";
const STEP_MS = 30 * 1000;
const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const normalizeRecovery = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

/** Password (or phone code / Google) was right; ask for the authenticator code next. */
export function startMfaChallenge(res, user) {
  const mfaToken = jwt.sign({ id: user._id, purpose: "mfa" }, process.env.JWT_SECRET, {
    expiresIn: CHALLENGE_TTL,
  });
  res.json({
    success: true,
    mfaRequired: true,
    mfaToken,
    message: "Enter the 6-digit code from your authenticator app",
  });
}

export function readMfaChallenge(token) {
  try {
    const payload = jwt.verify(String(token || ""), process.env.JWT_SECRET);
    return payload.purpose === "mfa" ? payload.id : null;
  } catch {
    return null;
  }
}

/** Ten single-use recovery codes like "7KQ2-9XWD"; returns the codes and their hashes. */
export function generateRecoveryCodes(count = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codes = Array.from({ length: count }, () => {
    const chars = Array.from(crypto.randomBytes(8), (byte) => alphabet[byte % alphabet.length]);
    return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
  });
  return { codes, hashes: codes.map((code) => hash(normalizeRecovery(code))) };
}

/**
 * Checks an authenticator or recovery code against a user loaded with the MFA secret fields.
 * On success it updates the user in memory (replay guard / used recovery code); the caller
 * saves. Returns "totp", "recovery" or null.
 */
export function consumeSecondFactor(user, code, { secretField = "secret" } = {}) {
  const input = String(code || "").trim();
  const secret = unseal(user.mfa?.[secretField]);
  if (secret && /^\d{3}\s?\d{3}$/.test(input)) {
    const digits = input.replace(/\s/g, "");
    const now = Date.now();
    for (const offset of [-1, 0, 1]) {
      const time = now + offset * STEP_MS;
      const step = Math.floor(time / STEP_MS);
      if (totp(secret, time) !== digits) continue;
      // A code can't be used twice, so a shoulder-surfed code is worthless once used.
      if (user.mfa.lastUsedStep && step <= user.mfa.lastUsedStep) return null;
      user.mfa.lastUsedStep = step;
      return "totp";
    }
    return null;
  }
  const recovery = normalizeRecovery(input);
  if (recovery.length === 8) {
    const hashed = hash(recovery);
    const codes = user.mfa?.recoveryCodes ?? [];
    if (codes.includes(hashed)) {
      user.mfa.recoveryCodes = codes.filter((entry) => entry !== hashed);
      return "recovery";
    }
  }
  return null;
}
