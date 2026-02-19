import { RequestHandler } from "express";
import mongoose from "mongoose";
import { connectMongo } from "../mongo";

const ObjectId = mongoose.Types.ObjectId;
const CUSTOMER_DATA_COLLECTION = "customer_data";

/**
 * GET /api/customer-data
 * Get all customer data for a user
 */
export const handleCustomerDataGet: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const userId = req.query.userId as string | undefined;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const db = conn.db;
    const collection = db.collection(CUSTOMER_DATA_COLLECTION);

    const customers = await collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    const customersWithId = customers.map((c: any) => ({
      ...c,
      id: c._id.toString(),
    }));

    return res.json(customersWithId);
  } catch (error) {
    console.error("[api/customer-data GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch customer data" });
  }
};

/**
 * POST /api/customer-data
 * Create new customer data
 */
export const handleCustomerDataCreate: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const { name, phone, address, carModel, userId } = req.body;

    if (!name || !phone || !userId) {
      return res.status(400).json({ error: "name, phone, and userId are required" });
    }

    const db = conn.db;
    const collection = db.collection(CUSTOMER_DATA_COLLECTION);

    const newCustomer = {
      name: name.trim(),
      phone: phone.trim(),
      address: address?.trim() || "",
      carModel: carModel?.trim() || "",
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(newCustomer);

    return res.status(201).json({
      success: true,
      customer: {
        ...newCustomer,
        id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error("[api/customer-data POST] Error:", error);
    return res.status(500).json({ error: "Failed to create customer data" });
  }
};

/**
 * PUT /api/customer-data/:id
 * Update customer data
 */
export const handleCustomerDataUpdate: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const { id } = req.params;
    const idStr = Array.isArray(id) ? id[0] : id;
    
    if (!ObjectId.isValid(idStr)) {
      return res.status(400).json({ error: "Invalid customer ID" });
    }

    const { name, phone, address, carModel } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "name and phone are required" });
    }

    const db = conn.db;
    const collection = db.collection(CUSTOMER_DATA_COLLECTION);

    const updateData = {
      name: name.trim(),
      phone: phone.trim(),
      address: address?.trim() || "",
      carModel: carModel?.trim() || "",
      updatedAt: new Date(),
    };

    const result = await collection.updateOne(
      { _id: new ObjectId(idStr) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    return res.json({
      success: true,
      message: "Customer updated successfully",
    });
  } catch (error) {
    console.error("[api/customer-data PUT] Error:", error);
    return res.status(500).json({ error: "Failed to update customer data" });
  }
};

/**
 * DELETE /api/customer-data/:id
 * Delete customer data
 */
export const handleCustomerDataDelete: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const { id } = req.params;
    const idStr = Array.isArray(id) ? id[0] : id;
    
    if (!ObjectId.isValid(idStr)) {
      return res.status(400).json({ error: "Invalid customer ID" });
    }

    const db = conn.db;
    const collection = db.collection(CUSTOMER_DATA_COLLECTION);

    const result = await collection.deleteOne({ _id: new ObjectId(idStr) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    return res.json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.error("[api/customer-data DELETE] Error:", error);
    return res.status(500).json({ error: "Failed to delete customer data" });
  }
};
