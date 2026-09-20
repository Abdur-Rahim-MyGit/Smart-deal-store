import Setting from "../models/Setting.js";
import Banner from "../models/Banner.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import Page from "../models/Page.js";
import Subscriber from "../models/Subscriber.js";
import ContactMessage from "../models/ContactMessage.js";
import Order from "../models/Order.js";
import { asyncHandler, badRequest, notFound, pick, publicName } from "../utils/http.js";
import { assertEmail } from "../utils/validation.js";
import { LISTING_FIELDS, liveFlashDealFilter, toListing } from "../utils/catalog.js";
import { notifyAdmins } from "../services/orderService.js";

const PUBLIC_SETTING_FIELDS = [
  "storeName",
  "tagline",
  "supportEmail",
  "supportPhone",
  "address",
  "trn",
  "announcement",
  "vatEnabled",
  "vatPercent",
  "pricesIncludeVat",
  "codEnabled",
  "codFee",
  "walletEnabled",
  "shippingMatrix",
  "expressFee",
  "expressEta",
  "sameDayFee",
  "sameDayEmirates",
  "sameDayCutoff",
  "returnWindowDays",
  "social",
];

// @route GET /api/public/settings
export const getPublicSettings = asyncHandler(async (_req, res) => {
  const settings = await Setting.getSingleton();
  const cardTestMode = process.env.PAYMENT_MODE === "test";
  res.json({
    success: true,
    settings: {
      ...pick(settings.toObject(), PUBLIC_SETTING_FIELDS),
      cardEnabled: settings.cardEnabled && cardTestMode,
      cardTestMode,
      googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    },
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_ARRIVAL_DAYS = 14;
const BEST_SELLER_DAYS = 30;
const BANNER_POSITIONS = ["Hero Carousel", "Promo Grid", "Sidebar", "Flash Sale Banner"];

/** Banners that are switched on and inside their schedule right now, in display order. */
const liveBanners = (positions, now = new Date()) =>
  Banner.find({
    isActive: true,
    position: { $in: positions },
    $and: [
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
    ],
  })
    .sort({ order: 1, createdAt: -1 })
    .lean();

// @route GET /api/public/banners?position=Sidebar — one slot, for pages outside the home page
export const getBanners = asyncHandler(async (req, res) => {
  const position = String(req.query.position || "");
  if (!BANNER_POSITIONS.includes(position)) throw badRequest("Unknown banner position");
  res.json({ success: true, banners: (await liveBanners([position])).slice(0, 6) });
});

/** Pinned products first, then the automatic ones, without duplicates. */
const mergeListings = (first, second, limit = 12) => {
  const seen = new Set();
  return [...first, ...second]
    .filter((product) => {
      const id = String(product._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, limit);
};

// @route GET /api/public/home — everything the storefront home page needs in one request
export const getHome = asyncHandler(async (_req, res) => {
  const now = new Date();
  const listing = (filter, sort, limit = 12) =>
    Product.find({ status: "Active", ...filter })
      .select(LISTING_FIELDS)
      .sort(sort)
      .limit(limit)
      .populate("category", "name slug")
      .populate("vendor", "name vendorDetails.businessName")
      .lean()
      .then((items) => items.map(toListing));

  // Ranked by units sold in the rolling window, not all-time totals.
  const bestSellersSince = async (since, limit = 12) => {
    const ranked = await Order.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $nin: ["Cancelled", "Refunded"] } } },
      { $unwind: "$items" },
      { $match: { "items.status": { $nin: ["Cancelled", "Returned"] } } },
      { $group: { _id: "$items.product", units: { $sum: "$items.qty" } } },
      { $sort: { units: -1, _id: 1 } },
      { $limit: limit * 2 },
    ]);
    const products = await listing({ _id: { $in: ranked.map((row) => row._id) } }, {}, limit * 2);
    const byId = new Map(products.map((product) => [String(product._id), product]));
    return ranked
      .map((row) => byId.get(String(row._id)))
      .filter(Boolean)
      .slice(0, limit);
  };

  const [
    banners,
    categories,
    categoryCounts,
    flashDeals,
    featured,
    bestSellers,
    topRated,
    newArrivals,
    deals,
    trending,
    reviews,
    brands,
  ] = await Promise.all([
    liveBanners(["Hero Carousel", "Promo Grid", "Flash Sale Banner"], now),
    Category.find({ isActive: true, parentCategory: null }).sort({ sortOrder: 1, name: 1 }).lean(),
    Product.aggregate([
      { $match: { status: "Active" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
    listing(liveFlashDealFilter(now), { discountPercent: -1 }),
    listing({ isFeatured: true }, { soldCount: -1 }),
    // Admin pins first, then the rolling 30-day ranking.
    Promise.all([
      listing({ isBestSeller: true }, { soldCount: -1 }),
      bestSellersSince(new Date(now.getTime() - BEST_SELLER_DAYS * DAY_MS)),
    ]).then(([pinned, ranked]) => mergeListings(pinned, ranked)),
    listing({ "rating.count": { $gte: 1 } }, { "rating.average": -1, "rating.count": -1 }),
    Promise.all([
      listing({ isNewArrival: true }, { createdAt: -1 }),
      listing(
        { createdAt: { $gte: new Date(now.getTime() - NEW_ARRIVAL_DAYS * DAY_MS) } },
        { createdAt: -1 },
      ),
    ]).then(([pinned, recent]) => mergeListings(pinned, recent)),
    listing({ discountPercent: { $gte: 25 } }, { discountPercent: -1 }),
    listing({ tags: "trending" }, { soldCount: -1 }),
    Review.find({ status: "Approved", rating: { $gte: 4 } })
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("user", "name")
      .populate("product", "title slug thumbnail")
      .lean(),
    Product.aggregate([
      { $match: { status: "Active" } },
      { $group: { _id: "$brand", count: { $sum: 1 }, image: { $first: "$thumbnail" } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 12 },
    ]),
  ]);

  const counts = new Map(categoryCounts.map((row) => [String(row._id), row.count]));
  const flashEndsAt =
    flashDeals
      .map((product) => product.flashDealEndsAt)
      .filter(Boolean)
      .sort((a, b) => new Date(a) - new Date(b))[0] || null;

  res.json({
    success: true,
    home: {
      banners: banners.filter((banner) => banner.position === "Hero Carousel"),
      promoBanners: banners.filter((banner) => banner.position === "Promo Grid").slice(0, 6),
      flashBanner: banners.find((banner) => banner.position === "Flash Sale Banner") ?? null,
      categories: categories.map((category) => ({
        ...category,
        productCount: counts.get(String(category._id)) || 0,
      })),
      flashDeals,
      flashEndsAt,
      featured,
      bestSellers,
      topRated,
      newArrivals,
      deals,
      trending,
      reviews: reviews
        .filter((review) => review.product)
        .map((review) => ({
          _id: review._id,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          createdAt: review.createdAt,
          author: publicName(review.user?.name),
          product: review.product,
        })),
      brands: brands.map((brand) => ({ name: brand._id, count: brand.count, image: brand.image })),
    },
  });
});

// @route GET /api/public/pages
export const getPublishedPages = asyncHandler(async (_req, res) => {
  const pages = await Page.find({ isPublished: true })
    .select("slug title titleAr summary footerGroup sortOrder")
    .sort({ sortOrder: 1, title: 1 })
    .lean();
  res.json({ success: true, pages });
});

// @route GET /api/public/pages/:slug
export const getPageBySlug = asyncHandler(async (req, res) => {
  const page = await Page.findOne({
    slug: String(req.params.slug).toLowerCase(),
    isPublished: true,
  }).lean();
  if (!page) throw notFound("Page not found");
  res.json({ success: true, page });
});

// @route POST /api/public/newsletter — body: { email }
export const subscribeNewsletter = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "")
    .toLowerCase()
    .trim();
  assertEmail(email);
  await Subscriber.updateOne(
    { email },
    {
      $set: { isActive: true },
      $setOnInsert: { email, source: String(req.body.source || "footer").slice(0, 30) },
    },
    { upsert: true },
  );
  res.json({
    success: true,
    message: "You're subscribed! Deal drops will land in your inbox every Thursday.",
  });
});

// @route POST /api/public/contact
export const submitContact = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "")
    .toLowerCase()
    .trim();
  const subject = String(req.body.subject || "").trim();
  const message = String(req.body.message || "").trim();

  if (name.length < 2) throw badRequest("Please enter your name");
  assertEmail(email);
  if (subject.length < 3) throw badRequest("Please add a subject");
  if (message.length < 10) throw badRequest("Please write a little more so we can help");

  const contact = await ContactMessage.create({
    name,
    email,
    phone: req.body.phone ? String(req.body.phone).trim().slice(0, 20) : undefined,
    subject: subject.slice(0, 150),
    message: message.slice(0, 4000),
  });

  await notifyAdmins("support", {
    type: "support",
    title: "New contact message",
    message: `${name}: ${subject}`,
    link: "/admin-dashboard?tab=messages",
  });

  res.status(201).json({
    success: true,
    message: "Thanks for reaching out! We'll reply within one business day.",
    id: contact._id,
  });
});
