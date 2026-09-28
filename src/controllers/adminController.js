import User from "../models/User.js";
import FarmerProfile from "../models/FarmerProfile.js";
import Market from "../models/Market.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Review from "../models/Review.js";
import Report from "../models/Report.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../middleware/errorHandler.js";
import { getPagination, buildMeta } from "../utils/pagination.js";

export const getOverview = asyncHandler(async (_req, res) => {
  const [totalCustomers, totalFarmers, pendingFarmers, totalMarkets, totalOrders, totalProducts, revenueAgg] =
    await Promise.all([
      User.countDocuments({ role: "CUSTOMER" }),
      User.countDocuments({ role: "FARMER", status: "ACTIVE" }),
      User.countDocuments({ role: "FARMER", status: "PENDING_APPROVAL" }),
      Market.countDocuments({ isActive: true }),
      Order.countDocuments(),
      Product.countDocuments({ status: { $ne: "HIDDEN" } }),
      Order.aggregate([
        { $match: { status: "COMPLETED" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
    ]);

  res.json({
    totalCustomers,
    totalFarmers,
    pendingFarmers,
    totalMarkets,
    totalOrders,
    totalProducts,
    totalRevenue: revenueAgg[0]?.total || 0,
  });
});

export const listCustomers = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const { page, limit, skip } = getPagination(req, 20);
  const filter = { role: "CUSTOMER" };
  if (status) filter.status = status;
  if (search) filter.name = { $regex: search, $options: "i" };

  const [customers, total] = await Promise.all([
    User.find(filter).select("-passwordHash").sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ customers, meta: buildMeta(total, page, limit) });
});

export const setCustomerStatus = asyncHandler(async (req, res) => {
  const { status } = req.body; // ACTIVE | DEACTIVATED
  if (!["ACTIVE", "DEACTIVATED"].includes(status)) throw new AppError("Status must be ACTIVE or DEACTIVATED.", 400);
  const user = await User.findById(req.params.id);
  if (!user || user.role !== "CUSTOMER") throw new AppError("Customer not found.", 404);
  user.status = status;
  await user.save();
  res.json({ message: `Customer set to ${status}.` });
});

/**
 * GET /api/admin/reports/sales-summary
 * Computed on demand, then snapshotted into the Report collection so
 * "view reports" has real historical records to list.
 */
export const generateSalesSummary = asyncHandler(async (req, res) => {
  const periodStart = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const periodEnd = req.query.to ? new Date(req.query.to) : new Date();

  const orders = await Order.find({
    status: "COMPLETED",
    createdAt: { $gte: periodStart, $lte: periodEnd },
  });

  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const byMarket = {};
  for (const o of orders) {
    const key = o.market.toString();
    byMarket[key] = (byMarket[key] || 0) + o.totalAmount;
  }

  const topFarmersAgg = await Order.aggregate([
    { $match: { status: "COMPLETED", createdAt: { $gte: periodStart, $lte: periodEnd } } },
    { $group: { _id: "$farmer", revenue: { $sum: "$totalAmount" }, orders: { $sum: 1 } } },
    { $sort: { revenue: -1 } },
    { $limit: 5 },
  ]);
  const topFarmers = await FarmerProfile.populate(topFarmersAgg, { path: "_id", select: "stallName" });

  const data = {
    periodStart,
    periodEnd,
    totalOrders: orders.length,
    totalRevenue,
    revenueByMarket: byMarket,
    topFarmers: topFarmers.map((t) => ({ farmer: t._id?.stallName || "Unknown", revenue: t.revenue, orders: t.orders })),
  };

  const report = await Report.create({
    generatedBy: req.user._id,
    reportType: "SALES_SUMMARY",
    periodStart,
    periodEnd,
    data,
  });

  res.json({ report });
});

export const listReports = asyncHandler(async (_req, res) => {
  const reports = await Report.find().sort({ createdAt: -1 }).limit(20);
  res.json({ reports });
});
