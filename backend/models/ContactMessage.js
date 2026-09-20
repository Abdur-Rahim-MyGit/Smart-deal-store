import mongoose from "mongoose";

const ContactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    status: { type: String, enum: ["New", "Read", "Replied", "Archived"], default: "New" },
  },
  { timestamps: true },
);

const ContactMessage = mongoose.model("ContactMessage", ContactMessageSchema);
export default ContactMessage;
