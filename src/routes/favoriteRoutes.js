import { Router } from "express";
import { listMyFavorites, toggleFavorite } from "../controllers/favoriteController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, requireRole("CUSTOMER"), listMyFavorites);
router.post("/toggle", requireAuth, requireRole("CUSTOMER"), toggleFavorite);

export default router;
