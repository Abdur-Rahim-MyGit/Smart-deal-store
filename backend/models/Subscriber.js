import mongoose from "mongoose";

const SubscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    isActive: { type: Boolean, default: true },
    source: { type: String, default: "footer" },
  },
  { timestamps: true },
);

const Subscriber = mongoose.model("Subscriber", SubscriberSchema);
export default Subscriber;
