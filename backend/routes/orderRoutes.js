import express from "express";
import {
  cancelMyOrder,
  createOrder,
  getMyOrders,
  getOrderById,
  getQuote,
  requestReturn,
} from "../controllers/orderController.js";
import { createPaymentIntent, handleStripeWebhook } from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/http.js";

const router = express.Router();

// Public webhook endpoint for Stripe
router.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  asyncHandler(handleStripeWebhook),
);

// Protected user order routes
router.use(protect);

router.post("/quote", getQuote);
router.post("/create-payment-intent", asyncHandler(createPaymentIntent));
router.post("/", createOrder);
router.get("/my", getMyOrders);
router.get("/:id", getOrderById);
router.post("/:id/cancel", cancelMyOrder);
router.post("/:id/return", requestReturn);

export default router;
