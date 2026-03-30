import { RequestHandler } from "express";
import mongoose from "mongoose";
import { connectMongo } from "../mongo";
import { wsManager } from "../websocket";
import { validateProductSkus, validateSkuUniqueness } from "../utils/sku-validator";

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
    const categoryId = req.query.categoryId as string | undefined; // ✅ YANGI: Kategoriya filtri
    // includeHidden=true bo'lsa, yashirin mahsulotlarni ham ko'rsatish (admin panel uchun)
    const includeHidden = req.query.includeHidden === 'true';
    
    // Если это админ с особым номером - показываем все товары
    const normalizedUserPhone = userPhone ? normalizePhone(userPhone) : "";
    const isAdminPhone = normalizedUserPhone === ADMIN_PHONE || normalizedUserPhone.endsWith(ADMIN_PHONE);
    
    console.log("[products] userId:", userId);
    console.log("[products] userPhone:", userPhone);
    console.log("[products] categoryId:", categoryId); // ✅ YANGI
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
    
    // ✅ YANGI: Kategoriya bo'yicha filtrlash
    if (categoryId) {
      console.log("[products] Filtering by categoryId:", categoryId);
      if (filter.$and) {
        filter.$and.push({ categoryId: categoryId });
      } else if (filter.$or) {
        filter = {
          $and: [
            { $or: filter.$or },
            { categoryId: categoryId }
          ]
        };
      } else {
        filter.categoryId = categoryId;
      }
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
    
    // MUHIM: Avval jami mahsulotlar sonini tekshirish
    const totalCount = await collection.countDocuments(filter);
    console.log(`[products] Total products matching filter: ${totalCount}`);
    
    // DIQQAT: Agar juda kam mahsulot topilsa, userId muammosini tekshirish
    if (totalCount < 500 && userId) {
      console.log(`⚠️ [products] DIQQAT: Faqat ${totalCount}ta mahsulot topildi userId ${userId} uchun`);
      
      // Jami mahsulotlar sonini tekshirish (userId filtrisiz)
      const allProductsCount = await collection.countDocuments({});
      console.log(`[products] Jami bazadagi mahsulotlar: ${allProductsCount}`);
      
      // Sizning importSource bilan nechta mahsulot bor?
      const importSourceCount = await collection.countDocuments({
        importSource: "mahsulotlar_A6_A7_T7_SHAANXI_FOTON_CHAKMAN_FAW_HOWO_XCMG_2026_02.xlsx"
      });
      console.log(`[products] Excel fayl bilan import qilingan: ${importSourceCount}`);
      
      // userId yo'q mahsulotlar
      const noUserIdCount = await collection.countDocuments({
        $or: [
          { userId: { $exists: false } },
          { userId: null },
          { userId: "" }
        ]
      });
      console.log(`[products] userId yo'q mahsulotlar: ${noUserIdCount}`);
    }
    
    // Mahsulotlarni olish - MongoDB'ga qo'shilgan tartibda (_id bo'yicha)
    // Agar importOrder bo'lsa, u bo'yicha tartiblash
    const products = await collection.find(filter).toArray();
    
    console.log(`[products] Actually fetched: ${products.length} products`);
    
    // Import order bo'yicha tartiblash (agar mavjud bo'lsa)
    products.sort((a: any, b: any) => {
      // Agar ikkala mahsulotda ham importOrder bo'lsa
      if (a.importOrder !== undefined && b.importOrder !== undefined) {
        return a.importOrder - b.importOrder;
      }
      // Agar faqat bitta mahsulotda importOrder bo'lsa
      if (a.importOrder !== undefined) return -1;
      if (b.importOrder !== undefined) return 1;
      // Agar ikkalasida ham yo'q bo'lsa - _id bo'yicha
      return 0;
    });
    
    console.log("[products] Products fetched and sorted by importOrder");

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

    // DEBUG: Log first product to check importSource
    if (products.length > 0) {
      console.log('[api/products GET] First product importSource:', products[0].importSource, 'importOrder:', products[0].importOrder);
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
      // MUHIM: markupPercentage va priceMultiplier bir xil narsa
      // Avval markupPercentage ni tekshiramiz (kategoriya yangilanganida bu o'rnatiladi)
      const priceMultiplier = product.markupPercentage ?? product.priceMultiplier ?? product.markupPercent ?? null;
      // MUHIM: stock ni faqat serverdan olish - fallback ishlatmaslik
      const stock = product.stock ?? 0;
      // MUHIM: initialStock ni faqat serverdan olish - fallback ishlatmaslik
      const initialStock = product.initialStock; // Faqat serverdan kelgan qiymat
      
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
          // MUHIM: variant markupPercentage va priceMultiplier bir xil narsa
          const vPriceMultiplier = v.markupPercentage ?? v.priceMultiplier ?? v.markupPercent ?? undefined;
          return {
            ...v,
            // Marketplace field nomlarini standart nomlarga aylantirish
            basePrice: v.basePrice ?? v.originalPrice ?? undefined,
            priceMultiplier: vPriceMultiplier,
            stock: vStock,
            // MUHIM: Xil uchun initialStock - faqat serverdan kelgan qiymat
            initialStock: v.initialStock, // Fallback yo'q
            currency: v.currency || productCurrency,
            // ✅ CRITICAL: Explicitly include customId and barcodeId
            customId: v.customId,
            barcodeId: v.barcodeId,
            // ✅ CRITICAL: Explicitly include importSource and importOrder
            importSource: v.importSource,
            importOrder: v.importOrder,
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
        // ✅ CRITICAL: Explicitly include barcodeId for main product
        barcodeId: product.barcodeId,
        // ✅ CRITICAL: Explicitly include importSource and importOrder
        importSource: product.importSource,
        importOrder: product.importOrder,
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
    // MUHIM: markupPercentage va priceMultiplier bir xil narsa
    // Avval markupPercentage ni tekshiramiz (kategoriya yangilanganida bu o'rnatiladi)
    const priceMultiplier = product.markupPercentage ?? product.priceMultiplier ?? product.markupPercent ?? null;
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
        // MUHIM: variant markupPercentage va priceMultiplier bir xil narsa
        const vPriceMultiplier = v.markupPercentage ?? v.priceMultiplier ?? v.markupPercent ?? undefined;
        return {
          ...v,
          // Marketplace field nomlarini standart nomlarga aylantirish
          basePrice: v.basePrice ?? v.originalPrice ?? undefined,
          priceMultiplier: vPriceMultiplier,
          stock: vStock,
          // MUHIM: Xil uchun initialStock - faqat serverdan kelgan qiymat
          initialStock: v.initialStock, // Fallback yo'q
          currency: v.currency || productCurrency,
          // ✅ CRITICAL: Explicitly include customId and barcodeId
          customId: v.customId,
          barcodeId: v.barcodeId,
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
      customId, // ✅ YANGI: Qo'lda kiritilgan ID
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
      addAsVariantTo, // ✨ YANGI: Mavjud mahsulotga xil sifatida qo'shish
    } = req.body;
    
    // Marketplace createdBy ni userId sifatida ishlatish
    const finalUserId = userId || createdBy;
    
    console.log('[Products POST] userId/createdBy check:', { 
      userId, 
      createdBy, 
      finalUserId,
      hasUserId: !!userId,
      hasCreatedBy: !!createdBy,
      hasFinalUserId: !!finalUserId,
      addAsVariantTo, // ✨ YANGI
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
      customId, // ✅ DEBUG: CustomId ni log qilish
      stock: finalStock, 
      basePrice: finalBasePrice, 
      priceMultiplier: finalPriceMultiplier, 
      userId: finalUserId,
      variantSummariesCount: finalVariantSummaries?.length || 0,
      variantSummaries: finalVariantSummaries,
      addAsVariantTo, // ✨ YANGI
    });

    const collection = db.collection(PRODUCTS_COLLECTION);

    // ✨ YANGI: Agar addAsVariantTo berilgan bo'lsa, mavjud mahsulotga xil sifatida qo'shish
    if (addAsVariantTo) {
      console.log('[Products POST] Adding as variant to existing product:', addAsVariantTo);
      
      try {
        let existingProductId;
        try {
          existingProductId = new ObjectId(addAsVariantTo);
        } catch {
          existingProductId = addAsVariantTo;
        }
        
        const existingProduct = await collection.findOne({
          $or: [
            { _id: existingProductId },
            { _id: addAsVariantTo }
          ],
          userId: finalUserId
        });
        
        if (!existingProduct) {
          console.log('[Products POST] Existing product not found:', addAsVariantTo);
          return res.status(404).json({ 
            success: false, 
            error: 'Mavjud mahsulot topilmadi' 
          });
        }
        
        console.log('[Products POST] Found existing product:', existingProduct.name);
        
        // ✨ YANGI: Yangi mahsulotni xil sifatida yaratish
        const newVariant = {
          name: name.trim(),
          sku: sku || undefined,
          customId: customId ? customId.trim().toUpperCase() : undefined,
          basePrice: finalBasePrice || undefined,
          originalPrice: finalBasePrice || undefined,
          priceMultiplier: finalPriceMultiplier || undefined,
          markupPercent: finalPriceMultiplier || undefined,
          price: price || 0,
          currency,
          stock: finalStock || 0,
          stockCount: finalStock || 0,
          initialStock: finalStock || 0,
          status: normalizeProductStatus(status),
          categoryId: categoryId || undefined,
          imagePaths: Array.isArray(imagePaths) ? imagePaths : [],
        };
        
        console.log('[Products POST] New variant:', newVariant);
        
        // ✨ YANGI: Agar yangi mahsulotning o'zida xillar bo'lsa, ularni ham qo'shish
        const variantsToAdd = [newVariant];
        
        if (Array.isArray(finalVariantSummaries) && finalVariantSummaries.length > 0) {
          console.log('[Products POST] New product has', finalVariantSummaries.length, 'variants - adding them too');
          
          // Yangi mahsulotning xillarini ham qo'shish
          for (const variant of finalVariantSummaries) {
            const additionalVariant = {
              name: variant.name || name.trim(),
              sku: variant.sku || undefined,
              customId: variant.customId ? variant.customId.trim().toUpperCase() : undefined,
              basePrice: variant.basePrice ?? finalBasePrice ?? undefined,
              originalPrice: variant.basePrice ?? finalBasePrice ?? undefined,
              priceMultiplier: variant.priceMultiplier ?? finalPriceMultiplier ?? undefined,
              markupPercent: variant.priceMultiplier ?? finalPriceMultiplier ?? undefined,
              price: variant.price ?? price ?? 0,
              currency: variant.currency || currency,
              stock: variant.stock ?? 0,
              stockCount: variant.stock ?? 0,
              initialStock: variant.stock ?? 0,
              status: normalizeProductStatus(variant.status),
              categoryId: variant.categoryId || categoryId || undefined,
              imagePaths: Array.isArray(variant.imagePaths) ? variant.imagePaths : [],
            };
            
            variantsToAdd.push(additionalVariant);
            console.log('[Products POST] Adding additional variant:', additionalVariant.name);
          }
        }
        
        console.log('[Products POST] Total variants to add:', variantsToAdd.length);
        
        // Mavjud mahsulotga barcha xillarni qo'shish
        const updateResult = await collection.updateOne(
          { _id: existingProduct._id },
          {
            $push: {
              variantSummaries: { $each: variantsToAdd } as any
            },
            $set: {
              updatedAt: new Date()
            }
          } as any
        );
        
        if (updateResult.modifiedCount === 0) {
          console.log('[Products POST] Failed to add variants');
          return res.status(500).json({ 
            success: false, 
            error: 'Xillarni qo\'shishda xatolik' 
          });
        }
        
        console.log('[Products POST] Variants added successfully:', variantsToAdd.length);
        
        // Yangilangan mahsulotni qaytarish
        const updatedProduct = await collection.findOne({ _id: existingProduct._id });
        
        // ✨ YANGI: Tarixga saqlash - barcha qo'shilgan xillar uchun
        try {
          const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);
          
          // Har bir qo'shilgan xil uchun tarix yozuvi yaratish
          for (const variant of variantsToAdd) {
            await historyCollection.insertOne({
              userId: finalUserId,
              type: 'variant_create',
              productId: existingProduct._id.toString(),
              productName: variant.name,
              variantName: variant.name,
              parentProductName: existingProduct.name,
              sku: variant.sku || '',
              stock: variant.stock || 0,
              addedStock: variant.stock || 0,
              price: variant.price || 0,
              currency: variant.currency || currency,
              message: `Qo'lda xil qo'shildi: ${variant.name}`,
              timestamp: new Date(),
              createdAt: new Date(),
              source: 'manual',
            });
          }
          
          console.log('[Products POST] History saved for', variantsToAdd.length, 'variants');
        } catch (historyErr) {
          console.error('[Products POST] History save error:', historyErr);
        }
        
        return res.status(201).json({
          success: true,
          product: updatedProduct,
          message: `${variantsToAdd.length} ta xil muvaffaqiyatli qo'shildi: ${existingProduct.name}`,
          addedVariantsCount: variantsToAdd.length,
        });
      } catch (err) {
        console.error('[Products POST] Error adding variant:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Xilni qo\'shishda xatolik' 
        });
      }
    }

    // 🆕 DUBLIKAT TEKSHIRUVI
    // 1. Agar 5 xonali kod (code) mavjud bo'lsa - kod bo'yicha tekshirish
    // 2. Agar kod bo'lmasa - mahsulot nomi bo'yicha tekshirish
    const { code } = req.body;
    
    if (code && code.trim()) {
      // 5 xonali kod bo'yicha tekshirish
      const codeLower = code.trim().toLowerCase();
      
      // Asosiy mahsulotlarni tekshirish
      const existingByCode = await collection.findOne({
        code: { $regex: new RegExp(`^${codeLower}$`, 'i') },
        userId: finalUserId
      });
      
      if (existingByCode) {
        console.log('[Products POST] Code duplicate found:', { code, existingProduct: existingByCode.name });
        return res.status(400).json({ 
          success: false, 
          error: `"${code}" kodli mahsulot allaqachon mavjud: "${existingByCode.name}"` 
        });
      }
      
      // Xillarni tekshirish
      const productWithVariantCode = await collection.findOne({
        'variantSummaries.code': { $regex: new RegExp(`^${codeLower}$`, 'i') },
        userId: finalUserId
      });
      
      if (productWithVariantCode) {
        const variant = productWithVariantCode.variantSummaries?.find((v: any) => 
          v.code?.toLowerCase() === codeLower
        );
        console.log('[Products POST] Code duplicate found in variant:', { code, variant: variant?.name });
        return res.status(400).json({ 
          success: false, 
          error: `"${code}" kodli mahsulot allaqachon mavjud: "${productWithVariantCode.name}" - "${variant?.name}"` 
        });
      }
    } else {
      // Kod bo'lmasa - mahsulot nomi bo'yicha tekshirish
      const nameLower = name.trim().toLowerCase();
      
      const existingByName = await collection.findOne({
        name: { $regex: new RegExp(`^${nameLower}$`, 'i') },
        userId: finalUserId
      });
      
      if (existingByName) {
        console.log('[Products POST] Name duplicate found:', { name, existingProduct: existingByName.name });
        return res.status(400).json({ 
          success: false, 
          error: `"${name}" nomli mahsulot allaqachon mavjud` 
        });
      }
    }

    // ✅ SKU duplikat tekshiruvi - faqat kod bo'yicha
    if (sku && sku.trim()) {
      const skuLower = sku.trim().toLowerCase();
      
      // Asosiy mahsulotlarni tekshirish
      const existingProduct = await collection.findOne({
        sku: { $regex: new RegExp(`^${skuLower}$`, 'i') },
        userId: finalUserId
      });
      
      if (existingProduct) {
        console.log('[Products POST] SKU duplicate found:', { sku, existingProduct: existingProduct.name });
        return res.status(400).json({ 
          success: false, 
          error: `"${sku}" kodli mahsulot allaqachon mavjud: "${existingProduct.name}"` 
        });
      }
      
      // Xillarni tekshirish
      const productWithVariant = await collection.findOne({
        'variantSummaries.sku': { $regex: new RegExp(`^${skuLower}$`, 'i') },
        userId: finalUserId
      });
      
      if (productWithVariant) {
        const variant = productWithVariant.variantSummaries?.find((v: any) => 
          v.sku?.toLowerCase() === skuLower
        );
        console.log('[Products POST] SKU duplicate found in variant:', { sku, variant: variant?.name });
        return res.status(400).json({ 
          success: false, 
          error: `"${sku}" kodli mahsulot allaqachon mavjud: "${productWithVariant.name}" - "${variant?.name}"` 
        });
      }
    }

    // ✅ YANGI: CustomId duplikat tekshiruvi
    if (customId && customId.trim()) {
      const customIdUpper = customId.trim().toUpperCase();
      
      const existingByCustomId = await collection.findOne({
        customId: customIdUpper,
        userId: finalUserId
      });
      
      if (existingByCustomId) {
        console.log('[Products POST] CustomId duplicate found:', { customId: customIdUpper, existingProduct: existingByCustomId.name });
        return res.status(400).json({ 
          success: false, 
          error: `"${customIdUpper}" ID allaqachon mavjud: "${existingByCustomId.name}"` 
        });
      }
    }

    // ✅ YANGI LOGIKA: SKU duplikat tekshiruvdan keyin yangi mahsulot qo'shish
    // Agar xil bo'lsa - variantSummaries ga qo'shish
    // Eski mahsulotga zarar yetmasligi uchun
    
    console.log('[Products] Creating new product (no SKU duplicate check):', { 
      name, 
      sku, 
      stock: finalStock, 
      userId: finalUserId,
      variantSummariesCount: finalVariantSummaries?.length || 0
    });

    // Yangi mahsulot yaratish (SKU bo'yicha qidirish o'tkazib)
    // Eski mahsulotga zarar yetmasligi uchun

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
      customId: customId ? customId.trim().toUpperCase() : undefined, // ✅ YANGI: Custom ID
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
      variantSummaries: Array.isArray(finalVariantSummaries) ? finalVariantSummaries.map((v: any, idx: number) => {
        const mapped = {
          ...v,
          // ✅ YANGI: Xil uchun Custom ID
          customId: v.customId ? v.customId.trim().toUpperCase() : undefined,
          // Standart field nomlari
          basePrice: v.basePrice ?? v.originalPrice ?? undefined,
          priceMultiplier: v.priceMultiplier ?? v.markupPercent ?? undefined,
          stock: v.stock ?? v.stockCount ?? 0,
          initialStock: v.initialStock, // MUHIM: Faqat serverdan kelgan qiymat, fallback yo'q
          // Marketplace uchun field nomlari
          originalPrice: v.basePrice ?? v.originalPrice ?? undefined,
          markupPercent: v.priceMultiplier ?? v.markupPercent ?? undefined,
          stockCount: v.stock ?? v.stockCount ?? 0,
        };
        console.log(`[Products POST] Variant ${idx} mapping:`, {
          name: v.name,
          inputCustomId: v.customId,
          outputCustomId: mapped.customId,
          hasCustomId: !!mapped.customId
        });
        return mapped;
      }) : [],
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
    console.log("[api/products POST] Product customId:", newProduct.customId); // ✅ DEBUG

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
    // Yangi mahsulot qo'shish uchun xodim ruxsat oladi
    // Tahrirlash uchun xodim ruxsat olmaydi
    const { userRole, canEditProducts } = req.body;
    if (userRole === 'xodim' && id) {
      // Xodim tahrirlash huquqiga ega emas (switch qanday bo'lsa ham)
      // Lekin yangi mahsulot qo'shish uchun ruxsat oladi
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
    if (price !== undefined) {
      updateData.price = price;
      // Narx o'zgarganda marketplace tomonida ham narxdan foydalaniladi,
      // lekin asosiy aliase'lar basePrice/markupPercent orqali boshqariladi
    }
    if (basePrice !== undefined) {
      updateData.basePrice = basePrice;
      // Marketplace alias: originalPrice
      updateData.originalPrice = basePrice;
    }
    if (priceMultiplier !== undefined) {
      updateData.priceMultiplier = priceMultiplier;
      // Marketplace alias: markupPercent
      updateData.markupPercent = priceMultiplier;
    }
    if (currency !== undefined) updateData.currency = currency;
    if (sku !== undefined) updateData.sku = sku;
    
    // ✅ YANGI: CustomId yangilash
    const { customId } = req.body;
    console.log('[Products PUT] CustomId from request:', customId); // ✅ DEBUG
    
    // MUHIM: Faqat xil qo'shish rejimida mahsulotning customId sini yangilamaslik
    // Oddiy tahrirlashda (variantSummaries bilan) mahsulotning customId sini yangilash mumkin
    if (customId !== undefined && !addVariantMode) {
      if (customId && customId.trim()) {
        const customIdUpper = customId.trim().toUpperCase();
        
        // Duplikat tekshiruvi (o'zidan boshqa mahsulotlarda)
        const existingByCustomId = await collection.findOne({
          customId: customIdUpper,
          userId: existingProduct.userId,
          _id: { $ne: new ObjectId(id) } // O'zidan boshqa mahsulotlar
        });
        
        if (existingByCustomId) {
          console.log('[Products PUT] CustomId duplicate found:', { customId: customIdUpper, existingProduct: existingByCustomId.name });
          return res.status(400).json({ 
            success: false, 
            error: `"${customIdUpper}" ID allaqachon mavjud: "${existingByCustomId.name}"` 
          });
        }
        
        updateData.customId = customIdUpper;
        console.log('[Products PUT] CustomId will be updated to:', customIdUpper); // ✅ DEBUG
      } else {
        // Bo'sh qiymat - customId ni o'chirish
        updateData.customId = undefined;
        console.log('[Products PUT] CustomId will be cleared'); // ✅ DEBUG
      }
    } else if (addVariantMode) {
      console.log('[Products PUT] Skipping product customId update (addVariantMode)'); // ✅ DEBUG
    } else {
      console.log('[Products PUT] CustomId not provided in request'); // ✅ DEBUG
    }
    
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (stock !== undefined && !addVariantMode) {
      // addVariantMode da stock yuqorida yangilanadi
      updateData.stock = stock;
      // Marketplace alias: stockCount ham yangilash
      updateData.stockCount = stock;
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
    
    if (updateData.initialStock === undefined) {
      const currentInitialStock = existingProduct.initialStock;
      if (currentInitialStock !== undefined && currentInitialStock !== null) {
        updateData.initialStock = currentInitialStock;
        console.log(`[api/products PUT] InitialStock kept: ${updateData.initialStock}`);
      }
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
        const newVariants = variantSummaries.map((v: any, idx: number) => {
          const computedStock = v.stock ?? v.stockCount ?? 0;
          const computedInitial = v.initialStock ?? computedStock;
          const mapped = {
            ...v,
            customId: v.customId ? v.customId.trim().toUpperCase() : undefined, // ✅ YANGI: Xil uchun Custom ID
            basePrice: v.basePrice ?? v.originalPrice ?? undefined,
            priceMultiplier: v.priceMultiplier ?? v.markupPercent ?? undefined,
            stock: computedStock,
            initialStock: computedInitial,
            // Marketplace alias maydonlari
            originalPrice: v.basePrice ?? v.originalPrice ?? undefined,
            markupPercent: v.priceMultiplier ?? v.markupPercent ?? undefined,
            stockCount: computedStock
          };
          console.log(`[Products PUT addVariantMode] Variant ${idx} mapping:`, {
            name: v.name,
            inputCustomId: v.customId,
            outputCustomId: mapped.customId,
            hasCustomId: !!mapped.customId
          });
          return mapped;
        });
        
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
              initialStock: (existingVariant.initialStock ?? existingVariant.stock ?? 0)
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
          const oldInitialStockRaw = oldVariant?.initialStock;
          const oldInitialResolved = (oldInitialStockRaw !== undefined && oldInitialStockRaw !== null) ? oldInitialStockRaw : oldStock;
          const newStock = v.stock ?? 0;
          
          // Agar yangi stock eski stock dan katta bo'lsa, farqni initialStock ga qo'shish
          let newInitialStock = v.initialStock ?? oldInitialResolved;
          if (oldVariant && newStock > oldStock) {
            const stockIncrease = newStock - oldStock;
            newInitialStock = oldInitialResolved + stockIncrease;
            console.log(`[api/products PUT] Variant ${v.name} stock increased: ${oldStock} -> ${newStock}, initialStock: ${oldInitialResolved} -> ${newInitialStock}`);
          } else if (!oldVariant) {
            // Yangi xil - initialStock = stock
            newInitialStock = newStock;
          }
          
          const mapped = {
            ...v,
            customId: v.customId ? v.customId.trim().toUpperCase() : undefined, // ✅ YANGI: Xil uchun Custom ID
            initialStock: newInitialStock,
            // Marketplace alias maydonlari
            basePrice: v.basePrice ?? v.originalPrice ?? oldVariant?.basePrice ?? oldVariant?.originalPrice ?? undefined,
            priceMultiplier: v.priceMultiplier ?? v.markupPercent ?? oldVariant?.priceMultiplier ?? oldVariant?.markupPercent ?? undefined,
            originalPrice: v.basePrice ?? v.originalPrice ?? oldVariant?.basePrice ?? oldVariant?.originalPrice ?? undefined,
            markupPercent: v.priceMultiplier ?? v.markupPercent ?? oldVariant?.priceMultiplier ?? oldVariant?.markupPercent ?? undefined,
            stock: newStock,
            stockCount: newStock
          };
          
          console.log(`[Products PUT regular] Variant ${index} mapping:`, {
            name: v.name,
            inputCustomId: v.customId,
            outputCustomId: mapped.customId,
            hasCustomId: !!mapped.customId
          });
          
          return mapped;
        }) : [];
        console.log("[api/products PUT] Updating variantSummaries:", updateData.variantSummaries.length);
      }
    }
    
    // Ota-bola mahsulot tizimi
    if (parentProductId !== undefined) updateData.parentProductId = parentProductId;
    if (childProducts !== undefined) updateData.childProducts = Array.isArray(childProducts) ? childProducts : [];
    if (isHidden !== undefined) updateData.isHidden = isHidden;

    // DEBUG: Log what we're about to save
    console.log('[Products PUT] About to save variantSummaries to MongoDB:', JSON.stringify(updateData.variantSummaries, null, 2));

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    // DEBUG: Log what MongoDB returned
    console.log('[Products PUT] MongoDB returned variantSummaries:', JSON.stringify((result as any).variantSummaries, null, 2));

    // Format response with proper initialStock fallback (same as GET endpoint)
    const productCurrency = (result as any).currency || 'UZS';
    const responseStock = (result as any).stock ?? 0;
    const responseInitialStock = (result as any).initialStock; // No fallback
    
    let responseVariantSummaries = (result as any).variantSummaries ?? (result as any).variants ?? [];
    if (Array.isArray(responseVariantSummaries)) {
      responseVariantSummaries = responseVariantSummaries.map((v: any, idx: number) => {
        console.log(`[Products PUT] Response variant ${idx} - input customId:`, v.customId, 'has customId:', !!v.customId);
        return {
          ...v,
          stock: v.stock ?? 0,
          initialStock: v.initialStock, // No fallback for variants
          currency: v.currency || productCurrency,
          // ✅ CRITICAL: Explicitly include customId and barcodeId in response
          customId: v.customId,
          barcodeId: v.barcodeId,
        };
      });
    }
    
    console.log('[Products PUT] Final response variantSummaries:', JSON.stringify(responseVariantSummaries, null, 2));
    
    const updatedProduct = {
      ...result,
      id: result._id.toString(),
      stock: responseStock,
      initialStock: responseInitialStock,
      variantSummaries: responseVariantSummaries,
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
    let historyItem = null;
    if (productUserId) {
      try {
        const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);
        
        // O'zgarishlarni aniqlash
        const changesList: string[] = [];
        const changesDetail: any[] = [];

        // Nom o'zgarishi
        if (updateData.name !== undefined && updateData.name !== existingProduct.name) {
          changesList.push(`Nom: ${existingProduct.name} > ${updateData.name}`);
          changesDetail.push({ field: 'name', oldValue: existingProduct.name, newValue: updateData.name });
        }

        // Asl narx (Base Price) o'zgarishi
        if (updateData.basePrice !== undefined && updateData.basePrice !== existingProduct.basePrice) {
          changesList.push(`Asl narx: ${existingProduct.basePrice || 0} > ${updateData.basePrice}`);
          changesDetail.push({ field: 'basePrice', oldValue: existingProduct.basePrice, newValue: updateData.basePrice });
        }

        // Narx o'zgarishi
        if (updateData.price !== undefined && updateData.price !== existingProduct.price) {
          changesList.push(`Narx: ${existingProduct.price} > ${updateData.price}`);
          changesDetail.push({ field: 'price', oldValue: existingProduct.price, newValue: updateData.price });
        }

        // Foiz (Price Multiplier) o'zgarishi
        if (updateData.priceMultiplier !== undefined && updateData.priceMultiplier !== existingProduct.priceMultiplier) {
          changesList.push(`Foiz: ${existingProduct.priceMultiplier || 0} > ${updateData.priceMultiplier}`);
          changesDetail.push({ field: 'priceMultiplier', oldValue: existingProduct.priceMultiplier, newValue: updateData.priceMultiplier });
        }

        // Valyuta o'zgarishi
        if (updateData.currency !== undefined && updateData.currency !== existingProduct.currency) {
          changesList.push(`Valyuta: ${existingProduct.currency || 'UZS'} > ${updateData.currency}`);
          changesDetail.push({ field: 'currency', oldValue: existingProduct.currency, newValue: updateData.currency });
        }

        // Soni (Stock) o'zgarishi
        if (updateData.stock !== undefined && updateData.stock !== existingProduct.stock) {
          changesList.push(`Soni: ${existingProduct.stock} > ${updateData.stock}`);
          changesDetail.push({ field: 'stock', oldValue: existingProduct.stock, newValue: updateData.stock });
        }

        // SKU o'zgarishi
        if (updateData.sku !== undefined && updateData.sku !== existingProduct.sku) {
          changesList.push(`SKU: ${existingProduct.sku || 'yo\'q'} > ${updateData.sku}`);
          changesDetail.push({ field: 'sku', oldValue: existingProduct.sku, newValue: updateData.sku });
        }

        // Variant o'zgarishlarini aniqlash (faqat tahrirlanganlarini olish)
        const editedVariants: any[] = [];
        const oldVariants = existingProduct.variantSummaries || [];
        const newVariants = updateData.variantSummaries || [];

        if (Array.isArray(newVariants)) {
          newVariants.forEach((v: any, index: number) => {
             let oldVariant = null;

             // 1. ID or _id match (Server ID is usually _id, client might send id)
             if (v.id || v._id) {
               const vId = v.id || v._id;
               oldVariant = oldVariants.find((ov: any) => {
                 const ovId = ov.id || ov._id?.toString();
                 return ovId === vId || ov._id?.toString() === vId;
               });
             }

             // 2. SKU match (if unique and present)
             if (!oldVariant && v.sku) {
               oldVariant = oldVariants.find((ov: any) => ov.sku === v.sku);
             }
             
             // 3. Name match (if unchanged)
             if (!oldVariant && v.name) {
               oldVariant = oldVariants.find((ov: any) => ov.name === v.name);
             }
             
             // 4. Index fallback (ONLY if counts match, implying simple edit without add/remove)
             if (!oldVariant && oldVariants.length === newVariants.length) {
               oldVariant = oldVariants[index];
             }

             if (!oldVariant) {
               // Yangi variant - qo'shish
               editedVariants.push(v);
               changesList.push(`Yangi xil: ${v.name}`);
               changesDetail.push({
                 field: 'Yangi xil',
                 oldValue: null,
                 newValue: v.name
               });
             } else {
               // O'zgarganini tekshirish
               let isChanged = false;
               const variantLabel = oldVariant.name || oldVariant.sku || 'Nomsiz';
               
               // Variant changes object to group changes
               const variantChanges: any = {
                  id: v.id || oldVariant.id || oldVariant._id,
                  name: v.name,
                  changes: []
               };

               if (oldVariant.name !== v.name) {
                 changesList.push(`Xil nomi: ${oldVariant.name} > ${v.name}`);
                 changesDetail.push({
                   field: `Xil nomi (${oldVariant.name})`,
                   oldValue: oldVariant.name,
                   newValue: v.name
                 });
                 variantChanges.changes.push({ field: 'name', old: oldVariant.name, new: v.name });
                 isChanged = true;
               }
               
               if (oldVariant.price !== v.price) {
                 changesList.push(`Xil narxi (${v.name}): ${oldVariant.price} > ${v.price}`);
                 changesDetail.push({
                   field: `Xil narxi (${v.name})`,
                   oldValue: oldVariant.price,
                   newValue: v.price
                 });
                 variantChanges.changes.push({ field: 'price', old: oldVariant.price, new: v.price });
                 isChanged = true;
               }
               
               if (oldVariant.stock !== v.stock) {
                 const diff = (v.stock || 0) - (oldVariant.stock || 0);
                 const sign = diff > 0 ? '+' : '';
                 changesList.push(`Xil soni (${v.name}): ${oldVariant.stock} > ${v.stock} (${sign}${diff})`);
                 changesDetail.push({
                   field: `Xil soni (${v.name})`,
                   oldValue: oldVariant.stock,
                   newValue: v.stock
                 });
                 variantChanges.changes.push({ field: 'stock', old: oldVariant.stock, new: v.stock });
                 isChanged = true;
               }

               if (isChanged) {
                 // Add old values to the edited variant for history
                 editedVariants.push({
                   ...v,
                   _oldValues: {
                     name: oldVariant.name,
                     price: oldVariant.price,
                     stock: oldVariant.stock,
                     sku: oldVariant.sku
                   }
                 });
               }
             }
          });
        }

        const changeMessage = changesList.length > 0 
          ? `Mahsulot tahrirlandi: ${changesList.join(', ')}`
          : `Mahsulot tahrirlandi: ${productName}`;

        const newHistoryItem = {
          userId: productUserId,
          type: 'update',
          productId: updatedProduct.id,
          productName: productName,
          sku: (result as any).sku || '',
          stock: (result as any).stock || 0,
          price: (result as any).price || 0,
          currency: (result as any).currency || 'UZS',
          message: changeMessage,
          changes: changesDetail,
          variants: editedVariants.length > 0 ? editedVariants : undefined,
          timestamp: new Date(),
          createdAt: new Date(),
          source: 'app',
        };

        const insertResult = await historyCollection.insertOne(newHistoryItem);
        
        historyItem = {
          ...newHistoryItem,
          id: insertResult.insertedId.toString(),
          _id: insertResult.insertedId
        };
        
        console.log('[Products PUT] History saved for user:', productUserId, 'Changes:', changesList);
      } catch (histErr) {
        console.error('[Products PUT] Failed to save history:', histErr);
      }
    } else {
      console.log('[Products PUT] No userId for history, skipping');
    }

    return res.json({ success: true, product: updatedProduct, historyItem });
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
    console.log('[api/products/:id DELETE] ========== DELETE REQUEST START ==========');
    console.log('[api/products/:id DELETE] Environment check:');
    console.log('[api/products/:id DELETE] NODE_ENV:', process.env.NODE_ENV);
    console.log('[api/products/:id DELETE] MONGODB_URI exists:', !!process.env.MONGODB_URI);
    console.log('[api/products/:id DELETE] DB_NAME:', process.env.DB_NAME);
    
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      console.error('[api/products/:id DELETE] ❌ Database not available');
      return res.status(500).json({ error: "Database not available" });
    }
    const db = conn.db;
    console.log('[api/products/:id DELETE] ✅ Database connected');

    const { id } = req.params;
    console.log('[api/products/:id DELETE] Deleting product:', id);
    
    if (!ObjectId.isValid(id)) {
      console.error('[api/products/:id DELETE] Invalid product ID:', id);
      return res.status(400).json({ error: "Invalid product ID" });
    }

    // MUHIM: Xodimlar uchun permission tekshirish
    // Switch o'chiq bo'lganda (canEditProducts=true) - o'chirish mumkin
    // Switch yoqib bo'lganda (canEditProducts=false) - o'chira olmaydi
    const { userRole, canEditProducts } = req.body;
    if (userRole === 'xodim' && !canEditProducts) {
      return res.status(403).json({ success: false, error: "Xodim mahsulotlarni o'chirish huquqiga ega emas" });
    }

    const collection = db.collection(PRODUCTS_COLLECTION);
    
    // Get product before deletion to broadcast
    const product = await collection.findOne({ _id: new ObjectId(id) });
    console.log('[api/products/:id DELETE] Found product:', product?.name || 'Not found');
    
    if (!product) {
      console.error('[api/products/:id DELETE] Product not found:', id);
      return res.status(404).json({ error: "Product not found" });
    }
    
    const productUserId = product?.userId;
    const productName = product?.name;
    const productVariants = product?.variantSummaries || [];

    console.log('[api/products/:id DELETE] Product details:');
    console.log('[api/products/:id DELETE] - Name:', productName);
    console.log('[api/products/:id DELETE] - Variants count:', productVariants.length);
    console.log('[api/products/:id DELETE] - Variants:', JSON.stringify(productVariants, null, 2));

    // YANGI LOGIKA: Agar mahsulotda xillar bo'lsa, birinchi xilni ota mahsulot qilamiz
    if (productVariants.length > 0) {
      console.log('[api/products/:id DELETE] ✅ Product has', productVariants.length, 'variants - promoting first variant to main product');
      console.log('[api/products/:id DELETE] 🔍 DEBUG: Variants array:', JSON.stringify(productVariants, null, 2));
      
      const firstVariant = productVariants[0];
      const remainingVariants = productVariants.slice(1);
      
      console.log('[api/products/:id DELETE] 🔍 DEBUG: First variant:', JSON.stringify(firstVariant, null, 2));
      console.log('[api/products/:id DELETE] 🔍 DEBUG: Remaining variants count:', remainingVariants.length);
      console.log('[api/products/:id DELETE] 🔍 DEBUG: Remaining variants:', JSON.stringify(remainingVariants, null, 2));
      
      // Birinchi xilni ota mahsulot qilamiz
      const updateData: any = {
        name: firstVariant.name,
        sku: firstVariant.sku || product.sku,
        code: firstVariant.code || product.code,
        catalogNumber: firstVariant.catalogNumber || product.catalogNumber,
        barcodeId: firstVariant.barcodeId || product.barcodeId,
        customId: firstVariant.customId || product.customId,
        basePrice: firstVariant.basePrice || product.basePrice,
        price: firstVariant.price || product.price,
        priceMultiplier: firstVariant.priceMultiplier || product.priceMultiplier,
        currency: firstVariant.currency || product.currency,
        stock: firstVariant.stock ?? product.stock,
        initialStock: firstVariant.initialStock ?? product.initialStock,
        categoryId: firstVariant.categoryId || product.categoryId,
        imageUrl: firstVariant.imageUrl || product.imageUrl,
        imagePaths: firstVariant.imagePaths || product.imagePaths,
        variantSummaries: remainingVariants, // Qolgan xillar
        updatedAt: new Date()
      };

      console.log('[api/products/:id DELETE] 🔍 DEBUG: Update data:', JSON.stringify(updateData, null, 2));

      // Ota mahsulotni yangilash (birinchi xil bilan)
      const updateResult = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      console.log('[api/products/:id DELETE] Updated main product with first variant:', updateResult.modifiedCount);
      console.log('[api/products/:id DELETE] 🔍 DEBUG: Update result:', JSON.stringify(updateResult, null, 2));

      // Tarixga yozish - ota mahsulot o'chirildi, birinchi xil ota bo'ldi
      try {
        const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);
        
        await historyCollection.insertOne({
          userId: productUserId || 'unknown',
          type: 'delete',
          productId: id,
          productName: productName || 'Unknown',
          sku: product.sku || '',
          stock: product.stock || 0,
          price: product.price || 0,
          currency: product.currency || 'UZS',
          basePrice: product.basePrice,
          priceMultiplier: product.priceMultiplier,
          categoryId: product.categoryId,
          description: product.description,
          imageUrl: product.imageUrl,
          imagePaths: product.imagePaths,
          message: `Ota mahsulot o'chirildi, birinchi xil ota bo'ldi: ${productName} → ${firstVariant.name}`,
          variants: productVariants.map((v: any) => ({
            name: v.name,
            sku: v.sku,
            stock: v.stock ?? 0,
            price: v.price ?? 0,
            currency: v.currency || product.currency || 'UZS',
          })),
          promotedVariant: {
            name: firstVariant.name,
            sku: firstVariant.sku,
            stock: firstVariant.stock,
            price: firstVariant.price,
          },
          timestamp: new Date(),
          createdAt: new Date(),
        });
        console.log('[api/products/:id DELETE] History saved for variant promotion:', productName);
      } catch (histErr) {
        console.error('[api/products/:id DELETE] Failed to save history:', histErr);
      }

      // Broadcast product update (not deletion) via WebSocket
      if (productUserId) {
        wsManager.broadcastToUser(productUserId, {
          type: 'product-updated',
          productId: id,
          productName: firstVariant.name,
          oldProductName: productName,
          userId: productUserId,
          action: 'variant-promoted',
          timestamp: Date.now(),
        });
      } else {
        wsManager.broadcast({
          type: 'product-updated',
          productId: id,
          productName: firstVariant.name,
          oldProductName: productName,
          action: 'variant-promoted',
          timestamp: Date.now(),
        });
      }

      console.log('[api/products/:id DELETE] ✅ Product variants promoted successfully:', id);
      return res.json({ 
        success: true, 
        message: "Main product deleted, first variant promoted to main product",
        promotedVariant: firstVariant.name,
        remainingVariants: remainingVariants.length
      });
    } else {
      // Agar xillar yo'q bo'lsa, oddiy o'chirish
      console.log('[api/products/:id DELETE] ❌ Product has no variants - deleting normally');
      console.log('[api/products/:id DELETE] - Variants array:', productVariants);
      console.log('[api/products/:id DELETE] - Variants length:', productVariants.length);

      // MUHIM: O'chirishdan OLDIN tarixga yozish (qaytarish uchun)
      try {
        const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);
        
        await historyCollection.insertOne({
          userId: productUserId || 'unknown',
          type: 'delete',
          productId: id,
          productName: productName || 'Unknown',
          sku: product.sku || '',
          stock: product.stock || 0,
          price: product.price || 0,
          currency: product.currency || 'UZS',
          basePrice: product.basePrice,
          priceMultiplier: product.priceMultiplier,
          categoryId: product.categoryId,
          description: product.description,
          imageUrl: product.imageUrl,
          imagePaths: product.imagePaths,
          message: `Mahsulot o'chirildi: ${productName} (${product.sku})`,
          timestamp: new Date(),
          createdAt: new Date(),
        });
        console.log('[api/products/:id DELETE] History saved for product:', productName);
      } catch (histErr) {
        console.error('[api/products/:id DELETE] Failed to save history:', histErr);
      }

      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      console.log('[api/products/:id DELETE] Delete result:', result.deletedCount);

      if (result.deletedCount === 0) {
        console.error('[api/products/:id DELETE] Failed to delete product:', id);
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

      console.log('[api/products/:id DELETE] ✅ Product deleted successfully:', id);
      return res.json({ success: true, message: "Product deleted" });
    }
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
    const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);
    
    // Tarixga saqlash uchun mahsulotlarni olish
    const productsToDelete = await collection.find({ userId: userId }).toArray();
    console.log(`[api/products/clear-all] Found ${productsToDelete.length} products to delete`);
    
    // Faqat o'z mahsulotlarini o'chirish
    const result = await collection.deleteMany({ userId: userId });

    console.log(`[api/products/clear-all] ✅ Deleted ${result.deletedCount} products for user ${userId}`);

    // Tarixga saqlash
    if (productsToDelete.length > 0) {
      const historyEntries = productsToDelete.map(product => ({
        userId,
        type: 'delete',
        productId: product._id.toString(),
        productName: product.name,
        sku: product.sku || '',
        stock: product.stock || 0,
        price: product.price || 0,
        currency: product.currency || 'UZS',
        message: 'Barcha mahsulotlar tozalandi',
        source: 'clear-all',
        variants: product.variantSummaries || [],
        timestamp: new Date(),
        createdAt: new Date(),
      }));
      
      await historyCollection.insertMany(historyEntries);
      console.log(`[api/products/clear-all] Added ${historyEntries.length} entries to history`);
    }

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
 * DELETE /api/products/delete-by-sku-range
 * SKU oralig'i bo'yicha mahsulotlarni o'chirish
 * MUHIM: Agar asosiy mahsulot o'chsa lekin xillar qolsa, xillarni yangi mahsulot qilish
 */
export const handleProductsDeleteBySkuRange: RequestHandler = async (req, res) => {
  console.log(`[api/products/delete-by-sku-range] ========== DELETE BY SKU RANGE REQUEST ==========`);
  console.log(`[api/products/delete-by-sku-range] Body:`, req.body);
  
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      console.log(`[api/products/delete-by-sku-range] ❌ Database not available`);
      return res.status(500).json({ error: "Database not available" });
    }
    
    const db = conn.db;
    const { userId, minSku, maxSku, productsToDelete, productsToUpdate } = req.body;
    
    if (!userId) {
      console.log(`[api/products/delete-by-sku-range] ❌ userId is missing`);
      return res.status(400).json({ error: "userId is required" });
    }
    
    console.log(`[api/products/delete-by-sku-range] Min SKU: ${minSku}, Max SKU: ${maxSku}`);
    console.log(`[api/products/delete-by-sku-range] Products to delete: ${productsToDelete?.length || 0}`);
    console.log(`[api/products/delete-by-sku-range] Products to update: ${productsToUpdate?.length || 0}`);
    
    const collection = db.collection(PRODUCTS_COLLECTION);
    const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);
    let deletedCount = 0;
    let updatedCount = 0;
    
    // 1. To'liq o'chiriladigan mahsulotlar
    if (Array.isArray(productsToDelete) && productsToDelete.length > 0) {
      const objectIds = productsToDelete.map(id => {
        try {
          return new ObjectId(id);
        } catch {
          return id;
        }
      });
      
      // Tarixga saqlash uchun mahsulotlarni olish
      const productsToLog = await collection.find({
        userId: userId,
        $or: [
          { _id: { $in: objectIds } },
          { _id: { $in: productsToDelete } }
        ]
      }).toArray();
      
      // O'chirish
      const result = await collection.deleteMany({
        userId: userId,
        $or: [
          { _id: { $in: objectIds } },
          { _id: { $in: productsToDelete } }
        ]
      });
      
      deletedCount += result.deletedCount;
      console.log(`[api/products/delete-by-sku-range] Deleted ${result.deletedCount} products completely`);
      
      // Tarixga saqlash
      if (productsToLog.length > 0) {
        const historyEntries = productsToLog.map(product => ({
          userId,
          type: 'delete',
          productId: product._id.toString(),
          productName: product.name,
          sku: product.sku,
          stock: product.stock,
          price: product.price,
          currency: product.currency,
          message: `SKU oralig'i bo'yicha o'chirildi (${minSku}-${maxSku})`,
          source: 'sku-range-delete',
          variants: product.variantSummaries || [],
          timestamp: new Date(),
          createdAt: new Date(),
        }));
        
        await historyCollection.insertMany(historyEntries);
        console.log(`[api/products/delete-by-sku-range] Added ${historyEntries.length} entries to history`);
      }
    }
    
    // 2. Xillari o'chiriladigan mahsulotlar
    if (Array.isArray(productsToUpdate) && productsToUpdate.length > 0) {
      for (const item of productsToUpdate) {
        const { productId, variantsToKeep } = item;
        
        try {
          const objectId = new ObjectId(productId);
          
          // Mahsulotni olish
          const product = await collection.findOne({ _id: objectId, userId });
          
          if (!product) {
            console.log(`[api/products/delete-by-sku-range] Product not found: ${productId}`);
            continue;
          }
          
          const productSku = parseInt(product.sku);
          const isProductInRange = !isNaN(productSku) && productSku >= minSku && productSku <= maxSku;
          
          // O'chirilgan xillarni aniqlash
          const originalVariants = product.variantSummaries || [];
          const deletedVariants = originalVariants.filter(v => 
            !variantsToKeep.some(k => k.sku === v.sku)
          );
          
          if (isProductInRange && variantsToKeep.length > 0) {
            // Asosiy mahsulot o'chadi, xillar yangi mahsulot bo'ladi
            // Birinchi xilni asosiy mahsulot qilamiz
            const firstVariant = variantsToKeep[0];
            const remainingVariants = variantsToKeep.slice(1);
            
            // Tarixga saqlash - asosiy mahsulot o'chirildi
            await historyCollection.insertOne({
              userId,
              type: 'delete',
              productId: product._id.toString(),
              productName: product.name,
              sku: product.sku,
              stock: product.stock,
              price: product.price,
              currency: product.currency,
              message: `SKU oralig'i bo'yicha o'chirildi, xil asosiy mahsulotga aylandi (${minSku}-${maxSku})`,
              source: 'sku-range-delete',
              variants: deletedVariants,
              timestamp: new Date(),
              createdAt: new Date(),
            });
            
            await collection.updateOne(
              { _id: objectId },
              {
                $set: {
                  name: firstVariant.name,
                  sku: firstVariant.sku,
                  code: firstVariant.code,
                  catalogNumber: firstVariant.catalogNumber,
                  barcodeId: firstVariant.barcodeId,
                  customId: firstVariant.customId,
                  basePrice: firstVariant.basePrice,
                  price: firstVariant.price,
                  priceMultiplier: firstVariant.priceMultiplier,
                  currency: firstVariant.currency,
                  stock: firstVariant.stock,
                  categoryId: firstVariant.categoryId,
                  variantSummaries: remainingVariants,
                  updatedAt: new Date()
                }
              }
            );
            
            updatedCount++;
            console.log(`[api/products/delete-by-sku-range] Updated product ${productId}: promoted variant to main product`);
          } else if (!isProductInRange && variantsToKeep.length >= 0) {
            // Asosiy mahsulot qoladi, faqat xillar o'chadi
            
            // Tarixga saqlash - faqat xillar o'chirildi
            if (deletedVariants.length > 0) {
              await historyCollection.insertOne({
                userId,
                type: 'delete',
                productId: product._id.toString(),
                productName: product.name,
                sku: product.sku,
                stock: product.stock,
                price: product.price,
                currency: product.currency,
                message: `Xillari SKU oralig'i bo'yicha o'chirildi (${minSku}-${maxSku})`,
                source: 'sku-range-delete',
                variants: deletedVariants,
                timestamp: new Date(),
                createdAt: new Date(),
              });
            }
            
            await collection.updateOne(
              { _id: objectId },
              {
                $set: {
                  variantSummaries: variantsToKeep,
                  updatedAt: new Date()
                }
              }
            );
            
            updatedCount++;
            console.log(`[api/products/delete-by-sku-range] Updated product ${productId}: removed variants in range`);
          }
        } catch (err) {
          console.error(`[api/products/delete-by-sku-range] Error updating product ${productId}:`, err);
        }
      }
    }
    
    console.log(`[api/products/delete-by-sku-range] ✅ Deleted: ${deletedCount}, Updated: ${updatedCount}`);
    
    // WebSocket orqali xabar yuborish
    const io = (req as any).io;
    if (io) {
      io.emit('products-updated', {
        userId: userId,
        action: 'delete-range',
        count: deletedCount + updatedCount
      });
    }
    
    return res.json({
      success: true,
      message: `${deletedCount + updatedCount} ta mahsulot/xil o'chirildi`,
      deletedCount,
      updatedCount
    });
  } catch (error) {
    console.error("[api/products/delete-by-sku-range DELETE] Error:", error);
    return res.status(500).json({ error: "Failed to delete products" });
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
    const { change, variantIndex, userId: requestUserId, reason } = req.body;
    
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
    let price = product.price || 0;
    let currency = product.currency || 'UZS';
    let sku = product.sku || '';
    let variantName: string | undefined;
    
    if (variantIndex !== undefined && product.variantSummaries?.[variantIndex]) {
      // VARIANT STOCK YANGILASH
      const variant = product.variantSummaries[variantIndex];
      const currentStock = variant.stock ?? 0; // Use ?? for null/undefined check only
      newStock = Math.max(0, currentStock + change);
      
      // History data preparation
      price = variant.price || price;
      currency = variant.currency || currency;
      sku = variant.sku || sku;
      variantName = variant.name || variant.sku;
      
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
    
    // TARIYGA YOZISH (MongoDB)
    try {
      const historyCollection = conn.db.collection(PRODUCT_HISTORY_COLLECTION);
      
      // MUHIM: Faqat manual update uchun tarixga yozish (kassa/sale/refund uchun emas)
      // reason parametri bo'lsa (kassa, sale, refund) - tarixga yozmaslik
      if (!reason) {
        // Type aniqlash: faqat manual update uchun
        let historyType = 'update';
        let historyMessage = '';
        
        if (change < 0) {
          historyMessage = `Kamaytirildi: ${Math.abs(change)} ta`;
        } else {
          historyMessage = `Ko'paytirildi: ${change} ta`;
        }
        
        if (variantName) {
          historyMessage += ` (${variantName})`;
        }

        await historyCollection.insertOne({
          userId: requestUserId || product.userId, // Request dagi user yoki product egasi
          type: historyType,
          productId: id,
          productName: product.name,
          sku: sku,
          stock: newStock,
          addedStock: change,
          price: price,
          currency: currency,
          message: historyMessage,
          variantName: variantName,
          timestamp: new Date(),
          createdAt: new Date(),
          source: 'manual'
        });
        console.log(`[STOCK UPDATE] History saved: manual update`);
      } else {
        console.log(`[STOCK UPDATE] Skipping history for reason: ${reason}`);
      }
    } catch (histErr) {
      console.error(`[STOCK UPDATE] History save error:`, histErr);
      // History error shouldn't fail the request
    }
    
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
      source: h.source || 'manual', // Source ni qaytarish
      changes: h.changes || [], // MUHIM: O'zgarishlarni qaytarish
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
    const { userId, type, productId, productName, sku, stock, addedStock, price, currency, message, variants, source, changes } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Type ni validate qilish
    const validTypes = ['create', 'update', 'delete', 'variant_create', 'variant_update'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid type" });
    }

    const collection = db.collection(PRODUCT_HISTORY_COLLECTION);
    
    // Duplikat tekshiruvi - oxirgi 5 daqiqa ichida bir xil productId, type va productName bo'lsa qo'shmaslik
    // LEKIN: 'delete' type uchun duplikat tekshiruvi o'tkazmaslik (har doim saqlash)
    if (type !== 'delete') {
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
      source: source || 'manual', // Default: 'manual'
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
    
    // MUHIM: O'zgarishlarni saqlash (tahrirlash uchun)
    if (changes && Array.isArray(changes) && changes.length > 0) {
      historyItem.changes = changes;
      console.log('[api/product-history POST] Saving with changes:', changes.length);
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

/**
 * POST /api/products/upload-image
 * Rasmni base64 ga aylantirish va saqlash
 */
export const handleProductImageUpload: RequestHandler = async (req, res) => {
  try {
    // Multer middleware orqali file olinadi
    const file = (req as any).file;
    
    if (!file) {
      return res.status(400).json({ success: false, error: "No image file provided" });
    }

    // Faylni base64 ga aylantirish
    const base64Data = file.buffer.toString('base64');
    const mimeType = file.mimetype || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    console.log('[Products] Image uploaded:', {
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    });

    return res.json({
      success: true,
      url: dataUrl,
      filename: file.originalname,
      size: file.size,
    });
  } catch (error) {
    console.error("[api/products/upload-image POST] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to upload image" });
  }
};

/**
 * POST /api/products/bulk-category-update
 * Bulk kategoriya va foiz yangilash
 */
export const handleBulkCategoryUpdate: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, error: "Database not available" });
    }
    const db = conn.db;

    const { minSku, maxSku, categoryId, markupPercentage, userId } = req.body;

    console.log('[Bulk Category Update] Request:', { minSku, maxSku, categoryId, markupPercentage, userId });

    // Validatsiya
    if (!minSku || !maxSku) {
      return res.status(400).json({ success: false, error: "Min va Max SKU kiritilishi kerak" });
    }

    if (!categoryId) {
      return res.status(400).json({ success: false, error: "Kategoriya tanlanishi kerak" });
    }

    if (markupPercentage === undefined || markupPercentage === null) {
      return res.status(400).json({ success: false, error: "Ustama foizi kiritilishi kerak" });
    }

    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID topilmadi" });
    }

    const collection = db.collection(PRODUCTS_COLLECTION);
    const categoriesCollection = db.collection(CATEGORIES_COLLECTION);

    // Kategoriya nomini olish
    let categoryName = '';
    try {
      let catObjectId;
      try {
        catObjectId = new ObjectId(categoryId);
      } catch {
        catObjectId = categoryId;
      }
      const category = await categoriesCollection.findOne({
        $or: [
          { _id: catObjectId },
          { _id: categoryId }
        ]
      });
      if (category) {
        categoryName = category.name || '';
      }
    } catch (catErr) {
      console.error('[Bulk Category Update] Error finding category:', catErr);
    }

    // SKU oralig'idagi mahsulotlarni topish
    const minSkuLower = minSku.toLowerCase().trim();
    const maxSkuLower = maxSku.toLowerCase().trim();

    // Foydalanuvchining barcha mahsulotlarini olish
    const allProducts = await collection.find({ userId }).toArray();

    // SKU bo'yicha filtrlash (raqamli va matnli SKU'larni qo'llab-quvvatlash)
    const filteredProducts = allProducts.filter((p: any) => {
      const sku = (p.sku || '').toLowerCase().trim();
      if (!sku) return false;

      // Raqamli SKU'lar uchun
      const isNumericMin = /^\d+$/.test(minSkuLower);
      const isNumericMax = /^\d+$/.test(maxSkuLower);
      const isNumericSku = /^\d+$/.test(sku);

      if (isNumericMin && isNumericMax && isNumericSku) {
        const skuNum = parseInt(sku, 10);
        const minNum = parseInt(minSkuLower, 10);
        const maxNum = parseInt(maxSkuLower, 10);
        return skuNum >= minNum && skuNum <= maxNum;
      }

      // Matnli SKU'lar uchun
      return sku >= minSkuLower && sku <= maxSkuLower;
    });

    if (filteredProducts.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `${minSku} dan ${maxSku} gacha SKU oralig'ida mahsulot topilmadi` 
      });
    }

    console.log('[Bulk Category Update] Found products:', filteredProducts.length);

    // Har bir mahsulotni yangilash
    let updatedCount = 0;
    const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);

    for (const product of filteredProducts) {
      const productId = product._id;
      const oldCategoryId = product.categoryId;
      const oldMarkupPercentage = product.markupPercentage || product.priceMultiplier || 0;

      // Yangilash ma'lumotlari
      const updateData: any = {
        categoryId,
        categoryName,
        markupPercentage,
        priceMultiplier: markupPercentage, // Alias
        markupPercent: markupPercentage, // Marketplace alias
        updatedAt: new Date(),
      };

      // Narxni qayta hisoblash - FAQAT basePrice mavjud bo'lsa
      if (product.basePrice) {
        // Agar basePrice mavjud bo'lsa, undan hisoblash
        const newPrice = product.basePrice * (1 + markupPercentage / 100);
        updateData.price = Math.round(newPrice);
        console.log('[Bulk Category Update] Product:', product.name, '- basePrice:', product.basePrice, '- newPrice:', Math.round(newPrice));
      } else {
        // Agar basePrice yo'q bo'lsa, narxni o'zgartirmaslik
        // Faqat kategoriya va foizni yangilash
        console.log('[Bulk Category Update] Product:', product.name, '- NO basePrice, price not changed');
      }

      // Xillar uchun ham yangilash
      if (Array.isArray(product.variantSummaries) && product.variantSummaries.length > 0) {
        updateData.variantSummaries = product.variantSummaries.map((v: any) => {
          const updatedVariant = {
            ...v,
            // Xil uchun ham kategoriya va foiz yangilash
            categoryId,
            priceMultiplier: markupPercentage,
            markupPercentage: markupPercentage,
            markupPercent: markupPercentage,
          };

          if (v.basePrice) {
            // Agar variant basePrice mavjud bo'lsa, undan hisoblash
            const newVariantPrice = v.basePrice * (1 + markupPercentage / 100);
            updatedVariant.price = Math.round(newVariantPrice);
            console.log('[Bulk Category Update] Variant:', v.name, '- basePrice:', v.basePrice, '- newPrice:', Math.round(newVariantPrice));
          } else {
            // Agar basePrice yo'q bo'lsa, narxni o'zgartirmaslik
            console.log('[Bulk Category Update] Variant:', v.name, '- NO basePrice, price not changed');
          }

          return updatedVariant;
        });
      }

      // Mahsulotni yangilash
      await collection.updateOne(
        { _id: productId },
        { $set: updateData }
      );

      updatedCount++;

      // Tarixga yozish
      try {
        await historyCollection.insertOne({
          userId,
          type: 'bulk_category_update',
          productId: productId.toString(),
          productName: product.name,
          sku: product.sku || '',
          oldCategoryId,
          newCategoryId: categoryId,
          oldMarkupPercentage,
          newMarkupPercentage: markupPercentage,
          message: `Kategoriya va foiz yangilandi: ${categoryName} (${markupPercentage}%)`,
          timestamp: new Date(),
          createdAt: new Date(),
        });
      } catch (histErr) {
        console.error('[Bulk Category Update] Failed to save history:', histErr);
      }
    }

    console.log('[Bulk Category Update] Updated products:', updatedCount);

    // WebSocket orqali xabar yuborish
    if (userId) {
      wsManager.broadcastToUser(userId, {
        type: 'bulk-category-updated',
        count: updatedCount,
        categoryId,
        categoryName,
        markupPercentage,
        timestamp: Date.now(),
      });
    }

    return res.json({
      success: true,
      updatedCount,
      message: `${updatedCount} ta mahsulot yangilandi`,
    });
  } catch (error) {
    console.error("[api/products/bulk-category-update POST] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to update products" });
  }
};

/**
 * POST /api/products/fix-missing-userid
 * Excel import qilingan mahsulotlarning userId sini tuzatish
 */
export const handleFixMissingUserId: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const db = conn.db;
    const collection = db.collection(PRODUCTS_COLLECTION);
    const { userId, importSource } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId majburiy" });
    }

    console.log(`[Fix Missing UserId] Starting fix for userId: ${userId}`);
    console.log(`[Fix Missing UserId] ImportSource: ${importSource}`);

    // 1. Avval jami mahsulotlar sonini tekshirish
    const allProductsCount = await collection.countDocuments({});
    console.log(`[Fix Missing UserId] Jami bazadagi mahsulotlar: ${allProductsCount}`);

    // 2. Sizning userId bilan mahsulotlar
    const userProductsCount = await collection.countDocuments({ userId: userId });
    console.log(`[Fix Missing UserId] Sizning mahsulotlaringiz: ${userProductsCount}`);

    // 3. ImportSource bilan mahsulotlar (userId yo'q)
    const importSourceFilter: any = {};
    if (importSource) {
      importSourceFilter.importSource = importSource;
    } else {
      // Agar importSource berilmagan bo'lsa, oxirgi Excel fayl nomini ishlatish
      importSourceFilter.importSource = "mahsulotlar_A6_A7_T7_SHAANXI_FOTON_CHAKMAN_FAW_HOWO_XCMG_2026_02.xlsx";
    }

    const importSourceProducts = await collection.find(importSourceFilter).toArray();
    console.log(`[Fix Missing UserId] ImportSource bilan jami mahsulotlar: ${importSourceProducts.length}`);
    
    // MUHIM: Agar import qilingan mahsulotlar kam bo'lsa, boshqa userId larda qidirish
    if (importSourceProducts.length < 500) {
      console.log(`⚠️ [Fix Missing UserId] DIQQAT: Faqat ${importSourceProducts.length}ta mahsulot topildi!`);
      
      // Boshqa userId larda ham qidirish
      const allImportSourceProducts = await collection.find(importSourceFilter).toArray();
      console.log(`[Fix Missing UserId] Barcha userId larda: ${allImportSourceProducts.length}`);
      
      // Har bir userId bo'yicha guruhlash
      const userGroups: Record<string, number> = {};
      allImportSourceProducts.forEach(p => {
        const uid = p.userId || 'NO_USER_ID';
        userGroups[uid] = (userGroups[uid] || 0) + 1;
      });
      
      console.log('[Fix Missing UserId] UserId bo\'yicha taqsimot:', userGroups);
      
      // Agar boshqa userId da ko'p mahsulot bo'lsa, ularni ham tuzatish
      for (const [uid, count] of Object.entries(userGroups)) {
        if (uid !== userId && uid !== 'NO_USER_ID' && count > 50) {
          console.log(`⚠️ [Fix Missing UserId] ${uid} da ${count}ta mahsulot bor - bu sizniki bo'lishi mumkin!`);
        }
      }
    }

    // 4. ImportSource mahsulotlaridan userId yo'qlari
    const missingUserIdProducts = importSourceProducts.filter(p => 
      !p.userId || p.userId === null || p.userId === ""
    );
    console.log(`[Fix Missing UserId] UserId yo'q mahsulotlar: ${missingUserIdProducts.length}`);

    // 5. UserId yo'q mahsulotlarni tuzatish
    if (missingUserIdProducts.length > 0) {
      const updateResult = await collection.updateMany(
        {
          ...importSourceFilter,
          $or: [
            { userId: { $exists: false } },
            { userId: null },
            { userId: "" }
          ]
        },
        { $set: { userId: userId } }
      );

      console.log(`[Fix Missing UserId] Tuzatilgan mahsulotlar: ${updateResult.modifiedCount}`);

      return res.json({
        success: true,
        message: `${updateResult.modifiedCount} ta mahsulotning userId si tuzatildi`,
        totalProducts: importSourceProducts.length,
        fixedProducts: updateResult.modifiedCount,
        userProductsBefore: userProductsCount,
        userProductsAfter: userProductsCount + updateResult.modifiedCount
      });
    } else {
      // MUHIM: Agar userId yo'q mahsulot topilmasa, boshqa userId lardagi mahsulotlarni tekshirish
      const allImportProducts = await collection.find(importSourceFilter).toArray();
      const otherUserProducts = allImportProducts.filter(p => p.userId && p.userId !== userId);
      
      if (otherUserProducts.length > 0) {
        console.log(`[Fix Missing UserId] Boshqa userId larda ${otherUserProducts.length}ta mahsulot topildi`);
        
        // Boshqa userId dagi mahsulotlarni sizning userId ga o'tkazish
        const transferResult = await collection.updateMany(
          {
            ...importSourceFilter,
            userId: { $ne: userId, $exists: true, $ne: null, $ne: "" }
          },
          { $set: { userId: userId } }
        );
        
        console.log(`[Fix Missing UserId] Boshqa userId dan o'tkazilgan: ${transferResult.modifiedCount}`);
        
        return res.json({
          success: true,
          message: `${transferResult.modifiedCount} ta mahsulot boshqa userId dan o'tkazildi`,
          totalProducts: allImportProducts.length,
          fixedProducts: transferResult.modifiedCount,
          userProductsBefore: userProductsCount,
          userProductsAfter: userProductsCount + transferResult.modifiedCount,
          transferredFromOtherUsers: true
        });
      }
      
      return res.json({
        success: true,
        message: "Barcha mahsulotlarda userId mavjud",
        totalProducts: importSourceProducts.length,
        fixedProducts: 0,
        userProducts: userProductsCount
      });
    }

  } catch (error) {
    console.error("[Fix Missing UserId] Error:", error);
    return res.status(500).json({ error: "Failed to fix missing userId" });
  }
};

/**
 * POST /api/products/recover-lost-products
 * Yo'qolgan mahsulotlarni product_history dan qayta tiklash
 */
export const handleRecoverLostProducts: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const db = conn.db;
    const collection = db.collection(PRODUCTS_COLLECTION);
    const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);
    const { userId, importSource } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId majburiy" });
    }

    console.log(`[Recover Lost Products] Starting recovery for userId: ${userId}`);
    console.log(`[Recover Lost Products] ImportSource: ${importSource}`);

    // 1. Hozirgi mahsulotlar sonini tekshirish
    const currentProducts = await collection.countDocuments({ userId: userId });
    console.log(`[Recover Lost Products] Hozirgi mahsulotlar: ${currentProducts}`);

    // 2. Product history dan Excel import qilingan mahsulotlarni topish
    const importSourceFilter = importSource || "mahsulotlar_A6_A7_T7_SHAANXI_FOTON_CHAKMAN_FAW_HOWO_XCMG_2026_02.xlsx";
    
    const historyProducts = await historyCollection.find({
      userId: userId,
      type: { $in: ['create', 'variant_create'] },
      importSource: importSourceFilter
    }).toArray();

    console.log(`[Recover Lost Products] History da topilgan: ${historyProducts.length}`);

    // 3. History dan unique mahsulotlarni ajratish
    const uniqueProductNames = new Set();
    const productsToRecover: any[] = [];

    for (const historyItem of historyProducts) {
      if (historyItem.type === 'create') {
        // Asosiy mahsulot
        const productName = historyItem.productName || historyItem.name;
        if (productName && !uniqueProductNames.has(productName)) {
          uniqueProductNames.add(productName);
          
          // Bazada mavjudligini tekshirish
          const existingProduct = await collection.findOne({
            userId: userId,
            name: productName
          });

          if (!existingProduct) {
            productsToRecover.push({
              name: productName,
              sku: historyItem.sku || '',
              type: 'main',
              historyData: historyItem
            });
          }
        }
      }
    }

    console.log(`[Recover Lost Products] Tiklash kerak bo'lgan mahsulotlar: ${productsToRecover.length}`);

    if (productsToRecover.length === 0) {
      return res.json({
        success: true,
        message: "Barcha mahsulotlar mavjud, tiklash kerak emas",
        currentProducts: currentProducts,
        recoveredProducts: 0
      });
    }

    // 4. Yo'qolgan mahsulotlarni qayta yaratish
    const recoveredProducts: any[] = [];
    let recoveredCount = 0;

    for (const productData of productsToRecover) {
      try {
        // Asosiy ma'lumotlarni history dan olish
        const historyItem = productData.historyData;
        
        const newProduct = {
          name: productData.name,
          sku: productData.sku || `recovered_${Date.now()}_${recoveredCount}`,
          code: historyItem.code || '',
          catalogNumber: historyItem.catalogNumber || '',
          barcodeId: historyItem.barcodeId || '',
          basePrice: historyItem.basePrice || 0,
          price: historyItem.price || 0,
          priceMultiplier: historyItem.priceMultiplier || 25,
          currency: historyItem.currency || 'USD',
          stock: historyItem.stock || 1,
          initialStock: historyItem.initialStock || 1,
          status: historyItem.status || 'available',
          categoryId: historyItem.categoryId || '',
          categoryName: historyItem.categoryName || '',
          userId: userId,
          source: 'recovery',
          importSource: importSourceFilter,
          importOrder: historyItem.importOrder || 9999,
          createdAt: new Date(),
          updatedAt: new Date(),
          variantSummaries: []
        };

        // Mahsulotni saqlash
        const insertResult = await collection.insertOne(newProduct);
        
        if (insertResult.insertedId) {
          recoveredProducts.push(newProduct);
          recoveredCount++;
          
          // History ga yozish
          await historyCollection.insertOne({
            userId: userId,
            type: 'recover',
            productId: insertResult.insertedId.toString(),
            productName: newProduct.name,
            sku: newProduct.sku,
            message: `Mahsulot history dan tiklandi`,
            timestamp: new Date(),
            createdAt: new Date(),
            importSource: importSourceFilter
          });
        }
      } catch (err) {
        console.error(`[Recover Lost Products] Error recovering ${productData.name}:`, err);
      }
    }

    console.log(`[Recover Lost Products] Tiklangan mahsulotlar: ${recoveredCount}`);

    return res.json({
      success: true,
      message: `${recoveredCount} ta mahsulot tiklandi`,
      currentProducts: currentProducts,
      recoveredProducts: recoveredCount,
      totalAfterRecovery: currentProducts + recoveredCount,
      recoveredList: recoveredProducts.map(p => ({ name: p.name, sku: p.sku }))
    });

  } catch (error) {
    console.error("[Recover Lost Products] Error:", error);
    return res.status(500).json({ error: "Failed to recover lost products" });
  }
};