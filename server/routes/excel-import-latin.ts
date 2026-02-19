import { RequestHandler } from "express";
import { 
  detectAlphabet, 
  latinToCyrillic 
} from "../utils/alphabet-converter";

// xlsx kutubxonasini import qilish
let XLSX: any = null;
try {
  XLSX = await import('xlsx');
} catch (err) {
  console.error('[Excel Import Latin] xlsx kutubxonasi yuklanmadi:', err);
}

// Sarlavha kalit so'zlari (excel-import.ts dan nusxa)
const HEADER_KEYWORDS = {
  name: ['наименование', 'название', 'номи', 'nomi', 'name', 'товар', 'mahsulot', 'product'],
  code: ['код', 'code', 'артикул'],
  catalogNumber: ['№ по каталогу', 'каталог №', 'по каталогу', 'catalog'],
  price: ['цена', 'narx', 'price', 'стоимость', 'сумма', 'итого'],
  stock: ['кол-во', 'количество', 'к-во', 'soni', 'stock', 'qty', 'остаток', 'шт'],
  category: ['категория', 'группа', 'category', 'guruh'],
};

interface ColumnMapping {
  name: number;
  code: number;
  catalogNumber: number;
  price: number;
  stock: number;
  category: number;
}

// Sarlavha qatorini topish (excel-import.ts dan nusxa)
function detectHeaderAndColumns(rawData: any[]): { 
  headerRowIndex: number; 
  headers: string[]; 
  mapping: ColumnMapping 
} {
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

  for (let i = 0; i < Math.min(rawData.length, 10); i++) {
    const row = rawData[i];
    if (!row || row.length < 2) continue;

    let foundColumns = 0;
    const tempMapping: ColumnMapping = { ...mapping };
    const usedColumns: number[] = [];

    for (let col = 0; col < row.length; col++) {
      const cellValue = row[col] ? String(row[col]).toLowerCase().trim() : '';
      if (!cellValue) continue;

      if ((cellValue.includes('каталог') || cellValue.includes('по каталогу') || cellValue.includes('catalog')) && !usedColumns.includes(col)) {
        if (tempMapping.catalogNumber === -1) {
          tempMapping.catalogNumber = col;
          usedColumns.push(col);
          foundColumns++;
        }
        continue;
      }

      if ((cellValue === 'код' || cellValue.includes('код') || cellValue === 'code' || cellValue.includes('артикул')) && !cellValue.includes('каталог') && !usedColumns.includes(col)) {
        if (tempMapping.code === -1) {
          tempMapping.code = col;
          usedColumns.push(col);
          foundColumns++;
        }
        continue;
      }

      for (const [field, keywords] of Object.entries(HEADER_KEYWORDS)) {
        if (field === 'code' || field === 'catalogNumber') continue;
        
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

    if (foundColumns >= 2) {
      headerRowIndex = i;
      headers = row.map((cell: any) => cell ? String(cell).trim() : '');
      Object.assign(mapping, tempMapping);
      break;
    }
  }

  if (headerRowIndex === -1 && rawData.length > 0) {
    headerRowIndex = 0;
    headers = rawData[0].map((cell: any) => cell ? String(cell).trim() : '');
    mapping.name = 0;
    mapping.price = 1;
  }

  return { headerRowIndex, headers, mapping };
}

/**
 * POST /api/excel-import/preview-latin
 * Excel fayldan lotin alifbosidagi mahsulotlarni aniqlash va preview ko'rsatish
 */
export const handleExcelPreviewLatin: RequestHandler = async (req, res) => {
  try {
    if (!XLSX) {
      return res.status(500).json({
        success: false,
        error: 'Excel import funksiyasi mavjud emas'
      });
    }

    const { fileData, columnMapping: userMapping } = req.body;

    if (!fileData) {
      return res.status(400).json({ success: false, error: "Excel fayl yuborilmadi" });
    }

    console.log('[Excel Latin Preview] Starting...');

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
    
    // Foydalanuvchi mapping ni ishlatish yoki avtomatik
    const columnMap: ColumnMapping = userMapping || mapping;

    console.log('[Excel Latin Preview] Column mapping:', columnMap);

    // Qatorlarni parse qilish
    interface ParsedRow {
      rowIndex: number;
      name: string;
      code: string;
      catalogNumber: string;
      price: number;
      stock: number;
      category: string;
      alphabet: 'latin' | 'cyrillic' | 'mixed' | 'unknown';
      cyrillicName: string; // Kiril variantini oldindan hisoblash
    }

    const rows: ParsedRow[] = [];
    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    const allKeywords = Object.values(HEADER_KEYWORDS).flat();

    for (let i = startRow; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length < 2) continue;

      let name = '';
      let code = '';
      let catalogNumber = '';
      let price = 0;
      let stock = 0;
      let category = '';

      // Nom
      if (columnMap.name >= 0 && row[columnMap.name]) {
        name = String(row[columnMap.name]).trim();
      }

      // Kod
      if (columnMap.code >= 0 && row[columnMap.code] !== undefined && row[columnMap.code] !== null && row[columnMap.code] !== '') {
        code = String(row[columnMap.code]).trim();
      }

      // Katalog
      if (columnMap.catalogNumber >= 0 && row[columnMap.catalogNumber] !== undefined && row[columnMap.catalogNumber] !== null && row[columnMap.catalogNumber] !== '') {
        catalogNumber = String(row[columnMap.catalogNumber]).trim();
      }

      // Kategoriya
      if (columnMap.category >= 0 && row[columnMap.category]) {
        category = String(row[columnMap.category]).trim();
      }

      // Soni
      if (columnMap.stock >= 0 && row[columnMap.stock] !== undefined && row[columnMap.stock] !== null) {
        const rawStockValue = row[columnMap.stock];
        if (typeof rawStockValue === 'number') {
          stock = Math.floor(rawStockValue);
        } else {
          const parsedStock = parseInt(String(rawStockValue).replace(/[^0-9]/g, ''));
          if (!isNaN(parsedStock) && parsedStock >= 0) {
            stock = parsedStock;
          }
        }
      }

      // Narx
      if (columnMap.price >= 0 && row[columnMap.price] !== undefined && row[columnMap.price] !== null) {
        const parsed = parseFloat(String(row[columnMap.price]).replace(/[^0-9.]/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
          price = parsed;
        }
      }

      if (!name && code) {
        name = code;
      }

      if (!name) continue;

      // Sarlavha so'zlarini o'tkazib yuborish
      const nameLower = name.toLowerCase();
      if (allKeywords.some(keyword => nameLower === keyword)) {
        continue;
      }

      // FAQAT MAHSULOT NOMINI tekshirish (kod, katalog, narx emas!)
      // Masalan: "Zadning pavarot" - faqat bu tekshiriladi
      const alphabet = detectAlphabet(name);  // ← Faqat name!
      
      // Kiril variantini oldindan hisoblash
      const cyrillicName = alphabet === 'latin' || alphabet === 'mixed' 
        ? latinToCyrillic(name)  // ← Faqat name konvertatsiya qilinadi!
        : name;

      rows.push({
        rowIndex: i,
        name,
        code,              // ← Kod o'zgartirilmaydi
        catalogNumber,     // ← Katalog o'zgartirilmaydi
        price,             // ← Narx o'zgartirilmaydi
        stock,
        category,
        alphabet,          // ← Faqat name ning alifbosi
        cyrillicName,      // ← Faqat name ning kiril varianti
      });
    }

    console.log('[Excel Latin Preview] Total rows:', rows.length);

    // Faqat lotin alifbosidagi mahsulotlarni ajratish
    const latinProducts = rows.filter(row => row.alphabet === 'latin' || row.alphabet === 'mixed');
    const cyrillicProducts = rows.filter(row => row.alphabet === 'cyrillic');
    const unknownProducts = rows.filter(row => row.alphabet === 'unknown');

    console.log('[Excel Latin Preview] Latin products:', latinProducts.length);
    console.log('[Excel Latin Preview] Cyrillic products:', cyrillicProducts.length);
    console.log('[Excel Latin Preview] Unknown products:', unknownProducts.length);

    // Statistika
    return res.json({
      success: true,
      totalRows: rows.length,
      latinCount: latinProducts.length,
      cyrillicCount: cyrillicProducts.length,
      unknownCount: unknownProducts.length,
      latinProducts: latinProducts.map(p => ({
        rowIndex: p.rowIndex,
        originalName: p.name,
        cyrillicName: p.cyrillicName,
        code: p.code,
        catalogNumber: p.catalogNumber,
        price: p.price,
        stock: p.stock,
        category: p.category,
        alphabet: p.alphabet,
      })),
      headers: headers,
      columnMapping: columnMap,
    });

  } catch (error: any) {
    console.error("[api/excel-import/preview-latin POST] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Latin preview xatosi"
    });
  }
};

/**
 * POST /api/excel-import/convert-latin-to-cyrillic
 * Tanlangan lotin mahsulotlarni kirilga o'girib import qilish
 */
export const handleConvertLatinToCyrillic: RequestHandler = async (req, res) => {
  try {
    if (!XLSX) {
      return res.status(500).json({
        success: false,
        error: 'Excel import funksiyasi mavjud emas'
      });
    }

    const { 
      fileData,
      selectedRowIndices, // Foydalanuvchi tanlagan qatorlar
      columnMapping,
    } = req.body;

    if (!fileData) {
      return res.status(400).json({ success: false, error: "Excel fayl yuborilmadi" });
    }

    if (!selectedRowIndices || !Array.isArray(selectedRowIndices)) {
      return res.status(400).json({ success: false, error: "Tanlangan mahsulotlar yo'q" });
    }

    console.log('[Excel Convert Latin] Starting conversion...');
    console.log('[Excel Convert Latin] Selected rows:', selectedRowIndices.length);

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
    const { mapping } = detectHeaderAndColumns(rawData);
    const columnMap: ColumnMapping = columnMapping || mapping;

    // Tanlangan qatorlarni konvertatsiya qilish
    const convertedData = [...rawData];
    let convertedCount = 0;

    for (const rowIndex of selectedRowIndices) {
      if (rowIndex < 0 || rowIndex >= convertedData.length) continue;
      
      const row = convertedData[rowIndex];
      if (!row) continue;

      // FAQAT MAHSULOT NOMINI konvertatsiya qilish
      // Kod, katalog, narx, kategoriya o'zgartirilmaydi!
      if (columnMap.name >= 0 && row[columnMap.name]) {
        const originalName = String(row[columnMap.name]).trim();
        const alphabet = detectAlphabet(originalName);
        
        if (alphabet === 'latin' || alphabet === 'mixed') {
          const cyrillicName = latinToCyrillic(originalName);
          
          // Faqat name ustunini o'zgartirish
          convertedData[rowIndex][columnMap.name] = cyrillicName;
          
          // Boshqa ustunlar (kod, katalog, narx) o'zgartirilmaydi!
          // convertedData[rowIndex][columnMap.code] - o'zgarmaydi
          // convertedData[rowIndex][columnMap.catalogNumber] - o'zgarmaydi
          // convertedData[rowIndex][columnMap.price] - o'zgarmaydi
          
          convertedCount++;
          
          console.log('[Excel Convert Latin] Converted:', originalName, '→', cyrillicName);
        }
      }
    }

    console.log('[Excel Convert Latin] Total converted:', convertedCount);

    // Konvertatsiya qilingan ma'lumotlarni qaytarish
    // Bu ma'lumotlar keyinchalik oddiy import endpoint ga yuboriladi
    return res.json({
      success: true,
      message: `${convertedCount} ta mahsulot kirilga o'girildi`,
      convertedCount: convertedCount,
      convertedData: convertedData, // Konvertatsiya qilingan Excel ma'lumotlari
      columnMapping: columnMap,
    });

  } catch (error: any) {
    console.error("[api/excel-import/convert-latin-to-cyrillic POST] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Konvertatsiya xatosi"
    });
  }
};
