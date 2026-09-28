import { Router } from "express";
import { getFarmerAnalytics } from "../controllers/analyticsController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/farmer", requireAuth, requireRole("FARMER"), getFarmerAnalytics);

export default router;
