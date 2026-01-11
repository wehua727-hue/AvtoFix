/**
 * OFFLINE-COMPATIBLE CUSTOMERS ROUTES
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

const CUSTOMERS_COLLECTION = "customers";

/**
 * GET /api/customers
 */
export const handleCustomersGet: RequestHandler = async (req, res) => {
  try {
    const { userId, search } = req.query;

    let customers = getCollection(CUSTOMERS_COLLECTION);

    // Filter by userId
    if (userId) {
      customers = customers.filter((c: any) => c.userId === userId);
    }

    // Search by name or phone
    if (search) {
      const searchLower = String(search).toLowerCase();
      customers = customers.filter((c: any) => 
        (c.name || '').toLowerCase().includes(searchLower) ||
        (c.phone || '').includes(searchLower)
      );
    }

    // Sort by name
    customers.sort((a: any, b: any) => 
      (a.name || '').localeCompare(b.name || '')
    );

    return res.json(customers);
  } catch (error) {
    console.error("[api/customers GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch customers" });
  }
};

/**
 * POST /api/customers
 */
export const handleCustomerCreate: RequestHandler = async (req, res) => {
  try {
    const {
      name,
      phone,
      email = "",
      address = "",
      userId,
      notes = "",
    } = req.body;

    if (!name || !phone || !userId) {
      return res.status(400).json({
        success: false,
        error: "name, phone, and userId are required",
      });
    }

    // Check if customer already exists
    const existing = findOneDocument(CUSTOMERS_COLLECTION, {
      phone: phone.trim(),
      userId,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Customer with this phone already exists",
      });
    }

    const newCustomer = addDocument(CUSTOMERS_COLLECTION, {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      userId,
      notes: notes.trim(),
      totalPurchases: 0,
      totalSpent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      customer: newCustomer,
    });
  } catch (error) {
    console.error("[api/customers POST] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to create customer" });
  }
};

/**
 * PUT /api/customers/:id
 */
export const handleCustomerUpdate: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, notes } = req.body;

    const customer = findOneDocument(CUSTOMERS_COLLECTION, { _id: id });
    if (!customer) {
      return res.status(404).json({ success: false, error: "Customer not found" });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (email !== undefined) updateData.email = email.trim();
    if (address !== undefined) updateData.address = address.trim();
    if (notes !== undefined) updateData.notes = notes.trim();

    const updatedCustomer = updateDocument(CUSTOMERS_COLLECTION, id, updateData);

    if (!updatedCustomer) {
      return res.status(500).json({ success: false, error: "Failed to update customer" });
    }

    return res.json({
      success: true,
      customer: updatedCustomer,
    });
  } catch (error) {
    console.error("[api/customers PUT] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to update customer" });
  }
};

/**
 * DELETE /api/customers/:id
 */
export const handleCustomerDelete: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = findOneDocument(CUSTOMERS_COLLECTION, { _id: id });
    if (!customer) {
      return res.status(404).json({ success: false, error: "Customer not found" });
    }

    const deleted = deleteDocument(CUSTOMERS_COLLECTION, id);

    if (!deleted) {
      return res.status(500).json({ success: false, error: "Failed to delete customer" });
    }

    return res.json({
      success: true,
      message: "Customer deleted",
    });
  } catch (error) {
    console.error("[api/customers DELETE] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete customer" });
  }
};

/**
 * GET /api/customers/top
 */
export const handleTopCustomers: RequestHandler = async (req, res) => {
  try {
    const { userId, limit = 10 } = req.query;

    let customers = getCollection(CUSTOMERS_COLLECTION);

    if (userId) {
      customers = customers.filter((c: any) => c.userId === userId);
    }

    // Sort by total spent descending
    customers = customers
      .sort((a: any, b: any) => (b.totalSpent || 0) - (a.totalSpent || 0))
      .slice(0, Number(limit));

    return res.json(customers);
  } catch (error) {
    console.error("[api/customers/top] Error:", error);
    return res.status(500).json({ error: "Failed to fetch top customers" });
  }
};

/**
 * GET /api/customers/birthday-notifications
 */
export const handleBirthdayNotifications: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.query;

    let customers = getCollection(CUSTOMERS_COLLECTION);

    if (userId) {
      customers = customers.filter((c: any) => c.userId === userId);
    }

    // Filter customers with birthdays today
    const today = new Date();
    const todayStr = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const birthdays = customers.filter((c: any) => {
      if (!c.birthDate) return false;
      const birthDateStr = c.birthDate.substring(5, 10); // MM-DD from YYYY-MM-DD
      return birthDateStr === todayStr;
    });

    return res.json(birthdays);
  } catch (error) {
    console.error("[api/customers/birthday-notifications] Error:", error);
    return res.status(500).json({ error: "Failed to fetch birthday notifications" });
  }
};

