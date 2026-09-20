import crypto from "crypto";
import User, { ADMIN_PERMISSIONS, EMIRATES } from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Category from "../models/Category.js";
import Review from "../models/Review.js";
import Coupon from "../models/Coupon.js";
import Banner from "../models/Banner.js";
import Page from "../models/Page.js";
import Payout from "../models/Payout.js";
import Setting from "../models/Setting.js";
import AuditLog from "../models/AuditLog.js";
import Subscriber from "../models/Subscriber.js";
import ContactMessage from "../models/ContactMessage.js";
import Ticket, { OPEN_TICKET_STATUSES } from "../models/Ticket.js";
import Cart from "../models/Cart.js";
import {
  asyncHandler,
  badRequest,
  conflict,
  escapeRegex,
  forbidden,
  isObjectId,
  notFound,
  paginated,
  parsePagination,
  pick,
  round2,
  slugify,
} from "../utils/http.js";
import {
  assertEmail,
  assertPhone,
  assertStrongPassword,
  normalizePhone,
  requireFields,
} from "../utils/validation.js";
import { audit, notify, sendEmail } from "../utils/notify.js";
import { buildCatalogFilter, CATALOG_SORTS } from "../utils/catalog.js";
import { computeVendorBalances, recomputeProductRating } from "../services/orderService.js";
import { sendPasswordReset, sendVerificationEmail } from "./authController.js";
import { topVendors, vendorPerformance } from "../services/analyticsService.js";
import { resolveStaffAccess } from "./roleController.js";
import {
  DEEPEST_CATEGORY,
  MAX_CATEGORY_DEPTH,
  clearCategoryIndex,
  loadCategoryIndex,
  rollUpCounts,
} from "../utils/categoryTree.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const REVENUE_EXCLUDED = ["Cancelled", "Returned", "Refunded"];
const VENDOR_SUSPENDED_REASON = "Store suspended by Smart Deal";

const countsByStatus = (rows) => Object.fromEntries(rows.map((row) => [row._id, row.count]));
const lastDays = (days) =>
  Array.from({ length: days }, (_, index) =>
    new Date(Date.now() - (days - 1 - index) * DAY_MS).toLocaleDateString("en-CA", {
      timeZone: "Asia/Dubai",
    }),
  );
const searchPattern = (value) => new RegExp(escapeRegex(String(value).trim()), "i");

/* =========================================================================
 * Dashboard
 * ========================================================================= */

// @route GET /api/admin/dashboard?days=30
export const getAdminDashboard = asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(7, Number.parseInt(req.query.days, 10) || 30));
  const since = new Date(Date.now() - days * DAY_MS);
  const revenueMatch = { status: { $nin: REVENUE_EXCLUDED } };

  const [
    customers,
    newCustomers,
    activeVendors,
    pendingVendors,
    productStatus,
    lowStock,
    orderStatus,
    revenue,
    commission,
    refunds,
    salesByDayRaw,
    topProducts,
    categorySales,
    recentOrders,
    pendingReviews,
    openTickets,
    pendingPayouts,
    newMessages,
  ] = await Promise.all([
    User.countDocuments({ role: "Customer" }),
    User.countDocuments({ role: "Customer", createdAt: { $gte: since } }),
    User.countDocuments({ role: "Vendor", "vendorDetails.status": "Active" }),
    User.countDocuments({ role: "Vendor", "vendorDetails.status": "Pending Review" }),
    Product.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Product.aggregate([
      { $match: { status: "Active" } },
      { $unwind: "$variants" },
      { $match: { $expr: { $lte: ["$variants.stock", "$variants.lowStockThreshold"] } } },
      {
        $project: {
          title: 1,
          slug: 1,
          thumbnail: 1,
          sku: "$variants.sku",
          stock: "$variants.stock",
        },
      },
      { $sort: { stock: 1 } },
      { $limit: 10 },
    ]),
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: revenueMatch },
      {
        $group: {
          _id: null,
          gmv: { $sum: "$pricing.total" },
          vat: { $sum: "$pricing.vat" },
          shipping: { $sum: "$pricing.shippingFee" },
          discounts: { $sum: "$pricing.discount" },
          orders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: revenueMatch },
      { $unwind: "$items" },
      { $match: { "items.status": { $nin: ["Cancelled", "Returned"] } } },
      { $group: { _id: null, total: { $sum: "$items.commission" } } },
    ]),
    Order.aggregate([
      // Full refunds mark the payment refunded; partial returns only record the amount.
      {
        $match: {
          $or: [
            { "paymentDetails.status": "Refunded" },
            { "returnDetails.resolution": "Approved" },
          ],
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$returnDetails.refundAmount", "$pricing.total"] } },
          count: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: { ...revenueMatch, createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Dubai" },
          },
          revenue: { $sum: "$pricing.total" },
          orders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: revenueMatch },
      { $unwind: "$items" },
      { $match: { "items.status": { $nin: ["Cancelled", "Returned"] } } },
      {
        $group: {
          _id: "$items.product",
          title: { $first: "$items.title" },
          thumbnail: { $first: "$items.thumbnail" },
          units: { $sum: "$items.qty" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
    Order.aggregate([
      { $match: revenueMatch },
      { $unwind: "$items" },
      { $match: { "items.status": { $nin: ["Cancelled", "Returned"] } } },
      {
        $group: {
          _id: "$items.category",
          revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
        },
      },
      { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, name: { $ifNull: ["$category.name", "Other"] }, revenue: 1 } },
      { $sort: { revenue: -1 } },
    ]),
    Order.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .select(
        "orderId status pricing.total paymentDetails.method paymentDetails.status shippingAddress.receiverName shippingAddress.emirate createdAt",
      )
      .lean(),
    Review.countDocuments({ status: "Pending Approval" }),
    Ticket.countDocuments({ status: { $in: OPEN_TICKET_STATUSES } }),
    Payout.countDocuments({ status: { $in: ["Requested", "Processing"] } }),
    ContactMessage.countDocuments({ status: "New" }),
  ]);

  // Customer activity, growth and value, plus the best-performing sellers in the period.
  const activeSince = (ms) => ({
    role: "Customer",
    deletedAt: null,
    lastActiveAt: { $gte: new Date(Date.now() - ms) },
  });
  const [activeDay, activeWeek, activeMonth, signupsRaw, acquisitionRaw, valueRows, sellers] =
    await Promise.all([
      User.countDocuments(activeSince(DAY_MS)),
      User.countDocuments(activeSince(7 * DAY_MS)),
      User.countDocuments(activeSince(30 * DAY_MS)),
      User.aggregate([
        { $match: { role: "Customer", createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Dubai" },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      User.aggregate([
        { $match: { role: "Customer", createdAt: { $gte: since } } },
        { $group: { _id: { $ifNull: ["$signupSource", "unknown"] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Order.aggregate([
        { $match: revenueMatch },
        { $group: { _id: "$user", orders: { $sum: 1 }, spent: { $sum: "$pricing.total" } } },
        {
          $group: {
            _id: null,
            customers: { $sum: 1 },
            repeat: { $sum: { $cond: [{ $gte: ["$orders", 2] }, 1, 0] } },
            revenue: { $sum: "$spent" },
          },
        },
      ]),
      topVendors({ since }),
    ]);
  const signups = new Map(signupsRaw.map((row) => [row._id, row.count]));
  const value = valueRows[0];

  const byDay = new Map(salesByDayRaw.map((entry) => [entry._id, entry]));
  const orderCounts = countsByStatus(orderStatus);
  const productCounts = countsByStatus(productStatus);
  const totals = revenue[0] || {};

  // Staff without the orders or finance permission only get the operational counts.
  const financeView =
    req.user.hasPermission("orders", "view") || req.user.hasPermission("finance", "view");
  if (!financeView) {
    return res.json({
      success: true,
      limited: true,
      stats: {
        customers,
        newCustomers,
        activeVendors,
        pendingVendors,
        products: productCounts,
        pendingProducts: productCounts["Pending Approval"] || 0,
        pendingReviews,
        openTickets,
        pendingPayouts,
        newMessages,
        returnRequests: orderCounts["Return Requested"] || 0,
        awaitingFulfilment:
          (orderCounts.Placed || 0) + (orderCounts.Confirmed || 0) + (orderCounts.Processing || 0),
      },
      ordersByStatus: orderCounts,
      lowStock,
      customerInsights: {
        activeUsers: { day: activeDay, week: activeWeek, month: activeMonth },
        signupsByDay: lastDays(days).map((date) => ({ date, count: signups.get(date) || 0 })),
        acquisition: acquisitionRaw.map((row) => ({ source: row._id, count: row.count })),
      },
    });
  }

  res.json({
    success: true,
    stats: {
      gmv: round2(totals.gmv || 0),
      revenueOrders: totals.orders || 0,
      totalOrders: Object.values(orderCounts).reduce((sum, value) => sum + value, 0),
      averageOrderValue: totals.orders ? round2(totals.gmv / totals.orders) : 0,
      vatCollected: round2(totals.vat || 0),
      shippingCollected: round2(totals.shipping || 0),
      discountsGiven: round2(totals.discounts || 0),
      commissionEarned: round2(commission[0]?.total || 0),
      refundsIssued: round2(refunds[0]?.total || 0),
      refundCount: refunds[0]?.count || 0,
      customers,
      newCustomers,
      activeVendors,
      pendingVendors,
      products: productCounts,
      pendingProducts: productCounts["Pending Approval"] || 0,
      pendingReviews,
      openTickets,
      pendingPayouts,
      newMessages,
      returnRequests: orderCounts["Return Requested"] || 0,
      awaitingFulfilment:
        (orderCounts.Placed || 0) + (orderCounts.Confirmed || 0) + (orderCounts.Processing || 0),
    },
    ordersByStatus: orderCounts,
    salesByDay: lastDays(days).map((date) => ({
      date,
      revenue: round2(byDay.get(date)?.revenue || 0),
      orders: byDay.get(date)?.orders || 0,
    })),
    topProducts,
    categorySales: categorySales.map((entry) => ({ ...entry, revenue: round2(entry.revenue) })),
    recentOrders,
    lowStock,
    customerInsights: {
      activeUsers: { day: activeDay, week: activeWeek, month: activeMonth },
      signupsByDay: lastDays(days).map((date) => ({ date, count: signups.get(date) || 0 })),
      acquisition: acquisitionRaw.map((row) => ({ source: row._id, count: row.count })),
      payingCustomers: value?.customers ?? 0,
      lifetimeValue: value?.customers ? round2(value.revenue / value.customers) : 0,
      repeatRate: value?.customers ? round2((value.repeat / value.customers) * 100) : 0,
    },
    topVendors: sellers,
  });
});

/* =========================================================================
 * Customers, vendors & staff
 * ========================================================================= */

function assertCanManage(actor, target, level = "edit") {
  if (target.role === "Customer" && !actor.hasPermission("customers", level)) throw forbidden();
  if (target.role === "Vendor" && !actor.hasPermission("vendors", level)) throw forbidden();
  if (target.role === "Admin" && !actor.isSuperAdmin) {
    throw forbidden("Only super administrators can manage admin accounts");
  }
}

async function listUsersByRole(req, res, role) {
  const { page, limit, skip } = parsePagination(req.query, 20, 100);
  const filter = { role };
  // Deleted (anonymised) accounts only show when asked for.
  if (req.query.status === "Deleted") filter.deletedAt = { $ne: null };
  else {
    filter.deletedAt = null;
    if (["Active", "Blocked"].includes(req.query.status)) filter.status = req.query.status;
  }
  if (role === "Vendor" && req.query.vendorStatus)
    filter["vendorDetails.status"] = String(req.query.vendorStatus);
  if (req.query.q) {
    const pattern = searchPattern(req.query.q);
    filter.$or = [
      { name: pattern },
      { email: pattern },
      { phone: pattern },
      { "vendorDetails.businessName": pattern },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  const ids = users.map((user) => user._id);

  let stats = new Map();
  if (role === "Customer") {
    const rows = await Order.aggregate([
      { $match: { user: { $in: ids } } },
      {
        $group: {
          _id: "$user",
          orders: { $sum: 1 },
          spent: { $sum: { $cond: [{ $in: ["$status", REVENUE_EXCLUDED] }, 0, "$pricing.total"] } },
          lastOrderAt: { $max: "$createdAt" },
        },
      },
    ]);
    stats = new Map(
      rows.map((row) => [
        String(row._id),
        { orders: row.orders, spent: round2(row.spent), lastOrderAt: row.lastOrderAt },
      ]),
    );
  } else {
    const [products, sales] = await Promise.all([
      Product.aggregate([
        { $match: { vendor: { $in: ids } } },
        {
          $group: {
            _id: "$vendor",
            products: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ["$status", "Active"] }, 1, 0] } },
          },
        },
      ]),
      Order.aggregate([
        { $match: { "items.vendor": { $in: ids }, status: { $nin: REVENUE_EXCLUDED } } },
        { $unwind: "$items" },
        {
          $match: {
            "items.vendor": { $in: ids },
            "items.status": { $nin: ["Cancelled", "Returned"] },
          },
        },
        {
          $group: {
            _id: "$items.vendor",
            sales: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
          },
        },
      ]),
    ]);
    const salesMap = new Map(sales.map((row) => [String(row._id), round2(row.sales)]));
    stats = new Map(
      products.map((row) => [
        String(row._id),
        {
          products: row.products,
          activeProducts: row.active,
          sales: salesMap.get(String(row._id)) || 0,
        },
      ]),
    );
    for (const row of sales) {
      if (!stats.has(String(row._id)))
        stats.set(String(row._id), { products: 0, activeProducts: 0, sales: round2(row.sales) });
    }
  }

  if (role === "Vendor") {
    const performance = await vendorPerformance(ids, { since: new Date(Date.now() - 90 * DAY_MS) });
    for (const id of ids.map(String)) {
      stats.set(id, { ...(stats.get(id) || {}), performance: performance.get(id) });
    }
  }

  const statusCounts =
    role === "Vendor"
      ? countsByStatus(
          await User.aggregate([
            { $match: { role: "Vendor" } },
            { $group: { _id: "$vendorDetails.status", count: { $sum: 1 } } },
          ]),
        )
      : undefined;

  paginated(res, {
    items: users.map((user) => ({ ...user.toJSON(), stats: stats.get(String(user._id)) || {} })),
    key: "users",
    total,
    page,
    limit,
    extra: statusCounts ? { statusCounts } : {},
  });
}

export const listCustomers = asyncHandler((req, res) => listUsersByRole(req, res, "Customer"));
export const listVendors = asyncHandler((req, res) => listUsersByRole(req, res, "Vendor"));

// @route GET /api/admin/users/:id
export const getUserDetail = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw badRequest("Invalid user");
  const user = await User.findById(req.params.id);
  if (!user) throw notFound("User not found");
  assertCanManage(req.user, user, "view");

  const [orders, spend] = await Promise.all([
    Order.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("orderId status pricing.total paymentDetails.method createdAt")
      .lean(),
    Order.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          spent: { $sum: { $cond: [{ $in: ["$status", REVENUE_EXCLUDED] }, 0, "$pricing.total"] } },
        },
      },
    ]),
  ]);

  let vendor = null;
  if (user.role === "Vendor") {
    const settings = await Setting.getSingleton();
    const [balances, productCounts] = await Promise.all([
      computeVendorBalances(user._id, settings),
      Product.aggregate([
        { $match: { vendor: user._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);
    const performance = await vendorPerformance([user._id], {
      since: new Date(Date.now() - 90 * DAY_MS),
    });
    vendor = {
      ...balances,
      products: countsByStatus(productCounts),
      performance: performance.get(String(user._id)),
    };
  }

  const now = Date.now();
  res.json({
    success: true,
    user,
    orders,
    stats: { orderCount: spend[0]?.orders || 0, totalSpent: round2(spend[0]?.spent || 0) },
    vendor,
    // The lock and session fields are hidden from toJSON, so summarise them here.
    security: {
      lockedUntil: user.lockUntil && user.lockUntil.getTime() > now ? user.lockUntil : null,
      activeSessions: (user.sessions || []).filter((session) => session.expiresAt.getTime() > now)
        .length,
    },
  });
});

// @route PUT /api/admin/users/:id/status — body: { status: "Active" | "Blocked" }
export const updateUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["Active", "Blocked"].includes(status)) throw badRequest("Status must be Active or Blocked");

  const user = await User.findById(req.params.id);
  if (!user) throw notFound("User not found");
  if (String(user._id) === String(req.user._id))
    throw badRequest("You can't change the status of your own account");
  assertCanManage(req.user, user);

  user.status = status;
  if (status === "Blocked") user.sessions = [];
  await user.save({ validateBeforeSave: false });

  await audit(req, status === "Blocked" ? "user.block" : "user.unblock", {
    entityType: "User",
    entityId: user._id,
    summary: `${user.email} (${user.role})`,
  });
  res.json({
    success: true,
    message: `${user.name} has been ${status === "Blocked" ? "blocked" : "reactivated"}`,
    user,
  });
});

const OPEN_ORDER_STATUSES = [
  "Placed",
  "Confirmed",
  "Processing",
  "Shipped",
  "Out for Delivery",
  "Return Requested",
];
const devOnly = (extra) => (process.env.NODE_ENV === "production" ? {} : extra);

async function loadManagedUser(req) {
  if (!isObjectId(req.params.id)) throw badRequest("Invalid user");
  const user = await User.findById(req.params.id);
  if (!user || user.deletedAt) throw notFound("User not found");
  assertCanManage(req.user, user);
  return user;
}

// @route PUT /api/admin/users/:id — body: { name?, email?, phone?, gender? }
export const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await loadManagedUser(req);
  const previousEmail = user.email;
  const changes = [];

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (name.length < 2) throw badRequest("Enter the full name");
    if (name !== user.name) {
      user.name = name;
      changes.push("name");
    }
  }
  if (req.body.email !== undefined) {
    const email = String(req.body.email).toLowerCase().trim();
    assertEmail(email);
    if (email !== user.email) {
      if (await User.exists({ email, _id: { $ne: user._id } }))
        throw conflict("Another account already uses this email");
      user.email = email;
      user.isVerified = false; // The new address has to be confirmed before checkout
      changes.push("email");
    }
  }
  if (req.body.phone !== undefined) {
    const raw = String(req.body.phone ?? "").trim();
    const phone = raw ? normalizePhone(raw) : undefined;
    if (phone) assertPhone(phone);
    if (phone !== user.phone) {
      if (phone && (await User.exists({ phone, _id: { $ne: user._id } })))
        throw conflict("Another account already uses this phone number");
      user.phone = phone;
      changes.push("phone");
    }
  }
  if (req.body.gender !== undefined) {
    const gender = ["Male", "Female", "Prefer not to say"].includes(req.body.gender)
      ? req.body.gender
      : undefined;
    if (gender !== user.gender) {
      user.gender = gender;
      changes.push("gender");
    }
  }
  if (!changes.length) return res.json({ success: true, message: "Nothing to update", user });

  await user.save();
  let verifyUrl;
  if (changes.includes("email")) {
    verifyUrl = await sendVerificationEmail(user);
    // Tell the old address too, in case the change wasn't expected.
    sendEmail(
      previousEmail,
      "Your Smart Deal email address was changed",
      `Smart Deal support changed the email on your account to ${user.email}. If you didn't ask for this, contact support straight away.`,
    );
  }
  await audit(req, "user.update", {
    entityType: "User",
    entityId: user._id,
    summary: `${user.email} (${user.role}): ${changes.join(", ")} updated`,
  });
  res.json({
    success: true,
    message: changes.includes("email")
      ? "Details saved. We sent a verification link to the new email address."
      : "Details saved",
    user,
    ...devOnly(verifyUrl ? { devVerifyUrl: verifyUrl } : {}),
  });
});

// @route POST /api/admin/users/:id/password-reset — body: { signOut? }
export const sendUserPasswordReset = asyncHandler(async (req, res) => {
  const user = await loadManagedUser(req);
  if (user.status === "Blocked")
    throw badRequest("Unblock this account before sending a reset link");
  if (req.body.signOut) user.sessions = [];
  const resetUrl = await sendPasswordReset(user);
  await audit(req, "user.password_reset", {
    entityType: "User",
    entityId: user._id,
    summary: `${user.email}${req.body.signOut ? " (signed out of every device)" : ""}`,
  });
  res.json({
    success: true,
    message: `Password reset link sent to ${user.email}`,
    ...devOnly({ devResetUrl: resetUrl }),
  });
});

// @route POST /api/admin/users/:id/unlock — lifts a failed sign-in lockout early
export const unlockUser = asyncHandler(async (req, res) => {
  const user = await loadManagedUser(req);
  user.lockUntil = undefined;
  user.loginAttempts = 0;
  user.firstFailedLoginAt = undefined;
  await user.save({ validateBeforeSave: false });
  await audit(req, "user.unlock", { entityType: "User", entityId: user._id, summary: user.email });
  res.json({ success: true, message: `${user.name} can sign in again`, user });
});

// @route DELETE /api/admin/users/:id — customers only. Personal data is erased, but the account
// record stays so past orders and VAT invoices (which must be kept) still resolve.
export const deleteCustomer = asyncHandler(async (req, res) => {
  const user = await loadManagedUser(req);
  if (user.role !== "Customer") throw badRequest("Only customer accounts can be deleted");

  const open = await Order.countDocuments({ user: user._id, status: { $in: OPEN_ORDER_STATUSES } });
  if (open) {
    throw badRequest(
      `This customer has ${open} open order(s). Delete the account once they're delivered, cancelled or refunded.`,
    );
  }
  if (user.walletBalance > 0) {
    throw badRequest(
      `Their wallet still holds AED ${user.walletBalance.toFixed(2)}. Refund or clear it first so the money is accounted for.`,
    );
  }

  const previousEmail = user.email;
  user.set({
    name: "Deleted customer",
    email: `deleted-${user._id}@deleted.smartdeal.invalid`,
    phone: undefined,
    avatar: undefined,
    gender: undefined,
    addresses: [],
    wishlist: [],
    sessions: [],
    password: crypto.randomBytes(24).toString("hex"),
    status: "Blocked",
    isVerified: false,
    verificationToken: undefined,
    resetPasswordTokenHash: undefined,
    resetPasswordExpires: undefined,
    otp: undefined,
    signupSource: undefined,
    notificationPrefs: { email: false, sms: false, push: false, marketing: false },
    deletedAt: new Date(),
  });
  await user.save({ validateBeforeSave: false });
  await Promise.all([
    Cart.deleteOne({ user: user._id }),
    Subscriber.deleteOne({ email: previousEmail }),
  ]);

  await audit(req, "user.delete", {
    entityType: "User",
    entityId: user._id,
    summary: "Customer account deleted and personal data erased",
  });
  res.json({ success: true, message: "Customer account deleted" });
});

// @route POST /api/admin/customers/:id/wallet — body: { amount, reason }
export const adjustWallet = asyncHandler(async (req, res) => {
  const amount = round2(Number(req.body.amount));
  const reason = String(req.body.reason || "").trim();
  if (!Number.isFinite(amount) || amount === 0) throw badRequest("Enter a non-zero amount");
  if (!reason) throw badRequest("Please add a reason for this adjustment");

  if (!(await User.exists({ _id: req.params.id, role: "Customer", deletedAt: null })))
    throw notFound("Customer not found");
  const user = await User.findOneAndUpdate(
    {
      _id: req.params.id,
      role: "Customer",
      ...(amount < 0 ? { walletBalance: { $gte: -amount } } : {}),
    },
    { $inc: { walletBalance: amount } },
    { new: true },
  );
  if (!user) throw badRequest("The wallet balance can't go below zero");

  await notify(user._id, {
    type: "account",
    title: amount > 0 ? "Wallet credited" : "Wallet adjusted",
    message: `AED ${Math.abs(amount).toFixed(2)} ${amount > 0 ? "added to" : "deducted from"} your wallet. ${reason}`,
    link: "/account?tab=wallet",
  });
  await audit(req, "wallet.adjust", {
    entityType: "User",
    entityId: user._id,
    summary: `${user.email}: ${amount > 0 ? "+" : ""}${amount} AED — ${reason}`,
  });
  res.json({ success: true, message: "Wallet updated", user });
});

// @route PUT /api/admin/vendors/:id — body: { status, rejectionReason, commissionRateOverride }
export const moderateVendor = asyncHandler(async (req, res) => {
  const vendor = await User.findOne({ _id: req.params.id, role: "Vendor" });
  if (!vendor) throw notFound("Vendor not found");

  const { status, rejectionReason, commissionRateOverride } = req.body;
  const previous = vendor.vendorDetails.status;

  if (status !== undefined) {
    if (!["Pending Review", "Active", "Rejected", "Suspended"].includes(status))
      throw badRequest("Invalid vendor status");
    if (["Rejected", "Suspended"].includes(status) && !String(rejectionReason || "").trim()) {
      throw badRequest("Please give a reason so the seller knows what to fix");
    }
    if (
      status === "Active" &&
      ["Pending Review", "Rejected"].includes(previous) &&
      !vendor.vendorDetails?.documents?.tradeLicense?.file
    ) {
      throw badRequest(
        "This seller hasn't uploaded their trade licence yet. Ask them to add it under Store settings before approving.",
      );
    }
    vendor.vendorDetails.status = status;
    vendor.vendorDetails.isApproved = status === "Active";
    vendor.vendorDetails.rejectionReason =
      status === "Active" ? undefined : String(rejectionReason || "").trim() || undefined;

    if (status === "Suspended" && previous !== "Suspended") {
      await Product.updateMany(
        { vendor: vendor._id, status: "Active" },
        { $set: { status: "Suspended", rejectionReason: VENDOR_SUSPENDED_REASON } },
      );
    }
    if (status === "Active" && previous === "Suspended") {
      await Product.updateMany(
        { vendor: vendor._id, status: "Suspended", rejectionReason: VENDOR_SUSPENDED_REASON },
        { $set: { status: "Active" }, $unset: { rejectionReason: 1 } },
      );
    }
  }

  if (commissionRateOverride !== undefined) {
    if (commissionRateOverride === null || commissionRateOverride === "") {
      vendor.vendorDetails.commissionRateOverride = undefined;
    } else {
      const rate = Number(commissionRateOverride);
      if (!(rate >= 0 && rate <= 100)) throw badRequest("Commission must be between 0 and 100%");
      vendor.vendorDetails.commissionRateOverride = rate;
    }
  }

  await vendor.save({ validateBeforeSave: false });

  if (status !== undefined && status !== previous) {
    const messages = {
      Active: "Your store is approved! You can now list products and start selling.",
      Rejected: `Your seller application was not approved: ${vendor.vendorDetails.rejectionReason}`,
      Suspended: `Your store has been suspended: ${vendor.vendorDetails.rejectionReason}`,
      "Pending Review": "Your seller account is back under review.",
    };
    await notify(vendor._id, {
      type: "account",
      title: `Store ${status === "Active" ? "approved" : status.toLowerCase()}`,
      message: messages[status],
      link: "/vendor-dashboard",
    });
  }

  await audit(req, "vendor.moderate", {
    entityType: "User",
    entityId: vendor._id,
    summary: `${vendor.vendorDetails.businessName}: ${previous} → ${vendor.vendorDetails.status}`,
    meta: { commissionRateOverride: vendor.vendorDetails.commissionRateOverride },
  });
  res.json({ success: true, message: "Vendor updated", user: vendor });
});

async function assertAnotherSuperAdmin(excludeId) {
  const exists = await User.exists({
    role: "Admin",
    isSuperAdmin: true,
    status: "Active",
    _id: { $ne: excludeId },
  });
  if (!exists) throw badRequest("At least one active super admin is required");
}

// @route GET /api/admin/staff
export const listStaff = asyncHandler(async (_req, res) => {
  const staff = await User.find({ role: "Admin" })
    .sort({ createdAt: 1 })
    .populate("adminRole", "name");
  res.json({ success: true, staff, permissions: ADMIN_PERMISSIONS });
});

// @route POST /api/admin/staff
export const createStaff = asyncHandler(async (req, res) => {
  requireFields(req.body, ["name", "email", "password"]);
  const email = String(req.body.email).toLowerCase().trim();
  assertEmail(email);
  assertStrongPassword(req.body.password);

  let phone;
  if (req.body.phone) {
    phone = normalizePhone(req.body.phone);
    assertPhone(phone);
  }
  if (await User.exists({ email })) throw conflict("An account with this email already exists");
  if (phone && (await User.exists({ phone })))
    throw conflict("An account with this phone number already exists");

  const access = await resolveStaffAccess(req.body);
  const staff = await User.create({
    name: String(req.body.name).trim(),
    email,
    phone,
    password: req.body.password,
    role: "Admin",
    isSuperAdmin: Boolean(req.body.isSuperAdmin),
    ...access,
    adminRole: access.adminRole ?? undefined,
    isVerified: true,
  });

  await audit(req, "staff.create", {
    entityType: "User",
    entityId: staff._id,
    summary: `${staff.email} (${staff.isSuperAdmin ? "super admin" : staff.permissions.join(", ") || "no permissions"})`,
  });
  res.status(201).json({ success: true, message: "Staff account created", staff });
});

// @route PUT /api/admin/staff/:id
export const updateStaff = asyncHandler(async (req, res) => {
  const staff = await User.findOne({ _id: req.params.id, role: "Admin" });
  if (!staff) throw notFound("Staff account not found");
  const isSelf = String(staff._id) === String(req.user._id);
  const wasActiveSuper = staff.isSuperAdmin && staff.status === "Active";

  if (req.body.name !== undefined) staff.name = String(req.body.name).trim() || staff.name;
  if (
    req.body.adminRole !== undefined ||
    req.body.permissions !== undefined ||
    req.body.viewPermissions !== undefined
  ) {
    const access = await resolveStaffAccess(req.body);
    staff.permissions = access.permissions;
    staff.viewPermissions = access.viewPermissions;
    staff.adminRole = access.adminRole ?? undefined;
  }
  if (req.body.isSuperAdmin !== undefined) {
    if (isSelf && !req.body.isSuperAdmin)
      throw badRequest("You can't remove your own super admin access");
    staff.isSuperAdmin = Boolean(req.body.isSuperAdmin);
  }
  if (req.body.status !== undefined) {
    if (!["Active", "Blocked"].includes(req.body.status)) throw badRequest("Invalid status");
    if (isSelf && req.body.status !== staff.status)
      throw badRequest("You can't block your own account");
    staff.status = req.body.status;
    if (staff.status === "Blocked") staff.sessions = [];
  }

  if (wasActiveSuper && !(staff.isSuperAdmin && staff.status === "Active"))
    await assertAnotherSuperAdmin(staff._id);

  await staff.save({ validateBeforeSave: false });
  await audit(req, "staff.update", {
    entityType: "User",
    entityId: staff._id,
    summary: `${staff.email}: edit [${staff.permissions.join(", ")}], view [${(staff.viewPermissions || []).join(", ")}]`,
  });
  res.json({ success: true, message: "Staff account updated", staff });
});

// @route DELETE /api/admin/staff/:id
export const deleteStaff = asyncHandler(async (req, res) => {
  const staff = await User.findOne({ _id: req.params.id, role: "Admin" });
  if (!staff) throw notFound("Staff account not found");
  if (String(staff._id) === String(req.user._id))
    throw badRequest("You can't delete your own account");
  if (staff.isSuperAdmin) await assertAnotherSuperAdmin(staff._id);

  await staff.deleteOne();
  await audit(req, "staff.delete", {
    entityType: "User",
    entityId: staff._id,
    summary: staff.email,
  });
  res.json({ success: true, message: "Staff account deleted" });
});

/* =========================================================================
 * Catalog moderation
 * ========================================================================= */

// @route GET /api/admin/products
export const listAdminProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20, 100);
  const filter = await buildCatalogFilter(req.query, { allStatuses: true });
  const sort = CATALOG_SORTS[req.query.sort] || { updatedAt: -1 };

  const [products, total, statusCounts] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("category", "name slug")
      .populate("vendor", "name email role vendorDetails.businessName")
      .lean(),
    Product.countDocuments(filter),
    Product.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  paginated(res, {
    items: products,
    key: "products",
    total,
    page,
    limit,
    extra: { statusCounts: countsByStatus(statusCounts) },
  });
});

// @route PUT /api/admin/products/:id/moderate — body: { status, rejectionReason }
export const moderateProduct = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["Active", "Rejected", "Suspended", "Pending Approval", "Draft"].includes(status)) {
    throw badRequest("Invalid product status");
  }
  const rejectionReason = String(req.body.rejectionReason || "").trim();
  if (["Rejected", "Suspended"].includes(status) && !rejectionReason) {
    throw badRequest("Please add a reason so the seller knows what to fix");
  }

  const product = await Product.findById(req.params.id).populate(
    "vendor",
    "name role vendorDetails.status",
  );
  if (!product) throw notFound("Product not found");
  if (
    status === "Active" &&
    product.vendor?.role === "Vendor" &&
    product.vendor.vendorDetails?.status !== "Active"
  ) {
    throw conflict(
      `This seller's store is ${(product.vendor.vendorDetails?.status || "not active").toLowerCase()}, so the product can't go live. Reactivate the seller first.`,
    );
  }

  const previous = product.status;
  product.status = status;
  product.rejectionReason = ["Rejected", "Suspended"].includes(status)
    ? rejectionReason
    : undefined;
  await product.save();

  if (product.vendor?.role === "Vendor" && previous !== status) {
    const verbs = {
      Active: "approved and is now live",
      Rejected: "was not approved",
      Suspended: "was suspended",
    };
    await notify(product.vendor._id, {
      type: "product",
      title: `Product ${status === "Active" ? "approved" : status.toLowerCase()}`,
      message: `"${product.title}" ${verbs[status] || `is now ${status}`}.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
      link: "/vendor-dashboard?tab=products",
    });
  }

  await audit(req, "product.moderate", {
    entityType: "Product",
    entityId: product._id,
    summary: `${product.title}: ${previous} → ${status}`,
    meta: rejectionReason ? { rejectionReason } : undefined,
  });
  res.json({
    success: true,
    message: `Product ${status === "Active" ? "approved" : `marked ${status}`}`,
    product,
  });
});

// @route PUT /api/admin/products/:id/flags — body: { isFeatured, isBestSeller, isNewArrival,
//   isClearance, isFlashDeal, flashDealStartsAt, flashDealEndsAt, flashDealStock }
export const updateProductFlags = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw notFound("Product not found");

  const updates = {};
  for (const key of ["isFeatured", "isBestSeller", "isNewArrival", "isClearance", "isFlashDeal"]) {
    if (typeof req.body[key] === "boolean") updates[key] = req.body[key];
  }
  for (const key of ["flashDealStartsAt", "flashDealEndsAt"]) {
    if (req.body[key] === undefined) continue;
    if (!req.body[key]) {
      updates[key] = null;
      continue;
    }
    const date = new Date(req.body[key]);
    if (Number.isNaN(date.getTime()))
      throw badRequest(`Invalid flash deal ${key === "flashDealStartsAt" ? "start" : "end"} date`);
    updates[key] = date;
  }
  if (req.body.flashDealStock !== undefined) {
    if (req.body.flashDealStock === null || req.body.flashDealStock === "") {
      updates.flashDealStock = null;
    } else {
      const stock = Number(req.body.flashDealStock);
      if (!Number.isInteger(stock) || stock < 1)
        throw badRequest("The deal stock limit must be a whole number of 1 or more");
      updates.flashDealStock = stock;
    }
  }
  if (!Object.keys(updates).length) throw badRequest("Nothing to update");

  const next = { ...product.toObject(), ...updates };
  if (next.isFlashDeal) {
    const starts = next.flashDealStartsAt ? new Date(next.flashDealStartsAt) : null;
    const ends = next.flashDealEndsAt ? new Date(next.flashDealEndsAt) : null;
    if (starts && ends && ends <= starts)
      throw badRequest("The flash deal must end after it starts");
    if (ends && ends <= new Date() && updates.flashDealEndsAt !== undefined)
      throw badRequest("Pick an end time in the future");
    if (next.flashDealStock && next.flashDealStock > product.totalStock)
      throw badRequest(`The deal can't offer more than the ${product.totalStock} unit(s) in stock`);
  }
  // Starting (or rescheduling) a deal starts its sold counter from zero.
  if (
    (updates.isFlashDeal === true && !product.isFlashDeal) ||
    (updates.flashDealStartsAt !== undefined &&
      String(updates.flashDealStartsAt) !== String(product.flashDealStartsAt ?? null))
  ) {
    updates.flashDealSold = 0;
  }
  if (updates.isFlashDeal === false) {
    updates.flashDealStartsAt = null;
    updates.flashDealEndsAt = null;
    updates.flashDealStock = null;
  }

  product.set(updates);
  await product.save();

  await audit(req, "product.flags", {
    entityType: "Product",
    entityId: product._id,
    summary: product.title,
    meta: updates,
  });
  res.json({ success: true, message: "Merchandising flags updated", product });
});

/* ---------- Categories ---------- */

function readCategoryInput(body, { partial = false } = {}) {
  if (!partial) requireFields(body, ["name"]);
  const data = pick(body, [
    "name",
    "slug",
    "parentCategory",
    "description",
    "image",
    "icon",
    "banner",
    "commissionRate",
    "isActive",
    "sortOrder",
  ]);

  if (data.name !== undefined) {
    data.name = String(data.name).trim();
    if (!data.name) throw badRequest("Category name is required");
  }
  if (data.slug !== undefined || !partial) {
    data.slug = slugify(data.slug || data.name);
    if (!data.slug) throw badRequest("Category slug is required");
  }
  if (data.parentCategory === "" || data.parentCategory === null) data.parentCategory = null;
  else if (data.parentCategory !== undefined && !isObjectId(data.parentCategory))
    throw badRequest("Invalid parent category");
  if (data.commissionRate !== undefined) {
    const rate = Number(data.commissionRate);
    if (!(rate >= 0 && rate <= 100)) throw badRequest("Commission must be between 0 and 100%");
    data.commissionRate = rate;
  }
  if (data.sortOrder !== undefined) data.sortOrder = Number(data.sortOrder) || 0;
  if (data.isActive !== undefined) data.isActive = Boolean(data.isActive);
  return data;
}

// @route GET /api/admin/categories
export const listAdminCategories = asyncHandler(async (_req, res) => {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ sortOrder: 1, name: 1 }).lean(),
    Product.aggregate([
      {
        $group: {
          _id: DEEPEST_CATEGORY,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$status", "Active"] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const countMap = rollUpCounts(await loadCategoryIndex(), counts, ["total", "active"]);
  res.json({
    success: true,
    categories: categories.map((category) => ({
      ...category,
      productCount: countMap.get(String(category._id))?.total || 0,
      activeProductCount: countMap.get(String(category._id))?.active || 0,
    })),
  });
});

// @route POST /api/admin/categories
/**
 * A category can sit under any category that exists, as long as it isn't its own ancestor and
 * the tree stays within three levels (counting everything already under the category).
 */
async function assertValidParent(categoryId, parentId) {
  if (!parentId) return;
  const index = await loadCategoryIndex();
  if (!index.byId.has(String(parentId))) throw badRequest("Parent category not found");
  if (categoryId && index.descendants(categoryId).includes(String(parentId))) {
    throw badRequest("A category can't be moved under itself or one of its own subcategories");
  }
  const parentDepth = index.ancestors(parentId).length;
  const levelsBelow = categoryId ? index.height(categoryId) : 0;
  if (parentDepth + 1 + levelsBelow > MAX_CATEGORY_DEPTH) {
    throw badRequest(
      levelsBelow
        ? `That would make the tree deeper than ${MAX_CATEGORY_DEPTH} levels, because this category has its own subcategories`
        : `Categories go ${MAX_CATEGORY_DEPTH} levels deep at most (Category → Subcategory → Sub-subcategory)`,
    );
  }
}

/** After a move, products under the moved branch get their top-level category recalculated. */
async function realignProducts(movedCategoryId) {
  clearCategoryIndex();
  const index = await loadCategoryIndex();
  const branch = index.descendants(movedCategoryId);
  const products = await Product.find({
    $or: [{ category: { $in: branch } }, { subcategory: { $in: branch } }],
  })
    .select("category subcategory")
    .lean();
  const updates = products.map((product) => {
    const leaf = String(product.subcategory || product.category);
    const path = index.ancestors(leaf);
    return {
      updateOne: {
        filter: { _id: product._id },
        update: { $set: { category: path[0], subcategory: path.length > 1 ? leaf : null } },
      },
    };
  });
  if (updates.length) await Product.bulkWrite(updates);
  return updates.length;
}

export const createCategory = asyncHandler(async (req, res) => {
  const data = readCategoryInput(req.body);
  if (await Category.exists({ slug: data.slug }))
    throw conflict(`A category with the URL "${data.slug}" already exists`);
  await assertValidParent(null, data.parentCategory);

  const category = await Category.create(data);
  clearCategoryIndex();
  await audit(req, "category.create", {
    entityType: "Category",
    entityId: category._id,
    summary: category.name,
  });
  res.status(201).json({ success: true, message: "Category created", category });
});

// @route PUT /api/admin/categories/:id
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw notFound("Category not found");
  const data = readCategoryInput(req.body, { partial: true });

  if (data.slug && data.slug !== category.slug && (await Category.exists({ slug: data.slug }))) {
    throw conflict(`A category with the URL "${data.slug}" already exists`);
  }
  const moved =
    data.parentCategory !== undefined &&
    String(data.parentCategory ?? "") !== String(category.parentCategory ?? "");
  if (moved) await assertValidParent(category._id, data.parentCategory);

  category.set(data);
  await category.save();
  clearCategoryIndex();
  if (moved) await realignProducts(category._id);
  await audit(req, "category.update", {
    entityType: "Category",
    entityId: category._id,
    summary: category.name,
  });
  res.json({ success: true, message: "Category updated", category });
});

// @route DELETE /api/admin/categories/:id
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw notFound("Category not found");

  const [productCount, childCount] = await Promise.all([
    Product.countDocuments({ $or: [{ category: category._id }, { subcategory: category._id }] }),
    Category.countDocuments({ parentCategory: category._id }),
  ]);
  if (productCount)
    throw conflict(`Move or delete the ${productCount} product(s) in "${category.name}" first`);
  if (childCount)
    throw conflict(
      `Delete or move the ${childCount} subcategory(ies) under "${category.name}" first`,
    );

  await category.deleteOne();
  clearCategoryIndex();
  await audit(req, "category.delete", {
    entityType: "Category",
    entityId: category._id,
    summary: category.name,
  });
  res.json({ success: true, message: "Category deleted" });
});

/* ---------- Reviews ---------- */

// @route GET /api/admin/reviews
export const listReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20, 100);
  const filter = {};
  if (["Pending Approval", "Approved", "Rejected"].includes(req.query.status))
    filter.status = req.query.status;
  if (req.query.flagged === "true") filter.isFlagged = true;
  const rating = Number(req.query.rating);
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) filter.rating = rating;
  if (req.query.q) {
    const pattern = searchPattern(req.query.q);
    filter.$or = [{ comment: pattern }, { title: pattern }];
  }

  const [reviews, total, statusCounts] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email")
      .populate("product", "title slug thumbnail")
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  paginated(res, {
    items: reviews,
    key: "reviews",
    total,
    page,
    limit,
    extra: { statusCounts: countsByStatus(statusCounts) },
  });
});

// @route PUT /api/admin/reviews/:id — body: { status, rejectionReason }
export const moderateReview = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["Approved", "Rejected", "Pending Approval"].includes(status))
    throw badRequest("Invalid review status");

  const review = await Review.findById(req.params.id).populate("product", "title slug");
  if (!review) throw notFound("Review not found");

  review.status = status;
  review.rejectionReason =
    status === "Rejected"
      ? String(req.body.rejectionReason || "").trim() || "Doesn't meet our review guidelines"
      : undefined;
  if (status === "Approved") review.isFlagged = false;
  await review.save();
  if (review.product) await recomputeProductRating(review.product._id);

  if (status !== "Pending Approval" && review.product) {
    await notify(review.user, {
      type: "review",
      title: status === "Approved" ? "Your review is live" : "Your review wasn't published",
      message:
        status === "Approved"
          ? `Thanks for reviewing ${review.product.title}.`
          : `Your review of ${review.product.title} wasn't published: ${review.rejectionReason}`,
      link: `/product/${review.product.slug}`,
    });
  }

  await audit(req, "review.moderate", {
    entityType: "Review",
    entityId: review._id,
    summary: `${status}: ${review.product?.title}`,
  });
  res.json({
    success: true,
    message: `Review ${status === "Approved" ? "approved" : status.toLowerCase()}`,
    review,
  });
});

// @route DELETE /api/admin/reviews/:id
export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) throw notFound("Review not found");
  await recomputeProductRating(review.product);
  await audit(req, "review.delete", { entityType: "Review", entityId: review._id });
  res.json({ success: true, message: "Review deleted" });
});

/* =========================================================================
 * Marketing: coupons, banners, CMS pages, subscribers
 * ========================================================================= */

function couponState(coupon) {
  const now = Date.now();
  if (!coupon.isActive) return "Disabled";
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return "Exhausted";
  if (new Date(coupon.startDate).getTime() > now) return "Scheduled";
  if (new Date(coupon.endDate).getTime() < now) return "Expired";
  return "Active";
}

function readCouponInput(body) {
  const data = pick(body, [
    "code",
    "description",
    "discountType",
    "discountValue",
    "maxDiscount",
    "minOrderValue",
    "startDate",
    "endDate",
    "usageLimit",
    "limitPerUser",
    "isActive",
    "excludedCategories",
    "excludedBrands",
    "excludeClearance",
  ]);
  if (data.excludeClearance !== undefined) data.excludeClearance = Boolean(data.excludeClearance);

  if (data.code !== undefined) {
    data.code = String(data.code).trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(data.code)) {
      throw badRequest("Coupon codes must be 3–30 letters, numbers, dashes or underscores");
    }
  }
  for (const key of [
    "discountValue",
    "maxDiscount",
    "minOrderValue",
    "usageLimit",
    "limitPerUser",
  ]) {
    if (data[key] === "" || data[key] === null) {
      data[key] = { discountValue: 0, minOrderValue: 0, limitPerUser: 1 }[key] ?? null;
    } else if (data[key] !== undefined) {
      const value = Number(data[key]);
      if (!Number.isFinite(value) || value < 0)
        throw badRequest(`${key} must be zero or a positive number`);
      data[key] = value;
    }
  }
  for (const key of ["startDate", "endDate"]) {
    if (data[key] !== undefined) {
      const date = new Date(data[key]);
      if (Number.isNaN(date.getTime()))
        throw badRequest(`Invalid ${key === "startDate" ? "start" : "end"} date`);
      data[key] = date;
    }
  }
  if (data.excludedBrands !== undefined) {
    data.excludedBrands = (
      Array.isArray(data.excludedBrands)
        ? data.excludedBrands
        : String(data.excludedBrands).split(",")
    )
      .map((brand) => String(brand).trim())
      .filter(Boolean);
  }
  if (data.excludedCategories !== undefined) {
    data.excludedCategories = (
      Array.isArray(data.excludedCategories) ? data.excludedCategories : []
    ).filter(isObjectId);
  }
  if (data.isActive !== undefined) data.isActive = Boolean(data.isActive);
  return data;
}

function assertCouponConsistent(coupon) {
  if (!["Percentage", "Fixed", "Free Shipping"].includes(coupon.discountType))
    throw badRequest("Choose a discount type");
  if (
    coupon.discountType === "Percentage" &&
    !(coupon.discountValue > 0 && coupon.discountValue <= 100)
  ) {
    throw badRequest("Percentage discounts must be between 1 and 100");
  }
  if (coupon.discountType === "Fixed" && !(coupon.discountValue > 0))
    throw badRequest("Enter the discount amount in AED");
  if (coupon.discountType === "Free Shipping") coupon.discountValue = 0;
  if (!coupon.startDate || !coupon.endDate) throw badRequest("Start and end dates are required");
  if (coupon.endDate <= coupon.startDate)
    throw badRequest("The end date must be after the start date");
}

// @route GET /api/admin/coupons
export const listCoupons = asyncHandler(async (_req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 }).select("-userUsage").lean();
  res.json({
    success: true,
    coupons: coupons.map((coupon) => ({ ...coupon, state: couponState(coupon) })),
  });
});

// @route POST /api/admin/coupons
export const createCoupon = asyncHandler(async (req, res) => {
  requireFields(req.body, ["code", "discountType", "startDate", "endDate"]);
  const data = readCouponInput(req.body);
  if (await Coupon.exists({ code: data.code }))
    throw conflict(`Coupon ${data.code} already exists`);

  const coupon = new Coupon(data);
  assertCouponConsistent(coupon);
  await coupon.save();

  await audit(req, "coupon.create", {
    entityType: "Coupon",
    entityId: coupon._id,
    summary: coupon.code,
  });
  res.status(201).json({ success: true, message: `Coupon ${coupon.code} created`, coupon });
});

// @route PUT /api/admin/coupons/:id
export const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw notFound("Coupon not found");
  const data = readCouponInput(req.body);
  if (data.code && data.code !== coupon.code && (await Coupon.exists({ code: data.code }))) {
    throw conflict(`Coupon ${data.code} already exists`);
  }

  coupon.set(data);
  assertCouponConsistent(coupon);
  await coupon.save();

  await audit(req, "coupon.update", {
    entityType: "Coupon",
    entityId: coupon._id,
    summary: coupon.code,
  });
  res.json({ success: true, message: "Coupon updated", coupon });
});

// @route DELETE /api/admin/coupons/:id
export const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw notFound("Coupon not found");
  await audit(req, "coupon.delete", {
    entityType: "Coupon",
    entityId: coupon._id,
    summary: coupon.code,
  });
  res.json({ success: true, message: "Coupon deleted" });
});

function readBannerInput(body, { partial = false } = {}) {
  if (!partial) requireFields(body, ["title", "imageUrl"]);
  const data = pick(body, [
    "title",
    "subtitle",
    "eyebrow",
    "ctaLabel",
    "imageUrl",
    "linkUrl",
    "position",
    "tone",
    "startDate",
    "endDate",
    "order",
    "isActive",
  ]);
  const isUrl = (value) => /^(https?:\/\/|\/)/.test(String(value));

  if (data.imageUrl !== undefined && !isUrl(data.imageUrl))
    throw badRequest("Image URL must start with https:// or /");
  if (data.linkUrl !== undefined && data.linkUrl !== "" && !isUrl(data.linkUrl))
    throw badRequest("Link must start with / or https://");
  if (
    data.position !== undefined &&
    !["Hero Carousel", "Promo Grid", "Sidebar", "Flash Sale Banner"].includes(data.position)
  ) {
    throw badRequest("Invalid banner position");
  }
  if (data.tone !== undefined && !["light", "dark"].includes(data.tone))
    throw badRequest("Invalid banner tone");
  for (const key of ["startDate", "endDate"]) {
    if (data[key] !== undefined) {
      data[key] = data[key] ? new Date(data[key]) : null;
      if (data[key] && Number.isNaN(data[key].getTime()))
        throw badRequest("Invalid banner schedule date");
    }
  }
  if (data.startDate && data.endDate && data.endDate <= data.startDate)
    throw badRequest("The end date must be after the start date");
  if (data.order !== undefined) data.order = Number(data.order) || 0;
  if (data.isActive !== undefined) data.isActive = Boolean(data.isActive);
  return data;
}

// @route GET /api/admin/banners
export const listBanners = asyncHandler(async (_req, res) => {
  const banners = await Banner.find().sort({ position: 1, order: 1, createdAt: -1 }).lean();
  res.json({ success: true, banners });
});

// @route POST /api/admin/banners
export const createBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.create(readBannerInput(req.body));
  await audit(req, "banner.create", {
    entityType: "Banner",
    entityId: banner._id,
    summary: banner.title,
  });
  res.status(201).json({ success: true, message: "Banner published", banner });
});

// @route PUT /api/admin/banners/:id
export const updateBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw notFound("Banner not found");
  banner.set(readBannerInput(req.body, { partial: true }));
  await banner.save();
  await audit(req, "banner.update", {
    entityType: "Banner",
    entityId: banner._id,
    summary: banner.title,
  });
  res.json({ success: true, message: "Banner updated", banner });
});

// @route DELETE /api/admin/banners/:id
export const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findByIdAndDelete(req.params.id);
  if (!banner) throw notFound("Banner not found");
  await audit(req, "banner.delete", {
    entityType: "Banner",
    entityId: banner._id,
    summary: banner.title,
  });
  res.json({ success: true, message: "Banner deleted" });
});

function readPageInput(body, { partial = false } = {}) {
  if (!partial) requireFields(body, ["title"]);
  const data = pick(body, [
    "slug",
    "title",
    "summary",
    "content",
    "titleAr",
    "summaryAr",
    "contentAr",
    "footerGroup",
    "sortOrder",
    "isPublished",
  ]);
  if (data.title !== undefined) data.title = String(data.title).trim();
  if (data.titleAr !== undefined)
    data.titleAr = String(data.titleAr ?? "")
      .trim()
      .slice(0, 200);
  if (data.summaryAr !== undefined)
    data.summaryAr = String(data.summaryAr ?? "")
      .trim()
      .slice(0, 500);
  if (data.contentAr !== undefined) data.contentAr = String(data.contentAr ?? "").slice(0, 50000);
  if (data.slug !== undefined || !partial) {
    data.slug = slugify(data.slug || data.title);
    if (!data.slug) throw badRequest("Page URL slug is required");
  }
  if (
    data.footerGroup !== undefined &&
    !["Help", "Company", "Policies", "None"].includes(data.footerGroup)
  ) {
    throw badRequest("Invalid footer group");
  }
  if (data.content !== undefined) data.content = String(data.content).slice(0, 50000);
  if (data.sortOrder !== undefined) data.sortOrder = Number(data.sortOrder) || 0;
  if (data.isPublished !== undefined) data.isPublished = Boolean(data.isPublished);
  return data;
}

/** The Arabic version only shows on the storefront with a title, so don't save one without it. */
function assertArabicTitle(page) {
  if (page.contentAr?.trim() && !page.titleAr?.trim())
    throw badRequest("Add an Arabic title to go with the Arabic content");
}

// @route GET /api/admin/pages
export const listPages = asyncHandler(async (_req, res) => {
  const pages = await Page.find().sort({ footerGroup: 1, sortOrder: 1, title: 1 }).lean();
  res.json({ success: true, pages });
});

// @route POST /api/admin/pages
export const createPage = asyncHandler(async (req, res) => {
  const data = readPageInput(req.body);
  if (await Page.exists({ slug: data.slug }))
    throw conflict(`A page with the URL "${data.slug}" already exists`);
  assertArabicTitle(data);
  const page = await Page.create(data);
  await audit(req, "page.create", { entityType: "Page", entityId: page._id, summary: page.title });
  res.status(201).json({ success: true, message: "Page created", page });
});

// @route PUT /api/admin/pages/:id
export const updatePage = asyncHandler(async (req, res) => {
  const page = await Page.findById(req.params.id);
  if (!page) throw notFound("Page not found");
  const data = readPageInput(req.body, { partial: true });
  if (data.slug && data.slug !== page.slug && (await Page.exists({ slug: data.slug }))) {
    throw conflict(`A page with the URL "${data.slug}" already exists`);
  }
  page.set(data);
  assertArabicTitle(page);
  await page.save();
  await audit(req, "page.update", { entityType: "Page", entityId: page._id, summary: page.title });
  res.json({ success: true, message: "Page saved", page });
});

// @route DELETE /api/admin/pages/:id
export const deletePage = asyncHandler(async (req, res) => {
  const page = await Page.findByIdAndDelete(req.params.id);
  if (!page) throw notFound("Page not found");
  await audit(req, "page.delete", { entityType: "Page", entityId: page._id, summary: page.title });
  res.json({ success: true, message: "Page deleted" });
});

// @route GET /api/admin/subscribers
export const listSubscribers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 50, 500);
  const filter = req.query.q ? { email: searchPattern(req.query.q) } : {};
  const [subscribers, total] = await Promise.all([
    Subscriber.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Subscriber.countDocuments(filter),
  ]);
  paginated(res, { items: subscribers, key: "subscribers", total, page, limit });
});

// @route DELETE /api/admin/subscribers/:id
export const deleteSubscriber = asyncHandler(async (req, res) => {
  const subscriber = await Subscriber.findByIdAndDelete(req.params.id);
  if (!subscriber) throw notFound("Subscriber not found");
  await audit(req, "subscriber.delete", {
    entityType: "Subscriber",
    entityId: subscriber._id,
    summary: subscriber.email,
  });
  res.json({ success: true, message: "Subscriber removed" });
});

/* =========================================================================
 * Finance: payouts
 * ========================================================================= */

const PAYOUT_TRANSITIONS = {
  Requested: ["Processing", "Transferred", "Declined"],
  Processing: ["Transferred", "Declined"],
  Transferred: [],
  Declined: [],
};

// @route GET /api/admin/payouts
export const listPayouts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20, 100);
  const filter = {};
  if (Object.keys(PAYOUT_TRANSITIONS).includes(req.query.status)) filter.status = req.query.status;

  const [payouts, total, statusCounts] = await Promise.all([
    Payout.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("vendor", "name email vendorDetails.businessName")
      .populate("processedBy", "name")
      .lean(),
    Payout.countDocuments(filter),
    Payout.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
    ]),
  ]);

  paginated(res, {
    items: payouts,
    key: "payouts",
    total,
    page,
    limit,
    extra: {
      statusCounts: Object.fromEntries(
        statusCounts.map((row) => [row._id, { count: row.count, amount: round2(row.amount) }]),
      ),
    },
  });
});

// @route PUT /api/admin/payouts/:id — body: { status, reference, remarks }
export const updatePayout = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const payout = await Payout.findById(req.params.id).populate(
    "vendor",
    "name email vendorDetails.businessName",
  );
  if (!payout) throw notFound("Payout not found");
  if (!(PAYOUT_TRANSITIONS[payout.status] || []).includes(status)) {
    throw badRequest(`A ${payout.status.toLowerCase()} payout can't be marked as ${status}`);
  }

  const reference = String(req.body.reference || "").trim();
  const remarks = String(req.body.remarks || "").trim();
  if (status === "Transferred" && !reference) throw badRequest("Enter the bank transfer reference");
  if (status === "Declined" && !remarks)
    throw badRequest("Please explain why the payout was declined");

  payout.status = status;
  if (reference) payout.reference = reference;
  if (remarks) payout.remarks = remarks;
  payout.processedBy = req.user._id;
  payout.processedAt = new Date();
  await payout.save();

  const messages = {
    Processing: `Your payout of AED ${payout.amount.toFixed(2)} is being processed.`,
    Transferred: `AED ${payout.amount.toFixed(2)} was transferred to your bank. Reference: ${reference}`,
    Declined: `Your payout of AED ${payout.amount.toFixed(2)} was declined: ${remarks}`,
  };
  await notify(payout.vendor._id, {
    type: "payout",
    title: `Payout ${status.toLowerCase()}`,
    message: messages[status],
    link: "/vendor-dashboard?tab=payouts",
  });
  await audit(req, "payout.update", {
    entityType: "Payout",
    entityId: payout._id,
    summary: `${payout.vendor.vendorDetails?.businessName || payout.vendor.name}: AED ${payout.amount} → ${status}`,
  });
  res.json({ success: true, message: `Payout marked as ${status}`, payout });
});

/* =========================================================================
 * Settings, audit log & inbox
 * ========================================================================= */

const SETTING_FIELDS = [
  "storeName",
  "tagline",
  "supportEmail",
  "supportPhone",
  "address",
  "trn",
  "announcement",
  "vatEnabled",
  "vatPercent",
  "codEnabled",
  "codFee",
  "cardEnabled",
  "walletEnabled",
  "shippingMatrix",
  "expressFee",
  "expressEta",
  "sameDayFee",
  "sameDayEmirates",
  "sameDayCutoff",
  "returnWindowDays",
  "minPayout",
  "payoutHoldDays",
  "social",
  "requireAdminMfa",
  "pricesIncludeVat",
];

// @route GET /api/admin/settings
export const getAdminSettings = asyncHandler(async (_req, res) => {
  const settings = await Setting.getSingleton();
  res.json({ success: true, settings, paymentMode: process.env.PAYMENT_MODE || "disabled" });
});

// @route PUT /api/admin/settings
export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await Setting.getSingleton();
  const data = pick(req.body, SETTING_FIELDS);

  for (const key of [
    "vatPercent",
    "codFee",
    "expressFee",
    "sameDayFee",
    "returnWindowDays",
    "minPayout",
    "payoutHoldDays",
  ]) {
    if (data[key] !== undefined) {
      const value = Number(data[key]);
      if (!Number.isFinite(value) || value < 0) throw badRequest(`${key} must be zero or more`);
      data[key] = value;
    }
  }
  if (data.vatPercent > 100) throw badRequest("VAT can't be more than 100%");
  for (const key of [
    "vatEnabled",
    "codEnabled",
    "cardEnabled",
    "walletEnabled",
    "requireAdminMfa",
    "pricesIncludeVat",
  ]) {
    if (data[key] !== undefined) data[key] = Boolean(data[key]);
  }
  if (data.requireAdminMfa && !req.user.mfa?.enabled) {
    throw badRequest("Turn on two-step sign-in for your own account before requiring it for staff");
  }
  if (data.supportEmail !== undefined) assertEmail(data.supportEmail);

  if (data.shippingMatrix !== undefined) {
    if (!Array.isArray(data.shippingMatrix)) throw badRequest("Invalid shipping rates");
    const rows = data.shippingMatrix.map((row) => {
      if (!EMIRATES.includes(row.emirate)) throw badRequest(`Unknown emirate: ${row.emirate}`);
      const fee = Number(row.fee);
      const freeThreshold = Number(row.freeThreshold);
      const includedWeightKg = Number(row.includedWeightKg ?? 0);
      const extraPerKg = Number(row.extraPerKg ?? 0);
      if (!(fee >= 0) || !(freeThreshold >= 0))
        throw badRequest(`Check the delivery fees for ${row.emirate}`);
      if (!(includedWeightKg >= 0) || !(extraPerKg >= 0))
        throw badRequest(`Check the weight pricing for ${row.emirate}`);
      return {
        emirate: row.emirate,
        fee,
        freeThreshold,
        eta: String(row.eta || "").trim(),
        includedWeightKg,
        extraPerKg,
      };
    });
    const missing = EMIRATES.filter((emirate) => !rows.some((row) => row.emirate === emirate));
    if (missing.length) throw badRequest(`Add delivery rates for: ${missing.join(", ")}`);
    data.shippingMatrix = EMIRATES.map((emirate) => rows.find((row) => row.emirate === emirate));
  }
  if (data.sameDayEmirates !== undefined) {
    data.sameDayEmirates = (Array.isArray(data.sameDayEmirates) ? data.sameDayEmirates : []).filter(
      (emirate) => EMIRATES.includes(emirate),
    );
  }
  if (data.social !== undefined)
    data.social = pick(data.social || {}, ["instagram", "facebook", "x", "youtube"]);

  settings.set(data);
  await settings.save();

  await audit(req, "settings.update", {
    entityType: "Setting",
    summary: `Updated ${Object.keys(data).join(", ")}`,
  });
  res.json({ success: true, message: "Settings saved", settings });
});

// @route GET /api/admin/audit-logs
export const listAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 30, 200);
  const filter = {};
  if (req.query.q) {
    const pattern = searchPattern(req.query.q);
    filter.$or = [{ action: pattern }, { summary: pattern }, { actorName: pattern }];
  }
  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  paginated(res, { items: logs, key: "logs", total, page, limit });
});

// @route GET /api/admin/messages
export const listMessages = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20, 100);
  const filter = {};
  if (["New", "Read", "Replied", "Archived"].includes(req.query.status))
    filter.status = req.query.status;
  const [messages, total, statusCounts] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ContactMessage.countDocuments(filter),
    ContactMessage.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  paginated(res, {
    items: messages,
    key: "messages",
    total,
    page,
    limit,
    extra: { statusCounts: countsByStatus(statusCounts) },
  });
});

// @route PUT /api/admin/messages/:id — body: { status }
export const updateMessage = asyncHandler(async (req, res) => {
  if (!["New", "Read", "Replied", "Archived"].includes(req.body.status))
    throw badRequest("Invalid status");
  const message = await ContactMessage.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true },
  );
  if (!message) throw notFound("Message not found");
  await audit(req, "message.update", {
    entityType: "ContactMessage",
    entityId: message._id,
    summary: `${message.subject} → ${message.status}`,
  });
  res.json({ success: true, message: "Message updated", contactMessage: message });
});

// @route DELETE /api/admin/messages/:id
export const deleteMessage = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findByIdAndDelete(req.params.id);
  if (!message) throw notFound("Message not found");
  await audit(req, "message.delete", {
    entityType: "ContactMessage",
    entityId: message._id,
    summary: `${message.subject} (${message.email})`,
  });
  res.json({ success: true, message: "Message deleted" });
});

// @route POST /api/admin/test-email
export const sendTestEmail = asyncHandler(async (req, res) => {
  const targetEmail = String(req.body?.email || req.user.email)
    .toLowerCase()
    .trim();
  assertEmail(targetEmail);
  await audit(req, "settings.test_email", { entityType: "Setting", summary: targetEmail });
  const subject = "Smart Deal Test Email — Setup Verification";
  const body = `Hello ${req.user.name},\n\nThis is a test notification confirming that your Smart Deal email service is operational.\n\nTime: ${new Date().toUTCString()}`;
  await sendEmail(targetEmail, subject, body);
  res.json({ success: true, message: `Test email dispatched to ${targetEmail}` });
});
