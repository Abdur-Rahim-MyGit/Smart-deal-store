import express from "express";
import {
  adjustWallet,
  createBanner,
  createCategory,
  createCoupon,
  createPage,
  createStaff,
  deleteBanner,
  deleteCustomer,
  deleteCategory,
  deleteCoupon,
  deleteMessage,
  deletePage,
  deleteReview,
  deleteStaff,
  deleteSubscriber,
  getAdminDashboard,
  getAdminSettings,
  getUserDetail,
  listAdminCategories,
  listAdminProducts,
  listAuditLogs,
  listBanners,
  listCoupons,
  listCustomers,
  listMessages,
  listPages,
  listPayouts,
  listReviews,
  listStaff,
  listSubscribers,
  listVendors,
  moderateProduct,
  moderateReview,
  moderateVendor,
  sendUserPasswordReset,
  unlockUser,
  updateBanner,
  updateCategory,
  updateCoupon,
  updateMessage,
  updatePage,
  updatePayout,
  updateProductFlags,
  updateSettings,
  updateStaff,
  updateUserProfile,
  updateUserStatus,
  sendTestEmail,
} from "../controllers/adminController.js";
import {
  getOrderById,
  listOrders,
  markRefundSent,
  resolveReturn,
  updateOrderStatus,
} from "../controllers/orderController.js";
import {
  createBrand,
  deleteBrand,
  listBrands,
  syncBrands,
  updateBrand,
} from "../controllers/brandController.js";
import { createRole, deleteRole, listRoles, updateRole } from "../controllers/roleController.js";
import { resetStaffMfa } from "../controllers/mfaController.js";
import { viewVendorDocument } from "../controllers/vendorDocumentController.js";
import {
  cancelCampaign,
  createCampaign,
  getChannels,
  listCampaigns,
  listTemplates,
  previewCampaign,
  resetTemplate,
  sendTestSms,
  updateTemplate,
} from "../controllers/notificationAdminController.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  authorize,
  requireAnyPermission,
  requirePermission,
  requireSuperAdmin,
} from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect, authorize("Admin"));

router.get("/dashboard", getAdminDashboard);

// People
router.get("/customers", requirePermission("customers"), listCustomers);
router.post("/customers/:id/wallet", requirePermission("finance"), adjustWallet);
router.get("/vendors", requirePermission("vendors"), listVendors);
router.put("/vendors/:id", requirePermission("vendors"), moderateVendor);
router.get("/vendors/:id/documents/:type", requirePermission("vendors"), viewVendorDocument);
router.get("/users/:id", requireAnyPermission(["customers", "vendors"]), getUserDetail);
router.put("/users/:id/status", requireAnyPermission(["customers", "vendors"]), updateUserStatus);
router.put("/users/:id", requireAnyPermission(["customers", "vendors"]), updateUserProfile);
router.post(
  "/users/:id/password-reset",
  requireAnyPermission(["customers", "vendors"]),
  sendUserPasswordReset,
);
router.post("/users/:id/unlock", requireAnyPermission(["customers", "vendors"]), unlockUser);
router.delete("/users/:id", requirePermission("customers"), deleteCustomer);

router.get("/staff", requireSuperAdmin, listStaff);
router.get("/roles", requireSuperAdmin, listRoles);
router.post("/roles", requireSuperAdmin, createRole);
router.put("/roles/:id", requireSuperAdmin, updateRole);
router.delete("/roles/:id", requireSuperAdmin, deleteRole);
router.post("/staff", requireSuperAdmin, createStaff);
router.put("/staff/:id", requireSuperAdmin, updateStaff);
router.delete("/staff/:id", requireSuperAdmin, deleteStaff);
router.post("/staff/:id/mfa-reset", requireSuperAdmin, resetStaffMfa);

// Catalog
router.get("/products", requirePermission("products"), listAdminProducts);
router.put("/products/:id/moderate", requirePermission("products"), moderateProduct);
router.put("/products/:id/flags", requirePermission("products"), updateProductFlags);
router.get("/brands", requirePermission("products"), listBrands);
router.post("/brands", requirePermission("products"), createBrand);
router.post("/brands/sync", requirePermission("products"), syncBrands);
router.put("/brands/:id", requirePermission("products"), updateBrand);
router.delete("/brands/:id", requirePermission("products"), deleteBrand);
router.get("/categories", requirePermission("products"), listAdminCategories);
router.post("/categories", requirePermission("products"), createCategory);
router.put("/categories/:id", requirePermission("products"), updateCategory);
router.delete("/categories/:id", requirePermission("products"), deleteCategory);

// Orders & returns
router.get("/orders", requirePermission("orders"), listOrders);
router.get("/orders/:id", requirePermission("orders"), getOrderById);
router.put("/orders/:id/status", requirePermission("orders"), updateOrderStatus);
router.put("/orders/:id/return", requirePermission("orders"), resolveReturn);
router.put(
  "/orders/:id/refunds/:refundId",
  requireAnyPermission(["orders", "finance"]),
  markRefundSent,
);

// Reviews
router.get("/reviews", requirePermission("reviews"), listReviews);
router.put("/reviews/:id", requirePermission("reviews"), moderateReview);
router.delete("/reviews/:id", requirePermission("reviews"), deleteReview);

// Marketing
router.get("/coupons", requirePermission("marketing"), listCoupons);
router.post("/coupons", requirePermission("marketing"), createCoupon);
router.put("/coupons/:id", requirePermission("marketing"), updateCoupon);
router.delete("/coupons/:id", requirePermission("marketing"), deleteCoupon);
router.get("/banners", requirePermission("marketing"), listBanners);
router.post("/banners", requirePermission("marketing"), createBanner);
router.put("/banners/:id", requirePermission("marketing"), updateBanner);
router.delete("/banners/:id", requirePermission("marketing"), deleteBanner);
router.get("/pages", requirePermission("marketing"), listPages);
router.post("/pages", requirePermission("marketing"), createPage);
router.put("/pages/:id", requirePermission("marketing"), updatePage);
router.delete("/pages/:id", requirePermission("marketing"), deletePage);
router.get("/subscribers", requirePermission("marketing"), listSubscribers);
router.delete("/subscribers/:id", requirePermission("marketing"), deleteSubscriber);

// Finance
router.get("/payouts", requirePermission("finance"), listPayouts);
router.put("/payouts/:id", requirePermission("finance"), updatePayout);

// Support inbox
router.get("/messages", requirePermission("support"), listMessages);
router.put("/messages/:id", requirePermission("support"), updateMessage);
router.delete("/messages/:id", requirePermission("support"), deleteMessage);

// Notifications: templates (settings), campaigns (marketing), channel status (either)
router.get("/notifications/templates", requirePermission("settings"), listTemplates);
router.put("/notifications/templates/:key", requirePermission("settings"), updateTemplate);
router.delete("/notifications/templates/:key", requirePermission("settings"), resetTemplate);
router.get("/notifications/channels", requireAnyPermission(["marketing", "settings"]), getChannels);
router.post("/notifications/test-sms", requirePermission("settings"), sendTestSms);
router.get("/campaigns", requirePermission("marketing"), listCampaigns);
router.post("/campaigns/preview", requirePermission("marketing"), previewCampaign);
router.post("/campaigns", requirePermission("marketing"), createCampaign);
router.put("/campaigns/:id/cancel", requirePermission("marketing"), cancelCampaign);

// Settings & audit
router.get("/settings", requirePermission("settings"), getAdminSettings);
router.put("/settings", requirePermission("settings"), updateSettings);
router.get("/audit-logs", requirePermission("settings"), listAuditLogs);
router.post("/test-email", requirePermission("settings"), sendTestEmail);

export default router;
