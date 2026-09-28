import mongoose from "mongoose";

/**
 * Extra data for FARMER-role users: stall identity, where they sell,
 * and when they're open for pickup.
 */
const pickupWindowSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
      required: true,
    },
    startTime: { type: String, required: true }, // "08:00"
    endTime: { type: String, required: true }, // "12:00"
    // Orders placed after this many minutes before startTime are rejected.
    cutoffMinutesBefore: { type: Number, default: 120 },
  },
  { _id: false }
);

const farmerProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    stallName: { type: String, required: true, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    about: { type: String, default: "" },
    profileImageUrl: { type: String, default: "" },
    markets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Market" }],
    pickupWindows: [pickupWindowSchema],
    location: {
      address: { type: String, default: "" },
      latitude: { type: Number },
      longitude: { type: Number },
    },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

farmerProfileSchema.index({ stallName: "text" });

export default mongoose.model("FarmerProfile", farmerProfileSchema);
