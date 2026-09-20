import express from "express";
import { asyncHandler } from "../utils/http.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  uploader,
  uploadSingleFile,
  uploadMultipleFiles,
} from "../controllers/uploadController.js";

const router = express.Router();

// Support both 'file' and 'image' field names for single upload
router.post(
  "/single",
  protect,
  (req, res, next) => {
    uploader.single("file")(req, res, (err) => {
      if (err) return next(err);
      if (!req.file) {
        // Try alternate field name 'image'
        uploader.single("image")(req, res, next);
      } else {
        next();
      }
    });
  },
  asyncHandler(uploadSingleFile),
);

// Alias: POST /api/upload defaults to single file
router.post(
  "/",
  protect,
  (req, res, next) => {
    uploader.single("file")(req, res, (err) => {
      if (err) return next(err);
      if (!req.file) {
        uploader.single("image")(req, res, next);
      } else {
        next();
      }
    });
  },
  asyncHandler(uploadSingleFile),
);

// Support both 'files' and 'images' for multiple uploads (up to 10 files)
router.post(
  "/multiple",
  protect,
  (req, res, next) => {
    uploader.array("files", 10)(req, res, (err) => {
      if (err) return next(err);
      if (!req.files || !req.files.length) {
        uploader.array("images", 10)(req, res, next);
      } else {
        next();
      }
    });
  },
  asyncHandler(uploadMultipleFiles),
);

export default router;
