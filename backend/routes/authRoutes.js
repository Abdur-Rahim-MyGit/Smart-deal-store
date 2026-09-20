import express from "express";
import {
  addAddress,
  changePassword,
  deleteAddress,
  forgotPassword,
  getMe,
  googleAuth,
  listAddresses,
  loginUser,
  logoutAll,
  logoutUser,
  refreshAccessToken,
  registerUser,
  resendVerification,
  resetPassword,
  sendOTP,
  setDefaultAddress,
  updateAddress,
  updateMe,
  verifyEmail,
  verifyOTP,
} from "../controllers/authController.js";
import {
  disableMfa,
  enableMfa,
  getMfaStatus,
  regenerateRecoveryCodes,
  setupMfa,
  verifyMfaSignIn,
} from "../controllers/mfaController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authLimiter } from "../middleware/security.js";

const router = express.Router();

router.post("/register", authLimiter, registerUser);
router.post("/login", authLimiter, loginUser);
router.post("/otp/send", authLimiter, sendOTP);
router.post("/otp/verify", authLimiter, verifyOTP);
router.post("/google", authLimiter, googleAuth);
router.post("/mfa/verify", authLimiter, verifyMfaSignIn);
router.get("/mfa", protect, getMfaStatus);
router.post("/mfa/setup", protect, setupMfa);
router.post("/mfa/enable", authLimiter, protect, enableMfa);
router.post("/mfa/disable", authLimiter, protect, disableMfa);
router.post("/mfa/recovery-codes", authLimiter, protect, regenerateRecoveryCodes);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logoutUser);
router.post("/logout-all", protect, logoutAll);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/verify-email", verifyEmail);
router.post("/verify-email/resend", protect, resendVerification);

router.get("/me", protect, getMe);
router.put("/me", protect, updateMe);
router.put("/me/password", protect, changePassword);

router.get("/addresses", protect, listAddresses);
router.post("/addresses", protect, addAddress);
router.put("/addresses/:addressId", protect, updateAddress);
router.delete("/addresses/:addressId", protect, deleteAddress);
router.put("/addresses/:addressId/default", protect, setDefaultAddress);

export default router;
