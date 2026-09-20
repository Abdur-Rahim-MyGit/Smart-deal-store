import mongoose from "mongoose";

// Master directory of brands allowed on the platform. Products keep the brand name as a
// string (for search and filters); it must match an active brand here.
const BrandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    key: { type: String, required: true, unique: true }, // Lower-cased name, for case-insensitive lookups
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logo: { type: String, trim: true },
    description: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const brandKey = (name) =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

BrandSchema.pre("validate", function () {
  this.key = brandKey(this.name);
});

/**
 * Adds any brand already used by a product but missing from the directory, so stores that
 * existed before the directory keep working. Safe to run repeatedly.
 */
BrandSchema.statics.syncFromCatalog = async function () {
  const Product = mongoose.model("Product");
  const used = await Product.distinct("brand");
  const existing = new Set((await this.find().select("key").lean()).map((brand) => brand.key));
  const missing = new Map();
  for (const name of used) {
    const key = brandKey(name);
    if (key && !existing.has(key) && !missing.has(key)) missing.set(key, String(name).trim());
  }
  let created = 0;
  for (const name of missing.values()) {
    const base =
      name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "") || "brand";
    let slug = base;
    for (let counter = 2; await this.exists({ slug }); counter += 1) slug = `${base}-${counter}`;
    try {
      await this.create({ name, slug });
      created += 1;
    } catch (error) {
      if (error?.code !== 11000) throw error; // Another process added it first
    }
  }
  return created;
};

const Brand = mongoose.model("Brand", BrandSchema);
export default Brand;
