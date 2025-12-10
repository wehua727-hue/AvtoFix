import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../user.model";
import { connectMongo } from "../mongo";

// GET /api/users - получить всех пользователей
export async function handleUsersGet(req: Request, res: Response) {
  try {
    await connectMongo();
    
    const users = await User.find({}).select("-password").sort({ createdAt: -1 });
    
    res.json({
      success: true,
      users: users.map(u => ({
        id: u._id.toString(),
        name: u.name,
        phone: u.phone,
        address: u.address || "",
        role: u.role,
        canEditProducts: u.canEditProducts || false,
        subscriptionType: u.subscriptionType || "cheksiz",
        subscriptionEndDate: u.subscriptionEndDate,
        isBlocked: u.isBlocked || false,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error("[users] Get error:", error?.message || error);
    res.status(500).json({ success: false, error: "Server error" });
  }
}

// POST /api/users - создать пользователя
export async function handleUserCreate(req: Request, res: Response) {
  try {
    const { name, phone, password, address, role, subscriptionType, subscriptionEndDate, ownerId } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ 
        success: false, 
        error: "Ism, telefon va parol majburiy" 
      });
    }

    await connectMongo();

    // Проверить существует ли пользователь
    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        error: "Bu telefon raqami allaqachon ro'yxatdan o'tgan" 
      });
    }

    // Хешировать пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      phone,
      password: hashedPassword,
      address: address || "",
      role: role || "admin",
      ownerId: ownerId || undefined, // Xodim/admin qaysi egasiga tegishli
      subscriptionType: subscriptionType || "cheksiz",
      subscriptionEndDate: subscriptionEndDate ? new Date(subscriptionEndDate) : undefined,
      isBlocked: false,
    });

    await user.save();

    res.status(201).json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        address: user.address,
        role: user.role,
        subscriptionType: user.subscriptionType,
        subscriptionEndDate: user.subscriptionEndDate,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error("[users] Create error:", error?.message || error);
    res.status(500).json({ success: false, error: "Server error" });
  }
}

// PUT /api/users/:id - обновить пользователя
export async function handleUserUpdate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, phone, password, address, role, canEditProducts, subscriptionType, subscriptionEndDate, isBlocked } = req.body;

    await connectMongo();

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: "Foydalanuvchi topilmadi" });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (role) user.role = role;
    if (typeof canEditProducts === 'boolean') user.canEditProducts = canEditProducts;
    if (subscriptionType) user.subscriptionType = subscriptionType;
    if (subscriptionEndDate !== undefined) {
      user.subscriptionEndDate = subscriptionEndDate ? new Date(subscriptionEndDate) : undefined;
    }
    if (typeof isBlocked === 'boolean') user.isBlocked = isBlocked;
    
    // Если передан новый пароль - хешируем
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        address: user.address,
        role: user.role,
        canEditProducts: user.canEditProducts || false,
        subscriptionType: user.subscriptionType,
        subscriptionEndDate: user.subscriptionEndDate,
        isBlocked: user.isBlocked,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("[users] Update error:", error?.message || error);
    res.status(500).json({ success: false, error: "Server error" });
  }
}

// DELETE /api/users/:id - удалить пользователя
export async function handleUserDelete(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await connectMongo();

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ success: false, error: "Foydalanuvchi topilmadi" });
    }

    res.json({ success: true, message: "Foydalanuvchi o'chirildi" });
  } catch (error: any) {
    console.error("[users] Delete error:", error?.message || error);
    res.status(500).json({ success: false, error: "Server error" });
  }
}
