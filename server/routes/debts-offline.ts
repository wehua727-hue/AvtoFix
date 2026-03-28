/**
 * OFFLINE-COMPATIBLE DEBTS ROUTES
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

const DEBTS_COLLECTION = "debts";
const DEBT_HISTORY_COLLECTION = "debt_history";

/**
 * GET /api/debts
 */
export const handleDebtsGet: RequestHandler = async (req, res) => {
  try {
    const { userId, customerId, status } = req.query;

    let debts = getCollection(DEBTS_COLLECTION);

    // Filter by userId
    if (userId) {
      debts = debts.filter((d: any) => d.userId === userId);
    }

    // Filter by customerId
    if (customerId) {
      debts = debts.filter((d: any) => d.customerId === customerId);
    }

    // Filter by status
    if (status) {
      debts = debts.filter((d: any) => d.status === status);
    }

    // Sort by date descending
    debts.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.json(debts);
  } catch (error) {
    console.error("[api/debts GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch debts" });
  }
};

/**
 * POST /api/debts
 */
export const handleDebtCreate: RequestHandler = async (req, res) => {
  try {
    const {
      customerId,
      userId,
      amount,
      reason = "",
      dueDate,
      notes = "",
    } = req.body;

    if (!customerId || !userId || !amount) {
      return res.status(400).json({
        success: false,
        error: "customerId, userId, and amount are required",
      });
    }

    const newDebt = addDocument(DEBTS_COLLECTION, {
      customerId,
      userId,
      amount: Number(amount),
      reason: reason.trim(),
      dueDate: dueDate || undefined,
      notes: notes.trim(),
      status: "pending",
      paidAmount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Add to history
    try {
      addDocument(DEBT_HISTORY_COLLECTION, {
        debtId: newDebt._id,
        userId,
        customerId,
        type: "created",
        amount: Number(amount),
        message: `Qarz yaratildi: ${amount} so'm`,
        timestamp: new Date(),
      });
    } catch (histErr) {
      console.error("[Debt Create] Failed to save history:", histErr);
    }

    return res.status(201).json({
      success: true,
      debt: newDebt,
    });
  } catch (error) {
    console.error("[api/debts POST] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to create debt" });
  }
};

/**
 * PUT /api/debts/:id
 */
export const handleDebtUpdate: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason, dueDate, notes, status } = req.body;

    const debt = findOneDocument(DEBTS_COLLECTION, { _id: id });
    if (!debt) {
      return res.status(404).json({ success: false, error: "Debt not found" });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (amount !== undefined) updateData.amount = Number(amount);
    if (reason !== undefined) updateData.reason = reason.trim();
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (notes !== undefined) updateData.notes = notes.trim();
    if (status !== undefined) updateData.status = status;

    const updatedDebt = updateDocument(DEBTS_COLLECTION, id, updateData);

    if (!updatedDebt) {
      return res.status(500).json({ success: false, error: "Failed to update debt" });
    }

    return res.json({
      success: true,
      debt: updatedDebt,
    });
  } catch (error) {
    console.error("[api/debts PUT] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to update debt" });
  }
};

/**
 * POST /api/debts/:id/mark-as-paid
 */
export const handleDebtMarkAsPaid: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { paidAmount, userId } = req.body;

    const debt = findOneDocument(DEBTS_COLLECTION, { _id: id });
    if (!debt) {
      return res.status(404).json({ success: false, error: "Debt not found" });
    }

    const updateData: any = {
      status: "paid",
      paidAmount: paidAmount || debt.amount,
      updatedAt: new Date(),
    };

    const updatedDebt = updateDocument(DEBTS_COLLECTION, id, updateData);

    if (!updatedDebt) {
      return res.status(500).json({ success: false, error: "Failed to mark debt as paid" });
    }

    // Add to history
    try {
      addDocument(DEBT_HISTORY_COLLECTION, {
        debtId: id,
        userId: userId || debt.userId,
        customerId: debt.customerId,
        type: "paid",
        amount: paidAmount || debt.amount,
        message: `Qarz to'landi: ${paidAmount || debt.amount} so'm`,
        timestamp: new Date(),
      });
    } catch (histErr) {
      console.error("[Debt Paid] Failed to save history:", histErr);
    }

    return res.json({
      success: true,
      debt: updatedDebt,
    });
  } catch (error) {
    console.error("[api/debts/:id/mark-as-paid] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to mark debt as paid" });
  }
};

/**
 * POST /api/debts/:id/mark-as-unpaid
 */
export const handleDebtMarkAsUnpaid: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const debt = findOneDocument(DEBTS_COLLECTION, { _id: id });
    if (!debt) {
      return res.status(404).json({ success: false, error: "Debt not found" });
    }

    const updateData: any = {
      status: "pending",
      paidAmount: 0,
      updatedAt: new Date(),
    };

    const updatedDebt = updateDocument(DEBTS_COLLECTION, id, updateData);

    if (!updatedDebt) {
      return res.status(500).json({ success: false, error: "Failed to mark debt as unpaid" });
    }

    // Add to history
    try {
      addDocument(DEBT_HISTORY_COLLECTION, {
        debtId: id,
        userId: userId || debt.userId,
        customerId: debt.customerId,
        type: "unpaid",
        amount: debt.amount,
        message: `Qarz qayta ochildi`,
        timestamp: new Date(),
      });
    } catch (histErr) {
      console.error("[Debt Unpaid] Failed to save history:", histErr);
    }

    return res.json({
      success: true,
      debt: updatedDebt,
    });
  } catch (error) {
    console.error("[api/debts/:id/mark-as-unpaid] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to mark debt as unpaid" });
  }
};

/**
 * DELETE /api/debts/:id
 */
export const handleDebtDelete: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const debt = findOneDocument(DEBTS_COLLECTION, { _id: id });
    if (!debt) {
      return res.status(404).json({ success: false, error: "Debt not found" });
    }

    const deleted = deleteDocument(DEBTS_COLLECTION, id);

    if (!deleted) {
      return res.status(500).json({ success: false, error: "Failed to delete debt" });
    }

    return res.json({
      success: true,
      message: "Debt deleted",
    });
  } catch (error) {
    console.error("[api/debts DELETE] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete debt" });
  }
};

/**
 * GET /api/debts/history
 */
export const handleDebtHistoryGet: RequestHandler = async (req, res) => {
  try {
    const { debtId, userId, limit = 100 } = req.query;

    let history = getCollection(DEBT_HISTORY_COLLECTION);

    if (debtId) {
      history = history.filter((h: any) => h.debtId === debtId);
    }

    if (userId) {
      history = history.filter((h: any) => h.userId === userId);
    }

    // Sort by timestamp descending
    history = history
      .sort((a: any, b: any) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, Number(limit));

    return res.json(history);
  } catch (error) {
    console.error("[api/debts/history GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch debt history" });
  }
};

/**
 * GET /api/debts/blacklist
 */
export const handleBlacklistGet: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.query;

    let debts = getCollection(DEBTS_COLLECTION);

    // Filter by userId
    if (userId) {
      debts = debts.filter((d: any) => d.userId === userId);
    }

    // Get blacklisted customers (unpaid debts)
    const blacklist = debts
      .filter((d: any) => d.status === "pending" && d.amount > (d.paidAmount || 0))
      .map((d: any) => ({
        customerId: d.customerId,
        totalDebt: d.amount - (d.paidAmount || 0),
        reason: d.reason,
        createdAt: d.createdAt,
      }));

    return res.json(blacklist);
  } catch (error) {
    console.error("[api/debts/blacklist GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch blacklist" });
  }
};

/**
 * GET /api/debts/blacklist/check
 */
export const handleBlacklistCheck: RequestHandler = async (req, res) => {
  try {
    const { customerId, userId } = req.query;

    if (!customerId) {
      return res.status(400).json({ error: "customerId required" });
    }

    let debts = getCollection(DEBTS_COLLECTION);

    if (userId) {
      debts = debts.filter((d: any) => d.userId === userId);
    }

    const customerDebts = debts.filter((d: any) => 
      d.customerId === customerId && 
      d.status === "pending" && 
      d.amount > (d.paidAmount || 0)
    );

    const isBlacklisted = customerDebts.length > 0;
    const totalDebt = customerDebts.reduce((sum: number, d: any) => 
      sum + (d.amount - (d.paidAmount || 0)), 0
    );

    return res.json({
      isBlacklisted,
      totalDebt,
      debtCount: customerDebts.length,
    });
  } catch (error) {
    console.error("[api/debts/blacklist/check] Error:", error);
    return res.status(500).json({ error: "Failed to check blacklist" });
  }
};

