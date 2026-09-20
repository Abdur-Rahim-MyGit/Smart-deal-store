import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import User from "../models/User.js";
import { HttpError, asyncHandler, badRequest, isObjectId, notFound } from "../utils/http.js";
import { audit } from "../utils/notify.js";
import { notifyAdmins } from "../services/orderService.js";

/*
 * Seller verification documents (trade licence, VAT certificate). They hold business details,
 * so they live outside the public /uploads folder and are only served to the seller and to
 * admins with access to sellers — never by a guessable URL.
 */
export const DOCUMENT_TYPES = {
  tradeLicense: "Trade licence",
  vatCertificate: "VAT registration certificate",
};

const DOCS_DIR = path.resolve("private-uploads", "vendor-docs");
fs.mkdirSync(DOCS_DIR, { recursive: true });

const FORMATS = {
  "application/pdf": { ext: ".pdf", magic: (bytes) => bytes.subarray(0, 4).toString() === "%PDF" },
  "image/jpeg": { ext: ".jpg", magic: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 },
  "image/png": {
    ext: ".png",
    magic: (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  },
  "image/webp": {
    ext: ".webp",
    magic: (bytes) =>
      bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP",
  },
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, DOCS_DIR),
    filename: (req, file, cb) =>
      cb(
        null,
        `${req.user._id}-${req.params.type}-${crypto.randomBytes(12).toString("hex")}${FORMATS[file.mimetype]?.ext ?? ""}`,
      ),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    FORMATS[file.mimetype]
      ? cb(null, true)
      : cb(badRequest("Upload a PDF, JPG, PNG or WEBP file (up to 10 MB)")),
});

const removeFile = (name) => {
  if (!name) return;
  fs.promises.unlink(path.join(DOCS_DIR, path.basename(name))).catch(() => undefined);
};

function readType(req) {
  if (!DOCUMENT_TYPES[req.params.type]) throw notFound("Unknown document type");
  return req.params.type;
}

/** Runs the upload and turns its errors (such as a file over 10 MB) into friendly API errors. */
export const receiveDocument = (req, res, next) => {
  if (!DOCUMENT_TYPES[req.params.type]) return next(notFound("Unknown document type"));
  upload.single("file")(req, res, (error) => {
    if (error?.code === "LIMIT_FILE_SIZE") return next(badRequest("Files can be up to 10 MB"));
    next(error);
  });
};

// @route POST /api/vendors/documents/:type — multipart "file", optional "expiresAt"
export const uploadDocument = asyncHandler(async (req, res) => {
  const type = readType(req);
  if (!req.file) throw badRequest("Choose a file to upload");

  // Check the file really is what its type claims before keeping it.
  const handle = await fs.promises.open(req.file.path, "r");
  const bytes = Buffer.alloc(12);
  await handle.read(bytes, 0, 12, 0);
  await handle.close();
  if (!FORMATS[req.file.mimetype].magic(bytes)) {
    removeFile(req.file.filename);
    throw badRequest("That file doesn't look like a real PDF or image");
  }

  let expiresAt;
  if (req.body.expiresAt) {
    expiresAt = new Date(req.body.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      removeFile(req.file.filename);
      throw badRequest("Invalid expiry date");
    }
  }

  const user = await User.findById(req.user._id);
  const previous = user.vendorDetails?.documents?.[type]?.file;
  user.set(`vendorDetails.documents.${type}`, {
    file: req.file.filename,
    originalName: String(req.file.originalname).slice(0, 120),
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedAt: new Date(),
    expiresAt,
  });
  await user.save({ validateBeforeSave: false });
  removeFile(previous);

  if (user.vendorDetails.status !== "Active") {
    await notifyAdmins("vendors", {
      type: "account",
      title: `${DOCUMENT_TYPES[type]} uploaded`,
      message: `${user.vendorDetails.businessName || user.name} uploaded their ${DOCUMENT_TYPES[type].toLowerCase()} for review.`,
      link: "/admin-dashboard?tab=vendors",
    });
  }
  res.json({ success: true, message: `${DOCUMENT_TYPES[type]} uploaded`, user });
});

async function streamDocument(res, vendor, type) {
  const doc = vendor?.vendorDetails?.documents?.[type];
  if (!doc?.file) throw notFound(`No ${DOCUMENT_TYPES[type].toLowerCase()} on file`);
  const filePath = path.join(DOCS_DIR, path.basename(doc.file));
  if (!fs.existsSync(filePath))
    throw new HttpError(410, "The stored file is missing. Ask the seller to upload it again.");
  res.setHeader("Content-Type", doc.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${type}${path.extname(doc.file)}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  fs.createReadStream(filePath).pipe(res);
}

// @route GET /api/vendors/documents/:type — the seller's own document
export const downloadOwnDocument = asyncHandler(async (req, res) => {
  await streamDocument(res, req.user, readType(req));
});

// @route GET /api/admin/vendors/:id/documents/:type — admins reviewing a seller
export const viewVendorDocument = asyncHandler(async (req, res) => {
  const type = readType(req);
  if (!isObjectId(req.params.id)) throw badRequest("Invalid seller");
  const vendor = await User.findOne({ _id: req.params.id, role: "Vendor" });
  if (!vendor) throw notFound("Seller not found");
  await audit(req, "vendor.document_view", {
    entityType: "User",
    entityId: vendor._id,
    summary: `${vendor.vendorDetails?.businessName || vendor.email}: ${DOCUMENT_TYPES[type]}`,
  });
  await streamDocument(res, vendor, type);
});
