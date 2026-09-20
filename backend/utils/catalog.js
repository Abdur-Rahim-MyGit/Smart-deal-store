import mongoose from "mongoose";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import { escapeRegex, isObjectId } from "./http.js";
import { loadCategoryIndex } from "./categoryTree.js";

export const LISTING_FIELDS =
  "title slug brand category vendor thumbnail images price mrp discountPercent totalStock rating soldCount tags isFeatured isBestSeller isNewArrival isClearance isFlashDeal flashDealStartsAt flashDealEndsAt flashDealStock flashDealSold status createdAt variants.sku variants.price variants.mrp variants.stock variants.options";

/** Mongo conditions for a flash deal that has started, hasn't ended and isn't sold out. */
export function liveFlashDealFilter(now = new Date()) {
  return {
    isFlashDeal: true,
    $and: [
      { $or: [{ flashDealStartsAt: null }, { flashDealStartsAt: { $lte: now } }] },
      { $or: [{ flashDealEndsAt: null }, { flashDealEndsAt: { $gt: now } }] },
      {
        $or: [
          { flashDealStock: null },
          { $expr: { $lt: [{ $ifNull: ["$flashDealSold", 0] }, "$flashDealStock"] } },
        ],
      },
    ],
  };
}

/** Same rule as liveFlashDealFilter, for a document already in memory. */
export function isFlashDealLive(product, now = Date.now()) {
  if (!product?.isFlashDeal) return false;
  const time = (value) => (value ? new Date(value).getTime() : null);
  const starts = time(product.flashDealStartsAt);
  const ends = time(product.flashDealEndsAt);
  if (starts !== null && starts > now) return false;
  if (ends !== null && ends <= now) return false;
  if (product.flashDealStock && (product.flashDealSold || 0) >= product.flashDealStock)
    return false;
  return true;
}

export const CATALOG_SORTS = {
  newest: { createdAt: -1, _id: -1 },
  "price-asc": { price: 1, _id: 1 },
  "price-desc": { price: -1, _id: 1 },
  rating: { "rating.average": -1, "rating.count": -1, _id: 1 },
  popular: { soldCount: -1, "rating.count": -1, _id: 1 },
  discount: { discountPercent: -1, _id: 1 },
  relevance: { soldCount: -1, "rating.average": -1, _id: 1 },
};

const plainOptions = (options) =>
  options instanceof Map ? Object.fromEntries(options) : options || {};

/** "Shade: Rosewood · Size: 100ml" — placeholder values like "Default" are hidden. */
export function variantLabel(variant) {
  return Object.entries(plainOptions(variant?.options))
    .filter(([, value]) => value && !["default", "standard"].includes(String(value).toLowerCase()))
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}

function vendorSummary(vendor) {
  if (!vendor) return null;
  if (typeof vendor !== "object" || !vendor._id) return { _id: vendor, name: "Smart Deal" };
  return { _id: vendor._id, name: vendor.vendorDetails?.businessName || vendor.name };
}

/** Compact product shape used by every storefront listing (cards, rails, search). */
export function toListing(product) {
  const variants = product.variants || [];
  const inStock = variants.filter((variant) => variant.stock > 0);
  const pool = inStock.length ? inStock : variants;
  const defaultVariant = pool.reduce(
    (best, variant) => (!best || variant.price < best.price ? variant : best),
    null,
  );

  return {
    _id: product._id,
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    category:
      product.category && typeof product.category === "object" && product.category._id
        ? { _id: product.category._id, name: product.category.name, slug: product.category.slug }
        : product.category,
    vendor: vendorSummary(product.vendor),
    thumbnail: product.thumbnail,
    hoverImage: product.images?.find((image) => image !== product.thumbnail) || null,
    price: product.price,
    mrp: product.mrp,
    discountPercent: product.discountPercent,
    totalStock: product.totalStock,
    inStock: product.totalStock > 0,
    rating: product.rating,
    soldCount: product.soldCount,
    tags: product.tags,
    isFeatured: product.isFeatured,
    isClearance: Boolean(product.isClearance),
    // Only a running deal counts on the storefront (not a scheduled, ended or sold-out one).
    isFlashDeal: isFlashDealLive(product),
    flashDealEndsAt: product.flashDealEndsAt,
    flashDealStock: product.flashDealStock ?? null,
    flashDealSold: product.flashDealSold ?? 0,
    status: product.status,
    createdAt: product.createdAt,
    defaultSku: defaultVariant?.sku ?? null,
    variantCount: variants.length,
  };
}

/**
 * Turns raw cart lines ({ product|productId, variantSku, qty }) into priced,
 * stock-checked lines. Each line carries `issue` when it can't be bought as-is.
 */
export async function resolveLines(rawLines = []) {
  const lines = rawLines.filter((line) => isObjectId(line.product ?? line.productId));
  const ids = [...new Set(lines.map((line) => String(line.product ?? line.productId)))];
  const products = await Product.find({ _id: { $in: ids } })
    .populate("vendor", "name role vendorDetails.businessName")
    .lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));
  const categories = await loadCategoryIndex();

  return lines.map((line) => {
    const productId = String(line.product ?? line.productId);
    const variantSku = String(line.variantSku || "").toUpperCase();
    const qty = Math.max(1, Math.floor(Number(line.qty) || 1));
    const product = byId.get(productId);

    if (!product) {
      return {
        productId,
        variantSku,
        qty,
        title: "Product no longer available",
        price: 0,
        mrp: 0,
        stock: 0,
        issue: "unavailable",
        isAvailable: false,
      };
    }

    const variant = product.variants.find((entry) => entry.sku === variantSku) || null;
    let issue = null;
    if (product.status !== "Active" || !variant) issue = "unavailable";
    else if (variant.stock <= 0) issue = "out_of_stock";
    else if (qty > variant.stock) issue = "insufficient_stock";

    return {
      productId,
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      thumbnail: variant?.images?.[0] || product.thumbnail,
      categoryId: product.category,
      subcategoryId: product.subcategory ?? null,
      // Every category the product sits under, top level first (for commission and coupons).
      categoryPath: categories.ancestors(product.subcategory || product.category),
      isClearance: Boolean(product.isClearance),
      flashDealLive: isFlashDealLive(product),
      vendorId: product.vendor?._id || product.vendor,
      vendorName: vendorSummary(product.vendor)?.name,
      variantSku,
      variantLabel: variantLabel(variant),
      options: plainOptions(variant?.options),
      price: variant?.price ?? product.price,
      mrp: variant?.mrp ?? product.mrp,
      stock: variant?.stock ?? 0,
      weightKg: variant?.weightKg ?? 0,
      qty,
      returnable: product.returnable,
      issue,
      isAvailable: !issue,
    };
  });
}

/** Mongo filter for storefront/admin catalog queries. */
export async function buildCatalogFilter(query = {}, { allStatuses = false } = {}) {
  const filter = {};
  const and = [];

  if (!allStatuses) filter.status = "Active";
  else if (query.status) filter.status = String(query.status);

  const text = String(query.q || query.search || "").trim();
  if (text) {
    const words = text.split(/\s+/).filter(Boolean).slice(0, 6);
    for (const word of words) {
      // Drop a trailing "s" so "serums" still matches "serum".
      const stem = word.length > 3 ? word.replace(/s$/i, "") : word;
      const pattern = new RegExp(escapeRegex(stem), "i");
      and.push({
        $or: [
          { title: pattern },
          { brand: pattern },
          { tags: pattern },
          { "variants.sku": pattern },
        ],
      });
    }
  }

  if (query.category) {
    const category = await Category.findOne({ slug: String(query.category).toLowerCase() })
      .select("_id")
      .lean();
    if (!category) {
      filter._id = { $in: [] };
    } else {
      const index = await loadCategoryIndex();
      const ids = index.descendants(category._id).map((id) => new mongoose.Types.ObjectId(id));
      and.push({ $or: [{ category: { $in: ids } }, { subcategory: { $in: ids } }] });
    }
  }

  if (query.brand) {
    const brands = String(query.brand)
      .split(",")
      .map((brand) => brand.trim())
      .filter(Boolean);
    if (brands.length)
      filter.brand = { $in: brands.map((brand) => new RegExp(`^${escapeRegex(brand)}$`, "i")) };
  }

  const minPrice = Number(query.minPrice);
  const maxPrice = Number(query.maxPrice);
  if (query.minPrice !== undefined && query.minPrice !== "" && Number.isFinite(minPrice)) {
    filter.price = { ...(filter.price || {}), $gte: minPrice };
  }
  if (query.maxPrice !== undefined && query.maxPrice !== "" && Number.isFinite(maxPrice)) {
    filter.price = { ...(filter.price || {}), $lte: maxPrice };
  }

  const rating = Number(query.rating);
  if (Number.isFinite(rating) && rating > 0) filter["rating.average"] = { $gte: rating };

  const discount = Number(query.discount);
  if (Number.isFinite(discount) && discount > 0) filter.discountPercent = { $gte: discount };

  if (query.inStock === "true") filter.totalStock = { $gt: 0 };
  if (query.tag) filter.tags = String(query.tag).toLowerCase();
  if (query.vendor && isObjectId(query.vendor))
    filter.vendor = new mongoose.Types.ObjectId(String(query.vendor));
  if (query.featured === "true") filter.isFeatured = true;
  if (query.flash === "true") {
    const live = liveFlashDealFilter();
    filter.isFlashDeal = true;
    and.push(...live.$and);
  }
  if (query.clearance === "true") filter.isClearance = true;
  if (query.lowStock === "true") {
    filter.$expr = {
      $anyElementTrue: {
        $map: { input: "$variants", as: "v", in: { $lte: ["$$v.stock", "$$v.lowStockThreshold"] } },
      },
    };
  }

  if (and.length) filter.$and = and;
  return filter;
}
