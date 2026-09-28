import Product from "../models/Product.js";
import FarmerProfile from "../models/FarmerProfile.js";
import Favorite from "../models/Favorite.js";
import Notification from "../models/Notification.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../middleware/errorHandler.js";
import { getPagination, buildMeta } from "../utils/pagination.js";

/**
 * GET /api/products
 * Public, backend-driven search/filter/sort/pagination. This is the
 * endpoint the SRS insists must query real DB data - never a
 * frontend-filtered hardcoded array.
 *
 * Query params: search, category, market, farmer, day, minPrice,
 * maxPrice, availability (AVAILABLE|SOLD_OUT), sort (price_asc|
 * price_desc|newest|rating), page, limit.
 */
export const listProducts = asyncHandler(async (req, res) => {
  const { search, category, market, farmer, minPrice, maxPrice, availability, sort } = req.query;
  const { page, limit, skip } = getPagination(req, 20);

  const filter = {};
  if (category) filter.category = category;
  if (market) filter.market = market;
  if (farmer) filter.farmer = farmer;
  if (availability) filter.status = availability;
  if (!availability) filter.status = { $ne: "HIDDEN" };
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  if (search) {
    filter.$text = { $search: search };
  }

  // Only show products belonging to ACTIVE (approved, not suspended) farmers,
  // unless the caller explicitly asked for one specific farmer's products
  // (e.g. a farmer viewing their own listing while pending approval).
  if (!farmer) {
    const activeFarmerIds = await FarmerProfile.find()
      .populate({ path: "user", select: "status" })
      .then((farmers) => farmers.filter((f) => f.user?.status === "ACTIVE").map((f) => f._id));
    filter.farmer = { $in: activeFarmerIds };
  }

  let sortSpec = { createdAt: -1 };
  if (sort === "price_asc") sortSpec = { price: 1 };
  if (sort === "price_desc") sortSpec = { price: -1 };
  if (sort === "rating") sortSpec = { ratingAverage: -1 };
  if (sort === "newest") sortSpec = { createdAt: -1 };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .populate("market", "name")
      .populate({ path: "farmer", select: "stallName ratingAverage location" })
      .sort(sortSpec)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({ products, meta: buildMeta(total, page, limit) });
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate("category", "name slug")
    .populate("market", "name address latitude longitude")
    .populate({ path: "farmer", select: "stallName ratingAverage ratingCount location profileImageUrl", populate: { path: "user", select: "status" } });
  if (!product) throw new AppError("Product not found.", 404);
  // Same rule as the listing: a product from a pending/suspended farmer
  // isn't reachable even via a direct/bookmarked link.
  if (product.farmer?.user?.status !== "ACTIVE") throw new AppError("Product not found.", 404);

  const related = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
    status: { $ne: "HIDDEN" },
  })
    .limit(6)
    .populate("farmer", "stallName");

  res.json({ product, related });
});

// --- Farmer-only management below ---

async function loadOwnFarmerProfile(userId) {
  const profile = await FarmerProfile.findOne({ user: userId });
  if (!profile) throw new AppError("Farmer profile not found.", 404);
  return profile;
}

export const listMyProducts = asyncHandler(async (req, res) => {
  const profile = await loadOwnFarmerProfile(req.user._id);
  const products = await Product.find({ farmer: profile._id })
    .populate("category", "name")
    .populate("market", "name")
    .sort({ createdAt: -1 });
  res.json({ products });
});

export const createProduct = asyncHandler(async (req, res) => {
  const profile = await loadOwnFarmerProfile(req.user._id);
  const { name, description, price, unit, quantityAvailable, category, market, imageUrl, isWeeklyTemplate } = req.body;

  if (!name || price === undefined || !unit || !category || !market) {
    throw new AppError("Name, price, unit, category and market are required.", 400);
  }
  if (!profile.markets.some((m) => m.toString() === market)) {
    throw new AppError("You can only list products at a market you sell at.", 400);
  }

  const product = await Product.create({
    farmer: profile._id,
    market,
    category,
    name,
    description,
    price,
    unit,
    quantityAvailable: quantityAvailable ?? 0,
    imageUrl,
    isWeeklyTemplate: !!isWeeklyTemplate,
  });
  res.status(201).json({ product });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const profile = await loadOwnFarmerProfile(req.user._id);
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError("Product not found.", 404);
  if (!product.farmer.equals(profile._id)) {
    throw new AppError("You can only edit your own products.", 403);
  }

  const wasSoldOut = product.status === "SOLD_OUT";
  const allowedFields = ["name", "description", "price", "unit", "quantityAvailable", "category", "market", "imageUrl", "isWeeklyTemplate", "status"];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) product[field] = req.body[field];
  }
  // Re-enabling stock un-does sold-out status automatically.
  if (product.quantityAvailable > 0 && product.status === "SOLD_OUT") {
    product.status = "AVAILABLE";
  }
  await product.save();

  // Restock notification: only fires on a real transition from
  // sold-out -> available with actual stock, not on every edit.
  if (wasSoldOut && product.status === "AVAILABLE") {
    const favorites = await Favorite.find({ targetType: "PRODUCT", targetId: product._id });
    if (favorites.length) {
      await Notification.insertMany(
        favorites.map((f) => ({
          user: f.customer,
          type: "PRODUCT_RESTOCKED",
          message: `${product.name} is back in stock!`,
          link: `/products/${product._id}`,
        }))
      );
    }
  }

  res.json({ product });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const profile = await loadOwnFarmerProfile(req.user._id);
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError("Product not found.", 404);
  if (!product.farmer.equals(profile._id)) {
    throw new AppError("You can only delete your own products.", 403);
  }
  await product.deleteOne();
  res.json({ message: "Product deleted." });
});

// Admin-only moderation: hide a listing without deleting it outright.
export const moderateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError("Product not found.", 404);
  product.status = req.body.status === "HIDDEN" ? "HIDDEN" : "AVAILABLE";
  await product.save();
  res.json({ product });
});
