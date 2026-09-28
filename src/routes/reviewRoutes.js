import { Router } from "express";
import { createReview, listReviewsForTarget, respondToReview, moderateReview } from "../controllers/reviewController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", listReviewsForTarget);
router.post("/", requireAuth, requireRole("CUSTOMER"), createReview);
router.put("/:id/respond", requireAuth, requireRole("FARMER"), respondToReview);
router.put("/:id/moderate", requireAuth, requireRole("ADMIN"), moderateReview);

export default router;
