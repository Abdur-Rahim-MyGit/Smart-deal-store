import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Payout from "../models/Payout.js";
import Review from "../models/Review.js";
import Setting from "../models/Setting.js";
import {
  asyncHandler,
  badRequest,
  escapeRegex,
  notFound,
  paginated,
  parsePagination,
  pick,
  publicName,
  round2,
} from "../utils/http.js";
import { assertPhone, normalizePhone } from "../utils/validation.js";
import { notify } from "../utils/notify.js";
import {
  computeVendorBalances,
  notifyAdmins,
  syncOrderWithItems,
} from "../services/orderService.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const EXCLUDED = ["Cancelled", "Returned", "Refunded"];
const VENDOR_FLOW = ["Placed", "Confirmed", "Processing", "Shipped"];

const lastDays = (days) =>
  Array.from({ length: days }, (_, index) =>
    new Date(Date.now() - (days - 1 - index) * DAY_MS).toLocaleDateString("en-CA", {
      timeZone: "Asia/Dubai",
    }),
  );

const countsByStatus = (rows) => Object.fromEntries(rows.map((row) => [row._id, row.count]));

// @route GET /api/vendors/dashboard
export const getVendorDashboard = asyncHandler(async (req, res) => {
  const vendorId = req.user._id;
  const settings = await Setting.getSingleton();
  const since = new Date(Date.now() - 30 * DAY_MS);
  const myItems = [
    { $unwind: "$items" },
    { $match: { "items.vendor": vendorId, "items.status": { $nin: ["Cancelled", "Returned"] } } },
  ];

  const [
    balances,
    productStatus,
    lowStock,
    totals,
    salesByDayRaw,
    topProducts,
    pendingFulfilment,
    ratingSummary,
    recentOrders,
  ] = await Promise.all([
    computeVendorBalances(vendorId, settings),
    Product.aggregate([
      { $match: { vendor: vendorId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Product.aggregate([
      { $match: { vendor: vendorId, status: { $in: ["Active", "Pending Approval"] } } },
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
      { $limit: 8 },
    ]),
    Order.aggregate([
      { $match: { "items.vendor": vendorId, status: { $nin: EXCLUDED } } },
      ...myItems,
      {
        $group: {
          _id: null,
          grossSales: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
          commission: { $sum: "$items.commission" },
          netEarnings: { $sum: "$items.vendorEarning" },
          unitsSold: { $sum: "$items.qty" },
          orders: { $addToSet: "$_id" },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          "items.vendor": vendorId,
          status: { $nin: EXCLUDED },
          createdAt: { $gte: since },
        },
      },
      ...myItems,
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Dubai" },
          },
          revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
          orders: { $addToSet: "$_id" },
        },
      },
    ]),
    Order.aggregate([
      { $match: { "items.vendor": vendorId, status: { $nin: EXCLUDED } } },
      ...myItems,
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
    Order.countDocuments({
      status: { $nin: EXCLUDED },
      items: {
        $elemMatch: { vendor: vendorId, status: { $in: ["Placed", "Confirmed", "Processing"] } },
      },
    }),
    Product.aggregate([
      { $match: { vendor: vendorId, "rating.count": { $gt: 0 } } },
      {
        $group: {
          _id: null,
          weighted: { $sum: { $multiply: ["$rating.average", "$rating.count"] } },
          count: { $sum: "$rating.count" },
        },
      },
    ]),
    Order.find({ "items.vendor": vendorId })
      .sort({ createdAt: -1 })
      .limit(6)
      .select("orderId status createdAt items shippingAddress.emirate shippingAddress.receiverName")
      .lean(),
  ]);

  const byDay = new Map(salesByDayRaw.map((entry) => [entry._id, entry]));
  const summary = totals[0] || {};
  const productCounts = countsByStatus(productStatus);
  const rating = ratingSummary[0];

  res.json({
    success: true,
    vendorStatus: req.user.vendorDetails?.status,
    stats: {
      products: productCounts,
      productCount: Object.values(productCounts).reduce((sum, value) => sum + value, 0),
      grossSales: round2(summary.grossSales || 0),
      commission: round2(summary.commission || 0),
      netEarnings: round2(summary.netEarnings || 0),
      unitsSold: summary.unitsSold || 0,
      orderCount: summary.orders?.length || 0,
      pendingFulfilment,
      rating: rating ? Math.round((rating.weighted / rating.count) * 10) / 10 : 0,
      reviewCount: rating?.count || 0,
      ...balances,
    },
    salesByDay: lastDays(30).map((date) => ({
      date,
      revenue: round2(byDay.get(date)?.revenue || 0),
      orders: byDay.get(date)?.orders.length || 0,
    })),
    topProducts,
    lowStock,
    recentOrders: recentOrders.map((order) => {
      const mine = order.items.filter((item) => String(item.vendor) === String(vendorId));
      return {
        _id: order._id,
        orderId: order.orderId,
        status: order.status,
        createdAt: order.createdAt,
        emirate: order.shippingAddress?.emirate,
        customer: order.shippingAddress?.receiverName,
        itemCount: mine.reduce((sum, item) => sum + item.qty, 0),
        total: round2(mine.reduce((sum, item) => sum + item.price * item.qty, 0)),
      };
    }),
  });
});

// @route GET /api/vendors/products
export const getVendorProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20, 100);
  const filter = { vendor: req.user._id };
  if (req.query.status) filter.status = String(req.query.status);
  if (req.query.q) {
    const pattern = new RegExp(escapeRegex(String(req.query.q).trim()), "i");
    filter.$or = [{ title: pattern }, { brand: pattern }, { "variants.sku": pattern }];
  }
  if (req.query.lowStock === "true") {
    filter.$expr = {
      $anyElementTrue: {
        $map: { input: "$variants", as: "v", in: { $lte: ["$$v.stock", "$$v.lowStockThreshold"] } },
      },
    };
  }

  const [products, total, statusCounts] = await Promise.all([
    Product.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("category", "name slug")
      .lean(),
    Product.countDocuments(filter),
    Product.aggregate([
      { $match: { vendor: req.user._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
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

// @route GET /api/vendors/orders?view=to-fulfil|shipped|delivered|cancelled
export const getVendorOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 15, 50);
  const vendorId = req.user._id;
  const filter = { "items.vendor": vendorId };

  if (req.query.view === "to-fulfil") {
    filter.status = { $nin: [...EXCLUDED, "Delivered", "Return Requested"] };
    filter.items = {
      $elemMatch: { vendor: vendorId, status: { $in: ["Placed", "Confirmed", "Processing"] } },
    };
  } else if (req.query.view === "shipped") {
    filter.status = { $in: ["Shipped", "Out for Delivery"] };
  } else if (req.query.view === "delivered") {
    filter.status = "Delivered";
  } else if (req.query.view === "cancelled") {
    filter.status = { $in: [...EXCLUDED, "Return Requested"] };
  }
  if (req.query.q) filter.orderId = new RegExp(escapeRegex(String(req.query.q).trim()), "i");

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "orderId status createdAt items shippingAddress shippingMethod deliveryInstructions paymentDetails.method paymentDetails.status shippingDetails",
      )
      .lean(),
    Order.countDocuments(filter),
  ]);

  paginated(res, {
    items: orders.map((order) => {
      const mine = order.items.filter((item) => String(item.vendor) === String(vendorId));
      return {
        ...order,
        items: mine,
        vendorTotal: round2(mine.reduce((sum, item) => sum + item.price * item.qty, 0)),
        vendorEarning: round2(mine.reduce((sum, item) => sum + (item.vendorEarning || 0), 0)),
      };
    }),
    key: "orders",
    total,
    page,
    limit,
  });
});

// @route PUT /api/vendors/orders/:orderId/items/:itemId/status — body: { status, carrier, trackingNumber }
export const updateItemStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["Confirmed", "Processing", "Shipped"].includes(status)) {
    throw badRequest("Status must be Confirmed, Processing or Shipped");
  }

  const order = await Order.findById(req.params.orderId);
  if (!order) throw notFound("Order not found");
  const item = order.items.id(req.params.itemId);
  if (!item || String(item.vendor) !== String(req.user._id)) throw notFound("Order item not found");

  if ([...EXCLUDED, "Delivered", "Return Requested"].includes(order.status)) {
    throw badRequest(`This order is ${order.status.toLowerCase()} and can't be updated`);
  }

  const current = VENDOR_FLOW.indexOf(item.status);
  const next = VENDOR_FLOW.indexOf(status);
  if (current === -1)
    throw badRequest(`This item is ${item.status.toLowerCase()} and can't be updated`);
  if (next !== current + 1) {
    throw badRequest(
      `This item is "${item.status}" — the next step is "${VENDOR_FLOW[current + 1] || "delivery"}"`,
    );
  }

  if (status === "Shipped") {
    const carrier = String(req.body.carrier || "").trim();
    if (!carrier) throw badRequest("Enter the courier name");
    item.carrier = carrier;
    item.trackingNumber = req.body.trackingNumber
      ? String(req.body.trackingNumber).trim()
      : undefined;
    item.shippedAt = new Date();
  }
  item.status = status;

  await syncOrderWithItems(order, { carrier: item.carrier, trackingNumber: item.trackingNumber });
  await order.save();

  res.json({ success: true, message: `Item marked as ${status}`, orderStatus: order.status, item });
});

// @route GET /api/vendors/payouts
export const getVendorPayouts = asyncHandler(async (req, res) => {
  const settings = await Setting.getSingleton();
  const [payouts, balances] = await Promise.all([
    Payout.find({ vendor: req.user._id }).sort({ createdAt: -1 }).limit(100).lean(),
    computeVendorBalances(req.user._id, settings),
  ]);
  res.json({
    success: true,
    payouts,
    balances,
    bankAccount: req.user.vendorDetails?.bankAccount || {},
  });
});

// @route POST /api/vendors/payouts — body: { amount }
export const requestPayout = asyncHandler(async (req, res) => {
  const settings = await Setting.getSingleton();
  const amount = round2(Number(req.body.amount));
  if (!Number.isFinite(amount) || amount <= 0) throw badRequest("Enter a valid amount");
  if (amount < settings.minPayout)
    throw badRequest(`The minimum payout is AED ${settings.minPayout}`);

  const bank = req.user.vendorDetails?.bankAccount;
  if (!bank?.iban || !bank?.bankName) {
    throw badRequest("Add your bank name and IBAN in Store settings before requesting a payout");
  }
  if (await Payout.exists({ vendor: req.user._id, status: { $in: ["Requested", "Processing"] } })) {
    throw badRequest("You already have a payout in progress");
  }

  const balances = await computeVendorBalances(req.user._id, settings);
  if (amount > balances.availableBalance) {
    throw badRequest(
      `You can withdraw up to AED ${Math.max(0, balances.availableBalance).toFixed(2)}`,
    );
  }

  const payout = await Payout.create({
    vendor: req.user._id,
    amount,
    bankSnapshot: pick(bank, ["bankName", "accountName", "accountNumber", "iban"]),
  });

  await notifyAdmins("finance", {
    type: "payout",
    title: "Payout requested",
    message: `${req.user.vendorDetails?.businessName || req.user.name} requested AED ${amount.toFixed(2)}.`,
    link: "/admin-dashboard?tab=payouts",
  });

  res.status(201).json({
    success: true,
    message: "Payout requested. Transfers usually complete within 2–3 business days.",
    payout,
  });
});

// @route GET /api/vendors/reviews
export const getVendorReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 15, 50);
  const productIds = await Product.find({ vendor: req.user._id }).distinct("_id");
  const filter = { product: { $in: productIds }, status: "Approved" };
  if (req.query.unanswered === "true") filter["vendorResponse.comment"] = { $in: [null, ""] };

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("product", "title slug thumbnail")
      .populate("user", "name")
      .lean(),
    Review.countDocuments(filter),
  ]);

  paginated(res, {
    items: reviews.map(({ user, ...review }) => ({ ...review, author: publicName(user?.name) })),
    key: "reviews",
    total,
    page,
    limit,
  });
});

// @route PUT /api/vendors/reviews/:id/reply — body: { comment }
export const replyToReview = asyncHandler(async (req, res) => {
  const comment = String(req.body.comment || "").trim();
  if (comment.length < 2) throw badRequest("Write a reply first");

  const review = await Review.findById(req.params.id).populate("product", "vendor title slug");
  if (!review || String(review.product?.vendor) !== String(req.user._id))
    throw notFound("Review not found");

  review.vendorResponse = { comment: comment.slice(0, 1000), respondedAt: new Date() };
  await review.save();

  await notify(review.user, {
    type: "review",
    title: "The seller replied to your review",
    message: `${req.user.vendorDetails?.businessName || "The seller"} replied to your review of ${review.product.title}.`,
    link: `/product/${review.product.slug}`,
  });

  res.json({ success: true, message: "Reply posted", review });
});

// @route PUT /api/vendors/profile — store details and payout bank account
export const updateVendorProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  const details = req.body.vendorDetails || req.body;

  if (details.businessName !== undefined) {
    const businessName = String(details.businessName).trim();
    if (businessName.length < 2) throw badRequest("Business name is required");
    user.set("vendorDetails.businessName", businessName);
  }
  for (const key of ["corporateAddress", "vatNumber", "storeDescription", "supportEmail"]) {
    if (details[key] !== undefined) user.set(`vendorDetails.${key}`, String(details[key]).trim());
  }
  if (details.supportPhone !== undefined) {
    if (details.supportPhone) {
      const phone = normalizePhone(details.supportPhone);
      assertPhone(phone);
      user.set("vendorDetails.supportPhone", phone);
    } else {
      user.set("vendorDetails.supportPhone", undefined);
    }
  }

  if (details.bankAccount && typeof details.bankAccount === "object") {
    for (const key of ["bankName", "accountName", "accountNumber"]) {
      if (details.bankAccount[key] !== undefined) {
        user.set(`vendorDetails.bankAccount.${key}`, String(details.bankAccount[key]).trim());
      }
    }
    if (details.bankAccount.iban !== undefined) {
      const iban = String(details.bankAccount.iban).replace(/\s+/g, "").toUpperCase();
      if (iban && !/^AE\d{21}$/.test(iban))
        throw badRequest("UAE IBANs start with AE followed by 21 digits");
      user.set("vendorDetails.bankAccount.iban", iban);
    }
  }

  await user.save();
  res.json({ success: true, message: "Store settings saved", user });
});
