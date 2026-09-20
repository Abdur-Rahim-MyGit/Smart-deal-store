import Notification from "../models/Notification.js";
import { asyncHandler, badRequest, isObjectId } from "../utils/http.js";

// @route GET /api/notifications
export const getNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);
  res.json({ success: true, notifications, unreadCount });
});

// @route PUT /api/notifications/:id/read
export const markNotificationRead = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw badRequest("Invalid notification");
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { isRead: true });
  res.json({ success: true });
});

// @route PUT /api/notifications/read-all
export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  res.json({ success: true });
});
