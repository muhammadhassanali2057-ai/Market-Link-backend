import FarmerProfile from "../models/FarmerProfile.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import Notification from "../models/Notification.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../middleware/errorHandler.js";
import { getPagination, buildMeta } from "../utils/pagination.js";

/**
 * GET /api/farmers
 * Public directory of ACTIVE farmers only (pending/suspended farmers
 * are invisible to customers, even though their DB records exist).
 */
export const listFarmers = asyncHandler(async (req, res) => {
  const { search, market } = req.query;
  const { page, limit, skip } = getPagination(req, 20);

  const activeUsers = await User.find({ role: "FARMER", status: "ACTIVE" }).select("_id");
  const filter = { user: { $in: activeUsers.map((u) => u._id) } };
  if (market) filter.markets = market;
  if (search) filter.stallName = { $regex: search, $options: "i" };

  const [farmers, total] = await Promise.all([
    FarmerProfile.find(filter).populate("markets", "name").sort({ ratingAverage: -1 }).skip(skip).limit(limit),
    FarmerProfile.countDocuments(filter),
  ]);

  res.json({ farmers, meta: buildMeta(total, page, limit) });
});

export const getFarmer = asyncHandler(async (req, res) => {
  const farmer = await FarmerProfile.findById(req.params.id).populate("markets", "name address latitude longitude").populate("user", "status");
  if (!farmer) throw new AppError("Farmer not found.", 404);
  // Direct-link access is blocked the same way the listing already is -
  // a suspended/pending farmer's page shouldn't be reachable just by
  // guessing or bookmarking its URL either.
  if (farmer.user?.status !== "ACTIVE") throw new AppError("Farmer not found.", 404);

  const [products, reviews] = await Promise.all([
    Product.find({ farmer: farmer._id, status: { $ne: "HIDDEN" } }),
    Review.find({ farmer: farmer._id, targetType: "FARMER", isModerated: false })
      .populate("customer", "name")
      .sort({ createdAt: -1 }),
  ]);

  res.json({ farmer, products, reviews });
});

// GET /api/farmers/me - the logged-in farmer's own profile, editable.
export const getMyFarmerProfile = asyncHandler(async (req, res) => {
  const farmer = await FarmerProfile.findOne({ user: req.user._id }).populate("markets", "name");
  if (!farmer) throw new AppError("Farmer profile not found.", 404);
  res.json({ farmer, accountStatus: req.user.status });
});

export const updateMyFarmerProfile = asyncHandler(async (req, res) => {
  const farmer = await FarmerProfile.findOne({ user: req.user._id });
  if (!farmer) throw new AppError("Farmer profile not found.", 404);

  const allowed = ["stallName", "about", "profileImageUrl", "markets", "pickupWindows", "location"];
  for (const field of allowed) {
    if (req.body[field] !== undefined) farmer[field] = req.body[field];
  }
  await farmer.save();
  res.json({ farmer });
});

// --- Admin moderation ---

export const listFarmerAccountsForAdmin = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = { role: "FARMER" };
  if (status) filter.status = status;
  const users = await User.find(filter).select("-passwordHash").sort({ createdAt: -1 });
  const profiles = await FarmerProfile.find({ user: { $in: users.map((u) => u._id) } });
  const profileByUser = Object.fromEntries(profiles.map((p) => [p.user.toString(), p]));
  res.json({
    farmers: users.map((u) => ({ user: u, profile: profileByUser[u._id.toString()] || null })),
  });
});

export const setFarmerAccountStatus = asyncHandler(async (req, res) => {
  const { status } = req.body; // ACTIVE | SUSPENDED
  if (!["ACTIVE", "SUSPENDED"].includes(status)) {
    throw new AppError("Status must be ACTIVE or SUSPENDED.", 400);
  }
  const user = await User.findById(req.params.id);
  if (!user || user.role !== "FARMER") throw new AppError("Farmer account not found.", 404);

  user.status = status;
  await user.save();

  await Notification.create({
    user: user._id,
    type: status === "ACTIVE" ? "FARMER_APPROVED" : "FARMER_SUSPENDED",
    message: status === "ACTIVE"
      ? "Your farmer account has been approved. Your products are now visible to customers."
      : "Your farmer account has been suspended. Contact the platform admin for details.",
  });

  res.json({ message: `Farmer account set to ${status}.` });
});
