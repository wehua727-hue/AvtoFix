/**
 * OFFLINE-COMPATIBLE STORES ROUTES
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

const STORES_COLLECTION = "stores";
const PRODUCTS_COLLECTION = "products";

/**
 * GET /api/stores
 */
export const handleStoresGet: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.query;

    let stores = getCollection(STORES_COLLECTION);

    // Filter by userId if provided
    if (userId) {
      stores = stores.filter((s: any) => 
        s.createdBy === userId || s.manager === userId
      );
    }

    // Sort by name
    stores.sort((a: any, b: any) => 
      (a.name || '').localeCompare(b.name || '')
    );

    return res.json(stores);
  } catch (error) {
    console.error("[api/stores GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch stores" });
  }
};

/**
 * POST /api/stores
 */
export const handleStoresCreate: RequestHandler = async (req, res) => {
  try {
    const {
      name,
      address = "",
      phone = "",
      createdBy,
      manager,
      description = "",
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: "Store name is required",
      });
    }

    if (!createdBy) {
      return res.status(400).json({
        success: false,
        error: "createdBy is required",
      });
    }

    // Check if store already exists
    const existing = findOneDocument(STORES_COLLECTION, {
      name: name.trim(),
      createdBy,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Store with this name already exists",
      });
    }

    const newStore = addDocument(STORES_COLLECTION, {
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      description: description.trim(),
      createdBy,
      manager: manager || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      store: newStore,
    });
  } catch (error) {
    console.error("[api/stores POST] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to create store" });
  }
};

/**
 * DELETE /api/stores/:id
 */
export const handleStoreDelete: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const store = findOneDocument(STORES_COLLECTION, { _id: id });
    if (!store) {
      return res.status(404).json({ success: false, error: "Store not found" });
    }

    // Delete products associated with this store
    const products = findDocuments(PRODUCTS_COLLECTION, { store: id });
    for (const product of products) {
      deleteDocument(PRODUCTS_COLLECTION, product._id);
    }

    // Delete store
    const deleted = deleteDocument(STORES_COLLECTION, id);

    if (!deleted) {
      return res.status(500).json({ success: false, error: "Failed to delete store" });
    }

    return res.json({
      success: true,
      message: "Store deleted",
      deletedProductsCount: products.length,
    });
  } catch (error) {
    console.error("[api/stores DELETE] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete store" });
  }
};

