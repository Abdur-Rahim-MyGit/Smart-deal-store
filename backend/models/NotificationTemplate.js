import mongoose from "mongoose";

// Admin overrides of the built-in notification wording. Events without an override use the
// defaults in services/notificationService.js.
const NotificationTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 600 },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const NotificationTemplate = mongoose.model("NotificationTemplate", NotificationTemplateSchema);
export default NotificationTemplate;
