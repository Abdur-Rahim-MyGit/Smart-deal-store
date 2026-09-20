import mongoose from "mongoose";
import { ADMIN_PERMISSIONS } from "./User.js";

// Named permission sets for staff. Staff on a role copy its access; editing the role updates
// everyone who has it.
const AdminRoleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300 },
    permissions: [{ type: String, enum: ADMIN_PERMISSIONS }], // Can view and change
    viewPermissions: [{ type: String, enum: ADMIN_PERMISSIONS }], // Can only view
  },
  { timestamps: true },
);

export const DEFAULT_ADMIN_ROLES = [
  {
    name: "Support Agent",
    description: "Handles orders, returns, support tickets and review moderation.",
    permissions: ["orders", "support", "reviews"],
    viewPermissions: ["customers", "products"],
  },
  {
    name: "Catalog Manager",
    description: "Moderates products, categories and brands, and runs marketing.",
    permissions: ["products", "marketing"],
    viewPermissions: ["vendors", "reviews"],
  },
  {
    name: "Finance Auditor",
    description: "Reviews money flows without changing anything.",
    permissions: [],
    viewPermissions: ["finance", "orders", "customers", "vendors"],
  },
];

/** Creates the standard roles on a fresh install (never overwrites edited ones). */
AdminRoleSchema.statics.ensureDefaults = async function () {
  if (await this.exists({})) return 0;
  await this.insertMany(DEFAULT_ADMIN_ROLES);
  return DEFAULT_ADMIN_ROLES.length;
};

const AdminRole = mongoose.model("AdminRole", AdminRoleSchema);
export default AdminRole;
