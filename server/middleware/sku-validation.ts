import { Request, Response, NextFunction } from 'express';

/**
 * Middleware - SKU larni avtomatik tartiblab berish
 */
export const validateSkuMiddleware = async (req: Request, res: Response, next: NextFunction) => {
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
    const productId = req.params.id;

    // Barcha ishlatilgan SKU larni olish
    const allProducts = await productsCollection.find({ userId }).toArray();
    const usedSkus = new Set<string>();
    
    for (const product of allProducts) {
      if (productId && product._id.toString() === productId) continue;
      
      if (product.sku && product.sku.trim()) {
        usedSkus.add(product.sku.trim());
      }
      
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        for (const variant of product.variantSummaries) {
          if (variant.sku && variant.sku.trim()) {
            usedSkus.add(variant.sku.trim());
          }
        }
      }
    }

    // Keyingi SKU ni topish - bo'sh joylarni to'ldirish
    let nextSku = 1;
    
    // 1 dan boshlab bo'sh joyni topish
    while (usedSkus.has(nextSku.toString())) {
      nextSku++;
    }

    // Asosiy SKU ni tekshirish va tuzatish
    if (!req.body.sku || !req.body.sku.trim() || usedSkus.has(req.body.sku.trim())) {
      req.body.sku = nextSku.toString();
      usedSkus.add(nextSku.toString());
      nextSku++;
      
      // Keyingi bo'sh joyni topish
      while (usedSkus.has(nextSku.toString())) {
        nextSku++;
      }
    }

    // Variant SKU larni tekshirish va tuzatish
    if (req.body.variantSummaries && Array.isArray(req.body.variantSummaries)) {
      for (let i = 0; i < req.body.variantSummaries.length; i++) {
        const variant = req.body.variantSummaries[i];
        if (!variant.sku || !variant.sku.trim() || usedSkus.has(variant.sku.trim())) {
          req.body.variantSummaries[i].sku = nextSku.toString();
          usedSkus.add(nextSku.toString());
          nextSku++;
          
          // Keyingi bo'sh joyni topish
          while (usedSkus.has(nextSku.toString())) {
            nextSku++;
          }
        }
      }
    }

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
    const { connectMongo } = await import('../mongo');
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