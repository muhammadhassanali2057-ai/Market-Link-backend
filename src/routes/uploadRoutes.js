import { Router } from "express";
import { upload } from "../middleware/upload.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

router.post("/image", requireAuth, requireRole("FARMER", "ADMIN"), (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) return next(err instanceof AppError ? err : new AppError(err.message, 400));
    if (!req.file) return next(new AppError("No image file provided.", 400));
    // Served statically from /uploads (see app.js) - local-dev-friendly
    // fallback since no cloud storage credentials are configured.
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});

export default router;
