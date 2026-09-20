import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { generateAccessToken, generateRefreshToken } from "../middleware/authMiddleware.js";
import {
  HttpError,
  asyncHandler,
  badRequest,
  conflict,
  forbidden,
  notFound,
  pick,
  unauthorized,
} from "../utils/http.js";
import {
  assertEmail,
  assertPhone,
  assertStrongPassword,
  normalizePhone,
  requireFields,
} from "../utils/validation.js";
import { readAddressInput } from "../utils/address.js";
import { clientUrl, notify, sendEmail, sendSms } from "../utils/notify.js";
import { notifyAdmins } from "../services/orderService.js";
import { startMfaChallenge } from "../utils/mfa.js";

const REFRESH_COOKIE = "sd_refresh";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 5;
const ROTATION_GRACE_MS = 60 * 1000;
const OTP_TTL_MS = 2 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const FAILED_LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

const isProduction = () => process.env.NODE_ENV === "production";
// First-touch acquisition channel captured by the storefront (utm_source or referrer host).
const readSignupSource = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 60) || "direct";
const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

function cookieOptions() {
  const sameSite = process.env.COOKIE_SAMESITE || "lax";
  return {
    httpOnly: true,
    sameSite,
    secure: isProduction() || sameSite === "none",
    path: "/api/auth",
  };
}

/**
 * Counts a failed sign-in step (password or two-step code). Five inside ten minutes lock the
 * account for 15 minutes and email the owner. Returns true when this failure locked it.
 */
export async function recordFailedSignIn(user) {
  const windowExpired =
    !user.firstFailedLoginAt ||
    Date.now() - user.firstFailedLoginAt.getTime() > FAILED_LOGIN_WINDOW_MS;
  if (windowExpired) {
    user.loginAttempts = 0;
    user.firstFailedLoginAt = new Date();
  }
  user.loginAttempts += 1;
  if (user.loginAttempts >= MAX_FAILED_LOGINS) {
    user.lockUntil = new Date(Date.now() + LOCK_MS);
    user.loginAttempts = 0;
    user.firstFailedLoginAt = undefined;
    await user.save({ validateBeforeSave: false });
    sendEmail(
      user.email,
      "Your Smart Deal account was temporarily locked",
      "We noticed 5 failed sign-in attempts. Your account is locked for 15 minutes. If this wasn't you, reset your password.",
    );
    return true;
  }
  await user.save({ validateBeforeSave: false });
  return false;
}

/** Accounts with two-step sign-in get a code challenge instead of a session. */
async function completeSignIn(req, res, user) {
  if (user.mfa?.enabled) {
    await user.save({ validateBeforeSave: false }); // Keeps the reset attempt counters
    return startMfaChallenge(res, user);
  }
  return issueSession(req, res, user);
}

/** Issues an access token plus a rotating refresh cookie, tracked per device. */
export async function issueSession(req, res, user, statusCode = 200) {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  const now = Date.now();

  user.sessions = (user.sessions || [])
    .filter((session) => session.expiresAt.getTime() > now)
    .slice(-(MAX_SESSIONS - 1));
  user.sessions.push({
    tokenHash: hashToken(refreshToken),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 200),
    expiresAt: new Date(now + REFRESH_TTL_MS),
  });
  user.lastLoginAt = new Date();
  user.lastActiveAt = user.lastLoginAt;
  await user.save({ validateBeforeSave: false });

  res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions(), maxAge: REFRESH_TTL_MS });
  res.status(statusCode).json({ success: true, accessToken, user });
}

// @route POST /api/auth/register
export const registerUser = asyncHandler(async (req, res) => {
  requireFields(req.body, ["name", "email", "phone", "password"]);
  const role = req.body.role === "Vendor" ? "Vendor" : "Customer"; // Admins are created by admins only
  const email = String(req.body.email).toLowerCase().trim();
  const phone = normalizePhone(req.body.phone);
  assertEmail(email);
  assertPhone(phone);
  assertStrongPassword(req.body.password);

  if (await User.exists({ email })) throw conflict("An account with this email already exists");
  if (await User.exists({ phone }))
    throw conflict("An account with this phone number already exists");

  let vendorDetails;
  if (role === "Vendor") {
    const input = req.body.vendorDetails || {};
    if (!input.businessName || !input.tradeLicenseNumber) {
      throw badRequest("Sellers must provide a business name and trade license number");
    }
    vendorDetails = {
      ...pick(input, [
        "businessName",
        "tradeLicenseNumber",
        "corporateAddress",
        "vatNumber",
        "storeDescription",
        "supportEmail",
        "supportPhone",
      ]),
      bankAccount: pick(input.bankAccount || {}, [
        "bankName",
        "accountName",
        "accountNumber",
        "iban",
      ]),
      isApproved: false,
      status: "Pending Review",
    };
  }

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const user = await User.create({
    name: String(req.body.name).trim(),
    email,
    phone,
    password: req.body.password,
    role,
    verificationToken,
    vendorDetails,
    signupSource: readSignupSource(req.body.signupSource),
  });

  sendEmail(
    user.email,
    "Welcome to Smart Deal — please verify your email",
    `Hi ${user.name},\n\nConfirm your email address: ${clientUrl()}/verify-email?token=${verificationToken}`,
  );

  await notify(user._id, {
    type: "account",
    title: "Welcome to Smart Deal",
    message:
      role === "Vendor"
        ? "Your seller application is under review. We'll let you know as soon as it's approved."
        : "Your account is ready. Happy shopping!",
    link: role === "Vendor" ? "/vendor-dashboard" : "/",
  });

  if (role === "Vendor") {
    await notifyAdmins("vendors", {
      type: "account",
      title: "New seller application",
      message: `${vendorDetails.businessName} applied to sell on Smart Deal.`,
      link: "/admin-dashboard?tab=vendors",
    });
  }

  await issueSession(req, res, user, 201);
});

// @route POST /api/auth/login
export const loginUser = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "")
    .toLowerCase()
    .trim();
  const password = String(req.body.password || "");
  if (!email || !password) throw badRequest("Email and password are required");

  const user = await User.findOne({ email }).select("+password");
  if (!user) throw unauthorized("Invalid email or password");

  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
    throw new HttpError(423, `Account temporarily locked. Try again in ${minutes} minute(s).`);
  }

  if (!(await user.matchPassword(password))) {
    // Only failures within the same 10-minute window count towards the lock.
    if (await recordFailedSignIn(user))
      throw new HttpError(423, "Too many failed attempts. Your account is locked for 15 minutes.");
    throw unauthorized("Invalid email or password");
  }

  if (user.status === "Blocked")
    throw forbidden("Your account has been blocked. Please contact support.");

  user.loginAttempts = 0;
  user.firstFailedLoginAt = undefined;
  user.lockUntil = undefined;
  await completeSignIn(req, res, user);
});

// @route POST /api/auth/otp/send
export const sendOTP = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  assertPhone(phone);

  const user = await User.findOne({ phone });
  if (!user) throw notFound("No account is registered with this mobile number");
  if (user.status === "Blocked")
    throw forbidden("Your account has been blocked. Please contact support.");

  if (user.otp?.cooldownUntil && user.otp.cooldownUntil.getTime() > Date.now()) {
    const seconds = Math.ceil((user.otp.cooldownUntil.getTime() - Date.now()) / 1000);
    throw new HttpError(429, `Please wait ${seconds}s before requesting another code`);
  }

  const code = crypto.randomInt(100000, 1000000).toString();
  user.otp = {
    code: hashToken(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
    cooldownUntil: new Date(Date.now() + OTP_COOLDOWN_MS),
  };
  await user.save({ validateBeforeSave: false });

  sendSms(phone, `Your Smart Deal sign-in code is ${code}. It expires in 2 minutes.`);

  res.json({
    success: true,
    message: "We sent a 6-digit code to your mobile number",
    cooldownSeconds: OTP_COOLDOWN_MS / 1000,
    // No SMS gateway in development, so the code is returned for testing.
    ...(!isProduction() ? { devCode: code } : {}),
  });
});

// @route POST /api/auth/otp/verify
export const verifyOTP = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const code = String(req.body.code || "").trim();
  assertPhone(phone);

  const user = await User.findOne({ phone });
  if (!user?.otp?.code) throw badRequest("Please request a new code first");
  if (user.otp.expiresAt.getTime() < Date.now())
    throw badRequest("This code has expired. Please request a new one.");
  if (user.otp.attempts >= 3)
    throw new HttpError(429, "Too many incorrect codes. Please request a new one.");

  if (hashToken(code) !== user.otp.code) {
    user.otp.attempts += 1;
    await user.save({ validateBeforeSave: false });
    throw badRequest("Incorrect code");
  }

  if (user.status === "Blocked")
    throw forbidden("Your account has been blocked. Please contact support.");

  user.otp = undefined;
  user.isVerified = true;
  await completeSignIn(req, res, user);
});

// @route POST /api/auth/google  — body: { credential } (Google Identity Services ID token)
export const googleAuth = asyncHandler(async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new HttpError(503, "Google sign-in is not configured on this server");
  if (!req.body.credential) throw badRequest("Missing Google credential");

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(req.body.credential)}`,
  );
  if (!response.ok) throw unauthorized("Google sign-in failed. Please try again.");
  const info = await response.json();

  const emailVerified = info.email_verified === true || info.email_verified === "true";
  if (info.aud !== clientId || !emailVerified || !info.email) {
    throw unauthorized("Your Google account could not be verified");
  }

  const email = String(info.email).toLowerCase();
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name: info.name || email.split("@")[0],
      email,
      password: crypto.randomBytes(24).toString("hex"),
      role: "Customer",
      avatar: info.picture,
      authProvider: "google",
      isVerified: true,
      signupSource: readSignupSource(req.body.signupSource),
    });
  }

  if (user.status === "Blocked")
    throw forbidden("Your account has been blocked. Please contact support.");
  user.isVerified = true;
  await completeSignIn(req, res, user);
});

// @route POST /api/auth/refresh — rotates the refresh cookie
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  const expired = () => {
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    return unauthorized("Session expired. Please sign in again.");
  };
  if (!token) throw expired();

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw expired();
  }

  const user = await User.findById(decoded.id);
  if (!user || user.status === "Blocked") throw expired();

  const hash = hashToken(token);
  const session = user.sessions.find((entry) => entry.tokenHash === hash);
  const graceSession = session
    ? null
    : user.sessions.find(
        (entry) =>
          entry.previousHash === hash &&
          entry.rotatedAt &&
          Date.now() - entry.rotatedAt.getTime() < ROTATION_GRACE_MS,
      );

  if (!session && !graceSession) throw expired();

  if (graceSession) {
    // Another tab already rotated this token; the browser holds the new cookie.
    return res.json({ success: true, accessToken: generateAccessToken(user._id), user });
  }

  const nextToken = generateRefreshToken(user._id);
  session.previousHash = session.tokenHash;
  session.rotatedAt = new Date();
  session.tokenHash = hashToken(nextToken);
  session.expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  user.lastActiveAt = new Date();
  await user.save({ validateBeforeSave: false });

  res.cookie(REFRESH_COOKIE, nextToken, { ...cookieOptions(), maxAge: REFRESH_TTL_MS });
  res.json({ success: true, accessToken: generateAccessToken(user._id), user });
});

// @route POST /api/auth/logout — ends the current device session
export const logoutUser = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, { ignoreExpiration: true });
      await User.updateOne(
        { _id: decoded.id },
        { $pull: { sessions: { tokenHash: hashToken(token) } } },
      );
    } catch {
      // Invalid cookie: nothing to revoke.
    }
  }
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  res.json({ success: true, message: "Signed out" });
});

// @route POST /api/auth/logout-all
export const logoutAll = asyncHandler(async (req, res) => {
  req.user.sessions = [];
  await req.user.save({ validateBeforeSave: false });
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  res.json({ success: true, message: "Signed out of all devices" });
});

// @route POST /api/auth/forgot-password
/** Emails a one-hour, single-use reset link and returns it (shown in development only). */
export async function sendPasswordReset(user) {
  const token = crypto.randomBytes(32).toString("hex");
  user.resetPasswordTokenHash = hashToken(token);
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });
  const resetUrl = `${clientUrl()}/reset-password?token=${token}`;
  sendEmail(
    user.email,
    "Reset your Smart Deal password",
    `This link expires in 1 hour:\n${resetUrl}`,
  );
  return resetUrl;
}

export const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "")
    .toLowerCase()
    .trim();
  assertEmail(email);

  const user = await User.findOne({ email });
  let resetUrl;
  if (user && user.status !== "Blocked") resetUrl = await sendPasswordReset(user);

  // Same response whether or not the account exists, so emails can't be enumerated.
  res.json({
    success: true,
    message: "If an account exists for that email, we've sent a password reset link.",
    ...(!isProduction() && resetUrl ? { devResetUrl: resetUrl } : {}),
  });
});

// @route POST /api/auth/reset-password — body: { token, password }
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token) throw badRequest("This reset link is invalid");
  assertStrongPassword(password);

  const user = await User.findOne({
    resetPasswordTokenHash: hashToken(token),
    resetPasswordExpires: { $gt: new Date() },
  });
  if (!user)
    throw badRequest("This reset link is invalid or has expired. Please request a new one.");

  user.password = password;
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpires = undefined;
  user.sessions = [];
  user.loginAttempts = 0;
  user.firstFailedLoginAt = undefined;
  user.lockUntil = undefined;
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: "Your password has been updated. You can sign in now." });
});

// @route POST /api/auth/verify-email — body: { token }
export const verifyEmail = asyncHandler(async (req, res) => {
  if (!req.body.token) throw badRequest("This verification link is invalid");
  const user = await User.findOne({ verificationToken: req.body.token });
  if (!user) throw badRequest("This verification link is invalid or was already used");
  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, message: "Email verified. Thank you!" });
});

// @route POST /api/auth/verify-email/resend
/** Issues a fresh verification link for the account's current email and returns it. */
export async function sendVerificationEmail(user) {
  const token = crypto.randomBytes(32).toString("hex");
  user.verificationToken = token;
  await user.save({ validateBeforeSave: false });
  const url = `${clientUrl()}/verify-email?token=${token}`;
  sendEmail(user.email, "Verify your Smart Deal email", url);
  return url;
}

export const resendVerification = asyncHandler(async (req, res) => {
  if (req.user.isVerified)
    return res.json({ success: true, message: "Your email is already verified" });
  const url = await sendVerificationEmail(req.user);
  res.json({
    success: true,
    message: "Verification email sent",
    ...(!isProduction() ? { devVerifyUrl: url } : {}),
  });
});

// @route GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

// @route PUT /api/auth/me
export const updateMe = asyncHandler(async (req, res) => {
  const user = req.user;

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (name.length < 2) throw badRequest("Please enter your full name");
    user.name = name;
  }
  if (req.body.phone !== undefined) {
    const phone = normalizePhone(req.body.phone);
    assertPhone(phone);
    if (phone !== user.phone && (await User.exists({ phone, _id: { $ne: user._id } }))) {
      throw conflict("Another account already uses this phone number");
    }
    user.phone = phone;
  }
  if (req.body.gender !== undefined) {
    user.gender = ["Male", "Female", "Prefer not to say"].includes(req.body.gender)
      ? req.body.gender
      : undefined;
  }
  if (req.body.avatar !== undefined) user.avatar = req.body.avatar || undefined;
  if (req.body.notificationPrefs && typeof req.body.notificationPrefs === "object") {
    for (const key of ["email", "sms", "push", "marketing"]) {
      if (typeof req.body.notificationPrefs[key] === "boolean") {
        user.set(`notificationPrefs.${key}`, req.body.notificationPrefs[key]);
      }
    }
  }

  await user.save();
  res.json({ success: true, message: "Profile updated", user });
});

// @route PUT /api/auth/me/password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");

  if (user.authProvider !== "google" || currentPassword) {
    if (!currentPassword || !(await user.matchPassword(currentPassword))) {
      throw badRequest("Your current password is incorrect");
    }
  }
  assertStrongPassword(newPassword);

  user.password = newPassword;
  user.authProvider = "local";
  const currentHash = req.cookies?.[REFRESH_COOKIE] ? hashToken(req.cookies[REFRESH_COOKIE]) : null;
  user.sessions = user.sessions.filter((session) => session.tokenHash === currentHash);
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: "Password updated. Other devices have been signed out." });
});

/* ---------- Address book ---------- */

function markDefault(user, addressId) {
  user.addresses.forEach((address) => {
    address.isDefault = String(address._id) === String(addressId);
  });
}

export const listAddresses = asyncHandler(async (req, res) => {
  res.json({ success: true, addresses: req.user.addresses });
});

export const addAddress = asyncHandler(async (req, res) => {
  const user = req.user;
  if (user.addresses.length >= 10) throw badRequest("You can save up to 10 addresses");
  user.addresses.push(readAddressInput(req.body));
  const added = user.addresses[user.addresses.length - 1];
  if (req.body.isDefault || user.addresses.length === 1) markDefault(user, added._id);
  await user.save();
  res
    .status(201)
    .json({ success: true, message: "Address saved", address: added, addresses: user.addresses });
});

export const updateAddress = asyncHandler(async (req, res) => {
  const user = req.user;
  const address = user.addresses.id(req.params.addressId);
  if (!address) throw notFound("Address not found");
  Object.assign(address, readAddressInput(req.body));
  if (req.body.isDefault) markDefault(user, address._id);
  await user.save();
  res.json({ success: true, message: "Address updated", address, addresses: user.addresses });
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const user = req.user;
  const address = user.addresses.id(req.params.addressId);
  if (!address) throw notFound("Address not found");
  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && user.addresses.length) markDefault(user, user.addresses[0]._id);
  await user.save();
  res.json({ success: true, message: "Address removed", addresses: user.addresses });
});

export const setDefaultAddress = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user.addresses.id(req.params.addressId)) throw notFound("Address not found");
  markDefault(user, req.params.addressId);
  await user.save();
  res.json({ success: true, message: "Default address updated", addresses: user.addresses });
});
