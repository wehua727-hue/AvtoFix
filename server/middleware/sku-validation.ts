import { Request, Response, NextFunction } from 'express';
import { validateProductSkus } from '../utils/sku-validator';

/**
 * Middleware - Mahsulot yaratish/yangilashdan oldin SKU validation
 */
export const validateSkuMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sku, variantSummaries, userId } = req.body;
    const productId = req.params.id; // Update uchun
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId majburiy'
      });
    }

    // Database connection
    const db = (req as any).db; // Middleware orqali o'tkazilgan db
    if (!db) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available'
      });
    }

    // SKU validation
    const validation = await validateProductSkus(
      {
        sku: sku?.trim(),
        variantSummaries: variantSummaries
      },
      {
        userId: userId,
        currentProductId: productId, // Update qilayotganda o'z ID sini exclude qilish
        db: db,
        collection: process.env.OFFLINE_PRODUCTS_COLLECTION || 'products'
      }
    );

    if (!validation.isValid) {
      console.log('[SKU Middleware] Validation failed:', validation.error);
      return res.status(400).json({
        success: false,
        error: validation.error,
        suggestedSku: validation.suggestedSku
      });
    }

    // Validation o'tdi - keyingi middleware ga o'tish
    next();
    
  } catch (error) {
    console.error('[SKU Middleware] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'SKU validation da xatolik yuz berdi'
    });
  }
};

/**
 * Database connection middleware
 */
export const dbConnectionMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { connectMongo } = require('../mongo');
    const conn = await connectMongo();
    
    if (!conn || !conn.db) {
      return res.status(500).json({ 
        success: false, 
        error: "Database not available" 
      });
    }

    // Database ni request ga qo'shish
    (req as any).db = conn.db;
    next();
    
  } catch (error) {
    console.error('[DB Middleware] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Database connection failed'
    });
  }
};