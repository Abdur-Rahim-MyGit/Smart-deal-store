import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import Setting from "./models/Setting.js";
import Brand from "./models/Brand.js";
import AdminRole from "./models/AdminRole.js";
import Ticket from "./models/Ticket.js";
import { startCampaignScheduler } from "./services/notificationService.js";
import { HttpError } from "./utils/http.js";
import { apiLimiter, sanitizeInput } from "./middleware/security.js";
import { errorHandler, notFoundHandler } from "./middleware/errorMiddleware.js";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import ticketRoutes from "./routes/ticketRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import path from "path";
import fs from "fs";

dotenv.config();

for (const key of ["MONGODB_URI", "JWT_SECRET", "JWT_REFRESH_SECRET"]) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in backend/.env (see backend/.env.example)`);
    process.exit(1);
  }
}

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:8080")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin(origin, callback) {
      const localDev =
        !isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
      if (!origin || allowedOrigins.includes(origin) || localDev) return callback(null, true);
      return callback(new HttpError(403, "Origin not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sanitizeInput);
app.use(morgan(isProduction ? "combined" : "dev"));
app.use("/api", apiLimiter);

app.get("/", (_req, res) => {
  res.json({ success: true, message: "Smart Deal E-Commerce API", health: "/api/health" });
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    time: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/uploads", express.static(path.resolve("uploads")));

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5050;

async function start() {
  await connectDB();
  await Setting.getSingleton();
  // Brands used by existing products join the directory, so older stores keep working.
  await Brand.syncFromCatalog();
  await AdminRole.ensureDefaults();
  await Ticket.migrateLegacyStatuses();
  startCampaignScheduler();

  const server = app.listen(PORT, () => {
    console.log(
      `Smart Deal API running in ${process.env.NODE_ENV || "development"} mode on http://localhost:${PORT}`,
    );
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use by another program. Set a free PORT in backend/.env.`,
      );
      process.exit(1);
    }
    throw error;
  });
}

start();
