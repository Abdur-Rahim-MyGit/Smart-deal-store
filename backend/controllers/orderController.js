import crypto from "crypto";
import Order, { ORDER_STATUSES } from "../models/Order.js";
import Product from "../models/Product.js";
import Cart from "../models/Cart.js";
import Coupon from "../models/Coupon.js";
import User, { EMIRATES } from "../models/User.js";
import Category from "../models/Category.js";
import Review from "../models/Review.js";
import Setting from "../models/Setting.js";
import {
  HttpError,
  asyncHandler,
  badRequest,
  escapeRegex,
  forbidden,
  isObjectId,
  notFound,
  paginated,
  parsePagination,
  pick,
  round2,
} from "../utils/http.js";
import { resolveLines } from "../utils/catalog.js";
import { computeTotals, evaluateCoupon, publicCoupon } from "../utils/pricing.js";
import { readAddressInput, snapshotAddress } from "../utils/address.js";
import { audit } from "../utils/notify.js";
import { sendTemplated } from "../services/notificationService.js";
import {
  CUSTOMER_CANCELLABLE,
  advanceOrderStatus,
  cancelOrder,
  createOrderWithUniqueId,
  notifyAdmins,
  orderCapabilities,
  completeBankRefund,
  readRefundChoice,
  refundAmountFor,
  resolveReturnRequest,
  returnPolicy,
  sendOrderConfirmationEmail,
} from "../services/orderService.js";

const PAYMENT_METHODS = ["COD", "Card", "Wallet"];
const cardTestMode = () => process.env.PAYMENT_MODE === "test";

function paymentAvailability(settings) {
  return {
    COD: settings.codEnabled,
    Card: settings.cardEnabled && cardTestMode(),
    Wallet: settings.walletEnabled,
  };
}

async function loadCheckout(userId) {
  const [settings, cart] = await Promise.all([
    Setting.getSingleton(),
    Cart.findOne({ user: userId }),
  ]);
  const lines = cart ? await resolveLines(cart.items) : [];
  return { settings, cart, lines };
}

function pickEmirate(user, body) {
  if (body.addressId) {
    const address = user.addresses.id(body.addressId);
    if (address) return address.emirate;
  }
  if (EMIRATES.includes(body.emirate)) return body.emirate;
  return user.addresses.find((address) => address.isDefault)?.emirate || "Dubai";
}

/** Commission rate of the most specific category (sub-subcategory first) that sets one. */
function deepestRate(line, rates) {
  const path = line.categoryPath?.length
    ? line.categoryPath
    : [line.categoryId, line.subcategoryId].filter(Boolean);
  for (const id of [...path].reverse()) {
    const rate = rates.get(String(id));
    if (rate !== undefined && rate !== null) return rate;
  }
  return undefined;
}

// @route POST /api/orders/quote — exact totals for the signed-in user's cart
export const getQuote = asyncHandler(async (req, res) => {
  const { settings, lines } = await loadCheckout(req.user._id);
  const purchasable = lines.filter((line) => line.isAvailable);
  const emirate = pickEmirate(req.user, req.body);
  const couponResult = req.body.couponCode
    ? await evaluateCoupon({ code: req.body.couponCode, userId: req.user._id, lines: purchasable })
    : null;

  const totals = computeTotals({
    lines: purchasable,
    settings,
    emirate,
    shippingMethod: req.body.shippingMethod,
    paymentMethod: req.body.paymentMethod,
    couponResult,
  });

  res.json({
    success: true,
    quote: {
      ...totals,
      emirate,
      items: lines,
      hasIssues: lines.some((line) => !line.isAvailable),
      coupon: publicCoupon(couponResult),
      walletBalance: req.user.walletBalance,
      paymentMethods: paymentAvailability(settings),
      cardTestMode: cardTestMode(),
      codFee: settings.codFee,
    },
  });
});

// @route POST /api/orders
export const createOrder = asyncHandler(async (req, res) => {
  if (!req.user.isVerified) {
    throw forbidden("Please verify your email address before placing an order");
  }
  const { settings, cart, lines } = await loadCheckout(req.user._id);
  if (!lines.length) throw badRequest("Your cart is empty");

  const problem = lines.find((line) => !line.isAvailable);
  if (problem) {
    throw badRequest(
      problem.issue === "insufficient_stock"
        ? `Only ${problem.stock} of "${problem.title}" left — please update the quantity in your cart`
        : `"${problem.title}" is no longer available — please remove it from your cart`,
    );
  }

  // Delivery & billing addresses
  let shippingAddress;
  if (req.body.addressId) {
    const saved = req.user.addresses.id(req.body.addressId);
    if (!saved) throw badRequest("Please choose a delivery address");
    shippingAddress = snapshotAddress(saved);
  } else if (req.body.shippingAddress) {
    shippingAddress = snapshotAddress(readAddressInput(req.body.shippingAddress));
  } else {
    throw badRequest("Please choose a delivery address");
  }
  const billingAddress = req.body.billingAddress
    ? snapshotAddress(readAddressInput(req.body.billingAddress))
    : shippingAddress;

  // Payment method
  const paymentMethod = req.body.paymentMethod;
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw badRequest("Please choose a payment method");
  const availability = paymentAvailability(settings);
  if (!availability[paymentMethod]) {
    throw new HttpError(
      400,
      paymentMethod === "Card"
        ? "Card payments aren't available yet — please choose Cash on Delivery or your wallet"
        : `${paymentMethod === "COD" ? "Cash on delivery" : "Wallet payment"} is currently unavailable`,
    );
  }
  let cardBrand;
  let cardLast4;
  if (paymentMethod === "Card") {
    cardLast4 = String(req.body.card?.last4 || "");
    cardBrand = String(req.body.card?.brand || "Card").slice(0, 20);
    if (!/^\d{4}$/.test(cardLast4)) throw badRequest("Please re-enter your card details");
  }

  // Coupon + totals
  let couponResult = null;
  if (req.body.couponCode) {
    couponResult = await evaluateCoupon({ code: req.body.couponCode, userId: req.user._id, lines });
    if (!couponResult.valid) throw badRequest(couponResult.error);
  }
  const totals = computeTotals({
    lines,
    settings,
    emirate: shippingAddress.emirate,
    shippingMethod: req.body.shippingMethod,
    paymentMethod,
    couponResult,
  });
  if (req.body.shippingMethod && totals.shippingMethod?.code !== req.body.shippingMethod) {
    throw badRequest("That delivery option isn't available for the selected emirate");
  }
  if (
    req.body.expectedTotal !== undefined &&
    Math.abs(Number(req.body.expectedTotal) - totals.total) > 0.01
  ) {
    throw new HttpError(
      409,
      "Prices in your cart changed. Please review the updated total and try again.",
    );
  }
  if (paymentMethod === "Wallet" && req.user.walletBalance < totals.total) {
    throw badRequest(
      `Your wallet balance (AED ${req.user.walletBalance.toFixed(2)}) doesn't cover this order`,
    );
  }

  // Commission per line: vendor override → rate of the deepest category that has one → 10%.
  // Platform-owned stock pays none.
  const categoryIds = new Set(
    lines
      .flatMap((line) => [line.categoryId, line.subcategoryId, ...(line.categoryPath ?? [])])
      .filter(Boolean)
      .map(String),
  );
  const [categories, vendors] = await Promise.all([
    Category.find({ _id: { $in: [...categoryIds] } })
      .select("commissionRate")
      .lean(),
    User.find({ _id: { $in: [...new Set(lines.map((line) => String(line.vendorId)))] } })
      .select("role vendorDetails.commissionRateOverride")
      .lean(),
  ]);
  const categoryRates = new Map(
    categories.map((category) => [String(category._id), category.commissionRate]),
  );
  const vendorById = new Map(vendors.map((vendor) => [String(vendor._id), vendor]));

  const items = lines.map((line) => {
    const vendor = vendorById.get(String(line.vendorId));
    const rate =
      vendor?.role === "Admin"
        ? 0
        : (vendor?.vendorDetails?.commissionRateOverride ?? deepestRate(line, categoryRates) ?? 10);
    const gross = round2(line.price * line.qty);
    const commission = round2((gross * rate) / 100);
    return {
      product: line.productId,
      variantSku: line.variantSku,
      title: line.title,
      thumbnail: line.thumbnail,
      variantLabel: line.variantLabel,
      options: line.options,
      price: line.price,
      mrp: line.mrp,
      qty: line.qty,
      vendor: line.vendorId,
      category: line.categoryId,
      commissionRate: rate,
      commission,
      vendorEarning: round2(gross - commission),
      returnable: line.returnable !== false,
      flashDeal: Boolean(line.flashDealLive),
      status: "Placed",
    };
  });

  // Reserve stock atomically; undo everything if any step fails.
  const reserved = [];
  let walletCharged = false;
  let order;
  try {
    for (const line of lines) {
      const result = await Product.updateOne(
        {
          _id: line.productId,
          status: "Active",
          variants: { $elemMatch: { sku: line.variantSku, stock: { $gte: line.qty } } },
        },
        { $inc: { "variants.$.stock": -line.qty, soldCount: line.qty } },
      );
      if (result.modifiedCount !== 1) {
        throw badRequest(
          `"${line.title}" just sold out or has less stock than you requested — please review your cart`,
        );
      }
      reserved.push(line);
    }

    if (paymentMethod === "Wallet") {
      const charged = await User.updateOne(
        { _id: req.user._id, walletBalance: { $gte: totals.total } },
        { $inc: { walletBalance: -totals.total } },
      );
      if (charged.modifiedCount !== 1)
        throw badRequest("Your wallet balance doesn't cover this order");
      walletCharged = true;
    }

    const prepaid = paymentMethod !== "COD";
    order = await createOrderWithUniqueId({
      user: req.user._id,
      items,
      shippingAddress,
      billingAddress,
      shippingMethod: totals.shippingMethod,
      deliveryInstructions: req.body.deliveryInstructions
        ? String(req.body.deliveryInstructions).slice(0, 500)
        : undefined,
      couponCode: couponResult?.code,
      coupon: couponResult?.coupon?._id,
      pricing: pick(totals, [
        "subtotal",
        "discount",
        "shippingFee",
        "codFee",
        "taxableSubtotal",
        "vatRate",
        "vat",
        "total",
      ]),
      paymentDetails: {
        method: paymentMethod,
        status: prepaid ? "Paid" : "Pending",
        paidAt: prepaid ? new Date() : undefined,
        transactionId:
          req.body.paymentIntentId ||
          (prepaid
            ? `${paymentMethod === "Card" ? "TEST" : "WALLET"}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`
            : undefined),
        cardBrand,
        cardLast4,
      },
      status: "Placed",
    });
  } catch (error) {
    await Promise.all(
      reserved.map((line) =>
        Product.updateOne(
          { _id: line.productId, "variants.sku": line.variantSku },
          { $inc: { "variants.$.stock": line.qty, soldCount: -line.qty } },
        ),
      ),
    );
    if (walletCharged)
      await User.updateOne({ _id: req.user._id }, { $inc: { walletBalance: totals.total } });
    throw error;
  }

  // Post-order bookkeeping
  if (couponResult?.valid) {
    const bumped = await Coupon.updateOne(
      { _id: couponResult.coupon._id, "userUsage.user": req.user._id },
      { $inc: { usedCount: 1, "userUsage.$.count": 1 } },
    );
    if (!bumped.matchedCount) {
      await Coupon.updateOne(
        { _id: couponResult.coupon._id },
        { $inc: { usedCount: 1 }, $push: { userUsage: { user: req.user._id, count: 1 } } },
      );
    }
  }

  cart.items = [];
  await cart.save();

  const productIds = lines.map((line) => line.productId);
  await Product.refreshAggregates(productIds);
  await Promise.all(
    lines
      .filter((line) => line.flashDealLive)
      .map((line) =>
        Product.updateOne({ _id: line.productId }, { $inc: { flashDealSold: line.qty } }),
      ),
  );

  const reservedSkus = new Set(lines.map((line) => line.variantSku));
  const stockLevels = await Product.find({ _id: { $in: productIds } })
    .select("title vendor variants")
    .lean();
  const lowStock = [];
  for (const product of stockLevels) {
    for (const variant of product.variants) {
      if (reservedSkus.has(variant.sku) && variant.stock <= variant.lowStockThreshold) {
        lowStock.push(`${product.title} (${variant.sku}): ${variant.stock} left`);
        await sendTemplated(
          "seller_low_stock",
          product.vendor,
          {
            stockStatus: variant.stock === 0 ? "Out of stock" : "Low stock",
            product: product.title,
            sku: variant.sku,
            stock: variant.stock,
          },
          { link: "/vendor-dashboard?tab=products" },
        );
      }
    }
  }
  if (lowStock.length) {
    await notifyAdmins("products", {
      type: "stock",
      title: lowStock.length === 1 ? "Low stock alert" : `${lowStock.length} low stock alerts`,
      message: lowStock.join(" · "),
      link: "/admin-dashboard?tab=products",
    });
  }

  await sendTemplated(
    "order_placed",
    req.user._id,
    { orderId: order.orderId, total: order.pricing.total.toFixed(2) },
    { link: `/account/orders/${order._id}` },
  );
  await sendTemplated(
    "seller_new_order",
    [...new Set(lines.map((line) => String(line.vendorId)))],
    { orderId: order.orderId },
    { link: "/vendor-dashboard?tab=orders" },
  );
  sendOrderConfirmationEmail(req.user, order);

  res.status(201).json({ success: true, message: "Order placed successfully", order });
});

// @route GET /api/orders/my
export const getMyOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 10, 50);
  const filter = { user: req.user._id };
  if (req.query.status === "active") {
    filter.status = {
      $in: ["Placed", "Confirmed", "Processing", "Shipped", "Out for Delivery", "Return Requested"],
    };
  } else if (req.query.status === "delivered") {
    filter.status = "Delivered";
  } else if (req.query.status === "cancelled") {
    filter.status = { $in: ["Cancelled", "Returned", "Refunded"] };
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "orderId status items pricing.total paymentDetails.method paymentDetails.status shippingMethod shippingDetails createdAt",
      )
      .lean(),
    Order.countDocuments(filter),
  ]);
  paginated(res, { items: orders, key: "orders", total, page, limit });
});

// @route GET /api/orders/:id (also /api/admin/orders/:id) — accepts Mongo id or order number
export const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await Order.findOne(
    isObjectId(id) ? { _id: id } : { orderId: String(id).toUpperCase() },
  )
    .populate("user", "name email phone")
    .lean();
  if (!order) throw notFound("Order not found");

  const isOwner = String(order.user?._id) === String(req.user._id);
  // View access lets staff open any order; changing its status needs edit access.
  const isAdmin = req.user.hasPermission("orders", "view");
  const canManageOrders = req.user.hasPermission("orders");
  const isVendor =
    req.user.role === "Vendor" &&
    order.items.some((item) => String(item.vendor) === String(req.user._id));
  if (!isOwner && !isAdmin && !isVendor) throw notFound("Order not found");

  const settings = await Setting.getSingleton();
  let view = order;
  if (isVendor && !isOwner && !isAdmin) {
    const items = order.items.filter((item) => String(item.vendor) === String(req.user._id));
    view = {
      ...order,
      items,
      user: { name: order.user?.name },
      billingAddress: undefined,
      couponCode: undefined,
      pricing: { subtotal: round2(items.reduce((sum, item) => sum + item.price * item.qty, 0)) },
    };
  }

  const reviewedProductIds = isOwner
    ? await Review.find({
        user: req.user._id,
        product: { $in: order.items.map((item) => item.product) },
      }).distinct("product")
    : [];
  const returnableItemIds = ["Delivered", "Return Requested"].includes(order.status)
    ? (await returnPolicy(order)).eligible.map((item) => item._id)
    : [];

  res.json({
    success: true,
    order: {
      ...view,
      capabilities: orderCapabilities(order, {
        isOwner,
        isAdmin: canManageOrders,
        settings,
        reviewedProductIds,
        returnableItemIds,
      }),
    },
  });
});

// @route POST /api/orders/:id/cancel
export const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order || String(order.user) !== String(req.user._id)) throw notFound("Order not found");
  if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
    throw badRequest(
      `This order can't be cancelled because it is already ${order.status.toLowerCase()}`,
    );
  }

  const reason = String(req.body.reason || "").trim() || "Changed my mind";
  const refund =
    order.paymentDetails.status === "Paid" ? readRefundChoice(order, req.body) : undefined;
  await cancelOrder(order, { reason, actorLabel: "customer", refund });
  await order.save();
  res.json({ success: true, message: "Your order has been cancelled", order });
});

// @route POST /api/orders/:id/return
export const requestReturn = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order || String(order.user) !== String(req.user._id)) throw notFound("Order not found");
  if (order.status !== "Delivered")
    throw badRequest("Returns can only be requested for delivered orders");

  const settings = await Setting.getSingleton();
  const deliveredAt = order.shippingDetails?.deliveredAt || order.updatedAt;
  if (Date.now() - deliveredAt.getTime() > settings.returnWindowDays * 24 * 60 * 60 * 1000) {
    throw badRequest(
      `The ${settings.returnWindowDays}-day return window for this order has closed`,
    );
  }

  const { eligible, excluded } = await returnPolicy(order);
  if (!eligible.length) {
    throw badRequest(
      "The items in this order are non-returnable (for example personal care, underwear or software)",
    );
  }

  const reason = String(req.body.reason || "").trim();
  if (!reason) throw badRequest("Please tell us why you're returning this order");
  const refundChoice = readRefundChoice(order, req.body);

  order.status = "Return Requested";
  order.returnDetails = {
    reason,
    comments: req.body.comments ? String(req.body.comments).slice(0, 1000) : undefined,
    requestedAt: new Date(),
    refundAmount: refundAmountFor(order, eligible), // Expected refund; confirmed on approval
    refundMethod: refundChoice.method,
    bankAccount: refundChoice.bankAccount,
  };
  order.statusTimeline.push({
    status: "Return Requested",
    remarks: excluded.length
      ? `Return requested for ${eligible.length} item(s): ${reason}. Non-returnable items are excluded.`
      : `Return requested: ${reason}`,
  });
  await order.save();

  await notifyAdmins("orders", {
    type: "order",
    title: "Return requested",
    message: `${req.user.name} requested a return for ${order.orderId}.`,
    link: "/admin-dashboard?tab=returns",
  });

  res.json({ success: true, message: "Return requested. We'll review it within 24 hours.", order });
});

/* ---------- Admin order management ---------- */

// @route GET /api/admin/orders
export const listOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20, 100);
  const filter = {};

  if (req.query.status === "active") {
    filter.status = { $in: ["Placed", "Confirmed", "Processing", "Shipped", "Out for Delivery"] };
  } else if (ORDER_STATUSES.includes(req.query.status)) {
    filter.status = req.query.status;
  }
  if (PAYMENT_METHODS.includes(req.query.paymentMethod))
    filter["paymentDetails.method"] = req.query.paymentMethod;
  if (["Pending", "Paid", "Failed", "Refunded"].includes(req.query.paymentStatus)) {
    filter["paymentDetails.status"] = req.query.paymentStatus;
  }
  if (req.query.refundStatus === "Processing") filter["refunds.status"] = "Processing";
  // Decided returns, including declined and partial ones where the order stays delivered.
  if (req.query.returnResolution === "any") {
    filter["returnDetails.resolution"] = { $in: ["Approved", "Rejected"] };
  } else if (["Approved", "Rejected"].includes(req.query.returnResolution)) {
    filter["returnDetails.resolution"] = req.query.returnResolution;
  }
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(`${req.query.from}T00:00:00+04:00`);
    if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999+04:00`);
  }
  if (req.query.q) {
    const pattern = new RegExp(escapeRegex(String(req.query.q).trim()), "i");
    filter.$or = [
      { orderId: pattern },
      { "shippingAddress.receiverName": pattern },
      { "shippingAddress.receiverPhone": pattern },
    ];
  }

  const [orders, total, statusCounts] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email")
      .lean(),
    Order.countDocuments(filter),
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  paginated(res, {
    items: orders,
    key: "orders",
    total,
    page,
    limit,
    extra: {
      statusCounts: Object.fromEntries(statusCounts.map((entry) => [entry._id, entry.count])),
    },
  });
});

// @route PUT /api/admin/orders/:id/status — body: { status, remarks, carrier, trackingNumber }
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw notFound("Order not found");

  const previous = order.status;
  await advanceOrderStatus(order, req.body.status, {
    remarks: req.body.remarks ? String(req.body.remarks).trim() : undefined,
    carrier: req.body.carrier,
    trackingNumber: req.body.trackingNumber,
    actorLabel: "Smart Deal",
  });
  await order.save();

  await audit(req, "order.status", {
    entityType: "Order",
    entityId: order._id,
    summary: `${order.orderId}: ${previous} → ${order.status}`,
  });
  res.json({ success: true, message: `Order ${order.orderId} is now ${order.status}`, order });
});

// @route PUT /api/admin/orders/:id/refunds/:refundId — body: { reference }; bank transfer sent
export const markRefundSent = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw notFound("Order not found");
  await completeBankRefund(order, req.params.refundId, req.body.reference);
  await order.save();
  await audit(req, "refund.bank_sent", {
    entityType: "Order",
    entityId: order._id,
    summary: `${order.orderId}: ref ${String(req.body.reference).trim()}`,
  });
  res.json({ success: true, message: "Refund marked as sent", order });
});

// @route PUT /api/admin/orders/:id/return — body: { approve, rejectReason }
export const resolveReturn = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw notFound("Order not found");

  await resolveReturnRequest(order, {
    approve: Boolean(req.body.approve),
    rejectReason: req.body.rejectReason,
  });
  await order.save();

  await audit(req, req.body.approve ? "order.return.approve" : "order.return.reject", {
    entityType: "Order",
    entityId: order._id,
    summary: order.orderId,
  });
  res.json({
    success: true,
    message: req.body.approve ? "Return approved and refund issued" : "Return request declined",
    order,
  });
});
