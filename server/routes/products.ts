import { RequestHandler } from "express";
import mongoose from "mongoose";
import { connectMongo } from "../mongo";
import { wsManager } from "../websocket";

const ObjectId = mongoose.Types.ObjectId;

const PRODUCTS_COLLECTION = process.env.OFFLINE_PRODUCTS_COLLECTION || "products";
const PRODUCT_STATUS_VALUES = new Set(["available", "pending", "out-of-stock", "discontinued"]);
const normalizeProductStatus = (value?: string | null) =>
  value && PRODUCT_STATUS_VALUES.has(value) ? value : "available";

// Специальный номер который видит все товары без фильтрации
const ADMIN_PHONE = "910712828";
const normalizePhone = (phone: string) => phone.replace(/[^\d]/g, ""); // Оставляем только цифры

/**
 * GET /api/products
 */
export const handleProductsGet: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const db = conn.db;
    const collection = db.collection(PRODUCTS_COLLECTION);
    
    // Фильтрация по userId если передан
    const userId = req.query.userId as string | undefined;
    const userPhone = req.query.userPhone as string | undefined;
    // includeHidden=true bo'lsa, yashirin mahsulotlarni ham ko'rsatish (admin panel uchun)
    const includeHidden = req.query.includeHidden === 'true';
    
    // Если это админ с особым номером - показываем все товары
    const normalizedUserPhone = userPhone ? normalizePhone(userPhone) : "";
    const isAdminPhone = normalizedUserPhone === ADMIN_PHONE || normalizedUserPhone.endsWith(ADMIN_PHONE);
    
    console.log("[products] userId:", userId);
    console.log("[products] userPhone:", userPhone);
    console.log("[products] normalized:", normalizedUserPhone);
    console.log("[products] ADMIN_PHONE:", ADMIN_PHONE);
    console.log("[products] isAdmin:", isAdminPhone);
    console.log("[products] includeHidden:", includeHidden);
    
    let filter: any = {};
    
    if (isAdminPhone && userId) {
      // Админ (910712828) видит:
      // 1. Товары без userId (ничьи товары)
      // 2. Свои товары (созданные им)
      console.log("[products] Admin access - showing unowned + own products");
      filter = {
        $or: [
          { userId: { $exists: false } },
          { userId: null },
          { userId: "" },
          { userId: userId }
        ]
      };
    } else if (userId) {
      // Обычные пользователи видят ТОЛЬКО свои товары
      console.log("[products] Regular user - showing only own products");
      filter = { userId: userId };
    }
    
    // Yashirin mahsulotlarni filtrlash (agar includeHidden=false bo'lsa)
    if (!includeHidden) {
      filter = {
        ...filter,
        $and: [
          filter.$or ? { $or: filter.$or } : {},
          { $or: [{ isHidden: { $exists: false } }, { isHidden: false }] }
        ].filter(f => Object.keys(f).length > 0)
      };
      // Agar filter bo'sh bo'lsa, oddiy filter ishlatish
      if (!filter.$and || filter.$and.length === 0) {
        filter = { $or: [{ isHidden: { $exists: false } }, { isHidden: false }] };
      }
    }
    
    const products = await collection.find(filter).toArray();

    // Ensure variantSummaries have currency from product if not set
    const productsWithCurrency = products.map((product: any) => {
      const productCurrency = product.currency || 'UZS';
      let variantSummaries = product.variantSummaries;
      if (Array.isArray(variantSummaries)) {
        variantSummaries = variantSummaries.map((v: any) => ({
          ...v,
          currency: v.currency || productCurrency,
        }));
      }
      return {
        ...product,
        variantSummaries,
      };
    });

    return res.json(productsWithCurrency);
  } catch (error) {
    console.error("[api/products GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch products" });
  }
};

/**
 * GET /api/products/:id
 */
export const handleProductGetById: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ error: "Database not available" });
    }
    const db = conn.db;

    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const collection = db.collection(PRODUCTS_COLLECTION);
    const product = await collection.findOne({ _id: new ObjectId(id) });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Ensure variantSummaries have currency from product if not set
    const productCurrency = product.currency || 'UZS';
    let variantSummaries = product.variantSummaries;
    if (Array.isArray(variantSummaries)) {
      variantSummaries = variantSummaries.map((v: any) => ({
        ...v,
        currency: v.currency || productCurrency, // Xilning valyutasi yoki mahsulotning valyutasi
      }));
    }

    // Return in expected format with success flag and product object
    return res.json({ 
      success: true, 
      product: {
        ...product,
        id: product._id.toString(),
        variantSummaries, // Updated with currency
      }
    });
  } catch (error) {
    console.error("[api/products/:id GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch product" });
  }
};

/**
 * POST /api/products
 */
export const handleProductsCreate: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, error: "Database not available" });
    }
    const db = conn.db;

    const {
      name,
      price,
      basePrice,
      priceMultiplier,
      currency = "UZS",
      sku,
      categoryId,
      stock,
      status,
      description,
      imageUrl,
      imagePaths,
      offlineId,
      userId,
      sizes,
      variantSummaries,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Product name is required" });
    }

    const collection = db.collection(PRODUCTS_COLLECTION);

    // Parse sizes if string
    let parsedSizes: string[] = [];
    if (typeof sizes === 'string') {
      parsedSizes = sizes.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else if (Array.isArray(sizes)) {
      parsedSizes = sizes;
    }

    // Ota-bola mahsulot tizimi uchun qo'shimcha maydonlar
    const {
      parentProductId,
      childProducts,
      isHidden,
    } = req.body;

    const newProduct: any = {
      name: name.trim(),
      sizes: parsedSizes,
      images: [],
      price: price || 0,
      basePrice: basePrice || undefined,
      priceMultiplier: priceMultiplier || undefined,
      currency,
      sku: sku || undefined,
      categoryId: categoryId || undefined,
      stock: stock || 0,
      status: normalizeProductStatus(status),
      description: description || "",
      imageUrl: imageUrl || "",
      imagePaths: Array.isArray(imagePaths) ? imagePaths : [],
      variantSummaries: Array.isArray(variantSummaries) ? variantSummaries : [],
      // Ota-bola mahsulot tizimi
      parentProductId: parentProductId || undefined,
      childProducts: Array.isArray(childProducts) ? childProducts : [],
      isHidden: isHidden || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Only add offlineId if it exists (to avoid null values)
    if (offlineId) {
      newProduct.offlineId = offlineId;
    }
    
    // Привязка к пользователю
    if (userId) {
      newProduct.userId = userId;
    }
    
    // Привязка к магазину (storeId передаётся с клиента)
    const { storeId } = req.body;
    if (storeId) {
      newProduct.storeId = storeId;
    }

    console.log("[api/products POST] Creating product with variantSummaries:", newProduct.variantSummaries?.length || 0);

    const result = await collection.insertOne(newProduct);

    const createdProduct = {
      ...newProduct,
      _id: result.insertedId,
      id: result.insertedId.toString(),
    };

    // Broadcast product creation via WebSocket
    if (userId) {
      wsManager.broadcastToUser(userId, {
        type: 'product-created',
        productId: createdProduct.id,
        productName: createdProduct.name,
        userId,
        timestamp: Date.now(),
      });
    } else {
      wsManager.broadcast({
        type: 'product-created',
        productId: createdProduct.id,
        productName: createdProduct.name,
        timestamp: Date.now(),
      });
    }

    return res.status(201).json({
      success: true,
      product: createdProduct,
    });
  } catch (error) {
    console.error("[api/products POST] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to create product" });
  }
};

/**
 * PUT /api/products/:id
 */
export const handleProductUpdate: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, error: "Database not available" });
    }
    const db = conn.db;

    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid product ID" });
    }

    const {
      name,
      price,
      basePrice,
      priceMultiplier,
      currency,
      sku,
      categoryId,
      stock,
      status,
      description,
      imageUrl,
      imagePaths,
      sizes,
      variantSummaries,
      // Ota-bola mahsulot tizimi
      parentProductId,
      childProducts,
      isHidden,
    } = req.body;

    const collection = db.collection(PRODUCTS_COLLECTION);

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (price !== undefined) updateData.price = price;
    if (basePrice !== undefined) updateData.basePrice = basePrice;
    if (priceMultiplier !== undefined) updateData.priceMultiplier = priceMultiplier;
    if (currency !== undefined) updateData.currency = currency;
    if (sku !== undefined) updateData.sku = sku;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (stock !== undefined) updateData.stock = stock;
    if (status !== undefined) updateData.status = normalizeProductStatus(status);
    if (description !== undefined) updateData.description = description;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (imagePaths !== undefined) updateData.imagePaths = Array.isArray(imagePaths) ? imagePaths : [];
    
    // Handle sizes
    if (sizes !== undefined) {
      if (typeof sizes === 'string') {
        updateData.sizes = sizes.split(',').map((s: string) => s.trim()).filter(Boolean);
      } else if (Array.isArray(sizes)) {
        updateData.sizes = sizes;
      }
    }
    
    // Handle variantSummaries - always update if provided (even empty array to clear)
    if (variantSummaries !== undefined) {
      updateData.variantSummaries = Array.isArray(variantSummaries) ? variantSummaries : [];
      console.log("[api/products PUT] Updating variantSummaries:", updateData.variantSummaries.length);
    }
    
    // Ota-bola mahsulot tizimi
    if (parentProductId !== undefined) updateData.parentProductId = parentProductId;
    if (childProducts !== undefined) updateData.childProducts = Array.isArray(childProducts) ? childProducts : [];
    if (isHidden !== undefined) updateData.isHidden = isHidden;

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    const updatedProduct = {
      ...result,
      id: result._id.toString(),
    };

    // Broadcast product update via WebSocket
    const productUserId = (result as any).userId;
    const productName = (result as any).name || 'Unknown';
    if (productUserId) {
      wsManager.broadcastToUser(productUserId, {
        type: 'product-updated',
        productId: updatedProduct.id,
        productName: productName,
        userId: productUserId,
        timestamp: Date.now(),
      });
    } else {
      wsManager.broadcast({
        type: 'product-updated',
        productId: updatedProduct.id,
        productName: productName,
        timestamp: Date.now(),
      });
    }

    return res.json({ success: true, product: updatedProduct });
  } catch (error) {
    console.error("[api/products/:id PUT] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to update product" });
  }
};

/**
 * DELETE /api/products/:id
 */
export const handleProductDelete: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ error: "Database not available" });
    }
    const db = conn.db;

    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const collection = db.collection(PRODUCTS_COLLECTION);
    
    // Get product before deletion to broadcast
    const product = await collection.findOne({ _id: new ObjectId(id) });
    const productUserId = product?.userId;
    const productName = product?.name;

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Broadcast product deletion via WebSocket
    if (productUserId) {
      wsManager.broadcastToUser(productUserId, {
        type: 'product-deleted',
        productId: id,
        productName: productName || 'Unknown',
        userId: productUserId,
        timestamp: Date.now(),
      });
    } else {
      wsManager.broadcast({
        type: 'product-deleted',
        productId: id,
        productName: productName || 'Unknown',
        timestamp: Date.now(),
      });
    }

    return res.json({ success: true, message: "Product deleted" });
  } catch (error) {
    console.error("[api/products/:id DELETE] Error:", error);
    return res.status(500).json({ error: "Failed to delete product" });
  }
};

/**
 * PATCH /api/products/:id/stock
 * Обновление количества товара на складе
 * Agar stock 0 bo'lsa, bola mahsulotlarni faollashtirish
 */
export const handleProductStockUpdate: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ error: "Database not available" });
    }
    const db = conn.db;

    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const { change, variantIndex } = req.body;
    if (typeof change !== "number") {
      return res.status(400).json({ error: "Change value is required and must be a number" });
    }

    const collection = db.collection(PRODUCTS_COLLECTION);
    
    // Получаем текущий товар
    const product = await collection.findOne({ _id: new ObjectId(id) });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    let newStock: number;
    let updateQuery: any;

    // Agar variant bo'lsa
    if (variantIndex !== undefined && product.variantSummaries && product.variantSummaries[variantIndex]) {
      const currentStock = product.variantSummaries[variantIndex].stock || 0;
      newStock = Math.max(0, currentStock + change);
      
      // Variant stock ni yangilash
      const updatedVariants = [...product.variantSummaries];
      updatedVariants[variantIndex] = {
        ...updatedVariants[variantIndex],
        stock: newStock
      };
      
      updateQuery = {
        $set: {
          variantSummaries: updatedVariants,
          updatedAt: new Date()
        }
      };
    } else {
      // Oddiy mahsulot
      const currentStock = product.stock || 0;
      newStock = Math.max(0, currentStock + change);
      
      updateQuery = {
        $set: {
          stock: newStock,
          updatedAt: new Date()
        }
      };
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      updateQuery,
      { returnDocument: "after" }
    );

    // Agar stock 0 bo'lsa, bola mahsulotlarni faollashtirish
    let activatedChildren: string[] = [];
    if (newStock === 0 && product.childProducts && product.childProducts.length > 0) {
      console.log(`[api/products/:id/stock] Stock is 0, activating child products for: ${id}`);
      
      for (const child of product.childProducts) {
        if (!child.autoActivate) continue;
        
        try {
          // Bola mahsulotni ko'rinadigan qilish
          const childResult = await collection.findOneAndUpdate(
            { _id: new ObjectId(child.productId), isHidden: true },
            { $set: { isHidden: false, updatedAt: new Date() } },
            { returnDocument: "after" }
          );
          
          if (childResult) {
            activatedChildren.push(child.productId);
            console.log(`[api/products/:id/stock] Child product activated: ${child.name} (${child.productId})`);
            
            // WebSocket orqali xabar yuborish
            const productUserId = product.userId;
            if (productUserId) {
              wsManager.broadcastToUser(productUserId, {
                type: 'child-product-activated',
                parentProductId: id,
                childProductId: child.productId,
                childProductName: child.name,
                timestamp: Date.now(),
              });
            }
          }
        } catch (childErr) {
          console.error(`[api/products/:id/stock] Failed to activate child: ${child.productId}`, childErr);
        }
      }
    }

    return res.json({ 
      success: true, 
      stock: newStock, 
      product: result,
      activatedChildren 
    });
  } catch (error) {
    console.error("[api/products/:id/stock PATCH] Error:", error);
    return res.status(500).json({ error: "Failed to update stock" });
  }
};
