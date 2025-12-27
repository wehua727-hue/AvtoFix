import { RequestHandler } from "express";
import mongoose from "mongoose";
import { connectMongo } from "../mongo";

const CATEGORIES_COLLECTION = process.env.OFFLINE_CATEGORIES_COLLECTION || "categories";

interface CategoryDoc {
  _id: any;
  name?: string;
  storeId?: string;
  parentId?: any;
  order?: number;
  level?: number;
  isActive?: boolean;
  slug?: string;
  userId?: string;
}

// Специальный пользователь который видит старые категории
// Админ определяется по телефону 910712828
const ADMIN_PHONE = "910712828";
const normalizePhone = (phone: string) => phone.replace(/[^\d]/g, "");

export const handleCategoriesGet: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      console.error('[api/categories GET] MongoDB connection failed');
      // Offline/demo rejim: Mongo ulanmagan bo'lsa ham frontend ishlashi uchun 200 va bo'sh ro'yxat qaytaramiz
      return res.status(200).json({ categories: [], message: "MongoDB ulanmagan" });
    }

    const db = conn.db;
    const userId = req.query.userId as string | undefined;
    const userPhone = req.query.userPhone as string | undefined;
    // Marketplace uchun - barcha kategoriyalarni ko'rsatish
    const includeAll = req.query.includeAll === 'true';
    
    // Проверка на админа - по телефону 910712828
    const normalizedUserPhone = userPhone ? normalizePhone(userPhone) : "";
    const isAdmin = normalizedUserPhone === ADMIN_PHONE || normalizedUserPhone.endsWith(ADMIN_PHONE);
    
    console.log('[categories] userId:', userId, 'userPhone:', userPhone, 'isAdmin:', isAdmin, 'includeAll:', includeAll);
    
    let filter: any = {};
    
    // Marketplace uchun - barcha kategoriyalarni qaytarish
    if (includeAll) {
      console.log('[categories] includeAll=true - returning all categories for Marketplace');
      filter = {}; // Barcha kategoriyalar
    } else if (!userId) {
      // Если userId не передан, не показываем ничего
      console.log('[categories] No userId - returning empty');
      return res.json({ categories: [] });
    } else if (isAdmin) {
      // Админ (692886decbdcb5ce5fd124a4 / 910712828) видит:
      // 1. Категории без userId (старые категории)
      // 2. Свои категории
      console.log('[categories] Admin access - showing old + own categories');
      filter = {
        $or: [
          { userId: { $exists: false } },
          { userId: null },
          { userId: "" },
          { userId: userId }
        ]
      };
    } else {
      // Обычные пользователи видят ТОЛЬКО свои категории
      console.log('[categories] Regular user - showing only own categories');
      filter = { userId: userId };
    }
    
    // Временно: показываем ВСЕ категории для отладки
    const allCategories = await db.collection(CATEGORIES_COLLECTION).find({}).toArray();
    console.log('[api/categories GET] ALL categories in DB:', allCategories.length);
    allCategories.forEach((c: any) => {
      console.log('  -', c.name, '| userId:', c.userId || 'NO_USER_ID', '| _id:', c._id);
    });
    
    console.log('[api/categories GET] Using collection:', CATEGORIES_COLLECTION, 'filter:', JSON.stringify(filter));
    const raw: CategoryDoc[] = await db.collection(CATEGORIES_COLLECTION).find(filter).toArray();
    console.log('[api/categories GET] Found categories after filter:', raw.length);
    
    // Логируем первые несколько категорий для отладки
    if (raw.length > 0) {
      console.log('[api/categories GET] Sample categories:', raw.slice(0, 3).map(c => ({
        _id: c._id,
        name: c.name,
        userId: c.userId || 'NO_USER_ID'
      })));
    }

    const categories = raw.map((c) => ({
      id: c._id?.toString?.() ?? "",
      name: c.name ?? "",
      storeId: c.storeId ?? "",
      parentId: c.parentId ? c.parentId.toString?.() ?? null : null,
      order: typeof c.order === "number" ? c.order : 0,
      level: typeof c.level === "number" ? c.level : 0,
      isActive: typeof c.isActive === "boolean" ? c.isActive : true,
      slug: c.slug ?? "",
    }));

    return res.json({ categories });
  } catch (err) {
    console.error("[api/categories GET] error", err);
    // Offline/demo rejimida xatolik bo'lsa ham 200 va bo'sh ro'yxat qaytaramiz
    return res.status(200).json({ categories: [], message: "Kategoriya ro'yxatini olishda xatolik, offline rejim" });
  }
};

export const handleCategoriesCreate: RequestHandler = async (req, res) => {
  try {
    const { name, storeId, parentId, level, order, isActive, slug, userId } = req.body || {};

    if (!name) {
      return res.status(400).json({ success: false, message: "name kerak" });
    }

    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, message: "MongoDB ulanmagan" });
    }

    const db = conn.db;
    const doc: any = { name };
    if (storeId) doc.storeId = storeId;
    if (parentId) doc.parentId = parentId;
    if (typeof level === "number") doc.level = level;
    if (typeof order === "number") doc.order = order;
    if (typeof isActive === "boolean") doc.isActive = isActive;
    if (slug) doc.slug = slug;
    if (userId) doc.userId = userId; // Привязка к пользователю

    const result = await db.collection(CATEGORIES_COLLECTION).insertOne(doc);

    const category = {
      id: result.insertedId.toString(),
      name,
      storeId: storeId ?? "",
      parentId: parentId ?? null,
      level: typeof level === "number" ? level : 0,
      order: typeof order === "number" ? order : 0,
      isActive: typeof isActive === "boolean" ? isActive : true,
      slug: slug ?? "",
    };

    return res.status(201).json({ success: true, category });
  } catch (err) {
    console.error("[api/categories POST] error", err);
    return res.status(500).json({ success: false, message: "Server xatosi" });
  }
};

export const handleCategoryUpdate: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parentId, level, order, isActive, slug } = req.body || {};

    console.log('[handleCategoryUpdate] Received request:', { id, body: req.body });

    if (!id) {
      return res.status(400).json({ success: false, message: "id kerak" });
    }

    const conn = await connectMongo();
    if (!conn || !conn.db) {
      console.error('[handleCategoryUpdate] MongoDB connection failed');
      return res.status(500).json({ success: false, message: "MongoDB ulanmagan" });
    }

    const db = conn.db;
    let _id: any;
    
    try {
      _id = new mongoose.Types.ObjectId(id);
      console.log('[handleCategoryUpdate] Converted to ObjectId:', _id);
    } catch (err) {
      console.error('[handleCategoryUpdate] Invalid ObjectId:', id, err);
      return res.status(400).json({ success: false, message: "Noto'g'ri ID formati" });
    }

    // Check if category exists before updating
    const existingCategory = await db.collection(CATEGORIES_COLLECTION).findOne({ _id });
    console.log('[handleCategoryUpdate] Existing category:', existingCategory);
    
    if (!existingCategory) {
      console.error('[handleCategoryUpdate] Category not found with _id:', _id);
      // List all categories to debug
      const allCategories = await db.collection(CATEGORIES_COLLECTION).find({}).toArray();
      console.log('[handleCategoryUpdate] All categories in DB:', allCategories.map(c => ({ _id: c._id, name: c.name })));
      return res.status(404).json({ success: false, message: "Kategoriya topilmadi" });
    }

    const update: any = {};
    if (typeof name === "string") update.name = name;
    if (parentId !== undefined) update.parentId = parentId;
    if (typeof level === "number") update.level = level;
    if (typeof order === "number") update.order = order;
    if (typeof isActive === "boolean") update.isActive = isActive;
    if (typeof slug === "string") update.slug = slug;

    console.log('[handleCategoryUpdate] Update object:', update);

    const result = await db.collection(CATEGORIES_COLLECTION).findOneAndUpdate(
      { _id },
      { $set: update },
      { returnDocument: "after" }
    );

    console.log('[handleCategoryUpdate] Update result:', result);

    // MongoDB driver 5.0+ versiyalarida result to'g'ridan-to'g'ri hujjatni qaytaradi (result.value emas)
    const updatedDoc = result;
    
    if (!updatedDoc) {
      return res.status(404).json({ success: false, message: "Kategoriya topilmadi" });
    }

    const c = updatedDoc as CategoryDoc;
    const category = {
      id: c._id?.toString?.() ?? "",
      name: c.name ?? "",
      storeId: c.storeId ?? "",
      parentId: c.parentId ? c.parentId.toString?.() ?? null : null,
      order: typeof c.order === "number" ? c.order : 0,
      level: typeof c.level === "number" ? c.level : 0,
      isActive: typeof c.isActive === "boolean" ? c.isActive : true,
      slug: c.slug ?? "",
    };

    console.log('[handleCategoryUpdate] Returning category:', category);
    return res.json({ success: true, category });
  } catch (err) {
    console.error("[api/categories PUT] error", err);
    return res.status(500).json({ success: false, message: "Server xatosi", error: err instanceof Error ? err.message : String(err) });
  }
};

export const handleCategoryDelete: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[handleCategoryDelete] Received request:', { id });

    if (!id) {
      return res.status(400).json({ success: false, message: "id kerak" });
    }

    const conn = await connectMongo();
    if (!conn || !conn.db) {
      console.error('[handleCategoryDelete] MongoDB connection failed');
      return res.status(500).json({ success: false, message: "MongoDB ulanmagan" });
    }

    const db = conn.db;
    let _id: any;
    
    try {
      _id = new mongoose.Types.ObjectId(id);
    } catch (err) {
      console.error('[handleCategoryDelete] Invalid ObjectId:', id, err);
      return res.status(400).json({ success: false, message: "Noto'g'ri ID formati" });
    }

    console.log('[handleCategoryDelete] Deleting with _id:', _id);

    const result = await db.collection(CATEGORIES_COLLECTION).deleteOne({ _id });

    console.log('[handleCategoryDelete] Delete result:', result);

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Kategoriya topilmadi" });
    }

    console.log('[handleCategoryDelete] Category deleted successfully');
    return res.json({ success: true });
  } catch (err) {
    console.error("[api/categories DELETE] error", err);
    return res.status(500).json({ success: false, message: "Server xatosi", error: err instanceof Error ? err.message : String(err) });
  }
};
