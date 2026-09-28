import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: [
        "ORDER_PLACED",
        "ORDER_ACCEPTED",
        "ORDER_DECLINED",
        "ORDER_READY",
        "ORDER_COMPLETED",
        "ORDER_CANCELLED",
        "PRODUCT_RESTOCKED",
        "FARMER_ANNOUNCEMENT",
        "PLATFORM_ANNOUNCEMENT",
        "FARMER_APPROVED",
        "FARMER_SUSPENDED",
      ],
      required: true,
    },
    message: { type: String, required: true },
    link: { type: String, default: "" }, // frontend route to deep-link to
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
