import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/**
 * Core account record shared by all three roles (customer/farmer/admin).
 * Role-specific details (business name, address, etc.) live in
 * CustomerProfile / FarmerProfile, referenced from here.
 *
 * IMPORTANT: role is only ever set by the server (register controller,
 * or an admin action). It is never trusted from client input on any
 * other request.
 */
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["CUSTOMER", "FARMER", "ADMIN"],
      required: true,
      index: true,
    },
    contactNumber: { type: String, trim: true },
    address: { type: String, trim: true },
    // Farmers must be approved by an admin before their products/markets
    // become publicly visible. Customers and admins are active by default.
    status: {
      type: String,
      enum: ["ACTIVE", "PENDING_APPROVAL", "SUSPENDED", "DEACTIVATED"],
      default: "ACTIVE",
    },
    avatarUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.statics.hashPassword = async function (plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
};

export default mongoose.model("User", userSchema);
