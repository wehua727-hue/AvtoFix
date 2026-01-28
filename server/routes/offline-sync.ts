/**
 * OFFLINE SALES SYNC API
 * Offline sotuvlarni MongoDB ga yuklash
 * 
 * POST /api/sales/offline-sync
 * 
 * Body:
 * - sales: OfflineSale[]
 * - userId: string
 * 
 * Features:
 * - Deduplication (takroriy yuklashni oldini olish)
 * - Stock deduction (ombor kamaytirish)
 * - Conflict resolution
 */

import { Request, Response } from 'express';
import { connectMongo } from '../mongo';
import { ProductModel } from '../product.model';
import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
import { wsManager } from '../websocket';

// ============================================
// UNIVERSAL STOCK UPDATE FUNCTION
// ============================================

/**
 * Ota mahsulot tugaganda birinchi xilni mustaqil mahsulotga aylantirish
 * va qolgan xillarni unga meros qilish
 * 
 * Misol:
 * - Ota mahsulot: "Bolt" (stock: 0)
 *   - Xil 1: "Shaxruz" (stock: 20)
 *   - Xil 2: "Rol" (stock: 30)
 * 
 * Natija:
 * - Ota mahsulot yashiriladi (isHidden: true)
 * - "Shaxruz" mustaqil mahsulot bo'ladi (stock: 20)
 *   - Xil 1: "Rol" (stock: 30)
 */
async function promoteFirstVariantToProduct(
  parentProductId: string,
  parentProduct: any,
  userId: string
): Promise<{ promoted: boolean; newProductId?: string }> {
  try {
    const variants = parentProduct.variantSummaries || [];
    if (variants.length === 0) {
      console.log(`[Offline Sync] No variants to promote for: ${parentProductId}`);
      return { promoted: false };
    }

    // Birinchi xilni olish (bu yangi "ota" bo'ladi)
    const firstVariant = variants[0];
    const remainingVariants = variants.slice(1);

    console.log(`[Offline Sync] Promoting variant "${firstVariant.name}" to product`);
    console.log(`[Offline Sync] Remaining variants: ${remainingVariants.length}`);

    // Yangi mahsulot yaratish (birinchi xildan)
    const newProduct = new ProductModel({
      name: firstVariant.name,
      sku: firstVariant.sku || parentProduct.sku,
      price: firstVariant.price || parentProduct.price,
      basePrice: firstVariant.basePrice || parentProduct.basePrice,
      priceMultiplier: firstVariant.priceMultiplier || parentProduct.priceMultiplier,
      currency: firstVariant.currency || parentProduct.currency || 'UZS',
      stock: firstVariant.stock || 0,
      categoryId: parentProduct.categoryId,
      status: firstVariant.status || 'available',
      description: parentProduct.description,
      userId: userId,
      // Qolgan xillarni meros qilish
      variantSummaries: remainingVariants,
      // Ota mahsulotdan meros
      parentProductId: undefined,
      childProducts: [],
      isHidden: false,
    });

    await newProduct.save();
    console.log(`[Offline Sync] New product created: ${newProduct._id} (${firstVariant.name})`);

    // Eski ota mahsulotni yashirish
    await ProductModel.findByIdAndUpdate(parentProductId, {
      $set: {
        isHidden: true,
        updatedAt: new Date()
      }
    });
    console.log(`[Offline Sync] Parent product hidden: ${parentProductId}`);

    return {
      promoted: true,
      newProductId: newProduct._id.toString()
    };
  } catch (error) {
    console.error(`[Offline Sync] Failed to promote variant:`, error);
    return { promoted: false };
  }
}

/**
 * Универсальная функция обновления stock в MongoDB
 * Поддерживает обычные продукты и варианты (variantSummaries)
 * 
 * @param productId - ID продукта в MongoDB
 * @param variantIndex - Индекс варианта в массиве variantSummaries (если null - обновляется обычный продукт)
 * @param newStock - Новое значение stock
 * @param product - Опционально: уже загруженный продукт (для оптимизации, чтобы избежать лишнего запроса)
 */
async function updateStock(
  productId: string, 
  variantIndex: number | null, 
  newStock: number,
  product?: any
): Promise<void> {
  try {
    if (variantIndex !== null && variantIndex !== undefined) {
      // --- ОБНОВЛЕНИЕ ВАРИАНТА ---
      // Используем переданный продукт или загружаем его
      const productDoc = product || await ProductModel.findById(productId);
      
      if (!productDoc) {
        console.error(`[Offline Sync] Product not found: ${productId}`);
        return;
      }
      
      if (!productDoc.variantSummaries || !productDoc.variantSummaries[variantIndex]) {
        console.error(`[Offline Sync] Variant not found: ${productId}[${variantIndex}]`);
        return;
      }
      
      // Обновляем вариант через прямое указание пути к элементу массива
      // Используем путь variantSummaries.${index}.stock для обновления конкретного элемента
      const updatePath = `variantSummaries.${variantIndex}.stock`;
      
      const updated = await ProductModel.findByIdAndUpdate(
        productId,
        { 
          $set: { 
            [updatePath]: newStock,
            updatedAt: new Date()
          } 
        },
        { new: true }
      );
      
      if (!updated) {
        console.error(`[Offline Sync] Failed to update variant stock: ${productId}[${variantIndex}]`);
        return;
      }
      
      console.log(`[Offline Sync] Variant stock updated: ${productId}[${variantIndex}] = ${newStock}`);
      
      // Проверяем, что stock действительно обновился
      const verify = await ProductModel.findById(productId);
      const verifiedStock = verify?.variantSummaries?.[variantIndex]?.stock;
      
      console.log(`[Offline Sync] Verified variant stock in MongoDB: ${verifiedStock}`);
      
      if (verifiedStock !== newStock) {
        console.error(`[Offline Sync] Stock verification failed! Expected: ${newStock}, Got: ${verifiedStock}`);
      }
      
      return;
    }
    
    // --- ОБНОВЛЕНИЕ ОБЫЧНОГО ПРОДУКТА ---
    // Используем переданный продукт или загружаем его
    const productDoc = product || await ProductModel.findById(productId);
    
    if (!productDoc) {
      console.error(`[Offline Sync] Product not found: ${productId}`);
      return;
    }
    
    const productUpdated = await ProductModel.findByIdAndUpdate(
      productId,
      { 
        $set: { 
          stock: newStock,
          updatedAt: new Date()
        } 
      },
      { new: true }
    );
    
    console.log(`[Offline Sync] Product stock updated: ${productId} = ${newStock}`);
    
    // Проверяем, что stock действительно обновился
    const verifyProduct = await ProductModel.findById(productId);
    const verifiedStock = verifyProduct?.stock;
    
    console.log(`[Offline Sync] Verified product stock in MongoDB: ${verifiedStock}`);
    
    if (verifiedStock !== newStock) {
      console.error(`[Offline Sync] Stock verification failed! Expected: ${newStock}, Got: ${verifiedStock}`);
    }
    
  } catch (err) {
    console.error(`[Offline Sync] Stock update error for ${productId}${variantIndex !== null ? `[${variantIndex}]` : ''}:`, err);
    throw err;
  }
}

// ============================================
// OFFLINE SALE MODEL
// ============================================

interface IOfflineSaleItem {
  productId: string;
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  discount: number;
}

interface IOfflineSale extends Document {
  offlineId: string;        // Client-side UUID (deduplication uchun)
  recipientNumber: string;
  items: IOfflineSaleItem[];
  total: number;
  discount: number;
  paymentType: string;
  saleType: 'sale' | 'refund';
  userId: string;
  offlineCreatedAt: Date;   // Client-side timestamp
  syncedAt: Date;           // Server-side timestamp
}

const OfflineSaleItemSchema = new Schema<IOfflineSaleItem>({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  sku: { type: String },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 }
}, { _id: false });

const OfflineSaleSchema = new Schema<IOfflineSale>({
  offlineId: { type: String, required: true, unique: true, index: true },
  recipientNumber: { type: String, required: true, index: true },
  items: [OfflineSaleItemSchema],
  total: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  paymentType: { type: String, required: true },
  saleType: { type: String, enum: ['sale', 'refund'], default: 'sale' },
  userId: { type: String, required: true, index: true },
  offlineCreatedAt: { type: Date, required: true },
  syncedAt: { type: Date, default: Date.now }
});

const OfflineSaleModel = mongoose.models.OfflineSale || 
  mongoose.model<IOfflineSale>('OfflineSale', OfflineSaleSchema);

// ============================================
// SYNC HANDLER
// ============================================

interface OfflineSaleInput {
  id: string;
  recipientNumber: string;
  items: IOfflineSaleItem[];
  total: number;
  discount: number;
  paymentType: string;
  saleType: 'sale' | 'refund';
  createdAt: number;
  userId: string;
}

interface SyncResult {
  success: boolean;
  syncedIds: string[];
  errors: { id: string; error: string }[];
}

export async function handleOfflineSalesSync(req: Request, res: Response) {
  try {
    const { sales, userId } = req.body as { 
      sales: OfflineSaleInput[]; 
      userId: string 
    };

    console.log('[Offline Sync] Received sync request:', { salesCount: sales?.length, userId });
    console.log('[Offline Sync] 🔍 USER INFO: userId=', userId);
    console.log('[Offline Sync] 🔍 CHECKING: Does this user have permission to update stock?');

    if (!sales || !Array.isArray(sales)) {
      return res.status(400).json({ 
        success: false, 
        error: 'sales array required' 
      });
    }

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId required' 
      });
    }

    await connectMongo();

    console.log('[Offline Sync] Processing', sales.length, 'sales...');


    const result: SyncResult = {
      success: true,
      syncedIds: [],
      errors: []
    };

    // Process each sale
    for (const sale of sales) {
      try {
        // 1. Check for duplicate (deduplication)
        const existing = await OfflineSaleModel.findOne({ 
          offlineId: sale.id 
        });

        if (existing) {
          result.syncedIds.push(sale.id); // Mark as synced anyway
          continue;
        }

        // 2. Create sale record
        await OfflineSaleModel.create({
          offlineId: sale.id,
          recipientNumber: sale.recipientNumber,
          items: sale.items,
          total: sale.total,
          discount: sale.discount,
          paymentType: sale.paymentType,
          saleType: sale.saleType,
          userId: sale.userId,
          offlineCreatedAt: new Date(sale.createdAt),
          syncedAt: new Date()
        });
        
        console.log('[Offline Sync] ✅ Sale record created:', sale.id);

        // 3. Stock yangilash - FAQAT OFFLINE REJIMDA (client-side allaqachon kamaytirgan)
        // MUHIM: Client-side completeSale funksiyasida stock kamaytirish allaqachon bo'lgan
        // Shuning uchun sync endpoint'ida stock kamaytirish o'tkazib yuborish kerak
        // Agar sync endpoint'ida yana kamaytirilyapti, duplikat kamaytirish bo'ladi!
        
        // DEPRECATED: Stock kamaytirish sync endpoint'ida o'tkazib yuborildi
        // Sabab: Client-side completeSale funksiyasida stock kamaytirish allaqachon bo'lgan
        // Agar bu yerda yana kamaytirilyapti, duplikat kamaytirish bo'ladi
        
        console.log('[Offline Sync] ⚠️ Stock update skipped (already updated on client-side)');

        result.syncedIds.push(sale.id);

        // WebSocket orqali mahsulot yangilanganini xabar berish
        for (const item of sale.items) {
          const variantMatch = item.productId.match(/^(.+)-v(\d+)$/);
          const productId = variantMatch ? variantMatch[1] : item.productId;
          
          wsManager.broadcastToUser(userId, {
            type: 'product-updated',
            productId: productId,
            productName: item.name,
            source: 'offline-sync' // offline-sync dan kelganini belgilash
          });
        }

      } catch (error: any) {
        console.error(`[Offline Sync] Sale error ${sale.id}:`, error);
        result.errors.push({
          id: sale.id,
          error: error.message
        });
      }
    }


    res.json(result);

  } catch (error: any) {
    console.error('[Offline Sync] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      syncedIds: [],
      errors: []
    });
  }
}

// ============================================
// STATISTICS HANDLERS
// ============================================

export async function handleOfflineSalesStats(req: Request, res: Response) {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'userId required',
      });
    }

    await connectMongo();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6); // last 7 days including today

    // Daily stats (today only)
    const [dailyAgg] = await OfflineSaleModel.aggregate([
      {
        $match: {
          userId,
          saleType: 'sale',
          offlineCreatedAt: { $gte: today },
        },
      },
      {
        $unwind: '$items',
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalOrders: { $addToSet: '$_id' },
          totalSales: { $sum: '$items.quantity' },
          customers: { $addToSet: '$customerId' }, // Mijozlar
        },
      },
      {
        $project: {
          _id: 0,
          totalRevenue: 1,
          totalSales: 1,
          totalOrders: { $size: '$totalOrders' },
          totalCustomers: { 
            $size: { 
              $filter: { 
                input: '$customers', 
                as: 'c', 
                cond: { $ne: ['$$c', null] } 
              } 
            } 
          },
        },
      },
    ]);

    // Top mahsulotlar (bugun)
    const topProductsAgg = await OfflineSaleModel.aggregate([
      {
        $match: {
          userId,
          saleType: 'sale',
          offlineCreatedAt: { $gte: today },
        },
      },
      {
        $unwind: '$items',
      },
      {
        $group: {
          _id: '$items.name',
          name: { $first: '$items.name' },
          sales: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        },
      },
      {
        $sort: { sales: -1 },
      },
      {
        $limit: 5,
      },
      {
        $project: {
          _id: 0,
          name: 1,
          sales: 1,
          revenue: 1,
        },
      },
    ]);

    // Weekly stats (last 7 days)
    const weeklyAgg = await OfflineSaleModel.aggregate([
      {
        $match: {
          userId,
          saleType: 'sale',
          offlineCreatedAt: { $gte: weekStart },
        },
      },
      {
        $addFields: {
          day: {
            $dateToString: { format: '%Y-%m-%d', date: '$offlineCreatedAt' },
          },
        },
      },
      {
        $unwind: '$items',
      },
      {
        $group: {
          _id: { day: '$day' },
          totalRevenue: { $sum: '$total' },
          orderIds: { $addToSet: '$_id' },
          totalSales: { $sum: '$items.quantity' },
        },
      },
      {
        $project: {
          _id: 0,
          day: '$_id.day',
          totalRevenue: 1,
          totalSales: 1,
          totalOrders: { $size: '$orderIds' },
        },
      },
      {
        $sort: { day: 1 },
      },
    ]);

    // Haftalik top mahsulotlar
    const weeklyTopProductsAgg = await OfflineSaleModel.aggregate([
      {
        $match: {
          userId,
          saleType: 'sale',
          offlineCreatedAt: { $gte: weekStart },
        },
      },
      {
        $unwind: '$items',
      },
      {
        $group: {
          _id: '$items.name',
          name: { $first: '$items.name' },
          sales: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        },
      },
      {
        $sort: { sales: -1 },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          _id: 0,
          name: 1,
          sales: 1,
          revenue: 1,
        },
      },
    ]);

    // Правильные сокращения дней недели для графиков
    const weekDaysShort = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];


    const dailyData: { day: string; sales: number; revenue: number; orders: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = weekDaysShort[d.getDay()];

      const dayAgg = weeklyAgg.find((w: any) => w.day === dateStr);

      const dayData = {
        day: dayName,
        sales: dayAgg?.totalSales || 0,
        revenue: dayAgg?.totalRevenue || 0,
        orders: dayAgg?.totalOrders || 0,
      };

      dailyData.push(dayData);
      
      if (dayAgg) {
      }
    }


    const weeklyTotals = dailyData.reduce(
      (acc, d) => {
        acc.totalSales += d.sales;
        acc.totalRevenue += d.revenue;
        acc.totalOrders += d.orders;
        return acc;
      },
      { totalSales: 0, totalRevenue: 0, totalOrders: 0 }
    );

    res.json({
      success: true,
      daily: {
        totalSales: dailyAgg?.totalSales || 0,
        totalRevenue: dailyAgg?.totalRevenue || 0,
        totalOrders: dailyAgg?.totalOrders || 0,
        totalCustomers: dailyAgg?.totalCustomers || 0,
        topProducts: topProductsAgg || [],
      },
      weekly: {
        totalSales: weeklyTotals.totalSales,
        totalRevenue: weeklyTotals.totalRevenue,
        totalOrders: weeklyTotals.totalOrders,
        dailyData,
        topProducts: weeklyTopProductsAgg || [],
      },
    });
  } catch (error: any) {
    console.error('[Offline Sales] Stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Offline sotuvlarni o'chirish
// days=0 yoki days berilmasa - BARCHA sotuvlarni o'chirish
// days=7 - faqat 7 kundan eski sotuvlarni o'chirish
export async function handleOfflineSalesCleanup(req: Request, res: Response) {
  try {
    const { userId, days } = req.query;

    await connectMongo();

    const match: any = {};

    // userId bo'lsa, faqat shu foydalanuvchining sotuvlarini o'chirish
    if (userId && typeof userId === 'string') {
      match.userId = userId;
    }

    // days parametri berilgan va 0 dan katta bo'lsa, faqat eski sotuvlarni o'chirish
    // days berilmagan yoki 0 bo'lsa - BARCHA sotuvlarni o'chirish
    const olderThanDays = days !== undefined ? Number(days) : 0;
    
    if (!Number.isNaN(olderThanDays) && olderThanDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);
      match.offlineCreatedAt = { $lt: cutoff };
    }

    console.log('[Offline Sales] Cleanup match:', match);

    const result = await OfflineSaleModel.deleteMany(match);

    console.log('[Offline Sales] Cleanup result:', result.deletedCount);

    res.json({
      success: true,
      deletedCount: result.deletedCount || 0,
      olderThanDays: olderThanDays || 'all',
    });
  } catch (error: any) {
    console.error('[Offline Sales] Cleanup error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Offline sotuvlar tarixini olish
 */
export async function handleGetOfflineSales(req: Request, res: Response) {
  try {
    const { userId, limit = 1000, offset = 0 } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId required' 
      });
    }

    await connectMongo();

    const sales = await OfflineSaleModel
      .find({ userId: userId as string })
      .sort({ offlineCreatedAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .lean();

    const total = await OfflineSaleModel.countDocuments({ 
      userId: userId as string 
    });

    res.json({
      success: true,
      sales,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });

  } catch (error: any) {
    console.error('[Offline Sales] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * Tarixni butunlay tozalash
 * DELETE /api/sales/clear-history?userId=...
 * 
 * Faqat egasi (owner) uchun
 * Barcha sotuvlar tarixini o'chirib yuboradi
 */
export async function handleClearHistory(req: Request, res: Response) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId required' 
      });
    }

    console.log(`[Clear History] Clearing all sales for user: ${userId}`);

    await connectMongo();

    // Barcha sotuvlarni o'chirish
    const result = await OfflineSaleModel.deleteMany({ 
      userId: userId as string 
    });

    console.log(`[Clear History] Deleted ${result.deletedCount} sales for user: ${userId}`);

    res.json({
      success: true,
      message: 'Tarix tozalandi',
      deletedCount: result.deletedCount
    });

  } catch (error: any) {
    console.error('[Clear History] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
