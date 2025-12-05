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
  offlineDB,
  OfflineProduct,
  OfflineSale,
  saveOfflineSale,
  generateOfflineReceiptNumber,
  generateUUID,
  getAllProducts,
  getUnsyncedSales,
  bulkUpsertProducts,
  normalizeText,
  tokenize,
  setCurrentUserId,
  updateProductStockWithChildActivation
} from '../db/offlineDB';
import { searchEngine, SearchResult, SearchOptions } from '../services/searchEngine';
import { syncManager } from '../services/syncManager';

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
  currency?: 'USD' | 'RUB' | 'CNY' | 'UZS'; // Valyuta
  quantity: number;
  discount: number;
  stock: number; // Ombordagi soni
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
  addToCart: (product: OfflineProduct) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number, allowDelete?: boolean) => void;
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
  
  // Utils
  getProduct: (id: string) => OfflineProduct | undefined;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useOfflineKassa(userId: string, userPhone?: string): UseOfflineKassaReturn {
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
  
  // Products cache (RAM)
  const productsRef = useRef<Map<string, OfflineProduct>>(new Map());
  
  // Search debounce
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // INITIALIZATION
  // ============================================

  // API base URL
  const apiBaseUrl = (() => {
    if (typeof window === 'undefined') return '';
    // Electron da file:// protokoli ishlatiladi - port 5174
    if (window.location.protocol === 'file:') return 'http://127.0.0.1:5174';
    const envApiUrl = (import.meta as any).env?.VITE_API_BASE_URL;
    if (envApiUrl && !envApiUrl.includes('YOUR_PUBLIC_IP')) {
      return envApiUrl.replace(/\/$/, '');
    }
    return '';
  })();

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // 0. Установить текущего пользователя для фильтрации
        setCurrentUserId(userId, userPhone);
        
        // 1. Avval IndexedDB dan mahsulotlarni yuklash
        let products: OfflineProduct[] = [];
        try {
          products = await getAllProducts();
          console.log('[useOfflineKassa] Loaded from IndexedDB:', products.length, 'products');
        } catch (dbError: any) {
          console.error('[useOfflineKassa] IndexedDB error:', dbError.message || dbError);
        }
        
        // 2. Agar online bo'lsak, serverdan yangi mahsulotlarni yuklash
        // MUHIM: Har doim serverdan yuklash - o'chirilgan mahsulotlarni ham sinxronlash uchun
        console.log('[useOfflineKassa] Online status:', navigator.onLine, 'API URL:', apiBaseUrl);
        if (navigator.onLine) {
          try {
            const url = `${apiBaseUrl}/api/products?userId=${userId}&userPhone=${userPhone || ''}&limit=50000`;
            console.log('[useOfflineKassa] Fetching from:', url);
            const response = await fetch(url);
            if (response.ok) {
              const data = await response.json();
              const serverProducts = Array.isArray(data) ? data : data.products || [];
              
              // Agar serverda mahsulot yo'q bo'lsa, IndexedDB ni ham tozalash
              if (serverProducts.length === 0) {
                const localProducts = await getAllProducts();
                if (localProducts.length > 0) {
                  console.log(`[useOfflineKassa] Server has no products, clearing ${localProducts.length} products from IndexedDB`);
                  await offlineDB.products.bulkDelete(localProducts.map(p => p.id));
                }
                products = [];
              } else {
                // Format and save to IndexedDB
                const formattedProducts: OfflineProduct[] = serverProducts.map((p: any) => ({
                  id: p._id || p.id,
                  name: p.name,
                  normalizedName: normalizeText(p.name),
                  keywords: tokenize(p.name),
                  sku: p.sku !== undefined && p.sku !== null ? String(p.sku) : undefined,
                  barcode: p.barcode !== undefined && p.barcode !== null ? String(p.barcode) : undefined,
                  price: p.price || 0,
                  currency: p.currency || 'UZS', // Valyuta
                  stock: p.stock ?? p.quantity ?? 0,
                  categoryId: p.categoryId,
                  imageUrl: p.imageUrl,
                  userId: p.userId,
                  updatedAt: Date.now(),
                  // Ota-bola mahsulot tizimi
                  parentProductId: p.parentProductId || undefined,
                  childProducts: Array.isArray(p.childProducts) ? p.childProducts : [],
                  isHidden: p.isHidden || false,
                  // Variantlarni saqlash - SKU va barcode ni string ga aylantirish
                  variantSummaries: Array.isArray(p.variantSummaries) ? p.variantSummaries.map((v: any) => ({
                    name: v.name,
                    sku: v.sku !== undefined && v.sku !== null ? String(v.sku) : undefined,
                    barcode: v.barcode !== undefined && v.barcode !== null ? String(v.barcode) : undefined,
                    price: v.price || v.basePrice || p.price || 0,
                    currency: v.currency || p.currency || 'UZS', // Xil valyutasi
                    stock: v.stock ?? v.quantity ?? 0,
                    imageUrl: v.imageUrl || v.images?.[0]
                  })) : []
                }));
                
                // MUHIM: Eski mahsulotlarni o'chirish - serverda yo'q bo'lgan mahsulotlarni IndexedDB dan o'chirish
                const serverProductIds = new Set(formattedProducts.map(p => p.id));
                const localProducts = await getAllProducts();
                const productsToDelete = localProducts.filter(p => !serverProductIds.has(p.id)).map(p => p.id);
                
                if (productsToDelete.length > 0) {
                  console.log(`[useOfflineKassa] Deleting ${productsToDelete.length} products from IndexedDB (not on server)`);
                  await offlineDB.products.bulkDelete(productsToDelete);
                }
                
                await bulkUpsertProducts(formattedProducts);
                products = formattedProducts;
              }
            }
          } catch (err) {
            console.error('[useOfflineKassa] Failed to load from server:', err);
          }
        }
        
        // 3. RAM ga yuklash
        const productMap = new Map<string, OfflineProduct>();
        products.forEach(p => productMap.set(p.id, p));
        productsRef.current = productMap;
        
        // Debug: Variantlarni ko'rsatish
        let variantCount = 0;
        const variantSkuList: string[] = [];
        for (const product of products) {
          if (product.variantSummaries && product.variantSummaries.length > 0) {
            product.variantSummaries.forEach((v) => {
              if (v.sku) variantSkuList.push(v.sku);
              variantCount++;
            });
          }
        }
        
        // 4. Search index yaratish
        console.log('[useOfflineKassa] Building search index with', products.length, 'products');
        await searchEngine.buildIndex(products);
        
        if (mounted) {
          console.log('[useOfflineKassa] ✅ Products loaded:', products.length);
          setProductsCount(products.length);
          setIsLoading(false);
        }
        
        // 5. Pending sales count
        const unsyncedSales = await getUnsyncedSales();
        if (mounted) {
          setPendingSalesCount(unsyncedSales.length);
        }

        // 6. Background da sync manager ni ishga tushirish
        syncManager.initialize(userId).catch(err => {
          console.error('[useOfflineKassa] Sync manager init error:', err);
        });
        
        
      } catch (err: any) {
        console.error('[useOfflineKassa] Init error:', err);
        if (mounted) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    };

    initialize();

    // Subscribe to sync state changes
    const unsubscribe = syncManager.subscribe(async (state) => {
      if (mounted) {
        setIsOnline(state.isOnline);
        setIsSyncing(state.status === 'syncing');
        setPendingSalesCount(state.pendingSalesCount);
        setLastSyncTime(state.lastSyncTime);
        
        // Sync tugagandan keyin mahsulotlarni qayta yuklash
        if (state.status === 'idle' && state.lastSyncTime > 0) {
          const products = await getAllProducts();
          if (products.length > 0 && products.length !== productsRef.current.size) {
            const productMap = new Map<string, OfflineProduct>();
            products.forEach(p => productMap.set(p.id, p));
            productsRef.current = productMap;
            await searchEngine.buildIndex(products);
            setProductsCount(products.length);
          }
        }
      }
    });

    // Online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [userId]);

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

  const addToCart = useCallback((product: OfflineProduct) => {
    console.log('[useOfflineKassa] addToCart called:', product.name, 'id:', product.id);
    
    setItems(prev => {
      console.log('[useOfflineKassa] Current items count:', prev.length);
      const existingIndex = prev.findIndex(item => item.productId === product.id);
      
      if (existingIndex >= 0) {
        // Increment quantity
        console.log('[useOfflineKassa] Incrementing existing item quantity');
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        console.log('[useOfflineKassa] New items:', updated);
        return updated;
      }
      
      // Add new item with stock info and currency
      const newItem = {
        id: generateUUID(),
        productId: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode, // Barcode - scanner uchun
        price: product.price,
        currency: product.currency || 'UZS', // Valyuta
        quantity: 1,
        discount: 0,
        stock: product.stock || 0 // Ombordagi soni
      };
      console.log('[useOfflineKassa] Adding new item:', newItem);
      const newItems = [...prev, newItem];
      console.log('[useOfflineKassa] New items count:', newItems.length);
      return newItems;
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number, allowDelete = false) => {
    setItems(prev => {
      // Если количество 0 и разрешено удаление - удаляем товар
      if (quantity === 0 && allowDelete) {
        return prev.filter(item => item.id !== itemId);
      }
      
      // Иначе минимальное количество - 1
      const safeQuantity = Math.max(1, quantity);
      
      return prev.map(item =>
        item.id === itemId ? { ...item, quantity: safeQuantity } : item
      );
    });
  }, []);

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
      
      for (const product of allProducts.slice(0, 100)) {
        const mainStock = product.stock ?? 0;
        
        // Asosiy mahsulotni qo'shish (agar stock > 0 yoki xillar yo'q bo'lsa)
        if (mainStock > 0 || !product.variantSummaries || product.variantSummaries.length === 0) {
          results.push({
            product,
            score: 100,
            matchType: 'exact' as const,
            isVariant: false,
            displayName: product.name,
            displaySku: product.sku,
            displayPrice: product.price,
            displayStock: mainStock
          });
        }
        
        // Barcha xillarni ham qo'shish
        if (product.variantSummaries && product.variantSummaries.length > 0) {
          for (let i = 0; i < product.variantSummaries.length; i++) {
            const variant = product.variantSummaries[i];
            const variantStock = variant.stock ?? 0;
            
            results.push({
              product,
              score: 99, // Xillar asosiy mahsulotdan keyin
              matchType: 'variant' as const,
              variant,
              variantIndex: i,
              isVariant: true,
              displayName: variant.name,
              displaySku: variant.sku || product.sku,
              displayPrice: variant.price || product.price,
              displayStock: variantStock,
              parentProductName: product.name
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
      return engineResult;
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
    
    // 3. Asosiy mahsulot SKU/barcode ni tekshirish
    for (const product of productsRef.current.values()) {
      const productSku = product.sku?.toLowerCase().trim();
      const productBarcode = product.barcode?.toLowerCase().trim();
      
      // To'liq moslik
      if (productSku === normalizedCode || productBarcode === normalizedCode) {
        return { product, variantIndex: undefined };
      }
      
      // Raqamli moslik
      if (productSku && /^\d+$/.test(normalizedCode) && /^\d+$/.test(productSku)) {
        const codeNum = normalizedCode.replace(/^0+/, '') || '0';
        const skuNum = productSku.replace(/^0+/, '') || '0';
        if (codeNum === skuNum) {
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
      
      console.log(`[useOfflineKassa] completeSale called with ${items.length} items, saleType: ${saleType}`);
      console.log(`[useOfflineKassa] Items in cart:`, items.map(i => ({ productId: i.productId, name: i.name, quantity: i.quantity })));
      
      for (const item of items) {
        try {
          // Check if this is a variant (productId format: "originalId-v{index}")
          const variantMatch = item.productId.match(/^(.+)-v(\d+)$/);
          
          if (variantMatch) {
            // This is a variant
            const originalProductId = variantMatch[1];
            const variantIndex = parseInt(variantMatch[2], 10);
            const change = item.quantity * quantityChange;
            
            console.log(`[useOfflineKassa] Updating variant stock: ${originalProductId}[${variantIndex}], quantity: ${item.quantity}, change: ${change}`);
            
            // Stock yangilash va bola mahsulotlarni faollashtirish
            const { newStock, activatedChildren } = await updateProductStockWithChildActivation(originalProductId, change, variantIndex);
            
            // Update cache - reload from IndexedDB to ensure consistency
            const updatedProduct = await offlineDB.products.get(originalProductId);
            if (updatedProduct) {
              productsRef.current.set(originalProductId, updatedProduct);
              console.log(`[useOfflineKassa] Variant stock updated: ${originalProductId}[${variantIndex}] = ${newStock}`);
              
              // Agar bola mahsulotlar faollashtirilgan bo'lsa, ularni ham cache ga qo'shish
              if (activatedChildren > 0) {
                console.log(`[useOfflineKassa] ${activatedChildren} child products activated!`);
                // Faollashtirilgan bola mahsulotlarni cache ga yuklash
                for (const child of updatedProduct.childProducts || []) {
                  const childProduct = await offlineDB.products.get(child.productId);
                  if (childProduct) {
                    productsRef.current.set(child.productId, childProduct);
                  }
                }
              }
            } else {
              console.error(`[useOfflineKassa] Product not found after update: ${originalProductId}`);
            }
          } else {
            // Regular product
            const change = item.quantity * quantityChange;
            
            console.log(`[useOfflineKassa] Updating product stock: ${item.productId}, quantity: ${item.quantity}, change: ${change}`);
            
            // Проверяем, существует ли товар перед обновлением
            const productBefore = await offlineDB.products.get(item.productId);
            if (!productBefore) {
              console.error(`[useOfflineKassa] Product not found in DB: ${item.productId}`);
              throw new Error(`Товар не найден: ${item.name} (${item.productId})`);
            }
            
            console.log(`[useOfflineKassa] Product stock before: ${productBefore.stock}`);
            
            // Stock yangilash va xillarni mustaqil mahsulotga aylantirish
            const result = await updateProductStockWithChildActivation(item.productId, change);
            const { newStock, activatedChildren, promoted, newProductId } = result;
            
            // Update cache - reload from IndexedDB to ensure consistency
            const updatedProduct = await offlineDB.products.get(item.productId);
            if (updatedProduct) {
              productsRef.current.set(item.productId, updatedProduct);
              console.log(`[useOfflineKassa] Product stock updated: ${item.productId} = ${newStock}`);
              
              // YANGI: Agar birinchi xil mustaqil mahsulotga aylangan bo'lsa
              if (promoted && newProductId) {
                console.log(`[useOfflineKassa] First variant promoted to product: ${newProductId}`);
                
                // Yangi mahsulotni cache ga qo'shish
                const newProduct = await offlineDB.products.get(newProductId);
                if (newProduct) {
                  productsRef.current.set(newProductId, newProduct);
                  console.log(`[useOfflineKassa] New product added to cache: ${newProduct.name}`);
                  
                  // Search index ni yangilash
                  const allProducts = await getAllProducts();
                  await searchEngine.buildIndex(allProducts);
                  console.log(`[useOfflineKassa] Search index rebuilt with new product`);
                }
              }
              
              // Agar bola mahsulotlar faollashtirilgan bo'lsa, ularni ham cache ga qo'shish
              if (activatedChildren > 0 && !promoted) {
                console.log(`[useOfflineKassa] ${activatedChildren} child products activated!`);
                // Faollashtirilgan bola mahsulotlarni cache ga yuklash
                for (const child of updatedProduct.childProducts || []) {
                  const childProduct = await offlineDB.products.get(child.productId);
                  if (childProduct) {
                    productsRef.current.set(child.productId, childProduct);
                  }
                }
              }
            } else {
              console.error(`[useOfflineKassa] Product not found after update: ${item.productId}`);
            }
          }
        } catch (stockError: any) {
          console.error(`[useOfflineKassa] Failed to update stock for ${item.productId}:`, stockError);
          setError(`Ошибка обновления stock для ${item.name}: ${stockError.message}`);
        }
      }

      // Save to IndexedDB
      console.log(`[useOfflineKassa] Saving sale to IndexedDB:`, { id: sale.id, synced: sale.synced, itemsCount: sale.items.length });
      await saveOfflineSale(sale);
      
      // Verify sale was saved - wait a bit for IndexedDB to commit
      await new Promise(resolve => setTimeout(resolve, 100));
      const savedSale = await offlineDB.offlineSales.get(sale.id);
      console.log(`[useOfflineKassa] Sale saved, verification:`, { id: savedSale?.id, synced: savedSale?.synced, exists: !!savedSale });
      
      // Update pending count
      const unsyncedSales = await getUnsyncedSales();
      console.log(`[useOfflineKassa] Unsynced sales count after save:`, unsyncedSales.length);
      if (unsyncedSales.length > 0) {
        console.log(`[useOfflineKassa] Unsynced sales:`, unsyncedSales.map(s => ({ id: s.id, synced: s.synced })));
      }
      setPendingSalesCount(unsyncedSales.length);

      // Clear cart
      clearCart();

      // Try to sync if online - wait a bit more to ensure sale is committed
      if (isOnline) {
        // Delay sync slightly to ensure IndexedDB transaction is committed
        setTimeout(() => {
          syncManager.triggerSync(userId);
        }, 200);
      }

      return sale;
      
    } catch (err: any) {
      console.error('[useOfflineKassa] Sale error:', err);
      setError(err.message);
      return null;
    }
  }, [items, total, totalDiscount, userId, isOnline, clearCart]);

  // ============================================
  // SYNC ACTIONS
  // ============================================

  const triggerSync = useCallback(async (): Promise<boolean> => {
    return syncManager.triggerSync(userId);
  }, [userId]);

  // ============================================
  // UTILS
  // ============================================

  const getProduct = useCallback((id: string): OfflineProduct | undefined => {
    return productsRef.current.get(id);
  }, []);

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
    
    // Utils
    getProduct
  };
}
