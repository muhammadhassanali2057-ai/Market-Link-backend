import Review from "../models/Review.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import FarmerProfile from "../models/FarmerProfile.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../middleware/errorHandler.js";

async function recalcRating(model, id, targetType) {
  const filter = targetType === "FARMER" ? { farmer: id, isModerated: false } : { product: id, isModerated: false };
  const reviews = await Review.find(filter);
  const count = reviews.length;
  const average = count ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;
  await model.findByIdAndUpdate(id, { ratingAverage: Math.round(average * 10) / 10, ratingCount: count });
}

/**
 * POST /api/reviews
 * Only a customer with a COMPLETED order containing this
 * farmer/product may review it - checked here server-side, not just
 * hidden in the UI.
 */
export const createReview = asyncHandler(async (req, res) => {
  const { orderId, targetType, targetId, rating, comment } = req.body;
  if (!["FARMER", "PRODUCT"].includes(targetType)) throw new AppError("targetType must be FARMER or PRODUCT.", 400);
  if (!rating || rating < 1 || rating > 5) throw new AppError("Rating must be between 1 and 5.", 400);

  const order = await Order.findById(orderId);
  if (!order) throw new AppError("Order not found.", 404);
  if (!order.customer.equals(req.user._id)) throw new AppError("You can only review your own orders.", 403);
  if (order.status !== "COMPLETED") throw new AppError("You can only review completed orders.", 400);

  if (targetType === "FARMER" && !order.farmer.equals(targetId)) {
    throw new AppError("That farmer is not part of this order.", 400);
  }
  if (targetType === "PRODUCT" && !order.items.some((i) => i.product.equals(targetId))) {
    throw new AppError("That product is not part of this order.", 400);
  }

  const existing = await Review.findOne({ customer: req.user._id, order: orderId, targetType, [targetType.toLowerCase()]: targetId });
  if (existing) throw new AppError("You have already reviewed this.", 409);

  const review = await Review.create({
    customer: req.user._id,
    targetType,
    order: orderId,
    [targetType.toLowerCase()]: targetId,
    rating,
    comment,
  });

  if (targetType === "FARMER") await recalcRating(FarmerProfile, targetId, "FARMER");
  else await recalcRating(Product, targetId, "PRODUCT");

  res.status(201).json({ review });
});

export const listReviewsForTarget = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.query;
  if (!["FARMER", "PRODUCT"].includes(targetType) || !targetId) {
    throw new AppError("targetType and targetId are required.", 400);
  }
  const filter = { targetType, isModerated: false, [targetType.toLowerCase()]: targetId };
  const reviews = await Review.find(filter).populate("customer", "name").sort({ createdAt: -1 });
  res.json({ reviews });
});

// Farmer responding to a review left on their products/profile.
export const respondToReview = asyncHandler(async (req, res) => {
  const { response } = req.body;
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError("Review not found.", 404);

  const profile = await FarmerProfile.findOne({ user: req.user._id });
  const isAboutThisFarmer =
    (review.targetType === "FARMER" && review.farmer.equals(profile?._id)) ||
    (review.targetType === "PRODUCT" && (await Product.findOne({ _id: review.product, farmer: profile?._id })));
  if (!isAboutThisFarmer) throw new AppError("You can only respond to reviews about your own stall.", 403);

  review.farmerResponse = response;
  await review.save();
  res.json({ review });
});

// Admin moderation - hide instead of hard-delete so history is preserved.
export const moderateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError("Review not found.", 404);
  review.isModerated = !!req.body.isModerated;
  await review.save();

  if (review.targetType === "FARMER") await recalcRating(FarmerProfile, review.farmer, "FARMER");
  else await recalcRating(Product, review.product, "PRODUCT");

  res.json({ review });
});
