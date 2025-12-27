import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../user.model";
import { ProductModel } from "../product.model";
import { CustomerModel } from "../customer.model";
import { Debt } from "../debt.model";
import { DebtHistory } from "../debt-history.model";
import { CashRegisterCheck } from "../cash-register.model";
import { connectMongo } from "../mongo";

const CATEGORIES_COLLECTION = process.env.OFFLINE_CATEGORIES_COLLECTION || "categories";
const STORES_COLLECTION = "stores";

// GET /api/users - получить всех пользователей
// Query params: userId, userRole - filtrlash uchun
export async function handleUsersGet(req: Request, res: Response) {
  try {
    const conn = await connectMongo();
    
    const { userId, userRole } = req.query;
    
    let filter: any = {};
    
    // Filtrlash logikasi:
    // - Egasi: faqat o'zi qo'shganlar + boshqa egalar (admin qo'shganlarni ko'rmaydi)
    // - Admin: faqat o'zi qo'shganlar (egasi va boshqa adminlar qo'shganlarni ko'rmaydi)
    if (userId && userRole) {
      if (userRole === 'egasi') {
        // Egasi ko'radi: o'zi qo'shganlar + boshqa egalar + createdBy bo'sh (eski userlar)
        // Admin qo'shganlarni ko'rmaydi
        filter = {
          $or: [
            { createdBy: userId }, // O'zi qo'shganlar
            { role: 'egasi' }, // Barcha egalar
            { createdBy: { $exists: false } }, // Eski userlar (createdBy yo'q)
            { createdByRole: 'egasi' }, // Egasi tomonidan yaratilganlar
          ],
          // Admin yaratganlarni chiqarib tashlash
          createdByRole: { $ne: 'admin' }
        };
      } else if (userRole === 'admin') {
        // Admin ko'radi: faqat o'zi qo'shganlar + o'zini
        filter = {
          $or: [
            { createdBy: userId }, // O'zi qo'shganlar
            { _id: userId }, // O'zini
          ]
        };
      }
    }
    
    const users = await User.find(filter).select("-password").sort({ createdAt: -1 });
    
    // Store mavjudligini tekshirish va agar store yo'q bo'lsa, xodimni o'chirish
    // Bu marketplace dan store o'chirilganda xodimni ham o'chirish uchun
    if (conn && conn.db) {
      const usersToDelete: string[] = [];
      
      for (const user of users) {
        // Faqat xodimlarni tekshirish (egasi va admin emas)
        if (user.role === 'xodim' && user.createdByRole === 'egasi') {
          // Bu xodim uchun store mavjudligini tekshirish
          const store = await conn.db.collection(STORES_COLLECTION).findOne({
            $or: [
              { createdBy: user._id },
              { manager: user._id }
            ]
          });
          
          if (!store) {
            console.log(`[users] Store not found for user ${user.name} (${user._id}), marking for deletion`);
            usersToDelete.push(user._id.toString());
          }
        }
      }
      
      // Store yo'q xodimlarni o'chirish
      for (const userIdToDelete of usersToDelete) {
        try {
          // Mahsulotlarni o'chirish
          await ProductModel.deleteMany({ userId: userIdToDelete });
          // Xodimni o'chirish
          await User.findByIdAndDelete(userIdToDelete);
          console.log(`[users] Deleted orphaned user: ${userIdToDelete}`);
        } catch (err) {
          console.error(`[users] Error deleting orphaned user ${userIdToDelete}:`, err);
        }
      }
      
      // Agar xodimlar o'chirilgan bo'lsa, qayta so'rov
      if (usersToDelete.length > 0) {
        const updatedUsers = await User.find(filter).select("-password").sort({ createdAt: -1 });
        return res.json({
          success: true,
          users: updatedUsers.map(u => ({
            id: u._id.toString(),
            name: u.name,
            phone: u.phone,
            address: u.address || "",
            role: u.role,
            createdBy: u.createdBy,
            createdByRole: u.createdByRole,
            canEditProducts: u.canEditProducts || false,
            subscriptionType: u.subscriptionType || "cheksiz",
            subscriptionEndDate: u.subscriptionEndDate,
            isBlocked: u.isBlocked || false,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
          })),
          deletedOrphans: usersToDelete.length
        });
      }
    }
    
    res.json({
      success: true,
      users: users.map(u => ({
        id: u._id.toString(),
        name: u.name,
        phone: u.phone,
        address: u.address || "",
        role: u.role,
        createdBy: u.createdBy,
        createdByRole: u.createdByRole,
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
    const { name, phone, password, address, role, subscriptionType, subscriptionEndDate, ownerId, createdBy, createdByRole } = req.body;

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
      createdBy: createdBy || undefined, // Kim yaratgan
      createdByRole: createdByRole || undefined, // Yaratuvchining roli
      subscriptionType: subscriptionType || "cheksiz",
      subscriptionEndDate: subscriptionEndDate ? new Date(subscriptionEndDate) : undefined,
      isBlocked: false,
    });

    await user.save();

    // Создаём магазин для нового пользователя
    // Магазин создаётся только для:
    // - egasi (владелец)
    // - xodim созданный egasi (createdByRole === 'egasi')
    // НЕ создаётся для:
    // - admin
    // - xodim созданный admin (createdByRole === 'admin')
    const conn = await connectMongo();
    let storeId: string | null = null;
    const userRole = role || "admin";
    const shouldCreateStore = userRole === "egasi" || (userRole === "xodim" && createdByRole === "egasi");
    
    if (conn && conn.db && shouldCreateStore) {
      const storeDoc = {
        name: name, // Имя магазина = имя пользователя
        location: "",
        imageUrl: "", // Пустое поле для изображения
        color: "#4CAF50", // Цвет по умолчанию
        createdBy: user._id,
        manager: user._id,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const storeResult = await conn.db.collection(STORES_COLLECTION).insertOne(storeDoc);
      storeId = storeResult.insertedId.toString();
      console.log(`[users] Created store ${storeId} for user ${user._id} (role: ${userRole}, createdByRole: ${createdByRole})`);
    }

    res.status(201).json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        address: user.address,
        role: user.role,
        createdBy: user.createdBy,
        createdByRole: user.createdByRole,
        subscriptionType: user.subscriptionType,
        subscriptionEndDate: user.subscriptionEndDate,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
        storeId: storeId,
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

// Вспомогательная функция для удаления данных одного пользователя
async function deleteUserData(userId: string) {
  const conn = await connectMongo();
  const mongoose = await import("mongoose");
  
  // Конвертируем userId в ObjectId для моделей где это нужно
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  let deletedProducts = { deletedCount: 0 };
  let deletedCustomers = { deletedCount: 0 };
  let deletedDebts = { deletedCount: 0 };
  let deletedChecks = { deletedCount: 0 };
  let deletedCategories = 0;
  let deletedStores = 0;

  try {
    // 1. Удаляем все товары пользователя (userId как строка)
    deletedProducts = await ProductModel.deleteMany({ userId });
    console.log(`[deleteUserData] Deleted ${deletedProducts.deletedCount} products for user ${userId}`);
  } catch (err) {
    console.error(`[deleteUserData] Error deleting products:`, err);
  }

  try {
    // 2. Удаляем всех клиентов пользователя (userId как ObjectId)
    deletedCustomers = await CustomerModel.deleteMany({ userId: userObjectId });
    console.log(`[deleteUserData] Deleted ${deletedCustomers.deletedCount} customers for user ${userId}`);
  } catch (err) {
    console.error(`[deleteUserData] Error deleting customers:`, err);
  }

  try {
    // 3. Получаем все долги пользователя для удаления истории (userId как ObjectId)
    const userDebts = await Debt.find({ userId: userObjectId }).select('_id');
    const debtIds = userDebts.map(d => d._id);
    
    // 4. Удаляем историю долгов
    if (debtIds.length > 0) {
      await DebtHistory.deleteMany({ debtId: { $in: debtIds } });
    }
    
    // 5. Удаляем все долги пользователя (userId как ObjectId)
    deletedDebts = await Debt.deleteMany({ userId: userObjectId });
    console.log(`[deleteUserData] Deleted ${deletedDebts.deletedCount} debts for user ${userId}`);
  } catch (err) {
    console.error(`[deleteUserData] Error deleting debts:`, err);
  }

  try {
    // 6. Удаляем все чеки кассы пользователя (userId как строка)
    deletedChecks = await CashRegisterCheck.deleteMany({ userId });
    console.log(`[deleteUserData] Deleted ${deletedChecks.deletedCount} checks for user ${userId}`);
  } catch (err) {
    console.error(`[deleteUserData] Error deleting checks:`, err);
  }
  
  // 7. Удаляем все категории пользователя
  try {
    if (conn && conn.db) {
      const result = await conn.db.collection(CATEGORIES_COLLECTION).deleteMany({ userId });
      deletedCategories = result.deletedCount;
      console.log(`[deleteUserData] Deleted ${deletedCategories} categories for user ${userId}`);
    }
  } catch (err) {
    console.error(`[deleteUserData] Error deleting categories:`, err);
  }
  
  // 8. Удаляем магазины пользователя
  try {
    if (conn && conn.db) {
      const result = await conn.db.collection(STORES_COLLECTION).deleteMany({ 
        $or: [
          { createdBy: userObjectId },
          { manager: userObjectId }
        ]
      });
      deletedStores = result.deletedCount;
      console.log(`[deleteUserData] Deleted ${deletedStores} stores for user ${userId}`);
    }
  } catch (err) {
    console.error(`[deleteUserData] Error deleting stores:`, err);
  }

  return {
    products: deletedProducts.deletedCount,
    customers: deletedCustomers.deletedCount,
    debts: deletedDebts.deletedCount,
    checks: deletedChecks.deletedCount,
    categories: deletedCategories,
    stores: deletedStores
  };
}

// DELETE /api/users/:id - удалить пользователя
export async function handleUserDelete(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await connectMongo();

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: "Foydalanuvchi topilmadi" });
    }

    let totalDeleted = {
      products: 0,
      customers: 0,
      debts: 0,
      checks: 0,
      categories: 0,
      stores: 0,
      users: 0
    };

    // Если удаляется владелец (egasi), удаляем также всех его помощников (admin/xodim)
    if (user.role === 'egasi') {
      // Находим всех помощников этого владельца
      const helpers = await User.find({ 
        $or: [
          { ownerId: id },
          { createdBy: id }
        ]
      });

      // Удаляем данные каждого помощника
      for (const helper of helpers) {
        const helperData = await deleteUserData(helper._id.toString());
        totalDeleted.products += helperData.products;
        totalDeleted.customers += helperData.customers;
        totalDeleted.debts += helperData.debts;
        totalDeleted.checks += helperData.checks;
        totalDeleted.categories += helperData.categories;
        totalDeleted.stores += helperData.stores;
      }

      // Удаляем самих помощников
      const deletedHelpers = await User.deleteMany({ 
        $or: [
          { ownerId: id },
          { createdBy: id }
        ]
      });
      totalDeleted.users += deletedHelpers.deletedCount;
    }

    // Удаляем данные самого пользователя
    const userData = await deleteUserData(id);
    totalDeleted.products += userData.products;
    totalDeleted.customers += userData.customers;
    totalDeleted.debts += userData.debts;
    totalDeleted.checks += userData.checks;
    totalDeleted.categories += userData.categories;
    totalDeleted.stores += userData.stores;
    
    // Удаляем самого пользователя
    await User.findByIdAndDelete(id);
    totalDeleted.users += 1;

    console.log(`[users] Deleted user ${id} (${user.role}) with: ${totalDeleted.products} products, ${totalDeleted.customers} customers, ${totalDeleted.debts} debts, ${totalDeleted.checks} checks, ${totalDeleted.categories} categories, ${totalDeleted.stores} stores, ${totalDeleted.users} users total`);

    res.json({ 
      success: true, 
      message: "Foydalanuvchi va barcha ma'lumotlari o'chirildi",
      deleted: totalDeleted
    });
  } catch (error: any) {
    console.error("[users] Delete error:", error?.message || error);
    res.status(500).json({ success: false, error: "Server error" });
  }
}
