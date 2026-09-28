import { Router } from "express";
import { listMarkets, getMarket, createMarket, updateMarket, deleteMarket } from "../controllers/marketController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", listMarkets);
router.get("/:id", getMarket);
router.post("/", requireAuth, requireRole("ADMIN"), createMarket);
router.put("/:id", requireAuth, requireRole("ADMIN"), updateMarket);
router.delete("/:id", requireAuth, requireRole("ADMIN"), deleteMarket);

export default router;
