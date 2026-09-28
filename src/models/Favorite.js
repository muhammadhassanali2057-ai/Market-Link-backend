import mongoose from "mongoose";

/**
 * Generic favorite record. CustomerProfile also keeps denormalized
 * arrays for fast reads on the dashboard; this collection is the
 * source of truth used for restock-alert matching and toggling.
 */
const favoriteSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetType: { type: String, enum: ["FARMER", "PRODUCT", "MARKET"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

favoriteSchema.index({ customer: 1, targetType: 1, targetId: 1 }, { unique: true });

export default mongoose.model("Favorite", favoriteSchema);
