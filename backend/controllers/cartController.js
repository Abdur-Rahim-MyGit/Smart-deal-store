import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import { asyncHandler, badRequest, isObjectId, notFound, round2 } from "../utils/http.js";
import { LISTING_FIELDS, resolveLines, toListing } from "../utils/catalog.js";

const MAX_QTY_PER_LINE = 10;
const MAX_LINES = 50;

const sameLine = (line, productId, sku) =>
  String(line.product) === String(productId) && line.variantSku === sku;

function summarize(items) {
  const purchasable = items.filter((item) => item.isAvailable);
  return {
    itemCount: items.reduce((sum, item) => sum + item.qty, 0),
    subtotal: round2(purchasable.reduce((sum, item) => sum + item.price * item.qty, 0)),
    savings: round2(
      purchasable.reduce((sum, item) => sum + Math.max(0, item.mrp - item.price) * item.qty, 0),
    ),
    hasIssues: items.some((item) => !item.isAvailable),
  };
}

async function serializeCart(cart) {
  const [items, savedForLater] = await Promise.all([
    resolveLines(cart.items),
    resolveLines(cart.savedForLater),
  ]);
  return { items, savedForLater, summary: summarize(items) };
}

async function getOrCreateCart(userId) {
  return (
    (await Cart.findOne({ user: userId })) ||
    new Cart({ user: userId, items: [], savedForLater: [] })
  );
}

async function respond(res, cart, extra = {}) {
  res.json({ success: true, cart: await serializeCart(cart), ...extra });
}

/** Finds a purchasable variant; with no SKU it picks the first in-stock variant. */
async function loadVariant(productId, variantSku) {
  if (!isObjectId(productId)) throw badRequest("Invalid product");
  const product = await Product.findById(productId).select("status variants title");
  if (!product || product.status !== "Active")
    throw notFound("This product is no longer available");
  const sku = String(variantSku || "").toUpperCase();
  const variant = sku
    ? product.variants.find((entry) => entry.sku === sku)
    : product.variants.find((entry) => entry.stock > 0) || product.variants[0];
  if (!variant) throw badRequest("Please choose a valid option for this product");
  return { product, variant };
}

const readQty = (value) => Math.floor(Number(value));

// @route GET /api/cart
export const getCart = asyncHandler(async (req, res) => {
  await respond(res, await getOrCreateCart(req.user._id));
});

// @route POST /api/cart/preview — prices a guest cart held in the browser
export const previewCart = asyncHandler(async (req, res) => {
  const lines = (Array.isArray(req.body.items) ? req.body.items : [])
    .slice(0, MAX_LINES)
    .map((line) => ({
      product: line.productId,
      variantSku: line.variantSku,
      qty: line.qty,
    }));
  const items = await resolveLines(lines);
  res.json({ success: true, cart: { items, savedForLater: [], summary: summarize(items) } });
});

// @route POST /api/cart/items
export const addItem = asyncHandler(async (req, res) => {
  const qty = Math.max(1, readQty(req.body.qty) || 1);
  const { product, variant } = await loadVariant(req.body.productId, req.body.variantSku);
  if (variant.stock <= 0) throw badRequest("Sorry, this item is out of stock");

  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((line) => sameLine(line, product._id, variant.sku));
  if (!existing && cart.items.length >= MAX_LINES) throw badRequest("Your cart is full");

  const desired = (existing?.qty || 0) + qty;
  const finalQty = Math.min(desired, variant.stock, MAX_QTY_PER_LINE);
  if (existing) existing.qty = finalQty;
  else cart.items.push({ product: product._id, variantSku: variant.sku, qty: finalQty });
  cart.savedForLater = cart.savedForLater.filter(
    (line) => !sameLine(line, product._id, variant.sku),
  );
  await cart.save();

  let message = "Added to cart";
  if (finalQty < desired) {
    message =
      finalQty === MAX_QTY_PER_LINE
        ? `You can buy up to ${MAX_QTY_PER_LINE} of this item per order`
        : `Only ${variant.stock} in stock — quantity adjusted`;
  }
  await respond(res, cart, { message });
});

// @route PATCH /api/cart/items
export const updateItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const sku = String(req.body.variantSku || "").toUpperCase();
  const line = cart.items.find((entry) => sameLine(entry, req.body.productId, sku));
  if (!line) throw notFound("This item is no longer in your cart");

  const qty = readQty(req.body.qty);
  if (!Number.isFinite(qty)) throw badRequest("Invalid quantity");

  if (qty <= 0) {
    cart.items = cart.items.filter((entry) => entry !== line);
  } else {
    const { variant } = await loadVariant(req.body.productId, sku);
    if (qty > MAX_QTY_PER_LINE)
      throw badRequest(`You can buy up to ${MAX_QTY_PER_LINE} of this item per order`);
    if (qty > variant.stock) throw badRequest(`Only ${variant.stock} left in stock`);
    line.qty = qty;
  }

  await cart.save();
  await respond(res, cart);
});

// @route DELETE /api/cart/items?productId=&variantSku=
export const removeItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const sku = String(req.query.variantSku || "").toUpperCase();
  cart.items = cart.items.filter((line) => !sameLine(line, req.query.productId, sku));
  await cart.save();
  await respond(res, cart, { message: "Removed from cart" });
});

// @route DELETE /api/cart
export const clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = [];
  await cart.save();
  await respond(res, cart);
});

// @route POST /api/cart/merge — folds a guest cart into the account cart after sign-in
export const mergeCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const incoming = (Array.isArray(req.body.items) ? req.body.items : []).slice(0, MAX_LINES);

  for (const line of incoming) {
    try {
      const { product, variant } = await loadVariant(line.productId, line.variantSku);
      if (variant.stock <= 0) continue;
      const qty = Math.max(1, readQty(line.qty) || 1);
      const existing = cart.items.find((entry) => sameLine(entry, product._id, variant.sku));
      if (existing) existing.qty = Math.min(existing.qty + qty, variant.stock, MAX_QTY_PER_LINE);
      else if (cart.items.length < MAX_LINES) {
        cart.items.push({
          product: product._id,
          variantSku: variant.sku,
          qty: Math.min(qty, variant.stock, MAX_QTY_PER_LINE),
        });
      }
    } catch {
      // Skip guest lines for products that no longer exist.
    }
  }

  await cart.save();
  await respond(res, cart);
});

// @route POST /api/cart/saved — move a cart line to "Save for later"
export const saveForLater = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const sku = String(req.body.variantSku || "").toUpperCase();
  const line = cart.items.find((entry) => sameLine(entry, req.body.productId, sku));
  if (!line) throw notFound("This item is no longer in your cart");

  cart.items = cart.items.filter((entry) => entry !== line);
  if (!cart.savedForLater.some((entry) => sameLine(entry, line.product, sku))) {
    cart.savedForLater.push({ product: line.product, variantSku: sku, qty: line.qty });
  }
  await cart.save();
  await respond(res, cart, { message: "Saved for later" });
});

// @route POST /api/cart/saved/move-to-cart
export const moveToCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const sku = String(req.body.variantSku || "").toUpperCase();
  const saved = cart.savedForLater.find((entry) => sameLine(entry, req.body.productId, sku));
  if (!saved) throw notFound("Saved item not found");

  const { product, variant } = await loadVariant(req.body.productId, sku);
  if (variant.stock <= 0) throw badRequest("This item is out of stock right now");

  cart.savedForLater = cart.savedForLater.filter((entry) => entry !== saved);
  const existing = cart.items.find((entry) => sameLine(entry, product._id, sku));
  const qty = Math.min((existing?.qty || 0) + saved.qty, variant.stock, MAX_QTY_PER_LINE);
  if (existing) existing.qty = qty;
  else cart.items.push({ product: product._id, variantSku: sku, qty });
  await cart.save();
  await respond(res, cart, { message: "Moved to cart" });
});

// @route DELETE /api/cart/saved?productId=&variantSku=
export const removeSaved = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const sku = String(req.query.variantSku || "").toUpperCase();
  cart.savedForLater = cart.savedForLater.filter(
    (line) => !sameLine(line, req.query.productId, sku),
  );
  await cart.save();
  await respond(res, cart);
});

/* ---------- Wishlist ---------- */

// @route GET /api/cart/wishlist
export const getWishlist = asyncHandler(async (req, res) => {
  const ids = req.user.wishlist.map(String);
  const products = await Product.find({ _id: { $in: ids } })
    .select(LISTING_FIELDS)
    .populate("category", "name slug")
    .populate("vendor", "name vendorDetails.businessName")
    .lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));
  res.json({
    success: true,
    wishlist: ids,
    products: ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map(toListing),
  });
});

// @route POST /api/cart/wishlist/toggle
export const toggleWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  if (!isObjectId(productId)) throw badRequest("Invalid product");

  const user = await User.findById(req.user._id).select("wishlist");
  const index = user.wishlist.findIndex((id) => String(id) === String(productId));
  let added;
  if (index > -1) {
    user.wishlist.splice(index, 1);
    added = false;
  } else {
    if (!(await Product.exists({ _id: productId }))) throw notFound("Product not found");
    if (user.wishlist.length >= 200) throw badRequest("Your wishlist is full");
    user.wishlist.push(productId);
    added = true;
  }
  await user.save({ validateBeforeSave: false });

  res.json({
    success: true,
    added,
    message: added ? "Saved to wishlist" : "Removed from wishlist",
    wishlist: user.wishlist.map(String),
  });
});

// @route POST /api/cart/wishlist/merge
export const mergeWishlist = asyncHandler(async (req, res) => {
  const incoming = (Array.isArray(req.body.productIds) ? req.body.productIds : [])
    .filter(isObjectId)
    .slice(0, 100);
  const existing = await Product.find({ _id: { $in: incoming } })
    .select("_id")
    .lean();
  await User.updateOne(
    { _id: req.user._id },
    { $addToSet: { wishlist: { $each: existing.map((product) => product._id) } } },
  );
  const user = await User.findById(req.user._id).select("wishlist").lean();
  res.json({ success: true, wishlist: user.wishlist.map(String) });
});
