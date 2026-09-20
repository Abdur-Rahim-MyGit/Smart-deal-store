import mongoose from "mongoose";
import { EMIRATES } from "./User.js";

export const DEFAULT_SHIPPING_MATRIX = [
  { emirate: "Dubai", fee: 15, freeThreshold: 150, eta: "Within 24 hours" },
  { emirate: "Abu Dhabi", fee: 20, freeThreshold: 200, eta: "24–48 hours" },
  { emirate: "Sharjah", fee: 15, freeThreshold: 150, eta: "24–48 hours" },
  { emirate: "Ajman", fee: 20, freeThreshold: 200, eta: "48 hours" },
  { emirate: "Umm Al Quwain", fee: 25, freeThreshold: 250, eta: "48–72 hours" },
  { emirate: "Ras Al Khaimah", fee: 25, freeThreshold: 250, eta: "48–72 hours" },
  { emirate: "Fujairah", fee: 25, freeThreshold: 250, eta: "48–72 hours" },
];

const ShippingRuleSchema = new mongoose.Schema(
  {
    emirate: { type: String, enum: EMIRATES, required: true },
    fee: { type: Number, required: true, min: 0 },
    freeThreshold: { type: Number, required: true, min: 0 },
    eta: { type: String, default: "" },
    // Weight-based pricing: the fee covers this much, then each extra kg (rounded up) costs extraPerKg.
    includedWeightKg: { type: Number, default: 0, min: 0 },
    extraPerKg: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

// Single platform-wide configuration document (key = "global").
const SettingSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global", unique: true },

    storeName: { type: String, default: "Smart Deal" },
    tagline: { type: String, default: "Beauty, tech & fashion at honest prices" },
    supportEmail: { type: String, default: "support@smartdeal.ae" },
    supportPhone: { type: String, default: "+971 4 123 4567" },
    address: { type: String, default: "Business Bay, Dubai, United Arab Emirates" },
    trn: { type: String, default: "100384756200003" },
    announcement: {
      type: String,
      default: "Free delivery on orders over AED 150 in Dubai & Sharjah · 14-day easy returns",
    },

    vatEnabled: { type: Boolean, default: true },
    vatPercent: { type: Number, default: 5, min: 0, max: 100 },
    // Show storefront prices with VAT included (checkout and invoices still itemise VAT).
    pricesIncludeVat: { type: Boolean, default: false },

    codEnabled: { type: Boolean, default: true },
    codFee: { type: Number, default: 10, min: 0 },
    cardEnabled: { type: Boolean, default: true },
    walletEnabled: { type: Boolean, default: true },

    shippingMatrix: { type: [ShippingRuleSchema], default: () => DEFAULT_SHIPPING_MATRIX },
    expressFee: { type: Number, default: 25, min: 0 },
    expressEta: { type: String, default: "Next business day" },
    sameDayFee: { type: Number, default: 35, min: 0 },
    sameDayEmirates: { type: [String], default: () => ["Dubai", "Sharjah", "Ajman"] },
    sameDayCutoff: { type: String, default: "12:00 PM" },

    requireAdminMfa: { type: Boolean, default: false }, // Every staff account must use two-step sign-in
    returnWindowDays: { type: Number, default: 14, min: 0 },
    minPayout: { type: Number, default: 200, min: 0 },
    payoutHoldDays: { type: Number, default: 14, min: 0 },

    social: {
      instagram: { type: String, default: "" },
      facebook: { type: String, default: "" },
      x: { type: String, default: "" },
      youtube: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

SettingSchema.statics.getSingleton = async function () {
  const existing = await this.findOne({ key: "global" });
  return existing || this.create({ key: "global" });
};

const Setting = mongoose.model("Setting", SettingSchema);
export default Setting;
