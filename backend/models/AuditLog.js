import mongoose from "mongoose";

// Append-only record of administrative actions.
const AuditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorName: { type: String },
    action: { type: String, required: true }, // e.g. "product.moderate"
    entityType: { type: String },
    entityId: { type: String },
    summary: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AuditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", AuditLogSchema);
export default AuditLog;
