/**
 * MARKETPLACE INTEGRATION API
 * Marketplace'dan savdo bo'lganda ombor kamaytirish uchun webhook endpoint
 * 
 * POST /api/marketplace/order
 * 
 * Body:
 * {
 *   "orderId": "marketplace-order-123",
 *   "items": [
 *     {
 *       "productId": "mongodb-product-id",
 *       "sku": "SKU123",
 *       "name": "Mahsulot nomi",
 *       "quantity": 2,
 *       "price": 50000,
 *       "variantIndex": null // yoki variant index (agar variant bo'lsa)
 *     }
 *   ],
 *   "total": 100000,
 *   "customerPhone": "+998901234567",
 *   "customerName": "Mijoz ismi",
 *   "userId": "user-id" // Mahsulot egasining ID si
 * }
 */

import { Request, Response } from 'express';
import { connectMongo } from '../mongo';
import { ObjectId } from 'mongodb';
import { wsManager } from '../websocket';
import mongoose from 'mongoose';

// Asosiy products kolleksiyasi - post tizimi bilan bir xil bo'lishi uchun
const PRODUCTS_COLLECTION = process.env.OFFLINE_PRODUCTS_COLLECTION || 'products';

interface MarketplaceOrderItem {
  productId: string;
  sku?: string;
  name: string;
  quantity: number;
  price: number;
  variantIndex?: number | null; // Variant index yoki null
}

interface MarketplaceOrder {
  orderId: string;
  items: MarketplaceOrderItem[];
  total: number;
  customerPhone?: string;
  customerName?: string;
  userId: string; // Mahsulot egasining ID si
  createdAt?: string | Date;
}

/**
 * Marketplace'dan kelgan buyurtmani qayta ishlash va ombor kamaytirish
 */
export async function handleMarketplaceOrder(req: Request, res: Response) {
  try {
    console.log('[Marketplace] ========== NEW ORDER ==========');
    console.log('[Marketplace] Body:', JSON.stringify(req.body, null, 2));

    const order: MarketplaceOrder = req.body;

    // Validatsiya
    if (!order.orderId || !order.items || !Array.isArray(order.items) || !order.userId) {
      return res.status(400).json({
        success: false,
        error: 'orderId, items (array), va userId majburiy'
      });
    }

    if (order.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Items bo\'sh bo\'lishi mumkin emas'
      });
    }

    await connectMongo();

    const results = [];
    const errors = [];

    // Har bir mahsulot uchun ombor kamaytirish
    for (const item of order.items) {
      try {
        console.log(`[Marketplace] Processing item: ${item.name} (qty: ${item.quantity})`);

        // Product ID ni tekshirish
        if (!ObjectId.isValid(item.productId)) {
          errors.push({
            productId: item.productId,
            sku: item.sku,
            name: item.name,
            error: 'Invalid product ID'
          });
          continue;
        }

        const conn = await connectMongo();
        if (!conn?.db) {
          errors.push({
            productId: item.productId,
            sku: item.sku,
            name: item.name,
            error: 'Database not available'
          });
          continue;
        }

        const collection = conn.db.collection(PRODUCTS_COLLECTION);

        // Mahsulotni topish
        const product = await collection.findOne({ _id: new ObjectId(item.productId) });

        if (!product) {
          errors.push({
            productId: item.productId,
            sku: item.sku,
            name: item.name,
            error: 'Product not found'
          });
          continue;
        }

        // User ID ni tekshirish (faqat o'z mahsulotlarini kamaytirish)
        if (product.userId && product.userId !== order.userId) {
          errors.push({
            productId: item.productId,
            sku: item.sku,
            name: item.name,
            error: 'Product does not belong to this user'
          });
          continue;
        }

        let updatedStock: number;
        let updateResult: any;

        // Variant yoki asosiy mahsulot?
        if (item.variantIndex !== null && item.variantIndex !== undefined && product.variantSummaries?.[item.variantIndex]) {
          // VARIANT STOCK KAMAYTIRISH
          const variant = product.variantSummaries[item.variantIndex];
          const currentStock = variant.stock ?? 0;
          
          if (currentStock < item.quantity) {
            errors.push({
              productId: item.productId,
              sku: item.sku || variant.sku,
              name: item.name,
              variantIndex: item.variantIndex,
              error: `Insufficient stock. Available: ${currentStock}, Requested: ${item.quantity}`
            });
            continue;
          }

          updatedStock = Math.max(0, currentStock - item.quantity);

          // Variantni yangilash
          const updatedVariants = [...product.variantSummaries];
          updatedVariants[item.variantIndex] = {
            ...variant,
            stock: updatedStock,
            stockCount: updatedStock // legacy field uchun
          };

          updateResult = await collection.findOneAndUpdate(
            { _id: new ObjectId(item.productId) },
            {
              $set: {
                variantSummaries: updatedVariants,
                updatedAt: new Date()
              }
            },
            { returnDocument: 'after' }
          );

          console.log(`[Marketplace] ✅ Variant stock updated: ${variant.name} ${currentStock} -> ${updatedStock}`);

        } else {
          // ASOSIY MAHSULOT STOCK KAMAYTIRISH
          const currentStock = product.stock ?? 0;

          if (currentStock < item.quantity) {
            errors.push({
              productId: item.productId,
              sku: item.sku || product.sku,
              name: item.name,
              error: `Insufficient stock. Available: ${currentStock}, Requested: ${item.quantity}`
            });
            continue;
          }

          updatedStock = Math.max(0, currentStock - item.quantity);

          updateResult = await collection.findOneAndUpdate(
            { _id: new ObjectId(item.productId) },
            {
              $set: {
                stock: updatedStock,
                stockCount: updatedStock, // legacy field: stockCount ni ham yangilash
                updatedAt: new Date()
              }
            },
            { returnDocument: 'after' }
          );

          console.log(`[Marketplace] ✅ Product stock updated: ${product.name} ${currentStock} -> ${updatedStock}`);
        }

        // WebSocket orqali yangilanishni yuborish
        if (product.userId) {
          wsManager.broadcastToUser(product.userId, {
            type: 'product-updated',
            productId: item.productId,
            productName: item.name,
            stock: updatedStock,
            stockCount: updatedStock, // legacy field
            variantIndex: item.variantIndex,
            source: 'marketplace',
            timestamp: Date.now(),
          });
        }

        // Muvaffaqiyatli natija
        results.push({
          productId: item.productId,
          sku: item.sku || product.sku,
          name: item.name,
          quantity: item.quantity,
          oldStock: item.variantIndex !== null && item.variantIndex !== undefined 
            ? product.variantSummaries?.[item.variantIndex]?.stock ?? 0
            : product.stock ?? 0,
          newStock: updatedStock,
          variantIndex: item.variantIndex
        });

      } catch (error: any) {
        console.error(`[Marketplace] Error processing item ${item.name}:`, error);
        errors.push({
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          error: error.message || 'Unknown error'
        });
      }
    }

    // Sale record yaratish (offline-sync modelidan foydalanib)
    try {
      const db = mongoose.connection.db;
      if (db) {
        const salesCollection = db.collection('sales');
        
        await salesCollection.insertOne({
          offlineId: `marketplace-${order.orderId}`,
          recipientNumber: order.orderId,
          items: order.items.map(item => ({
            productId: item.productId,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            price: item.price,
            discount: 0
          })),
          total: order.total,
          discount: 0,
          paymentType: 'marketplace',
          saleType: 'sale',
          userId: order.userId,
          offlineCreatedAt: order.createdAt ? new Date(order.createdAt) : new Date(),
          syncedAt: new Date(),
          source: 'marketplace',
          customerPhone: order.customerPhone,
          customerName: order.customerName
        });

        console.log(`[Marketplace] ✅ Sale record created: marketplace-${order.orderId}`);
      }
    } catch (saleError: any) {
      console.error('[Marketplace] Error creating sale record:', saleError);
      // Sale record xatosi ombor kamaytirishni to'xtatmaydi
    }

    // Natijani qaytarish
    const response = {
      success: errors.length === 0,
      orderId: order.orderId,
      processed: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('[Marketplace] ========== ORDER PROCESSED ==========');
    console.log(`[Marketplace] Success: ${results.length}, Failed: ${errors.length}`);

    return res.json(response);

  } catch (error: any) {
    console.error('[Marketplace] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

/**
 * Marketplace'dan kelgan buyurtmalar ro'yxatini olish
 */
export async function handleMarketplaceOrdersGet(req: Request, res: Response) {
  try {
    const { userId, limit = 100, offset = 0 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId required'
      });
    }

    await connectMongo();
    const db = mongoose.connection.db;

    if (!db) {
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }

    const salesCollection = db.collection('sales');

    const orders = await salesCollection
      .find({
        userId: userId as string,
        source: 'marketplace'
      })
      .sort({ syncedAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();

    const total = await salesCollection.countDocuments({
      userId: userId as string,
      source: 'marketplace'
    });

    return res.json({
      success: true,
      orders,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });

  } catch (error: any) {
    console.error('[Marketplace] Get orders error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

