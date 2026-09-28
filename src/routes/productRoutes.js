import { Router } from "express";
import {
  listProducts,
  getProduct,
  listMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  moderateProduct,
} from "../controllers/productController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", listProducts);
router.get("/mine", requireAuth, requireRole("FARMER"), listMyProducts);
router.get("/:id", getProduct);
router.post("/", requireAuth, requireRole("FARMER"), createProduct);
router.put("/:id", requireAuth, requireRole("FARMER"), updateProduct);
router.delete("/:id", requireAuth, requireRole("FARMER"), deleteProduct);
router.put("/:id/moderate", requireAuth, requireRole("ADMIN"), moderateProduct);

export default router;
