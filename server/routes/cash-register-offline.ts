/**
 * OFFLINE-COMPATIBLE CASH REGISTER ROUTES
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

const CASH_REGISTER_COLLECTION = "cash_register_checks";
const PENDING_CHECKS_COLLECTION = "pending_checks";

/**
 * GET /api/cash-register
 */
export const handleCashRegisterGet: RequestHandler = async (req, res) => {
  try {
    const { userId, date } = req.query;

    let checks = getCollection(CASH_REGISTER_COLLECTION);

    // Filter by userId
    if (userId) {
      checks = checks.filter((c: any) => c.userId === userId);
    }

    // Filter by date
    if (date) {
      const dateStr = String(date).substring(0, 10); // YYYY-MM-DD
      checks = checks.filter((c: any) => {
        const checkDate = new Date(c.createdAt).toISOString().substring(0, 10);
        return checkDate === dateStr;
      });
    }

    // Sort by date descending
    checks.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.json(checks);
  } catch (error) {
    console.error("[api/cash-register GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch cash register checks" });
  }
};

/**
 * GET /api/cash-register/current
 */
export const handleCurrentCheckGet: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    // Get pending checks for user
    const pendingChecks = findDocuments(PENDING_CHECKS_COLLECTION, { userId });

    if (pendingChecks.length === 0) {
      return res.json({ check: null });
    }

    // Return the most recent pending check
    const currentCheck = pendingChecks.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    return res.json({ check: currentCheck });
  } catch (error) {
    console.error("[api/cash-register/current GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch current check" });
  }
};

/**
 * POST /api/cash-register/current
 */
export const handleCurrentCheckSave: RequestHandler = async (req, res) => {
  try {
    const { userId, items, total, paymentType, notes } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    // Find or create pending check
    let pendingCheck = findOneDocument(PENDING_CHECKS_COLLECTION, { userId });

    if (pendingCheck) {
      // Update existing pending check
      const updated = updateDocument(PENDING_CHECKS_COLLECTION, pendingCheck._id, {
        items: items || [],
        total: total || 0,
        paymentType: paymentType || 'Naqd',
        notes: notes || '',
        updatedAt: new Date(),
      });
      return res.json({ success: true, check: updated });
    } else {
      // Create new pending check
      const newCheck = addDocument(PENDING_CHECKS_COLLECTION, {
        userId,
        items: items || [],
        total: total || 0,
        paymentType: paymentType || 'Naqd',
        notes: notes || '',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return res.status(201).json({ success: true, check: newCheck });
    }
  } catch (error) {
    console.error("[api/cash-register/current POST] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to save check" });
  }
};

/**
 * POST /api/cash-register/pending
 */
export const handlePendingCheckCreate: RequestHandler = async (req, res) => {
  try {
    const { userId, items, total, paymentType, notes } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    const newCheck = addDocument(PENDING_CHECKS_COLLECTION, {
      userId,
      items: items || [],
      total: total || 0,
      paymentType: paymentType || 'Naqd',
      notes: notes || '',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      check: newCheck,
    });
  } catch (error) {
    console.error("[api/cash-register/pending POST] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to create pending check" });
  }
};

/**
 * POST /api/cash-register/complete
 */
export const handleCheckComplete: RequestHandler = async (req, res) => {
  try {
    const { checkId, userId } = req.body;

    if (!checkId || !userId) {
      return res.status(400).json({ error: "checkId and userId required" });
    }

    // Get pending check
    const pendingCheck = findOneDocument(PENDING_CHECKS_COLLECTION, { _id: checkId });
    if (!pendingCheck) {
      return res.status(404).json({ error: "Pending check not found" });
    }

    // Create completed check in cash register
    const completedCheck = addDocument(CASH_REGISTER_COLLECTION, {
      userId,
      items: pendingCheck.items,
      total: pendingCheck.total,
      paymentType: pendingCheck.paymentType,
      notes: pendingCheck.notes,
      status: 'completed',
      receiptNumber: `RCP-${Date.now()}`,
      createdAt: new Date(),
      completedAt: new Date(),
    });

    // Delete pending check
    deleteDocument(PENDING_CHECKS_COLLECTION, checkId);

    return res.json({
      success: true,
      check: completedCheck,
    });
  } catch (error) {
    console.error("[api/cash-register/complete POST] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to complete check" });
  }
};

/**
 * POST /api/cash-register/pending/restore
 */
export const handlePendingCheckRestore: RequestHandler = async (req, res) => {
  try {
    const { checkId, userId } = req.body;

    if (!checkId || !userId) {
      return res.status(400).json({ error: "checkId and userId required" });
    }

    // Get completed check
    const completedCheck = findOneDocument(CASH_REGISTER_COLLECTION, { _id: checkId });
    if (!completedCheck) {
      return res.status(404).json({ error: "Check not found" });
    }

    // Create pending check
    const pendingCheck = addDocument(PENDING_CHECKS_COLLECTION, {
      userId,
      items: completedCheck.items,
      total: completedCheck.total,
      paymentType: completedCheck.paymentType,
      notes: completedCheck.notes,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Delete completed check
    deleteDocument(CASH_REGISTER_COLLECTION, checkId);

    return res.json({
      success: true,
      check: pendingCheck,
    });
  } catch (error) {
    console.error("[api/cash-register/pending/restore POST] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to restore check" });
  }
};

/**
 * DELETE /api/cash-register/:id
 */
export const handleCheckDelete: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const check = findOneDocument(CASH_REGISTER_COLLECTION, { _id: id });
    if (!check) {
      return res.status(404).json({ success: false, error: "Check not found" });
    }

    const deleted = deleteDocument(CASH_REGISTER_COLLECTION, id);

    if (!deleted) {
      return res.status(500).json({ success: false, error: "Failed to delete check" });
    }

    return res.json({
      success: true,
      message: "Check deleted",
    });
  } catch (error) {
    console.error("[api/cash-register DELETE] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete check" });
  }
};

