import QRCode from "qrcode";
import User from "../models/User.js";
import Setting from "../models/Setting.js";
import {
  HttpError,
  asyncHandler,
  badRequest,
  forbidden,
  notFound,
  unauthorized,
} from "../utils/http.js";
import { audit, sendEmail } from "../utils/notify.js";
import { generateSecret, otpauthUrl } from "../utils/totp.js";
import { seal } from "../utils/secretBox.js";
import { consumeSecondFactor, generateRecoveryCodes, readMfaChallenge } from "../utils/mfa.js";
import { issueSession, recordFailedSignIn } from "./authController.js";

const SECRET_FIELDS = "+mfa.secret +mfa.pendingSecret +mfa.recoveryCodes";

const loadSelf = (req) => User.findById(req.user._id).select(`+password ${SECRET_FIELDS}`);

function assertStaff(user) {
  if (user.role !== "Admin") throw forbidden("Two-step sign-in is available for staff accounts");
}

// @route POST /api/auth/mfa/verify — body: { mfaToken, code } (second step of signing in)
export const verifyMfaSignIn = asyncHandler(async (req, res) => {
  const userId = readMfaChallenge(req.body.mfaToken);
  if (!userId) throw unauthorized("This sign-in has expired. Please sign in again.");
  const user = await User.findById(userId).select(SECRET_FIELDS);
  if (!user || user.status === "Blocked" || !user.mfa?.enabled)
    throw unauthorized("This sign-in has expired. Please sign in again.");
  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
    throw new HttpError(423, `Account temporarily locked. Try again in ${minutes} minute(s).`);
  }

  const method = consumeSecondFactor(user, req.body.code);
  if (!method) {
    if (await recordFailedSignIn(user))
      throw new HttpError(423, "Too many failed attempts. Your account is locked for 15 minutes.");
    throw badRequest("That code isn't right. Check your authenticator app and try again.");
  }
  if (method === "recovery") {
    sendEmail(
      user.email,
      "A Smart Deal recovery code was used",
      `A recovery code was just used to sign in to your staff account. ${user.mfa.recoveryCodes.length} code(s) remain. If this wasn't you, contact a super admin immediately.`,
    );
  }
  user.loginAttempts = 0;
  user.firstFailedLoginAt = undefined;
  user.lockUntil = undefined;
  await issueSession(req, res, user);
});

// @route GET /api/auth/mfa — current state for the signed-in staff member
export const getMfaStatus = asyncHandler(async (req, res) => {
  assertStaff(req.user);
  const [user, settings] = await Promise.all([
    User.findById(req.user._id).select("+mfa.recoveryCodes"),
    Setting.getSingleton(),
  ]);
  res.json({
    success: true,
    enabled: Boolean(user.mfa?.enabled),
    enabledAt: user.mfa?.enabledAt ?? null,
    recoveryCodesLeft: user.mfa?.recoveryCodes?.length ?? 0,
    required: Boolean(settings.requireAdminMfa),
  });
});

// @route POST /api/auth/mfa/setup — starts enrolment; returns the secret and a QR code
export const setupMfa = asyncHandler(async (req, res) => {
  assertStaff(req.user);
  const user = await loadSelf(req);
  if (user.mfa?.enabled) throw badRequest("Two-step sign-in is already on");
  const secret = generateSecret();
  user.set("mfa.pendingSecret", seal(secret));
  await user.save({ validateBeforeSave: false });
  const url = otpauthUrl(secret, user.email);
  res.json({
    success: true,
    secret,
    otpauthUrl: url,
    qrSvg: await QRCode.toString(url, { type: "svg", margin: 1, width: 200 }),
  });
});

// @route POST /api/auth/mfa/enable — body: { code } from the newly added authenticator
export const enableMfa = asyncHandler(async (req, res) => {
  assertStaff(req.user);
  const user = await loadSelf(req);
  if (user.mfa?.enabled) throw badRequest("Two-step sign-in is already on");
  if (!user.mfa?.pendingSecret) throw badRequest("Start the setup again");
  if (!consumeSecondFactor(user, req.body.code, { secretField: "pendingSecret" }))
    throw badRequest("That code isn't right. Check the time on your phone and try again.");

  const { codes, hashes } = generateRecoveryCodes();
  user.set({
    "mfa.enabled": true,
    "mfa.secret": user.mfa.pendingSecret,
    "mfa.pendingSecret": undefined,
    "mfa.recoveryCodes": hashes,
    "mfa.enabledAt": new Date(),
  });
  await user.save({ validateBeforeSave: false });
  await audit(req, "mfa.enable", { entityType: "User", entityId: user._id, summary: user.email });
  res.json({
    success: true,
    message: "Two-step sign-in is on",
    recoveryCodes: codes, // Shown once; only hashes are stored
  });
});

// @route POST /api/auth/mfa/disable — body: { password, code }
export const disableMfa = asyncHandler(async (req, res) => {
  assertStaff(req.user);
  const settings = await Setting.getSingleton();
  if (settings.requireAdminMfa)
    throw badRequest("Two-step sign-in is required for every staff account on this store");
  const user = await loadSelf(req);
  if (!user.mfa?.enabled) throw badRequest("Two-step sign-in is already off");
  if (!(await user.matchPassword(String(req.body.password || ""))))
    throw badRequest("Your password is incorrect");
  if (!consumeSecondFactor(user, req.body.code)) throw badRequest("That code isn't right");

  user.set("mfa", { enabled: false });
  await user.save({ validateBeforeSave: false });
  await audit(req, "mfa.disable", { entityType: "User", entityId: user._id, summary: user.email });
  res.json({ success: true, message: "Two-step sign-in is off" });
});

// @route POST /api/auth/mfa/recovery-codes — body: { code }; replaces all recovery codes
export const regenerateRecoveryCodes = asyncHandler(async (req, res) => {
  assertStaff(req.user);
  const user = await loadSelf(req);
  if (!user.mfa?.enabled) throw badRequest("Turn on two-step sign-in first");
  if (!consumeSecondFactor(user, req.body.code)) throw badRequest("That code isn't right");
  const { codes, hashes } = generateRecoveryCodes();
  user.set("mfa.recoveryCodes", hashes);
  await user.save({ validateBeforeSave: false });
  await audit(req, "mfa.recovery_codes", {
    entityType: "User",
    entityId: user._id,
    summary: user.email,
  });
  res.json({ success: true, message: "New recovery codes created", recoveryCodes: codes });
});

// @route POST /api/admin/staff/:id/mfa-reset — super admins, for a lost phone
export const resetStaffMfa = asyncHandler(async (req, res) => {
  const staff = await User.findOne({ _id: req.params.id, role: "Admin" });
  if (!staff) throw notFound("Staff account not found");
  if (String(staff._id) === String(req.user._id))
    throw badRequest("Turn your own two-step sign-in off from your security settings");
  staff.set("mfa", { enabled: false });
  staff.sessions = []; // They sign in again and set it up from scratch
  await staff.save({ validateBeforeSave: false });
  sendEmail(
    staff.email,
    "Your Smart Deal two-step sign-in was reset",
    "A super admin reset two-step sign-in on your staff account. Sign in again and set it up from Security in the admin console.",
  );
  await audit(req, "mfa.reset", { entityType: "User", entityId: staff._id, summary: staff.email });
  res.json({ success: true, message: `Two-step sign-in reset for ${staff.name}` });
});
