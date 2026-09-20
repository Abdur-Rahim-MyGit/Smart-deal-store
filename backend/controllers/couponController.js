import Cart from "../models/Cart.js";
import { asyncHandler, badRequest } from "../utils/http.js";
import { resolveLines } from "../utils/catalog.js";
import { evaluateCoupon, publicCoupon } from "../utils/pricing.js";

// @route POST /api/coupons/validate — body: { code, items? } (items only for guests)
export const validateCoupon = asyncHandler(async (req, res) => {
  const code = String(req.body.code || "").trim();
  if (!code) throw badRequest("Enter a coupon code");

  let lines;
  if (req.user) {
    const cart = await Cart.findOne({ user: req.user._id });
    lines = cart ? await resolveLines(cart.items) : [];
  } else {
    lines = await resolveLines(
      (Array.isArray(req.body.items) ? req.body.items : []).slice(0, 50).map((line) => ({
        product: line.productId,
        variantSku: line.variantSku,
        qty: line.qty,
      })),
    );
  }

  const purchasable = lines.filter((line) => line.isAvailable);
  if (!purchasable.length) throw badRequest("Add items to your cart before applying a coupon");

  const result = await evaluateCoupon({ code, userId: req.user?._id, lines: purchasable });
  if (!result.valid) throw badRequest(result.error);

  res.json({
    success: true,
    message: `Coupon ${result.code} applied`,
    coupon: publicCoupon(result),
  });
});
