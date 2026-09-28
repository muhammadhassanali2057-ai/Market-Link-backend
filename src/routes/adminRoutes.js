import { Router } from "express";
import {
  getOverview,
  listCustomers,
  setCustomerStatus,
  generateSalesSummary,
  listReports,
} from "../controllers/adminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/overview", getOverview);
router.get("/customers", listCustomers);
router.put("/customers/:id/status", setCustomerStatus);
router.get("/reports/sales-summary", generateSalesSummary);
router.get("/reports", listReports);

export default router;
