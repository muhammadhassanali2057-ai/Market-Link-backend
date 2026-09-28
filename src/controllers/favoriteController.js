import Favorite from "../models/Favorite.js";
import CustomerProfile from "../models/CustomerProfile.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../middleware/errorHandler.js";

const arrayFieldByType = { FARMER: "favoriteFarmers", PRODUCT: "favoriteProducts", MARKET: "favoriteMarkets" };

export const listMyFavorites = asyncHandler(async (req, res) => {
  const favorites = await Favorite.find({ customer: req.user._id }).sort({ createdAt: -1 });
  res.json({ favorites });
});

/**
 * POST /api/favorites/toggle
 * Adds the favorite if it doesn't exist, removes it if it does - lets
 * the frontend use a single "heart" button without tracking state itself.
 */
export const toggleFavorite = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.body;
  if (!arrayFieldByType[targetType] || !targetId) {
    throw new AppError("targetType (FARMER|PRODUCT|MARKET) and targetId are required.", 400);
  }

  const existing = await Favorite.findOne({ customer: req.user._id, targetType, targetId });
  const profile = await CustomerProfile.findOne({ user: req.user._id });
  const arrayField = arrayFieldByType[targetType];

  if (existing) {
    await existing.deleteOne();
    if (profile) {
      profile[arrayField] = profile[arrayField].filter((id) => id.toString() !== targetId);
      await profile.save();
    }
    return res.json({ favorited: false });
  }

  await Favorite.create({ customer: req.user._id, targetType, targetId });
  if (profile && !profile[arrayField].some((id) => id.toString() === targetId)) {
    profile[arrayField].push(targetId);
    await profile.save();
  }
  res.json({ favorited: true });
});
