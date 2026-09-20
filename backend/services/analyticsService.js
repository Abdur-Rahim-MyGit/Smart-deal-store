import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { round2 } from "../utils/http.js";

const HOUR_MS = 60 * 60 * 1000;
const toObjectIds = (ids) => ids.map((id) => new mongoose.Types.ObjectId(String(id)));

/**
 * Seller performance for the given sellers: sales, order count, rating, cancellation and
 * return rates, and how long they take to ship (order placed → item shipped).
 * `since` limits the order-based metrics to recent orders; ratings are lifetime.
 */
export async function vendorPerformance(vendorIds, { since } = {}) {
  if (!vendorIds.length) return new Map();
  const ids = toObjectIds(vendorIds);
  const match = { "items.vendor": { $in: ids } };
  if (since) match.createdAt = { $gte: since };
  const shippedAt = { $ifNull: ["$items.shippedAt", "$shippingDetails.shippedAt"] };

  const [orderRows, ratingRows] = await Promise.all([
    Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      { $match: { "items.vendor": { $in: ids } } },
      {
        $group: {
          _id: "$items.vendor",
          orders: { $addToSet: "$_id" },
          lines: { $sum: 1 },
          cancelled: { $sum: { $cond: [{ $eq: ["$items.status", "Cancelled"] }, 1, 0] } },
          returned: { $sum: { $cond: [{ $eq: ["$items.status", "Returned"] }, 1, 0] } },
          delivered: {
            $sum: { $cond: [{ $in: ["$items.status", ["Delivered", "Returned"]] }, 1, 0] },
          },
          sales: {
            $sum: {
              $cond: [
                { $in: ["$items.status", ["Cancelled", "Returned"]] },
                0,
                { $multiply: ["$items.price", "$items.qty"] },
              ],
            },
          },
          shipMs: {
            $sum: {
              $cond: [{ $ne: [shippedAt, null] }, { $subtract: [shippedAt, "$createdAt"] }, 0],
            },
          },
          shippedLines: { $sum: { $cond: [{ $ne: [shippedAt, null] }, 1, 0] } },
        },
      },
    ]),
    Product.aggregate([
      { $match: { vendor: { $in: ids }, "rating.count": { $gt: 0 } } },
      {
        $group: {
          _id: "$vendor",
          weighted: { $sum: { $multiply: ["$rating.average", "$rating.count"] } },
          count: { $sum: "$rating.count" },
        },
      },
    ]),
  ]);

  const ratings = new Map(ratingRows.map((row) => [String(row._id), row]));
  const result = new Map();
  for (const id of vendorIds.map(String)) {
    const row = orderRows.find((entry) => String(entry._id) === id);
    const rating = ratings.get(id);
    result.set(id, {
      sales: round2(row?.sales ?? 0),
      orders: row?.orders.length ?? 0,
      rating: rating ? Math.round((rating.weighted / rating.count) * 10) / 10 : null,
      reviewCount: rating?.count ?? 0,
      cancellationRate: row?.lines ? round2((row.cancelled / row.lines) * 100) : null,
      returnRate: row?.delivered ? round2((row.returned / row.delivered) * 100) : null,
      avgShipHours: row?.shippedLines ? round2(row.shipMs / row.shippedLines / HOUR_MS) : null,
    });
  }
  return result;
}

/** Best-selling sellers in a period, with their performance metrics. */
export async function topVendors({ since, limit = 8 }) {
  const rows = await Order.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $unwind: "$items" },
    { $match: { "items.status": { $nin: ["Cancelled", "Returned"] } } },
    {
      $group: {
        _id: "$items.vendor",
        sales: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
      },
    },
    { $sort: { sales: -1 } },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "vendor" } },
    { $unwind: "$vendor" },
    { $match: { "vendor.role": "Vendor" } }, // Platform-owned stock isn't a seller
    { $limit: limit },
    {
      $project: {
        sales: 1,
        "vendor.name": 1,
        "vendor.vendorDetails.businessName": 1,
      },
    },
  ]);
  const performance = await vendorPerformance(
    rows.map((row) => row._id),
    { since },
  );
  return rows.map((row) => ({
    _id: row._id,
    name: row.vendor.vendorDetails?.businessName || row.vendor.name,
    ...performance.get(String(row._id)),
  }));
}
