import { Request, Response, NextFunction } from 'express';
import { generateNextSku } from '../utils/auto-sku-generator';

/**
 * Middleware - SKU larni avtomatik tartiblab berish (duplicate bo'lsa yangi SKU berish)
 */
export const autoSkuMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId majburiy'
      });
    }

    const db = (req as any).db;
    if (!db) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available'
      });
    }

    const collection = process.env.OFFLINE_PRODUCTS_COLLECTION || 'products';
    const productsCollection = db.collection(collection);
    const productId = req.params.id; // Update uchun

    // Barcha ishlatilgan SKU larni olish
    const allProducts = await productsCollection.find({ userId }).toArray();
    const usedSkus = new Set<string>();
    
    // Hozirgi mahsulotni exclude qilish (update qilayotganda)
    for (const product of allProducts) {
      if (productId && product._id.toString() === productId) {
        continue; // O'z mahsulotini o'tkazib yuborish
      }
      
      // Asosiy SKU
      if (product.sku && product.sku.trim()) {
        usedSkus.add(product.sku.trim());
      }
      
      // Variant SKU lar
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        for (const variant of product.variantSummaries) {
          if (variant.sku && variant.sku.trim()) {
            usedSkus.add(variant.sku.trim());
          }
        }
      }
    }

    // Keyingi mavjud SKU ni topish
    let nextSku = 1;
    const numericSkus = Array.from(usedSkus)
      .