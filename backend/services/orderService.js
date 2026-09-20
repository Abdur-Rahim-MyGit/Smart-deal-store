import crypto from "crypto";
import mongoose from "mongoose";
import Order, { FULFILMENT_FLOW } from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Coupon from "../models/Coupon.js";
import Review from "../models/Review.js";
import Payout from "../models/Payout.js";
import { badRequest, round2 } from "../utils/http.js";
import { notifyMany, sendEmail } from "../utils/notify.js";
import { sendTemplated } from "./notificationService.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Which statuses an administrator may move an order to from its current status.
export const ADMIN_TRANSITIONS = {
  Placed: ["Confirmed", "Cancelled"],
  Confirmed: ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: ["Out for Delivery", "Delivered"],
  "Out for Delivery": ["Delivered"],
  Delivered: [],
  "Return Requested": [],
  Returned: ["Refunded"],
  Cancelled: [],
  Refunded: [],
};

export const CUSTOMER_CANCELLABLE = ["Placed", "Confirmed", "Processing"];

// Customer notification template for each fulfilment step (email/SMS set per template).
const STATUS_TEMPLATES = {
  Confirmed: "order_confirmed",
  Processing: "order_processing",
  Shipped: "order_shipped",
  "Out for Delivery": "order_out_for_delivery",
  Delivered: "order_delivered",
};

async function notifyStatus(order, status) {
  const key = STATUS_TEMPLATES[status];
  if (!key) return;
  await sendTemplated(
    key,
    order.user,
    { orderId: order.orderId },
    { link: `/account/orders/${order._id}` },
  );
}

const STATUS_MESSAGES = {
  Confirmed: "has been confirmed and is being prepared.",
  Processing: "is being packed.",
  Shipped: "is on its way.",
  "Out for Delivery": "is out for delivery today.",
  Delivered: "has been delivered. Enjoy!",
};

export async function createOrderWithUniqueId(data) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const orderId = `SD-${date}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    try {
      return await Order.create({ ...data, orderId });
    } catch (error) {
      if (error?.code === 11000 && error.keyPattern?.orderId) continue;
      throw error;
    }
  }
  throw new Error("Could not generate a unique order number");
}

export async function notifyAdmins(permission, payload) {
  const admins = await User.find({
    role: "Admin",
    status: "Active",
    $or: [{ isSuperAdmin: true }, { permissions: permission }],
  })
    .select("_id")
    .lean();
  await notifyMany(
    admins.map((admin) => admin._id),
    payload,
  );
}

async function restoreStock(items) {
  const restockable = items.filter((item) => item.status !== "Cancelled");
  await Promise.all(
    restockable.map((item) =>
      Product.updateOne(
        { _id: item.product, "variants.sku": item.variantSku },
        { $inc: { "variants.$.stock": item.qty, soldCount: -item.qty } },
      ),
    ),
  );
  await Product.refreshAggregates(restockable.map((item) => item.product));
}

async function creditWallet(userId, amount) {
  const value = round2(amount);
  if (value > 0) await User.updateOne({ _id: userId }, { $inc: { walletBalance: value } });
}

/** Where a refund can go, given how the order was paid. */
export function refundOptions(order) {
  switch (order.paymentDetails?.method) {
    case "Card":
      return ["card", "wallet"];
    case "COD":
      return ["wallet", "bank"];
    default:
      return ["wallet"];
  }
}

const defaultRefundMethod = (order) => refundOptions(order)[0];

/**
 * Reads the customer's refund choice (card / wallet / bank) from a request body, checking it
 * fits the payment method. Bank transfers need a UAE IBAN and the account holder's name.
 */
export function readRefundChoice(order, body = {}) {
  const options = refundOptions(order);
  const method = body.refundMethod ? String(body.refundMethod) : defaultRefundMethod(order);
  if (!options.includes(method)) {
    throw badRequest(
      `Refunds for ${order.paymentDetails.method} orders can go to: ${options.join(" or ")}`,
    );
  }
  if (method !== "bank") return { method };
  const iban = String(body.bankAccount?.iban || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const accountName = String(body.bankAccount?.accountName || "").trim();
  if (!/^AE\d{21}$/.test(iban)) throw badRequest("Enter a UAE IBAN (AE followed by 21 digits)");
  if (accountName.length < 2) throw badRequest("Enter the name on the bank account");
  return { method, bankAccount: { iban, accountName } };
}

/** Customer-facing sentence for where a refund went. */
function refundSentence(order, refund) {
  const amount = `AED ${refund.amount.toFixed(2)}`;
  if (refund.method === "card") {
    const card = order.paymentDetails.cardLast4
      ? `your ${order.paymentDetails.cardBrand || "card"} ending ${order.paymentDetails.cardLast4}`
      : "your card";
    return `${amount} refunded to ${card}. Banks usually take 5–10 business days to show it.`;
  }
  if (refund.method === "bank")
    return `${amount} will be transferred to your IBAN ending ${refund.bankAccount.iban.slice(-4)} within 3 business days.`;
  return `${amount} credited to your Smart Deal wallet.`;
}

/**
 * Sends money back: wallet credit is instant, card refunds go through the payment gateway
 * (simulated in test mode), and bank transfers wait for finance to send them. `full` marks
 * the whole payment as refunded. Returns the customer-facing sentence.
 */
async function issueRefund(order, amount, { method, bankAccount, reason, full }) {
  const refund = { amount: round2(amount), method, reason };
  if (method === "wallet") {
    await creditWallet(order.user, refund.amount);
    Object.assign(refund, { status: "Completed", completedAt: new Date() });
  } else if (method === "card") {
    const reference = `RF-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
    Object.assign(refund, { status: "Completed", completedAt: new Date(), reference });
  } else {
    Object.assign(refund, { status: "Processing", bankAccount });
    await notifyAdmins("finance", {
      type: "payout",
      title: "Bank transfer refund to send",
      message: `${order.orderId}: AED ${refund.amount.toFixed(2)} to IBAN ending ${bankAccount.iban.slice(-4)}.`,
      link: "/admin-dashboard?tab=returns",
    });
  }
  order.refunds.push(refund);
  if (full && refund.status === "Completed") order.paymentDetails.status = "Refunded";
  return refundSentence(order, refund);
}

/** Finance confirms a bank-transfer refund was sent. */
export async function completeBankRefund(order, refundId, reference) {
  const refund = order.refunds.id(refundId);
  if (!refund) throw badRequest("Refund not found on this order");
  if (refund.status === "Completed") throw badRequest("This refund was already completed");
  const ref = String(reference || "").trim();
  if (ref.length < 3) throw badRequest("Enter the bank transfer reference");
  refund.status = "Completed";
  refund.reference = ref.slice(0, 60);
  refund.completedAt = new Date();
  const allRefunded = order.refunds.every((entry) => entry.status === "Completed");
  if (allRefunded && ["Refunded", "Cancelled"].includes(order.status))
    order.paymentDetails.status = "Refunded";
  order.statusTimeline.push({
    status: order.status,
    remarks: `Bank transfer of AED ${refund.amount.toFixed(2)} sent (ref ${refund.reference}).`,
  });
  await sendTemplated(
    "refund_sent",
    order.user,
    {
      amount: refund.amount.toFixed(2),
      orderId: order.orderId,
      ibanLast4: refund.bankAccount.iban.slice(-4),
      reference: refund.reference,
    },
    { link: `/account/orders/${order._id}` },
  );
}

const vendorIdsOf = (order) => [...new Set(order.items.map((item) => String(item.vendor)))];
const activeItemsOf = (order) => order.items.filter((item) => item.status !== "Cancelled");

/**
 * Splits a delivered order's items into those the customer may send back and those they
 * keep because they were non-returnable at purchase (personal care, underwear, software).
 * Orders placed before the policy was recorded on each item fall back to the product.
 */
export async function returnPolicy(order) {
  const delivered = order.items.filter((item) => item.status === "Delivered");
  const unrecorded = delivered.filter((item) => typeof item.returnable !== "boolean");
  const productPolicy = new Map();
  if (unrecorded.length) {
    const products = await Product.find({ _id: { $in: unrecorded.map((item) => item.product) } })
      .select("returnable")
      .lean();
    products.forEach((product) =>
      productPolicy.set(String(product._id), product.returnable !== false),
    );
  }
  const allowed = (item) =>
    typeof item.returnable === "boolean"
      ? item.returnable
      : (productPolicy.get(String(item.product)) ?? true);
  return {
    eligible: delivered.filter(allowed),
    excluded: delivered.filter((item) => !allowed(item)),
  };
}

/**
 * Refund for returned items: the whole order total when everything comes back, otherwise
 * the items' share after the coupon discount, plus VAT. Delivery fees aren't refunded on a
 * partial return because the kept items were still delivered.
 */
export function refundAmountFor(order, items) {
  if (items.length >= activeItemsOf(order).length) return order.pricing.total;
  const gross = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const subtotal = order.pricing.subtotal || gross;
  const discountShare = subtotal > 0 ? ((order.pricing.discount || 0) * gross) / subtotal : 0;
  return round2((gross - discountShare) * (1 + (order.pricing.vatRate || 0) / 100));
}

/** Cancels an order: restocks items, releases the coupon and refunds anything already paid. */
export async function cancelOrder(order, { reason, actorLabel, refund: choice }) {
  await restoreStock(order.items);
  order.items.forEach((item) => {
    item.status = "Cancelled";
  });
  // Units bought in a flash deal go back to the deal's allowance.
  await Promise.all(
    order.items
      .filter((item) => item.flashDeal)
      .map((item) =>
        Product.updateOne({ _id: item.product }, [
          {
            $set: {
              flashDealSold: {
                $max: [0, { $subtract: [{ $ifNull: ["$flashDealSold", 0] }, item.qty] }],
              },
            },
          },
        ]),
      ),
  );
  order.status = "Cancelled";
  order.cancellationReason = reason;
  order.statusTimeline.push({
    status: "Cancelled",
    remarks: `Cancelled by ${actorLabel}. Reason: ${reason}`,
  });

  if (order.couponCode || order.coupon) {
    await Coupon.updateOne(
      {
        ...(order.coupon ? { _id: order.coupon } : { code: order.couponCode }),
        "userUsage.user": order.user,
      },
      { $inc: { usedCount: -1, "userUsage.$.count": -1 } },
    );
  }

  if (order.paymentDetails.status === "Paid") {
    const refundChoice = choice ?? { method: defaultRefundMethod(order) };
    const note = await issueRefund(order, order.pricing.total, {
      ...refundChoice,
      reason: "Order cancelled",
      full: true,
    });
    order.statusTimeline.push({ status: "Refunded", remarks: note });
  }

  if (actorLabel !== "customer") {
    await sendTemplated(
      "order_cancelled",
      order.user,
      { orderId: order.orderId, reason },
      { link: `/account/orders/${order._id}` },
    );
  }
  await sendTemplated(
    "seller_order_cancelled",
    vendorIdsOf(order),
    { orderId: order.orderId },
    { link: "/vendor-dashboard?tab=orders" },
  );
}

/** Moves an order forward (admin action) and applies the side effects of the new status. */
export async function advanceOrderStatus(
  order,
  nextStatus,
  { remarks, carrier, trackingNumber, actorLabel },
) {
  const allowed = ADMIN_TRANSITIONS[order.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw badRequest(`An order that is "${order.status}" can't be moved to "${nextStatus}"`);
  }

  if (nextStatus === "Cancelled") {
    await cancelOrder(order, { reason: remarks || "Cancelled by Smart Deal", actorLabel });
    return;
  }

  if (nextStatus === "Refunded") {
    const note = await issueRefund(order, order.pricing.total, {
      method: order.returnDetails?.refundMethod || defaultRefundMethod(order),
      bankAccount: order.returnDetails?.bankAccount,
      reason: remarks || "Refunded by Smart Deal",
      full: true,
    });
    order.statusTimeline.push({ status: "Refunded", remarks: note });
    order.status = "Refunded";
    return;
  }

  order.status = nextStatus;
  const targetIndex = FULFILMENT_FLOW.indexOf(nextStatus);
  order.items.forEach((item) => {
    if (item.status !== "Cancelled" && FULFILMENT_FLOW.indexOf(item.status) < targetIndex)
      item.status = nextStatus;
  });

  if (nextStatus === "Shipped") {
    order.shippingDetails.shippedAt = new Date();
    if (carrier) order.shippingDetails.carrier = carrier;
    if (trackingNumber) order.shippingDetails.trackingNumber = trackingNumber;
    order.items.forEach((item) => {
      if (!item.shippedAt && item.status !== "Cancelled") item.shippedAt = new Date();
    });
  }

  if (nextStatus === "Delivered") {
    order.shippingDetails.deliveredAt = new Date();
    if (order.paymentDetails.method === "COD" && order.paymentDetails.status === "Pending") {
      order.paymentDetails.status = "Paid";
      order.paymentDetails.paidAt = new Date();
    }
  }

  order.statusTimeline.push({
    status: nextStatus,
    remarks: remarks || `Order ${STATUS_MESSAGES[nextStatus] || nextStatus.toLowerCase()}`,
  });

  await notifyStatus(order, nextStatus);
}

/** Called when a vendor advances one of their items; the order follows its least-progressed item. */
export async function syncOrderWithItems(order, { carrier, trackingNumber }) {
  const activeItems = order.items.filter((item) => item.status !== "Cancelled");
  if (!activeItems.length) return;
  const lowest = Math.min(...activeItems.map((item) => FULFILMENT_FLOW.indexOf(item.status)));
  const current = FULFILMENT_FLOW.indexOf(order.status);
  if (lowest <= current) return;

  const nextStatus = FULFILMENT_FLOW[lowest];
  order.status = nextStatus;
  if (nextStatus === "Shipped") {
    order.shippingDetails.shippedAt = new Date();
    if (carrier) order.shippingDetails.carrier = carrier;
    if (trackingNumber) order.shippingDetails.trackingNumber = trackingNumber;
  }
  order.statusTimeline.push({
    status: nextStatus,
    remarks: `Order ${STATUS_MESSAGES[nextStatus] || nextStatus}`,
  });
  await notifyStatus(order, nextStatus);
}

/** Approve (restock + refund to wallet) or reject a customer's return request. */
export async function resolveReturnRequest(order, { approve, rejectReason }) {
  if (order.status !== "Return Requested")
    throw badRequest("This order has no pending return request");

  if (approve) {
    const { eligible } = await returnPolicy(order);
    if (!eligible.length) throw badRequest("None of the items in this order can be returned");
    const partial = eligible.length < activeItemsOf(order).length;
    const refund = refundAmountFor(order, eligible);
    const refundChoice = {
      method: order.returnDetails.refundMethod || defaultRefundMethod(order),
      bankAccount: order.returnDetails.bankAccount?.iban
        ? order.returnDetails.bankAccount
        : undefined,
    };

    await restoreStock(eligible);
    eligible.forEach((item) => {
      item.status = "Returned";
    });
    order.returnDetails.resolution = "Approved";
    order.returnDetails.resolvedAt = new Date();
    order.returnDetails.refundAmount = refund;

    const refundNote = await issueRefund(order, refund, {
      ...refundChoice,
      reason: "Return approved",
      full: !partial,
    });

    if (partial) {
      // The non-returnable items stay with the customer, so the order remains delivered
      // and their sellers keep those earnings.
      order.status = "Delivered";
      order.statusTimeline.push({
        status: "Delivered",
        remarks: `Return approved for ${eligible.length} item(s). ${refundNote} Non-returnable items stay with you.`,
      });
    } else {
      order.status = "Returned";
      order.statusTimeline.push({
        status: "Returned",
        remarks: "Return approved and items received back.",
      });
      order.statusTimeline.push({ status: "Refunded", remarks: refundNote });
      order.status = "Refunded";
    }

    await sendTemplated(
      "return_approved",
      order.user,
      { orderId: order.orderId, refund: refundNote },
      { link: `/account/orders/${order._id}` },
    );
    return;
  }

  if (!rejectReason) throw badRequest("Please explain why the return was rejected");
  order.status = "Delivered";
  order.returnDetails.resolution = "Rejected";
  order.returnDetails.rejectReason = rejectReason;
  order.returnDetails.refundAmount = undefined;
  order.returnDetails.resolvedAt = new Date();
  order.statusTimeline.push({
    status: "Delivered",
    remarks: `Return request declined: ${rejectReason}`,
  });
  await sendTemplated(
    "return_declined",
    order.user,
    { orderId: order.orderId, reason: rejectReason },
    { link: `/account/orders/${order._id}` },
  );
}

/** What the viewer is allowed to do with an order (drives buttons in the UI). */
export function orderCapabilities(
  order,
  { isOwner, isAdmin, settings, reviewedProductIds = [], returnableItemIds = [] },
) {
  const deliveredAt = order.shippingDetails?.deliveredAt
    ? new Date(order.shippingDetails.deliveredAt)
    : null;
  const returnWindowEndsAt = deliveredAt
    ? new Date(deliveredAt.getTime() + settings.returnWindowDays * DAY_MS)
    : null;
  return {
    canCancel: Boolean(isOwner && CUSTOMER_CANCELLABLE.includes(order.status)),
    canReturn: Boolean(
      isOwner &&
      order.status === "Delivered" &&
      returnableItemIds.length > 0 &&
      returnWindowEndsAt &&
      returnWindowEndsAt.getTime() > Date.now(),
    ),
    returnWindowEndsAt,
    returnableItemIds: returnableItemIds.map(String),
    refundOptions: isOwner ? refundOptions(order) : [],
    canReview: Boolean(
      isOwner && ["Delivered", "Return Requested", "Returned", "Refunded"].includes(order.status),
    ),
    reviewedProductIds: reviewedProductIds.map(String),
    allowedNextStatuses: isAdmin ? ADMIN_TRANSITIONS[order.status] || [] : [],
  };
}

/** Vendor earnings are derived from delivered orders minus payouts, so they can't drift. */
export async function computeVendorBalances(vendorId, settings) {
  const vendorObjectId = new mongoose.Types.ObjectId(String(vendorId));
  const holdCutoff = new Date(Date.now() - settings.payoutHoldDays * DAY_MS);

  const [earnings] = await Order.aggregate([
    { $match: { "items.vendor": vendorObjectId, status: "Delivered" } },
    { $unwind: "$items" },
    {
      $match: {
        "items.vendor": vendorObjectId,
        "items.status": { $nin: ["Cancelled", "Returned"] },
      },
    },
    {
      $group: {
        _id: null,
        cleared: {
          $sum: {
            $cond: [
              { $lte: ["$shippingDetails.deliveredAt", holdCutoff] },
              "$items.vendorEarning",
              0,
            ],
          },
        },
        onHold: {
          $sum: {
            $cond: [
              { $gt: ["$shippingDetails.deliveredAt", holdCutoff] },
              "$items.vendorEarning",
              0,
            ],
          },
        },
      },
    },
  ]);

  const payouts = await Payout.aggregate([
    { $match: { vendor: vendorObjectId } },
    { $group: { _id: "$status", total: { $sum: "$amount" } } },
  ]);
  const byStatus = Object.fromEntries(payouts.map((entry) => [entry._id, entry.total]));
  const inProgress = (byStatus.Requested || 0) + (byStatus.Processing || 0);
  const paidOut = byStatus.Transferred || 0;
  const cleared = earnings?.cleared || 0;

  return {
    clearedEarnings: round2(cleared),
    onHold: round2(earnings?.onHold || 0),
    inProgress: round2(inProgress),
    paidOut: round2(paidOut),
    availableBalance: round2(cleared - inProgress - paidOut),
    holdDays: settings.payoutHoldDays,
    minPayout: settings.minPayout,
  };
}

export async function recomputeProductRating(productId) {
  const [summary] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), status: "Approved" } },
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: productId },
    {
      $set: {
        "rating.average": summary ? Math.round(summary.average * 10) / 10 : 0,
        "rating.count": summary?.count || 0,
      },
    },
  );
}

/** Order summary email; skipped when the customer has switched email updates off. */
export function sendOrderConfirmationEmail(user, order) {
  if (user.notificationPrefs?.email === false) return;
  const lines = order.items.map(
    (item) => `- ${item.title} × ${item.qty} — AED ${(item.price * item.qty).toFixed(2)}`,
  );
  sendEmail(
    user.email,
    `Order confirmed: ${order.orderId}`,
    [
      `Hi ${user.name},`,
      "",
      `Thanks for shopping with Smart Deal. Your order ${order.orderId} has been placed.`,
      ...lines,
      "",
      `Total (incl. VAT): AED ${order.pricing.total.toFixed(2)}`,
      `Payment: ${order.paymentDetails.method}`,
    ].join("\n"),
  );
}
