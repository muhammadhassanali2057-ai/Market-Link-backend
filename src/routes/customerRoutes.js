import { Router } from "express";
import { getDashboard } from "../controllers/customerController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/dashboard", requireAuth, requireRole("CUSTOMER"), getDashboard);

export default router;
