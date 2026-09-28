import { Router } from "express";
import {
  createOrder,
  listMyOrders,
  listFarmerOrders,
  getOrder,
  cancelOrder,
  modifyOrder,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.post("/", requireAuth, requireRole("CUSTOMER"), createOrder);
router.get("/mine", requireAuth, requireRole("CUSTOMER"), listMyOrders);
router.get("/farmer", requireAuth, requireRole("FARMER"), listFarmerOrders);
router.get("/:id", requireAuth, getOrder);
router.put("/:id/cancel", requireAuth, requireRole("CUSTOMER"), cancelOrder);
router.put("/:id/modify", requireAuth, requireRole("CUSTOMER"), modifyOrder);
router.put("/:id/status", requireAuth, requireRole("FARMER"), updateOrderStatus);

export default router;
