import mongoose from "mongoose";

/**
 * A concrete, bookable pickup slot generated from a farmer's recurring
 * pickupWindows for a specific calendar date. Tracking capacity here
 * (rather than trusting the frontend) lets the backend refuse orders
 * once a slot is full or past its cutoff.
 */
const pickupSlotSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "FarmerProfile", required: true, index: true },
    market: { type: mongoose.Schema.Types.ObjectId, ref: "Market", required: true },
    date: { type: Date, required: true }, // calendar date of pickup (midnight UTC)
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    cutoffAt: { type: Date, required: true }, // absolute timestamp after which orders are locked
    capacity: { type: Number, default: 20 },
    bookedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

pickupSlotSchema.index({ farmer: 1, date: 1, startTime: 1 }, { unique: true });

export default mongoose.model("PickupSlot", pickupSlotSchema);
