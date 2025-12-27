import { RequestHandler } from "express";
import { connectMongo } from "../mongo";
import { wsManager } from "../websocket";

// xlsx kutubxonasini import qilish
let XLSX: any = null;
try {
  XLSX = await import('xlsx');
  console.log('[Excel Import] xlsx kutubxonasi muvaffaqiyatli yuklandi');
} catch (err) {
  console.error('[Excel Import] xlsx kutubxonasi yuklanmadi:', err);
}

const PRODUCTS_COLLECTION = process.env.OFFLINE_PRODUCTS_COLLECTION || "products";

// Ustun mapping interfeysi
interface ColumnMapping {
  name: number;      // Mahsulot nomi (majburiy)
  code: number;      // Mahsulot kodi
  catalogNumber: number; // Katalog raqami
  price: number;     // Narxi
  stock: number;     // Ombordagi soni
  category: number;  // Kategoriya
}

// Sarlavha kalit so'zlari
const HEADER_KEYWORDS = {
  name: ['наименование', 'название', 'номи', 'nomi', 'name', 'товар', 'mahsulot', 'product'],
  code: ['код', 'code', 'артикул'],
  catalogNumber: ['№ по каталогу', 'каталог №', 'по каталогу', 'catalog'],
  price: ['цена', 'narx', 'price', 'стоимость', 'сумма', 'итого'],
  stock: ['кол-во', 'количество', 'к-во', 'soni', 'stock', 'qty', 'остаток', 'шт'],
  category: ['категория', 'группа', 'category', 'guruh'],
};

// Sarlavha qatorini topish va ustunlarni avtomatik aniqlash
function detectHeaderAndColumns(rawData: any[]): { headerRowIndex: number; headers: string[]; mapping: ColumnMapping } {
  let headerRowIndex = -1;
  let headers: string[] = [];
  const mapping: ColumnMapping = {
    name: -1,
    code: -1,
    catalogNumber: -1,
    price: -1,
    stock: -1,
    category: -1,
  };

  // Birinchi 10 qatordan sarlavha qatorini qidirish
  for (let i = 0; i < Math.min(rawData.length, 10); i++) {
    const row = rawData[i];
    if (!row || row.length < 2) continue;

    let foundColumns = 0;
    const tempMapping: ColumnMapping = { ...mapping };
    const usedColumns: number[] = []; // Bir ustun bir nechta maydon uchun ishlatilmasligi uchun

    for (let col = 0; col < row.length; col++) {
      const cellValue = row[col] ? String(row[col]).toLowerCase().trim() : '';
      if (!cellValue) continue;

      // Avval aniqroq kalit so'zlarni tekshirish (catalogNumber)
      // "№ по каталогу" yoki "каталог" bo'lsa - catalogNumber
      if (cellValue.includes('каталог') || cellValue.includes('по каталогу')) {
        if (tempMapping.catalogNumber === -1) {
          tempMapping.catalogNumber = col;
          usedColumns.push(col);
          foundColumns++;
        }
        continue;
      }

      // "код" yoki "code" bo'lsa - code (lekin "каталог" bo'lmasa)
      if ((cellValue === 'код' || cellValue.includes('код') || cellValue === 'code' || cellValue.includes('артикул')) && !usedColumns.includes(col)) {
        if (tempMapping.code === -1) {
          tempMapping.code = col;
          usedColumns.push(col);
          foundColumns++;
        }
        continue;
      }

      // Qolgan maydonlar
      for (const [field, keywords] of Object.entries(HEADER_KEYWORDS)) {
        if (field === 'code' || field === 'catalogNumber') continue; // Yuqorida tekshirildi
        
        if (keywords.some(k => cellValue.includes(k) || cellValue === k)) {
          if (tempMapping[field as keyof ColumnMapping] === -1 && !usedColumns.includes(col)) {
            tempMapping[field as keyof ColumnMapping] = col;
            usedColumns.push(col);
            foundColumns++;
          }
          break;
        }
      }
    }

    // Agar kamida 2 ta ustun topilsa - bu sarlavha qatori
    if (foundColumns >= 2) {
      headerRowIndex = i;
      headers = row.map((cell: any) => cell ? String(cell).trim() : '');
      Object.assign(mapping, tempMapping);
      console.log('[Excel] Found header at row', i, '- mapping:', tempMapping);
      break;
    }
  }

  // Agar sarlavha topilmasa - birinchi qatorni sarlavha sifatida olish
  if (headerRowIndex === -1 && rawData.length > 0) {
    headerRowIndex = 0;
    headers = rawData[0].map((cell: any) => cell ? String(cell).trim() : '');
    // Oddiy format: birinchi ustun = nom, ikkinchi = narx
    mapping.name = 0;
    mapping.price = 1;
  }

  return { headerRowIndex, headers, mapping };
}

/**
 * POST /api/excel-import
 * Excel fayldan mahsulotlarni import qilish
 */
export const handleExcelImport: RequestHandler = async (req, res) => {
  try {
    // XLSX mavjudligini tekshirish
    if (!XLSX) {
      return res.status(500).json({
        success: false,
        error: 'Excel import funksiyasi mavjud emas. xlsx kutubxonasi o\'rnatilmagan.'
      });
    }

    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, error: "Database not available" });
    }

    const db = conn.db;
    const { 
      fileData,
      editedData, // Tahrirlangan ma'lumotlar
      columnMapping: userMapping, // Foydalanuvchi tanlagan ustunlar
      categoryId,
      userId,
      defaultStock = 5,
      defaultMultiplier = 20,
      defaultCurrency = 'USD',
      defaultStatus = 'available'
    } = req.body;

    if (!fileData) {
      return res.status(400).json({ success: false, error: "Excel fayl yuborilmadi" });
    }

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId majburiy" });
    }

    console.log('[Excel Import] Starting import for user:', userId);
    console.log('[Excel Import] User column mapping:', userMapping);
    console.log('[Excel Import] defaultMultiplier:', defaultMultiplier, '% (multiplier:', defaultMultiplier / 100, ')');
    console.log('[Excel Import] Has edited data:', !!editedData);

    let rawData: any[] = [];
    let headerRowIndex = -1;

    // Agar tahrirlangan ma'lumotlar bo'lsa, ularni ishlatish
    if (editedData && Array.isArray(editedData) && editedData.length > 0) {
      console.log('[Excel Import] Using edited data:', editedData.length, 'rows');
      rawData = editedData;
      headerRowIndex = -1; // Tahrirlangan ma'lumotlarda sarlavha yo'q
    } else {
      // 1. Excel faylni o'qish
      const buffer = Buffer.from(fileData, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      if (rawData.length === 0) {
        return res.status(400).json({ success: false, error: "Excel fayl bo'sh" });
      }

      // 2. Sarlavha va ustunlarni aniqlash
      const { headerRowIndex: detectedHeaderIndex } = detectHeaderAndColumns(rawData);
      headerRowIndex = detectedHeaderIndex;
      
      console.log('[Excel Import] Header row index:', headerRowIndex);
    }
    
    // Foydalanuvchi mapping ni ishlatish yoki avtomatik
    const columnMap: ColumnMapping = userMapping || {
      name: 0,
      code: -1,
      catalogNumber: -1,
      price: 1,
      stock: -1,
      category: -1,
    };

    console.log('[Excel Import] Using column map:', columnMap);

    // 3. Qatorlarni parse qilish - FAQAT sarlavha qatoridan KEYIN
    interface ParsedRow {
      name: string;
      code: string;
      catalogNumber: string;
      price: number;
      stock: number;
      category: string;
    }
    
    const rows: ParsedRow[] = [];
    
    // Sarlavha qatoridan keyingi qatorlardan boshlash
    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    
    for (let i = startRow; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length < 2) continue;
      
      // Ma'lumotlarni olish
      let name = '';
      let code = '';
      let catalogNumber = '';
      let price = 0;
      let stock = defaultStock;
      let category = '';
      
      // Nom
      if (columnMap.name >= 0 && row[columnMap.name]) {
        name = String(row[columnMap.name]).trim();
      }
      
      // Mahsulot kodi
      if (columnMap.code >= 0 && row[columnMap.code]) {
        code = String(row[columnMap.code]).trim();
      }
      
      // Katalog raqami
      if (columnMap.catalogNumber >= 0 && row[columnMap.catalogNumber]) {
        catalogNumber = String(row[columnMap.catalogNumber]).trim();
      }
      
      // Kategoriya
      if (columnMap.category >= 0 && row[columnMap.category]) {
        category = String(row[columnMap.category]).trim();
      }
      
      // Soni
      if (columnMap.stock >= 0 && row[columnMap.stock] !== undefined && row[columnMap.stock] !== null) {
        const rawStockValue = row[columnMap.stock];
        // Agar raqam bo'lsa to'g'ridan-to'g'ri olish
        if (typeof rawStockValue === 'number') {
          stock = Math.floor(rawStockValue);
        } else {
          // String bo'lsa parse qilish
          const parsedStock = parseInt(String(rawStockValue).replace(/[^0-9]/g, ''));
          if (!isNaN(parsedStock) && parsedStock >= 0) {
            stock = parsedStock;
          }
        }
        console.log('[Excel Import] Row', i, '- Stock column:', columnMap.stock, ', Raw value:', rawStockValue, ', Parsed stock:', stock);
      }
      
      // Narxi
      if (columnMap.price >= 0 && row[columnMap.price] !== undefined && row[columnMap.price] !== null) {
        const parsed = parseFloat(String(row[columnMap.price]).replace(/[^0-9.]/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
          price = parsed;
        }
      }
      
      // Agar nom bo'sh bo'lsa, code ni nom sifatida ishlatish
      if (!name && code) {
        name = code;
      }
      
      if (!name) continue;
      
      // Sarlavha so'zlarini o'tkazib yuborish
      const nameLower = name.toLowerCase();
      const allKeywords = Object.values(HEADER_KEYWORDS).flat();
      if (allKeywords.some(keyword => nameLower === keyword)) {
        continue;
      }
      
      rows.push({ name, code, catalogNumber, price, stock, category });
    }

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: "Excel faylda ma'lumot topilmadi" });
    }

    console.log('[Excel Import] Parsed rows:', rows.length);

    // 4. Mahsulotlarni BIRINCHI SO'Z bo'yicha guruhlash
    const groupedMap = new Map<string, ParsedRow[]>();
    
    for (const row of rows) {
      const firstWord = row.name.split(/\s+/)[0].toLowerCase();
      const existing = groupedMap.get(firstWord);
      if (existing) {
        existing.push(row);
      } else {
        groupedMap.set(firstWord, [row]);
      }
    }

    console.log('[Excel Import] Unique products (by first word):', groupedMap.size);

    // 5. Oxirgi SKU ni olish
    const collection = db.collection(PRODUCTS_COLLECTION);
    const lastProduct = await collection
      .find({ userId })
      .sort({ sku: -1 })
      .limit(1)
      .toArray();
    
    let nextSku = 1;
    if (lastProduct.length > 0 && lastProduct[0].sku) {
      const lastSku = parseInt(String(lastProduct[0].sku));
      if (!isNaN(lastSku)) {
        nextSku = lastSku + 1;
      }
    }

    // 6. Mahsulotlarni tayyorlash
    const productsToInsert: any[] = [];
    const errors: string[] = [];
    const multiplier = defaultMultiplier / 100;
    let globalSku = nextSku;

    for (const [, productRows] of groupedMap) {
      try {
        const mainRow = productRows[0];
        const productName = mainRow.name;
        
        // SKU - avtomatik ketma-ket raqam
        const productSku = String(globalSku);
        globalSku++;
        
        // Mahsulot kodi (Exceldan) -> catalogNumber ga saqlanadi
        const productCatalogNumber = mainRow.code || mainRow.catalogNumber || '';
        
        // MUHIM: code maydoni uchun null qiymatlarni handle qilish
        // MongoDB da code_1 index duplicate key xatosini oldini olish uchun
        // Agar code bo'sh bo'lsa, undefined qo'yamiz (null emas)
        
        // Stock qiymatini to'g'ri olish - 0 ham valid qiymat
        const productStock = mainRow.stock !== undefined && mainRow.stock !== null ? mainRow.stock : defaultStock;
        console.log('[Excel Import] Product:', productName, '- mainRow.stock:', mainRow.stock, '- productStock:', productStock);
        
        const basePrice = mainRow.price || 0; // Excel dan kelgan narx - asl narx
        const sellingPrice = basePrice > 0 
          ? Math.round((basePrice * (1 + multiplier)) * 100) / 100 
          : 0; // Asl narx + foiz = sotiladigan narx
        
        // Xillarni yaratish
        const variantSummaries: any[] = [];
        
        if (productRows.length > 1) {
          for (let i = 1; i < productRows.length; i++) {
            const variantRow = productRows[i];
            const variantBasePrice = variantRow.price || basePrice; // Excel dan kelgan narx - asl narx
            const variantSellingPrice = variantBasePrice > 0 
              ? Math.round((variantBasePrice * (1 + multiplier)) * 100) / 100 
              : sellingPrice; // Asl narx + foiz = sotiladigan narx
            
            // Stock qiymatini to'g'ri olish - 0 ham valid qiymat
            const variantStock = variantRow.stock !== undefined && variantRow.stock !== null ? variantRow.stock : defaultStock;
            
            const variantSku = String(globalSku);
            globalSku++;
            
            const variantCatalogNumber = variantRow.code || variantRow.catalogNumber || '';
            
            variantSummaries.push({
              name: variantRow.name,
              sku: variantSku,
              catalogNumber: variantCatalogNumber || undefined, // null o'rniga undefined
              // code maydonini qo'shmaymiz - duplicate key xatosini oldini olish uchun
              basePrice: variantBasePrice,
              originalPrice: variantBasePrice,
              priceMultiplier: defaultMultiplier,
              markupPercent: defaultMultiplier,
              price: variantSellingPrice,
              currency: defaultCurrency,
              stock: variantStock,
              stockCount: variantStock,
              // MUHIM: initialStock ni o'rnatmaslik - bu faqat sotish paytida o'rnatiladi
              // initialStock: variantStock, // BU QATORNI O'CHIRISH
              status: defaultStatus,
              description: variantRow.category || '',
            });
          }
        }

        productsToInsert.push({
          name: productName,
          sku: productSku,
          catalogNumber: productCatalogNumber || undefined, // null o'rniga undefined
          // code maydonini qo'shmaymiz - duplicate key xatosini oldini olish uchun
          basePrice: basePrice,
          originalPrice: basePrice,
          priceMultiplier: defaultMultiplier,
          markupPercent: defaultMultiplier,
          price: sellingPrice,
          currency: defaultCurrency,
          stock: productStock,
          stockCount: productStock,
          // MUHIM: initialStock ni o'rnatmaslik - bu faqat sotish paytida o'rnatiladi
          // initialStock: productStock, // BU QATORNI O'CHIRISH
          status: defaultStatus,
          isHidden: false,
          description: mainRow.category || '',
          categoryId: categoryId || undefined,
          variantSummaries: variantSummaries,
          userId: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          source: 'excel-import',
        });
        
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    // 7. Barcha mahsulotlarni qo'shish
    let createdProducts: any[] = [];
    
    if (productsToInsert.length > 0) {
      try {
        const result = await collection.insertMany(productsToInsert, { ordered: false });
        
        createdProducts = productsToInsert.map((product, index) => ({
          ...product,
          _id: result.insertedIds[index],
          id: result.insertedIds[index]?.toString(),
          variantsCount: product.variantSummaries?.length || 0,
        }));
        
        console.log('[Excel Import] Bulk inserted:', result.insertedCount, 'products');
      } catch (bulkErr: any) {
        console.error('[Excel Import] Bulk insert error:', bulkErr);
        errors.push(`Bulk insert xatosi: ${bulkErr.message}`);
        
        // Agar partial insert bo'lsa, muvaffaqiyatli qo'shilganlarni olish
        if (bulkErr.insertedDocs) {
          createdProducts = bulkErr.insertedDocs.map((product: any) => ({
            ...product,
            id: product._id?.toString(),
            variantsCount: product.variantSummaries?.length || 0,
          }));
        }
      }
    }

    // 8. Tarixga saqlash - har bir mahsulot VA har bir xil uchun alohida
    console.log('[Excel Import] createdProducts.length:', createdProducts.length);
    if (createdProducts.length > 0) {
      try {
        const historyCollection = db.collection('product_history');
        const historyEntries: any[] = [];
        
        for (const product of createdProducts) {
          // Asosiy mahsulotni tarixga qo'shish
          historyEntries.push({
            userId: userId,
            type: 'create',
            productId: product.id || product._id?.toString(),
            productName: product.name,
            sku: product.sku,
            stock: product.stock || 0,
            addedStock: product.stock || 0,
            price: product.price || 0,
            currency: product.currency || 'USD',
            message: `Excel orqali qo'shildi: ${product.name}`,
            timestamp: new Date(),
            createdAt: new Date(),
            source: 'excel-import',
          });
          
          // Har bir xilni ham alohida tarixga qo'shish
          if (Array.isArray(product.variantSummaries) && product.variantSummaries.length > 0) {
            for (const variant of product.variantSummaries) {
              historyEntries.push({
                userId: userId,
                type: 'variant_create',
                productId: product.id || product._id?.toString(),
                productName: variant.name,
                variantName: variant.name,
                parentProductName: product.name,
                sku: variant.sku,
                stock: variant.stock ?? 0,
                addedStock: variant.stock ?? 0,
                price: variant.price ?? 0,
                currency: variant.currency || product.currency || 'USD',
                message: `Excel orqali qo'shildi (xil): ${variant.name}`,
                timestamp: new Date(),
                createdAt: new Date(),
                source: 'excel-import',
              });
            }
          }
        }
        
        console.log('[Excel Import] Saving history entries:', historyEntries.length, '(products + variants)');
        await historyCollection.insertMany(historyEntries, { ordered: false });
        console.log('[Excel Import] History saved:', historyEntries.length, 'entries');
      } catch (historyErr: any) {
        console.error('[Excel Import] History save error:', historyErr);
        // Tarix saqlanmasa ham davom etamiz
      }
    } else {
      console.log('[Excel Import] No products to save history for');
    }

    // WebSocket xabar
    if (userId) {
      wsManager.broadcastToUser(userId, {
        type: 'excel-import-complete',
        productsCount: createdProducts.length,
        errorsCount: errors.length,
        timestamp: Date.now(),
      });
    }

    return res.status(201).json({
      success: true,
      message: `${createdProducts.length} ta mahsulot import qilindi`,
      products: createdProducts,
      totalProducts: createdProducts.length,
      totalVariants: createdProducts.reduce((sum, p) => sum + (p.variantsCount || 0), 0),
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error("[api/excel-import POST] Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Excel import xatosi" 
    });
  }
};


/**
 * POST /api/excel-import/preview
 * Excel faylni oldindan ko'rish - sarlavhalar va namuna qatorlarni qaytarish
 */
export const handleExcelPreview: RequestHandler = async (req, res) => {
  try {
    // XLSX mavjudligini tekshirish
    if (!XLSX) {
      return res.status(500).json({
        success: false,
        error: 'Excel preview funksiyasi mavjud emas. xlsx kutubxonasi o\'rnatilmagan.'
      });
    }

    const { fileData } = req.body;

    if (!fileData) {
      return res.status(400).json({ success: false, error: "Excel fayl yuborilmadi" });
    }

    // Excel faylni o'qish
    const buffer = Buffer.from(fileData, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rawData.length === 0) {
      return res.status(400).json({ success: false, error: "Excel fayl bo'sh" });
    }

    // Sarlavha va ustunlarni aniqlash
    const { headerRowIndex, headers, mapping } = detectHeaderAndColumns(rawData);
    
    console.log('[Excel Preview] Header row:', headerRowIndex);
    console.log('[Excel Preview] Headers:', headers);
    console.log('[Excel Preview] Detected mapping:', mapping);

    // BARCHA qatorlarni olish (sarlavhadan keyingi barcha qatorlar)
    const sampleRows: any[][] = [];
    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    for (let i = startRow; i < rawData.length; i++) {
      if (rawData[i] && rawData[i].length > 0) {
        sampleRows.push(rawData[i]);
      }
    }

    // Qatorlarni parse qilish (statistika uchun) - FAQAT sarlavhadan KEYIN
    interface ParsedRow {
      name: string;
      price: number;
    }
    
    const rows: ParsedRow[] = [];
    const allKeywords = Object.values(HEADER_KEYWORDS).flat();
    
    // Sarlavha qatoridan keyingi qatorlardan boshlash
    for (let i = startRow; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length < 2) continue;
      
      let name = '';
      let price = 0;
      
      // Nom
      if (mapping.name >= 0 && row[mapping.name]) {
        name = String(row[mapping.name]).trim();
      }
      
      // Narxi
      if (mapping.price >= 0 && row[mapping.price] !== undefined) {
        const parsed = parseFloat(String(row[mapping.price]).replace(/[^0-9.]/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
          price = parsed;
        }
      }
      
      if (!name) continue;
      // Sarlavha so'zlarini o'tkazib yuborish
      const nameLower = name.toLowerCase();
      if (allKeywords.some(keyword => nameLower === keyword)) {
        continue;
      }
      
      rows.push({ name, price });
    }

    // Guruhlash - BIRINCHI SO'Z bo'yicha
    const groupedMap = new Map<string, { count: number; firstName: string; totalPrice: number }>();
    
    for (const row of rows) {
      const firstWord = row.name.split(/\s+/)[0].toLowerCase();
      const existing = groupedMap.get(firstWord);
      if (existing) {
        existing.count++;
        existing.totalPrice += row.price;
      } else {
        groupedMap.set(firstWord, { 
          count: 1, 
          firstName: row.name,
          totalPrice: row.price,
        });
      }
    }

    // Preview ma'lumotlari
    const preview = Array.from(groupedMap.entries()).map(([, data]) => ({
      name: data.firstName,
      isProduct: true,
      variantsCount: data.count > 1 ? data.count - 1 : 0,
      totalRows: data.count,
      avgPrice: Math.round(data.totalPrice / data.count * 100) / 100,
    }));

    return res.json({
      success: true,
      totalRows: rows.length,
      uniqueProducts: groupedMap.size,
      totalVariants: rows.length - groupedMap.size,
      headers: headers,
      sampleRows: sampleRows,
      detectedMapping: mapping,
      preview: preview.slice(0, 50),
    });

  } catch (error: any) {
    console.error("[api/excel-import/preview POST] Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Excel preview xatosi" 
    });
  }
};


/**
 * POST /api/excel-import/fix
 * Excel import qilingan mahsulotlarni tuzatish - isHidden: false qo'shish
 */
export const handleExcelImportFix: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, error: "Database not available" });
    }

    const db = conn.db;
    const collection = db.collection(PRODUCTS_COLLECTION);
    const { userId } = req.body;

    // 1. Excel import qilingan mahsulotlarni tuzatish
    const excelResult = await collection.updateMany(
      { source: 'excel-import' },
      { $set: { isHidden: false } }
    );

    // 2. isHidden maydoni yo'q bo'lgan barcha mahsulotlarni tuzatish
    const noHiddenResult = await collection.updateMany(
      { isHidden: { $exists: false } },
      { $set: { isHidden: false } }
    );

    // 3. Agar userId berilgan bo'lsa - userId yo'q mahsulotlarga userId qo'shish
    let noUserIdResult = { modifiedCount: 0 };
    if (userId) {
      noUserIdResult = await collection.updateMany(
        { $or: [{ userId: { $exists: false } }, { userId: null }, { userId: "" }] },
        { $set: { userId: userId } }
      );
    }

    console.log('[Excel Import Fix] Updated excel products:', excelResult.modifiedCount);
    console.log('[Excel Import Fix] Updated products without isHidden:', noHiddenResult.modifiedCount);
    console.log('[Excel Import Fix] Updated products without userId:', noUserIdResult.modifiedCount);

    return res.json({
      success: true,
      message: `${excelResult.modifiedCount + noHiddenResult.modifiedCount + noUserIdResult.modifiedCount} ta mahsulot tuzatildi`,
      excelProductsFixed: excelResult.modifiedCount,
      noHiddenFixed: noHiddenResult.modifiedCount,
      noUserIdFixed: noUserIdResult.modifiedCount,
    });

  } catch (error: any) {
    console.error("[api/excel-import/fix POST] Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Fix xatosi" 
    });
  }
};
