import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../user.model";
import { connectMongo } from "../mongo";

export async function handleLogin(req: Request, res: Response) {
  console.log("[auth] ========== LOGIN REQUEST ==========");
  console.log("[auth] Method:", req.method);
  console.log("[auth] Headers:", req.headers);
  console.log("[auth] Body:", req.body);
  
  try {
    const { phone, password } = req.body;

    console.log("[auth] Login attempt for phone:", phone);

    if (!phone || !password) {
      console.log("[auth] ❌ Missing phone or password");
      return res.status(400).json({ 
        success: false, 
        error: "Телефон и пароль обязательны" 
      });
    }

    // Убедимся что MongoDB подключена
    console.log("[auth] Connecting to MongoDB...");
    await connectMongo();
    console.log("[auth] ✅ MongoDB connected");

    // Найти пользователя по номеру телефона
    console.log("[auth] Searching for user with phone:", phone);
    let user = await User.findOne({ phone });
    console.log("[auth] User found:", user ? "yes" : "no");
    
    if (!user) {
      console.log("[auth] ❌ User not found");
      // Foydalanuvchi topilmadi - xatolik qaytarish
      return res.status(401).json({ 
        success: false, 
        error: "Bu telefon raqami bilan hisob topilmadi" 
      });
    }

    // Mavjud foydalanuvchi uchun parolni tekshirish
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        error: "Неверный номер телефона или пароль" 
      });
    }

    // Проверка подписки и блокировки
    const now = new Date();
    let isBlocked = user.isBlocked || false;
    
    // Проверяем срок подписки для обычного тарифа
    if (user.subscriptionType === "oddiy" && user.subscriptionEndDate) {
      const endDate = new Date(user.subscriptionEndDate);
      if (now > endDate) {
        isBlocked = true;
        // Обновляем статус блокировки в базе
        await User.findByIdAndUpdate(user._id, { isBlocked: true });
      }
    }
    
    // Если аккаунт заблокирован - возвращаем специальный ответ
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        error: "account_blocked",
        message: "Akkaunt bloklangan. Iltimos, +998910712828 raqamiga qo'ng'iroq qiling va to'lovni amalga oshiring.",
        phone: "+998910712828",
        subscriptionEndDate: user.subscriptionEndDate,
      });
    }

    // Вернуть данные пользователя (без пароля)
    // Xodim/admin uchun ownerId ni ham qaytarish - egasining mahsulotlarini ko'rish uchun
    const userData = {
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      role: user.role,
      address: user.address,
      ownerId: user.ownerId, // Egasining ID si (xodim/admin uchun)
      canEditProducts: user.canEditProducts || false, // Xodim mahsulotlarni tahrirlash huquqi
      telegramChatId: user.telegramChatId,
      subscriptionType: user.subscriptionType || "cheksiz",
      subscriptionEndDate: user.subscriptionEndDate,
      isBlocked: user.isBlocked || false,
    };
    
    console.log('[auth] Login successful, returning user:', {
      id: userData.id,
      phone: userData.phone,
      name: userData.name
    });
    
    res.json({
      success: true,
      user: userData,
    });
  } catch (error: any) {
    console.error("[auth] Login error:", error?.message || error);
    res.status(500).json({ 
      success: false, 
      error: "Ошибка сервера: " + (error?.message || "Unknown error")
    });
  }
}

export async function handleVerifyToken(req: Request, res: Response) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId required" });
    }

    await connectMongo();
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(401).json({ success: false, error: "User not found" });
    }

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        role: user.role,
        address: user.address,
        ownerId: user.ownerId,
        canEditProducts: user.canEditProducts || false,
        telegramChatId: user.telegramChatId,
        subscriptionType: user.subscriptionType || "cheksiz",
        subscriptionEndDate: user.subscriptionEndDate,
        isBlocked: user.isBlocked || false,
      },
    });
  } catch (error) {
    console.error("[auth] Verify error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
}

// Boshqa foydalanuvchi sifatida kirish (egasi va admin uchun)
export async function handleLoginAs(req: Request, res: Response) {
  try {
    const { userId, adminId } = req.body;

    if (!userId || !adminId) {
      return res.status(400).json({ 
        success: false, 
        error: "userId va adminId kerak" 
      });
    }

    await connectMongo();

    // Admin/Egasi foydalanuvchini tekshirish
    const admin = await User.findById(adminId);
    if (!admin || (admin.role !== 'egasi' && admin.role !== 'admin')) {
      return res.status(403).json({ 
        success: false, 
        error: "Faqat egasi yoki admin boshqa foydalanuvchi sifatida kira oladi" 
      });
    }

    // Maqsad foydalanuvchini topish
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        error: "Foydalanuvchi topilmadi" 
      });
    }

    // Admin uchun qo'shimcha tekshiruv - faqat o'zi qo'shgan xodimlarga kira oladi
    if (admin.role === 'admin') {
      if (targetUser.createdBy !== adminId) {
        return res.status(403).json({ 
          success: false, 
          error: "Siz faqat o'zingiz qo'shgan xodimlarga kira olasiz" 
        });
      }
    }

    console.log(`[auth] ${admin.role === 'egasi' ? 'Egasi' : 'Admin'} ${admin.name} logging in as ${targetUser.name}`);

    // Foydalanuvchi ma'lumotlarini qaytarish
    const userData = {
      id: targetUser._id.toString(),
      name: targetUser.name,
      phone: targetUser.phone,
      role: targetUser.role,
      address: targetUser.address,
      ownerId: targetUser.ownerId,
      canEditProducts: targetUser.canEditProducts || false,
      telegramChatId: targetUser.telegramChatId,
      subscriptionType: targetUser.subscriptionType || "cheksiz",
      subscriptionEndDate: targetUser.subscriptionEndDate,
      isBlocked: targetUser.isBlocked || false,
    };

    res.json({
      success: true,
      user: userData,
    });
  } catch (error: any) {
    console.error("[auth] LoginAs error:", error?.message || error);
    res.status(500).json({ 
      success: false, 
      error: "Server xatosi: " + (error?.message || "Unknown error")
    });
  }
}
