/**
 * Yaroqsiz mahsulotlar API
 */
import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

// Yaroqsiz mahsulotlar sxemasi
const defectiveProductSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  sku: String,
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  refundId: String,
  userId: { type: String, required: true, index: true },
  createdAt: { type: Number, default: Date.now }
});

const DefectiveProduct = mongoose.models.DefectiveProduct || 
  mongoose.model('DefectiveProduct', defectiveProductSchema);

/**
 * Yaroqsiz mahsulotlarni tozalash (faqat egasi uchun)
 * DELETE /api/defective/clear
 */
router.delete('/clear', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId kerak' });
    }
    
    // Foydalanuvchining barcha yaroqsiz mahsulotlarini o'chirish
    const result = await DefectiveProduct.deleteMany({ userId });
    
    console.log(`[Defective] Cleared ${result.deletedCount} defective products for user ${userId}`);
    
    return res.json({ 
      success: true, 
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} ta yaroqsiz mahsulot o'chirildi`
    });
  } catch (error: any) {
    console.error('[Defective] Clear error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Yaroqsiz mahsulotlarni olish
 * GET /api/defective?userId=xxx
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId kerak' });
    }
    
    const products = await DefectiveProduct.find({ userId }).sort({ createdAt: -1 });
    
    return res.json({ success: true, products });
  } catch (error: any) {
    console.error('[Defective] Get error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Yaroqsiz mahsulot qo'shish
 * POST /api/defective
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { productId, productName, sku, quantity, price, refundId, userId } = req.body;
    
    if (!productId || !productName || !quantity || !price || !userId) {
      return res.status(400).json({ success: false, error: 'Barcha maydonlar kerak' });
    }
    
    const defective = new DefectiveProduct({
      productId,
      productName,
      sku,
      quantity,
      price,
      refundId,
      userId,
      createdAt: Date.now()
    });
    
    await defective.save();
    
    return res.json({ success: true, product: defective });
  } catch (error: any) {
    console.error('[Defective] Save error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
