import { Router } from "express";
import {
  listFarmers,
  getFarmer,
  getMyFarmerProfile,
  updateMyFarmerProfile,
  listFarmerAccountsForAdmin,
  setFarmerAccountStatus,
} from "../controllers/farmerController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", listFarmers);
router.get("/me", requireAuth, requireRole("FARMER"), getMyFarmerProfile);
router.put("/me", requireAuth, requireRole("FARMER"), updateMyFarmerProfile);
router.get("/admin/all", requireAuth, requireRole("ADMIN"), listFarmerAccountsForAdmin);
router.put("/admin/:id/status", requireAuth, requireRole("ADMIN"), setFarmerAccountStatus);
router.get("/:id", getFarmer);

export default router;
