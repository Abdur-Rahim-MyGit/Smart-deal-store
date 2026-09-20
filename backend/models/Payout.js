import mongoose from "mongoose";

const PayoutSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["Requested", "Processing", "Transferred", "Declined"],
      default: "Requested",
    },
    bankSnapshot: {
      bankName: { type: String },
      accountName: { type: String },
      accountNumber: { type: String },
      iban: { type: String },
    },
    reference: { type: String }, // Bank transfer reference once paid
    remarks: { type: String },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    processedAt: { type: Date },
  },
  { timestamps: true },
);

PayoutSchema.index({ vendor: 1, createdAt: -1 });

const Payout = mongoose.model("Payout", PayoutSchema);
export default Payout;
