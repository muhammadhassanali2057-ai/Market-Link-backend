/**
 * Central error handler. Ensures the client never sees a raw stack
 * trace or internal detail (SRS 31: "Never show raw backend stack
 * traces to users"), while still logging the full error server-side
 * for debugging.
 */
export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, _next) {
  console.error(err);

  if (err.name === "ValidationError") {
    return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(", ") });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({ message: `That ${field} is already in use.` });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid identifier supplied." });
  }

  const status = err.statusCode || 500;
  const message =
    status === 500 && process.env.NODE_ENV === "production"
      ? "Something went wrong on our end. Please try again."
      : err.message || "Something went wrong.";

  res.status(status).json({ message });
}

// Small helper for controllers: throw new AppError("message", 404)
export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
