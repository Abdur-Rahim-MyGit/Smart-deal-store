import Brand, { brandKey } from "../models/Brand.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import {
  asyncHandler,
  badRequest,
  conflict,
  escapeRegex,
  isObjectId,
  notFound,
  slugify,
} from "../utils/http.js";
import { audit } from "../utils/notify.js";

const isUrl = (value) => /^(https?:\/\/|\/)/.test(String(value));
const exactName = (name) => new RegExp(`^${escapeRegex(String(name).trim())}$`, "i");

function readBrandInput(body, { partial = false } = {}) {
  const data = {};
  if (body.name !== undefined || !partial) {
    data.name = String(body.name ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (data.name.length < 2) throw badRequest("Enter the brand name");
    if (data.name.length > 80) throw badRequest("Brand names can be up to 80 characters");
  }
  if (body.logo !== undefined) {
    data.logo = String(body.logo || "").trim() || undefined;
    if (data.logo && !isUrl(data.logo)) throw badRequest("The logo must be a link or an upload");
  }
  if (body.description !== undefined)
    data.description = String(body.description || "").trim() || undefined;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  return data;
}

async function uniqueSlug(name, exceptId) {
  const base = slugify(name) || "brand";
  let slug = base;
  for (let counter = 2; ; counter += 1) {
    const clash = await Brand.findOne({ slug }).select("_id").lean();
    if (!clash || String(clash._id) === String(exceptId)) return slug;
    slug = `${base}-${counter}`;
  }
}

/**
 * Validates a product's brand against the directory and returns its canonical spelling.
 * Sellers may only use active brands; admins may also use ones that are switched off.
 */
export async function resolveBrand(name, { allowInactive = false } = {}) {
  const brand = await Brand.findOne({ key: brandKey(name) }).lean();
  if (!brand) {
    throw badRequest(
      `"${String(name).trim()}" isn't in the Smart Deal brand directory. Choose a listed brand or contact support to add it.`,
    );
  }
  if (!brand.isActive && !allowInactive)
    throw badRequest(`The brand "${brand.name}" isn't available for new listings right now`);
  return brand.name;
}

// @route GET /api/products/brand-directory — active brands for product forms and filters
export const getBrandDirectory = asyncHandler(async (_req, res) => {
  const brands = await Brand.find({ isActive: true })
    .select("name slug logo")
    .sort({ name: 1 })
    .lean();
  res.json({ success: true, brands });
});

// @route GET /api/admin/brands?q=&status=active|inactive
export const listBrands = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status === "active") filter.isActive = true;
  if (req.query.status === "inactive") filter.isActive = false;
  if (req.query.q) filter.name = new RegExp(escapeRegex(String(req.query.q).trim()), "i");

  const [brands, usage] = await Promise.all([
    Brand.find(filter).sort({ name: 1 }).lean(),
    Product.aggregate([
      {
        $group: {
          _id: { $toLower: "$brand" },
          products: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$status", "Active"] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const counts = new Map(usage.map((row) => [brandKey(row._id), row]));
  res.json({
    success: true,
    brands: brands.map((brand) => ({
      ...brand,
      productCount: counts.get(brand.key)?.products ?? 0,
      activeProductCount: counts.get(brand.key)?.active ?? 0,
    })),
  });
});

// @route POST /api/admin/brands
export const createBrand = asyncHandler(async (req, res) => {
  const data = readBrandInput(req.body);
  if (await Brand.exists({ key: brandKey(data.name) }))
    throw conflict(`"${data.name}" is already in the directory`);
  const brand = await Brand.create({ ...data, slug: await uniqueSlug(data.name) });
  await audit(req, "brand.create", {
    entityType: "Brand",
    entityId: brand._id,
    summary: brand.name,
  });
  res.status(201).json({ success: true, message: "Brand added", brand });
});

// @route PUT /api/admin/brands/:id — renaming updates every product and coupon that uses it
export const updateBrand = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw badRequest("Invalid brand");
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw notFound("Brand not found");
  const data = readBrandInput(req.body, { partial: true });
  const previousName = brand.name;

  const renamed = data.name !== undefined && data.name !== previousName;
  if (renamed) {
    const clash = await Brand.findOne({ key: brandKey(data.name) })
      .select("_id")
      .lean();
    if (clash && String(clash._id) !== String(brand._id))
      throw conflict(`"${data.name}" is already in the directory`);
    brand.slug = await uniqueSlug(data.name, brand._id);
  }
  brand.set(data);
  await brand.save();

  let productsRenamed = 0;
  if (renamed) {
    const result = await Product.updateMany(
      { brand: exactName(previousName) },
      { $set: { brand: brand.name } },
    );
    productsRenamed = result.modifiedCount;
    const coupons = await Coupon.find({ excludedBrands: exactName(previousName) });
    for (const coupon of coupons) {
      coupon.excludedBrands = coupon.excludedBrands.map((name) =>
        brandKey(name) === brandKey(previousName) ? brand.name : name,
      );
      await coupon.save();
    }
  }

  await audit(req, "brand.update", {
    entityType: "Brand",
    entityId: brand._id,
    summary: renamed ? `${previousName} → ${brand.name}` : brand.name,
  });
  res.json({
    success: true,
    message: renamed
      ? `Brand renamed. ${productsRenamed} product(s) updated.`
      : brand.isActive
        ? "Brand saved"
        : "Brand saved. It can't be chosen for new listings while it's inactive.",
    brand,
  });
});

// @route DELETE /api/admin/brands/:id — only brands no product uses
export const deleteBrand = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw badRequest("Invalid brand");
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw notFound("Brand not found");
  const inUse = await Product.countDocuments({ brand: exactName(brand.name) });
  if (inUse) {
    throw badRequest(
      `${inUse} product(s) use ${brand.name}. Switch the brand off instead, or move those products to another brand first.`,
    );
  }
  await brand.deleteOne();
  await audit(req, "brand.delete", {
    entityType: "Brand",
    entityId: brand._id,
    summary: brand.name,
  });
  res.json({ success: true, message: "Brand deleted" });
});

// @route POST /api/admin/brands/sync — adds brands used by products but missing here
export const syncBrands = asyncHandler(async (req, res) => {
  const created = await Brand.syncFromCatalog();
  if (created)
    await audit(req, "brand.sync", { entityType: "Brand", summary: `${created} brand(s) added` });
  res.json({
    success: true,
    message: created
      ? `${created} brand(s) from the catalog added to the directory`
      : "Every brand in the catalog is already in the directory",
  });
});
