import mongoose from "mongoose";

const UserUsageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    count: { type: Number, default: 0 },
  },
  { _id: false },
);

const CouponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    discountType: { type: String, enum: ["Percentage", "Fixed", "Free Shipping"], required: true },
    discountValue: { type: Number, required: true, min: 0 }, // % or flat AED
    maxDiscount: { type: Number, min: 0 }, // Cap for percentage coupons
    minOrderValue: { type: Number, default: 0, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    usageLimit: { type: Number, min: 0 }, // Global redemptions cap
    usedCount: { type: Number, default: 0 },
    limitPerUser: { type: Number, default: 1, min: 1 },
    userUsage: [UserUsageSchema],
    isActive: { type: Boolean, default: true },
    excludedCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    excludedBrands: [{ type: String }],
    excludeClearance: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const Coupon = mongoose.model("Coupon", CouponSchema);
export default Coupon;
