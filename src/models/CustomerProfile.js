import mongoose from "mongoose";

/**
 * Extra data for CUSTOMER-role users. Kept separate from User so that
 * User stays a lean, role-agnostic auth record.
 */
const customerProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    favoriteFarmers: [{ type: mongoose.Schema.Types.ObjectId, ref: "FarmerProfile" }],
    favoriteProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    favoriteMarkets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Market" }],
  },
  { timestamps: true }
);

export default mongoose.model("CustomerProfile", customerProfileSchema);
