import { Router } from "express";
import {
  listMyNotifications,
  markAsRead,
  markAllAsRead,
  publishAnnouncement,
} from "../controllers/notificationController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, listMyNotifications);
router.put("/:id/read", requireAuth, markAsRead);
router.put("/read-all", requireAuth, markAllAsRead);
router.post("/announce", requireAuth, requireRole("ADMIN"), publishAnnouncement);

export default router;
