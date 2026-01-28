/**
 * OFFLINE-COMPATIBLE USERS ROUTES
 * 
 * Handles user management for offline Electron app using local JSON database.
 */

import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { 
  findDocuments, 
  findOneDocument, 
  addDocument, 
  updateDocument, 
  deleteDocument,
  getCollection 
} from "../db/local-db";

const USERS_COLLECTION = "users";
const PRODUCTS_COLLECTION = "products";

/**
 * GET /api/users - Get all users
 */
export async function handleUsersGet(req: Request, res: Response) {
  try {
    const { userId, userRole } = req.query;

    let users = getCollection(USERS_COLLECTION);

    // Filter based on role
    if (userId && userRole) {
      if (userRole === 'egasi') {
        // Owner sees: own users + other owners + users without createdBy
        users = users.filter((u: any) => 
          u.createdBy === userId || 
          u.role === 'egasi' || 
          !u.createdBy ||
          u.createdByRole === 'egasi'
        );
        // Exclude users created by admin
        users = users.filter((u: any) => u.createdByRole !== 'admin');
      } else if (userRole === 'admin') {
        // Admin sees: only own users + self
        users = users.filter((u: any) => 
          u.createdBy === userId || 
          u._id === userId
        );
      }
    }

    // Remove passwords
    const safeUsers = users.map((u: any) => {
      const { password, ...userWithoutPassword } = u;
      return userWithoutPassword;
    });

    // Sort by creation date
    safeUsers.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.json({
      success: true,
      users: safeUsers,
    });
  } catch (error) {
    console.error("[api/users GET] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
}

/**
 * POST /api/users - Create new user
 */
export async function handleUserCreate(req: Request, res: Response) {
  try {
    const {
      name,
      phone,
      password,
      address = "",
      role = "xodim",
      createdBy,
      createdByRole,
      canEditProducts = false,
    } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: "Name, phone, and password are required",
      });
    }

    // Check if user already exists
    const existingUser = findOneDocument(USERS_COLLECTION, { phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User with this phone already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = addDocument(USERS_COLLECTION, {
      name: name.trim(),
      phone: phone.trim(),
      password: hashedPassword,
      address: address.trim(),
      role,
      createdBy: createdBy || undefined,
      createdByRole: createdByRole || undefined,
      canEditProducts,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;

    return res.status(201).json({
      success: true,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("[api/users POST] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to create user" });
  }
}

/**
 * PUT /api/users/:id - Update user
 */
export async function handleUserUpdate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      address,
      role,
      canEditProducts,
      password,
    } = req.body;

    const user = findOneDocument(USERS_COLLECTION, { _id: id });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (address !== undefined) updateData.address = address.trim();
    if (role !== undefined) updateData.role = role;
    if (canEditProducts !== undefined) updateData.canEditProducts = canEditProducts;

    // Hash new password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = updateDocument(USERS_COLLECTION, id, updateData);

    if (!updatedUser) {
      return res.status(500).json({ success: false, error: "Failed to update user" });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;

    return res.json({
      success: true,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("[api/users PUT] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to update user" });
  }
}

/**
 * DELETE /api/users/:id - Delete user
 */
export async function handleUserDelete(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const user = findOneDocument(USERS_COLLECTION, { _id: id });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Delete user's products
    const products = findDocuments(PRODUCTS_COLLECTION, { userId: id });
    for (const product of products) {
      deleteDocument(PRODUCTS_COLLECTION, product._id);
    }

    // Delete user
    const deleted = deleteDocument(USERS_COLLECTION, id);

    if (!deleted) {
      return res.status(500).json({ success: false, error: "Failed to delete user" });
    }

    return res.json({
      success: true,
      message: "User deleted",
      deletedProductsCount: products.length,
    });
  } catch (error) {
    console.error("[api/users DELETE] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete user" });
  }
}

