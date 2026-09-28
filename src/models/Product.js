import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "FarmerProfile", required: true, index: true },
    market: { type: mongoose.Schema.Types.ObjectId, ref: "Market", required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true }, // e.g. "kg", "bunch", "dozen"
    quantityAvailable: { type: Number, required: true, min: 0, default: 0 },
    imageUrl: { type: String, default: "" },
    // Weekly recurring template so a farmer can "reset" stock each week
    // without re-typing everything from scratch.
    isWeeklyTemplate: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["AVAILABLE", "SOLD_OUT", "HIDDEN"],
      default: "AVAILABLE",
      index: true,
    },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text" });

// Keep status in sync with quantity so "sold out" badges are always correct
// even if a farmer forgets to flip the flag manually after stock hits 0.
productSchema.pre("save", function (next) {
  if (this.quantityAvailable <= 0 && this.status === "AVAILABLE") {
    this.status = "SOLD_OUT";
  }
  next();
});

export default mongoose.model("Product", productSchema);
