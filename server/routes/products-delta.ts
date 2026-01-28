/**
 * DELTA SYNC API
 * Faqat o'zgargan mahsulotlarni qaytaradi
 * 
 * GET /api/products/delta?since=timestamp&userId=xxx
 * 
 * Response:
 * - newProducts: Yangi qo'shilgan mahsulotlar
 * - updatedProducts: O'zgartirilgan mahsulotlar
 * - deletedProductIds: O'chirilgan mahsulot ID lari
 * - serverTime: Server vaqti (keyingi sync uchun)
 */

import { Request, Response } from 'express';
import { connectMongo } from '../mongo';

// O'chirilgan mahsulotlarni saqlash uchun model
import mongoose, { Schema, Document } from 'mongoose';

interface IDeletedProduct extends Document {
  productId: string;
  userId: string;
  deletedAt: Date;
}

const DeletedProductSchema = new Schema<IDeletedProduct>({
  productId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  deletedAt: { type: Date, default: Date.now, index: true }
});

const DeletedProductModel = mongoose.models.DeletedProduct || 
  mongoose.model<IDeletedProduct>('DeletedProduct', DeletedProductSchema);

// Специальный номер который видит все товары без фильтрации
const ADMIN_PHONE = "910712828";
const normalizePhone = (phone: string) => phone.replace(/[^\d]/g, ""); // Оставляем только цифры

/**
 * Delta sync handler
 */
export async function handleProductsDelta(req: Request, res: Response) {
  console.log("[Delta Sync] HIT");
  try {
    const { since, userId, userPhone } = req.query;
    console.log(`[Delta Sync] Request: since=${since}, userId=${userId}, userPhone=${userPhone}`);
    
    
    // Валидация параметров - если since слишком большой, используем 0
    let validSince = since;
    if (validSince) {
      const sinceNum = Number(validSince);
      const now = Date.now();
      const maxValidTimestamp = now + 86400000; // 24 часа в будущем
      
      if (isNaN(sinceNum) || sinceNum < 0 || sinceNum > maxValidTimestamp) {
        console.warn(`[Delta Sync] Invalid since parameter: ${since}, using 0`);
        validSince = '0';
      }
    }
    
    // userId bo'lmasa ham ishlaydi - barcha mahsulotlarni qaytaradi
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database not available' 
      });
    }
    
    const db = conn.db;
    const productsCollection = db.collection(process.env.OFFLINE_PRODUCTS_COLLECTION || 'products');

    // since parametrini to'g'ri parse qilish
    let sinceTimestamp: Date;
    const now = Date.now();
    const maxValidTimestamp = now + 86400000; // 24 часа в будущем (допустимая погрешность)
    
    // Если validSince уже валидирован и равен '0', используем его
    if (validSince === '0') {
      sinceTimestamp = new Date(0);
    } else if (validSince) {
      const sinceNum = Number(validSince);
      
      // Проверяем валидность timestamp
      if (isNaN(sinceNum) || sinceNum < 0 || sinceNum > maxValidTimestamp) {
        sinceTimestamp = new Date(0);
      } else if (sinceNum > 1e12) {
        // Milliseconds
        sinceTimestamp = new Date(sinceNum);
      } else if (sinceNum > 1e9) {
        // Seconds - convert to milliseconds
        sinceTimestamp = new Date(sinceNum * 1000);
      } else {
        // Слишком маленькое число
        sinceTimestamp = new Date(0);
      }
    } else {
      sinceTimestamp = new Date(0);
    }
    
    // Final validation
    const timestampMs = sinceTimestamp.getTime();
    if (isNaN(timestampMs) || timestampMs > maxValidTimestamp || timestampMs < 0) {
      sinceTimestamp = new Date(0);
    }
    
    const serverTime = Date.now();


    // 1. Yangi va o'zgartirilgan mahsulotlar
    const query: any = {
      updatedAt: { $gt: sinceTimestamp }
    };
    
    // Фильтрация по userId с учетом админа
    const normalizedUserPhone = userPhone ? normalizePhone(userPhone as string) : "";
    const isAdminPhone = normalizedUserPhone === ADMIN_PHONE || normalizedUserPhone.endsWith(ADMIN_PHONE);
    
    if (isAdminPhone && userId) {
      // Админ (910712828) видит:
      // 1. Товары без userId (ничьи товары)
      // 2. Свои товары (созданные им)
      query.$or = [
        { userId: { $exists: false } },
        { userId: null },
        { userId: "" },
        { userId: userId as string }
      ];
    } else if (userId) {
      // Обычные пользователи видят ТОЛЬКО свои товары
      query.userId = userId as string;
    }
    
    const products = await productsCollection.find(query).toArray();

    // Yangi vs Updated ajratish
    const newProducts = products.filter(p => 
      new Date(p.createdAt).getTime() > sinceTimestamp.getTime()
    );
    const updatedProducts = products.filter(p => 
      new Date(p.createdAt).getTime() <= sinceTimestamp.getTime()
    );

    // 2. O'chirilgan mahsulotlar
    const deleteQuery: any = {
      deletedAt: { $gt: sinceTimestamp }
    };
    
    if (userId) {
      deleteQuery.userId = userId as string;
    }
    
    const deletedRecords = await DeletedProductModel.find(deleteQuery).lean();

    const deletedProductIds = deletedRecords.map(d => d.productId);

    // Format products for client
    const formatProduct = (p: any) => {
      // variantSummaries ni to'g'ri format qilish
      let variantSummaries = [];
      if (Array.isArray(p.variantSummaries)) {
        variantSummaries = p.variantSummaries.map((v: any) => ({
          name: v.name,
          sku: v.sku,
          barcode: v.barcode,
          price: v.price || 0,
          costPrice: v.costPrice,
          currency: v.currency,
          stock: v.stock || 0,
          initialStock: v.initialStock,
          imageUrl: v.imageUrl,
          imagePaths: v.imagePaths
        }));
      }
      
      return {
        id: p._id.toString(),
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        price: p.price || 0,
        basePrice: p.basePrice,
        priceMultiplier: p.priceMultiplier,
        currency: p.currency,
        stock: p.stock || 0,
        initialStock: p.initialStock, // Initial stock ni qo'shish
        categoryId: p.categoryId,
        imageUrl: p.imageUrl,
        imagePaths: p.imagePaths,
        userId: p.userId,
        variantSummaries: variantSummaries, // Variantlarni to'g'ri format qilish
        updatedAt: new Date(p.updatedAt).getTime()
      };
    };


    res.json({
      success: true,
      data: {
        newProducts: newProducts.map(formatProduct),
        updatedProducts: updatedProducts.map(formatProduct),
        deletedProductIds,
        serverTime
      }
    });

  } catch (error: any) {
    console.error('[Delta Sync] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * Mahsulot o'chirilganda chaqiriladi
 */
export async function recordProductDeletion(productId: string, userId: string): Promise<void> {
  try {
    await DeletedProductModel.create({
      productId,
      userId,
      deletedAt: new Date()
    });
  } catch (error) {
    console.error('[Delta Sync] Failed to record deletion:', error);
  }
}

/**
 * Eski deletion recordlarni tozalash (30 kundan eski)
 */
export async function cleanupOldDeletions(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  await DeletedProductModel.deleteMany({
    deletedAt: { $lt: thirtyDaysAgo }
  });
}
