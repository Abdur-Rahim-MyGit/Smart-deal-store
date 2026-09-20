import express from "express";
import { validateCoupon } from "../controllers/couponController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/validate", optionalAuth, validateCoupon);

export default router;
