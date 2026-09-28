import User from "../models/User.js";
import CustomerProfile from "../models/CustomerProfile.js";
import FarmerProfile from "../models/FarmerProfile.js";
import { generateToken, setAuthCookie } from "../utils/generateToken.js";
import { AppError } from "../middleware/errorHandler.js";

/**
 * POST /api/auth/register
 * body.role decides which profile gets created, but the ROLE ITSELF is
 * only ever "CUSTOMER" or "FARMER" here - nobody can self-register as
 * ADMIN through this endpoint (admins are seeded/created separately).
 */
export async function register(req, res, next) {
  try {
    const { role, name, email, password, contactNumber, address, stallName, contactPerson } = req.body;

    if (!["CUSTOMER", "FARMER"].includes(role)) {
      throw new AppError("Role must be CUSTOMER or FARMER to self-register.", 400);
    }
    if (!name || !email || !password) {
      throw new AppError("Name, email and password are required.", 400);
    }
    if (password.length < 8) {
      throw new AppError("Password must be at least 8 characters.", 400);
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new AppError("An account with that email already exists.", 409);
    }

    if (role === "FARMER" && (!stallName || !contactPerson)) {
      throw new AppError("Stall/business name and contact person are required for farmers.", 400);
    }
    if (role === "CUSTOMER" && !address) {
      throw new AppError("Address is required for customer registration.", 400);
    }

    const passwordHash = await User.hashPassword(password);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      contactNumber,
      address,
      // Farmers are held for admin approval before they can list products;
      // customers are active immediately.
      status: role === "FARMER" ? "PENDING_APPROVAL" : "ACTIVE",
    });

    if (role === "CUSTOMER") {
      await CustomerProfile.create({ user: user._id });
    } else {
      await FarmerProfile.create({
        user: user._id,
        stallName,
        contactPerson,
        location: { address },
      });
    }

    const token = generateToken(user);
    setAuthCookie(res, token);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      notice:
        role === "FARMER"
          ? "Your farmer account is pending admin approval before your products become visible."
          : undefined,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError("Email and password are required.", 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
    if (!user) {
      throw new AppError("Invalid email or password.", 401);
    }

    const match = await user.comparePassword(password);
    if (!match) {
      throw new AppError("Invalid email or password.", 401);
    }

    if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
      throw new AppError("This account has been suspended or deactivated. Contact support.", 403);
    }

    const token = generateToken(user);
    setAuthCookie(res, token);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

export function logout(_req, res) {
  res.clearCookie("token");
  res.json({ message: "Logged out." });
}

export async function me(req, res) {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status,
    },
  });
}
