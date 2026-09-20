import express from "express";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";
import { registerClient } from "../services/sseService.js";

const router = express.Router();

router.use(protect);

// SSE Live Notification Stream
router.get("/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": ping\n\n");

  registerClient(req.user._id, res);

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  res.on("close", () => {
    clearInterval(heartbeat);
  });
});

router.get("/", getNotifications);
router.put("/read-all", markAllNotificationsRead);
router.put("/:id/read", markNotificationRead);

export default router;
