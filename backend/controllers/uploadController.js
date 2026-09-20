import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { badRequest } from "../utils/http.js";

// Ensure uploads directory exists
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed image formats
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, unique);
  },
});

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      badRequest(
        `Invalid file type (${file.mimetype}). Only JPG, PNG, WEBP, GIF and SVG are accepted.`,
      ),
      false,
    );
  }
}

export const uploader = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter,
});

function formatFileResponse(req, file) {
  const protocol = req.protocol || "http";
  const host = req.get("host") || `localhost:${process.env.PORT || 5050}`;
  const fileUrl = `${protocol}://${host}/uploads/${file.filename}`;
  return {
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    url: fileUrl,
    path: `/uploads/${file.filename}`,
  };
}

export async function uploadSingleFile(req, res) {
  if (!req.file) {
    throw badRequest("No file provided for upload");
  }
  const fileData = formatFileResponse(req, req.file);
  res.json({
    success: true,
    message: "File uploaded successfully",
    file: fileData,
    url: fileData.url,
  });
}

export async function uploadMultipleFiles(req, res) {
  if (!req.files || !req.files.length) {
    throw badRequest("No files provided for upload");
  }
  const files = req.files.map((file) => formatFileResponse(req, file));
  res.json({
    success: true,
    message: `${files.length} file(s) uploaded successfully`,
    files,
    urls: files.map((f) => f.url),
  });
}
