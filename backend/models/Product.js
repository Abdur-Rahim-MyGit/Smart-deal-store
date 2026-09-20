import mongoose from "mongoose";

const ProductVariantSchema = new mongoose.Schema({
  sku: { type: String, required: true, uppercase: true, trim: true },
  options: { type: Map, of: String, default: {} }, // e.g. { Shade: "Rosewood" } or { Size: "100ml" }
  price: { type: Number, required: true, min: 0 }, // Selling price in AED
  mrp: { type: Number, required: true, min: 0 }, // Original / list price in AED
  stock: { type: Number, required: true, min: 0, default: 0 },
  lowStockThreshold: { type: Number, default: 5, min: 0 },
  weightKg: { type: Number, min: 0, max: 1000 }, // Shipping weight; unset = not weighed
  images: [{ type: String }],
});

const ProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    brand: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    description: { type: String, required: true },
    highlights: [{ type: String, trim: true }],
    specifications: { type: Map, of: String, default: {} },
    thumbnail: { type: String, required: true },
    images: [{ type: String }],

    variants: {
      type: [ProductVariantSchema],
      validate: [
        (value) => Array.isArray(value) && value.length > 0,
        "At least one variant is required",
      ],
    },

    tags: [{ type: String, lowercase: true, trim: true }],

    seo: {
      metaTitle: { type: String },
      metaDescription: { type: String },
      metaKeywords: [{ type: String }],
    },

    status: {
      type: String,
      enum: ["Draft", "Pending Approval", "Active", "Rejected", "Suspended"],
      default: "Pending Approval",
    },
    rejectionReason: { type: String },

    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    soldCount: { type: Number, default: 0 },

    isFeatured: { type: Boolean, default: false },
    // Admin pins that put a product in the home page rails regardless of the automatic rules
    isBestSeller: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isClearance: { type: Boolean, default: false }, // Coupons can exclude clearance items
    isFlashDeal: { type: Boolean, default: false },
    flashDealStartsAt: { type: Date },
    flashDealEndsAt: { type: Date },
    flashDealStock: { type: Number, min: 1 }, // Units available at the deal; unset = no cap
    flashDealSold: { type: Number, default: 0, min: 0 },
    returnable: { type: Boolean, default: true },

    // Denormalised from variants so listings can filter and sort without unwinding.
    price: { type: Number, default: 0 },
    mrp: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    totalStock: { type: Number, default: 0 },
  },
  { timestamps: true },
);

ProductSchema.index({ "variants.sku": 1 }, { unique: true });
ProductSchema.index({ status: 1, category: 1 });
ProductSchema.index({ status: 1, price: 1 });
ProductSchema.index({ vendor: 1, status: 1 });
ProductSchema.index({ title: "text", brand: "text", tags: "text", description: "text" });

/** Headline price/stock figures shown on listings, derived from the variant list. */
export function computeAggregates(variants = []) {
  if (!variants.length) return { price: 0, mrp: 0, discountPercent: 0, totalStock: 0 };
  const inStock = variants.filter((variant) => variant.stock > 0);
  const pool = inStock.length ? inStock : variants;
  const cheapest = pool.reduce((best, variant) => (variant.price < best.price ? variant : best));
  const mrp = Math.max(cheapest.mrp, cheapest.price);
  return {
    price: cheapest.price,
    mrp,
    discountPercent: mrp > cheapest.price ? Math.round(((mrp - cheapest.price) / mrp) * 100) : 0,
    totalStock: variants.reduce((sum, variant) => sum + (variant.stock || 0), 0),
  };
}

ProductSchema.pre("validate", function () {
  const skus = (this.variants || []).map((variant) => variant.sku);
  if (new Set(skus).size !== skus.length) {
    this.invalidate("variants", "Each variant needs a unique SKU");
  }
  Object.assign(this, computeAggregates(this.variants));
  if ((!this.images || this.images.length === 0) && this.thumbnail) {
    this.images = [this.thumbnail];
  }
});

/** Re-derive aggregates after atomic stock updates that bypass document hooks. */
ProductSchema.statics.refreshAggregates = async function (ids) {
  const products = await this.find({ _id: { $in: ids } }).select("variants");
  await Promise.all(
    products.map((product) =>
      this.updateOne({ _id: product._id }, { $set: computeAggregates(product.variants) }),
    ),
  );
};

const Product = mongoose.model("Product", ProductSchema);
export default Product;
