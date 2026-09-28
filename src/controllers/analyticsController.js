import Order from "../models/Order.js";
import Product from "../models/Product.js";
import FarmerProfile from "../models/FarmerProfile.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../middleware/errorHandler.js";

/**
 * GET /api/analytics/farmer
 * Powers the farmer dashboard overview + charts: totals, revenue
 * trend (last 8 weeks), and best-selling products.
 */
export const getFarmerAnalytics = asyncHandler(async (req, res) => {
  const profile = await FarmerProfile.findOne({ user: req.user._id });
  if (!profile) throw new AppError("Farmer profile not found.", 404);

  const [totalOrders, pendingOrders, readyOrders, completedOrders, lowStockCount, revenueAgg] = await Promise.all([
    Order.countDocuments({ farmer: profile._id }),
    Order.countDocuments({ farmer: profile._id, status: "PLACED" }),
    Order.countDocuments({ farmer: profile._id, status: "READY_FOR_PICKUP" }),
    Order.countDocuments({ farmer: profile._id, status: "COMPLETED" }),
    Product.countDocuments({ farmer: profile._id, quantityAvailable: { $lte: 5 }, status: "AVAILABLE" }),
    Order.aggregate([
      { $match: { farmer: profile._id, status: "COMPLETED" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
  ]);

  const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);
  const revenueTrend = await Order.aggregate([
    { $match: { farmer: profile._id, status: "COMPLETED", createdAt: { $gte: eightWeeksAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%U", date: "$createdAt" } },
        revenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const bestSelling = await Order.aggregate([
    { $match: { farmer: profile._id, status: "COMPLETED" } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        name: { $first: "$items.nameSnapshot" },
        unitsSold: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.lineTotal" },
      },
    },
    { $sort: { unitsSold: -1 } },
    { $limit: 5 },
  ]);

  res.json({
    totalOrders,
    pendingOrders,
    readyOrders,
    completedOrders,
    lowStockCount,
    totalRevenue: revenueAgg[0]?.total || 0,
    revenueTrend,
    bestSelling,
  });
});
