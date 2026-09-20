import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["order", "product", "payout", "support", "account", "promo", "stock", "review"],
      default: "account",
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

NotificationSchema.index({ user: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", NotificationSchema);
export default Notification;
