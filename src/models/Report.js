import mongoose from "mongoose";

/**
 * Stores a snapshot of an admin-generated report so it can be
 * re-viewed later without recomputing (and so "view reports" in the
 * SRS has something concrete to list/retrieve).
 */
const reportSchema = new mongoose.Schema(
  {
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reportType: {
      type: String,
      enum: ["SALES_SUMMARY", "TOP_FARMERS", "PLATFORM_OVERVIEW"],
      required: true,
    },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Report", reportSchema);
