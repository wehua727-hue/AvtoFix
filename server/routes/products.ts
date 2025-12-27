import { RequestHandler } from "express";
import mongoose from "mongoose";
import { connectMongo } from "../mongo";
import { wsManager } from "../websocket";

const ObjectId = mongoose.Types.ObjectId;

const PRODUCTS_COLLECTION = process.env.OFFLINE_PRODUCTS_COLLECTION || "products";
const CATEGORIES_COLLECTION = process.env.OFFLINE_CATEGORIES_COLLECTION || "categories";
const PRODUCT_HISTORY_COLLECTION = "product_history";
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
      // Oddiy filter - userId bilan birga isHidden ni tekshirish
      const hiddenFilter = { $or: [{ isHidden: { $exists: false } }, { isHidden: false }] };
      
      if (filter.$or) {
        // Admin uchun - $and ishlatish
        filter = {
          $and: [
            { $or: filter.$or },
            hiddenFilter
          ]
        };
      } else if (Object.keys(filter).length > 0) {
        // Oddiy user uchun - userId + isHidden
        filter = {
          $and: [
            filter,
            hiddenFilter
          ]
        };
      } else {
        // Hech qanday filter yo'q - faqat isHidden
        filter = hiddenFilter;
      }
    }
    
    console.log("[products] Final filter:", JSON.stringify(filter));
    
    const products = await collection.find(filter).toArray();

    // Kategoriyalarni olish (categoryName yo'q bo'lgan mahsulotlar uchun)
    const categoryIds = [...new Set(products.map((p: any) => p.categoryId).filter(Boolean))];
    let categoriesMap: Record<string, string> = {};
    if (categoryIds.length > 0) {
      try {
        const categoryObjectIds = categoryIds.map(id => {
          try { return new ObjectId(id); } catch { return id; }
        });
        const categories = await db.collection(CATEGORIES_COLLECTION).find({
          $or: [
            { _id: { $in: categoryObjectIds } },
            { _id: { $in: categoryIds } }
          ]
        }).toArray();
        categories.forEach((cat: any) => {
          categoriesMap[cat._id.toString()] = cat.name || '';
        });
      } catch (catErr) {
        console.error('[api/products GET] Error fetching categories:', catErr);
      }
    }

    // Ensure variantSummaries have currency from product if not set
    // Marketplace field nomlarini standart nomlarga mapping qilish
    const productsWithCurrency = products.map((product: any) => {
      const productCurrency = product.currency || 'UZS';
      
      // MUHIM: Debug logging - initialStock qiymatini tekshirish
      if (product.sku === "1") {
        console.log('[API DEBUG] SKU "1" product from database:');
        console.log('Name:', product.name);
        console.log('Stock:', product.stock);
        console.log('InitialStock (raw):', product.initialStock);
        console.log('InitialStock type:', typeof product.initialStock);
        console.log('Has initialStock property:', product.hasOwnProperty('initialStock'));
        console.log('Object keys:', Object.keys(product));
      }
      
      // Marketplace field nomlarini standart nomlarga aylantirish
      const basePrice = product.basePrice ?? product.originalPrice ?? null;
      const priceMultiplier = product.priceMultiplier ?? product.markupPercent ?? null;
      // MUHIM: stock ni faqat serverdan olish - fallback ishlatmaslik
      const stock = product.stock ?? 0;
      // MUHIM: initialStock ni faqat serverdan olish, agar yo'q bo'lsa stock dan olish
      const initialStock = product.initialStock ?? stock; // Agar initialStock yo'q bo'lsa, stock dan olish
      
      // MUHIM: Debug logging - processed values
      if (product.sku === "1") {
        console.log('[API DEBUG] SKU "1" processed values:');
        console.log('Processed stock:', stock);
        console.log('Processed initialStock:', initialStock);
        console.log('Processed initialStock type:', typeof initialStock);
      }
      
      // variants yoki variantSummaries - qaysi biri bo'lsa shuni ishlatish
      let variantSummaries = product.variantSummaries ?? product.variants ?? [];
      if (Array.isArray(variantSummaries)) {
        variantSummaries = variantSummaries.map((v: any) => {
          // MUHIM: variant stock ni faqat serverdan olish - fallback ishlatmaslik
          const vStock = v.stock ?? 0;
          return {
            ...v,
            // Marketplace field nomlarini standart nomlarga aylantirish
            basePrice: v.basePrice ?? v.originalPrice ?? undefined,
            priceMultiplier: v.priceMultiplier ?? v.markupPercent ?? undefined,
            stock: vStock,
            // MUHIM: Xil uchun initialStock - faqat serverdan kelgan qiymat, agar yo'q bo'lsa stock dan olish
            initialStock: v.initialStock ?? v.stock ?? 0, // Agar initialStock yo'q bo'lsa, stock dan olish
            currency: v.currency || productCurrency,
          };
        });
      }
      
      // Kategoriya nomini olish (agar bazada yo'q bo'lsa, categoriesMap dan)
      const categoryName = product.categoryName || (product.categoryId ? categoriesMap[product.categoryId] : '') || '';
      
      const result = {
        ...product,
        basePrice,
        priceMultiplier,
        stock,
        initialStock,
        variantSummaries,
        categoryName,
      };
      
      // MUHIM: Debug logging - final result
      if (product.sku === "1") {
        console.log('[API DEBUG] SKU "1" final result:');
        console.log('Result stock:', result.stock);
        console.log('Result initialStock:', result.initialStock);
        console.log('Result initialStock type:', typeof result.initialStock);
        console.log('Result has initialStock property:', result.hasOwnProperty('initialStock'));
        console.log('Result keys:', Object.keys(result));
      }
      
      return result;
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
    
    // Marketplace field nomlarini standart nomlarga aylantirish
    const basePrice = product.basePrice ?? product.originalPrice ?? null;
    const priceMultiplier = product.priceMultiplier ?? product.markupPercent ?? null;
    // MUHIM: stock ni faqat serverdan olish - fallback ishlatmaslik
    const stock = product.stock ?? 0;
    // MUHIM: initialStock ni faqat serverdan olish - fallback ishlatmaslik
    const initialStock = product.initialStock; // Faqat serverdan kelgan qiymat
    
    // variants yoki variantSummaries - qaysi biri bo'lsa shuni ishlatish
    let variantSummaries = product.variantSummaries ?? product.variants ?? [];
    if (Array.isArray(variantSummaries)) {
      variantSummaries = variantSummaries.map((v: any) => {
        // MUHIM: variant stock ni faqat serverdan olish - fallback ishlatmaslik
        const vStock = v.stock ?? 0;
        return {
          ...v,
          // Marketplace field nomlarini standart nomlarga aylantirish
          basePrice: v.basePrice ?? v.originalPrice ?? undefined,
          priceMultiplier: v.priceMultiplier ?? v.markupPercent ?? undefined,
          stock: vStock,
          // MUHIM: Xil uchun initialStock - faqat serverdan kelgan qiymat
          initialStock: v.initialStock, // Fallback yo'q
          currency: v.currency || productCurrency,
        };
      });
    }

    // Return in expected format with success flag and product object
    return res.json({ 
      success: true, 
      product: {
        ...product,
        id: product._id.toString(),
        basePrice,
        priceMultiplier,
        stock,
        initialStock,
        variantSummaries,
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
      originalPrice, // Marketplace field nomi
      priceMultiplier,
      markupPercent, // Marketplace field nomi
      currency = "UZS",
      sku,
      categoryId,
      stock,
      stockCount, // Marketplace field nomi
      status,
      description,
      imageUrl,
      imagePaths,
      offlineId,
      userId,
      createdBy, // Marketplace field nomi
      userRole, // Foydalanuvchi roli (egasi, admin, xodim)
      sizes,
      variantSummaries,
      variants, // Marketplace field nomi
    } = req.body;
    
    // Marketplace createdBy ni userId sifatida ishlatish
    const finalUserId = userId || createdBy;
    
    console.log('[Products POST] userId/createdBy check:', { 
      userId, 
      createdBy, 
      finalUserId,
      hasUserId: !!userId,
      hasCreatedBy: !!createdBy,
      hasFinalUserId: !!finalUserId
    });
    
    // Marketplace field nomlarini standart nomlarga aylantirish
    const finalBasePrice = basePrice ?? originalPrice;
    const finalPriceMultiplier = priceMultiplier ?? markupPercent;
    const finalStock = stock ?? stockCount ?? 0;
    // variants yoki variantSummaries - qaysi biri bo'lsa shuni ishlatish
    const finalVariantSummaries = variantSummaries ?? variants ?? [];

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Product name is required" });
    }

    console.log('[Products POST] Received:', { 
      name, 
      sku, 
      stock: finalStock, 
      basePrice: finalBasePrice, 
      priceMultiplier: finalPriceMultiplier, 
      userId: finalUserId,
      variantSummariesCount: finalVariantSummaries?.length || 0,
      variantSummaries: finalVariantSummaries
    });

    const collection = db.collection(PRODUCTS_COLLECTION);

    // Bir xil SKU li mahsulot mavjudligini tekshirish
    // SKU ni string ga aylantirish (number bo'lishi mumkin)
    const skuStr = sku != null ? String(sku).trim() : '';
    console.log('[Products] SKU check starting:', { sku, skuStr, userId: finalUserId, skuType: typeof sku });
    
    if (skuStr) {
      // 1. Avval mahsulot SKU sini tekshirish
      const skuFilter: any = { 
        $or: [
          { sku: skuStr },
          { sku: Number(skuStr) }
        ]
      };
      if (finalUserId) {
        skuFilter.userId = finalUserId;
      }
      
      console.log('[Products] SKU filter:', JSON.stringify(skuFilter));
      let existingProduct = await collection.findOne(skuFilter);
      let matchedVariantIndex = -1; // Qaysi xil topilgani
      
      // 2. Agar mahsulot topilmasa, xillar ichidan qidirish
      if (!existingProduct) {
        console.log('[Products] Product not found by SKU, searching in variants...');
        const variantFilter: any = {
          $or: [
            { 'variantSummaries.sku': skuStr },
            { 'variantSummaries.sku': Number(skuStr) }
          ]
        };
        if (finalUserId) {
          variantFilter.userId = finalUserId;
        }
        
        existingProduct = await collection.findOne(variantFilter);
        
        if (existingProduct && existingProduct.variantSummaries) {
          // Qaysi xil topilganini aniqlash
          matchedVariantIndex = existingProduct.variantSummaries.findIndex((v: any) => {
            const vSkuStr = v.sku != null ? String(v.sku).trim() : '';
            return vSkuStr === skuStr || vSkuStr === String(Number(skuStr));
          });
          console.log('[Products] Found variant with SKU:', skuStr, 'at index:', matchedVariantIndex);
        }
      }
      
      console.log('[Products] SKU check result:', { 
        sku: skuStr, 
        userId: finalUserId, 
        found: !!existingProduct,
        existingProductId: existingProduct?._id?.toString(),
        existingProductSku: existingProduct?.sku,
        matchedVariantIndex
      });

      if (existingProduct) {
        const updateData: any = {
          updatedAt: new Date()
        };
        
        // Agar xil SKU si topilgan bo'lsa - faqat o'sha xilni yangilash
        if (matchedVariantIndex >= 0) {
          console.log('[Products] Updating variant at index:', matchedVariantIndex);
          const existingVariants = [...(existingProduct.variantSummaries || [])];
          const existingVariant = existingVariants[matchedVariantIndex];
          
          // Xilni yangilash
          const updatedVariantStock = (existingVariant.stock || 0) + (Number(finalStock) || 0);
          const updatedVariantBasePrice = finalBasePrice ?? existingVariant.basePrice;
          const updatedVariantPriceMultiplier = finalPriceMultiplier ?? existingVariant.priceMultiplier;
          
          existingVariants[matchedVariantIndex] = {
            ...existingVariant,
            name: name?.trim() || existingVariant.name,
            sku: skuStr,
            // Standart field nomlari
            basePrice: updatedVariantBasePrice,
            priceMultiplier: updatedVariantPriceMultiplier,
            // Marketplace uchun field nomlari
            originalPrice: updatedVariantBasePrice,
            markupPercent: updatedVariantPriceMultiplier,
            stockCount: updatedVariantStock,
            price: price ?? existingVariant.price,
            currency: currency || existingVariant.currency,
            categoryId: categoryId || existingVariant.categoryId,
            status: status ? normalizeProductStatus(status) : existingVariant.status,
            stock: updatedVariantStock,
            initialStock: existingVariant.initialStock, // MUHIM: Faqat mavjud qiymat, qo'shimcha qo'shmaslik
          };
          
          updateData.variantSummaries = existingVariants;
          console.log(`[Products] Updated variant: ${existingVariants[matchedVariantIndex].name}, new stock: ${existingVariants[matchedVariantIndex].stock}`);
        } else {
          // Mahsulot SKU si topilgan - mahsulotni yangilash
          const newStock = (existingProduct.stock || 0) + (Number(finalStock) || 0);
          const newInitialStock = (existingProduct.initialStock ?? 0) + (Number(finalStock) || 0);
          
          updateData.stock = newStock;
          updateData.initialStock = newInitialStock;
          
          // Yangi ma'lumotlarni qo'shish (agar berilgan bo'lsa)
          if (name && name.trim()) updateData.name = name.trim();
          if (price !== undefined) updateData.price = price;
          if (finalBasePrice !== undefined) {
            updateData.basePrice = finalBasePrice;
            updateData.originalPrice = finalBasePrice; // Marketplace uchun
          }
          if (finalPriceMultiplier !== undefined) {
            updateData.priceMultiplier = finalPriceMultiplier;
            updateData.markupPercent = finalPriceMultiplier; // Marketplace uchun
          }
          // Marketplace uchun stockCount
          updateData.stockCount = newStock;
          if (categoryId) updateData.categoryId = categoryId;
          if (currency) updateData.currency = currency;
          if (status) updateData.status = normalizeProductStatus(status);
          if (description !== undefined) updateData.description = description;
          
          // MUHIM: Yangi xillarni mavjud xillarga qo'shish/yangilash
          // Agar yangi xillar yuborilgan bo'lsa - ularni mavjud xillar bilan birlashtirish
          // Agar xil SKU yoki nomi mavjud bo'lsa - yangilash, aks holda qo'shish
          console.log('[Products] Checking variants to add/update:', {
            finalVariantSummariesLength: finalVariantSummaries?.length || 0,
            existingVariantsLength: existingProduct.variantSummaries?.length || 0
          });
          
          if (Array.isArray(finalVariantSummaries) && finalVariantSummaries.length > 0) {
            // Yangi xillarni formatlash
            const newVariants = finalVariantSummaries.map((v: any) => ({
              ...v,
              basePrice: v.basePrice ?? v.originalPrice ?? undefined,
              priceMultiplier: v.priceMultiplier ?? v.markupPercent ?? undefined,
              stock: v.stock ?? v.stockCount ?? 0,
              initialStock: v.initialStock // MUHIM: Faqat serverdan kelgan qiymat, fallback yo'q
            }));
            
            // YANGI LOGIKA: Xillarni to'liq almashtirish emas, faqat yangilarini qo'shish
            // Agar yangi xil SKU/nomi mavjud xilda bor bo'lsa - stock ni oshirish
            // Agar yo'q bo'lsa - yangi xil sifatida qo'shish
            // Eski xillar o'z joyida qoladi
            const existingVariants = existingProduct.variantSummaries || [];
            const mergedVariants = [...existingVariants];
            
            for (const newVariant of newVariants) {
              const newSkuStr = newVariant.sku != null ? String(newVariant.sku).trim() : '';
              let existingIndex = -1;
              
              // SKU bo'yicha qidirish
              if (newSkuStr) {
                existingIndex = mergedVariants.findIndex((ev: any) => {
                  const evSkuStr = ev.sku != null ? String(ev.sku).trim() : '';
                  return evSkuStr && (evSkuStr === newSkuStr || evSkuStr === String(Number(newSkuStr)));
                });
              }
              
              // Nom bo'yicha qidirish (faqat SKU topilmasa)
              if (existingIndex < 0 && newVariant.name) {
                existingIndex = mergedVariants.findIndex(
                  (ev: any) => ev.name?.toLowerCase() === newVariant.name?.toLowerCase()
                );
              }
              
              if (existingIndex >= 0) {
                // Mavjud xilni yangilash - stock ni oshirish
                const existingVariant = mergedVariants[existingIndex];
                mergedVariants[existingIndex] = {
                  ...existingVariant,
                  ...newVariant,
                  stock: (existingVariant.stock || 0) + (newVariant.stock || 0),
                  initialStock: existingVariant.initialStock // MUHIM: Faqat mavjud qiymat, qo'shimcha qo'shmaslik
                };
                console.log(`[Products] Updated existing variant: ${newVariant.name}, new stock: ${mergedVariants[existingIndex].stock}`);
              } else {
                // Yangi xilni qo'shish
                mergedVariants.push(newVariant);
                console.log(`[Products] Added new variant: ${newVariant.name}`);
              }
            }
            
            updateData.variantSummaries = mergedVariants;
            console.log(`[Products] Total variants after merge: ${mergedVariants.length}`);
          }
        }
        
        await collection.updateOne(
          { _id: existingProduct._id },
          { $set: updateData }
        );

        const updatedProduct = {
          ...existingProduct,
          ...updateData,
          id: existingProduct._id.toString(),
        };

        // WebSocket orqali xabar yuborish
        if (finalUserId) {
          wsManager.broadcastToUser(finalUserId, {
            type: 'product-stock-updated',
            productId: updatedProduct.id,
            product: updatedProduct,
          });
        }

        // Xabar matni - mahsulot va xillar yangilanganda
        const variantsUpdatedCount = updateData.variantSummaries 
          ? (existingProduct.variantSummaries?.length || 0) < updateData.variantSummaries.length 
            ? updateData.variantSummaries.length - (existingProduct.variantSummaries?.length || 0)
            : 0
          : 0;
        
        const messageText = matchedVariantIndex >= 0
          ? `Xil yangilandi.`
          : variantsUpdatedCount > 0
            ? `Mahsulot va ${variantsUpdatedCount} ta xil yangilandi.`
            : `Mahsulot yangilandi. Ombordagi soni ${existingProduct.stock || 0} dan ${updatedProduct.stock || 0} ga oshirildi.`;
        
        // Tarixga yozish (Marketplace dan ham ishlaydi)
        // finalUserId bo'lmasa ham tarixga yozish - mahsulotning userId sini ishlatish
        // Agar finalUserId yo'q bo'lsa ham, tarixga saqlaymiz (marketplace uchun)
        const updateHistoryUserId = finalUserId || existingProduct.userId || updatedProduct.userId || 'marketplace';
        try {
          const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);
          const displayName = matchedVariantIndex >= 0 
            ? (name || existingProduct.variantSummaries?.[matchedVariantIndex]?.name || sku)
            : (updatedProduct.name || name);
          
          // Xillarni tarix uchun formatlash
          const updateHistoryVariants = Array.isArray(updatedProduct.variantSummaries) 
            ? updatedProduct.variantSummaries.map((v: any) => ({
                name: v.name,
                sku: v.sku,
                stock: v.stock ?? 0,
                price: v.price ?? 0,
                currency: v.currency || currency || updatedProduct.currency || 'UZS',
              }))
            : [];
          
          await historyCollection.insertOne({
            userId: updateHistoryUserId,
            type: matchedVariantIndex >= 0 ? 'variant_update' : 'update',
            productId: updatedProduct.id,
            productName: displayName,
            sku: sku || updatedProduct.sku,
            stock: updatedProduct.stock || 0,
            addedStock: Number(finalStock) || 0,
            price: updatedProduct.price || 0,
            currency: currency || updatedProduct.currency || 'UZS',
            message: matchedVariantIndex >= 0 
              ? `Xil yangilandi: ${displayName}`
              : `Mahsulot yangilandi: +${Number(finalStock) || 0} ta qo'shildi`,
            variants: updateHistoryVariants.length > 0 ? updateHistoryVariants : undefined, // Xillarni ham saqlash
            timestamp: new Date(),
            createdAt: new Date(),
            source: finalUserId ? 'app' : 'marketplace',
          });
          console.log('[Products POST update] History saved for user:', updateHistoryUserId, 'with variants:', updateHistoryVariants.length);
        } catch (histErr) {
          console.error('[Products POST] Failed to save history:', histErr);
        }
        
        return res.status(200).json({ 
          success: true, 
          product: updatedProduct,
          stockUpdated: true,
          variantUpdated: matchedVariantIndex >= 0,
          addedStock: Number(stock) || 0,
          message: messageText
        });
      }
    }

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

    // Kategoriya nomini olish (Marketplace uchun)
    let categoryName = '';
    if (categoryId) {
      try {
        let catObjectId;
        try {
          catObjectId = new ObjectId(categoryId);
        } catch {
          catObjectId = categoryId;
        }
        const category = await db.collection(CATEGORIES_COLLECTION).findOne({
          $or: [
            { _id: catObjectId },
            { _id: categoryId }
          ]
        });
        if (category) {
          categoryName = category.name || '';
          console.log(`[api/products POST] Found category: ${categoryName} for categoryId: ${categoryId}`);
        }
      } catch (catErr) {
        console.error('[api/products POST] Error finding category:', catErr);
      }
    }

    const newProduct: any = {
      name: name.trim(),
      sizes: parsedSizes,
      images: [],
      price: price || 0,
      // Standart field nomlari
      basePrice: finalBasePrice || undefined,
      priceMultiplier: finalPriceMultiplier || undefined,
      // Marketplace uchun field nomlari (eski nomlar bilan ham saqlash)
      originalPrice: finalBasePrice || undefined,
      markupPercent: finalPriceMultiplier || undefined,
      stockCount: finalStock || 0,
      currency,
      sku: sku || undefined,
      categoryId: categoryId || undefined,
      categoryName: categoryName || undefined, // Marketplace uchun kategoriya nomi
      stock: finalStock || 0,
      // Barcha foydalanuvchilar uchun: boshlang'ich stock (qaytarish cheklovi uchun)
      initialStock: finalStock || 0, // MUHIM: Yangi mahsulot uchun - stock bilan bir xil
      createdByRole: userRole || undefined,
      status: normalizeProductStatus(status),
      description: description || "",
      imageUrl: imageUrl || "",
      imagePaths: Array.isArray(imagePaths) ? imagePaths : [],
      // Xillar uchun initialStock qo'shish (variants yoki variantSummaries)
      variantSummaries: Array.isArray(finalVariantSummaries) ? finalVariantSummaries.map((v: any) => ({
        ...v,
        // Standart field nomlari
        basePrice: v.basePrice ?? v.originalPrice ?? undefined,
        priceMultiplier: v.priceMultiplier ?? v.markupPercent ?? undefined,
        stock: v.stock ?? v.stockCount ?? 0,
        initialStock: v.initialStock, // MUHIM: Faqat serverdan kelgan qiymat, fallback yo'q
        // Marketplace uchun field nomlari
        originalPrice: v.basePrice ?? v.originalPrice ?? undefined,
        markupPercent: v.priceMultiplier ?? v.markupPercent ?? undefined,
        stockCount: v.stock ?? v.stockCount ?? 0,
      })) : [],
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
    
    // Привязка к пользователю (finalUserId = userId || createdBy)
    if (finalUserId) {
      newProduct.userId = finalUserId;
      
      // Автоматически найти магазин пользователя и привязать товар
      try {
        let userObjectId;
        try {
          userObjectId = new ObjectId(finalUserId);
        } catch {
          userObjectId = finalUserId;
        }
        
        // Ищем магазин где пользователь - создатель или менеджер
        const store = await db.collection("stores").findOne({
          $or: [
            { createdBy: userObjectId },
            { createdBy: finalUserId },
            { manager: userObjectId },
            { manager: finalUserId }
          ]
        });
        
        if (store) {
          newProduct.store = store._id; // ObjectId магазина
          console.log(`[api/products POST] Auto-assigned store ${store._id} (${store.name}) to product`);
        }
      } catch (storeErr) {
        console.error("[api/products POST] Error finding store:", storeErr);
      }
    }
    
    // Если storeId передан явно с клиента - использовать его
    const { storeId } = req.body;
    if (storeId) {
      try {
        newProduct.store = new ObjectId(storeId);
      } catch {
        newProduct.store = storeId;
      }
    }

    console.log("[api/products POST] Creating product with variantSummaries:", newProduct.variantSummaries?.length || 0);

    const result = await collection.insertOne(newProduct);

    const createdProduct = {
      ...newProduct,
      _id: result.insertedId,
      id: result.insertedId.toString(),
    };

    // Broadcast product creation via WebSocket
    if (finalUserId) {
      wsManager.broadcastToUser(finalUserId, {
        type: 'product-created',
        productId: createdProduct.id,
        productName: createdProduct.name,
        userId: finalUserId,
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

    // Tarixga yozish - yangi mahsulot yaratildi (Marketplace dan ham ishlaydi)
    // finalUserId bo'lmasa ham tarixga yozish - mahsulotning userId sini ishlatish
    // Agar finalUserId yo'q bo'lsa ham, tarixga saqlaymiz (marketplace uchun)
    const historyUserId = finalUserId || createdProduct.userId || 'marketplace';
    try {
      const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);
      
      // Xillarni tarix uchun formatlash
      const historyVariants = Array.isArray(createdProduct.variantSummaries) 
        ? createdProduct.variantSummaries.map((v: any) => ({
            name: v.name,
            sku: v.sku,
            stock: v.stock ?? 0,
            price: v.price ?? 0,
            currency: v.currency || createdProduct.currency || 'UZS',
          }))
        : [];
      
      await historyCollection.insertOne({
        userId: historyUserId,
        type: 'create',
        productId: createdProduct.id,
        productName: createdProduct.name,
        sku: createdProduct.sku || '',
        stock: createdProduct.stock || 0,
        addedStock: createdProduct.stock || 0,
        price: createdProduct.price || 0,
        currency: createdProduct.currency || 'UZS',
        message: `Yangi mahsulot qo'shildi: ${createdProduct.name} (${createdProduct.stock || 0} ta)`,
        variants: historyVariants.length > 0 ? historyVariants : undefined, // Xillarni ham saqlash
        timestamp: new Date(),
        createdAt: new Date(),
        source: finalUserId ? 'app' : 'marketplace', // Qayerdan qo'shilganini belgilash
      });
      console.log('[Products POST] History saved for user:', historyUserId, 'with variants:', historyVariants.length);
    } catch (histErr) {
      console.error('[Products POST] Failed to save history:', histErr);
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

    // MUHIM: Xodimlar uchun permission tekshirish
    const { userRole, canEditProducts } = req.body;
    if (userRole === 'xodim' && !canEditProducts) {
      return res.status(403).json({ success: false, error: "Xodim mahsulotlarni tahrirlash huquqiga ega emas" });
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
      initialStock,
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
      // Xil qo'shish rejimi
      addVariantMode,
    } = req.body;

    const collection = db.collection(PRODUCTS_COLLECTION);
    
    // Mavjud mahsulotni olish (xil qo'shish rejimi uchun kerak)
    const existingProduct = await collection.findOne({ _id: new ObjectId(id) });
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
    if (stock !== undefined && !addVariantMode) {
      // addVariantMode da stock yuqorida yangilanadi
      updateData.stock = stock;
      // MUHIM: Stock oshirilganda initialStock ham yangilanadi
      // Bu qaytarish cheklovi uchun kerak - sotilgan miqdordan ortiq qaytarib bo'lmaydi
      const oldStock = existingProduct.stock || 0;
      const oldInitialStock = existingProduct.initialStock; // MUHIM: Faqat mavjud qiymat, fallback yo'q
      // Agar yangi stock eski stock dan katta bo'lsa, farqni initialStock ga qo'shish
      if (stock > oldStock && oldInitialStock !== undefined && oldInitialStock !== null) {
        const stockIncrease = stock - oldStock;
        updateData.initialStock = oldInitialStock + stockIncrease;
        console.log(`[api/products PUT] Stock increased: ${oldStock} -> ${stock}, initialStock: ${oldInitialStock} -> ${updateData.initialStock}`);
      }
      // Agar stock kamaytirilsa, initialStock o'zgarmaydi (sotilgan deb hisoblanadi)
    }
    // MUHIM: initialStock ni to'g'ridan-to'g'ri o'rnatish (qaytarish cheklovi uchun)
    if (initialStock !== undefined) {
      updateData.initialStock = initialStock;
      console.log(`[api/products PUT] InitialStock set directly: ${initialStock}`);
    }
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
      // Xillar uchun initialStock yangilash
      const oldVariants = existingProduct?.variantSummaries || [];
      
      console.log('[api/products PUT] variantSummaries received:', {
        count: variantSummaries?.length || 0,
        addVariantMode,
        oldVariantsCount: oldVariants.length
      });
      
      // MUHIM: addVariantMode bo'lsa - yangi xillarni mavjud xillarga qo'shish
      if (addVariantMode && Array.isArray(variantSummaries) && variantSummaries.length > 0) {
        console.log('[api/products PUT] addVariantMode: merging variants');
        
        // Yangi xillarni formatlash
        const newVariants = variantSummaries.map((v: any) => ({
          ...v,
          basePrice: v.basePrice ?? v.originalPrice ?? undefined,
          priceMultiplier: v.priceMultiplier ?? v.markupPercent ?? undefined,
          stock: v.stock ?? v.stockCount ?? 0,
          initialStock: v.initialStock // MUHIM: Faqat serverdan kelgan qiymat, fallback yo'q
        }));
        
        // Mavjud xillar bilan birlashtirish (SKU yoki nom bo'yicha tekshirish)
        const mergedVariants = [...oldVariants];
        for (const newVariant of newVariants) {
          // Avval SKU bo'yicha qidirish, keyin nom bo'yicha
          const newSkuStr = newVariant.sku != null ? String(newVariant.sku).trim() : '';
          let existingIndex = -1;
          
          // 1. SKU bo'yicha qidirish (agar SKU berilgan bo'lsa)
          if (newSkuStr) {
            existingIndex = mergedVariants.findIndex((ev: any) => {
              const evSkuStr = ev.sku != null ? String(ev.sku).trim() : '';
              return evSkuStr && (evSkuStr === newSkuStr || evSkuStr === String(Number(newSkuStr)));
            });
          }
          
          // 2. Agar SKU bo'yicha topilmasa, nom bo'yicha qidirish
          if (existingIndex < 0 && newVariant.name) {
            existingIndex = mergedVariants.findIndex(
              (ev: any) => ev.name?.toLowerCase() === newVariant.name?.toLowerCase()
            );
          }
          
          if (existingIndex >= 0) {
            // Mavjud xilni yangilash - ma'lumotlarni yangilash va stock ni oshirish
            const existingVariant = mergedVariants[existingIndex];
            mergedVariants[existingIndex] = {
              ...existingVariant,
              ...newVariant,
              // SKU ni saqlab qolish (agar yangi variant da bo'lmasa)
              sku: newVariant.sku ?? existingVariant.sku,
              stock: (existingVariant.stock || 0) + (newVariant.stock || 0),
              initialStock: existingVariant.initialStock // MUHIM: Faqat mavjud qiymat, qo'shimcha qo'shmaslik
            };
            console.log(`[api/products PUT] Updated existing variant by SKU/name: ${newVariant.sku || newVariant.name}, new stock: ${mergedVariants[existingIndex].stock}`);
          } else {
            // Yangi xilni qo'shish
            mergedVariants.push(newVariant);
            console.log(`[api/products PUT] Added new variant: ${newVariant.name} (SKU: ${newVariant.sku})`);
          }
        }
        
        updateData.variantSummaries = mergedVariants;
        console.log(`[api/products PUT] Total variants after merge: ${mergedVariants.length}`);
        
        // Stock ni ham yangilash (agar berilgan bo'lsa)
        if (stock !== undefined) {
          const oldStock = existingProduct.stock || 0;
          const oldInitialStock = existingProduct.initialStock; // MUHIM: Faqat mavjud qiymat, fallback yo'q
          updateData.stock = oldStock + (Number(stock) || 0);
          // InitialStock ni faqat mavjud bo'lsa yangilash
          if (oldInitialStock !== undefined && oldInitialStock !== null) {
            updateData.initialStock = (oldInitialStock ?? 0) + (Number(stock) || 0);
          }
          console.log(`[api/products PUT] addVariantMode: stock ${oldStock} -> ${updateData.stock}`);
        }
      } else {
        // Oddiy yangilash (addVariantMode emas)
        updateData.variantSummaries = Array.isArray(variantSummaries) ? variantSummaries.map((v: any, index: number) => {
          const oldVariant = oldVariants[index];
          const oldStock = oldVariant?.stock || 0;
          const oldInitialStock = oldVariant?.initialStock; // MUHIM: Faqat mavjud qiymat, fallback yo'q
          const newStock = v.stock ?? 0;
          
          // Agar yangi stock eski stock dan katta bo'lsa, farqni initialStock ga qo'shish
          let newInitialStock = v.initialStock; // MUHIM: Faqat serverdan kelgan qiymat
          if (oldVariant && newStock > oldStock) {
            const stockIncrease = newStock - oldStock;
            newInitialStock = oldInitialStock + stockIncrease;
            console.log(`[api/products PUT] Variant ${v.name} stock increased: ${oldStock} -> ${newStock}, initialStock: ${oldInitialStock} -> ${newInitialStock}`);
          } else if (!oldVariant) {
            // Yangi xil - initialStock = stock
            newInitialStock = newStock;
          }
          
          return {
            ...v,
            initialStock: newInitialStock
          };
        }) : [];
        console.log("[api/products PUT] Updating variantSummaries:", updateData.variantSummaries.length);
      }
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

    // Tarixga yozish - mahsulot tahrirlandi (Marketplace dan ham ishlaydi)
    if (productUserId) {
      try {
        const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);
        await historyCollection.insertOne({
          userId: productUserId,
          type: 'update',
          productId: updatedProduct.id,
          productName: productName,
          sku: (result as any).sku || '',
          stock: (result as any).stock || 0,
          price: (result as any).price || 0,
          currency: (result as any).currency || 'UZS',
          message: `Mahsulot tahrirlandi: ${productName}`,
          timestamp: new Date(),
          createdAt: new Date(),
          source: 'app',
        });
        console.log('[Products PUT] History saved for user:', productUserId);
      } catch (histErr) {
        console.error('[Products PUT] Failed to save history:', histErr);
      }
    } else {
      console.log('[Products PUT] No userId for history, skipping');
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
 * DELETE /api/products/clear-all
 * Foydalanuvchining barcha mahsulotlarini o'chirish (faqat ega uchun)
 */
export const handleProductsClearAll: RequestHandler = async (req, res) => {
  console.log(`[api/products/clear-all] ========== CLEAR ALL REQUEST ==========`);
  console.log(`[api/products/clear-all] Method: ${req.method}`);
  console.log(`[api/products/clear-all] Headers:`, req.headers);
  console.log(`[api/products/clear-all] Body:`, req.body);
  
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      console.log(`[api/products/clear-all] ❌ Database not available`);
      return res.status(500).json({ error: "Database not available" });
    }
    const db = conn.db;

    const { userId } = req.body;
    
    if (!userId) {
      console.log(`[api/products/clear-all] ❌ userId is missing from request body`);
      return res.status(400).json({ error: "userId is required" });
    }
    
    console.log(`[api/products/clear-all] Clearing products for userId: ${userId}`);

    const collection = db.collection(PRODUCTS_COLLECTION);
    
    // Faqat o'z mahsulotlarini o'chirish
    const result = await collection.deleteMany({ userId: userId });

    console.log(`[api/products/clear-all] ✅ Deleted ${result.deletedCount} products for user ${userId}`);

    // WebSocket orqali xabar yuborish
    wsManager.broadcastToUser(userId, {
      type: 'products-cleared',
      deletedCount: result.deletedCount,
      userId: userId,
      timestamp: Date.now(),
    });

    return res.json({ 
      success: true, 
      message: `${result.deletedCount} ta mahsulot o'chirildi`,
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error("[api/products/clear-all DELETE] Error:", error);
    return res.status(500).json({ error: "Failed to clear products" });
  }
};

/**
 * PATCH /api/products/:id/stock
 * Stock yangilash - SODDA VA ISHONCHLI
 */
export const handleProductStockUpdate: RequestHandler = async (req, res) => {
  try {
    console.log(`[STOCK UPDATE] ========== NEW REQUEST ==========`);
    console.log(`[STOCK UPDATE] Product ID: ${req.params.id}`);
    console.log(`[STOCK UPDATE] Body:`, req.body);
    
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ error: "Database not available" });
    }
    
    const { id } = req.params;
    const { change, variantIndex } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }
    
    if (typeof change !== "number") {
      return res.status(400).json({ error: "Change must be a number" });
    }
    
    const collection = conn.db.collection(PRODUCTS_COLLECTION);
    const product = await collection.findOne({ _id: new ObjectId(id) });
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    console.log(`[STOCK UPDATE] Found: ${product.name}`);
    
    let updateQuery: any;
    let newStock: number;
    
    if (variantIndex !== undefined && product.variantSummaries?.[variantIndex]) {
      // VARIANT STOCK YANGILASH
      const variant = product.variantSummaries[variantIndex];
      const currentStock = variant.stock ?? 0; // Use ?? for null/undefined check only
      newStock = Math.max(0, currentStock + change);
      
      console.log(`[STOCK UPDATE] Variant[${variantIndex}]: ${currentStock} -> ${newStock}`);
      
      // MUHIM: InitialStock ni o'rnatish (agar yo'q bo'lsa)
      let variantInitialStock = variant.initialStock;
      if (variantInitialStock === undefined || variantInitialStock === null) {
        // Agar initialStock yo'q bo'lsa, hozirgi stock ni initialStock sifatida o'rnatish
        variantInitialStock = currentStock;
        console.log(`[STOCK UPDATE] Variant[${variantIndex}] initialStock set to: ${variantInitialStock}`);
      }
      
      // Variantni yangilash
      const updatedVariants = [...product.variantSummaries];
      updatedVariants[variantIndex] = {
        ...variant,
        stock: newStock,
        initialStock: variantInitialStock // MUHIM: initialStock ni saqlash
      };
      
      // MUHIM: Variant stockini va initialStock ni yangilash
      updateQuery = {
        $set: {
          variantSummaries: updatedVariants,
          updatedAt: new Date()
        }
      };
      
    } else {
      // ASOSIY MAHSULOT STOCK YANGILASH
      const currentStock = product.stock ?? 0; // Use ?? for null/undefined check only
      newStock = Math.max(0, currentStock + change);
      
      console.log(`[STOCK UPDATE] Main product: ${currentStock} -> ${newStock}`);
      
      // MUHIM: InitialStock ni o'rnatish (agar yo'q bo'lsa)
      let productInitialStock = product.initialStock;
      if (productInitialStock === undefined || productInitialStock === null) {
        // Agar initialStock yo'q bo'lsa, hozirgi stock ni initialStock sifatida o'rnatish
        productInitialStock = currentStock;
        console.log(`[STOCK UPDATE] Main product initialStock set to: ${productInitialStock}`);
      }
      
      updateQuery = {
        $set: {
          stock: newStock,
          initialStock: productInitialStock, // MUHIM: initialStock ni saqlash
          updatedAt: new Date()
        }
      };
    }
    
    // Bazani yangilash
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      updateQuery,
      { returnDocument: "after" }
    );
    
    console.log(`[STOCK UPDATE] ✅ Updated successfully`);
    
    // WebSocket xabari
    if (product.userId) {
      wsManager.broadcastToUser(product.userId, {
        type: 'product-updated',
        productId: id,
        productName: product.name,
        stock: newStock,
        variantIndex: variantIndex,
        timestamp: Date.now(),
      });
    }
    
    return res.json({ 
      success: true, 
      stock: newStock,
      product: result,
      variantIndex: variantIndex
    });
    
  } catch (error) {
    console.error("[STOCK UPDATE] Error:", error);
    return res.status(500).json({ error: "Failed to update stock" });
  }
};


/**
 * GET /api/product-history
 * Mahsulot qo'shish/tahrirlash tarixini olish
 */
export const handleProductHistoryGet: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const db = conn.db;
    const userId = req.query.userId as string | undefined;
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const collection = db.collection(PRODUCT_HISTORY_COLLECTION);
    
    // Foydalanuvchining mahsulotlarini olish (userId bo'yicha)
    const productsCollection = db.collection(PRODUCTS_COLLECTION);
    const userProducts = await productsCollection.find({ userId }).project({ _id: 1 }).toArray();
    const userProductIds = userProducts.map(p => p._id.toString());
    
    console.log('[Product History GET] userId:', userId, 'userProductIds count:', userProductIds.length);
    
    // Barcha tarix yozuvlarini olish (limitsiz)
    // Foydalanuvchining tarixini, marketplace tarixini, va foydalanuvchining mahsulotlari uchun tarixni ham ko'rsatish
    const history = await collection
      .find({ 
        $or: [
          { userId }, 
          { userId: 'marketplace' },
          { productId: { $in: userProductIds } }
        ] 
      })
      .sort({ timestamp: -1 })
      .toArray();
    
    console.log('[Product History GET] Found history count:', history.length);

    const mappedHistory = history.map((h: any) => ({
      id: h._id.toString(),
      type: h.type,
      productId: h.productId,
      productName: h.productName,
      sku: h.sku,
      stock: h.stock,
      addedStock: h.addedStock,
      price: h.price,
      currency: h.currency,
      timestamp: h.timestamp,
      message: h.message,
      variants: h.variants || [], // Xillarni ham qaytarish
    }));

    return res.json({ success: true, history: mappedHistory });
  } catch (error) {
    console.error("[api/product-history GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch product history" });
  }
};

/**
 * POST /api/product-history
 * Tarixga yangi yozuv qo'shish
 */
export const handleProductHistoryCreate: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const db = conn.db;
    const { userId, type, productId, productName, sku, stock, addedStock, price, currency, message, variants } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const collection = db.collection(PRODUCT_HISTORY_COLLECTION);
    
    // Duplikat tekshiruvi - oxirgi 5 daqiqa ichida bir xil productId, type va productName bo'lsa qo'shmaslik
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingItem = await collection.findOne({
      userId,
      productId,
      type,
      productName,
      timestamp: { $gte: fiveMinutesAgo }
    });
    
    if (existingItem) {
      console.log('[api/product-history POST] Duplicate item, skipping:', productName);
      return res.status(200).json({ 
        success: true, 
        duplicate: true,
        historyItem: {
          ...existingItem,
          id: existingItem._id.toString(),
        }
      });
    }
    
    const historyItem: any = {
      userId,
      type,
      productId,
      productName,
      sku,
      stock,
      addedStock,
      price,
      currency,
      message,
      timestamp: new Date(),
      createdAt: new Date(),
    };
    
    // Xillarni ham saqlash (agar mavjud bo'lsa)
    if (variants && Array.isArray(variants) && variants.length > 0) {
      historyItem.variants = variants;
      console.log('[api/product-history POST] Saving with variants:', variants.length);
    } else {
      console.log('[api/product-history POST] No variants to save');
    }

    const result = await collection.insertOne(historyItem);

    return res.status(201).json({ 
      success: true, 
      historyItem: {
        ...historyItem,
        id: result.insertedId.toString(),
      }
    });
  } catch (error) {
    console.error("[api/product-history POST] Error:", error);
    return res.status(500).json({ error: "Failed to create product history" });
  }
};

/**
 * DELETE /api/product-history/:id
 * Tarixdan yozuvni o'chirish (faqat ega uchun)
 */
export const handleProductHistoryDelete: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const db = conn.db;
    const { id } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid history ID" });
    }

    const collection = db.collection(PRODUCT_HISTORY_COLLECTION);
    
    // Faqat o'z tarixini o'chirish mumkin
    const result = await collection.deleteOne({
      _id: new ObjectId(id),
      userId: userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "History item not found or not authorized" });
    }

    return res.json({ success: true, message: "History item deleted" });
  } catch (error) {
    console.error("[api/product-history DELETE] Error:", error);
    return res.status(500).json({ error: "Failed to delete product history" });
  }
};

/**
 * DELETE /api/product-history/clear
 * Barcha tarixni tozalash (faqat ega uchun)
 */
export const handleProductHistoryClear: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const db = conn.db;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const collection = db.collection(PRODUCT_HISTORY_COLLECTION);
    
    // Faqat o'z tarixini tozalash mumkin
    const result = await collection.deleteMany({ userId: userId });

    console.log(`[api/product-history/clear] Deleted ${result.deletedCount} history items for user ${userId}`);

    return res.json({ 
      success: true, 
      message: `${result.deletedCount} ta tarix yozuvi o'chirildi`,
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error("[api/product-history/clear DELETE] Error:", error);
    return res.status(500).json({ error: "Failed to clear product history" });
  }
};
