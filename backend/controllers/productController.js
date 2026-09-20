import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Review from "../models/Review.js";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import User from "../models/User.js";
import {
  asyncHandler,
  badRequest,
  conflict,
  forbidden,
  isObjectId,
  notFound,
  paginated,
  parsePagination,
  pick,
  publicName,
  slugify,
} from "../utils/http.js";
import { requireFields, containsBannedWords } from "../utils/validation.js";
import {
  buildCatalogFilter,
  CATALOG_SORTS,
  isFlashDealLive,
  LISTING_FIELDS,
  toListing,
} from "../utils/catalog.js";
import { audit } from "../utils/notify.js";
import { notifyAdmins } from "../services/orderService.js";
import { resolveBrand } from "./brandController.js";
import { DEEPEST_CATEGORY, loadCategoryIndex, rollUpCounts } from "../utils/categoryTree.js";

/** Products sit under a top-level category, optionally narrowed to a subcategory or sub-subcategory of it. */
async function assertCategoryPlacement(categoryId, subcategoryId) {
  const index = await loadCategoryIndex();
  if (index.ancestors(categoryId).length !== 1) throw badRequest("Choose a top-level category");
  if (subcategoryId && index.ancestors(subcategoryId)[0] !== String(categoryId)) {
    throw badRequest("That subcategory isn't part of the chosen category");
  }
}

const PRODUCT_STATUSES = ["Draft", "Pending Approval", "Active", "Rejected", "Suspended"];
const REVIEWABLE_ORDER_STATUSES = ["Delivered", "Return Requested", "Returned", "Refunded"];

const listingQuery = (filter) =>
  Product.find(filter)
    .select(LISTING_FIELDS)
    .populate("category", "name slug")
    .populate("vendor", "name vendorDetails.businessName");

/* ---------- Storefront catalog ---------- */

// @route GET /api/products
export const getProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 24, 60);
  const filter = await buildCatalogFilter(req.query);
  const sortKey = CATALOG_SORTS[req.query.sort]
    ? req.query.sort
    : req.query.q
      ? "relevance"
      : "newest";

  const [products, total] = await Promise.all([
    listingQuery(filter).sort(CATALOG_SORTS[sortKey]).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);

  paginated(res, { items: products.map(toListing), key: "products", total, page, limit });
});

// @route GET /api/products/facets — brand / price / category options for the current query
export const getFacets = asyncHandler(async (req, res) => {
  const { brand, minPrice, maxPrice, rating, discount, inStock, ...base } = req.query;
  const filter = await buildCatalogFilter(base);

  const [brands, price, categories] = await Promise.all([
    Product.aggregate([
      { $match: filter },
      { $group: { _id: "$brand", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 40 },
    ]),
    Product.aggregate([
      { $match: filter },
      { $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } },
    ]),
    Product.aggregate([
      { $match: filter },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
      { $unwind: "$category" },
      { $project: { _id: 0, slug: "$category.slug", name: "$category.name", count: 1 } },
      { $sort: { count: -1 } },
    ]),
  ]);

  res.json({
    success: true,
    facets: {
      brands: brands.map((entry) => ({ name: entry._id, count: entry.count })),
      priceRange: { min: Math.floor(price[0]?.min ?? 0), max: Math.ceil(price[0]?.max ?? 0) },
      categories,
    },
  });
});

// @route GET /api/products/brands
export const getBrands = asyncHandler(async (_req, res) => {
  const brands = await Product.aggregate([
    { $match: { status: "Active" } },
    { $group: { _id: "$brand", count: { $sum: 1 }, image: { $first: "$thumbnail" } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  res.json({
    success: true,
    brands: brands.map((entry) => ({ name: entry._id, count: entry.count, image: entry.image })),
  });
});

// @route GET /api/products/lookup?ids=a,b,c — used for guest wishlists and recently viewed
export const lookupProducts = asyncHandler(async (req, res) => {
  const ids = String(req.query.ids || "")
    .split(",")
    .filter(isObjectId)
    .slice(0, 60);
  if (!ids.length) return res.json({ success: true, products: [] });
  const products = await listingQuery({ _id: { $in: ids }, status: "Active" }).lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));
  res.json({
    success: true,
    products: ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map(toListing),
  });
});

// @route GET /api/products/categories
export const getCategories = asyncHandler(async (_req, res) => {
  const [categories, counts] = await Promise.all([
    Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    Product.aggregate([
      { $match: { status: "Active" } },
      { $group: { _id: DEEPEST_CATEGORY, count: { $sum: 1 } } },
    ]),
  ]);
  const countMap = rollUpCounts(await loadCategoryIndex(), counts, ["count"]);
  res.json({
    success: true,
    categories: categories.map((category) => ({
      ...category,
      productCount: countMap.get(String(category._id))?.count || 0,
    })),
  });
});

// @route GET /api/products/:slug
export const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: String(req.params.slug).toLowerCase() })
    .populate("category", "name slug parentCategory")
    .populate("subcategory", "name slug")
    .populate(
      "vendor",
      "name role createdAt vendorDetails.businessName vendorDetails.storeDescription",
    )
    .lean();
  if (!product) throw notFound("Product not found");

  const isOwner = req.user && String(product.vendor?._id) === String(req.user._id);
  const isAdmin = req.user?.role === "Admin";
  if (product.status !== "Active" && !isOwner && !isAdmin) throw notFound("Product not found");

  const breakdown = await Review.aggregate([
    { $match: { product: product._id, status: "Approved" } },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
  ]);
  const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  breakdown.forEach((entry) => {
    ratingBreakdown[entry._id] = entry.count;
  });

  const vendor = product.vendor
    ? {
        _id: product.vendor._id,
        name: product.vendor.vendorDetails?.businessName || product.vendor.name,
        description: product.vendor.vendorDetails?.storeDescription,
        memberSince: product.vendor.createdAt,
        isPlatform: product.vendor.role === "Admin",
      }
    : null;

  // Breadcrumb from the top-level category down to the product's deepest one (up to three).
  const index = await loadCategoryIndex();
  const trailIds = index.ancestors(product.subcategory?._id || product.category?._id);
  const trailRows = await Category.find({ _id: { $in: trailIds } })
    .select("name slug")
    .lean();
  const categoryTrail = trailIds
    .map((id) => trailRows.find((row) => String(row._id) === id))
    .filter(Boolean);

  res.json({
    success: true,
    // Shoppers only see a flash deal while it's running (not scheduled, ended or sold out).
    product: { ...product, vendor, isFlashDeal: isFlashDealLive(product), categoryTrail },
    ratingBreakdown,
  });
});

// @route GET /api/products/:slug/related
export const getRelatedProducts = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: String(req.params.slug).toLowerCase() })
    .select("category brand")
    .lean();
  if (!product) throw notFound("Product not found");

  const related = await listingQuery({
    status: "Active",
    category: product.category,
    _id: { $ne: product._id },
  })
    .sort({ soldCount: -1 })
    .limit(12)
    .lean();

  if (related.length < 6) {
    const more = await listingQuery({
      status: "Active",
      brand: product.brand,
      _id: { $nin: [product._id, ...related.map((item) => item._id)] },
    })
      .limit(6 - related.length)
      .lean();
    related.push(...more);
  }

  res.json({ success: true, products: related.map(toListing) });
});

/* ---------- Reviews ---------- */

// @route GET /api/products/:id/reviews
export const getProductReviews = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw badRequest("Invalid product");
  const { page, limit, skip } = parsePagination(req.query, 10, 50);
  const filter = { product: req.params.id, status: "Approved" };
  const rating = Number(req.query.rating);
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) filter.rating = rating;
  const sort = { highest: { rating: -1, createdAt: -1 }, lowest: { rating: 1, createdAt: -1 } }[
    req.query.sort
  ] || { createdAt: -1 };

  const [reviews, total] = await Promise.all([
    Review.find(filter).sort(sort).skip(skip).limit(limit).populate("user", "name").lean(),
    Review.countDocuments(filter),
  ]);

  paginated(res, {
    items: reviews.map((review) => ({
      _id: review._id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      isVerifiedPurchase: review.isVerifiedPurchase,
      vendorResponse: review.vendorResponse,
      createdAt: review.createdAt,
      author: publicName(review.user?.name),
    })),
    key: "reviews",
    total,
    page,
    limit,
  });
});

async function findReviewableOrder(userId, productId) {
  return Order.findOne({
    user: userId,
    status: { $in: REVIEWABLE_ORDER_STATUSES },
    "items.product": productId,
  })
    .select("_id")
    .lean();
}

// @route GET /api/products/:id/review-eligibility
export const getReviewEligibility = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw badRequest("Invalid product");
  const existing = await Review.findOne({ product: req.params.id, user: req.user._id }).lean();
  if (existing)
    return res.json({
      success: true,
      canReview: false,
      reason: "already_reviewed",
      review: existing,
    });

  if (req.user.role !== "Customer")
    return res.json({ success: true, canReview: false, reason: "not_customer" });
  const order = await findReviewableOrder(req.user._id, req.params.id);
  res.json({ success: true, canReview: Boolean(order), reason: order ? null : "not_purchased" });
});

// @route POST /api/products/:id/reviews
export const createReview = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw badRequest("Invalid product");
  const rating = Number(req.body.rating);
  const comment = String(req.body.comment || "").trim();
  const title = req.body.title ? String(req.body.title).trim() : undefined;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    throw badRequest("Please choose a rating from 1 to 5 stars");
  if (comment.length < 10)
    throw badRequest("Please write at least 10 characters about the product");

  const product = await Product.findById(req.params.id).select("_id title");
  if (!product) throw notFound("Product not found");
  if (await Review.exists({ product: product._id, user: req.user._id })) {
    throw conflict("You have already reviewed this product");
  }

  const order = await findReviewableOrder(req.user._id, product._id);
  if (!order) throw forbidden("Only customers who received this product can review it");

  const review = await Review.create({
    product: product._id,
    user: req.user._id,
    order: order._id,
    rating,
    title,
    comment,
    isVerifiedPurchase: true,
    isFlagged: containsBannedWords(`${title || ""} ${comment}`),
    status: "Pending Approval",
  });

  res.status(201).json({
    success: true,
    message: "Thanks for your review! It will appear on the product page once it's approved.",
    review,
  });
});

/* ---------- Product management (vendors & admins) ---------- */

function cleanMap(source, limit = 30) {
  const result = {};
  for (const [rawKey, rawValue] of Object.entries(source || {}).slice(0, limit)) {
    const key = String(rawKey).replace(/[.$]/g, "").trim();
    const value = String(rawValue ?? "").trim();
    if (key && value) result[key] = value;
  }
  return result;
}

/** Optional shipping weight in kg (up to 1,000). */
function readWeight(value, sku) {
  if (value === undefined || value === null || value === "") return undefined;
  const weight = Number(value);
  if (!Number.isFinite(weight) || weight < 0 || weight > 1000)
    throw badRequest(`Variant ${sku}: weight must be between 0 and 1,000 kg`);
  return Math.round(weight * 1000) / 1000;
}

function readProductInput(body, { partial = false } = {}) {
  if (!partial) requireFields(body, ["title", "brand", "category", "description", "thumbnail"]);

  const data = pick(body, [
    "title",
    "brand",
    "category",
    "subcategory",
    "description",
    "highlights",
    "specifications",
    "thumbnail",
    "images",
    "variants",
    "tags",
    "seo",
    "returnable",
  ]);

  if (data.variants !== undefined || !partial) {
    if (!Array.isArray(data.variants) || data.variants.length === 0) {
      throw badRequest("Add at least one variant with a SKU, price and stock");
    }
    data.variants = data.variants.slice(0, 50).map((variant, index) => {
      const sku = String(variant.sku || "")
        .trim()
        .toUpperCase();
      if (!sku) throw badRequest(`Variant ${index + 1}: SKU is required`);
      const price = Number(variant.price);
      const mrp =
        variant.mrp === undefined || variant.mrp === "" || variant.mrp === null
          ? price
          : Number(variant.mrp);
      const stock = Number(variant.stock);
      if (!Number.isFinite(price) || price < 0)
        throw badRequest(`Variant ${sku}: enter a valid selling price`);
      if (!Number.isFinite(mrp) || mrp < price)
        throw badRequest(`Variant ${sku}: original price can't be lower than the selling price`);
      if (!Number.isInteger(stock) || stock < 0)
        throw badRequest(`Variant ${sku}: stock must be a whole number`);
      return {
        ...(isObjectId(variant._id) ? { _id: variant._id } : {}),
        sku,
        price,
        mrp,
        stock,
        lowStockThreshold: Math.max(0, Number.parseInt(variant.lowStockThreshold, 10) || 5),
        weightKg: readWeight(variant.weightKg, sku),
        options: cleanMap(variant.options, 5),
        images: Array.isArray(variant.images) ? variant.images.filter(Boolean).slice(0, 8) : [],
      };
    });
  }

  if (data.title !== undefined) data.title = String(data.title).trim();
  if (data.brand !== undefined) data.brand = String(data.brand).trim();
  if (data.category !== undefined && !isObjectId(data.category))
    throw badRequest("Please choose a valid category");
  if (data.subcategory === "" || data.subcategory === null) data.subcategory = undefined;
  if (data.subcategory !== undefined && !isObjectId(data.subcategory))
    throw badRequest("Please choose a valid subcategory");
  if (data.images !== undefined)
    data.images = (Array.isArray(data.images) ? data.images : []).filter(Boolean).slice(0, 12);
  if (data.tags !== undefined) {
    data.tags = (Array.isArray(data.tags) ? data.tags : String(data.tags).split(","))
      .map((tag) => String(tag).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
  }
  if (data.highlights !== undefined) {
    data.highlights = (Array.isArray(data.highlights) ? data.highlights : [])
      .map((line) => String(line).trim())
      .filter(Boolean)
      .slice(0, 10);
  }
  if (data.specifications !== undefined) data.specifications = cleanMap(data.specifications);
  if (data.returnable !== undefined) data.returnable = Boolean(data.returnable);
  return data;
}

async function uniqueSlug(title) {
  const base = slugify(title) || "product";
  let slug = base;
  let counter = 1;
  while (await Product.exists({ slug })) {
    counter += 1;
    slug = `${base}-${counter}`;
  }
  return slug;
}

/** A product can only go live while its seller's store is active (platform stock always can). */
async function assertSellerCanSell(vendorId) {
  const seller = await User.findById(vendorId).select("role vendorDetails.status").lean();
  if (seller?.role === "Vendor" && seller.vendorDetails?.status !== "Active") {
    throw conflict(
      `This seller's store is ${(seller.vendorDetails?.status || "not active").toLowerCase()}, so the product can't go live. Reactivate the seller first.`,
    );
  }
}

const priceSignature = (variants) =>
  variants
    .map((variant) => `${variant.sku}|${Number(variant.price)}|${Number(variant.mrp)}`)
    .sort()
    .join(",");

// @route POST /api/products
export const createProduct = asyncHandler(async (req, res) => {
  const data = readProductInput(req.body);
  data.brand = await resolveBrand(data.brand, { allowInactive: req.user.role === "Admin" });
  if (!(await Category.exists({ _id: data.category })))
    throw badRequest("Please choose a valid category");
  await assertCategoryPlacement(data.category, data.subcategory);

  const isAdmin = req.user.role === "Admin";
  const wantsDraft = req.body.status === "Draft";
  const product = await Product.create({
    ...data,
    slug: await uniqueSlug(data.title),
    vendor: req.user._id,
    status: wantsDraft ? "Draft" : isAdmin ? "Active" : "Pending Approval",
  });

  if (isAdmin) {
    await audit(req, "product.create", {
      entityType: "Product",
      entityId: product._id,
      summary: product.title,
    });
  } else if (product.status === "Pending Approval") {
    await notifyAdmins("products", {
      type: "product",
      title: "Product awaiting approval",
      message: `${req.user.vendorDetails?.businessName || req.user.name} submitted "${product.title}".`,
      link: "/admin-dashboard?tab=products&status=Pending%20Approval",
    });
  }

  res.status(201).json({
    success: true,
    message:
      product.status === "Active"
        ? "Product published"
        : product.status === "Draft"
          ? "Draft saved"
          : "Product submitted for review. It will go live once approved.",
    product,
  });
});

// @route PUT /api/products/:id
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw notFound("Product not found");

  const isAdmin = req.user.role === "Admin";
  if (!isAdmin && String(product.vendor) !== String(req.user._id))
    throw forbidden("You can only edit your own products");
  if (!isAdmin && product.status === "Suspended") {
    throw forbidden(
      "This product was suspended by Smart Deal and can't be edited. Please contact support.",
    );
  }

  const data = readProductInput(req.body, { partial: true });
  if (data.brand !== undefined && data.brand.toLowerCase() !== product.brand.toLowerCase()) {
    data.brand = await resolveBrand(data.brand, { allowInactive: isAdmin });
  } else if (data.brand !== undefined) {
    data.brand = product.brand; // Unchanged: keep it even if the brand was since switched off
  }
  if (data.category && !(await Category.exists({ _id: data.category })))
    throw badRequest("Please choose a valid category");
  if (data.category !== undefined || Object.hasOwn(data, "subcategory")) {
    await assertCategoryPlacement(
      data.category ?? product.category,
      Object.hasOwn(data, "subcategory") ? data.subcategory : product.subcategory,
    );
  }

  const materialChange =
    (data.title !== undefined && data.title !== product.title) ||
    (data.description !== undefined && data.description !== product.description) ||
    (data.variants !== undefined &&
      priceSignature(data.variants) !== priceSignature(product.variants));

  product.set(data);

  if (isAdmin) {
    const nextStatus = req.body.status;
    if (PRODUCT_STATUSES.includes(nextStatus) && nextStatus !== product.status) {
      if (["Rejected", "Suspended"].includes(nextStatus)) {
        throw badRequest(
          `Use ${nextStatus === "Rejected" ? "Reject" : "Suspend"} in the Products list so the seller gets a reason`,
        );
      }
      if (nextStatus === "Active") await assertSellerCanSell(product.vendor);
      product.status = nextStatus;
    }
  } else if (req.body.status === "Draft" && ["Draft", "Rejected"].includes(product.status)) {
    product.status = "Draft";
  } else if (
    ["Draft", "Rejected"].includes(product.status) ||
    (product.status === "Active" && materialChange)
  ) {
    product.status = "Pending Approval";
  }
  if (product.status === "Active" || product.status === "Pending Approval")
    product.rejectionReason = undefined;

  await product.save();

  if (isAdmin) {
    await audit(req, "product.update", {
      entityType: "Product",
      entityId: product._id,
      summary: product.title,
    });
  } else if (product.status === "Pending Approval") {
    await notifyAdmins("products", {
      type: "product",
      title: "Product awaiting approval",
      message: `"${product.title}" was updated and needs review.`,
      link: "/admin-dashboard?tab=products&status=Pending%20Approval",
    });
  }

  res.json({
    success: true,
    message:
      product.status === "Pending Approval" && !isAdmin
        ? "Changes saved and sent for review"
        : "Product updated",
    product,
  });
});

// @route PATCH /api/products/:id/stock — stock-only updates never need re-approval
export const updateStock = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw notFound("Product not found");
  if (req.user.role !== "Admin" && String(product.vendor) !== String(req.user._id)) {
    throw forbidden("You can only update stock for your own products");
  }
  if (!Array.isArray(req.body.variants) || !req.body.variants.length)
    throw badRequest("No stock changes provided");

  for (const change of req.body.variants) {
    const variant = product.variants.find(
      (entry) => entry.sku === String(change.sku).toUpperCase(),
    );
    if (!variant) throw badRequest(`SKU ${change.sku} doesn't belong to this product`);
    const stock = Number(change.stock);
    if (!Number.isInteger(stock) || stock < 0)
      throw badRequest(`Stock for ${variant.sku} must be a whole number`);
    variant.stock = stock;
    if (change.lowStockThreshold !== undefined) {
      variant.lowStockThreshold = Math.max(0, Number.parseInt(change.lowStockThreshold, 10) || 0);
    }
  }

  await product.save();
  res.json({ success: true, message: "Stock updated", product });
});

// @route DELETE /api/products/:id
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw notFound("Product not found");
  if (req.user.role !== "Admin" && String(product.vendor) !== String(req.user._id)) {
    throw forbidden("You can only delete your own products");
  }

  await Promise.all([
    Product.deleteOne({ _id: product._id }),
    Cart.updateMany(
      {},
      { $pull: { items: { product: product._id }, savedForLater: { product: product._id } } },
    ),
    User.updateMany({ wishlist: product._id }, { $pull: { wishlist: product._id } }),
    Review.deleteMany({ product: product._id }),
  ]);

  if (req.user.role === "Admin") {
    await audit(req, "product.delete", {
      entityType: "Product",
      entityId: product._id,
      summary: product.title,
    });
  }
  res.json({ success: true, message: "Product deleted" });
});
