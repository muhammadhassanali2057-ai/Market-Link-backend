import { Router } from "express";
import { listCategories, createCategory, updateCategory, deleteCategory } from "../controllers/categoryController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", listCategories); // public - needed for filters everywhere
router.post("/", requireAuth, requireRole("ADMIN"), createCategory);
router.put("/:id", requireAuth, requireRole("ADMIN"), updateCategory);
router.delete("/:id", requireAuth, requireRole("ADMIN"), deleteCategory);

export default router;
