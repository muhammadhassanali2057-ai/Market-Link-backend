import Category from "../models/Category.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../middleware/errorHandler.js";

export const listCategories = asyncHandler(async (_req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json({ categories });
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) throw new AppError("Category name is required.", 400);
  const slug = name.toLowerCase().trim().replace(/\s+/g, "-");
  const exists = await Category.findOne({ $or: [{ name }, { slug }] });
  if (exists) throw new AppError("That category already exists.", 409);
  const category = await Category.create({ name, slug });
  res.status(201).json({ category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError("Category not found.", 404);
  if (name) {
    category.name = name;
    category.slug = name.toLowerCase().trim().replace(/\s+/g, "-");
  }
  await category.save();
  res.json({ category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new AppError("Category not found.", 404);
  res.json({ message: "Category deleted." });
});
