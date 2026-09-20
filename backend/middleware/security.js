import rateLimit from "express-rate-limit";

/** Strips Mongo operator keys ("$gt", "a.b") from user input to block query injection. */
export function sanitizeInput(req, _res, next) {
  const clean = (value) => {
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === "object") {
      for (const key of Object.keys(value)) {
        if (key.startsWith("$") || key.includes(".")) delete value[key];
        else value[key] = clean(value[key]);
      }
    }
    return value;
  };
  if (req.body) clean(req.body);
  if (req.query) clean(req.query);
  next();
}

const limitMessage = (message) => ({ success: false, message });
// Generous limits locally so development and automated tests aren't throttled.
const strict = process.env.NODE_ENV === "production";

// Sign-in, OTP and password reset endpoints.
export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: strict ? 40 : 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: limitMessage("Too many attempts. Please wait a few minutes and try again."),
});

// Newsletter and contact forms.
export const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: strict ? 20 : 500,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: limitMessage("Too many submissions. Please try again later."),
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: strict ? 600 : 5000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: limitMessage("Too many requests. Please slow down."),
});
