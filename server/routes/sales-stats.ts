/**
 * SALES STATISTICS API
 * Sotuvlar statistikasi - qaytarilgan mahsulotlarni hisobga olgan holda
 * 
 * GET /api/sales/stats/daily?userId=...
 * 
 * Features:
 * - Sotilgan mahsulotlar soni
 * - Qaytarilgan mahsulotlar soni
 * - Sof daromad (sotuvlar - qaytarilganlar)
 * - Mahsulot bo'yicha batafsil statistika
 */

import { Request, Response } from 'express';
import { connectMongo } from '../mongo';
import mongoose, { Schema, Document } from 'mongoose';

// ============================================
// OFFLINE SALE MODEL (reuse from offline-sync)
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
  offlineId: string;
  recipientNumber: string;
  items: IOfflineSaleItem[];
  total: number;
  discount: number;
  paymentType: string;
  saleType: 'sale' | 'refund';
  userId: string;
  offlineCreatedAt: Date;
  syncedAt: Date;
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
// DAILY STATISTICS WITH REFUNDS
// ============================================

export async function handleDailyStats(req: Request, res: Response) {
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

    // Sotuvlar va qaytarilganlarni alohida hisoblash
    const salesAgg = await OfflineSaleModel.aggregate([
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
          _id: { productId: '$items.productId', name: '$items.name' }, // productId va name bo'yicha guruhlash
          productName: { $first: '$items.name' },
          productId: { $first: '$items.productId' },
          sku: { $first: '$items.sku' },
          soldQuantity: { $sum: '$items.quantity' },
          soldRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        },
      },
    ]);

    // Qaytarilganlar
    const refundsAgg = await OfflineSaleModel.aggregate([
      {
        $match: {
          userId,
          saleType: 'refund',
          offlineCreatedAt: { $gte: today },
        },
      },
      {
        $unwind: '$items',
      },
      {
        $group: {
          _id: { productId: '$items.productId', name: '$items.name' }, // productId va name bo'yicha guruhlash
          productName: { $first: '$items.name' },
          productId: { $first: '$items.productId' },
          sku: { $first: '$items.sku' },
          refundedQuantity: { $sum: '$items.quantity' },
          refundedRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        },
      },
    ]);

    // Mahsulotlarni birlashtirish va sof daromadni hisoblash
    const productMap = new Map<string, any>();

    // Sotuvlarni qo'shish
    for (const sale of salesAgg) {
      const key = `${sale.productId}-${sale.productName}`; // Unique key
      productMap.set(key, {
        productName: sale.productName,
        productId: sale.productId,
        sku: sale.sku,
        soldQuantity: sale.soldQuantity,
        soldRevenue: sale.soldRevenue,
        refundedQuantity: 0,
        refundedRevenue: 0,
        netQuantity: sale.soldQuantity,
        netRevenue: sale.soldRevenue,
      });
    }

    // Qaytarilganlarni qo'shish
    for (const refund of refundsAgg) {
      const key = `${refund.productId}-${refund.productName}`; // Unique key
      const existing = productMap.get(key);
      if (existing) {
        existing.refundedQuantity = refund.refundedQuantity;
        existing.refundedRevenue = refund.refundedRevenue;
        existing.netQuantity = existing.soldQuantity - refund.refundedQuantity;
        existing.netRevenue = existing.soldRevenue - refund.refundedRevenue;
      } else {
        // Faqat qaytarilgan, sotilmagan mahsulot
        productMap.set(key, {
          productName: refund.productName,
          productId: refund.productId,
          sku: refund.sku,
          soldQuantity: 0,
          soldRevenue: 0,
          refundedQuantity: refund.refundedQuantity,
          refundedRevenue: refund.refundedRevenue,
          netQuantity: -refund.refundedQuantity,
          netRevenue: -refund.refundedRevenue,
        });
      }
    }

    // Mahsulotlar ro'yxatini massivga aylantirish
    const products = Array.from(productMap.values());

    // Umumiy statistika
    const totalSoldQuantity = products.reduce((sum, p) => sum + p.soldQuantity, 0);
    const totalSoldRevenue = products.reduce((sum, p) => sum + p.soldRevenue, 0);
    const totalRefundedQuantity = products.reduce((sum, p) => sum + p.refundedQuantity, 0);
    const totalRefundedRevenue = products.reduce((sum, p) => sum + p.refundedRevenue, 0);
    const totalNetQuantity = products.reduce((sum, p) => sum + p.netQuantity, 0);
    const totalNetRevenue = products.reduce((sum, p) => sum + p.netRevenue, 0);

    // Buyurtmalar soni
    const ordersCount = await OfflineSaleModel.countDocuments({
      userId,
      saleType: 'sale',
      offlineCreatedAt: { $gte: today },
    });

    // Mijozlar soni
    const customersAgg = await OfflineSaleModel.aggregate([
      {
        $match: {
          userId,
          saleType: 'sale',
          offlineCreatedAt: { $gte: today },
        },
      },
      {
        $group: {
          _id: '$customerId',
        },
      },
      {
        $match: {
          _id: { $ne: null },
        },
      },
    ]);

    res.json({
      success: true,
      stats: {
        netQuantity: totalNetQuantity,
        netRevenue: totalNetRevenue,
        totalOrders: ordersCount,
        totalCustomers: customersAgg.length,
        products: products.sort((a, b) => b.netRevenue - a.netRevenue), // Eng ko'p daromad keltirganlari birinchi
      },
    });
  } catch (error: any) {
    console.error('[Sales Stats] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
