import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    nameSnapshot: { type: String, required: true },
    priceSnapshot: { type: Number, required: true },
    unitSnapshot: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true },
  },
  { _id: false }
);

/**
 * One order = one farmer + one pickup slot, containing 1..N products
 * from that farmer. A customer with items from two different farmers
 * in their cart ends up placing two separate orders (this mirrors the
 * SRS: pre-orders are against "the Farmer's available stock").
 */
const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "FarmerProfile", required: true, index: true },
    market: { type: mongoose.Schema.Types.ObjectId, ref: "Market", required: true },
    pickupSlot: { type: mongoose.Schema.Types.ObjectId, ref: "PickupSlot", required: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PLACED", "ACCEPTED", "READY_FOR_PICKUP", "COMPLETED", "CANCELLED", "DECLINED"],
      default: "PLACED",
      index: true,
    },
    statusHistory: [
      {
        status: { type: String },
        changedAt: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
    cancelReason: { type: String },
  },
  { timestamps: true }
);

// Legal status transitions, enforced server-side so a client can never
// jump straight from PLACED to COMPLETED, or "un-cancel" an order, etc.
export const ORDER_TRANSITIONS = {
  PLACED: ["ACCEPTED", "DECLINED", "CANCELLED"],
  ACCEPTED: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  DECLINED: [],
};

export default mongoose.model("Order", orderSchema);
