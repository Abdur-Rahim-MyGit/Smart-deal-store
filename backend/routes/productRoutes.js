import express from "express";
import {
  createProduct,
  createReview,
  deleteProduct,
  getBrands,
  getCategories,
  getFacets,
  getProductBySlug,
  getProductReviews,
  getProducts,
  getRelatedProducts,
  getReviewEligibility,
  lookupProducts,
  updateProduct,
  updateStock,
} from "../controllers/productController.js";
import { getBrandDirectory } from "../controllers/brandController.js";
import { optionalAuth, protect } from "../middleware/authMiddleware.js";
import { adminNeeds, authorize, requireActiveVendor } from "../middleware/roleMiddleware.js";

const router = express.Router();
const catalogManager = [protect, authorize("Vendor", "Admin"), adminNeeds("products")];

// Public catalog (literal paths must come before "/:slug")
router.get("/", getProducts);
router.get("/facets", getFacets);
router.get("/brands", getBrands);
router.get("/brand-directory", getBrandDirectory);
router.get("/lookup", lookupProducts);
router.get("/categories", getCategories);

// Vendors & admins
router.post("/", ...catalogManager, requireActiveVendor, createProduct);
router.put("/:id", ...catalogManager, updateProduct);
router.patch("/:id/stock", ...catalogManager, updateStock);
router.delete("/:id", ...catalogManager, deleteProduct);

// Reviews
router.get("/:id/reviews", getProductReviews);
router.get("/:id/review-eligibility", protect, getReviewEligibility);
router.post("/:id/reviews", protect, authorize("Customer"), createReview);

router.get("/:slug/related", getRelatedProducts);
router.get("/:slug", optionalAuth, getProductBySlug);

export default router;
