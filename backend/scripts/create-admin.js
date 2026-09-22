/**
 * Creates the first super-admin on a fresh production database, or promotes an existing
 * account. Use this instead of `npm run seed` on a live store: the seed's demo accounts
 * have passwords published in this repository.
 *
 * Usage (from /backend):
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD="a long password" npm run create-admin
 * MONGODB_URI comes from the environment or backend/.env.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = "Store Admin" } = process.env;

if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD (see the usage note in this file).");
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 12) {
  console.error("ADMIN_PASSWORD must be at least 12 characters for an admin account.");
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);

const email = ADMIN_EMAIL.trim().toLowerCase();
let user = await User.findOne({ email });
const created = !user;
if (!user) user = new User({ name: ADMIN_NAME, email });

user.password = ADMIN_PASSWORD; // Hashed by the model's pre-save hook
user.role = "Admin";
user.isSuperAdmin = true;
user.isVerified = true;
user.status = "Active";
await user.save();

console.log(`${created ? "Created" : "Promoted"} super-admin ${email}`);
await mongoose.disconnect();
