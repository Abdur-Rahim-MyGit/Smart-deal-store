import mongoose from "mongoose";
import { EMIRATES } from "./User.js";

export const CAMPAIGN_AUDIENCES = [
  "marketing_optin", // Every customer who opted in to offers
  "recent_buyers", // Opted in and ordered in the last N days
  "lapsed", // Opted in and haven't ordered in the last N days
  "emirate", // Opted in, default address in one emirate
  "subscribers", // Newsletter subscribers (email only)
];

// A promotional message sent to a segment of customers, now or at a scheduled time.
const CampaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 600 },
    link: { type: String, trim: true },
    audience: {
      type: { type: String, enum: CAMPAIGN_AUDIENCES, required: true },
      emirate: { type: String, enum: EMIRATES },
      days: { type: Number, min: 1, max: 365 },
    },
    channels: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: ["Scheduled", "Sending", "Sent", "Cancelled", "Failed"],
      default: "Scheduled",
    },
    scheduledFor: { type: Date },
    sentAt: { type: Date },
    recipientCount: { type: Number, default: 0 },
    error: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

CampaignSchema.index({ status: 1, scheduledFor: 1 });

const Campaign = mongoose.model("Campaign", CampaignSchema);
export default Campaign;
