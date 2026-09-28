import mongoose from "mongoose";

const marketSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    address: { type: String, required: true },
    operatingDays: [
      { type: String, enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] },
    ],
    openTime: { type: String, default: "08:00" },
    closeTime: { type: String, default: "13:00" },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    mapProvider: { type: String, default: "OSM" },
    description: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Market", marketSchema);
