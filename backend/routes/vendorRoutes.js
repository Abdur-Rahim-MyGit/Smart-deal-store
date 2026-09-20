import express from "express";
import {
  getVendorDashboard,
  getVendorOrders,
  getVendorPayouts,
  getVendorProducts,
  getVendorReviews,
  replyToReview,
  requestPayout,
  updateItemStatus,
  updateVendorProfile,
} from "../controllers/vendorController.js";
import {
  downloadOwnDocument,
  receiveDocument,
  uploadDocument,
} from "../controllers/vendorDocumentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize, requireActiveVendor } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Pending vendors can still open their dashboard and edit their store profile.
router.use(protect, authorize("Vendor"));

router.get("/dashboard", getVendorDashboard);
router.get("/products", getVendorProducts);
router.get("/orders", getVendorOrders);
router.put("/orders/:orderId/items/:itemId/status", requireActiveVendor, updateItemStatus);
router.get("/payouts", getVendorPayouts);
router.post("/payouts", requireActiveVendor, requestPayout);
router.get("/reviews", getVendorReviews);
router.put("/reviews/:id/reply", requireActiveVendor, replyToReview);
router.put("/profile", updateVendorProfile);
// Pending sellers upload their licence here so their application can be approved.
router.post("/documents/:type", receiveDocument, uploadDocument);
router.get("/documents/:type", downloadOwnDocument);

export default router;
