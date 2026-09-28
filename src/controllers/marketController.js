import Market from "../models/Market.js";
import FarmerProfile from "../models/FarmerProfile.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../middleware/errorHandler.js";
import { getPagination, buildMeta } from "../utils/pagination.js";

/**
 * GET /api/markets
 * Public. Supports filtering by operating day and free-text search on
 * name, plus pagination - used by the "browse markets" and map pages.
 */
export const listMarkets = asyncHandler(async (req, res) => {
  const { day, search } = req.query;
  const { page, limit, skip } = getPagination(req, 20);

  const filter = { isActive: true };
  if (day) filter.operatingDays = day.toUpperCase();
  if (search) filter.name = { $regex: search, $options: "i" };

  const [markets, total] = await Promise.all([
    Market.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Market.countDocuments(filter),
  ]);

  res.json({ markets, meta: buildMeta(total, page, limit) });
});

export const getMarket = asyncHandler(async (req, res) => {
  const market = await Market.findById(req.params.id);
  if (!market) throw new AppError("Market not found.", 404);

  const farmers = await FarmerProfile.find({ markets: market._id }).populate({
    path: "user",
    select: "status",
  });
  const activeFarmers = farmers.filter((f) => f.user?.status === "ACTIVE");

  res.json({ market, farmers: activeFarmers });
});

export const createMarket = asyncHandler(async (req, res) => {
  const { name, address, operatingDays, openTime, closeTime, latitude, longitude, description, imageUrl } = req.body;
  if (!name || !address || latitude === undefined || longitude === undefined) {
    throw new AppError("Name, address, latitude and longitude are required.", 400);
  }
  const market = await Market.create({
    name, address, operatingDays, openTime, closeTime, latitude, longitude, description, imageUrl,
  });
  res.status(201).json({ market });
});

export const updateMarket = asyncHandler(async (req, res) => {
  const market = await Market.findById(req.params.id);
  if (!market) throw new AppError("Market not found.", 404);
  Object.assign(market, req.body);
  await market.save();
  res.json({ market });
});

export const deleteMarket = asyncHandler(async (req, res) => {
  const market = await Market.findById(req.params.id);
  if (!market) throw new AppError("Market not found.", 404);
  // Soft delete so historical orders referencing this market still resolve.
  market.isActive = false;
  await market.save();
  res.json({ message: "Market deactivated." });
});
