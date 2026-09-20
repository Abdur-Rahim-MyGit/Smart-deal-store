import mongoose from "mongoose";

export const TICKET_STATUSES = ["New", "Assigned", "In Progress", "Resolved", "Closed"];
/** Statuses that still need someone on the support team to act. */
export const OPEN_TICKET_STATUSES = ["New", "Assigned", "In Progress"];

export const TICKET_CATEGORIES = [
  "Order & Shipping",
  "Payment & Refund",
  "Returns",
  "Vendor Dispute",
  "Account",
  "Technical Support",
  "Other",
];

const TicketMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true, trim: true },
  attachments: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

const TicketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true, uppercase: true }, // SD-TKT-YYYYMMDD-XXXX
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    subject: { type: String, required: true, trim: true },
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    status: { type: String, enum: TICKET_STATUSES, default: "New" },
    priority: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    messages: [TicketMessageSchema],
  },
  { timestamps: true },
);

/** Tickets saved before the SRS statuses used "Open"; map them once at start-up. */
TicketSchema.statics.migrateLegacyStatuses = async function () {
  const [assigned, unassigned] = await Promise.all([
    this.collection.updateMany(
      { status: "Open", assignedAgent: { $ne: null } },
      { $set: { status: "Assigned" } },
    ),
    this.collection.updateMany({ status: "Open" }, { $set: { status: "New" } }),
  ]);
  return assigned.modifiedCount + unassigned.modifiedCount;
};

const Ticket = mongoose.model("Ticket", TicketSchema);
export default Ticket;
