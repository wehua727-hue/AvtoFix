/**
 * REAL-TIME KASSA HOOK - CACHE YO'Q
 * To'g'ridan-to'g'ri MongoDB bilan ishlaydi
 * 
 * Xususiyatlar:
 * - Real-time product search (har doim fresh data)
 * - Real-time cart management
 * - Real-time sale saving
 * - Cache yo'q - barcha ma'lumotlar MongoDB dan
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  OfflineProduct,
  OfflineSale,
  generateOfflineReceiptNumber,
  generateUUID,
  normalizeText,
  tokenize,
  offlineDB,
  updateProductStock,
} from '../db/offlineDB';

// ============================================
// TYPES
// ============================================

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  costPrice?: number;
  currency?: 'USD' | 'RUB' | 'CNY' | 'UZS';
  quantity: number;
  discount: number;
  stock: number;
  initialStock?: number;
  createdByRole?: 'egasi' | 'admin' | 'xodim';
}

export interface KassaState {
  // Cart
  items: CartItem[];
  total: number;
  discount: number;
  
  // Search
  searchQuery: string;
  searchResults: any[];
  isSearching: boolean;
  
  // Status
  isOnline: boolean;
  isLoading: boolean;
  // isSyncing: boolean; // TODO: Implement sync status
  pendingSalesCount: number;
  productsCount: number;
  // lastSyncTime: number; // TODO: Implement sync time tracking
  
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
  search: (query: string) => Promise<void>;
  searchBySkuWithVariant: (sku: string) => Promise<{ product: OfflineProduct; variantIndex?: number } | undefined>;
  
  // Sale actions
  completeSale: (paymentType: string, saleType?: 'sale' | 'refund') => Promise<OfflineSale | null>;
  
  // Utils
  getProduct: (id: string) => Promise<OfflineProduct | undefined>;
  refreshCache: () => void;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useOfflineKassa(userId: string, userPhone?: string, defectiveCounts?: Map<string, number>): UseOfflineKassaReturn {
  // State
  const [items, setItems] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // const [isSyncing, setIsSyncing] = useState(false); // TODO: Implement sync status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  // const [lastSyncTime, setLastSyncTime] = useState(0); // TODO: Implement sync time tracking
  const [error, setError] = useState<string | null>(null);
  
  // Simple cache for faster SKU searches - DISABLED FOR DEBUGGING
  // const [cachedProducts, setCachedProducts] = useState<OfflineProduct[]>([]);
  // const [cacheTimestamp, setCacheTimestamp] = useState(0);
  // const CACHE_DURATION = 5000; // TODO: Implement cache duration
  
  // Search debounce
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // API base URL
  const apiBaseUrl = (() => {
    if (typeof window === 'undefined') return '';
    if (window.location.protocol === 'file:') return 'http://127.0.0.1:5175'; // Port 5175 ga o'zgartirdik
    const envApiUrl = (import.meta as any).env?.VITE_API_BASE_URL;
    if (envApiUrl && !envApiUrl.includes('YOUR_PUBLIC_IP')) {
      return envApiUrl.replace(/\/$/, '');
    }
    return '';
  })();

  // ============================================
  // REAL-TIME MongoDB FUNCTIONS
  // ============================================

  // Real-time products fetch
  const fetchProductsFromMongoDB = useCallback(async (): Promise<OfflineProduct[]> => {
    if (!navigator.onLine) {
      throw new Error('Internet aloqasi yo\'q');
    }
    
    try {
      // MUHIM: Har doim yangi timestamp bilan cache busting
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const url = `${apiBaseUrl}/api/products?userId=${userId}&userPhone=${userPhone || ''}&limit=50000&_t=${timestamp}&_r=${randomId}&_nocache=true`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT',
          'If-None-Match': '*'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const serverProducts = Array.isArray(data) ? data : data.products || [];
        
        // Format products
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
          stock: p.stock ?? 0, // REAL-TIME stock
          initialStock: p.initialStock, // MUHIM: Faqat serverdan kelgan qiymat, fallback yo'q!
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
            stock: v.stock ?? 0, // REAL-TIME variant stock
            initialStock: v.initialStock, // MUHIM: Faqat serverdan kelgan qiymat, fallback yo'q!
            imageUrl: v.imageUrl || v.images?.[0]
          })) : []
        }));
        
        // Update cache for faster SKU searches
        // setCachedProducts(formattedProducts);
        // setCacheTimestamp(Date.now());
        
        return formattedProducts;
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (err) {
      throw err;
    }
  }, [userId, userPhone, apiBaseUrl]);

  // Force cache refresh function
  const refreshCache = useCallback(() => {
    // Cache disabled
  }, []);

  // Fast cached fetch for SKU searches - DISABLED FOR DEBUGGING
  const getProductsForSkuSearch = useCallback(async (): Promise<OfflineProduct[]> => {
    return await fetchProductsFromMongoDB();
  }, [fetchProductsFromMongoDB]);

  // ============================================
  // INITIALIZATION
  // ============================================

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Faqat products count ni olish
        try {
          const products = await fetchProductsFromMongoDB();
          if (mounted) {
            setProductsCount(products.length);
          }
        } catch (err) {
          if (mounted) {
            setError('Serverdan mahsulotlarni yuklashda xatolik');
          }
        }
        
        if (mounted) {
          setIsLoading(false);
          setPendingSalesCount(0);
        }
        
      } catch (err: any) {
        if (mounted) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    };

    initialize();

    // Online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [userId, fetchProductsFromMongoDB]);

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
    setItems(prev => {
      // Variant yoki asosiy mahsulot ID bilan qidiruv
      const existingIndex = prev.findIndex(item => item.id === product.id);
      
      if (existingIndex >= 0) {
        const existingItem = prev[existingIndex];
        const newQuantity = existingItem.quantity + 0; // Don't auto-increment, keep current quantity
        
        // Stock tekshirish (faqat sotish rejimida)
        if (!isRefundMode && newQuantity > product.stock) {
          window.dispatchEvent(new CustomEvent('stock-exceeded', { 
            detail: { name: existingItem.name, stock: product.stock, requested: newQuantity } 
          }));
        }
        
        const updated = [...prev];
        updated[existingIndex].quantity = newQuantity;
        updated[existingIndex].stock = product.stock; // REAL-TIME stock
        updated[existingIndex].initialStock = product.initialStock; // REAL-TIME initialStock
        return updated;
      }
      
      // Add new item
      const newItem = {
        id: product.id, // Variant uchun variantId, asosiy uchun id
        productId: product.productId || product.id, // MUHIM: Asosiy mahsulot ID si - defectiveCounts uchun
        name: product.name || 'Nomsiz mahsulot',
        sku: product.sku,
        barcode: product.barcode,
        price: product.price || 0,
        costPrice: product.costPrice || 0,
        currency: product.currency || 'UZS',
        quantity: 0, // Default 0 instead of 1
        discount: 0,
        stock: product.stock ?? 0, // REAL-TIME stock
        initialStock: product.initialStock, // REAL-TIME initialStock
        createdByRole: product.createdByRole
      };
      
      return [...prev, newItem];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number, allowDelete = false, isRefundMode: boolean = false) => {
    setItems(prev => {
      if (quantity < 0 && allowDelete) {
        return prev.filter(item => item.id !== itemId);
      }
      
      const safeQuantity = Math.max(0, quantity);
      
      return prev.map(item => {
        if (item.id === itemId) {
          // Stock tekshirish
          if (!isRefundMode && safeQuantity > item.stock) {
            window.dispatchEvent(new CustomEvent('stock-exceeded', { 
              detail: { name: item.name, stock: item.stock, requested: safeQuantity } 
            }));
          }
          
          // Qaytarish rejimida cheklovlar
          if (isRefundMode) {
            const currentStock = item.stock ?? 0;
            const currentInitialStock = item.initialStock;
            
            // MUHIM: initialStock mavjud bo'lsa uni ishlatish, yo'q bo'lsa validation o'tkazmaslik
            if (!currentInitialStock || currentInitialStock <= 0) {
              // initialStock ma'lumoti yo'q - validation o'tkazmaslik
              return { ...item, quantity: safeQuantity };
            }
            
            // Variant yoki asosiy mahsulot uchun defectiveCount olish
            const defectiveKey = item.id.includes('-v') ? item.id : item.productId;
            const defectiveCount = defectiveCounts?.get(defectiveKey) || 0;
            const soldQuantity = currentInitialStock - currentStock;
            const maxReturn = Math.max(0, soldQuantity - defectiveCount);
            
            if (safeQuantity > maxReturn) {
              // MUHIM: Toast notification chiqarish
              try {
                const eventDetail = { 
                  name: item.name, 
                  maxReturn,
                  requested: safeQuantity,
                  soldQuantity,
                  defectiveCount,
                  initialStock: currentInitialStock
                };
                
                const event = new CustomEvent('refund-limit-exceeded', { 
                  detail: eventDetail,
                  bubbles: true,
                  cancelable: true
                });
                
                window.dispatchEvent(event);
                
                // Backup: Direct toast call if event fails
                if (typeof window !== 'undefined' && (window as any).toast) {
                  (window as any).toast.error(`"${item.name}" - boshlang'ich ${currentInitialStock} ta, ${soldQuantity} ta sotilgan, ${defectiveCount > 0 ? `${defectiveCount} ta yaroqsiz qaytarilgan, ` : ''}${maxReturn} tadan ortiq qaytara olmaysiz!`, { duration: 15000 });
                }
                
              } catch (error) {
                // Fallback: Try to show alert
                try {
                  alert(`"${item.name}" - boshlang'ich ${currentInitialStock} ta, ${soldQuantity} ta sotilgan, ${defectiveCount > 0 ? `${defectiveCount} ta yaroqsiz qaytarilgan, ` : ''}${maxReturn} tadan ortiq qaytara olmaysiz!`);
                } catch (alertError) {
                  // Silent fail
                }
              }
              
              // MUHIM: Validation failed - don't update quantity, keep current value
              return item;
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
  // SEARCH ACTIONS - REAL-TIME
  // ============================================

  const search = useCallback(async (query: string) => {
    setSearchQuery(query);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce search (200ms)
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      
      try {
        // REAL-TIME: Har doim fresh ma'lumotlar
        const products = await fetchProductsFromMongoDB();
        const results: any[] = [];
        
        if (!query || query.length < 1) {
          // Bo'sh qidiruv - barcha mahsulotlar
          for (const product of products.slice(0, 100)) {
            const mainStock = product.stock ?? 0;
            
            // Asosiy mahsulot - BARCHA mahsulotlarni ko'rsatish (stock 0 bo'lsa ham)
            if (!product.variantSummaries || product.variantSummaries.length === 0) {
              results.push({
                product,
                score: 100,
                matchType: 'exact' as const,
                isVariant: false,
                displayName: product.name || `Mahsulot ${product.sku || product.id}`,
                displaySku: product.sku,
                displayPrice: product.price,
                displayStock: mainStock
              });
            } else if (mainStock > 0) {
              // Agar xillar bor va asosiy mahsulot stock > 0 bo'lsa ham ko'rsatish
              results.push({
                product,
                score: 100,
                matchType: 'exact' as const,
                isVariant: false,
                displayName: product.name || `Mahsulot ${product.sku || product.id}`,
                displaySku: product.sku,
                displayPrice: product.price,
                displayStock: mainStock
              });
            }
            
            // Barcha xillar
            if (product.variantSummaries && product.variantSummaries.length > 0) {
              for (let i = 0; i < product.variantSummaries.length; i++) {
                const variant = product.variantSummaries[i];
                results.push({
                  product,
                  score: 99,
                  matchType: 'variant' as const,
                  variant,
                  variantIndex: i,
                  isVariant: true,
                  displayName: variant.name || `Xil ${variant.sku || i + 1}`,
                  displaySku: variant.sku || product.sku,
                  displayPrice: variant.price || product.price,
                  displayStock: variant.stock ?? 0,
                  parentProductName: product.name || `Mahsulot ${product.sku || product.id}`
                });
              }
            }
          }
        } else {
          // Qidiruv - nom bo'yicha
          const normalizedQuery = query.toLowerCase().trim();
          
          for (const product of products) {
            const productName = (product.name || '').toLowerCase();
            const productSku = (product.sku || '').toLowerCase();
            
            // Qidiruv so'zi bilan boshlanadimi yoki ichida bormi
            const nameStartsWith = productName.startsWith(normalizedQuery);
            const skuStartsWith = productSku.startsWith(normalizedQuery);
            const nameIncludes = productName.includes(normalizedQuery);
            const skuIncludes = productSku.includes(normalizedQuery);
            
            if (nameIncludes || skuIncludes) {
              const mainStock = product.stock ?? 0;
              
              // Score: boshlanganlar yuqori ball oladi
              let score = 50;
              if (nameStartsWith) score = 100;
              else if (skuStartsWith) score = 95;
              else if (nameIncludes) score = 80;
              else if (skuIncludes) score = 75;
              
              // Asosiy mahsulot - BARCHA mahsulotlarni ko'rsatish (stock 0 bo'lsa ham)
              if (!product.variantSummaries || product.variantSummaries.length === 0) {
                results.push({
                  product,
                  score,
                  matchType: 'exact' as const,
                  isVariant: false,
                  displayName: product.name || `Mahsulot ${product.sku || product.id}`,
                  displaySku: product.sku,
                  displayPrice: product.price,
                  displayStock: mainStock
                });
              } else if (mainStock > 0) {
                // Agar xillar bor va asosiy mahsulot stock > 0 bo'lsa ham ko'rsatish
                results.push({
                  product,
                  score,
                  matchType: 'exact' as const,
                  isVariant: false,
                  displayName: product.name || `Mahsulot ${product.sku || product.id}`,
                  displaySku: product.sku,
                  displayPrice: product.price,
                  displayStock: mainStock
                });
              }
              
              // Xillar
              if (product.variantSummaries && product.variantSummaries.length > 0) {
                for (let i = 0; i < product.variantSummaries.length; i++) {
                  const variant = product.variantSummaries[i];
                  const variantName = (variant.name || '').toLowerCase();
                  const variantSku = (variant.sku || '').toLowerCase();
                  
                  const variantNameStartsWith = variantName.startsWith(normalizedQuery);
                  const variantSkuStartsWith = variantSku.startsWith(normalizedQuery);
                  const variantNameIncludes = variantName.includes(normalizedQuery);
                  const variantSkuIncludes = variantSku.includes(normalizedQuery);
                  
                  if (variantNameIncludes || variantSkuIncludes) {
                    let variantScore = 50;
                    if (variantNameStartsWith) variantScore = 99;
                    else if (variantSkuStartsWith) variantScore = 94;
                    else if (variantNameIncludes) variantScore = 79;
                    else if (variantSkuIncludes) variantScore = 74;
                    
                    results.push({
                      product,
                      score: variantScore,
                      matchType: 'variant' as const,
                      variant,
                      variantIndex: i,
                      isVariant: true,
                      displayName: variant.name || `Xil ${variant.sku || i + 1}`,
                      displaySku: variant.sku || product.sku,
                      displayPrice: variant.price || product.price,
                      displayStock: variant.stock ?? 0,
                      parentProductName: product.name || `Mahsulot ${product.sku || product.id}`
                    });
                  }
                }
              }
            }
          }
          
          // Natijalarni score bo'yicha tartiblash (yuqori score birinchi)
          results.sort((a, b) => b.score - a.score);
        }
        
        setSearchResults(results);
        
      } catch (err) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);
  }, [fetchProductsFromMongoDB]);

  const searchBySkuWithVariant = useCallback(async (code: string): Promise<{ product: OfflineProduct; variantIndex?: number } | undefined> => {
    const normalizedCode = code.toLowerCase().trim();
    
    try {
      // FAST: Use cached products for SKU search
      const products = await getProductsForSkuSearch();
      
      // 0. Xil ID bilan qidirish (format: {productId}v{index} - chiziqchasiz)
      // Masalan: "316b8v0" yoki "316B8V0"
      if (normalizedCode.match(/^[a-f0-9]+v\d+$/i)) {
        const parts = normalizedCode.split('v');
        if (parts.length === 2) {
          const variantProductId = parts[0];
          const variantIndexStr = parts[1];
          const variantIndex = parseInt(variantIndexStr);
          
          if (!isNaN(variantIndex)) {
            for (const product of products) {
              // ProductId oxirgi 8 ta belgisi bilan solishtirish
              const productIdString = typeof product.id === 'string' ? product.id : product.id.toString();
              const productIdShort = productIdString.slice(-8).toLowerCase();
              
              if (productIdShort === variantProductId && product.variantSummaries && product.variantSummaries[variantIndex]) {
                const variant = product.variantSummaries[variantIndex];
                
                const variantProduct: OfflineProduct = {
                  ...product,
                  id: `${product.id}-v${variantIndex}`,
                  name: variant.name || variant.sku || `${product.name} - Xil ${variantIndex + 1}`,
                  sku: variant.sku || product.sku,
                  barcode: variant.barcode || product.barcode,
                  price: variant.price || product.price,
                  costPrice: variant.costPrice || product.costPrice || 0,
                  currency: variant.currency || product.currency || 'UZS',
                  stock: variant.stock ?? 0,
                  initialStock: variant.initialStock ?? variant.stock ?? 0,
                  productId: product.id,
                  variantSummaries: undefined
                };
                
                return { product: variantProduct, variantIndex };
              }
            }
          }
        }
      }
      
      // 1. ProductId oxirgi 8 ta belgisi bilan qidirish (senik chop etishda barcode qiymati shunaqa ID)
      for (const product of products) {
        // MongoDB ObjectId string formatiga o'tkazish
        const productIdString = typeof product.id === 'string' ? product.id : product.id.toString();
        const productIdShort = productIdString.slice(-8).toLowerCase();
        
        if (productIdShort === normalizedCode) {
          return { product, variantIndex: undefined };
        }
      }
      
      // 1. Variant SKU ni tekshirish
      for (const product of products) {
        if (product.variantSummaries && product.variantSummaries.length > 0) {
          for (let i = 0; i < product.variantSummaries.length; i++) {
            const variant = product.variantSummaries[i];
            const variantSku = variant.sku?.toLowerCase().trim();
            const variantBarcode = variant.barcode?.toLowerCase().trim();
            
            if (variantSku === normalizedCode || variantBarcode === normalizedCode) {
              // MUHIM: Variantni alohida mahsulot sifatida qaytarish
              const variantProduct: OfflineProduct = {
                ...product,
                id: `${product.id}-v${i}`,
                name: variant.name || variant.sku || `${product.name} - Xil ${i + 1}`, // SKU yoki fallback
                sku: variant.sku || product.sku,
                barcode: variant.barcode || product.barcode,
                price: variant.price || product.price,
                costPrice: variant.costPrice || product.costPrice || 0,
                currency: variant.currency || product.currency || 'UZS',
                stock: variant.stock ?? 0,
                initialStock: variant.initialStock ?? variant.stock ?? 0,
                productId: product.id, // Asosiy mahsulot ID si
                variantSummaries: undefined // Variantlarni olib tashlaymiz, chunki bu o'zi variant
              };
              
              return { product: variantProduct, variantIndex: i };
            }
            
            // Raqamli moslik
            if (variantSku && /^\d+$/.test(normalizedCode) && /^\d+$/.test(variantSku)) {
              const codeNum = normalizedCode.replace(/^0+/, '') || '0';
              const skuNum = variantSku.replace(/^0+/, '') || '0';
              if (codeNum === skuNum) {
                // MUHIM: Variantni alohida mahsulot sifatida qaytarish
                const variantProduct: OfflineProduct = {
                  ...product,
                  id: `${product.id}-v${i}`,
                  name: variant.name || variant.sku || `${product.name} - Xil ${i + 1}`, // SKU yoki fallback
                  sku: variant.sku || product.sku,
                  barcode: variant.barcode || product.barcode,
                  price: variant.price || product.price,
                  costPrice: variant.costPrice || product.costPrice || 0,
                  currency: variant.currency || product.currency || 'UZS',
                  stock: variant.stock ?? 0,
                  initialStock: variant.initialStock ?? variant.stock ?? 0,
                  productId: product.id, // Asosiy mahsulot ID si
                  variantSummaries: undefined // Variantlarni olib tashlaymiz, chunki bu o'zi variant
                };
                
                return { product: variantProduct, variantIndex: i };
              }
            }
          }
        }
      }
      
      // 2. Asosiy mahsulot SKU ni tekshirish - STOCK PRIORITETI bilan
      for (const product of products) {
        const productSku = product.sku?.toLowerCase().trim();
        const productBarcode = product.barcode?.toLowerCase().trim();
        
        if (productSku === normalizedCode || productBarcode === normalizedCode) {
          return { product, variantIndex: undefined };
        }
        
        // Raqamli moslik
        if (productSku && /^\d+$/.test(normalizedCode) && /^\d+$/.test(productSku)) {
          const codeNum = normalizedCode.replace(/^0+/, '') || '0';
          const skuNum = productSku.replace(/^0+/, '') || '0';
          if (codeNum === skuNum) {
            // FOYDALANUVCHI AYNAN SHU SKU NI XOHLAYDI - stock 0 bo'lsa ham qaytarish
            return { product, variantIndex: undefined };
          }
        }
      }
      
      return undefined;
      
    } catch (err) {
      return undefined;
    }
  }, [getProductsForSkuSearch]);

  // ============================================
  // SALE ACTIONS
  // ============================================

  const completeSale = useCallback(async (
    paymentType: string,
    saleType: 'sale' | 'refund' = 'sale'
  ): Promise<OfflineSale | null> => {
    if (items.length === 0) return null;

    try {
      // Create ONE sale for ALL items
      const itemTotal = items.reduce((sum, item) => sum + (item.quantity * item.price - item.discount), 0);
      const totalDiscount = items.reduce((sum, item) => sum + item.discount, 0);
      
      const sale: OfflineSale = {
        id: generateUUID(),
        recipientNumber: generateOfflineReceiptNumber(),
        items: items.map(item => ({
          productId: item.productId,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          price: item.price,
          costPrice: item.costPrice || 0,
          discount: item.discount
        })),
        total: itemTotal,
        discount: totalDiscount,
        paymentType,
        saleType,
        createdAt: Date.now(),
        synced: false,
        userId
      };
      
      const sales = [sale];

      // Stock update for all items
      let stockUpdated = false;
      let saleSynced = false;

      if (isOnline) {
        try {
          // 1. Stock yangilash - AVVAL IndexedDB, KEYIN Server
          for (const item of items) {
            const stockChange = saleType === 'sale' ? -item.quantity : item.quantity;
            
            // Variant tekshirish
            const isVariant = item.id.includes('-v');
            let productId = item.productId;
            let variantIndex: number | undefined = undefined;
            
            if (isVariant) {
              const variantMatch = item.id.match(/^(.+)-v(\d+)$/i);
              if (variantMatch) {
                productId = variantMatch[1];
                variantIndex = parseInt(variantMatch[2], 10);
              }
            }
            
            // MUHIM: Avval IndexedDB'da stock kamaytirish
            try {
              console.log(`[completeSale] Updating IndexedDB stock for ${item.name}: change=${stockChange}`);
              await updateProductStock(productId, stockChange, variantIndex);
              console.log(`[completeSale] ✅ IndexedDB stock updated for ${item.name}`);
            } catch (dbError) {
              console.error(`[completeSale] ❌ IndexedDB stock update failed for ${item.name}:`, dbError);
              // Continue to server update even if IndexedDB fails
            }
            
            // KEYIN Server'da stock kamaytirish
            const stockResponse = await fetch(`${apiBaseUrl}/api/products/${productId}/stock`, {
              method: 'PATCH',
              headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Kiro-Client/1.0'
              },
              body: JSON.stringify({
                change: stockChange,
                variantIndex: variantIndex,
                userId: userId,
                reason: saleType // 'sale' or 'refund'
              })
            });
            
            if (!stockResponse.ok) {
              const errorText = await stockResponse.text();
              console.error(`Stock update failed for ${item.name}: ${errorText}`);
              // Continue to try other items or just log error?
              // Ideally we should rollback or fail, but for now we continue best-effort
            }
          }
          stockUpdated = true;
          
          // 2. Savdo tarixini serverga yuklash (MongoDB ga saqlash uchun)
          try {
            const syncResponse = await fetch(`${apiBaseUrl}/api/sales/offline-sync`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                sales: sales.map(s => ({
                  id: s.id,
                  recipientNumber: s.recipientNumber,
                  items: s.items,
                  total: s.total,
                  discount: s.discount,
                  paymentType: s.paymentType,
                  saleType: s.saleType,
                  createdAt: s.createdAt,
                  userId: s.userId
                })),
                userId: userId
              })
            });
            
            if (syncResponse.ok) {
              saleSynced = true;
            } else {
              console.error('Sale sync failed:', await syncResponse.text());
            }
          } catch (syncErr) {
            console.error('Sale sync network error:', syncErr);
          }
          
        } catch (networkError) {
          console.error('Network error during sale:', networkError);
        }
      } else {
        // OFFLINE REJIM - IndexedDB'da stock kamaytirish
        try {
          console.log('[completeSale] Offline mode - updating IndexedDB stock');
          for (const item of items) {
            const stockChange = saleType === 'sale' ? -item.quantity : item.quantity;
            
            // Variant tekshirish
            const isVariant = item.id.includes('-v');
            let productId = item.productId;
            let variantIndex: number | undefined = undefined;
            
            if (isVariant) {
              const variantMatch = item.id.match(/^(.+)-v(\d+)$/i);
              if (variantMatch) {
                productId = variantMatch[1];
                variantIndex = parseInt(variantMatch[2], 10);
              }
            }
            
            // IndexedDB'da stock kamaytirish
            try {
              console.log(`[completeSale] Offline: Updating IndexedDB stock for ${item.name}: change=${stockChange}`);
              await updateProductStock(productId, stockChange, variantIndex);
              console.log(`[completeSale] ✅ Offline: IndexedDB stock updated for ${item.name}`);
            } catch (dbError) {
              console.error(`[completeSale] ❌ Offline: IndexedDB stock update failed for ${item.name}:`, dbError);
            }
          }
          stockUpdated = true;
          console.log('[completeSale] Offline: Stock updated successfully');
        } catch (offlineError) {
          console.error('Offline stock update error:', offlineError);
        }
      }
      
      // Mark as synced ONLY if both stock updated and sale record synced
      if (stockUpdated && saleSynced) {
        sale.synced = true;
      } else {
        sale.synced = false;
      }
      
      // Clear cart
      clearCart();
      
      // Save sale to IndexedDB
      try {
        console.log('[useOfflineKassa] Saving sale to IndexedDB:', sale.id);
        
        await offlineDB.offlineSales.put({
          id: sale.id,
          recipientNumber: sale.recipientNumber,
          items: sale.items,
          total: sale.total,
          discount: sale.discount,
          paymentType: sale.paymentType,
          saleType: sale.saleType,
          userId: sale.userId,
          createdAt: sale.createdAt,
          synced: sale.synced
        });
        console.log('[useOfflineKassa] Sale saved to IndexedDB successfully');
      } catch (dbError) {
        console.error('[useOfflineKassa] Failed to save sales to IndexedDB:', dbError);
      }
      
      return sale;
      
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [items, userId, isOnline, clearCart, apiBaseUrl]);

  // ============================================
  // UTILS
  // ============================================

  const getProduct = useCallback(async (id: string): Promise<OfflineProduct | undefined> => {
    try {
      const products = await fetchProductsFromMongoDB();
      return products.find(p => p.id === id);
    } catch (err) {
      return undefined;
    }
  }, [fetchProductsFromMongoDB]);

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
    // isSyncing, // TODO: Implement sync status
    pendingSalesCount,
    productsCount,
    // lastSyncTime, // TODO: Implement sync time tracking
    error,
    
    // Cart actions
    addToCart,
    removeFromCart,
    updateQuantity,
    updateDiscount,
    clearCart,
    
    // Search actions
    search,
    searchBySkuWithVariant,
    
    // Sale actions
    completeSale,
    
    // Utils
    getProduct,
    refreshCache,
  };
}