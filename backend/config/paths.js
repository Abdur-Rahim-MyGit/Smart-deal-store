import "dotenv/config";
import path from "path";

// Where uploaded files live. Defaults to folders next to the app, which is what the
// Docker setup mounts. Hostinger's Node.js hosting runs every deploy from a fresh build
// folder, so there STORAGE_DIR must point outside it or each redeploy wipes the uploads.
const root = process.env.STORAGE_DIR || ".";

export const UPLOAD_DIR = path.resolve(root, "uploads");
export const PRIVATE_UPLOAD_DIR = path.resolve(root, "private-uploads");
