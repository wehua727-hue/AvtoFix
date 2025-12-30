/**
 * OFFLINE KASSA HOOK
 * To'liq offline rejimda ishlaydigan kassa
 * 
 * Xususiyatlar:
 * - Offline product search
 * - Offline cart management
 * - Offline sale saving
 * - Auto-sync when online
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  OfflineProduct,
  OfflineSale,
  generateOfflineReceiptNumber,
  generateUUID,
  normalizeText,
  tokenize,
} from '../db/offlineDB';
import { searchEngine, SearchResult, SearchOptions } from '../services/searchEngine';

// ============================================
// TYPES
// ============================================

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  barcode?: string; // Barcode - scanner uchun
  price: number;
  costPrice?: number; // Asl narx - sof foyda hisoblash uchun
  currency?: 'USD' | 'RUB' | 'CNY' | 'UZS'; // Valyuta
  quantity: number;
  discount: number;
  stock: number; // Ombordagi soni
  initialStock?: number; // Xodim qo'shgandagi boshlang'ich stock (qaytarish cheklovi uchun)
  createdByRole?: 'egasi' | 'admin' | 'xodim'; // Kim qo'shgan
}

export interface KassaState {
  // Cart
  items: CartItem[];
  total: number;
  discount: number;
  
  // Search
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  
  // Status
  isOnline: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  pendingSalesCount: number;
  productsCount: number;
  lastSyncTime: number;
  
  // Error
  error: string | null;
}

export interface UseOfflineKassaReturn extends KassaState {
  // Cart actions
  addToCart: (product: OfflineProduct, isRefundMode?: boolean) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number, allowDelete?: boolean, isRefundMode?: boolean) => void;
  updateDiscount: (itemId: string, discount: number) => void;
  clearCart: () => void;
  
  // Search actions
  search: (query: string, options?: SearchOptions) => void;
  searchByBarcode: (barcode: string) => OfflineProduct | undefined;
  searchBySku: (sku: string) => OfflineProduct | undefined;
  searchBySkuWithVariant: (sku: string) => { product: OfflineProduct; variantIndex?: number } | undefined;
  
  // Sale actions
  completeSale: (paymentType: string, saleType?: 'sale' | 'refund') => Promise<OfflineSale | null>;
  
  // Sync actions
  triggerSync: () => Promise<boolean>;
  reloadProducts: () => Promise<void>;
  forceRefreshCache: () => Promise<void>; // YANGI: Majburiy cache yangilash
  
  // Utils
  getProduct: (id: string) => OfflineProduct | undefined;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useOfflineKassa(userId: string, userPhone?: string, defectiveCounts?: Map<string, number>): UseOfflineKassaReturn {
  // State
  const [items, setItems] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // CACHE NI OLIB TASHLADIK - FAQAT REAL-TIME MongoDB
  // const productsRef = useRef<Map<string, OfflineProduct>>(new Map());
  
  // Search debounce
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // INITIALIZATION
  // ============================================

  // API base URL
  const apiBaseUrl = (() => {
    if (typeof window === 'undefined') return '';
    // Electron da file:// protokoli ishlatiladi - port 5175
    if (window.location.protocol === 'file:') return 'http://127.0.0.1:5175';
    const envApiUrl = (import.meta as any).env?.VITE_API_BASE_URL;
    if (envApiUrl && !envApiUrl.includes('YOUR_PUBLIC_IP')) {
      return envApiUrl.replace(/\/$/, '');
    }
    return '';
  })();

  // API base URL
  const apiBaseUrl = (() => {
    if (typeof window === 'undefined') return '';
    // Electron da file:// protokoli ishlatiladi - port 5175
    if (window.location.protocol === 'file:') return 'http://127.0.0.1:5175';
    const envApiUrl = (import.meta as any).env?.VITE_API_BASE_URL;
    if (envApiUrl && !envApiUrl.includes('YOUR_PUBLIC_IP')) {
      return envApiUrl.replace(/\/$/, '');
    }
    return '';
  })();

  // REAL-TIME MongoDB dan ma'lumot olish funksiyasi
  const fetchProductsFromMongoDB = useCallback(async (): Promise<OfflineProduct[]> => {
    if (!navigator.onLine) {
      throw new Error('Internet aloqasi yo\'q');
    }
    
    try {
      const url = `${apiBaseUrl}/api/products?userId=${userId}&userPhone=${userPhone || ''}&limit=50000&_t=${Date.now()}`;
      console.log('[useOfflineKassa] Fetching fresh data from MongoDB:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const serverProducts = Array.isArray(data) ? data : data.products || [];
        console.log('[useOfflineKassa] Fresh products from MongoDB:', serverProducts.length);
        
        // Format products
        const formattedProducts: OfflineProduct[] = serverProducts.map((p: any) => {
          const calculatedCostPrice = p.costPrice || p.cost || p.basePrice || Math.round((p.price || 0) * 0.7);
          return {
            id: p._id || p.id,
            name: p.name,
            normalizedName: normalizeText(p.name),
            keywords: tokenize(p.name),
            sku: p.sku !== undefined && p.sku !== null ? String(p.sku) : undefined,
            barcode: p.barcode !== undefined && p.barcode !== null ? String(p.barcode) : undefined,
            price: p.price || 0,
            costPrice: calculatedCostPrice,
            currency: p.currency || 'UZS',
            stock: p.stock ?? 0, // MUHIM: Fresh stock ma'lumoti
            initialStock: p.initialStock, // MUHIM: Faqat serverdan kelgan qiymat
            createdByRole: p.createdByRole,
            categoryId: p.categoryId,
            imageUrl: p.imageUrl,
            userId: p.userId,
            updatedAt: Date.now(),
            parentProductId: p.parentProductId || undefined,
            childProducts: Array.isArray(p.childProducts) ? p.childProducts : [],
            isHidden: p.isHidden || false,
            variantSummaries: Array.isArray(p.variantSummaries) ? p.variantSummaries.map((v: any) => ({
              name: v.name,
              sku: v.sku !== undefined && v.sku !== null ? String(v.sku) : undefined,
              barcode: v.barcode !== undefined && v.barcode !== null ? String(v.barcode) : undefined,
              price: v.price || v.basePrice || p.price || 0,
              costPrice: v.costPrice || v.cost || v.basePrice || Math.round((v.price || v.basePrice || p.price || 0) * 0.7),
              currency: v.currency || p.currency || 'UZS',
              stock: v.stock ?? 0, // MUHIM: Fresh variant stock
              initialStock: v.initialStock, // MUHIM: Faqat serverdan kelgan qiymat
              imageUrl: v.imageUrl || v.images?.[0]
            })) : []
          };
        });
        
        return formattedProducts;
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (err) {
      console.error('[useOfflineKassa] Failed to fetch from MongoDB:', err);
      throw err;
    }
  }, [userId, userPhone, apiBaseUrl]);

  // ============================================
  // CART CALCULATIONS
  // ============================================

  const total = items.reduce((sum, item) => {
    const itemTotal = item.quantity * item.price;
    const discountAmount = (itemTotal * item.discount) / 100;
    return sum + (itemTotal - discountAmount);
  }, 0);

  const totalDiscount = items.reduce((sum, item) => {
    const itemTotal = item.quantity * item.price;
    return sum + (itemTotal * item.discount) / 100;
  }, 0);

  // ============================================
  // CART ACTIONS
  // ============================================

  const addToCart = useCallback((product: OfflineProduct, isRefundMode: boolean = false) => {
    console.log('[useOfflineKassa] addToCart called:', product.name, 'id:', product.id, 'isRefundMode:', isRefundMode);
    
    // MUHIM: Eng yangi ma'lumotlarni cache dan olish
    const freshProduct = productsRef.current.get(product.id) || product;
    console.log('[useOfflineKassa] Using fresh product data:', {
      name: freshProduct.name,
      stock: freshProduct.stock,
      initialStock: freshProduct.initialStock
    });
    
    setItems(prev => {
      console.log('[useOfflineKassa] Current items count:', prev.length);
      const existingIndex = prev.findIndex(item => item.productId === freshProduct.id);
      
      if (existingIndex >= 0) {
        // Increment quantity - stock tekshirish (faqat sotish rejimida)
        const existingItem = prev[existingIndex];
        const newQuantity = existingItem.quantity + 1;
        
        // MUHIM: Fresh stock ma'lumotlarini ishlatish
        const currentStock = freshProduct.stock ?? 0;
        
        // Agar miqdor stock dan oshsa, xato ko'rsatish (faqat sotish rejimida)
        if (!isRefundMode && newQuantity > currentStock) {
          window.dispatchEvent(new CustomEvent('stock-exceeded', { 
            detail: { name: existingItem.name, stock: currentStock, requested: newQuantity } 
          }));
        }
        
        console.log('[useOfflineKassa] Incrementing existing item quantity');
        const updated = [...prev];
        updated[existingIndex].quantity = newQuantity;
        // MUHIM: Stock ma'lumotlarini yangilash
        updated[existingIndex].stock = currentStock;
        updated[existingIndex].initialStock = freshProduct.initialStock;
        console.log('[useOfflineKassa] Updated item with fresh stock:', updated[existingIndex]);
        return updated;
      }
      
      // Add new item with fresh stock info
      const newItem = {
        id: generateUUID(),
        productId: freshProduct.id,
        name: freshProduct.name || 'Nomsiz mahsulot',
        sku: freshProduct.sku,
        barcode: freshProduct.barcode, // Barcode - scanner uchun
        price: freshProduct.price || 0,
        costPrice: freshProduct.costPrice || 0, // Asl narx - sof foyda hisoblash uchun
        currency: freshProduct.currency || 'UZS', // Valyuta
        quantity: 1, // MUHIM: Mahsulot qo'shilganda 1 ta bo'ladi (eski 0 emas)
        discount: 0,
        stock: freshProduct.stock ?? 0, // MUHIM: Fresh stock ma'lumoti
        initialStock: freshProduct.initialStock, // MUHIM: Fresh initialStock ma'lumoti
        createdByRole: freshProduct.createdByRole // Kim qo'shgan
      };
      console.log('[useOfflineKassa] Adding new item with fresh data:', newItem);
      const newItems = [...prev, newItem];
      console.log('[useOfflineKassa] New items count:', newItems.length);
      return newItems;
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number, allowDelete = false, isRefundMode: boolean = false) => {
    setItems(prev => {
      // Если количество меньше 0 и разрешено удаление - удаляем товар
      if (quantity < 0 && allowDelete) {
        return prev.filter(item => item.id !== itemId);
      }
      
      // Минимальное количество - 0 (foydalanuvchi o'zi kiritadi)
      const safeQuantity = Math.max(0, quantity);
      
      return prev.map(item => {
        if (item.id === itemId) {
          // SOTISH REJIMIDA: Stock tekshirish
          if (!isRefundMode && safeQuantity > item.stock) {
            // Toast xabarini ko'rsatish uchun window event ishlatamiz
            window.dispatchEvent(new CustomEvent('stock-exceeded', { 
              detail: { name: item.name, stock: item.stock, requested: safeQuantity } 
            }));
          }
          
          // QAYTARISH REJIMIDA: Qaytarish cheklovi tekshirish
          if (isRefundMode && defectiveCounts) {
            const currentStock = item.stock ?? 0;
            const currentInitialStock = item.initialStock; // MUHIM: Faqat serverdan kelgan qiymat
            
            if (currentInitialStock > 0) {
              // Yaroqsiz qaytarilgan sonni olish
              const defectiveCount = defectiveCounts.get(item.productId) || 0;
              // Sotilgan miqdor = boshlang'ich - hozirgi ombordagi
              const soldQuantity = currentInitialStock - currentStock;
              // Maksimal qaytarish = sotilgan - yaroqsiz qaytarilgan
              const maxReturn = soldQuantity - defectiveCount;
              
              if (safeQuantity > maxReturn) {
                // Qaytarish cheklovi xabari
                window.dispatchEvent(new CustomEvent('refund-limit-exceeded', { 
                  detail: { 
                    name: item.name, 
                    maxReturn: Math.max(0, maxReturn),
                    requested: safeQuantity,
                    soldQuantity,
                    defectiveCount,
                    initialStock: currentInitialStock
                  } 
                }));
              }
            }
          }
          
          return { ...item, quantity: safeQuantity };
        }
        return item;
      });
    });
  }, [defectiveCounts]);

  const updateDiscount = useCallback((itemId: string, discount: number) => {
    if (discount < 0 || discount > 100) return;
    
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, discount } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  // ============================================
  // SEARCH ACTIONS
  // ============================================

  const search = useCallback((query: string, options?: SearchOptions) => {
    setSearchQuery(query);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Agar query bo'sh bo'lsa, barcha mahsulotlar VA xillarni ko'rsatish
    if (!query || query.length < 1) {
      const allProducts = Array.from(productsRef.current.values());
      const results: SearchResult[] = [];
      
      console.log('[useOfflineKassa] Empty search - total products in RAM cache:', allProducts.length);
      
      // Agar mahsulotlar yo'q bo'lsa, bo'sh natija qaytarish
      if (allProducts.length === 0) {
        console.log('[useOfflineKassa] No products in RAM cache, returning empty results');
        setSearchResults([]);
        return;
      }
      
      // Birinchi 5 ta mahsulotni debug uchun ko'rsatish
      console.log('[useOfflineKassa] First 5 products in cache:', allProducts.slice(0, 5).map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        hasName: !!p.name,
        nameLength: p.name?.length || 0
      })));
      
      for (const product of allProducts.slice(0, 100)) {
        const mainStock = product.stock ?? 0;
        
        // Asosiy mahsulotni qo'shish (agar stock > 0 yoki xillar yo'q bo'lsa)
        if (mainStock > 0 || !product.variantSummaries || product.variantSummaries.length === 0) {
          console.log('[useOfflineKassa] Adding main product to results:', { 
            id: product.id, 
            name: product.name, 
            sku: product.sku, 
            stock: mainStock,
            nameLength: product.name?.length || 0,
            nameType: typeof product.name
          });
          results.push({
            product,
            score: 100,
            matchType: 'exact' as const,
            isVariant: false,
            displayName: product.name || `Mahsulot ${product.sku || product.id}`,
            displaySku: product.sku,
            displayPrice: product.price,
            displayStock: mainStock // MUHIM: Fresh stock ma'lumoti
          });
        }
        
        // Barcha xillarni ham qo'shish
        // MUHIM: Har bir variant o'z stockini ko'rsatadi
        if (product.variantSummaries && product.variantSummaries.length > 0) {
          for (let i = 0; i < product.variantSummaries.length; i++) {
            const variant = product.variantSummaries[i];
            console.log('[useOfflineKassa] Adding variant to results:', { 
              index: i,
              name: variant.name, 
              sku: variant.sku, 
              stock: variant.stock, 
              parentName: product.name,
              nameLength: variant.name?.length || 0,
              nameType: typeof variant.name
            });
            
            results.push({
              product,
              score: 99, // Xillar asosiy mahsulotdan keyin
              matchType: 'variant' as const,
              variant,
              variantIndex: i,
              isVariant: true,
              displayName: variant.name || `Xil ${variant.sku || i + 1}`,
              displaySku: variant.sku || product.sku,
              displayPrice: variant.price || product.price,
              displayStock: variant.stock ?? 0, // MUHIM: VARIANTNING O'Z FRESH STOCKI
              parentProductName: product.name || `Mahsulot ${product.sku || product.id}`
            });
          }
        }
      }
      
      setSearchResults(results);
      return;
    }
    
    // Debounce search (50ms)
    searchTimeoutRef.current = setTimeout(() => {
      setIsSearching(true);
      
      const results = searchEngine.search(query, options);
      setSearchResults(results);
      
      setIsSearching(false);
    }, 50);
  }, []);

  const searchByBarcode = useCallback((barcode: string): OfflineProduct | undefined => {
    return searchEngine.findByBarcode(barcode);
  }, []);

  const searchBySku = useCallback((sku: string): OfflineProduct | undefined => {
    return searchEngine.findBySku(sku);
  }, []);

  // Variant SKU, barcode va nom bo'yicha qidiruv
  // MUHIM: Faqat TO'LIQ MOSLIK - numpad orqali qidirish uchun
  const searchBySkuWithVariant = useCallback((code: string): { product: OfflineProduct; variantIndex?: number } | undefined => {
    const normalizedCode = code.toLowerCase().trim();
    
    // 1. SearchEngine orqali qidirish (eng tez va to'liq)
    const engineResult = searchEngine.findByCodeWithVariant(code);
    if (engineResult) {
      // MUHIM: Fresh ma'lumotlarni cache dan olish
      const freshProduct = productsRef.current.get(engineResult.product.id) || engineResult.product;
      
      // DEBUG: Mahsulot ma'lumotlarini chiqarish
      console.log('[DEBUG] Found product:', freshProduct.name);
      console.log('[DEBUG] Product stock (fresh):', freshProduct.stock);
      console.log('[DEBUG] Original engine result stock:', engineResult.product.stock);
      console.log('[DEBUG] Variant index:', engineResult.variantIndex);
      if (engineResult.variantIndex !== undefined && freshProduct.variantSummaries) {
        console.log('[DEBUG] Variant stock:', freshProduct.variantSummaries[engineResult.variantIndex]?.stock);
        console.log('[DEBUG] All variants:', freshProduct.variantSummaries.map(v => ({ name: v.name, stock: v.stock })));
      }
      
      // MUHIM: Stock prioriteti - agar asosiy mahsulot stock=0 bo'lsa, variantlarni tekshirish
      if (engineResult.variantIndex === undefined && freshProduct.stock === 0) {
        console.log('[DEBUG] Main product has no stock, checking variants...');
        // Variantlarda stock bor-yo'qligini tekshirish
        if (freshProduct.variantSummaries && freshProduct.variantSummaries.length > 0) {
          for (let i = 0; i < freshProduct.variantSummaries.length; i++) {
            const variant = freshProduct.variantSummaries[i];
            if (variant.stock > 0) {
              console.log('[DEBUG] Found variant with stock:', variant.name, 'stock:', variant.stock);
              return { product: freshProduct, variantIndex: i };
            }
          }
        }
      }
      
      return { product: freshProduct, variantIndex: engineResult.variantIndex };
    }
    
    // 2. Qo'shimcha: RAM dan to'g'ridan-to'g'ri qidirish (backup)
    // Faqat TO'LIQ MOSLIK - qisman moslik yo'q!
    
    // Variant SKU/barcode ni tekshirish
    for (const product of productsRef.current.values()) {
      if (product.variantSummaries && product.variantSummaries.length > 0) {
        for (let i = 0; i < product.variantSummaries.length; i++) {
          const variant = product.variantSummaries[i];
          const variantSku = variant.sku?.toLowerCase().trim();
          const variantBarcode = variant.barcode?.toLowerCase().trim();
          
          // To'liq moslik
          if (variantSku === normalizedCode || variantBarcode === normalizedCode) {
            return { product, variantIndex: i };
          }
          
          // Raqamli moslik (masalan: "6" -> "06", "006" yoki "006" -> "6")
          if (variantSku && /^\d+$/.test(normalizedCode) && /^\d+$/.test(variantSku)) {
            const codeNum = normalizedCode.replace(/^0+/, '') || '0';
            const skuNum = variantSku.replace(/^0+/, '') || '0';
            if (codeNum === skuNum) {
              return { product, variantIndex: i };
            }
          }
        }
      }
    }
    
    // 3. Asosiy mahsulot SKU/barcode ni tekshirish - STOCK PRIORITETI bilan
    for (const product of productsRef.current.values()) {
      const productSku = product.sku?.toLowerCase().trim();
      const productBarcode = product.barcode?.toLowerCase().trim();
      
      // To'liq moslik
      if (productSku === normalizedCode || productBarcode === normalizedCode) {
        // MUHIM: Agar asosiy mahsulot stock=0 bo'lsa, variantlarni tekshirish
        if (product.stock === 0 && product.variantSummaries && product.variantSummaries.length > 0) {
          console.log('[DEBUG] Main product has no stock, checking variants for stock...');
          for (let i = 0; i < product.variantSummaries.length; i++) {
            const variant = product.variantSummaries[i];
            if (variant.stock > 0) {
              console.log('[DEBUG] Found variant with stock:', variant.name, 'stock:', variant.stock);
              return { product, variantIndex: i };
            }
          }
        }
        return { product, variantIndex: undefined };
      }
      
      // Raqamli moslik
      if (productSku && /^\d+$/.test(normalizedCode) && /^\d+$/.test(productSku)) {
        const codeNum = normalizedCode.replace(/^0+/, '') || '0';
        const skuNum = productSku.replace(/^0+/, '') || '0';
        if (codeNum === skuNum) {
          // MUHIM: Agar asosiy mahsulot stock=0 bo'lsa, variantlarni tekshirish
          if (product.stock === 0 && product.variantSummaries && product.variantSummaries.length > 0) {
            console.log('[DEBUG] Main product has no stock, checking variants for stock...');
            for (let i = 0; i < product.variantSummaries.length; i++) {
              const variant = product.variantSummaries[i];
              if (variant.stock > 0) {
                console.log('[DEBUG] Found variant with stock:', variant.name, 'stock:', variant.stock);
                return { product, variantIndex: i };
              }
            }
          }
          return { product, variantIndex: undefined };
        }
      }
    }
    
    return undefined;
  }, []);

  // ============================================
  // SALE ACTIONS
  // ============================================

  const completeSale = useCallback(async (
    paymentType: string,
    saleType: 'sale' | 'refund' = 'sale'
  ): Promise<OfflineSale | null> => {
    if (items.length === 0) return null;

    try {
      // Create offline sale
      const sale: OfflineSale = {
        id: generateUUID(),
        recipientNumber: generateOfflineReceiptNumber(),
        items: items.map(item => ({
          productId: item.productId,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          price: item.price,
          costPrice: item.costPrice || 0, // Asl narx - sof foyda uchun
          discount: item.discount
        })),
        total,
        discount: totalDiscount,
        paymentType,
        saleType,
        createdAt: Date.now(),
        synced: false,
        userId
      };

      // Update stock for each item BEFORE saving sale
      // quantityChange: negative for sale (decrease), positive for refund (increase)
      const quantityChange = saleType === 'sale' ? -1 : 1;
      
      console.log(`[useOfflineKassa] completeSale called with ${items.length} items, saleType: ${saleType}, quantityChange: ${quantityChange}`);
      console.log(`[useOfflineKassa] Items in cart:`, items.map(i => ({ productId: i.productId, name: i.name, quantity: i.quantity, stock: i.stock })));
      console.log(`[useOfflineKassa] IMPORTANT: saleType=${saleType}, so stock should ${saleType === 'refund' ? 'INCREASE' : 'DECREASE'}`);
      console.log(`[useOfflineKassa] API base URL:`, apiBaseUrl);
      console.log(`[useOfflineKassa] Navigator online:`, navigator.onLine);
      console.log(`[useOfflineKassa] ⚠️  DEBUGGING: If you see 2x stock decrease, check for duplicate event listeners!`);
      console.log(`[useOfflineKassa] 🔍 USER INFO: userId=${userId}, userPhone=${userPhone || 'N/A'}`);
      console.log(`[useOfflineKassa] 🔍 USER ROLE: Check if user has permission to update stock`);
      
      // MUHIM: Stock yangilash to'g'ridan-to'g'ri API orqali amalga oshiriladi
      console.log(`[useOfflineKassa] ⚠️  Stock update will be handled by direct API calls!`);
      console.log(`[useOfflineKassa] Items to be processed:`, items.map(i => ({ 
        productId: i.productId, 
        name: i.name, 
        quantity: i.quantity, 
        expectedChange: i.quantity * quantityChange 
      })));

      // Update productSales in localStorage for today's sales count
      // Bu Products sahifasida "X sotildi" ko'rsatish uchun
      try {
        const today = new Date().toISOString().slice(0, 10);
        const salesKey = `productSales:${today}`;
        const existingSales: Record<string, number> = JSON.parse(localStorage.getItem(salesKey) || '{}');
        
        for (const item of items) {
          // Variant bo'lsa, asosiy mahsulot ID sini olish
          const variantMatch = item.productId.match(/^(.+)-v(\d+)$/);
          const productId = variantMatch ? variantMatch[1] : item.productId;
          
          // Sotish bo'lsa qo'shish, qaytarish bo'lsa ayirish
          const change = saleType === 'sale' ? item.quantity : -item.quantity;
          existingSales[productId] = (existingSales[productId] || 0) + change;
          
          // Manfiy bo'lib qolmasin
          if (existingSales[productId] < 0) {
            existingSales[productId] = 0;
          }
        }
        
        localStorage.setItem(salesKey, JSON.stringify(existingSales));
        console.log(`[useOfflineKassa] Updated productSales in localStorage:`, existingSales);
      } catch (e) {
        console.error('[useOfflineKassa] Failed to update productSales in localStorage:', e);
      }

      // ONLINE: Faqat MongoDB ga saqlash
      if (isOnline) {
        console.log(`[useOfflineKassa] ONLINE - Updating stock first, then saving sale...`);
        
        try {
          // 1. BIRINCHI: Stock yangilash (har bir mahsulot uchun)
          console.log(`[useOfflineKassa] Step 1: Updating stock for ${items.length} items...`);
          
          for (const item of items) {
            const stockChange = saleType === 'sale' ? -item.quantity : item.quantity;
            console.log(`[useOfflineKassa] Updating stock: ${item.name}, change: ${stockChange}, productId: ${item.productId}`);
            
            // Variant tekshirish
            const variantMatch = item.productId.match(/^(.+)-v(\d+)$/);
            let productId = item.productId;
            let variantIndex: number | undefined = undefined;
            
            if (variantMatch) {
              productId = variantMatch[1];
              variantIndex = parseInt(variantMatch[2], 10);
              console.log(`[useOfflineKassa] Variant detected: productId=${productId}, variantIndex=${variantIndex}`);
            }
            
            console.log(`[useOfflineKassa] Making API call to: ${apiBaseUrl}/api/products/${productId}/stock`);
            
            // Stock update API chaqiruvi
            const stockResponse = await fetch(`${apiBaseUrl}/api/products/${productId}/stock`, {
              method: 'PATCH',
              headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Kiro-Client/1.0' // Client dan kelganini ko'rsatish
              },
              body: JSON.stringify({
                change: stockChange,
                variantIndex: variantIndex
              })
            });
            
            if (stockResponse.ok) {
              const stockResult = await stockResponse.json();
              console.log(`[useOfflineKassa] ✅ Stock updated successfully:`, stockResult);
              
              // MUHIM: RAM cache ni darhol yangilash - API dan kelgan yangi ma'lumotlar bilan
              if (stockResult.product) {
                const updatedProduct = stockResult.product;
                console.log(`[useOfflineKassa] 🔄 Updating RAM cache for product: ${updatedProduct.name}`);
                
                // Format updated product for cache
                const formattedProduct: OfflineProduct = {
                  id: updatedProduct._id || updatedProduct.id,
                  name: updatedProduct.name,
                  normalizedName: normalizeText(updatedProduct.name),
                  keywords: tokenize(updatedProduct.name),
                  sku: updatedProduct.sku !== undefined && updatedProduct.sku !== null ? String(updatedProduct.sku) : undefined,
                  barcode: updatedProduct.barcode !== undefined && updatedProduct.barcode !== null ? String(updatedProduct.barcode) : undefined,
                  price: updatedProduct.price || 0,
                  costPrice: updatedProduct.costPrice || updatedProduct.cost || updatedProduct.basePrice || Math.round((updatedProduct.price || 0) * 0.7),
                  currency: updatedProduct.currency || 'UZS',
                  stock: updatedProduct.stock ?? 0, // MUHIM: Faqat null/undefined uchun fallback
                  initialStock: updatedProduct.initialStock, // MUHIM: Faqat serverdan kelgan initialStock, fallback yo'q
                  createdByRole: updatedProduct.createdByRole,
                  categoryId: updatedProduct.categoryId,
                  imageUrl: updatedProduct.imageUrl,
                  userId: updatedProduct.userId,
                  updatedAt: Date.now(),
                  parentProductId: updatedProduct.parentProductId || undefined,
                  childProducts: Array.isArray(updatedProduct.childProducts) ? updatedProduct.childProducts : [],
                  isHidden: updatedProduct.isHidden || false,
                  variantSummaries: Array.isArray(updatedProduct.variantSummaries) ? updatedProduct.variantSummaries.map((v: any) => ({
                    name: v.name,
                    sku: v.sku !== undefined && v.sku !== null ? String(v.sku) : undefined,
                    barcode: v.barcode !== undefined && v.barcode !== null ? String(v.barcode) : undefined,
                    price: v.price || v.basePrice || updatedProduct.price || 0,
                    costPrice: v.costPrice || v.cost || v.basePrice || Math.round((v.price || v.basePrice || updatedProduct.price || 0) * 0.7),
                    currency: v.currency || updatedProduct.currency || 'UZS',
                    stock: v.stock ?? 0, // MUHIM: Faqat null/undefined uchun fallback
                    initialStock: v.initialStock, // Faqat serverdan kelgan qiymat, fallback yo'q
                    imageUrl: v.imageUrl || v.images?.[0]
                  })) : []
                };
                
                // RAM cache ni yangilash
                productsRef.current.set(formattedProduct.id, formattedProduct);
                console.log(`[useOfflineKassa] ✅ RAM cache updated for: ${formattedProduct.name}, new stock: ${formattedProduct.stock}`);
              }
            } else {
              const errorText = await stockResponse.text();
              console.error(`[useOfflineKassa] ❌ Stock update failed:`, errorText);
              throw new Error(`Stock update failed: ${errorText}`);
            }
          }
          
          // Stock yangilanish tugadi - sale record kerak emas
          console.log(`[useOfflineKassa] ✅ All stock updates completed successfully`);
          
          // MUHIM: Stock yangilanishdan keyin cache ni yangilash
          console.log(`[useOfflineKassa] 🔄 Refreshing product cache after stock update...`);
          
          // Search cache ni tozalash va search engine ni yangilash
          searchEngine.clearCache();
          console.log(`[useOfflineKassa] 🧹 Search cache cleared`);
          
          // MUHIM: Serverdan fresh ma'lumotlarni olish va cache ni to'liq yangilash
          await reloadProducts();
          console.log(`[useOfflineKassa] 🔄 Products reloaded from MongoDB`);
          
          sale.synced = true;
        } catch (networkError) {
          console.error(`[useOfflineKassa] ❌ Network error:`, networkError);
          throw networkError;
        }
      } else {
        // OFFLINE - xato
        console.error(`[useOfflineKassa] ❌ OFFLINE mode not supported`);
        throw new Error('Offline mode not supported - internet connection required');
      }
      
      // Pending count ni 0 qilish (IndexedDB ishlatmaymiz)
      setPendingSalesCount(0);

      // Clear cart
      clearCart();

      // MUHIM: Sotish tugagandan keyin qidiruv natijalarini yangilash
      console.log(`[useOfflineKassa] 🔄 Refreshing search results after sale completion...`);
      
      // DARHOL cache va search ni yangilash - setTimeout ishlatmaslik
      const currentQuery = searchQuery;
      
      // Search cache ni tozalash
      searchEngine.clearCache();
      
      // Search index ni qayta qurish (yangi ma'lumotlar bilan)
      const freshProducts = Array.from(productsRef.current.values());
      await searchEngine.buildIndex(freshProducts);
      
      // UI ni majburiy yangilash uchun
      setProductsCount(freshProducts.length);
      
      // MUHIM: Qidiruv natijalarini darhol yangilash - setTimeout bilan
      // Bu UI ning to'liq yangilanishini ta'minlaydi
      setTimeout(() => {
        if (currentQuery) {
          console.log(`[useOfflineKassa] 🔍 Re-searching with query: "${currentQuery}"`);
          search(currentQuery);
        } else {
          console.log(`[useOfflineKassa] 🔍 Re-searching all products`);
          search('');
        }
      }, 100); // 100ms kechikish - UI yangilanishi uchun

      console.log(`[useOfflineKassa] ✅ Sale completed successfully`);

      return sale;
      
    } catch (err: any) {
      console.error('[useOfflineKassa] Sale error:', err);
      setError(err.message);
      return null;
    }
  }, [items, total, totalDiscount, userId, isOnline, clearCart, searchQuery]);

  // ============================================
  // SYNC ACTIONS
  // ============================================

  const triggerSync = useCallback(async (): Promise<boolean> => {
    // Sync manager ishlatmaymiz - har doim true qaytaramiz
    console.log('[useOfflineKassa] Sync not needed - using direct MongoDB');
    return true;
  }, []);

  // Mahsulotlarni serverdan qayta yuklash
  const reloadProducts = useCallback(async (): Promise<void> => {
    if (!navigator.onLine) {
      console.log('[useOfflineKassa] Offline - cannot reload products');
      return;
    }
    
    setIsLoading(true);
    try {
      const url = `${apiBaseUrl}/api/products?userId=${userId}&userPhone=${userPhone || ''}&limit=50000`;
      console.log('[useOfflineKassa] Reloading products from:', url);
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        const serverProducts = Array.isArray(data) ? data : data.products || [];
        console.log('[useOfflineKassa] Reloaded products count:', serverProducts.length);
        
        if (serverProducts.length > 0) {
          const formattedProducts: OfflineProduct[] = serverProducts.map((p: any) => ({
            id: p._id || p.id,
            name: p.name,
            normalizedName: normalizeText(p.name),
            keywords: tokenize(p.name),
            sku: p.sku !== undefined && p.sku !== null ? String(p.sku) : undefined,
            barcode: p.barcode !== undefined && p.barcode !== null ? String(p.barcode) : undefined,
            price: p.price || 0,
            costPrice: p.costPrice || p.cost || p.basePrice || Math.round((p.price || 0) * 0.7),
            currency: p.currency || 'UZS',
            stock: p.stock ?? 0, // MUHIM: Faqat null/undefined uchun fallback
            // MUHIM: initialStock ni faqat serverdan olish - fallback ishlatmaslik
            initialStock: p.initialStock, // Faqat serverdan kelgan qiymat, fallback yo'q
            createdByRole: p.createdByRole,
            categoryId: p.categoryId,
            imageUrl: p.imageUrl,
            userId: p.userId,
            updatedAt: Date.now(),
            parentProductId: p.parentProductId || undefined,
            childProducts: Array.isArray(p.childProducts) ? p.childProducts : [],
            isHidden: p.isHidden || false,
            variantSummaries: Array.isArray(p.variantSummaries) ? p.variantSummaries.map((v: any) => ({
              name: v.name,
              sku: v.sku !== undefined && v.sku !== null ? String(v.sku) : undefined,
              barcode: v.barcode !== undefined && v.barcode !== null ? String(v.barcode) : undefined,
              price: v.price || v.basePrice || p.price || 0,
              costPrice: v.costPrice || v.cost || v.basePrice || Math.round((v.price || v.basePrice || p.price || 0) * 0.7),
              currency: v.currency || p.currency || 'UZS',
              stock: v.stock ?? 0, // MUHIM: Faqat null/undefined uchun fallback
              // MUHIM: Variant initialStock ni faqat serverdan olish - fallback ishlatmaslik
              initialStock: v.initialStock, // Faqat serverdan kelgan qiymat, fallback yo'q
              imageUrl: v.imageUrl || v.images?.[0]
            })) : []
          }));
          
          // RAM cache ni yangilash (faqat RAM)
          const productMap = new Map<string, OfflineProduct>();
          formattedProducts.forEach(p => productMap.set(p.id, p));
          productsRef.current = productMap;
          
          // Search index ni yangilash
          await searchEngine.buildIndex(formattedProducts);
          
          setProductsCount(formattedProducts.length);
          console.log('[useOfflineKassa] ✅ Products reloaded from MongoDB');
          
          // MUHIM: Qidiruv natijalarini ham yangilash
          // Agar hozir qidiruv ochiq bo'lsa, natijalarni yangilash
          const currentQuery = searchQuery;
          if (currentQuery !== undefined) {
            console.log('[useOfflineKassa] 🔍 Refreshing search results after reload...');
            setTimeout(() => {
              if (currentQuery) {
                search(currentQuery);
              } else {
                search('');
              }
            }, 50); // Kichik kechikish - cache yangilanishi uchun
          }
        }
      }
    } catch (err) {
      console.error('[useOfflineKassa] Failed to reload products:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, userPhone, apiBaseUrl]);

  // ============================================
  // UTILS
  // ============================================

  const getProduct = useCallback((id: string): OfflineProduct | undefined => {
    return productsRef.current.get(id);
  }, []);

  // MUHIM: Cache ni majburiy yangilash funksiyasi
  const forceRefreshCache = useCallback(async () => {
    console.log('[useOfflineKassa] 🔄 Force refreshing cache...');
    
    // Search cache ni tozalash
    searchEngine.clearCache();
    
    // Products ni serverdan qayta yuklash
    await reloadProducts();
    
    // Qidiruv natijalarini yangilash
    const currentQuery = searchQuery;
    setTimeout(() => {
      if (currentQuery) {
        search(currentQuery);
      } else {
        search('');
      }
    }, 100);
    
    console.log('[useOfflineKassa] ✅ Cache force refreshed');
  }, [reloadProducts, search, searchQuery]);

  // Window obyektiga qo'shish - debug uchun
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).forceRefreshCache = forceRefreshCache;
    }
  }, [forceRefreshCache]);

  // ============================================
  // RETURN
  // ============================================

  return {
    // Cart state
    items,
    total,
    discount: totalDiscount,
    
    // Search state
    searchQuery,
    searchResults,
    isSearching,
    
    // Status
    isOnline,
    isLoading,
    isSyncing,
    pendingSalesCount,
    productsCount,
    lastSyncTime,
    error,
    
    // Cart actions
    addToCart,
    removeFromCart,
    updateQuantity,
    updateDiscount,
    clearCart,
    
    // Search actions
    search,
    searchByBarcode,
    searchBySku,
    searchBySkuWithVariant,
    
    // Sale actions
    completeSale,
    
    // Sync actions
    triggerSync,
    reloadProducts,
    forceRefreshCache, // YANGI: Majburiy cache yangilash
    
    // Utils
    getProduct
  };
}
