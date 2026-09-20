import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120 },
    comment: { type: String, required: true, trim: true, maxlength: 2000 },
    photos: [{ type: String }],
    isVerifiedPurchase: { type: Boolean, default: false },
    isFlagged: { type: Boolean, default: false }, // Tripped the profanity filter

    vendorResponse: {
      comment: { type: String, trim: true },
      respondedAt: { type: Date },
    },

    status: {
      type: String,
      enum: ["Pending Approval", "Approved", "Rejected"],
      default: "Pending Approval",
    },
    rejectionReason: { type: String },
  },
  { timestamps: true },
);

// One review per customer per product
ReviewSchema.index({ product: 1, user: 1 }, { unique: true });
ReviewSchema.index({ product: 1, status: 1, createdAt: -1 });

const Review = mongoose.model("Review", ReviewSchema);
export default Review;
