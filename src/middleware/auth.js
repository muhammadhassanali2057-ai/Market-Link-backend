import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * Verifies the JWT (from the httpOnly cookie, or Authorization header
 * as a fallback for API testing tools like Postman) and attaches the
 * full, freshly-loaded user document to req.user.
 *
 * Loading the user fresh from the DB (rather than trusting the JWT
 * payload alone) means a suspended/deactivated account is locked out
 * immediately, without waiting for the token to expire.
 */
export async function requireAuth(req, res, next) {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) {
      return res.status(401).json({ message: "Not authenticated." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Account no longer exists." });
    }
    if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
      return res.status(403).json({ message: "This account has been suspended or deactivated." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}

/**
 * Role gate. Usage: requireRole("ADMIN") or requireRole("ADMIN", "FARMER").
 * Always used AFTER requireAuth, and always reads req.user.role from the
 * DB-loaded user set by requireAuth above - never from req.body.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }
    next();
  };
}

// Populates req.user if a valid token is present, but does not reject
// the request if it's missing. Useful for endpoints that behave
// differently for logged-in vs anonymous users (e.g. product listing
// showing "favorited" state).
export async function attachUserIfPresent(req, _res, next) {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user) req.user = user;
  } catch {
    // ignore - request proceeds as anonymous
  }
  next();
}
