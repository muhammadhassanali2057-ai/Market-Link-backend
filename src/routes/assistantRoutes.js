import { Router } from "express";
import { askAssistant } from "../controllers/assistantController.js";

const router = Router();

// Public: the SRS lists the AI assistant as a customer-facing feature
// that should help people find items even before they've logged in.
router.post("/ask", askAssistant);

export default router;
