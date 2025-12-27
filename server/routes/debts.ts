import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Debt } from '../debt.model';
import { DebtHistory } from '../debt-history.model';
import { Blacklist } from '../blacklist.model';
import { connectMongo } from '../mongo';
import { wsManager } from '../websocket';

// GET /api/debts - Barcha qarzlarni olish
export async function handleDebtsGet(req: Request, res: Response) {
  try {
    await connectMongo();
    
    const userId = req.userId || req.headers['x-user-id'] || req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID kerak' });
    }
    
    console.log('[debts] Fetching debts for userId:', userId);
    
    const debts = await Debt.find({ userId }).sort({ createdAt: -1 });
    
    console.log('[debts] Found debts:', debts.length);
    
    // Avtomatik overdue statusni yangilash
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const debt of debts) {
      if (debt.status === 'pending' && debt.dueDate) {
        const dueDate = new Date(debt.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        if (dueDate < today) {
          debt.status = 'overdue';
          await debt.save();
        }
      }
    }
    
    res.json({
      success: true,
      debts: debts.map(d => ({
        _id: d._id.toString(),
        branchId: d.branchId,
        creditor: d.creditor,
        amount: d.amount,
        description: d.description,
        phone: d.phone,
        countryCode: d.countryCode,
        debtDate: d.debtDate,
        dueDate: d.dueDate,
        currency: d.currency,
        status: d.status,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('[debts] Get error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Server xatosi' });
  }
}

// POST /api/debts - Yangi qarz qo'shish
export async function handleDebtCreate(req: Request, res: Response) {
  try {
    const { creditor, amount, description, phone, countryCode, debtDate, dueDate, currency, branchId, userId } = req.body;
    
    const finalUserId = userId || req.userId || req.headers['x-user-id'];
    
    if (!finalUserId) {
      return res.status(400).json({ success: false, error: 'User ID kerak' });
    }

    if (!creditor || !amount || !debtDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Kreditor, summa va sana majburiy' 
      });
    }

    // userId ni ObjectId ga aylantirish
    let userObjectId: mongoose.Types.ObjectId;
    try {
      userObjectId = new mongoose.Types.ObjectId(String(finalUserId));
    } catch {
      console.error('[debts] Invalid userId format:', finalUserId);
      return res.status(400).json({ success: false, error: 'Noto\'g\'ri user ID formati' });
    }

    await connectMongo();

    const debt = new Debt({
      userId: userObjectId,
      branchId,
      creditor,
      amount,
      description,
      phone,
      countryCode: countryCode || '+998',
      debtDate: new Date(debtDate),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      currency: currency || 'UZS',
      status: 'pending',
    });

    await debt.save();

    // Broadcast debt creation via WebSocket
    wsManager.broadcastToUser(String(finalUserId), {
      type: 'debt-created',
      debtId: debt._id.toString(),
      creditor: debt.creditor,
      amount: debt.amount,
      userId: String(finalUserId),
      timestamp: Date.now(),
    });

    // Tarix yozish
    const history = new DebtHistory({
      debtId: debt._id,
      action: 'created',
      amount: debt.amount,
      reason: 'Yangi qarz qo\'shildi',
    });
    await history.save();

    res.status(201).json({
      success: true,
      debt: {
        _id: debt._id.toString(),
        userId: debt.userId,
        branchId: debt.branchId,
        creditor: debt.creditor,
        amount: debt.amount,
        description: debt.description,
        phone: debt.phone,
        countryCode: debt.countryCode,
        debtDate: debt.debtDate,
        dueDate: debt.dueDate,
        currency: debt.currency,
        status: debt.status,
        createdAt: debt.createdAt,
        updatedAt: debt.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[debts] Create error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Server xatosi' });
  }
}

// PUT /api/debts/:id - Qarzni tahrirlash
export async function handleDebtUpdate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { creditor, amount, description, phone, countryCode, debtDate, dueDate, currency } = req.body;

    await connectMongo();

    const debt = await Debt.findById(id);
    if (!debt) {
      return res.status(404).json({ success: false, error: 'Qarz topilmadi' });
    }

    const oldAmount = debt.amount;

    if (creditor) debt.creditor = creditor;
    if (amount !== undefined) debt.amount = amount;
    if (description !== undefined) debt.description = description;
    if (phone !== undefined) debt.phone = phone;
    if (countryCode !== undefined) debt.countryCode = countryCode;
    if (debtDate) debt.debtDate = new Date(debtDate);
    if (dueDate !== undefined) debt.dueDate = dueDate ? new Date(dueDate) : undefined;
    if (currency) debt.currency = currency;

    await debt.save();

    // Tarix yozish
    if (oldAmount !== debt.amount) {
      const history = new DebtHistory({
        debtId: debt._id,
        action: 'updated',
        amount: debt.amount,
        reason: `Summa o'zgartirildi: ${oldAmount} -> ${debt.amount}`,
      });
      await history.save();
    }

    res.json({
      success: true,
      debt: {
        _id: debt._id.toString(),
        branchId: debt.branchId,
        creditor: debt.creditor,
        amount: debt.amount,
        description: debt.description,
        phone: debt.phone,
        countryCode: debt.countryCode,
        debtDate: debt.debtDate,
        currency: debt.currency,
        status: debt.status,
        createdAt: debt.createdAt,
        updatedAt: debt.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[debts] Update error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Server xatosi' });
  }
}

// PATCH /api/debts/:id/paid - Qarzni to'langan deb belgilash
export async function handleDebtMarkAsPaid(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await connectMongo();

    const debt = await Debt.findById(id);
    if (!debt) {
      return res.status(404).json({ success: false, error: 'Qarz topilmadi' });
    }

    const wasUnpaid = debt.status === 'unpaid';
    debt.status = 'paid';
    await debt.save();

    // Agar qora ro'yxatda bo'lsa, chiqarish
    if (wasUnpaid) {
      // userId ni ObjectId ga aylantirish
      let userObjectId: mongoose.Types.ObjectId;
      try {
        userObjectId = new mongoose.Types.ObjectId(String(debt.userId));
      } catch {
        userObjectId = debt.userId as any;
      }
      
      const query: any = { userId: userObjectId };
      if (debt.phone) {
        query.$and = [
          { userId: userObjectId },
          { $or: [{ phone: debt.phone }, { creditor: debt.creditor }] }
        ];
      } else {
        query.creditor = debt.creditor;
      }
      const blacklistEntry = await Blacklist.findOne(query);
      if (blacklistEntry) {
        blacklistEntry.totalUnpaidAmount -= debt.amount;
        if (blacklistEntry.totalUnpaidAmount <= 0) {
          await Blacklist.findByIdAndDelete(blacklistEntry._id);
        } else {
          await blacklistEntry.save();
        }
      }
    }

    const history = new DebtHistory({
      debtId: debt._id,
      action: 'paid',
      amount: debt.amount,
      reason: reason || (wasUnpaid ? 'Qarz to\'landi - qora ro\'yxatdan chiqarildi' : 'Qarz to\'landi'),
    });
    await history.save();

    // Broadcast debt update via WebSocket
    wsManager.broadcastToUser(String(debt.userId), {
      type: 'debt-updated',
      debtId: debt._id.toString(),
      creditor: debt.creditor,
      status: debt.status,
      userId: String(debt.userId),
      removedFromBlacklist: wasUnpaid,
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      debt: { _id: debt._id.toString(), status: debt.status, updatedAt: debt.updatedAt },
      removedFromBlacklist: wasUnpaid,
    });
  } catch (error: any) {
    console.error('[debts] Mark as paid error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Server xatosi' });
  }
}

// PATCH /api/debts/:id/unpaid - Qarzni to'lanmadi deb belgilash (qora ro'yxatga qo'shish)
export async function handleDebtMarkAsUnpaid(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await connectMongo();

    const debt = await Debt.findById(id);
    if (!debt) {
      return res.status(404).json({ success: false, error: 'Qarz topilmadi' });
    }

    debt.status = 'unpaid';
    await debt.save();

    // userId ni ObjectId ga aylantirish
    let userObjectId: mongoose.Types.ObjectId;
    try {
      userObjectId = new mongoose.Types.ObjectId(String(debt.userId));
    } catch {
      console.error('[debts] Invalid userId format:', debt.userId);
      return res.status(400).json({ success: false, error: 'Noto\'g\'ri user ID formati' });
    }

    // Qora ro'yxatga qo'shish
    const query: any = { userId: userObjectId };
    if (debt.phone) {
      query.$or = [{ phone: debt.phone }, { creditor: debt.creditor }];
    } else {
      query.creditor = debt.creditor;
    }
    const existingBlacklist = await Blacklist.findOne(query);

    if (existingBlacklist) {
      existingBlacklist.totalUnpaidAmount += debt.amount;
      existingBlacklist.reason = reason || `Qarz to'lanmadi: ${debt.amount} ${debt.currency}`;
      await existingBlacklist.save();
    } else {
      const blacklistEntry = new Blacklist({
        userId: userObjectId,
        creditor: debt.creditor,
        phone: debt.phone,
        reason: reason || `Qarz to'lanmadi: ${debt.amount} ${debt.currency}`,
        debtId: debt._id,
        totalUnpaidAmount: debt.amount,
      });
      await blacklistEntry.save();
    }

    const history = new DebtHistory({
      debtId: debt._id,
      action: 'unpaid',
      amount: debt.amount,
      reason: reason || 'Qarz to\'lanmadi - qora ro\'yxatga qo\'shildi',
    });
    await history.save();

    // Broadcast debt update via WebSocket
    wsManager.broadcastToUser(String(debt.userId), {
      type: 'debt-updated',
      debtId: debt._id.toString(),
      creditor: debt.creditor,
      status: debt.status,
      userId: String(debt.userId),
      addedToBlacklist: true,
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      debt: { _id: debt._id.toString(), status: debt.status, updatedAt: debt.updatedAt },
      message: `${debt.creditor} qora ro'yxatga qo'shildi`,
    });
  } catch (error: any) {
    console.error('[debts] Mark as unpaid error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Server xatosi' });
  }
}

// GET /api/blacklist - Qora ro'yxatni olish
export async function handleBlacklistGet(req: Request, res: Response) {
  try {
    await connectMongo();
    const userId = req.userId || req.headers['x-user-id'] || req.query.userId;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID kerak' });
    
    const blacklist = await Blacklist.find({ userId }).sort({ createdAt: -1 });
    res.json({
      success: true,
      blacklist: blacklist.map(b => ({
        _id: b._id.toString(),
        creditor: b.creditor,
        phone: b.phone,
        reason: b.reason,
        totalUnpaidAmount: b.totalUnpaidAmount,
        createdAt: b.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('[blacklist] Get error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Server xatosi' });
  }
}

// GET /api/blacklist/check - Qora ro'yxatda borligini tekshirish
export async function handleBlacklistCheck(req: Request, res: Response) {
  try {
    await connectMongo();
    const userId = req.userId || req.headers['x-user-id'] || req.query.userId;
    const { phone, creditor } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID kerak' });
    
    const query: any = { userId };
    if (phone) query.phone = phone;
    else if (creditor) query.creditor = { $regex: new RegExp(creditor as string, 'i') };
    else return res.status(400).json({ success: false, error: 'Telefon yoki ism kerak' });
    
    const blacklistEntry = await Blacklist.findOne(query);
    res.json({
      success: true,
      isBlacklisted: !!blacklistEntry,
      entry: blacklistEntry ? {
        _id: blacklistEntry._id.toString(),
        creditor: blacklistEntry.creditor,
        phone: blacklistEntry.phone,
        reason: blacklistEntry.reason,
        totalUnpaidAmount: blacklistEntry.totalUnpaidAmount,
      } : null,
    });
  } catch (error: any) {
    console.error('[blacklist] Check error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Server xatosi' });
  }
}

// PATCH /api/debts/:id/adjust - Qarz summasini o'zgartirish
export async function handleDebtAdjust(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { amount, type, reason } = req.body;

    if (!amount || !type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Summa va tur majburiy' 
      });
    }

    await connectMongo();

    const debt = await Debt.findById(id);
    if (!debt) {
      return res.status(404).json({ success: false, error: 'Qarz topilmadi' });
    }

    const oldAmount = debt.amount;

    if (type === 'add') {
      debt.amount += amount;
    } else if (type === 'subtract') {
      debt.amount -= amount;
      if (debt.amount < 0) debt.amount = 0;
    }

    await debt.save();

    // Tarix yozish
    const history = new DebtHistory({
      debtId: debt._id,
      action: type === 'add' ? 'increased' : 'decreased',
      amount: amount,
      reason: reason || `Summa ${type === 'add' ? 'oshirildi' : 'kamaytirildi'}`,
    });
    await history.save();

    res.json({
      success: true,
      debt: {
        _id: debt._id.toString(),
        amount: debt.amount,
        updatedAt: debt.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[debts] Adjust error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Server xatosi' });
  }
}

// DELETE /api/debts/:id - Qarzni o'chirish
export async function handleDebtDelete(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await connectMongo();

    const debt = await Debt.findById(id);
    if (!debt) {
      return res.status(404).json({ success: false, error: 'Qarz topilmadi' });
    }

    // Tarix yozish
    const history = new DebtHistory({
      debtId: debt._id,
      action: 'deleted',
      amount: debt.amount,
      reason: reason || 'Qarz o\'chirildi',
    });
    await history.save();

    // Broadcast debt deletion via WebSocket before deletion
    wsManager.broadcastToUser(String(debt.userId), {
      type: 'debt-deleted',
      debtId: debt._id.toString(),
      creditor: debt.creditor,
      userId: String(debt.userId),
      timestamp: Date.now(),
    });

    await Debt.findByIdAndDelete(id);

    res.json({ success: true, message: 'Qarz o\'chirildi' });
  } catch (error: any) {
    console.error('[debts] Delete error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Server xatosi' });
  }
}

// GET /api/debts/:id/history - Qarz tarixini olish
export async function handleDebtHistoryGet(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await connectMongo();

    const history = await DebtHistory.find({ debtId: id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      history: history.map(h => ({
        _id: h._id.toString(),
        debtId: h.debtId.toString(),
        action: h.action,
        amount: h.amount,
        reason: h.reason,
        createdAt: h.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('[debts] History get error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Server xatosi' });
  }
}

// DELETE /api/blacklist/:id - Qora ro'yxatdan o'chirish
export async function handleBlacklistDelete(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await connectMongo();

    const entry = await Blacklist.findById(id);
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Topilmadi' });
    }

    await Blacklist.findByIdAndDelete(id);

    res.json({ success: true, message: 'Qora ro\'yxatdan o\'chirildi' });
  } catch (error: any) {
    console.error('[blacklist] Delete error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Server xatosi' });
  }
}

// DELETE /api/blacklist/clear - Barcha qora ro'yxatni tozalash
export async function handleBlacklistClear(req: Request, res: Response) {
  try {
    await connectMongo();
    const userId = req.userId || req.headers['x-user-id'] || req.query.userId;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID kerak' });

    const result = await Blacklist.deleteMany({ userId });

    res.json({ 
      success: true, 
      message: `${result.deletedCount} ta yozuv o'chirildi` 
    });
  } catch (error: any) {
    console.error('[blacklist] Clear error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Server xatosi' });
  }
}
