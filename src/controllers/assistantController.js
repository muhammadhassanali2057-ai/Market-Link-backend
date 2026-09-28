import { answerQuestion } from "../services/aiAssistant.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../middleware/errorHandler.js";

export const askAssistant = asyncHandler(async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) throw new AppError("question is required.", 400);
  const result = await answerQuestion(question.trim());
  res.json(result);
});
