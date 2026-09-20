export function notFoundHandler(req, res) {
  res
    .status(404)
    .json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  if (err.name === "CastError") {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors)
      .map((entry) => entry.message)
      .join(". ");
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || "";
    const value = err.keyValue?.[field];
    if (field.includes("sku")) message = `SKU "${value}" is already used by another product`;
    else if (field === "email") message = "An account with this email already exists";
    else if (field === "phone") message = "An account with this phone number already exists";
    else message = field ? `${field} "${value}" is already in use` : "Duplicate value";
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Malformed JSON body";
  }

  if (status >= 500) console.error(err);

  res.status(status).json({
    success: false,
    message:
      status >= 500 && process.env.NODE_ENV === "production"
        ? "Something went wrong on our side"
        : message,
    ...(err.details ? { details: err.details } : {}),
  });
}
