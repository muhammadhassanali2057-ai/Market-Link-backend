import { Router } from "express";
import {
  listAvailableSlots,
  generateSlots,
  listMySlots,
  deleteSlot,
} from "../controllers/pickupSlotController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", listAvailableSlots);
router.get("/mine", requireAuth, requireRole("FARMER"), listMySlots);
router.post("/generate", requireAuth, requireRole("FARMER"), generateSlots);
router.delete("/:id", requireAuth, requireRole("FARMER"), deleteSlot);

export default router;
