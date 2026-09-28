import mongoose from "mongoose";

/**
 * A review targets EITHER a farmer OR a product (never both at once).
 * Only customers with a COMPLETED order containing that farmer/product
 * may submit one - enforced in the controller, not just the UI.
 */
const reviewSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["FARMER", "PRODUCT"], required: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "FarmerProfile" },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
    farmerResponse: { type: String, default: "" },
    isModerated: { type: Boolean, default: false }, // true = hidden by admin
  },
  { timestamps: true }
);

export default mongoose.model("Review", reviewSchema);
