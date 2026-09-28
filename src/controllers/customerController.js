import CustomerProfile from "../models/CustomerProfile.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../middleware/errorHandler.js";

/**
 * GET /api/customers/dashboard
 * Aggregates everything the customer dashboard needs in one call:
 * upcoming pickup, recent orders, favorites, a spending summary and a
 * few recommended products (same-category as recent purchases).
 */
export const getDashboard = asyncHandler(async (req, res) => {
  const profile = await CustomerProfile.findOne({ user: req.user._id })
    .populate("favoriteFarmers", "stallName ratingAverage")
    .populate("favoriteProducts", "name price imageUrl status")
    .populate("favoriteMarkets", "name");
  if (!profile) throw new AppError("Customer profile not found.", 404);

  const [upcoming, recentOrders, spendingAgg] = await Promise.all([
    Order.findOne({
      customer: req.user._id,
      status: { $in: ["PLACED", "ACCEPTED", "READY_FOR_PICKUP"] },
    })
      .populate("farmer", "stallName")
      .populate("pickupSlot", "date startTime endTime")
      .sort({ createdAt: -1 }),
    Order.find({ customer: req.user._id }).sort({ createdAt: -1 }).limit(5).populate("farmer", "stallName"),
    Order.aggregate([
      { $match: { customer: req.user._id, status: "COMPLETED" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" }, orders: { $sum: 1 } } },
    ]),
  ]);

  // Simple recommendation: products in the same categories as this
  // customer's last few completed orders, excluding sold-out items.
  const recentProductIds = recentOrders.flatMap((o) => o.items.map((i) => i.product));
  const recentProducts = await Product.find({ _id: { $in: recentProductIds } }).select("category");
  const categoryIds = [...new Set(recentProducts.map((p) => p.category?.toString()).filter(Boolean))];
  const recommended = categoryIds.length
    ? await Product.find({ category: { $in: categoryIds }, status: "AVAILABLE" }).limit(6)
    : await Product.find({ status: "AVAILABLE" }).sort({ ratingAverage: -1 }).limit(6);

  res.json({
    upcomingPickup: upcoming,
    recentOrders,
    favoriteFarmers: profile.favoriteFarmers,
    favoriteProducts: profile.favoriteProducts,
    favoriteMarkets: profile.favoriteMarkets,
    spending: { total: spendingAgg[0]?.total || 0, orders: spendingAgg[0]?.orders || 0 },
    recommended,
  });
});
