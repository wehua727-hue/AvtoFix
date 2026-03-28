import { Request, Response } from "express";
import { CashRegisterCheck } from "../cash-register.model";

// Получить все чеки (pending и completed) для пользователя
export async function handleCashRegisterGet(req: Request, res: Response) {
  try {
    const type = req.query.type as string | undefined;
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId required" });
    }
    
    const filter: any = { userId };
    if (type) filter.type = type;
    
    const checks = await CashRegisterCheck.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, checks });
  } catch (error) {
    console.error("[cash-register] GET error:", error);
    res.status(500).json({ success: false, error: "Failed to get checks" });
  }
}

// Получить текущий чек (type: current) для пользователя
export async function handleCurrentCheckGet(req: Request, res: Response) {
  try {
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId required" });
    }
    
    const currentCheck = await CashRegisterCheck.findOne({ userId, type: "current" });
    res.json({ success: true, check: currentCheck });
  } catch (error) {
    console.error("[cash-register] GET current error:", error);
    res.status(500).json({ success: false, error: "Failed to get current check" });
  }
}

// Сохранить/обновить текущий чек (автосохранение)
export async function handleCurrentCheckSave(req: Request, res: Response) {
  try {
    const { items, total, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId required" });
    }
    
    // Найти или создать текущий чек для пользователя
    let currentCheck = await CashRegisterCheck.findOne({ userId, type: "current" });
    
    if (currentCheck) {
      currentCheck.items = items || [];
      currentCheck.total = total || 0;
      await currentCheck.save();
    } else {
      currentCheck = await CashRegisterCheck.create({
        userId,
        items: items || [],
        total: total || 0,
        type: "current",
      });
    }
    
    res.json({ success: true, check: currentCheck });
  } catch (error) {
    console.error("[cash-register] SAVE current error:", error);
    res.status(500).json({ success: false, error: "Failed to save current check" });
  }
}

// Создать отложенный чек
export async function handlePendingCheckCreate(req: Request, res: Response) {
  try {
    const { items, total, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId required" });
    }
    
    const check = await CashRegisterCheck.create({
      userId,
      items: items || [],
      total: total || 0,
      type: "pending",
    });
    
    // Очистить текущий чек пользователя
    await CashRegisterCheck.deleteOne({ userId, type: "current" });
    
    res.json({ success: true, check });
  } catch (error) {
    console.error("[cash-register] CREATE pending error:", error);
    res.status(500).json({ success: false, error: "Failed to create pending check" });
  }
}

// Завершить чек (оплата)
export async function handleCheckComplete(req: Request, res: Response) {
  try {
    const { items, total, paymentType, userId, saleType } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId required" });
    }
    
    const check = await CashRegisterCheck.create({
      userId,
      items: items || [],
      total: total || 0,
      type: "completed",
      paymentType: paymentType || null,
      saleType: saleType || "sale",
    });
    
    // Очистить текущий чек пользователя
    await CashRegisterCheck.deleteOne({ userId, type: "current" });
    
    res.json({ success: true, check });
  } catch (error) {
    console.error("[cash-register] COMPLETE error:", error);
    res.status(500).json({ success: false, error: "Failed to complete check" });
  }
}

// Восстановить отложенный чек
export async function handlePendingCheckRestore(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId required" });
    }
    
    const pendingCheck = await CashRegisterCheck.findOne({ _id: id, userId });
    if (!pendingCheck || pendingCheck.type !== "pending") {
      return res.status(404).json({ success: false, error: "Pending check not found" });
    }
    
    // Сохранить как текущий для пользователя
    await CashRegisterCheck.findOneAndUpdate(
      { userId, type: "current" },
      { userId, items: pendingCheck.items, total: pendingCheck.total, type: "current" },
      { upsert: true }
    );
    
    // Удалить из отложенных
    await CashRegisterCheck.findByIdAndDelete(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error("[cash-register] RESTORE error:", error);
    res.status(500).json({ success: false, error: "Failed to restore check" });
  }
}

// Удалить чек
export async function handleCheckDelete(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId required" });
    }
    
    await CashRegisterCheck.findOneAndDelete({ _id: id, userId });
    res.json({ success: true });
  } catch (error) {
    console.error("[cash-register] DELETE error:", error);
    res.status(500).json({ success: false, error: "Failed to delete check" });
  }
}
