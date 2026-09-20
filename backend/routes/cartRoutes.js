import express from "express";
import {
  addItem,
  clearCart,
  getCart,
  getWishlist,
  mergeCart,
  mergeWishlist,
  moveToCart,
  previewCart,
  removeItem,
  removeSaved,
  saveForLater,
  toggleWishlist,
  updateItem,
} from "../controllers/cartController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Guests price their browser cart through this endpoint
router.post("/preview", previewCart);

router.use(protect);

router.get("/", getCart);
router.delete("/", clearCart);
router.post("/items", addItem);
router.patch("/items", updateItem);
router.delete("/items", removeItem);
router.post("/merge", mergeCart);

router.post("/saved", saveForLater);
router.post("/saved/move-to-cart", moveToCart);
router.delete("/saved", removeSaved);

router.get("/wishlist", getWishlist);
router.post("/wishlist/toggle", toggleWishlist);
router.post("/wishlist/merge", mergeWishlist);

export default router;
