/**
 * OFFLINE-COMPATIBLE CATEGORIES ROUTES
 */

import { RequestHandler } from "express";
import { 
  findDocuments, 
  findOneDocument, 
  addDocument, 
  updateDocument, 
  deleteDocument,
  getCollection 
} from "../db/local-db";

const CATEGORIES_COLLECTION = "categories";

/**
 * GET /api/categories
 */
export const handleCategoriesGet: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.query;

    let categories = getCollection(CATEGORIES_COLLECTION);

    // Filter by userId if provided
    if (userId) {
      categories = categories.filter((c: any) => !c.userId || c.userId === userId);
    }

    // Sort by name
    categories.sort((a: any, b: any) => 
      (a.name || '').localeCompare(b.name || '')
    );

    return res.json(categories);
  } catch (error) {
    console.error("[api/categories GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch categories" });
  }
};

/**
 * POST /api/categories
 */
export const handleCategoriesCreate: RequestHandler = async (req, res) => {
  try {
    const { name, description = "", userId } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: "Category name is required" 
      });
    }

    // Check if category already exists
    const existing = findOneDocument(CATEGORIES_COLLECTION, { 
      name: name.trim(),
      userId: userId || undefined 
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Category with this name already exists",
      });
    }

    const newCategory = addDocument(CATEGORIES_COLLECTION, {
      name: name.trim(),
      description: description.trim(),
      userId: userId || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      category: newCategory,
    });
  } catch (error) {
    console.error("[api/categories POST] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to create category" });
  }
};

/**
 * PUT /api/categories/:id
 */
export const handleCategoryUpdate: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const category = findOneDocument(CATEGORIES_COLLECTION, { _id: id });
    if (!category) {
      return res.status(404).json({ success: false, error: "Category not found" });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();

    const updatedCategory = updateDocument(CATEGORIES_COLLECTION, id, updateData);

    if (!updatedCategory) {
      return res.status(500).json({ success: false, error: "Failed to update category" });
    }

    return res.json({
      success: true,
      category: updatedCategory,
    });
  } catch (error) {
    console.error("[api/categories PUT] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to update category" });
  }
};

/**
 * DELETE /api/categories/:id
 */
export const handleCategoryDelete: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const category = findOneDocument(CATEGORIES_COLLECTION, { _id: id });
    if (!category) {
      return res.status(404).json({ success: false, error: "Category not found" });
    }

    const deleted = deleteDocument(CATEGORIES_COLLECTION, id);

    if (!deleted) {
      return res.status(500).json({ success: false, error: "Failed to delete category" });
    }

    return res.json({
      success: true,
      message: "Category deleted",
    });
  } catch (error) {
    console.error("[api/categories DELETE] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete category" });
  }
};

