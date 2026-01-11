/**
 * OFFLINE-COMPATIBLE PRODUCTS ROUTES
 * 
 * This file provides MongoDB-compatible API endpoints that work with local JSON database
 * for the Electron offline version. It replaces server/routes/products.ts for offline mode.
 * 
 * Key differences from MongoDB version:
 * - Uses local-db functions instead of MongoDB collections
 * - No ObjectId validation (uses string IDs)
 * - Simplified query logic (no complex MongoDB operators)
 * - All operations are synchronous with file I/O
 */

import { RequestHandler } from "express";
import { 
  findDocuments, 
  findOneDocument, 
  addDocument, 
  updateDocument, 
  deleteDocument,
  getCollection 
} from "../db/local-db";
import { wsManager } from "../websocket";

const PRODUCTS_COLLECTION = "products";
const CATEGORIES_COLLECTION = "categories";
const PRODUCT_HISTORY_COLLECTION = "product_history";
const PRODUCT_STATUS_VALUES = new Set(["available", "pending", "out-of-stock", "discontinued"]);

const normalizeProductStatus = (value?: string | null) =>
  value && PRODUCT_STATUS_VALUES.has(value) ? value : "available";

const ADMIN_PHONE = "910712828";
const normalizePhone = (phone: string) => phone.replace(/[^\d]/g, "");

/**
 * GET /api/products - Fetch products with filtering
 */
export const handleProductsGet: RequestHandler = async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const userPhone = req.query.userPhone as string | undefined;
    const includeHidden = req.query.includeHidden === 'true';

    const normalizedUserPhone = userPhone ? normalizePhone(userPhone) : "";
    const isAdminPhone = normalizedUserPhone === ADMIN_PHONE || normalizedUserPhone.endsWith(ADMIN_PHONE);

    console.log("[products] Fetching with filters:", { userId, userPhone, isAdminPhone, includeHidden });

    // Get all products
    let products = getCollection(PRODUCTS_COLLECTION);

    // Apply user filter
    if (isAdminPhone && userId) {
      // Admin sees: unowned products + own products
      products = products.filter((p: any) => 
        !p.userId || p.userId === userId
      );
    } else if (userId) {
      // Regular users see only their products
      products = products.filter((p: any) => p.userId === userId);
    }

    // Apply hidden filter
    if (!includeHidden) {
      products = products.filter((p: any) => !p.isHidden);
    }

    // Enrich with category names
    const categories = getCollection(CATEGORIES_COLLECTION);
    const categoriesMap: Record<string, string> = {};
    categories.forEach((cat: any) => {
      categoriesMap[cat._id] = cat.name || '';
    });

    const enrichedProducts = products.map((product: any) => ({
      ...product,
      categoryName: product.categoryName || (product.categoryId ? categoriesMap[product.categoryId] : ''),
      stock: product.stock ?? 0,
      initialStock: product.initialStock ?? product.stock ?? 0,
      variantSummaries: Array.isArray(product.variantSummaries) 
        ? product.variantSummaries.map((v: any) => ({
            ...v,
            stock: v.stock ?? 0,
            initialStock: v.initialStock ?? v.stock ?? 0,
          }))
        : [],
    }));

    return res.json(enrichedProducts);
  } catch (error) {
    console.error("[api/products GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch products" });
  }
};

/**
 * GET /api/products/:id - Fetch single product
 */
export const handleProductGetById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const product = findOneDocument(PRODUCTS_COLLECTION, { _id: id });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json({
      success: true,
      product: {
        ...product,
        id: product._id,
        stock: product.stock ?? 0,
        initialStock: product.initialStock ?? product.stock ?? 0,
        variantSummaries: Array.isArray(product.variantSummaries)
          ? product.variantSummaries.map((v: any) => ({
              ...v,
              stock: v.stock ?? 0,
              initialStock: v.initialStock ?? v.stock ?? 0,
            }))
          : [],
      }
    });
  } catch (error) {
    console.error("[api/products/:id GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch product" });
  }
};

/**
 * POST /api/products - Create new product
 */
export const handleProductsCreate: RequestHandler = async (req, res) => {
  try {
    const {
      name,
      price,
      basePrice,
      priceMultiplier,
      currency = "UZS",
      sku,
      categoryId,
      stock = 0,
      status,
      description,
      imageUrl,
      imagePaths,
      userId,
      userRole,
      variantSummaries = [],
      isHidden = false,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Product name is required" });
    }

    console.log('[Products POST] Creating:', { name, sku, stock, userId });

    const newProduct = addDocument(PRODUCTS_COLLECTION, {
      name: name.trim(),
      price: price || 0,
      basePrice: basePrice || undefined,
      priceMultiplier: priceMultiplier || undefined,
      currency,
      sku: sku || undefined,
      categoryId: categoryId || undefined,
      stock: stock || 0,
      initialStock: stock || 0, // Important: initial stock equals current stock for new products
      status: normalizeProductStatus(status),
      description: description || "",
      imageUrl: imageUrl || "",
      imagePaths: Array.isArray(imagePaths) ? imagePaths : [],
      variantSummaries: Array.isArray(variantSummaries) 
        ? variantSummaries.map((v: any) => ({
            ...v,
            stock: v.stock ?? 0,
            initialStock: v.initialStock ?? v.stock ?? 0,
          }))
        : [],
      userId: userId || undefined,
      userRole: userRole || undefined,
      isHidden,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Broadcast via WebSocket
    if (userId) {
      wsManager.broadcastToUser(userId, {
        type: 'product-created',
        productId: newProduct._id,
        productName: newProduct.name,
        timestamp: Date.now(),
      });
    }

    // Save to history
    try {
      addDocument(PRODUCT_HISTORY_COLLECTION, {
        userId: userId || 'system',
        type: 'create',
        productId: newProduct._id,
        productName: newProduct.name,
        sku: newProduct.sku || '',
        stock: newProduct.stock || 0,
        addedStock: newProduct.stock || 0,
        price: newProduct.price || 0,
        currency: newProduct.currency || 'UZS',
        message: `Yangi mahsulot qo'shildi: ${newProduct.name} (${newProduct.stock || 0} ta)`,
        timestamp: new Date(),
      });
    } catch (histErr) {
      console.error('[Products POST] Failed to save history:', histErr);
    }

    return res.status(201).json({
      success: true,
      product: newProduct,
    });
  } catch (error) {
    console.error("[api/products POST] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to create product" });
  }
};

/**
 * PUT /api/products/:id - Update product
 */
export const handleProductUpdate: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      price,
      basePrice,
      priceMultiplier,
      currency,
      sku,
      categoryId,
      stock,
      initialStock,
      status,
      description,
      imageUrl,
      imagePaths,
      variantSummaries,
      isHidden,
      userRole,
      canEditProducts,
    } = req.body;

    // Permission check for staff
    // Yangi mahsulot qo'shish uchun xodim ruxsat oladi
    // Tahrirlash uchun xodim ruxsat olmaydi
    if (userRole === 'xodim' && id) {
      return res.status(403).json({ 
        success: false, 
        error: "Xodim mahsulotlarni tahrirlash huquqiga ega emas" 
      });
    }

    const existingProduct = findOneDocument(PRODUCTS_COLLECTION, { _id: id });
    if (!existingProduct) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

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
    if (status !== undefined) updateData.status = normalizeProductStatus(status);
    if (description !== undefined) updateData.description = description;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (imagePaths !== undefined) updateData.imagePaths = Array.isArray(imagePaths) ? imagePaths : [];
    if (isHidden !== undefined) updateData.isHidden = isHidden;

    // Handle stock updates
    if (stock !== undefined) {
      const oldStock = existingProduct.stock || 0;
      const oldInitialStock = existingProduct.initialStock;
      
      updateData.stock = stock;
      
      // If stock increased, add the difference to initialStock
      if (stock > oldStock && oldInitialStock !== undefined) {
        const increase = stock - oldStock;
        updateData.initialStock = oldInitialStock + increase;
      }
    }

    if (initialStock !== undefined) {
      updateData.initialStock = initialStock;
    }
    
    // MUHIM: Agar initialStock hali ham o'rnatilmagan bo'lsa, mavjud qiymatdan olish yoki stock dan olish
    if (updateData.initialStock === undefined) {
      const currentInitialStock = existingProduct.initialStock;
      if (currentInitialStock !== undefined && currentInitialStock !== null) {
        updateData.initialStock = currentInitialStock;
      } else {
        // initialStock yo'q bo'lsa, stock dan olish (qaytarish cheklovi uchun)
        updateData.initialStock = existingProduct.stock || 0;
      }
    }

    // Handle variant updates
    if (variantSummaries !== undefined) {
      updateData.variantSummaries = Array.isArray(variantSummaries)
        ? variantSummaries.map((v: any) => ({
            ...v,
            stock: v.stock ?? 0,
            initialStock: v.initialStock ?? v.stock ?? 0,
          }))
        : [];
    }

    const updatedProduct = updateDocument(PRODUCTS_COLLECTION, id, updateData);

    if (!updatedProduct) {
      return res.status(404).json({ success: false, error: "Failed to update product" });
    }

    // Format response with proper initialStock fallback
    const productCurrency = updatedProduct.currency || 'UZS';
    const responseStock = updatedProduct.stock ?? 0;
    const responseInitialStock = updatedProduct.initialStock ?? responseStock; // Fallback to stock if initialStock is missing
    
    let responseVariantSummaries = updatedProduct.variantSummaries ?? [];
    if (Array.isArray(responseVariantSummaries)) {
      responseVariantSummaries = responseVariantSummaries.map((v: any) => ({
        ...v,
        stock: v.stock ?? 0,
        initialStock: v.initialStock ?? v.stock ?? 0, // Fallback for variants too
        currency: v.currency || productCurrency,
      }));
    }
    
    const formattedProduct = {
      ...updatedProduct,
      stock: responseStock,
      initialStock: responseInitialStock,
      variantSummaries: responseVariantSummaries,
    };

    return res.json({
      success: true,
      product: formattedProduct,
    });
  } catch (error) {
    console.error("[api/products PUT] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to update product" });
  }
};

/**
 * DELETE /api/products/:id - Delete product
 */
export const handleProductDelete: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userRole, canEditProducts } = req.body;

    const product = findOneDocument(PRODUCTS_COLLECTION, { _id: id });
    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    // Permission check
    if (product.userId && product.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: "You don't have permission to delete this product" 
      });
    }

    // MUHIM: Xodimlar uchun permission tekshirish
    // Switch o'chiq bo'lganda (canEditProducts=true) - o'chirish mumkin
    // Switch yoqib bo'lganda (canEditProducts=false) - o'chira olmaydi
    if (userRole === 'xodim' && !canEditProducts) {
      return res.status(403).json({ success: false, error: "Xodim mahsulotlarni o'chirish huquqiga ega emas" });
    }

    // MUHIM: Agar mahsulotda xillar (variantlar) bo'lsa, eng kichik SKU li xilni yangi ota mahsulot qilish
    const productVariants = product?.variantSummaries || [];
    if (productVariants.length > 0) {
      console.log('[Products DELETE] Product has variants:', productVariants.length);
      
      // Eng kichik SKU li xilni topish
      const sortedVariants = [...productVariants].sort((a: any, b: any) => {
        const aSku = a.sku ? String(a.sku) : '';
        const bSku = b.sku ? String(b.sku) : '';
        return aSku.localeCompare(bSku, undefined, { numeric: true });
      });
      
      const smallestVariant = sortedVariants[0];
      console.log('[Products DELETE] Smallest variant:', smallestVariant?.sku, smallestVariant?.name);
      
      if (smallestVariant) {
        // Yangi ota mahsulot yaratish (eng kichik SKU li xildan)
        // MUHIM: Yangi ota mahsulot variant nomini saqlab qoladi, ota mahsulot nomini emas
        const newParentProduct = {
          name: smallestVariant.name, // Variant nomini saqlab qolish
          sku: smallestVariant.sku, // Faqat SKU o'zgaradi
          price: smallestVariant.price || product.price,
          basePrice: smallestVariant.basePrice || product.basePrice,
          priceMultiplier: smallestVariant.priceMultiplier || product.priceMultiplier,
          stock: smallestVariant.stock || 0,
          initialStock: smallestVariant.initialStock || smallestVariant.stock || 0,
          currency: smallestVariant.currency || product.currency,
          categoryId: product.categoryId,
          status: product.status,
          description: product.description,
          imageUrl: smallestVariant.imageUrl || product.imageUrl,
          imagePaths: smallestVariant.imagePaths || product.imagePaths,
          userId: product.userId,
          createdByRole: product.createdByRole,
          // Qolgan xillarni variantSummaries ga qo'shish (eng kichik xildan boshqa)
          variantSummaries: sortedVariants.slice(1).map((v: any) => ({
            name: v.name,
            sku: v.sku,
            price: v.price,
            basePrice: v.basePrice,
            priceMultiplier: v.priceMultiplier,
            stock: v.stock,
            initialStock: v.initialStock,
            currency: v.currency,
            imageUrl: v.imageUrl,
            imagePaths: v.imagePaths,
            status: v.status,
          })),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        console.log('[Products DELETE] Creating new parent product with', newParentProduct.variantSummaries.length, 'variants');
        
        // Yangi ota mahsulotni yaratish
        addDocument(PRODUCTS_COLLECTION, newParentProduct);
      }
    }

    const deleted = deleteDocument(PRODUCTS_COLLECTION, id);

    if (!deleted) {
      return res.status(500).json({ success: false, error: "Failed to delete product" });
    }

    // Save to history
    try {
      addDocument(PRODUCT_HISTORY_COLLECTION, {
        userId: userId || 'system',
        type: 'delete',
        productId: id,
        productName: product.name,
        sku: product.sku || '',
        stock: product.stock || 0,
        message: `Mahsulot o'chirildi: ${product.name}`,
        timestamp: new Date(),
      });
    } catch (histErr) {
      console.error('[Products DELETE] Failed to save history:', histErr);
    }

    return res.json({ success: true, message: "Product deleted" });
  } catch (error) {
    console.error("[api/products DELETE] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete product" });
  }
};

/**
 * DELETE /api/products/clear-all - Clear all products for user
 */
export const handleProductsClearAll: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId required" });
    }

    const products = findDocuments(PRODUCTS_COLLECTION, { userId });
    let deletedCount = 0;

    for (const product of products) {
      if (deleteDocument(PRODUCTS_COLLECTION, product._id)) {
        deletedCount++;
      }
    }

    console.log(`[api/products/clear-all] Deleted ${deletedCount} products for user ${userId}`);

    return res.json({ 
      success: true, 
      message: `${deletedCount} products deleted`,
      deletedCount 
    });
  } catch (error) {
    console.error("[api/products/clear-all] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to clear products" });
  }
};

/**
 * PATCH /api/products/:id/stock - Update product stock
 */
export const handleProductStockUpdate: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, reason, userId } = req.body;

    if (stock === undefined || stock === null) {
      return res.status(400).json({ success: false, error: "Stock value required" });
    }

    const product = findOneDocument(PRODUCTS_COLLECTION, { _id: id });
    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    const oldStock = product.stock || 0;
    const oldInitialStock = product.initialStock;

    const updateData: any = {
      stock: stock,
      updatedAt: new Date(),
    };

    // Update initialStock if stock increased
    if (stock > oldStock && oldInitialStock !== undefined) {
      const increase = stock - oldStock;
      updateData.initialStock = oldInitialStock + increase;
    }

    const updatedProduct = updateDocument(PRODUCTS_COLLECTION, id, updateData);

    if (!updatedProduct) {
      return res.status(500).json({ success: false, error: "Failed to update stock" });
    }

    // Save to history
    try {
      addDocument(PRODUCT_HISTORY_COLLECTION, {
        userId: userId || 'system',
        type: 'stock-update',
        productId: id,
        productName: product.name,
        sku: product.sku || '',
        oldStock,
        newStock: stock,
        addedStock: stock - oldStock,
        reason: reason || 'Manual update',
        message: `Stock yangilandi: ${oldStock} -> ${stock}`,
        timestamp: new Date(),
      });
    } catch (histErr) {
      console.error('[Stock Update] Failed to save history:', histErr);
    }

    return res.json({
      success: true,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("[api/products/:id/stock PATCH] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to update stock" });
  }
};

/**
 * GET /api/product-history - Fetch product history
 */
export const handleProductHistoryGet: RequestHandler = async (req, res) => {
  try {
    const { userId, productId, limit = 100 } = req.query;

    let history = getCollection(PRODUCT_HISTORY_COLLECTION);

    if (userId) {
      history = history.filter((h: any) => h.userId === userId);
    }

    if (productId) {
      history = history.filter((h: any) => h.productId === productId);
    }

    // Sort by timestamp descending and limit
    history = history
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, Number(limit));

    return res.json(history);
  } catch (error) {
    console.error("[api/product-history GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch history" });
  }
};

/**
 * POST /api/product-history - Add history entry
 */
export const handleProductHistoryCreate: RequestHandler = async (req, res) => {
  try {
    const { userId, type, productId, productName, sku, stock, addedStock, price, currency, message, variants, source, changes } = req.body;

    if (!userId || !type || !productId) {
      return res.status(400).json({ 
        success: false, 
        error: "userId, type, and productId required" 
      });
    }

    const historyEntry = addDocument(PRODUCT_HISTORY_COLLECTION, {
      userId,
      type,
      productId,
      productName: productName || '',
      sku: sku || '',
      stock: stock || 0,
      addedStock: addedStock || 0,
      price: price || 0,
      currency: currency || 'UZS',
      message: message || '',
      variants: variants || [], // Xillarni saqlash
      source: source || 'manual', // Source ni saqlash
      changes: changes || [], // MUHIM: O'zgarishlarni saqlash
      timestamp: new Date(),
    });

    return res.status(201).json({
      success: true,
      history: historyEntry,
    });
  } catch (error) {
    console.error("[api/product-history POST] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to create history entry" });
  }
};

/**
 * DELETE /api/product-history/:id - Delete history entry
 */
export const handleProductHistoryDelete: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = deleteDocument(PRODUCT_HISTORY_COLLECTION, id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: "History entry not found" });
    }

    return res.json({ success: true, message: "History entry deleted" });
  } catch (error) {
    console.error("[api/product-history DELETE] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete history entry" });
  }
};

/**
 * DELETE /api/product-history/clear - Clear all history for user
 */
export const handleProductHistoryClear: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId required" });
    }

    const history = findDocuments(PRODUCT_HISTORY_COLLECTION, { userId });
    let deletedCount = 0;

    for (const entry of history) {
      if (deleteDocument(PRODUCT_HISTORY_COLLECTION, entry._id)) {
        deletedCount++;
      }
    }

    return res.json({
      success: true,
      message: `${deletedCount} history entries deleted`,
      deletedCount,
    });
  } catch (error) {
    console.error("[api/product-history/clear] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to clear history" });
  }
};

