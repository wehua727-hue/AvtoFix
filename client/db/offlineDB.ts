/**
 * OFFLINE DATABASE - IndexedDB with Dexie.js
 * 20,000+ mahsulotlar uchun optimallashtirilgan
 * 
 * Saqlanadigan ma'lumotlar:
 * - Products (mahsulotlar)
 * - Categories (kategoriyalar)
 * - Offline Sales (offline sotuvlar)
 * - Sync Queue (sinxronizatsiya navbati)
 * - Search Index (qidiruv indeksi)
 */

import Dexie, { Table } from 'dexie';

// ============================================
// INTERFACES
// ============================================

export interface OfflineVariant {
  name: string;
  sku?: string;
  customId?: string; // ✅ YANGI: Qo'lda kiritilgan ID
  barcode?: string;
  price: number;
  costPrice?: number;     // Asl narx (tan narxi) - sof foyda hisoblash uchun
  currency?: 'USD' | 'RUB' | 'CNY' | 'UZS'; // Valyuta
  stock: number;
  initialStock?: number;  // Boshlang'ich stock (qaytarish cheklovi uchun)
  imageUrl?: string;
}

// Bola mahsulot interfeysi
export interface OfflineChildProduct {
  productId: string;  // Bola mahsulot ID
  name: string;       // Bola mahsulot nomi
  autoActivate: boolean; // Ota tugaganda avtomatik faollashtirilsinmi?
}
export interface OfflineProduct {

  id: string;
  name: string;
  normalizedName: string; // Qidiruv uchun
  keywords: string[];     // Tokenized keywords
  sku?: string;
  customId?: string;      // ✅ YANGI: Qo'lda kiritilgan ID
  barcode?: string;
  price: number;
  costPrice?: number;     // Asl narx (tan narxi) - sof foyda hisoblash uchun
  currency?: 'USD' | 'RUB' | 'CNY' | 'UZS'; // Valyuta
  stock: number;
  initialStock?: number;  // Xodim qo'shgandagi boshlang'ich stock (qaytarish cheklovi uchun)
  createdByRole?: 'egasi' | 'admin' | 'xodim'; // Kim qo'shgan
  categoryId?: string;
  imageUrl?: string;
  updatedAt: number;      // Timestamp
  hash?: string;          // Delta sync uchun
  userId?: string;        // Mahsulot egasi
  variantSummaries?: OfflineVariant[]; // Mahsulot xillari
  productId?: string;     // MUHIM: Asosiy mahsulot ID (variantlar uchun) - defectiveCounts uchun
  // Ota-bola mahsulot tizimi
  parentProductId?: string; // Ota mahsulot ID (agar bu bola mahsulot bo'lsa)
  childProducts?: OfflineChildProduct[]; // Bola mahsulotlar ro'yxati
  isHidden?: boolean; // Yashirinmi? (ota mahsulot tugamaguncha ko'rinmaydi)
}

export interface OfflineCategory {
  id: string;
  name: string;
  parentId?: string;
  updatedAt: number;
  userId?: string; // Владелец категории
}

export interface OfflineSale {
  id: string;              // UUID
  recipientNumber: string; // YYYYMMDD-HHMMSS-RAND
  items: OfflineSaleItem[];
  total: number;
  discount: number;
  paymentType: string;
  saleType: 'sale' | 'refund';
  createdAt: number;
  synced: boolean;         // MongoDB ga yuborilganmi?
  syncedAt?: number;
  userId: string;
}

export interface OfflineSaleItem {
  productId: string;
  name: string;
  sku?: string;
  customId?: string; // ✅ YANGI: Custom ID
  quantity: number;
  price: number;
  costPrice?: number; // Asl narx - sof foyda hisoblash uchun
  discount: number;
}

export interface SyncMeta {
  id: string;
  key: string;
  value: string | number;
  updatedAt: number;
}

export interface SearchIndexMeta {
  id: string;
  totalProducts: number;
  lastIndexedAt: number;
  version: number;
}

// Yaroqsiz (defective) mahsulot interfeysi
export interface DefectiveProduct {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  price: number;
  reason?: string; // Sabab (ixtiyoriy)
  refundId: string; // Qaytarish ID si
  createdAt: number;
  userId: string;
}

// ============================================
// DEXIE DATABASE CLASS
// ============================================

export class OfflineKassaDB extends Dexie {
  products!: Table<OfflineProduct>;
  categories!: Table<OfflineCategory>;
  offlineSales!: Table<OfflineSale>;
  syncMeta!: Table<SyncMeta>;
  searchIndex!: Table<SearchIndexMeta>;
  defectiveProducts!: Table<DefectiveProduct>; // Yaroqsiz mahsulotlar

  constructor() {
    super('OfflineKassaDB');

    // Schema versiyasi - 2 ga oshirildi (yangi jadval uchun)
    this.version(2).stores({
      // Products - tez qidiruv uchun indekslar
      products: 'id, sku, barcode, categoryId, normalizedName, updatedAt, userId',

      // Categories
      categories: 'id, parentId, updatedAt, userId',

      // Offline Sales - synced bo'yicha filter
      offlineSales: 'id, recipientNumber, synced, createdAt, userId',

      // Sync metadata
      syncMeta: 'id, key',

      // Search index metadata
      searchIndex: 'id',

      // Yaroqsiz mahsulotlar
      defectiveProducts: 'id, productId, userId, createdAt'
    });
  }
}

// Current user ID и Phone (для фильтрации)
let currentUserId: string | null = null;
let currentUserPhone: string | null = null;

// Админ телефон - видит товары/категории без userId + свои
const ADMIN_PHONE = "910712828";

/**
 * Проверить, является ли текущий пользователь админом (по телефону)
 */
export function isAdminUser(): boolean {
  if (!currentUserPhone) return false;
  const normalized = currentUserPhone.replace(/[^\d]/g, "");
  return normalized === ADMIN_PHONE || normalized.endsWith(ADMIN_PHONE);
}

/**
 * Установить текущего пользователя
 */
export function setCurrentUserId(userId: string | null, userPhone?: string | null): void {
  currentUserId = userId;
  currentUserPhone = userPhone || null;
}

/**
 * Получить текущего пользователя
 */
export function getCurrentUserId(): string | null {
  return currentUserId;
}

// Singleton instance
export const offlineDB = new OfflineKassaDB();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Matnni normalizatsiya qilish (qidiruv uchun)
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^\w\s'-]/g, '')
    .trim();
}

/**
 * Keywordlarni ajratish
 */
export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized
    .split(/\s+/)
    .filter(word => word.length > 1);
}

/**
 * Offline receipt number generatsiya qilish
 * Format: YYYYMMDD-HHMMSS-RAND4
 */
export function generateOfflineReceiptNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${date}-${time}-${rand}`;
}

/**
 * UUID generatsiya
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================
// EAN-13 BARCODE GENERATION
// ============================================

// Barcode counter - localStorage da saqlanadi
const BARCODE_COUNTER_KEY = 'ean13_barcode_counter';
const BARCODE_PREFIX = '478'; // O'zbekiston prefiksi (478)

/**
 * EAN-13 check digit hisoblash
 * @param digits - 12 ta raqam (check digit siz)
 * @returns check digit (0-9)
 */
function calculateEAN13CheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit;
}

/**
 * Keyingi barcode counter ni olish
 */
function getNextBarcodeCounter(): number {
  const stored = localStorage.getItem(BARCODE_COUNTER_KEY);
  const counter = stored ? parseInt(stored, 10) : 0;
  const next = counter + 1;
  localStorage.setItem(BARCODE_COUNTER_KEY, String(next));
  return next;
}

/**
 * EAN-13 barcode generatsiya qilish
 * Format: 478XXXXXXXXX + check digit
 * 478 - O'zbekiston prefiksi
 * XXXXXXXXX - 9 ta raqam (counter)
 * Check digit - avtomatik hisoblanadi
 * 
 * @returns 13 ta raqamli EAN-13 barcode
 */
export function generateEAN13Barcode(): string {
  const counter = getNextBarcodeCounter();
  // 9 ta raqamga to'ldirish (478 + 9 raqam = 12 raqam)
  const counterStr = String(counter).padStart(9, '0');
  const digits12 = BARCODE_PREFIX + counterStr;
  const checkDigit = calculateEAN13CheckDigit(digits12);
  return digits12 + checkDigit;
}

/**
 * Mahsulot uchun barcode generatsiya qilish va saqlash
 * Agar mahsulotda barcode yo'q bo'lsa, yangi generatsiya qiladi
 * 
 * @param productId - mahsulot ID
 * @returns generatsiya qilingan barcode
 */
export async function generateAndSaveBarcode(productId: string): Promise<string> {
  const product = await offlineDB.products.get(productId);
  if (!product) {
    throw new Error(`Mahsulot topilmadi: ${productId}`);
  }

  // Agar barcode allaqachon bor bo'lsa, uni qaytarish
  if (product.barcode) {
    return product.barcode;
  }

  // Yangi barcode generatsiya qilish
  const barcode = generateEAN13Barcode();

  // Mahsulotni yangilash
  await offlineDB.products.update(productId, { barcode });

  console.log(`[offlineDB] Generated barcode for ${product.name}: ${barcode}`);

  return barcode;
}

/**
 * Variant uchun barcode generatsiya qilish va saqlash
 * 
 * @param productId - asosiy mahsulot ID
 * @param variantIndex - variant indeksi
 * @returns generatsiya qilingan barcode
 */
export async function generateAndSaveVariantBarcode(productId: string, variantIndex: number): Promise<string> {
  const product = await offlineDB.products.get(productId);
  if (!product) {
    throw new Error(`Mahsulot topilmadi: ${productId}`);
  }

  if (!product.variantSummaries || !product.variantSummaries[variantIndex]) {
    throw new Error(`Variant topilmadi: ${productId}[${variantIndex}]`);
  }

  const variant = product.variantSummaries[variantIndex];

  // Agar barcode allaqachon bor bo'lsa, uni qaytarish
  if (variant.barcode) {
    return variant.barcode;
  }

  // Yangi barcode generatsiya qilish
  const barcode = generateEAN13Barcode();

  // Variantni yangilash
  const updatedVariants = [...product.variantSummaries];
  updatedVariants[variantIndex] = { ...variant, barcode };

  await offlineDB.products.update(productId, { variantSummaries: updatedVariants });

  console.log(`[offlineDB] Generated barcode for variant ${variant.name}: ${barcode}`);

  return barcode;
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * IndexedDB ni tozalash (debug uchun)
 * Brauzer konsolidan chaqirish: window.clearOfflineDB()
 */
export async function clearOfflineDB(): Promise<void> {
  console.log('[offlineDB] Clearing all data...');
  await offlineDB.products.clear();
  await offlineDB.categories.clear();
  await offlineDB.syncMeta.clear();
  console.log('[offlineDB] All data cleared. Please refresh the page.');
}

/**
 * Mahsulotlarni qayta yuklash (debug uchun)
 * Brauzer konsolidan chaqirish: window.reloadProducts()
 */
export async function reloadProducts(): Promise<void> {
  console.log('[offlineDB] Reloading products from server...');
  await offlineDB.products.clear();
  await offlineDB.syncMeta.clear();
  console.log('[offlineDB] Products cleared. Please refresh the page to reload from server.');
}

/**
 * Mahsulotlarning variantlarini ko'rish (debug uchun)
 * Brauzer konsolidan chaqirish: window.showVariants()
 */
export async function showVariants(): Promise<void> {
  const products = await offlineDB.products.toArray();
  console.log(`[offlineDB] Total products: ${products.length}`);

  let variantCount = 0;
  for (const p of products) {
    if (p.variantSummaries && p.variantSummaries.length > 0) {
      console.log(`[offlineDB] Product "${p.name}" has ${p.variantSummaries.length} variants:`);
      p.variantSummaries.forEach((v, i) => {
        console.log(`  - [${i}] name="${v.name}", sku="${v.sku}", price=${v.price}, stock=${v.stock}`);
        variantCount++;
      });
    }
  }

  console.log(`[offlineDB] Total variants: ${variantCount}`);
  if (variantCount === 0) {
    console.log('[offlineDB] ⚠️ No variants found! Run window.reloadProducts() and refresh the page.');
  }
}

// Global funksiya sifatida export qilish (debug uchun)
if (typeof window !== 'undefined') {
  (window as any).clearOfflineDB = clearOfflineDB;
  (window as any).reloadProducts = reloadProducts;
  (window as any).showVariants = showVariants;
}

/**
 * Barcha mahsulotlarni olish (RAM ga yuklash uchun)
 * 
 * Админ (910712828): видит товары без userId + свои товары
 * Остальные: видят только свои товары
 * 
 * MUHIM: isHidden = true bo'lgan mahsulotlar ko'rinmaydi (ota mahsulot tugamaguncha)
 */
export async function getAllProducts(): Promise<OfflineProduct[]> {
  if (!currentUserId) {
    console.log('[OfflineDB] getAllProducts: No currentUserId, returning empty');
    return [];
  }

  try {
    const allProducts = await offlineDB.products.toArray();
    console.log('[OfflineDB] getAllProducts: Found', allProducts.length, 'products in IndexedDB');
    const isAdmin = isAdminUser();

    const filtered = allProducts.filter(p => {
      // Yashirin mahsulotlarni ko'rsatmaslik (ota mahsulot tugamaguncha)
      if (p.isHidden) return false;

      // Свои товары - всегда показываем
      if (p.userId === currentUserId) return true;
      // Товары без userId - только админу
      if (!p.userId && isAdmin) return true;
      // Остальное не показываем
      return false;
    });

    console.log('[OfflineDB] getAllProducts: Filtered to', filtered.length, 'products for user', currentUserId);
    return filtered;
  } catch (error: any) {
    console.error('[OfflineDB] getAllProducts error:', error.message || error);
    return [];
  }
}

/**
 * Barcha mahsulotlarni olish (yashirinlarni ham)
 * Admin panel uchun - barcha mahsulotlarni ko'rish
 */
export async function getAllProductsIncludingHidden(): Promise<OfflineProduct[]> {
  if (!currentUserId) {
    return [];
  }

  const allProducts = await offlineDB.products.toArray();
  const isAdmin = isAdminUser();

  return allProducts.filter(p => {
    // Свои товары - всегда показываем
    if (p.userId === currentUserId) return true;
    // Товары без userId - только админу
    if (!p.userId && isAdmin) return true;
    // Остальное не показываем
    return false;
  });
}

/**
 * Mahsulotlarni bulk insert/update
 */
export async function bulkUpsertProducts(products: OfflineProduct[]): Promise<void> {
  await offlineDB.products.bulkPut(products);
}

/**
 * O'chirilgan mahsulotlarni delete
 */
export async function deleteProducts(ids: string[]): Promise<void> {
  await offlineDB.products.bulkDelete(ids);
}

/**
 * Kategoriyalarni olish
 * 
 * Админ (910712828): видит категории без userId + свои категории
 * Остальные: видят только свои категории
 */
export async function getAllCategories(): Promise<OfflineCategory[]> {
  if (!currentUserId) {
    return [];
  }

  const allCategories = await offlineDB.categories.toArray();
  const isAdmin = isAdminUser();

  return allCategories.filter(c => {
    // Свои категории - всегда показываем
    if (c.userId === currentUserId) return true;
    // Категории без userId - только админу
    if (!c.userId && isAdmin) return true;
    // Остальное не показываем
    return false;
  });
}

/**
 * Offline sotuvni saqlash
 */
export async function saveOfflineSale(sale: OfflineSale): Promise<void> {
  await offlineDB.offlineSales.put(sale);
}

/**
 * Sync qilinmagan sotuvlarni olish
 */
export async function getUnsyncedSales(): Promise<OfflineSale[]> {
  // IndexedDB не поддерживает boolean в индексах для .equals()
  // Используем фильтрацию после получения всех записей
  const allSales = await offlineDB.offlineSales.toArray();
  return allSales.filter(sale => sale.synced === false);
}

/**
 * Sotuvni synced deb belgilash
 */
export async function markSaleAsSynced(id: string): Promise<void> {
  await offlineDB.offlineSales.update(id, {
    synced: true,
    syncedAt: Date.now()
  });
}

/**
 * Last sync timestamp olish
 */
export async function getLastSyncTime(): Promise<number> {
  const meta = await offlineDB.syncMeta.get('lastSync');
  if (!meta) return 0;

  const timestamp = Number(meta.value);
  const now = Date.now();

  // Agar timestamp noto'g'ri bo'lsa (kelajakda yoki manfiy), 0 qaytarish
  if (isNaN(timestamp) || timestamp < 0 || timestamp > now) {
    console.warn('[OfflineDB] Invalid lastSyncTime detected, resetting to 0');
    return 0;
  }

  return timestamp;
}

/**
 * Last sync timestamp saqlash
 */
export async function setLastSyncTime(timestamp: number): Promise<void> {
  const now = Date.now();

  // Timestamp validatsiya - faqat to'g'ri qiymatlarni saqlash
  const validTimestamp = (timestamp > 0 && timestamp <= now) ? timestamp : now;

  await offlineDB.syncMeta.put({
    id: 'lastSync',
    key: 'lastSync',
    value: validTimestamp,
    updatedAt: now
  });
}

/**
 * Mahsulot stock ni yangilash (sotuv yoki qaytarish uchun)
 * @param productId - Mahsulot ID
 * @param quantityChange - O'zgarish miqdori (manfiy = kamaytirish, musbat = oshirish)
 * @param variantIndex - Variant indeksi (agar variant bo'lsa)
 */
export async function updateProductStock(
  productId: string,
  quantityChange: number,
  variantIndex?: number
): Promise<void> {
  try {
    console.log(`[offlineDB] updateProductStock called: productId=${productId}, change=${quantityChange}, variantIndex=${variantIndex}`);

    const product = await offlineDB.products.get(productId);
    if (!product) {
      console.error(`[offlineDB] Product not found: ${productId}`);
      throw new Error(`Product not found: ${productId}`);
    }

    // Agar variant bo'lsa
    if (variantIndex !== undefined && product.variantSummaries) {
      const variant = product.variantSummaries[variantIndex];
      if (!variant) {
        console.error(`[offlineDB] Variant not found: ${productId}[${variantIndex}]`);
        throw new Error(`Variant not found: ${productId}[${variantIndex}]`);
      }

      const currentStock = variant.stock || 0;
      const currentInitialStock = variant.initialStock; // MUHIM: Faqat serverdan kelgan qiymat
      const newStock = Math.max(0, currentStock + quantityChange);

      // MUHIM: Qaytarishda (quantityChange > 0) initialStock ham oshadi
      let newInitialStock = currentInitialStock || 0;
      if (quantityChange > 0) {
        newInitialStock = (currentInitialStock || 0) + quantityChange;
        console.log(`[offlineDB] Variant refund detected: initialStock ${currentInitialStock} -> ${newInitialStock}`);
      }

      console.log(`[offlineDB] Variant stock: ${currentStock} -> ${newStock} (change: ${quantityChange}), initialStock: ${currentInitialStock} -> ${newInitialStock}`);

      // Yangi variantSummaries massivini yaratish (mutatsiya qilmaslik uchun)
      const updatedVariantSummaries = [...product.variantSummaries];
      updatedVariantSummaries[variantIndex] = {
        ...variant,
        stock: newStock,
        initialStock: newInitialStock
      };

      // Mahsulotni yangilash
      await offlineDB.products.update(productId, {
        variantSummaries: updatedVariantSummaries,
        updatedAt: Date.now()
      });

      console.log(`[offlineDB] Variant stock updated successfully: ${productId}[${variantIndex}] = ${newStock}, initialStock = ${newInitialStock}`);
      return;
    }

    // Oddiy mahsulot
    const currentStock = product.stock || 0;
    const currentInitialStock = product.initialStock; // MUHIM: Faqat serverdan kelgan qiymat
    const newStock = Math.max(0, currentStock + quantityChange);

    // MUHIM: Qaytarishda (quantityChange > 0) initialStock ham oshadi
    // Bu qaytarish cheklovini to'g'ri ishlashi uchun kerak
    // Sotilgan miqdor = initialStock - stock
    // Qaytarilganda: stock oshadi, initialStock ham oshadi (bir xil miqdorga)
    // Shuning uchun sotilgan miqdor o'zgarmaydi
    let newInitialStock = currentInitialStock || 0;
    if (quantityChange > 0) {
      // Qaytarish - initialStock ham oshadi
      newInitialStock = (currentInitialStock || 0) + quantityChange;
      console.log(`[offlineDB] Refund detected: initialStock ${currentInitialStock} -> ${newInitialStock}`);
    }

    console.log(`[offlineDB] Product stock: ${currentStock} -> ${newStock} (change: ${quantityChange}), initialStock: ${currentInitialStock} -> ${newInitialStock}`);

    await offlineDB.products.update(productId, {
      stock: newStock,
      initialStock: newInitialStock,
      updatedAt: Date.now()
    });

    console.log(`[offlineDB] Product stock updated successfully: ${productId} = ${newStock}, initialStock = ${newInitialStock}`);
  } catch (error) {
    console.error(`[offlineDB] Failed to update stock for ${productId}:`, error);
    throw error;
  }
}

/**
 * Faqat initialStock ni oshirish (yaroqsiz qaytarish uchun)
 * Stock o'zgarmaydi, faqat initialStock oshadi
 * Bu qaytarish cheklovini to'g'ri ishlashi uchun kerak
 * 
 * @param productId - Mahsulot ID (variant bo'lsa: "originalId-v{index}")
 * @param quantity - Qaytarilgan miqdor
 */
export async function updateInitialStockOnly(
  productId: string,
  quantity: number
): Promise<void> {
  try {
    console.log(`[offlineDB] updateInitialStockOnly: productId=${productId}, quantity=${quantity}`);

    // Variant tekshirish
    const variantMatch = productId.match(/^(.+)-v(\d+)$/);

    if (variantMatch) {
      // Variant
      const originalProductId = variantMatch[1];
      const variantIndex = parseInt(variantMatch[2], 10);

      const product = await offlineDB.products.get(originalProductId);
      if (!product || !product.variantSummaries) {
        console.error(`[offlineDB] Product or variant not found: ${productId}`);
        return;
      }

      const variant = product.variantSummaries[variantIndex];
      if (!variant) {
        console.error(`[offlineDB] Variant not found: ${productId}[${variantIndex}]`);
        return;
      }

      const currentInitialStock = variant.initialStock || 0; // MUHIM: Faqat serverdan kelgan qiymat
      const newInitialStock = currentInitialStock + quantity;

      console.log(`[offlineDB] Variant initialStock: ${currentInitialStock} -> ${newInitialStock}`);

      const updatedVariantSummaries = [...product.variantSummaries];
      updatedVariantSummaries[variantIndex] = {
        ...variant,
        initialStock: newInitialStock
      };

      await offlineDB.products.update(originalProductId, {
        variantSummaries: updatedVariantSummaries,
        updatedAt: Date.now()
      });
    } else {
      // Oddiy mahsulot
      const product = await offlineDB.products.get(productId);
      if (!product) {
        console.error(`[offlineDB] Product not found: ${productId}`);
        return;
      }

      const currentInitialStock = product.initialStock || 0; // MUHIM: Faqat serverdan kelgan qiymat
      const newInitialStock = currentInitialStock + quantity;

      console.log(`[offlineDB] Product initialStock: ${currentInitialStock} -> ${newInitialStock}`);

      await offlineDB.products.update(productId, {
        initialStock: newInitialStock,
        updatedAt: Date.now()
      });
    }

    console.log(`[offlineDB] initialStock updated successfully: ${productId}`);
  } catch (error) {
    console.error(`[offlineDB] Failed to update initialStock for ${productId}:`, error);
  }
}

/**
 * Database tozalash (test uchun)
 */
export async function clearDatabase(): Promise<void> {
  await offlineDB.products.clear();
  await offlineDB.categories.clear();
  await offlineDB.offlineSales.clear();
  await offlineDB.syncMeta.clear();
}

/**
 * Foydalanuvchi statistikasini tozalash
 * Faqat offlineSales jadvalini tozalaydi
 */
export async function clearLocalStats(userId: string): Promise<void> {
  console.log('[offlineDB] Clearing local stats for user:', userId);

  // Foydalanuvchining barcha sotuvlarini o'chirish
  const userSales = await offlineDB.offlineSales
    .where('userId')
    .equals(userId)
    .toArray();

  const idsToDelete = userSales.map(s => s.id).filter((id): id is string => id !== undefined) as string[];

  if (idsToDelete.length > 0) {
    await offlineDB.offlineSales.bulkDelete(idsToDelete);
    console.log('[offlineDB] Deleted', idsToDelete.length, 'sales records');
  }

  // localStorage dan ham tozalash
  const today = new Date().toISOString().slice(0, 10);
  localStorage.removeItem(`productSales:${today}`);

  console.log('[offlineDB] Local stats cleared successfully');
}

/**
 * Foydalanuvchi o'zgarganda boshqa foydalanuvchi ma'lumotlarini tozalash
 * ВАЖНО: Удаляет только синхронизированные данные других пользователей
 * Вызывается ТОЛЬКО когда есть интернет и все данные синхронизированы
 */
export async function clearOtherUsersData(currentUserId: string): Promise<void> {
  console.log('[OfflineDB] Clearing other users data, keeping userId:', currentUserId);

  // Проверяем несинхронизированные продажи других пользователей
  const allSales = await offlineDB.offlineSales.toArray();
  const otherUsersUnsyncedSales = allSales.filter(s =>
    s.userId &&
    s.userId !== currentUserId &&
    s.synced === false
  );

  if (otherUsersUnsyncedSales.length > 0) {
    console.error(`[OfflineDB] ОШИБКА: Найдено ${otherUsersUnsyncedSales.length} несинхронизированных продаж других пользователей!`);
    console.error('[OfflineDB] Очистка отменена для безопасности данных');
    throw new Error('Cannot clear data: unsynced sales exist');
  }

  // Boshqa foydalanuvchilarning mahsulotlarini o'chirish
  const allProducts = await offlineDB.products.toArray();
  const otherUsersProducts = allProducts.filter(p => p.userId && p.userId !== currentUserId);

  if (otherUsersProducts.length > 0) {
    const idsToDelete = otherUsersProducts.map(p => p.id);
    await offlineDB.products.bulkDelete(idsToDelete);
    console.log(`[OfflineDB] Deleted ${idsToDelete.length} products from other users`);
  }

  // Boshqa foydalanuvchilarning синхронизированных sotuvlarini o'chirish
  const otherUsersSyncedSales = allSales.filter(s =>
    s.userId &&
    s.userId !== currentUserId &&
    s.synced === true
  );

  if (otherUsersSyncedSales.length > 0) {
    const saleIdsToDelete = otherUsersSyncedSales.map(s => s.id);
    await offlineDB.offlineSales.bulkDelete(saleIdsToDelete);
    console.log(`[OfflineDB] Deleted ${saleIdsToDelete.length} synced sales from other users`);
  }

  console.log('[OfflineDB] Cleanup completed successfully');
}

/**
 * Sync metadata ni tozalash (noto'g'ri timestamp tuzatish uchun)
 */
export async function resetSyncMeta(): Promise<void> {
  await offlineDB.syncMeta.clear();
  console.log('[OfflineDB] Sync metadata reset');
}

/**
 * Database statistikasi
 */
export async function getDatabaseStats(): Promise<{
  productsCount: number;
  categoriesCount: number;
  unsyncedSalesCount: number;
  lastSyncTime: number;
}> {
  const [productsCount, categoriesCount, unsyncedSales, lastSyncTime] = await Promise.all([
    offlineDB.products.count(),
    offlineDB.categories.count(),
    getUnsyncedSales(),
    getLastSyncTime()
  ]);

  return {
    productsCount,
    categoriesCount,
    unsyncedSalesCount: unsyncedSales.length,
    lastSyncTime
  };
}

/**
 * Ota mahsulot tugaganda bola mahsulotlarni faollashtirish
 * @param parentProductId - Ota mahsulot ID
 * @returns Faollashtirilgan bola mahsulotlar soni
 */
export async function activateChildProducts(parentProductId: string): Promise<number> {
  try {
    const parentProduct = await offlineDB.products.get(parentProductId);
    if (!parentProduct) {
      console.log(`[offlineDB] Parent product not found: ${parentProductId}`);
      return 0;
    }

    // Agar ota mahsulotda hali stock bor bo'lsa, hech narsa qilmaymiz
    if ((parentProduct.stock || 0) > 0) {
      console.log(`[offlineDB] Parent product still has stock: ${parentProduct.stock}`);
      return 0;
    }

    // Bola mahsulotlar ro'yxatini olish
    const childProducts = parentProduct.childProducts || [];
    if (childProducts.length === 0) {
      console.log(`[offlineDB] No child products for: ${parentProductId}`);
      return 0;
    }

    let activatedCount = 0;

    for (const child of childProducts) {
      if (!child.autoActivate) continue;

      const childProduct = await offlineDB.products.get(child.productId);
      if (!childProduct) {
        console.log(`[offlineDB] Child product not found: ${child.productId}`);
        continue;
      }

      // Bola mahsulotni ko'rinadigan qilish
      if (childProduct.isHidden) {
        await offlineDB.products.update(child.productId, {
          isHidden: false,
          updatedAt: Date.now()
        });
        console.log(`[offlineDB] Child product activated: ${child.name} (${child.productId})`);
        activatedCount++;
      }
    }

    console.log(`[offlineDB] Activated ${activatedCount} child products for parent: ${parentProductId}`);
    return activatedCount;
  } catch (error) {
    console.error(`[offlineDB] Failed to activate child products:`, error);
    return 0;
  }
}

/**
 * Ota mahsulot tugaganda birinchi xilni mustaqil mahsulotga aylantirish
 * va qolgan xillarni unga meros qilish
 * 
 * Misol:
 * - Ota mahsulot: "Bolt" (stock: 0)
 *   - Xil 1: "Shaxruz" (stock: 20)
 *   - Xil 2: "Rol" (stock: 30)
 * 
 * Natija:
 * - Ota mahsulot o'chiriladi (yoki yashiriladi)
 * - "Shaxruz" mustaqil mahsulot bo'ladi (stock: 20)
 *   - Xil 1: "Rol" (stock: 30)
 */
export async function promoteFirstVariantToProduct(parentProductId: string): Promise<{
  promoted: boolean;
  newProductId?: string;
  deletedParentId?: string;
}> {
  try {
    const parentProduct = await offlineDB.products.get(parentProductId);
    if (!parentProduct) {
      console.log(`[offlineDB] Parent product not found: ${parentProductId}`);
      return { promoted: false };
    }

    // Xillar bormi?
    const variants = parentProduct.variantSummaries || [];
    if (variants.length === 0) {
      console.log(`[offlineDB] No variants to promote for: ${parentProductId}`);
      return { promoted: false };
    }

    // Birinchi xilni olish (bu yangi "ota" bo'ladi)
    const firstVariant = variants[0];
    const remainingVariants = variants.slice(1);

    console.log(`[offlineDB] Promoting variant "${firstVariant.name}" to product`);
    console.log(`[offlineDB] Remaining variants: ${remainingVariants.length}`);

    // Yangi mahsulot yaratish (birinchi xildan)
    const newProductId = `${parentProductId}-promoted-${Date.now()}`;
    const newProduct: OfflineProduct = {
      id: newProductId,
      name: firstVariant.name,
      normalizedName: normalizeText(firstVariant.name),
      keywords: tokenize(firstVariant.name),
      sku: firstVariant.sku || parentProduct.sku,
      barcode: firstVariant.barcode || parentProduct.barcode,
      price: firstVariant.price || parentProduct.price,
      stock: firstVariant.stock || 0,
      categoryId: parentProduct.categoryId,
      imageUrl: firstVariant.imageUrl || parentProduct.imageUrl,
      updatedAt: Date.now(),
      userId: parentProduct.userId,
      // Qolgan xillarni meros qilish
      variantSummaries: remainingVariants,
      // Ota mahsulotdan meros
      parentProductId: undefined, // Bu endi mustaqil
      childProducts: [],
      isHidden: false,
    };

    // Yangi mahsulotni saqlash
    await offlineDB.products.put(newProduct);
    console.log(`[offlineDB] New product created: ${newProductId} (${firstVariant.name})`);

    // Eski ota mahsulotni yashirish (o'chirish o'rniga)
    await offlineDB.products.update(parentProductId, {
      isHidden: true,
      updatedAt: Date.now()
    });
    console.log(`[offlineDB] Parent product hidden: ${parentProductId}`);

    return {
      promoted: true,
      newProductId,
      deletedParentId: parentProductId
    };
  } catch (error) {
    console.error(`[offlineDB] Failed to promote variant:`, error);
    return { promoted: false };
  }
}

/**
 * Mahsulot stock ni yangilash va xillarni mustaqil mahsulotga aylantirish
 * @param productId - Mahsulot ID
 * @param quantityChange - O'zgarish miqdori
 * @param variantIndex - Variant indeksi (agar variant bo'lsa)
 * @returns Yangilangan stock va promoted ma'lumotlari
 */
export async function updateProductStockWithChildActivation(
  productId: string,
  quantityChange: number,
  variantIndex?: number
): Promise<{
  newStock: number;
  activatedChildren: number;
  promoted?: boolean;
  newProductId?: string;
}> {
  // Avval stock ni yangilash
  await updateProductStock(productId, quantityChange, variantIndex);

  // Yangilangan mahsulotni olish
  const product = await offlineDB.products.get(productId);
  if (!product) {
    return { newStock: 0, activatedChildren: 0 };
  }

  let newStock: number;
  if (variantIndex !== undefined && product.variantSummaries) {
    newStock = product.variantSummaries[variantIndex]?.stock || 0;
  } else {
    newStock = product.stock || 0;
  }

  // Stock 0 bo'lsa ham mahsulot o'z joyida qoladi
  // Variant promotion yoki child activation QILINMAYDI
  // Mahsulot shunchaki "Tugagan" deb ko'rsatiladi (qizil rangda)

  return { newStock, activatedChildren: 0 };
}


// ============================================
// LOCAL STATISTICS (IndexedDB dan)
// ============================================

export interface LocalDailyStats {
  totalSales: number;
  totalRevenue: number;
  totalProfit: number; // Sof foyda
  totalOrders: number;
  topProducts: Array<{ name: string; sales: number; revenue: number; profit: number }>;
}

export interface LocalWeeklyStats {
  totalSales: number;
  totalRevenue: number;
  totalOrders: number;
  dailyData: Array<{ day: string; sales: number; revenue: number; orders: number }>;
}

/**
 * IndexedDB dan kunlik statistika olish
 */
export async function getLocalDailyStats(userId: string): Promise<LocalDailyStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();

  // Bugungi sotuvlarni olish
  const allSales = await offlineDB.offlineSales
    .where('userId')
    .equals(userId)
    .toArray();

  const todaySales = allSales.filter(
    s => s.saleType === 'sale' && s.createdAt >= todayTimestamp
  );

  // Barcha mahsulotlarni olish (costPrice ni topish uchun)
  const allProducts = await offlineDB.products.toArray();
  const productCostMap = new Map<string, number>();

  // Mahsulotlar va variantlarning costPrice ni map qilish
  // Barcha mahsulotlarni olamiz - xodim egasining mahsulotlarini ko'radi
  for (const product of allProducts) {
    productCostMap.set(product.id, product.costPrice || 0);
    productCostMap.set(product.name, product.costPrice || 0);
    // Variantlar uchun ham
    if (product.variantSummaries) {
      for (let i = 0; i < product.variantSummaries.length; i++) {
        const variant = product.variantSummaries[i];
        const variantId = `${product.id}-v${i}`;
        const variantName = `${product.name} - ${variant.name}`;
        productCostMap.set(variantId, variant.costPrice || product.costPrice || 0);
        productCostMap.set(variantName, variant.costPrice || product.costPrice || 0);
      }
    }
  }

  console.log('[Stats] ProductCostMap size:', productCostMap.size, 'for userId:', userId);
  console.log('[Stats] TodaySales count:', todaySales.length);

  // Statistikani hisoblash
  let totalSales = 0;
  let totalRevenue = 0;
  let totalProfit = 0;
  const productMap = new Map<string, { name: string; sales: number; revenue: number; profit: number }>();

  for (const sale of todaySales) {
    totalRevenue += sale.total;
    for (const item of sale.items) {
      totalSales += item.quantity;

      // Sof foyda hisoblash: (sotish narxi - asl narx) * soni
      // Agar item.costPrice yo'q bo'lsa, mahsulotning hozirgi costPrice ni ishlatamiz
      let costPrice = item.costPrice || 0;
      if (costPrice === 0) {
        // Avval productId bo'yicha, keyin name bo'yicha qidirish
        costPrice = productCostMap.get(item.productId) || productCostMap.get(item.name) || 0;
      }
      // Agar hali ham 0 bo'lsa, narxning 70% ini asl narx deb hisoblaymiz (default 30% foyda)
      if (costPrice === 0 && item.price > 0) {
        costPrice = Math.round(item.price * 0.7);
      }

      const itemProfit = (item.price - costPrice) * item.quantity;
      totalProfit += itemProfit;

      const existing = productMap.get(item.name) || { name: item.name, sales: 0, revenue: 0, profit: 0 };
      existing.sales += item.quantity;
      existing.revenue += item.quantity * item.price;
      existing.profit += itemProfit;
      productMap.set(item.name, existing);
    }
  }

  // Top 5 mahsulotlar
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  return {
    totalSales,
    totalRevenue,
    totalProfit,
    totalOrders: todaySales.length,
    topProducts
  };
}

/**
 * IndexedDB dan haftalik statistika olish
 */
export async function getLocalWeeklyStats(userId: string): Promise<LocalWeeklyStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartTimestamp = weekStart.getTime();

  // Haftalik sotuvlarni olish
  const allSales = await offlineDB.offlineSales
    .where('userId')
    .equals(userId)
    .toArray();

  const weeklySales = allSales.filter(
    s => s.saleType === 'sale' && s.createdAt >= weekStartTimestamp
  );

  // Kunlik ma'lumotlarni hisoblash
  const weekDaysShort = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
  const dailyMap = new Map<string, { sales: number; revenue: number; orders: number }>();

  // 7 kunni initsializatsiya qilish
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    dailyMap.set(dateStr, { sales: 0, revenue: 0, orders: 0 });
  }

  // Sotuvlarni kunlarga bo'lish
  for (const sale of weeklySales) {
    const saleDate = new Date(sale.createdAt);
    const dateStr = saleDate.toISOString().slice(0, 10);

    const dayData = dailyMap.get(dateStr);
    if (dayData) {
      dayData.orders += 1;
      dayData.revenue += sale.total;
      for (const item of sale.items) {
        dayData.sales += item.quantity;
      }
    }
  }

  // dailyData massivini yaratish
  const dailyData: Array<{ day: string; sales: number; revenue: number; orders: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayName = weekDaysShort[d.getDay()];
    const data = dailyMap.get(dateStr) || { sales: 0, revenue: 0, orders: 0 };

    dailyData.push({
      day: dayName,
      sales: data.sales,
      revenue: data.revenue,
      orders: data.orders
    });
  }

  // Jami hisoblash
  const totals = dailyData.reduce(
    (acc, d) => {
      acc.totalSales += d.sales;
      acc.totalRevenue += d.revenue;
      acc.totalOrders += d.orders;
      return acc;
    },
    { totalSales: 0, totalRevenue: 0, totalOrders: 0 }
  );

  return {
    ...totals,
    dailyData
  };
}


// ============================================
// YAROQSIZ MAHSULOTLAR (DEFECTIVE PRODUCTS)
// ============================================

/**
 * Yaroqsiz mahsulotni saqlash
 * Qaytarilgan mahsulot yaroqsiz bo'lsa, bu jadvalga qo'shiladi
 */
export async function saveDefectiveProduct(defective: DefectiveProduct): Promise<void> {
  await offlineDB.defectiveProducts.put(defective);
  console.log('[offlineDB] Defective product saved:', defective.productName);
}

/**
 * Foydalanuvchining yaroqsiz mahsulotlarini olish
 */
export async function getDefectiveProducts(userId: string): Promise<DefectiveProduct[]> {
  return await offlineDB.defectiveProducts
    .where('userId')
    .equals(userId)
    .reverse()
    .sortBy('createdAt');
}

/**
 * Yaroqsiz mahsulotni o'chirish
 */
export async function deleteDefectiveProduct(id: string): Promise<void> {
  await offlineDB.defectiveProducts.delete(id);
}

/**
 * Barcha yaroqsiz mahsulotlarni tozalash (foydalanuvchi uchun)
 */
export async function clearDefectiveProducts(userId: string): Promise<void> {
  const items = await offlineDB.defectiveProducts
    .where('userId')
    .equals(userId)
    .toArray();

  const ids = items.map(i => i.id);
  if (ids.length > 0) {
    await offlineDB.defectiveProducts.bulkDelete(ids);
    console.log('[offlineDB] Cleared', ids.length, 'defective products');
  }
}

/**
 * Mahsulot uchun yaroqsiz qaytarilgan sonni olish
 * @param productId - Mahsulot ID
 * @param userId - Foydalanuvchi ID
 * @returns Yaroqsiz qaytarilgan umumiy son
 */
export async function getDefectiveCountByProduct(productId: string, userId: string): Promise<number> {
  const items = await offlineDB.defectiveProducts
    .where('productId')
    .equals(productId)
    .filter(item => item.userId === userId)
    .toArray();

  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Barcha mahsulotlar uchun yaroqsiz qaytarilgan sonlarni olish
 * @param userId - Foydalanuvchi ID
 * @returns Map<productId, defectiveCount>
 */
export async function getAllDefectiveCounts(userId: string): Promise<Map<string, number>> {
  const items = await offlineDB.defectiveProducts
    .where('userId')
    .equals(userId)
    .toArray();

  const counts = new Map<string, number>();
  for (const item of items) {
    const current = counts.get(item.productId) || 0;
    counts.set(item.productId, current + item.quantity);
  }

  return counts;
}
