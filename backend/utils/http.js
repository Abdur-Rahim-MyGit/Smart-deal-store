/** Small HTTP helpers shared by every controller. */

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const unauthorized = (message = "Please sign in to continue") => new HttpError(401, message);
export const forbidden = (message = "You do not have permission to perform this action") =>
  new HttpError(403, message);
export const notFound = (message = "Resource not found") => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);

/** Wrap an async route handler so rejections reach the error middleware. */
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parsePagination(query, defaultLimit = 12, maxLimit = 100) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function pick(source, keys) {
  const result = {};
  for (const key of keys) {
    if (source?.[key] !== undefined) result[key] = source[key];
  }
  return result;
}

export const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value));

/** "Fatima Al Suwaidi" → "Fatima S." for public-facing attributions. */
export function publicName(name = "Customer") {
  const [first, ...rest] = String(name).trim().split(/\s+/);
  const last = rest[rest.length - 1];
  return last ? `${first} ${last[0].toUpperCase()}.` : first || "Customer";
}

export function paginated(res, { items, key, total, page, limit, extra = {} }) {
  res.json({
    success: true,
    [key]: items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    ...extra,
  });
}
