import Stripe from "stripe";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Setting from "../models/Setting.js";
import { resolveLines } from "../utils/catalog.js";
import { computeTotals, evaluateCoupon } from "../utils/pricing.js";
import { badRequest } from "../utils/http.js";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export async function createPaymentIntent(req, res) {
  const { addressId, emirate, couponCode, shippingMethod } = req.body;

  // Resolve user cart and totals
  const [settings, cart] = await Promise.all([
    Setting.getSingleton(),
    Cart.findOne({ user: req.user._id }),
  ]);

  if (!cart || !cart.items.length) {
    throw badRequest("Your cart is empty");
  }

  const lines = await resolveLines(cart.items);
  const purchasable = lines.filter((line) => line.isAvailable);
  if (!purchasable.length) {
    throw badRequest("None of the items in your cart are currently available");
  }

  const couponResult = couponCode
    ? await evaluateCoupon({ code: couponCode, userId: req.user._id, lines: purchasable })
    : null;

  const totals = computeTotals({
    lines: purchasable,
    settings,
    emirate: emirate || "Dubai",
    shippingMethod,
    paymentMethod: "Card",
    couponResult,
  });

  const amountFils = Math.round(totals.total * 100);

  // If live Stripe is configured, create real PaymentIntent
  if (stripe) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountFils,
        currency: "aed",
        automatic_payment_methods: { enabled: true },
        metadata: {
          userId: String(req.user._id),
          emirate: emirate || "Dubai",
          shippingMethod: shippingMethod || "standard",
          couponCode: couponCode || "",
          orderTotal: String(totals.total),
        },
      });

      return res.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: totals.total,
        currency: "AED",
        isSimulated: false,
      });
    } catch (err) {
      console.error("[Stripe] Failed to create payment intent:", err.message);
      throw badRequest(`Payment gateway error: ${err.message}`);
    }
  }

  // Graceful test mode simulation when keys are not provided
  return res.json({
    success: true,
    clientSecret: `simulated_secret_${Date.now()}`,
    paymentIntentId: `pi_test_${Date.now()}`,
    amount: totals.total,
    currency: "AED",
    isSimulated: true,
    message: "Stripe test mode simulation active (no STRIPE_SECRET_KEY set)",
  });
}

export async function handleStripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  if (stripe && webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, webhookSecret);
    } catch (err) {
      console.error("[Stripe:webhook] Signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    event = req.body;
  }

  // Process the event
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    console.log(
      `[Stripe:webhook] PaymentIntent ${paymentIntent.id} succeeded for ${paymentIntent.amount} fils`,
    );
    // Find matching order if already created and mark paid
    const orderId = paymentIntent.metadata?.orderId;
    if (orderId) {
      await Order.findOneAndUpdate(
        { orderId },
        {
          "paymentDetails.isPaid": true,
          "paymentDetails.paidAt": new Date(),
          "paymentDetails.transactionId": paymentIntent.id,
        },
      );
    }
  }

  res.json({ received: true });
}
