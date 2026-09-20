import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Setting from "../models/Setting.js";
import { HttpError, asyncHandler, forbidden, unauthorized } from "../utils/http.js";

function readBearerToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  if (req.query?.token) return String(req.query.token);
  return null;
}

async function userFromToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return User.findById(decoded.id);
}

/** Requires a valid access token; attaches the user document to req.user. */
export const protect = asyncHandler(async (req, _res, next) => {
  const token = readBearerToken(req);
  if (!token) throw unauthorized("Not authorized, token missing");

  let user;
  try {
    user = await userFromToken(token);
  } catch (error) {
    throw unauthorized(error.name === "TokenExpiredError" ? "Token expired" : "Invalid token");
  }

  if (!user) throw unauthorized("Account not found");
  if (user.status === "Blocked")
    throw forbidden("Your account has been blocked. Please contact support.");

  if (user.role === "Admin" && !user.mfa?.enabled && !req.originalUrl.startsWith("/api/auth")) {
    const settings = await Setting.getSingleton();
    if (settings.requireAdminMfa) {
      throw new HttpError(403, "Set up two-step sign-in to use the admin console", {
        code: "MFA_SETUP_REQUIRED",
      });
    }
  }

  touchActivity(user);
  req.user = user;
  next();
});

const ACTIVITY_WRITE_MS = 10 * 60 * 1000;

/** Records when the account was last used (for active-user analytics), at most every 10 min. */
export function touchActivity(user) {
  const last = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
  if (Date.now() - last < ACTIVITY_WRITE_MS) return;
  user.lastActiveAt = new Date();
  User.updateOne({ _id: user._id }, { $set: { lastActiveAt: user.lastActiveAt } }).catch(() => {});
}

/** Attaches req.user when a valid token is sent, but never rejects the request. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = readBearerToken(req);
  if (token) {
    try {
      const user = await userFromToken(token);
      if (user && user.status !== "Blocked") req.user = user;
    } catch {
      // Expired or invalid tokens are treated as guests on public endpoints.
    }
  }
  next();
});

export const generateAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRE || "15m" });

export const generateRefreshToken = (id) =>
  jwt.sign({ id, jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d",
  });
