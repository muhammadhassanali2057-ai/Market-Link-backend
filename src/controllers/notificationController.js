import Notification from "../models/Notification.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../middleware/errorHandler.js";

export const listMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
  const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });
  res.json({ notifications, unreadCount });
});

export const markAsRead = asyncHandler(async (req, res) => {
  const notif = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!notif) throw new AppError("Notification not found.", 404);
  notif.isRead = true;
  await notif.save();
  res.json({ notification: notif });
});

export const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  res.json({ message: "All notifications marked as read." });
});

// Used internally by admin "publish announcement" - broadcasts to a role.
export const publishAnnouncement = asyncHandler(async (req, res) => {
  const User = (await import("../models/User.js")).default;
  const { message, targetRole } = req.body;
  if (!message) throw new AppError("message is required.", 400);

  const filter = targetRole && targetRole !== "ALL" ? { role: targetRole } : {};
  const users = await User.find(filter).select("_id");
  await Notification.insertMany(
    users.map((u) => ({ user: u._id, type: "PLATFORM_ANNOUNCEMENT", message }))
  );
  res.status(201).json({ message: `Announcement sent to ${users.length} users.` });
});
