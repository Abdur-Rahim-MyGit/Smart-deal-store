import Coupon from "../models/Coupon.js";
import { round2 } from "./http.js";

/** Extra delivery charge for weight above what the emirate's fee includes. */
export function weightSurcharge(rule, totalWeightKg = 0) {
  if (!rule?.extraPerKg) return 0;
  const extraKg = Math.ceil(Math.max(0, totalWeightKg - (rule.includedWeightKg || 0)) - 1e-9);
  return round2(Math.max(0, extraKg) * rule.extraPerKg);
}

/**
 * Delivery options for an emirate. `merchandiseTotal` is the item subtotal after
 * coupon discounts; it decides whether the standard fee is waived. A weight surcharge
 * for heavy orders applies to every option, even when the standard fee is free.
 */
export function buildShippingOptions(settings, emirate, merchandiseTotal, totalWeightKg = 0) {
  const rule =
    settings.shippingMatrix.find((entry) => entry.emirate === emirate) ||
    settings.shippingMatrix[0];
  if (!rule) return [];
  const freeStandard = merchandiseTotal >= rule.freeThreshold;
  const surcharge = weightSurcharge(rule, totalWeightKg);
  return [
    {
      code: "Standard",
      label: "Standard Delivery",
      fee: round2((freeStandard ? 0 : rule.fee) + surcharge),
      baseFee: rule.fee,
      weightSurcharge: surcharge,
      freeThreshold: rule.freeThreshold,
      eta: rule.eta,
      available: true,
    },
    {
      code: "Express",
      label: "Express Delivery",
      fee: round2(settings.expressFee + surcharge),
      baseFee: settings.expressFee,
      weightSurcharge: surcharge,
      eta: settings.expressEta,
      available: true,
    },
    {
      code: "SameDay",
      label: "Same Day Delivery",
      fee: round2(settings.sameDayFee + surcharge),
      baseFee: settings.sameDayFee,
      weightSurcharge: surcharge,
      eta: `Order before ${settings.sameDayCutoff}`,
      available: settings.sameDayEmirates.includes(rule.emirate),
    },
  ];
}

/**
 * Validates a coupon against resolved cart lines ({ price, qty, categoryId, brand }).
 * Returns { valid: false, error } or { valid: true, coupon, discount, freeShipping }.
 */
export async function evaluateCoupon({ code, userId, lines }) {
  const normalized = String(code || "")
    .trim()
    .toUpperCase();
  const fail = (error) => ({ valid: false, code: normalized, error });
  if (!normalized) return fail("Enter a coupon code");

  const coupon = await Coupon.findOne({ code: normalized });
  if (!coupon || !coupon.isActive) return fail("This coupon code is not valid");

  const now = new Date();
  if (now < coupon.startDate) return fail("This coupon is not active yet");
  if (now > coupon.endDate) return fail("This coupon has expired");
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
    return fail("This coupon has reached its usage limit");

  if (userId) {
    const usage = coupon.userUsage.find((record) => String(record.user) === String(userId));
    if (usage && usage.count >= coupon.limitPerUser)
      return fail("You have already used this coupon");
  }

  const subtotal = round2(lines.reduce((sum, line) => sum + line.price * line.qty, 0));
  if (subtotal < coupon.minOrderValue) {
    return fail(
      `Add AED ${round2(coupon.minOrderValue - subtotal).toFixed(2)} more to use this coupon (minimum order AED ${coupon.minOrderValue})`,
    );
  }

  const excludedCategories = new Set(coupon.excludedCategories.map(String));
  const excludedBrands = new Set(coupon.excludedBrands.map((brand) => brand.toLowerCase()));
  const eligibleSubtotal = round2(
    lines
      .filter(
        (line) =>
          !excludedCategories.has(String(line.categoryId)) &&
          !(line.subcategoryId && excludedCategories.has(String(line.subcategoryId))) &&
          !(line.categoryPath ?? []).some((id) => excludedCategories.has(String(id))) &&
          !(coupon.excludeClearance && line.isClearance) &&
          !excludedBrands.has(String(line.brand).toLowerCase()),
      )
      .reduce((sum, line) => sum + line.price * line.qty, 0),
  );

  if (coupon.discountType !== "Free Shipping" && eligibleSubtotal <= 0) {
    return fail("This coupon doesn't apply to the items in your cart");
  }

  let discount = 0;
  if (coupon.discountType === "Percentage") {
    discount = (eligibleSubtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  } else if (coupon.discountType === "Fixed") {
    discount = Math.min(coupon.discountValue, eligibleSubtotal);
  }

  return {
    valid: true,
    coupon,
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    discount: round2(discount),
    freeShipping: coupon.discountType === "Free Shipping",
  };
}

export function publicCoupon(result) {
  if (!result) return null;
  if (!result.valid) return { code: result.code, error: result.error };
  return {
    code: result.code,
    description: result.description,
    discountType: result.discountType,
    discount: result.discount,
    freeShipping: result.freeShipping,
  };
}

/** Server-authoritative order totals. VAT applies to items − discount + shipping + COD fee. */
export function computeTotals({
  lines,
  settings,
  emirate,
  shippingMethod,
  paymentMethod,
  couponResult,
}) {
  const subtotal = round2(lines.reduce((sum, line) => sum + line.price * line.qty, 0));
  const discount = couponResult?.valid ? Math.min(couponResult.discount, subtotal) : 0;
  const merchandise = round2(subtotal - discount);

  const totalWeightKg = lines.reduce((sum, line) => sum + (line.weightKg || 0) * line.qty, 0);
  const shippingOptions = buildShippingOptions(settings, emirate, merchandise, totalWeightKg);
  const selected =
    shippingOptions.find((option) => option.code === shippingMethod && option.available) ||
    shippingOptions[0];
  const freeShippingApplied = Boolean(couponResult?.valid && couponResult.freeShipping);
  const shippingFee = freeShippingApplied ? 0 : (selected?.fee ?? 0);
  const codFee = paymentMethod === "COD" ? settings.codFee : 0;

  const taxableSubtotal = round2(merchandise + shippingFee + codFee);
  const vatRate = settings.vatEnabled ? settings.vatPercent : 0;
  const vat = round2((taxableSubtotal * vatRate) / 100);
  const total = round2(taxableSubtotal + vat);
  const savings = round2(
    lines.reduce(
      (sum, line) => sum + Math.max(0, (line.mrp || line.price) - line.price) * line.qty,
      0,
    ),
  );

  return {
    subtotal,
    discount,
    shippingFee,
    codFee,
    taxableSubtotal,
    vatRate,
    vat,
    total,
    savings,
    freeShippingApplied,
    totalWeightKg: Math.round(totalWeightKg * 1000) / 1000,
    shippingOptions,
    shippingMethod: selected
      ? { code: selected.code, label: selected.label, eta: selected.eta }
      : null,
  };
}
