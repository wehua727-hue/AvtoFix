import { RequestHandler } from "express";
import { connectMongo } from "../mongo";
import { wsManager } from "../websocket";
import { validateProductSkus } from "../utils/sku-validator";
import { 
  detectAlphabet, 
  latinToCyrillic, 
  convertProductName,
  hasLatinLetters,
  hasCyrillicLetters
} from "../utils/alphabet-converter";

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
  barcodeId: number; // Barcode ID
  multiplier: number; // Foiz (%)
}

// Sarlavha kalit so'zlari
const HEADER_KEYWORDS = {
  name: ['наименование', 'название', 'номи', 'nomi', 'name', 'товар', 'mahsulot', 'product'],
  code: ['код', 'code', 'артикул'],
  catalogNumber: ['№ по каталогу', 'каталог №', 'по каталогу', 'catalog'],
  price: ['цена', 'narx', 'price', 'стоимость', 'сумма', 'итого'],
  stock: ['кол-во', 'количество', 'к-во', 'soni', 'stock', 'qty', 'остаток', 'шт'],
  category: ['категория', 'группа', 'category', 'guruh'],
  barcodeId: ['barcode id', 'barcode', 'штрих-код', 'штрихкод'],
  multiplier: ['фоиз', 'foiz', '%', 'процент', 'markup', 'наценка'],
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
    barcodeId: -1,
    multiplier: -1,
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
      if ((cellValue.includes('каталог') || cellValue.includes('по каталогу') || cellValue.includes('catalog')) && !usedColumns.includes(col)) {
        if (tempMapping.catalogNumber === -1) {
          tempMapping.catalogNumber = col;
          usedColumns.push(col);
          foundColumns++;
        }
        continue;
      }

      // "код" yoki "code" bo'lsa - code (lekin "каталог" bo'lmasa)
      if ((cellValue === 'код' || cellValue.includes('код') || cellValue === 'code' || cellValue.includes('артикул') || cellValue === 'артикул') && !cellValue.includes('каталог') && !usedColumns.includes(col)) {
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
  // CORS header'larini qo'lda qo'shish
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-user-id');
  
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
      defaultMultiplier = 25,
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
    console.log('[Excel Import] defaultCurrency:', defaultCurrency);
    console.log('[Excel Import] Has edited data:', !!editedData);

    let rawData: any[] = [];
    let headerRowIndex = -1;

    // Kategoriyalarni olish - nom bo'yicha moslashtirish uchun
    const categoriesCollection = db.collection('categories');
    const allCategories = await categoriesCollection.find({ userId }).toArray();
    console.log('[Excel Import] Loaded categories:', allCategories.length);
    
    // Kategoriya nomini ID ga moslashtirish funksiyasi
    const findCategoryByName = (categoryName: string): string | undefined => {
      if (!categoryName) return undefined;
      const nameLower = categoryName.toLowerCase().trim();
      const found = allCategories.find(cat => 
        (cat.name || '').toLowerCase().trim() === nameLower
      );
      return found?._id?.toString();
    };

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
    console.log('[Excel Import] Column indices - name:', columnMap.name, ', code:', columnMap.code, ', catalogNumber:', columnMap.catalogNumber, ', price:', columnMap.price, ', stock:', columnMap.stock);

    // 3. Qatorlarni parse qilish - FAQAT sarlavha qatoridan KEYIN
    interface ParsedRow {
      name: string;
      code: string;
      catalogNumber: string;
      price: number;
      stock: number;
      category: string;
      barcodeId: string; // Yangi
      multiplier: number; // Yangi
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
      let barcodeId = ''; // Yangi
      let multiplierValue = defaultMultiplier; // Yangi - default foiz
      
      // Nom
      if (columnMap.name >= 0 && row[columnMap.name]) {
        name = String(row[columnMap.name]).trim();
      }
      
      // Mahsulot kodi
      if (columnMap.code >= 0 && row[columnMap.code] !== undefined && row[columnMap.code] !== null && row[columnMap.code] !== '') {
        code = String(row[columnMap.code]).trim();
        console.log('[Excel Import] Row', i, '- code column:', columnMap.code, ', raw value:', row[columnMap.code], ', parsed code:', code);
      }
      
      // Katalog raqami
      if (columnMap.catalogNumber >= 0 && row[columnMap.catalogNumber] !== undefined && row[columnMap.catalogNumber] !== null && row[columnMap.catalogNumber] !== '') {
        catalogNumber = String(row[columnMap.catalogNumber]).trim();
        console.log('[Excel Import] Row', i, '- catalogNumber column:', columnMap.catalogNumber, ', raw value:', row[columnMap.catalogNumber], ', parsed catalogNumber:', catalogNumber);
      }
      
      // Kategoriya
      if (columnMap.category >= 0 && row[columnMap.category]) {
        category = String(row[columnMap.category]).trim();
      }
      
      // Barcode ID - Yangi
      if (columnMap.barcodeId >= 0 && row[columnMap.barcodeId]) {
        barcodeId = String(row[columnMap.barcodeId]).trim().toUpperCase();
        console.log('[Excel Import] Row', i, '- barcodeId column:', columnMap.barcodeId, ', parsed barcodeId:', barcodeId);
      } else {
        console.log('[Excel Import] Row', i, '- barcodeId column:', columnMap.barcodeId, ', NO barcodeId in Excel');
      }
      
      // Foiz (%) - Yangi
      if (columnMap.multiplier >= 0 && row[columnMap.multiplier] !== undefined && row[columnMap.multiplier] !== null) {
        const parsed = parseFloat(String(row[columnMap.multiplier]).replace(/[^0-9.]/g, ''));
        if (!isNaN(parsed) && parsed >= 0) {
          multiplierValue = parsed;
        }
        console.log('[Excel Import] Row', i, '- multiplier column:', columnMap.multiplier, ', parsed multiplier:', multiplierValue);
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
      
      rows.push({ name, code, catalogNumber, price, stock, category, barcodeId, multiplier: multiplierValue });
    }

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: "Excel faylda ma'lumot topilmadi" });
    }

    console.log('[Excel Import] Parsed rows:', rows.length);

    // 4. Mahsulotlarni BIRINCHI IKKI SO'Z bo'yicha guruhlash
    const groupedMap = new Map<string, ParsedRow[]>();
    
    for (const row of rows) {
      // Birinchi IKKI so'zni olish
      const words = row.name.split(/\s+/);
      const firstTwoWords = words.slice(0, 2).join(' ').toLowerCase();
      const existing = groupedMap.get(firstTwoWords);
      if (existing) {
        existing.push(row);
      } else {
        groupedMap.set(firstTwoWords, [row]);
      }
    }

    console.log('[Excel Import] Unique products (by first TWO words):', groupedMap.size);

    // 5. Oxirgi SKU ni olish (RAQAM SIFATIDA SORT QILISH)
    const collection = db.collection(PRODUCTS_COLLECTION);
    
    // Barcha mahsulotlarni olish va raqam sifatida sort qilish
    const allProducts = await collection
      .find({ userId })
      .project({ sku: 1 })
      .toArray();
    
    let nextSku = 1;
    if (allProducts.length > 0) {
      // SKU larni raqam sifatida parse qilish va eng kattasini topish
      const skuNumbers = allProducts
        .map(p => {
          const num = parseInt(String(p.sku));
          return isNaN(num) ? 0 : num;
        })
        .filter(num => num > 0);
      
      if (skuNumbers.length > 0) {
        const maxSku = Math.max(...skuNumbers);
        nextSku = maxSku + 1;
        console.log('[Excel Import] Max SKU found:', maxSku, '-> Next SKU:', nextSku);
      }
    }

    // 6. Mahsulotlarni tayyorlash
    const productsToInsert: any[] = [];
    const errors: string[] = [];
    const multiplier = defaultMultiplier / 100;
    let globalSku = nextSku;
    
    // Saytdagi mavjud mahsulotlarni olish - variant qo'shish uchun
    const existingProducts = await collection.find({ userId }).toArray();
    console.log('[Excel Import] Existing products in DB:', existingProducts.length);
    
    let addedAsVariants = 0;
    let createdNewProducts = 0;
    let skippedDuplicates = 0;
    
    // Dublikat mahsulotlar ro'yxati
    interface DuplicateInfo {
      name: string;
      code: string;
      catalogNumber: string;
      price: number;
      stock: number;
      existingProductName: string;
      existingStock: number;
    }
    const duplicatesList: DuplicateInfo[] = [];
    
    // Dublikat tekshirish funksiyasi - KOD yoki NOM bilan
    const isDuplicate = (row: ParsedRow, product: any): boolean => {
      const rowCode = (row.code || '').toLowerCase().trim();
      const productCode = (product.code || product.sku || '').toLowerCase().trim();
      
      // 1. Agar 5 xonali kod bo'lsa - FAQAT kod bilan taqqoslash
      const is5DigitCode = /^\d{5}$/.test(rowCode);
      if (is5DigitCode && productCode) {
        return productCode === rowCode;
      }
      
      // 2. Agar 5 xonali kod bo'lmasa - NOM bilan taqqoslash
      if (!is5DigitCode) {
        const rowName = (row.name || '').toLowerCase().trim();
        const productName = (product.name || '').toLowerCase().trim();
        
        // Agar nom bo'sh bo'lmasa va mos kelsa - dublikat
        if (rowName && productName && rowName === productName) {
          return true;
        }
      }
      
      return false;
    };
    
    // Mahsulot yoki uning xillarida dublikat bormi tekshirish
    const findDuplicateInProduct = (row: ParsedRow, product: any): boolean => {
      // Asosiy mahsulotni tekshirish
      if (isDuplicate(row, product)) {
        return true;
      }
      
      // Xillarni tekshirish
      if (Array.isArray(product.variantSummaries)) {
        for (const variant of product.variantSummaries) {
          if (isDuplicate(row, variant)) {
            return true;
          }
        }
      }
      
      return false;
    };

    for (const [firstTwoWords, productRows] of groupedMap) {
      try {
        const mainRow = productRows[0];
        const productName = mainRow.name;
        
        // Birinchi IKKI so'zni olish
        const words = productName.split(/\s+/);
        const firstTwoWordsLower = words.slice(0, 2).join(' ').toLowerCase();
        
        console.log('[Excel Import] Processing:', productName, '- First two words:', firstTwoWordsLower);
        
        // Saytda shu birinchi IKKI so'z bilan mahsulot bormi tekshirish
        const existingProduct = existingProducts.find(p => {
          const existingWords = (p.name || '').split(/\s+/);
          const existingFirstTwoWords = existingWords.slice(0, 2).join(' ').toLowerCase();
          return existingFirstTwoWords === firstTwoWordsLower;
        });
        
        if (existingProduct) {
          // Mavjud mahsulotga BARCHA qatorlarni xil sifatida qo'shish
          console.log('[Excel Import] ✅ Found existing product:', existingProduct.name, '- Adding', productRows.length, 'variants');
          
          for (const row of productRows) {
            // DUBLIKAT TEKSHIRISH - BARCHA saytdagi mahsulotlarda tekshirish
            let isDuplicateInAnyProduct = false;
            let duplicateProductName = '';
            for (const existingProd of existingProducts) {
              if (findDuplicateInProduct(row, existingProd)) {
                console.log('[Excel Import] ⚠️ Skipping duplicate:', row.name, '- kod:', row.code, '- katalog:', row.catalogNumber);
                skippedDuplicates++;
                isDuplicateInAnyProduct = true;
                duplicateProductName = existingProd.name;
                
                // Dublikat ro'yxatiga qo'shish
                duplicatesList.push({
                  name: row.name,
                  code: row.code || '',
                  catalogNumber: row.catalogNumber || '',
                  price: row.price || 0,
                  stock: row.stock || 0,
                  existingProductName: duplicateProductName,
                  existingStock: existingProd.stock || 0,
                });
                break;
              }
            }
            
            if (isDuplicateInAnyProduct) {
              continue; // Bu qatorni o'tkazib yuborish
            }
            
            const variantBasePrice = row.price || 0;
            
            // Variant uchun foiz - agar Excelda bo'lsa, ishlatish
            const variantMultiplier = row.multiplier || defaultMultiplier;
            const variantMultiplierDecimal = variantMultiplier / 100;
            
            const variantSellingPrice = variantBasePrice > 0 
              ? Math.round((variantBasePrice * (1 + variantMultiplierDecimal)) * 100) / 100 
              : 0;
            
            const variantStock = row.stock !== undefined && row.stock !== null ? row.stock : defaultStock;
            const variantSku = String(globalSku);
            globalSku++;
            
            const variantCode = row.code ? String(row.code).trim() : '';
            const variantCatalog = row.catalogNumber ? String(row.catalogNumber).trim() : '';
            
            // Variant uchun barcode ID
            // MUHIM: variantSku ishlatmaslik, chunki u qisqa raqamlar
            const variantBarcodeId = row.barcodeId || ''; // Agar Excelda bo'lmasa, bo'sh qoldirish
            console.log('[Excel Import] Adding variant to existing product - Variant:', row.name, '- Excel barcodeId:', row.barcodeId, '- Final barcodeId:', variantBarcodeId);
            
            // Variant uchun kategoriya
            let variantCategoryId = categoryId;
            if (row.category) {
              const foundCategoryId = findCategoryByName(row.category);
              if (foundCategoryId) {
                variantCategoryId = foundCategoryId;
              }
            }
            
            // Mavjud mahsulotga variant qo'shish
            await collection.updateOne(
              { _id: existingProduct._id },
              {
                $push: {
                  variantSummaries: {
                    name: row.name,
                    sku: variantSku,
                    code: variantCode || null,
                    catalogNumber: variantCatalog || null,
                    barcodeId: variantBarcodeId,
                    basePrice: variantBasePrice,
                    originalPrice: variantBasePrice,
                    priceMultiplier: variantMultiplier,
                    markupPercent: variantMultiplier,
                    price: variantSellingPrice,
                    currency: defaultCurrency,
                    stock: variantStock,
                    stockCount: variantStock,
                    initialStock: variantStock,
                    status: defaultStatus,
                    categoryId: variantCategoryId,
                    description: row.category || '',
                  }
                }
              } as any
            );
            
            addedAsVariants++;
            
            // Tarixga saqlash
            try {
              const historyCollection = db.collection('product_history');
              await historyCollection.insertOne({
                userId: userId,
                type: 'variant_create',
                productId: existingProduct._id?.toString(),
                productName: row.name,
                variantName: row.name,
                parentProductName: existingProduct.name,
                sku: variantSku,
                stock: variantStock,
                addedStock: variantStock,
                price: variantSellingPrice,
                currency: defaultCurrency,
                message: `Excel orqali variant qo'shildi: ${row.name}`,
                timestamp: new Date(),
                createdAt: new Date(),
                source: 'excel-import',
              });
            } catch (historyErr) {
              console.error('[Excel Import] History save error:', historyErr);
            }
          }
          
          continue; // Keyingi guruhga o'tish
        }
        
        // Agar mavjud mahsulot topilmasa - yangi mahsulot yaratish
        // Lekin avval BARCHA saytdagi mahsulotlarda dublikat bormi tekshirish
        let isDuplicateProduct = false;
        let duplicateProductName = '';
        for (const existingProd of existingProducts) {
          if (findDuplicateInProduct(mainRow, existingProd)) {
            console.log('[Excel Import] ⚠️ Skipping duplicate product:', mainRow.name, '- kod:', mainRow.code, '- katalog:', mainRow.catalogNumber);
            skippedDuplicates++;
            isDuplicateProduct = true;
            duplicateProductName = existingProd.name;
            
            // Dublikat ro'yxatiga qo'shish
            duplicatesList.push({
              name: mainRow.name,
              code: mainRow.code || '',
              catalogNumber: mainRow.catalogNumber || '',
              price: mainRow.price || 0,
              stock: mainRow.stock || 0,
              existingProductName: duplicateProductName,
              existingStock: existingProd.stock || 0,
            });
            break;
          }
        }
        
        if (isDuplicateProduct) {
          continue; // Bu guruhni o'tkazib yuborish
        }
        
        const productSku = String(globalSku);
        globalSku++;
        
        const productCode = mainRow.code ? String(mainRow.code).trim() : '';
        const productCatalogNumber = mainRow.catalogNumber ? String(mainRow.catalogNumber).trim() : '';
        
        // Barcode ID - agar Excelda bo'lsa, ishlatish
        // MUHIM: productSku ishlatmaslik, chunki u 1, 2, 3 kabi qisqa raqamlar
        const productBarcodeId = mainRow.barcodeId || ''; // Agar Excelda bo'lmasa, bo'sh qoldirish
        console.log('[Excel Import] Product barcodeId:', productName, '- Excel barcodeId:', mainRow.barcodeId, '- Final barcodeId:', productBarcodeId);
        
        // Foiz - agar Excelda bo'lsa, ishlatish
        const productMultiplier = mainRow.multiplier || defaultMultiplier;
        const productMultiplierDecimal = productMultiplier / 100;
        
        // Kategoriya - agar Excelda nom bo'lsa, ID topish
        let productCategoryId = categoryId; // Default kategoriya
        if (mainRow.category) {
          const foundCategoryId = findCategoryByName(mainRow.category);
          if (foundCategoryId) {
            productCategoryId = foundCategoryId;
            console.log('[Excel Import] Matched category:', mainRow.category, '-> ID:', foundCategoryId);
          }
        }
        
        console.log('[Excel Import] Creating new product:', productName, '- code:', productCode, '- catalogNumber:', productCatalogNumber, '- barcodeId:', productBarcodeId, '- multiplier:', productMultiplier, '%');
        
        const productStock = mainRow.stock !== undefined && mainRow.stock !== null ? mainRow.stock : defaultStock;
        
        const basePrice = mainRow.price || 0;
        const sellingPrice = basePrice > 0 
          ? Math.round((basePrice * (1 + productMultiplierDecimal)) * 100) / 100 
          : 0;
        
        // Xillarni yaratish
        const variantSummaries: any[] = [];
        
        if (productRows.length > 1) {
          for (let i = 1; i < productRows.length; i++) {
            const variantRow = productRows[i];
            
            // Xilni ham dublikat tekshirish
            let isDuplicateVariant = false;
            let duplicateVariantProductName = '';
            for (const existingProd of existingProducts) {
              if (findDuplicateInProduct(variantRow, existingProd)) {
                console.log('[Excel Import] ⚠️ Skipping duplicate variant:', variantRow.name, '- kod:', variantRow.code, '- katalog:', variantRow.catalogNumber);
                skippedDuplicates++;
                isDuplicateVariant = true;
                duplicateVariantProductName = existingProd.name;
                
                // Dublikat ro'yxatiga qo'shish
                duplicatesList.push({
                  name: variantRow.name,
                  code: variantRow.code || '',
                  catalogNumber: variantRow.catalogNumber || '',
                  price: variantRow.price || 0,
                  stock: variantRow.stock || 0,
                  existingProductName: duplicateVariantProductName,
                  existingStock: existingProd.stock || 0,
                });
                break;
              }
            }
            
            if (isDuplicateVariant) {
              continue; // Bu xilni o'tkazib yuborish
            }
            
            const variantBasePrice = variantRow.price || basePrice;
            
            // Variant uchun foiz - agar Excelda bo'lsa, ishlatish
            const variantMultiplier = variantRow.multiplier || productMultiplier;
            const variantMultiplierDecimal = variantMultiplier / 100;
            
            const variantSellingPrice = variantBasePrice > 0 
              ? Math.round((variantBasePrice * (1 + variantMultiplierDecimal)) * 100) / 100 
              : sellingPrice;
            
            const variantStock = variantRow.stock !== undefined && variantRow.stock !== null ? variantRow.stock : defaultStock;
            
            const variantSku = String(globalSku);
            globalSku++;
            
            const variantCode = variantRow.code ? String(variantRow.code).trim() : '';
            const variantCatalogNumber = variantRow.catalogNumber ? String(variantRow.catalogNumber).trim() : '';
            
            // Variant uchun barcode ID
            // MUHIM: variantSku ishlatmaslik, chunki u qisqa raqamlar
            const variantBarcodeId = variantRow.barcodeId || ''; // Agar Excelda bo'lmasa, bo'sh qoldirish
            console.log('[Excel Import] Variant barcodeId:', variantRow.name, '- Excel barcodeId:', variantRow.barcodeId, '- Final barcodeId:', variantBarcodeId);
            
            // Variant uchun kategoriya
            let variantCategoryId = productCategoryId;
            if (variantRow.category) {
              const foundCategoryId = findCategoryByName(variantRow.category);
              if (foundCategoryId) {
                variantCategoryId = foundCategoryId;
              }
            }
            
            variantSummaries.push({
              name: variantRow.name,
              sku: variantSku,
              code: variantCode || null, // Excel dan kelgan kod
              catalogNumber: variantCatalogNumber || null, // Excel dan kelgan katalog
              barcodeId: variantBarcodeId, // Barcode ID
              basePrice: variantBasePrice,
              originalPrice: variantBasePrice,
              priceMultiplier: variantMultiplier,
              markupPercent: variantMultiplier,
              price: variantSellingPrice,
              currency: defaultCurrency,
              stock: variantStock,
              stockCount: variantStock,
              initialStock: variantStock,
              status: defaultStatus,
              categoryId: variantCategoryId,
              description: variantRow.category || '',
            });
          }
        }

        // SKU validation o'chirildi - faqat kod/nom bilan dublikat tekshiriladi

        productsToInsert.push({
          name: productName,
          sku: productSku, // Nomerofka (1, 2, 3...)
          code: productCode || null, // Excel dan kelgan kod
          catalogNumber: productCatalogNumber || null, // Excel dan kelgan katalog
          barcodeId: productBarcodeId, // Barcode ID
          basePrice: basePrice,
          originalPrice: basePrice,
          priceMultiplier: productMultiplier,
          markupPercent: productMultiplier,
          price: sellingPrice,
          currency: defaultCurrency,
          stock: productStock,
          stockCount: productStock,
          initialStock: productStock,
          status: defaultStatus,
          isHidden: false,
          description: mainRow.category || '',
          categoryId: productCategoryId,
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

    // Response message
    let message = '';
    if (addedAsVariants > 0 && createdProducts.length > 0 && skippedDuplicates > 0) {
      message = `${createdProducts.length} ta yangi mahsulot yaratildi, ${addedAsVariants} ta xil mavjud mahsulotlarga qo'shildi, ${skippedDuplicates} ta dublikat o'tkazib yuborildi`;
    } else if (addedAsVariants > 0 && createdProducts.length > 0) {
      message = `${createdProducts.length} ta yangi mahsulot yaratildi, ${addedAsVariants} ta xil mavjud mahsulotlarga qo'shildi`;
    } else if (addedAsVariants > 0 && skippedDuplicates > 0) {
      message = `${addedAsVariants} ta xil mavjud mahsulotlarga qo'shildi, ${skippedDuplicates} ta dublikat o'tkazib yuborildi`;
    } else if (addedAsVariants > 0) {
      message = `${addedAsVariants} ta xil mavjud mahsulotlarga qo'shildi`;
    } else if (skippedDuplicates > 0) {
      message = `${createdProducts.length} ta mahsulot import qilindi, ${skippedDuplicates} ta dublikat o'tkazib yuborildi`;
    } else {
      message = `${createdProducts.length} ta mahsulot import qilindi`;
    }

    return res.status(201).json({
      success: true,
      message: message,
      products: createdProducts,
      totalProducts: createdProducts.length,
      totalVariants: createdProducts.reduce((sum, p) => sum + (p.variantsCount || 0), 0),
      addedAsVariants: addedAsVariants,
      skippedDuplicates: skippedDuplicates,
      duplicatesList: duplicatesList, // Dublikat mahsulotlar ro'yxati
      errors: errors.length > 0 ? errors : undefined,
    });
    
    console.log('[Excel Import] Response - duplicatesList length:', duplicatesList.length);

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

    // Guruhlash - BIRINCHI IKKI SO'Z bo'yicha
    const groupedMap = new Map<string, { count: number; firstName: string; totalPrice: number }>();
    
    for (const row of rows) {
      // Birinchi IKKI so'zni olish
      const words = row.name.split(/\s+/);
      const firstTwoWords = words.slice(0, 2).join(' ').toLowerCase();
      const existing = groupedMap.get(firstTwoWords);
      if (existing) {
        existing.count++;
        existing.totalPrice += row.price;
      } else {
        groupedMap.set(firstTwoWords, { 
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
