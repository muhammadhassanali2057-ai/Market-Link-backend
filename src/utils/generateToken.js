import jwt from "jsonwebtoken";

/**
 * Signs a JWT carrying only the user id and role. We deliberately do
 * NOT trust a role claim sent back from the client on later requests -
 * every protected route re-fetches (or re-verifies against) this
 * server-issued token, and role checks always happen in middleware,
 * never in the frontend.
 */
export function generateToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

export function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}
