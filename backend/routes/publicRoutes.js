import express from "express";
import {
  getBanners,
  getHome,
  getPageBySlug,
  getPublicSettings,
  getPublishedPages,
  submitContact,
  subscribeNewsletter,
} from "../controllers/publicController.js";
import { formLimiter } from "../middleware/security.js";
import { unsubscribeNewsletter } from "../controllers/notificationAdminController.js";

const router = express.Router();

router.get("/settings", getPublicSettings);
router.get("/home", getHome);
router.get("/banners", getBanners);
router.get("/pages", getPublishedPages);
router.get("/pages/:slug", getPageBySlug);
router.post("/newsletter", formLimiter, subscribeNewsletter);
router.get("/newsletter/unsubscribe", formLimiter, unsubscribeNewsletter);
router.post("/contact", formLimiter, submitContact);

export default router;
