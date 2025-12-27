import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search,
  CreditCard,
  Pause,
  Clock,
  Loader2,
  History,
  Printer,
  Banknote,
  Smartphone,
  Wallet,
  Trash2,
  RotateCcw,
  Wifi,
  WifiOff,
  RefreshCw,
  CloudOff,
  Settings,
  Check,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Sidebar from "@/components/Layout/Sidebar";
import Navbar from "@/components/Layout/Navbar";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

// Offline imports
import { useOfflineKassa, CartItem } from "@/hooks/useOfflineKassa";
import { OfflineProduct, offlineDB, generateUUID, saveDefectiveProduct, DefectiveProduct, getAllDefectiveCounts } from "@/db/offlineDB";

// Barcode scanner hook
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";

// POS Print service
import {
  listPrinters,
  requestUSBPrinter,
  printReceipt,
  printTestReceipt,
  openCashDrawer,
  printLabel,
  printProductLabel,
  printBulkLabelsViaBrowser,
  getDefaultPrinterId,
  setDefaultPrinterId,
  getDefaultLabelPrinterId,
  setDefaultLabelPrinterId,
  getPrinterSettings,
  savePrinterSettings,
  getPrinterPaperSettings,
  setPrinterPaperSettings,
  PrinterInfo,
  ReceiptData,
  LabelData,
  ReceiptPaperWidth,
  LabelPaperWidth,
  LabelSize,
  LABEL_SIZE_CONFIGS,
  DEFAULT_LABEL_WIDTH,
  DEFAULT_LABEL_HEIGHT,
} from "@/lib/pos-print";

// Safe number formatting
const formatNum = (n: number | undefined | null): string => {
  if (n === undefined || n === null || isNaN(n)) return "0";
  return n.toLocaleString();
};

// Valyuta belgisini olish
const getCurrencySymbol = (currency?: string): string => {
  switch (currency) {
    case 'USD': return '$';
    case 'RUB': return '₽';
    case 'CNY': return '¥';
    default: return "so'm";
  }
};

// Valyuta rangini olish
const getCurrencyColor = (currency?: string): string => {
  switch (currency) {
    case 'USD': return 'text-green-400';
    case 'RUB': return 'text-purple-400';
    case 'CNY': return 'text-yellow-400';
    default: return 'text-blue-400';
  }
};

/**
 * Quantity Input Component - Har doim bo'sh
 */
function QuantityInput({ value, onChange }: { value: number; onChange: (val: number) => void }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      placeholder="Soni"
      defaultValue=""
      onChange={(e) => {
        const val = parseInt(e.target.value) || 0;
        onChange(val);
      }}
      onFocus={(e) => {
        e.target.value = '';
      }}
      onBlur={(e) => {
        e.target.value = value.toString();
      }}
      onClick={(e) => e.stopPropagation()}
      className="w-16 sm:w-20 lg:w-24 h-6 sm:h-7 lg:h-8 text-center text-xs sm:text-sm font-bold text-slate-200 bg-slate-700/80 border border-slate-600/50 rounded-lg sm:rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
    />
  );
}

// API base URL
const API_BASE_URL = (() => {
  if (typeof window === "undefined") return "";
  // Electron da file:// protokoli ishlatiladi - port 5175
  if (window.location.protocol === "file:") return "http://127.0.0.1:5175";
  const envApiUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envApiUrl && !envApiUrl.includes("YOUR_PUBLIC_IP")) {
    try {
      const u = new URL(envApiUrl);
      if (window.location.protocol === "https:" && u.protocol === "http:") {
        u.protocol = "https:";
      }
      return u.toString().replace(/\/$/, "");
    } catch {
      return envApiUrl;
    }
  }
  return "";
})();

interface PendingCheck {
  id: string;
  items: CartItem[];
  total: number;
  createdAt: number;
}

// Sotuv tarixi uchun alohida item interfeysi (stock kerak emas)
interface SaleHistoryItem {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  price: number;
  quantity: number;
  discount: number;
}

interface SaleHistory {
  id: string;
  items: SaleHistoryItem[];
  total: number;
  date: Date;
  paymentType?: string;
  type?: "sale" | "refund";
  synced?: boolean;
}

export default function Kassa() {
  const { user } = useAuth();
  const userId = user?.id || "";
  const userPhone = user?.phone || "";

  // Yaroqsiz qaytarilgan mahsulotlar soni (xodim qaytarish cheklovi uchun)
  const [defectiveCounts, setDefectiveCounts] = useState<Map<string, number>>(new Map());

  // Offline kassa hook
  const {
    items: checkItems,
    total,
    searchResults,
    isSearching,
    isOnline,
    isLoading,
    isSyncing,
    pendingSalesCount,
    productsCount,
    lastSyncTime,
    error,
    addToCart,
    removeFromCart,
    updateQuantity: updateCartQuantity,
    clearCart,
    search,
    searchBySku,
    searchBySkuWithVariant,
    completeSale,
    triggerSync,
    reloadProducts,
    getProduct,
    refreshCache,
  } = useOfflineKassa(userId, userPhone, defectiveCounts);

  // Local state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [pendingChecks, setPendingChecks] = useState<PendingCheck[]>([]);
  const [pendingChecksOpen, setPendingChecksOpen] = useState(false);
  const [salesHistory, setSalesHistory] = useState<SaleHistory[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleHistory | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const [isRefundMode, setIsRefundMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set()); // Tanlangan mahsulotlar (checkbox)
  const [isDefective, setIsDefective] = useState(false); // Yaroqsiz mahsulotmi?
  const [numpadValue, setNumpadValue] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"today" | "past">("today"); // Tarix filtri: Bugun yoki O'tgan

  // Printer state
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null); // Chek printer
  const [selectedLabelPrinter, setSelectedLabelPrinter] = useState<string | null>(null); // Senik printer
  const [receiptPaperWidth, setReceiptPaperWidth] = useState<ReceiptPaperWidth>(80);
  const [labelPaperWidth, setLabelPaperWidth] = useState<LabelPaperWidth>(40);
  const [labelHeight, setLabelHeight] = useState<number>(30);
  const [printerSettingsOpen, setPrinterSettingsOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<string | null>(null);
  
  // Senik chop etish dialogi - Default: 60x40mm (large)
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [labelDialogItem, setLabelDialogItem] = useState<CartItem | null>(null);
  const [labelQuantity, setLabelQuantity] = useState<number | null>(null);
  const [labelSize, setLabelSize] = useState<LabelSize>('large'); // Default: katta (60x40mm)
  const [labelStock, setLabelStock] = useState<number>(0); // Ombordagi soni
  const [customLabelWidth, setCustomLabelWidth] = useState<number>(DEFAULT_LABEL_WIDTH); // Default: 60mm
  const [customLabelHeight, setCustomLabelHeight] = useState<number>(DEFAULT_LABEL_HEIGHT); // Default: 40mm
  const [useCustomSize, setUseCustomSize] = useState<boolean>(false); // Qo'lda o'lcham ishlatish
  
  // Bulk label (ommaviy senik chop etish) dialogi
  const [bulkLabelOpen, setBulkLabelOpen] = useState(false);
  const [bulkLabelQuantities, setBulkLabelQuantities] = useState<Record<string, number>>({});

  // Yaroqsiz qaytarilgan sonlarni yuklash (barcha foydalanuvchilar uchun)
  useEffect(() => {
    if (userId) {
      getAllDefectiveCounts(userId).then(counts => {
        setDefectiveCounts(counts);
        console.log('[Kassa] Yaroqsiz qaytarilgan sonlar yuklandi:', Object.fromEntries(counts));
      });
    }
  }, [userId]);

  // Dominant valyutani aniqlash - agar barcha mahsulotlar bir xil valyutada bo'lsa
  const dominantCurrency = useMemo(() => {
    if (checkItems.length === 0) return 'UZS';
    
    // Barcha valyutalarni to'plash
    const currencies = checkItems.map(item => item.currency || 'UZS');
    const uniqueCurrencies = [...new Set(currencies)];
    
    // Agar faqat bitta valyuta bo'lsa, uni qaytarish
    if (uniqueCurrencies.length === 1) {
      return uniqueCurrencies[0];
    }
    
    // Agar turli valyutalar bo'lsa, default UZS
    return 'UZS';
  }, [checkItems]);

  // Stock exceeded event listener - omborda yetarli mahsulot yo'q (faqat sotish rejimida)
  useEffect(() => {
    const handleStockExceeded = (e: CustomEvent<{ name: string; stock: number; requested: number }>) => {
      console.log('[Kassa] 📢 Stock exceeded event received:', e.detail);
      
      // Qaytarish rejimida bu xabarni ko'rsatmaslik
      if (isRefundMode) {
        console.log('[Kassa] ⚠️ In refund mode, skipping stock exceeded notification');
        return;
      }
      
      const { name, stock } = e.detail;
      const message = `Omborda yetarli emas! "${name}" - faqat ${stock} ta mavjud`;
      console.log('[Kassa] 📢 Showing stock exceeded toast:', message);
      
      try {
        toast.error(message);
        console.log('[Kassa] ✅ Stock exceeded toast shown successfully');
      } catch (error) {
        console.error('[Kassa] ❌ Failed to show stock exceeded toast:', error);
      }
    };
    
    const handleRefundLimitExceeded = (e: CustomEvent<{ 
      name: string; 
      maxReturn: number; 
      requested: number;
      soldQuantity: number;
      defectiveCount: number;
      initialStock: number;
    }>) => {
      console.log('[Kassa] 🔔 Refund limit exceeded event received:', e.detail);
      console.log('[Kassa] 🔔 Current isRefundMode:', isRefundMode);
      
      // Faqat qaytarish rejimida bu xabarni ko'rsatish
      if (!isRefundMode) {
        console.log('[Kassa] ⚠️ Not in refund mode, skipping notification');
        return;
      }
      
      const { name, maxReturn, soldQuantity, defectiveCount, initialStock } = e.detail;
      const message = `"${name}" - boshlang'ich ${initialStock} ta, ${soldQuantity} ta sotilgan, ${defectiveCount > 0 ? `${defectiveCount} ta yaroqsiz qaytarilgan, ` : ''}${maxReturn} tadan ortiq qaytara olmaysiz!`;
      
      console.log('[Kassa] 📢 Showing refund limit toast:', message);
      
      try {
        toast.error(message, { 
          duration: 15000,
          position: 'top-center',
          style: {
            backgroundColor: '#ef4444',
            color: 'white',
            fontSize: '16px',
            fontWeight: 'bold'
          }
        });
        console.log('[Kassa] ✅ Refund limit toast shown successfully');
      } catch (error) {
        console.error('[Kassa] ❌ Failed to show refund limit toast:', error);
      }
    };
    
    console.log('[Kassa] 🎧 Adding event listeners, isRefundMode:', isRefundMode);
    
    window.addEventListener('stock-exceeded', handleStockExceeded as EventListener);
    window.addEventListener('refund-limit-exceeded', handleRefundLimitExceeded as EventListener);
    
    return () => {
      console.log('[Kassa] 🎧 Removing event listeners');
      window.removeEventListener('stock-exceeded', handleStockExceeded as EventListener);
      window.removeEventListener('refund-limit-exceeded', handleRefundLimitExceeded as EventListener);
    };
  }, [isRefundMode]);

  // Stock tekshirish - agar biror mahsulot miqdori ombordagidan ko'p bo'lsa
  const hasStockError = useMemo(() => {
    // Sotish rejimida: miqdor > stock bo'lsa xato
    if (!isRefundMode) {
      return checkItems.some(item => item.quantity > (item.stock ?? 0));
    }
    
    // Qaytarish rejimida: sotilgan miqdordan ortiq qaytarib bo'lmaydi
    // Sotilgan miqdor = initialStock - stock (boshlang'ich - hozirgi)
    // Maksimal qaytarish = sotilgan miqdor
    return checkItems.some(item => {
      const currentStock = item.stock ?? 0;
      const currentInitialStock = item.initialStock; // MUHIM: Faqat serverdan kelgan qiymat
      // initialStock mavjud bo'lsa tekshirish
      if (currentInitialStock > 0) {
        // Yaroqsiz qaytarilgan sonni olish
        const defectiveKey = item.id.includes('-v') ? item.id : item.productId; // Variant uchun variantId
        const defectiveCount = defectiveCounts.get(defectiveKey) || 0;
        // Sotilgan miqdor = boshlang'ich - hozirgi ombordagi
        const soldQuantity = currentInitialStock - currentStock;
        // Qaytarish miqdori + yaroqsiz qaytarilgan > sotilgan miqdor bo'lsa xato
        return (item.quantity + defectiveCount) > soldQuantity;
      }
      return false;
    });
  }, [checkItems, isRefundMode, defectiveCounts]);

  // Stock xatosi bo'lgan mahsulotlar ro'yxati
  const stockErrorItems = useMemo(() => {
    // Sotish rejimida
    if (!isRefundMode) {
      return checkItems.filter(item => item.quantity > (item.stock ?? 0));
    }
    
    // Qaytarish rejimida: sotilgan miqdordan ortiq qaytarib bo'lmaydi
    return checkItems.filter(item => {
      const currentStock = item.stock ?? 0;
      const currentInitialStock = item.initialStock; // MUHIM: Faqat serverdan kelgan qiymat
      if (currentInitialStock > 0) {
        // Yaroqsiz qaytarilgan sonni olish
        const defectiveKey = item.id.includes('-v') ? item.id : item.productId; // Variant uchun variantId
        const defectiveCount = defectiveCounts.get(defectiveKey) || 0;
        // Sotilgan miqdor = boshlang'ich - hozirgi ombordagi
        const soldQuantity = currentInitialStock - currentStock;
        // Qaytarish miqdori + yaroqsiz qaytarilgan > sotilgan miqdor bo'lsa xato
        return (item.quantity + defectiveCount) > soldQuantity;
      }
      return false;
    });
  }, [checkItems, isRefundMode, defectiveCounts]);

  // Qaytarish cheklovi notification
  useEffect(() => {
    if (isRefundMode && hasStockError && stockErrorItems.length > 0) {
      const errorItem = stockErrorItems[0];
      const defectiveKey = errorItem.id.includes('-v') ? errorItem.id : errorItem.productId; // Variant uchun variantId
      const defectiveCount = defectiveCounts.get(defectiveKey) || 0;
      const currentStock = errorItem.stock ?? 0;
      const currentInitialStock = errorItem.initialStock; // MUHIM: Faqat serverdan kelgan qiymat
      // Sotilgan miqdor = boshlang'ich - hozirgi ombordagi
      const soldQuantity = currentInitialStock - currentStock;
      // Maksimal qaytarish = sotilgan - yaroqsiz qaytarilgan
      const maxReturn = soldQuantity - defectiveCount;
      toast.error(`"${errorItem.name}" - boshlang'ich ${currentInitialStock} ta, ${soldQuantity} ta sotilgan, ${defectiveCount > 0 ? `${defectiveCount} ta yaroqsiz qaytarilgan, ` : ''}${maxReturn > 0 ? maxReturn : 0} tadan ortiq qaytara olmaysiz!`, { duration: 15000 });
    }
  }, [hasStockError, stockErrorItems, isRefundMode, defectiveCounts]);

  // Load printers on mount
  useEffect(() => {
    const loadPrinters = async () => {
      try {
        const printerList = await listPrinters();
        setPrinters(printerList);
        
        // Saqlangan sozlamalarni yuklash
        const settings = getPrinterSettings();
        
        // Chek printer
        const receiptId = settings.receiptPrinterId;
        if (receiptId && printerList.some(p => p.id === receiptId)) {
          setSelectedPrinter(receiptId);
        } else if (printerList.length > 0) {
          setSelectedPrinter(printerList[0].id);
        }
        
        // Senik printer va uning qog'oz o'lchamlari
        const labelId = settings.labelPrinterId;
        if (labelId && printerList.some(p => p.id === labelId)) {
          setSelectedLabelPrinter(labelId);
          // Shu printer uchun saqlangan qog'oz o'lchamlarini yuklash
          const paperSettings = getPrinterPaperSettings(labelId);
          setLabelPaperWidth(paperSettings.width as LabelPaperWidth);
          setLabelHeight(paperSettings.height);
        } else {
          // Default qog'oz o'lchamlari
          setLabelPaperWidth(settings.labelPaperWidth);
          setLabelHeight(settings.labelHeight);
        }
        
        // Chek qog'oz kengligi
        setReceiptPaperWidth(settings.receiptPaperWidth);
      } catch (e) {
        console.error("Failed to load printers:", e);
      }
    };
    loadPrinters();
  }, []);

  // Load pending checks and sales history
  useEffect(() => {
    if (!userId) return;
    const loadLocalData = async () => {
      try {
        // Pending checks from localStorage
        const pendingData = localStorage.getItem(`pendingChecks_${userId}`);
        if (pendingData) setPendingChecks(JSON.parse(pendingData));
        
        // 1. AVVAL serverdan tarixni olish (MongoDB)
        try {
          const apiBase = window.location.protocol === 'file:' 
            ? 'http://127.0.0.1:5174' 
            : (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '');
          
          console.log('[Kassa] Loading sales history from:', `${apiBase}/api/sales/offline`);
          
          const response = await fetch(`${apiBase}/api/sales/offline?userId=${encodeURIComponent(userId)}&limit=50`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.sales)) {
              console.log('[Kassa] Loaded sales history from MongoDB:', data.sales.length);
              
              // Server dan kelgan tarixni formatlash
              const serverHistory = data.sales.map((s: any) => ({
                id: s._id || s.offlineId || s.id,
                items: (s.items || []).map((item: any) => ({
                  id: generateUUID(),
                  productId: item.productId,
                  name: item.name,
                  sku: item.sku,
                  quantity: item.quantity,
                  price: item.price,
                  discount: item.discount || 0,
                })),
                total: s.total,
                date: new Date(s.offlineCreatedAt || s.createdAt),
                paymentType: s.paymentType,
                type: s.saleType || 'sale',
                synced: true, // Server dan kelgan - sinxronlangan
              }));
              
              // 2. IndexedDB dan sinxronlanmagan savdolarni qo'shish
              const localSales = await offlineDB.offlineSales
                .where("userId").equals(userId)
                .filter(s => s.synced === false)
                .reverse()
                .sortBy("createdAt");
              
              const localHistory = localSales.map((s) => ({
                id: s.id,
                items: s.items.map((item) => ({
                  id: generateUUID(),
                  productId: item.productId,
                  name: item.name,
                  sku: item.sku,
                  quantity: item.quantity,
                  price: item.price,
                  discount: item.discount,
                })),
                total: s.total,
                date: new Date(s.createdAt),
                paymentType: s.paymentType,
                type: s.saleType,
                synced: false, // Hali sinxronlanmagan
              }));
              
              console.log('[Kassa] Local unsynced sales:', localHistory.length);
              
              // Birlashtirilgan tarix (local + server)
              const combinedHistory = [...localHistory, ...serverHistory];
              
              // Sanasi bo'yicha tartiblash (eng yangi birinchi)
              combinedHistory.sort((a, b) => b.date.getTime() - a.date.getTime());
              
              setSalesHistory(combinedHistory.slice(0, 50));
              return;
            }
          }
        } catch (serverError) {
          console.error('[Kassa] Failed to load from server, using IndexedDB:', serverError);
        }
        
        // 3. Server xato bersa, faqat IndexedDB dan olish (fallback)
        const sales = await offlineDB.offlineSales.where("userId").equals(userId).reverse().sortBy("createdAt");
        setSalesHistory(
          sales.slice(0, 50).map((s) => ({
            id: s.id,
            items: s.items.map((item) => ({
              id: generateUUID(),
              productId: item.productId,
              name: item.name,
              sku: item.sku,
              quantity: item.quantity,
              price: item.price,
              discount: item.discount,
            })),
            total: s.total,
            date: new Date(s.createdAt),
            paymentType: s.paymentType,
            type: s.saleType,
            synced: s.synced,
          }))
        );
      } catch (err) {
        console.error("Failed to load local data:", err);
      }
    };
    loadLocalData();
  }, [userId]);

  // Save pending checks
  useEffect(() => {
    if (!userId) return;
    localStorage.setItem(`pendingChecks_${userId}`, JSON.stringify(pendingChecks));
  }, [pendingChecks, userId]);

  // Search handler - searchOpen bo'lganda yoki isLoading tugaganda
  useEffect(() => {
    if (searchOpen) search(searchQuery);
  }, [searchQuery, searchOpen, search]);

  // Kassa ochilganda barcha mahsulotlarni yuklash
  useEffect(() => {
    if (!isLoading && productsCount > 0) {
      search(''); // Bo'sh qidiruv - barcha mahsulotlarni ko'rsatish
    }
  }, [isLoading, productsCount, search]);

  // Update quantity wrapper
  const updateQuantity = useCallback(
    (index: number, quantity: number, allowDelete = false) => {
      const item = checkItems[index];
      if (item) updateCartQuantity(item.id, quantity, allowDelete, isRefundMode);
    },
    [checkItems, updateCartQuantity, isRefundMode]
  );

  // Remove item wrapper
  const removeItem = useCallback(
    (index: number) => {
      const item = checkItems[index];
      if (item) removeFromCart(item.id);
    },
    [checkItems, removeFromCart]
  );

  // Add product to cart
  const addProduct = useCallback(
    async (product: OfflineProduct, variantIndex?: number) => {
      // MUHIM: Barcha foydalanuvchilar uchun mahsulot ma'lumotlarini yangilash
      // Qaytarish cheklovi uchun to'g'ri hisoblash kerak
      let freshProduct = product;
      
      // Faqat quyidagi hollarda mahsulot ma'lumotlarini yangilash mumkin:
      // 1. Xodim emas (egasi/admin)
      // 2. Xodim bo'lsa lekin canEditProducts=true
      // 3. Qaytarish rejimi emas
      const canUpdateProduct = user?.role !== 'xodim' || 
                           user?.canEditProducts === true || 
                           !isRefundMode;
      
      if (canUpdateProduct) {
        freshProduct = await getProduct(product.id) || product;
        console.log("[Kassa] ✅ Product updated from server:", freshProduct.name);
      } else {
        console.log("[Kassa] ⚠️ Using cached product data (xodim canEditProducts=false):", freshProduct.name);
      }
      
      if (variantIndex !== undefined && freshProduct.variantSummaries?.[variantIndex]) {
        const variant = freshProduct.variantSummaries[variantIndex];
        const variantStock = variant.stock ?? 0;
        
        // 0 stock variantlarni ham qo'shish mumkin
        console.log("[Kassa] Adding variant with stock:", variantStock);
        
        const variantInitialStock = variant.initialStock; // MUHIM: Faqat serverdan kelgan qiymat, fallback yo'q
        console.log("[Kassa] Variant stock:", variantStock, "initialStock:", variantInitialStock);
        // Stock 0 bo'lsa ham kassaga qo'shish mumkin (faqat qaytarish rejimida)
        const variantId = `${freshProduct.id}-v${variantIndex}`;
        const variantProduct: OfflineProduct = {
          ...freshProduct,
          id: variantId,
          name: variant.name, // Faqat xilning o'z nomi (masalan: "Qizil xodovoy")
          sku: variant.sku || freshProduct.sku,
          barcode: variant.barcode || freshProduct.barcode, // Variant barcode
          price: variant.price || freshProduct.price,
          costPrice: variant.costPrice || freshProduct.costPrice || 0, // Variant asl narxi
          currency: variant.currency || freshProduct.currency || 'UZS', // Xil valyutasi
          stock: variantStock,
          initialStock: variantInitialStock, // Xil uchun initialStock - qaytarish cheklovi uchun
          productId: freshProduct.id, // MUHIM: Asosiy mahsulot ID si - defectiveCounts uchun
          imageUrl: variant.imageUrl || freshProduct.imageUrl
        };
        console.log("[Kassa] ✅ Adding variant to cart:", variantProduct.name);
        addToCart(variantProduct, isRefundMode);
      } else {
        const currentStock = freshProduct.stock ?? 0;
        // 0 stock mahsulotlarni ham qo'shish mumkin
        console.log("[Kassa] Adding product with stock:", currentStock);
        
        const productInitialStock = freshProduct.initialStock; // Faqat serverdan kelgan qiymat
        console.log("[Kassa] Product stock:", currentStock, "initialStock:", productInitialStock);
        // Stock 0 bo'lsa ham kassaga qo'shish mumkin (faqat qaytarish rejimida)
        console.log("[Kassa] ✅ Adding product to cart:", freshProduct.name);
        // initialStock ni qo'shib yuborish
        addToCart({ 
          ...freshProduct, 
          initialStock: productInitialStock,
          productId: freshProduct.id // MUHIM: O'zini ID si - defectiveCounts uchun
        }, isRefundMode);
      }
      setSearchOpen(false);
      setSearchQuery("");
    },
    [addToCart, isRefundMode, getProduct]
  );

  // Add product by SKU
  const addProductBySku = useCallback(
    async (sku: string): Promise<boolean> => {
      console.log("[Kassa] addProductBySku called with:", sku);
      
      try {
        // Variant va asosiy mahsulot SKU ni qidirish
        const result = await searchBySkuWithVariant(sku);
        console.log("[Kassa] searchBySkuWithVariant result:", result);
        
        if (!result) {
          console.log("[Kassa] No product found for SKU:", sku);
          return false;
        }
        
        // Variant yoki asosiy mahsulotni qo'shish
        console.log("[Kassa] Adding product:", result.product.name, "variantIndex:", result.variantIndex);
        await addProduct(result.product, result.variantIndex);
        return true;
      } catch (error) {
        console.error("[Kassa] Error in addProductBySku:", error);
        return false;
      }
    },
    [searchBySkuWithVariant, addProduct]
  );

  // Barcode scanner
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    console.log("[Kassa] 🔍 Barcode scanned:", barcode);
    console.log("[Kassa] Products count:", productsCount);
    setLastScanResult(barcode);
    
    try {
      // Variant va asosiy mahsulot SKU/barcode ni qidirish
      const result = await searchBySkuWithVariant(barcode);
      console.log("[Kassa] Search result:", result);
      
      if (result) {
        console.log("[Kassa] ✅ Barcode found:", result.product.name, "variantIndex:", result.variantIndex);
        await addProduct(result.product, result.variantIndex);
        setTimeout(() => setLastScanResult(null), 2000);
      } else {
        console.log("[Kassa] ❌ Barcode NOT found, opening search dialog");
        // Agar topilmasa, qidiruv oynasini ochish
        setSearchQuery(barcode);
        setSearchOpen(true);
        setTimeout(() => setLastScanResult(null), 3000);
      }
    } catch (error) {
      console.error("[Kassa] Error in handleBarcodeScan:", error);
      setTimeout(() => setLastScanResult(null), 3000);
    }
  }, [searchBySkuWithVariant, addProduct, productsCount]);

  // Scanner enabled holatini log qilish
  const scannerEnabled = !searchOpen && !paymentOpen && !historyOpen && !pendingChecksOpen && !printerSettingsOpen && !labelDialogOpen;
  console.log("[Kassa] Scanner enabled:", scannerEnabled, { searchOpen, paymentOpen, historyOpen, pendingChecksOpen, printerSettingsOpen, labelDialogOpen });

  useBarcodeScanner({
    onScan: handleBarcodeScan,
    minLength: 1,
    scanTimeout: 1000, // 1 sekund
    enabled: scannerEnabled,
    preventDefault: true,
  });

  /**
   * Numpad handler - Kod kiritish uchun
   */
  const numpadValueRef = useRef(numpadValue);
  numpadValueRef.current = numpadValue;
  
  const handleNumpadPress = useCallback(
    (key: string) => {
      if (key === "C") {
        // Tozalash
        setNumpadValue("");
        return;
      }
      
      if (key === "⌫") {
        // Orqaga o'chirish
        setNumpadValue((prev) => prev.slice(0, -1));
        return;
      }
      
      if (key === "OK") {
        // Mahsulot qo'shish - ref dan o'qish
        const currentValue = numpadValueRef.current;
        if (currentValue && currentValue.trim()) {
          addProductBySku(currentValue.trim()).catch(console.error);
        }
        setNumpadValue(""); // Har doim tozalash
        return;
      }
      
      // Raqamlar va "00"
      if (key === "00") {
        setNumpadValue((prev) => prev + "00");
        return;
      }
      
      if (/^\d$/.test(key)) {
        setNumpadValue((prev) => prev + key);
        return;
      }
    },
    [addProductBySku]
  );

  // Scanner buffer - tez kiritilgan raqamlarni aniqlash uchun
  const scannerBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const scannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Keyboard handler - scanner va numpad ni ajratish
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
      if (e.key === "F3") { e.preventDefault(); setSearchOpen(true); return; }
      if (e.key === "Escape") { setSearchOpen(false); return; }
      if (searchOpen || paymentOpen || historyOpen || pendingChecksOpen || isInputFocused) return;
      
      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      
      // Raqam kiritilganda
      if (/^[0-9]$/.test(e.key)) {
        // Agar tez kiritilayotgan bo'lsa (50ms ichida) - bu scanner
        if (timeSinceLastKey < 50 && scannerBufferRef.current.length > 0) {
          // Scanner - numpad ga yubormaslik
          scannerBufferRef.current += e.key;
          lastKeyTimeRef.current = now;
          
          // Timeout ni yangilash
          if (scannerTimeoutRef.current) {
            clearTimeout(scannerTimeoutRef.current);
          }
          scannerTimeoutRef.current = setTimeout(() => {
            scannerBufferRef.current = '';
          }, 500);
          return; // Numpad ga yubormaslik!
        }
        
        // Birinchi raqam - bufferni boshlash
        scannerBufferRef.current = e.key;
        lastKeyTimeRef.current = now;
        
        // Timeout - agar keyingi raqam tez kelmasa, numpad ga yuborish
        if (scannerTimeoutRef.current) {
          clearTimeout(scannerTimeoutRef.current);
        }
        scannerTimeoutRef.current = setTimeout(() => {
          // Agar faqat 1-2 ta raqam bo'lsa va tez kiritilmagan bo'lsa - numpad
          if (scannerBufferRef.current.length <= 2) {
            // Numpad ga yuborish
            for (const digit of scannerBufferRef.current) {
              handleNumpadPress(digit);
            }
          }
          scannerBufferRef.current = '';
        }, 100);
        
        e.preventDefault();
        return;
      }
      
      // Enter - agar scanner buffer bo'sh bo'lsa, numpad OK
      if (e.key === "Enter" || e.key === "+" || e.key === "Add") {
        // Agar scanner buffer da raqamlar bo'lsa - bu scanner, useBarcodeScanner handle qiladi
        if (scannerBufferRef.current.length >= 3) {
          scannerBufferRef.current = '';
          return; // Scanner hook handle qiladi
        }
        e.preventDefault();
        handleNumpadPress("OK");
        return;
      }
      
      if (e.key === "." || e.key === "Decimal") { e.preventDefault(); handleNumpadPress("."); return; }
      if (e.key === "Backspace") { e.preventDefault(); handleNumpadPress("⌫"); return; }
      if (e.key === "Delete" || (e.key.toLowerCase() === "c" && !e.ctrlKey)) { e.preventDefault(); handleNumpadPress("C"); return; }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (scannerTimeoutRef.current) {
        clearTimeout(scannerTimeoutRef.current);
      }
    };
  }, [searchOpen, paymentOpen, historyOpen, pendingChecksOpen, handleNumpadPress]);

  // Save pending check
  const savePendingCheck = useCallback(() => {
    if (checkItems.length === 0) return;
    const newCheck: PendingCheck = { id: generateUUID(), items: [...checkItems], total, createdAt: Date.now() };
    setPendingChecks((prev) => [...prev, newCheck]);
    clearCart();
  }, [checkItems, total, clearCart]);

  // Restore pending check
  const restorePendingCheck = useCallback(
    (check: PendingCheck) => {
      check.items.forEach((item) => {
        const product = getProduct(item.productId);
        if (product) for (let i = 0; i < item.quantity; i++) addToCart(product, isRefundMode);
      });
      setPendingChecks((prev) => prev.filter((c) => c.id !== check.id));
      setPendingChecksOpen(false);
    },
    [addToCart, getProduct, isRefundMode]
  );

  // Delete pending check
  const deletePendingCheck = useCallback((checkId: string) => {
    setPendingChecks((prev) => prev.filter((c) => c.id !== checkId));
  }, []);

  // Do'kon ma'lumotlari (chek uchun)
  const storeInfo = {
    storeName: user?.name ? `🚛 AVTOFIX - ${user.name}` : "🚛 AVTOFIX - Avtoehtiyot qismlari do'koni",
    storeAddress: user?.address || "",
    storePhone: user?.phone || "",
  };

  // Complete payment
  const handlePayment = useCallback(
    async (paymentType: string) => {
      // Ikki marta bosishni oldini olish
      if (isProcessingPayment) return;
      setIsProcessingPayment(true);
      
      try {
      // Agar yaroqsiz qaytarish bo'lsa - stock o'zgarmaydi, faqat defectiveProducts ga qo'shiladi
      // MUHIM: initialStock oshiriladi (qaytarish cheklovi uchun)
      if (isRefundMode && isDefective) {
        // Yaroqsiz mahsulotlarni saqlash
        const refundId = generateUUID();
        const receiptNumber = `DEF-${Date.now().toString(36).toUpperCase()}`;
        
        for (const item of checkItems) {
          const defective: DefectiveProduct = {
            id: generateUUID(),
            productId: item.productId,
            productName: item.name,
            sku: item.sku,
            quantity: item.quantity,
            price: item.price,
            refundId,
            createdAt: Date.now(),
            userId,
          };
          await saveDefectiveProduct(defective);
        }
        
        // Tarixga qo'shish (lekin stock o'zgarmaydi)
        setSalesHistory((prev) => [{
          id: refundId,
          items: checkItems.map((item) => ({
            id: generateUUID(), productId: item.productId, name: item.name, sku: item.sku,
            quantity: item.quantity, price: item.price, discount: item.discount,
          })),
          total, date: new Date(), paymentType,
          type: "refund", synced: false,
        }, ...prev]);
        
        // Chek chiqarish - yaroqsiz qaytarish uchun ham
        setIsPrinting(true);
        try {
          const receiptData: ReceiptData = {
            type: "defectiveRefund",
            items: checkItems.map((item) => ({ name: item.name, sku: item.sku, quantity: item.quantity, price: item.price, discount: item.discount })),
            total, 
            discount: 0, 
            paymentType, 
            cashier: user?.name,
            date: new Date(), 
            receiptNumber,
            storeName: storeInfo.storeName,
            storeAddress: storeInfo.storeAddress,
            storePhone: storeInfo.storePhone,
          };
          await printReceipt(selectedPrinter, receiptData);
        } catch (e) { 
          console.error("Print error:", e); 
        } finally { 
          setIsPrinting(false); 
        }
        
        // Yaroqsiz qaytarilgan sonlarni yangilash (barcha foydalanuvchilar uchun)
        const newCounts = new Map(defectiveCounts);
        for (const item of checkItems) {
          // MUHIM: Variantlar uchun variantId, asosiy mahsulot uchun productId
          const key = item.id.includes('-v') ? item.id : item.productId; // Agar variant bo'lsa, o'zini ID sini ishlat
          const current = newCounts.get(key) || 0;
          newCounts.set(key, current + item.quantity);
          console.log(`[Kassa] Updating defective count for ${item.name}: ${key} ${current} -> ${current + item.quantity}`);
        }
        setDefectiveCounts(newCounts);
        
        // Yaroqsiz qaytarilgan sonlarni qayta yuklash (database dan)
        getAllDefectiveCounts(userId).then(counts => {
          setDefectiveCounts(counts);
          console.log('[Kassa] Yaroqsiz qaytarilgan sonlar yangilandi:', Object.fromEntries(counts));
        });
        
        toast.success("Yaroqsiz mahsulotlar qayd etildi");
        clearCart();
        setPaymentOpen(false);
        setIsRefundMode(false);
        setIsDefective(false);
        return;
      }
      
      // Oddiy sotuv yoki yaroqli qaytarish
      const sale = await completeSale(paymentType, isRefundMode ? "refund" : "sale");
      if (sale) {
        setSalesHistory((prev) => [{
          id: sale.id,
          items: sale.items.map((item) => ({
            id: generateUUID(), productId: item.productId, name: item.name, sku: item.sku,
            quantity: item.quantity, price: item.price, discount: item.discount,
          })),
          total: sale.total, date: new Date(sale.createdAt), paymentType: sale.paymentType,
          type: sale.saleType, synced: sale.synced,
        }, ...prev]);
        setIsPrinting(true);
        try {
          const receiptData: ReceiptData = {
            type: isRefundMode ? "refund" : "sale",
            items: sale.items.map((item) => ({ name: item.name, sku: item.sku, quantity: item.quantity, price: item.price, discount: item.discount })),
            total: sale.total, 
            discount: sale.discount, 
            paymentType, 
            cashier: user?.name,
            date: new Date(sale.createdAt), 
            receiptNumber: sale.recipientNumber,
            // Do'kon ma'lumotlari
            storeName: storeInfo.storeName,
            storeAddress: storeInfo.storeAddress,
            storePhone: storeInfo.storePhone,
          };
          await printReceipt(selectedPrinter, receiptData);
        } catch (e) { console.error("Print error:", e); }
        finally { setIsPrinting(false); }
        setPaymentOpen(false);
        if (isRefundMode) {
          setIsRefundMode(false);
          setIsDefective(false);
        }
      }
      } catch (error) {
        console.error("Payment error:", error);
        toast.error("To'lov xatosi yuz berdi");
      } finally {
        setIsProcessingPayment(false);
      }
    },
    [completeSale, isRefundMode, isDefective, checkItems, total, userId, clearCart, selectedPrinter, user, storeInfo, defectiveCounts, isProcessingPayment]
  );


  return (
    <div className="min-h-screen bg-gray-900/80 dark:bg-gray-900/80 text-foreground">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onCollapsedChange={setSidebarCollapsed} />
      <Navbar
        onMenuClick={() => setSidebarOpen(true)}
        sidebarCollapsed={sidebarCollapsed}
        rightSlot={
          <div className="flex items-center gap-2">
            {/* Status Indicators */}
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-medium backdrop-blur-sm ${isOnline ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isOnline ? "Online" : "Offline"}</span>
            </div>
            {pendingSalesCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium">
                <CloudOff className="w-3.5 h-3.5" />
                <span>{pendingSalesCount}</span>
              </div>
            )}
            {lastScanResult && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs animate-pulse">
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline truncate max-w-20">{lastScanResult}</span>
              </div>
            )}
            {isOnline && (
              <button onClick={async () => { await reloadProducts(); await triggerSync(); }} disabled={isSyncing || isLoading} className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${isSyncing || isLoading ? "animate-spin" : ""}`} />
              </button>
            )}
            <button onClick={() => setHistoryOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/50 text-slate-300 hover:bg-slate-700/80 hover:border-slate-600/50 transition-all shadow-lg">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline text-sm font-medium">Tarix</span>
              {salesHistory.length > 0 && <span className="bg-emerald-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">{salesHistory.length}</span>}
            </button>
            <button onClick={() => setPendingChecksOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/50 text-slate-300 hover:bg-slate-700/80 hover:border-slate-600/50 transition-all shadow-lg">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline text-sm font-medium">Saqlangan</span>
              {pendingChecks.length > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">{pendingChecks.length}</span>}
            </button>
          </div>
        }
      />

      <div className={`pt-12 sm:pt-14 lg:pt-16 transition-all duration-300 ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-72 xl:pl-80"}`}>
        {isRefundMode && (
          <div className="bg-orange-600 text-white py-3 px-4 flex items-center justify-center gap-2">
            <RotateCcw className="w-5 h-5" />
            <span className="font-bold text-sm tracking-wide">QAYTARISH REJIMI</span>
          </div>
        )}

        {/* Loader olib tashlandi - asosiy WebGLLoader ishlatiladi */}

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 text-sm font-medium">
            Xatolik: {error}
          </div>
        )}

        {/* ===== MAIN POS LAYOUT ===== */}
        <main className="p-2 sm:p-3 md:p-4 lg:p-5 xl:p-6 h-[calc(100vh-4rem)] overflow-hidden">
          <div className="h-full flex flex-col gap-2 sm:gap-3 md:gap-4">
            
            {/* TOTAL CARD - Responsive Design */}
            <div className={`rounded-lg p-3 sm:p-4 lg:p-5 border flex-shrink-0 ${isRefundMode ? "bg-gradient-to-br from-slate-900 via-blue-950/30 to-slate-900 border-orange-600" : "bg-gradient-to-br from-slate-900 via-blue-950/30 to-slate-900 border-red-600"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-shrink-0">
                  <span className={`text-xs sm:text-sm font-semibold uppercase tracking-wider ${isRefundMode ? "text-orange-400" : "text-red-400"}`}>
                    {isRefundMode ? "Qaytarish:" : "Jami:"}
                  </span>
                  {checkItems.length > 0 && (
                    <div className="text-slate-500 text-[10px] sm:text-xs mt-0.5 sm:mt-1 font-medium">{checkItems.length} ta • {checkItems.reduce((sum, item) => sum + item.quantity, 0)} dona</div>
                  )}
                </div>
                <div className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight whitespace-nowrap ${isRefundMode ? "text-orange-400" : "text-green-400"}`}>
                  <span className="text-green-400 mr-1">$</span>
                  {formatNum(total)}
                </div>
              </div>
            </div>

            {/* Middle Section: Table + Numpad - Responsive Grid */}
            <div className="flex-1 flex flex-col lg:flex-row gap-2 sm:gap-3 md:gap-4 min-h-0 overflow-auto lg:overflow-hidden">
              
              {/* TABLE CONTAINER - Responsive */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden order-2 lg:order-1">
                <div className={`flex-1 bg-gradient-to-br from-slate-900 via-blue-950/30 to-slate-900 rounded-lg border overflow-hidden flex flex-col ${isRefundMode ? "border-orange-600/50" : "border-gray-700"}`}>
                  
                  {/* Table Header - Responsive */}
                  <div className="bg-gray-800 border-b border-gray-700 flex-shrink-0 overflow-x-auto">
                    <div className="grid grid-cols-[24px_40px_1fr_50px_70px_80px_90px_70px] sm:grid-cols-[28px_50px_1fr_60px_80px_100px_110px_80px] lg:grid-cols-[32px_60px_1fr_70px_90px_110px_130px_90px] gap-1 sm:gap-2 lg:gap-3 px-2 sm:px-3 lg:px-4 py-2 sm:py-3 lg:py-4 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider min-w-[600px]">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={checkItems.length > 0 && selectedItems.size === checkItems.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems(new Set(checkItems.map(item => item.id)));
                            } else {
                              setSelectedItems(new Set());
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                          title="Hammasini tanlash"
                        />
                      </div>
                      <div>Kod</div>
                      <div>Mahsulot</div>
                      <div className="text-center">Ombor</div>
                      <div className="text-center">Soni</div>
                      <div className="text-right">Narxi</div>
                      <div className="text-right">Summa</div>
                      <div className="text-center">Amallar</div>
                    </div>
                  </div>

                  {/* Table Body - Responsive with scroll */}
                  <div className="flex-1 overflow-auto">
                    {checkItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full min-h-[120px] sm:min-h-[150px] lg:min-h-[200px] text-slate-500 gap-2 sm:gap-3 p-4">
                        <Search className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 opacity-30" />
                        <span className="text-xs sm:text-sm font-medium text-center">F3 yoki "Qidirish" tugmasini bosing</span>
                        <span className="text-[10px] sm:text-xs text-slate-600">{productsCount} ta mahsulot</span>
                      </div>
                    ) : (
                      <div className="min-w-[500px]">
                        {checkItems.map((item, index) => {
                          const itemTotal = item.quantity * item.price;
                          
                          // Ombor ustuni: refund mode da stock + quantity, sale mode da stock - quantity
                          const calculatedStock = isRefundMode 
                            ? (item.stock || 0) + item.quantity  // Qaytarish: stock ko'payadi
                            : (item.stock || 0) - item.quantity; // Sotish: stock kamayadi
                          
                          const currentStock = Math.max(0, calculatedStock);
                          const stockColor = currentStock <= 0 ? "text-red-400" : currentStock <= 5 ? "text-yellow-400" : "text-emerald-400";
                          
                          return (
                            <div
                              key={item.id}
                              className={`grid grid-cols-[24px_40px_1fr_50px_70px_80px_90px_70px] sm:grid-cols-[28px_50px_1fr_60px_80px_100px_110px_80px] lg:grid-cols-[32px_60px_1fr_70px_90px_110px_130px_90px] gap-1 sm:gap-2 lg:gap-3 px-2 sm:px-3 lg:px-4 py-2 sm:py-3 lg:py-4 border-b border-slate-700/30 cursor-pointer transition-all hover:bg-slate-700/30 ${selectedItems.has(item.id) ? "bg-blue-500/10" : ""}`}
                              onClick={(e) => {
                                // Agar input yoki button bosilgan bo'lsa, e'tiborsiz qoldirish
                                const target = e.target as HTMLElement;
                                if (target.closest('input') || target.closest('button')) {
                                  return;
                                }
                                // Checkbox ni toggle qilish
                                const newSelected = new Set(selectedItems);
                                if (selectedItems.has(item.id)) {
                                  newSelected.delete(item.id);
                                } else {
                                  newSelected.add(item.id);
                                }
                                setSelectedItems(newSelected);
                              }}
                            >
                              {/* Checkbox */}
                              <div className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={selectedItems.has(item.id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const newSelected = new Set(selectedItems);
                                    if (e.target.checked) {
                                      newSelected.add(item.id);
                                    } else {
                                      newSelected.delete(item.id);
                                    }
                                    setSelectedItems(newSelected);
                                  }}
                                  className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                                />
                              </div>
                              <div className="text-[10px] sm:text-xs text-purple-400 font-bold self-center truncate">{item.sku || "-"}</div>
                              <div className="text-xs sm:text-sm text-slate-200 self-center font-medium min-w-0 overflow-hidden">
                                <div className="overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent hover:scrollbar-thumb-slate-500 pb-0.5 pr-2" title={item.name}>
                                  {item.name}
                                </div>
                              </div>
                              <div className={`text-[10px] sm:text-xs font-bold self-center text-center ${stockColor}`}>{currentStock}</div>
                              <div className="flex items-center justify-center">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  placeholder="Soni"
                                  value={item.quantity || ""}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    updateQuantity(index, val);
                                  }}
                                  onFocus={(e) => {
                                    e.target.value = '';
                                  }}
                                  onBlur={(e) => {
                                    e.target.value = item.quantity.toString();
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-16 sm:w-20 lg:w-24 h-6 sm:h-7 lg:h-8 text-center text-xs sm:text-sm font-bold text-slate-200 bg-slate-700/80 border border-slate-600/50 rounded-lg sm:rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                />
                              </div>
                              <div className="text-right text-[10px] sm:text-xs lg:text-sm text-slate-400 self-center font-medium truncate">{formatNum(item.price)}</div>
                              <div className="text-right text-[10px] sm:text-xs lg:text-sm font-bold text-slate-200 self-center overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-slate-600" title={formatNum(itemTotal)}>
                                {formatNum(itemTotal)}
                              </div>
                              <div className="flex justify-center self-center gap-1">
                                <button 
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    // Senik dialog ochish - Default: 60x40mm
                                    setLabelDialogItem(item);
                                    setLabelQuantity(null); // Bo'sh - foydalanuvchi o'zi kiritadi
                                    setLabelSize('large'); // Default: katta (60x40mm)
                                    setCustomLabelWidth(DEFAULT_LABEL_WIDTH); // 60mm
                                    setCustomLabelHeight(DEFAULT_LABEL_HEIGHT); // 40mm
                                    setUseCustomSize(false); // Tayyor razmer ishlatish
                                    // Ombordagi sonini olish
                                    const product = getProduct(item.productId);
                                    setLabelStock(product?.stock || 0);
                                    setLabelDialogOpen(true);
                                  }} 
                                  disabled={isPrinting}
                                  className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-lg sm:rounded-xl bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 flex items-center justify-center transition-all disabled:opacity-50"
                                  title="Senik chop etish"
                                >
                                  <Tag className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4" />
                                </button>
                                <button 
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    removeItem(index); 
                                  }} 
                                  className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-lg sm:rounded-xl bg-red-500/20 hover:bg-red-500/40 text-red-400 flex items-center justify-center transition-all"
                                >
                                  <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Table Footer - Responsive */}
                  <div className="border-t border-gray-700 bg-gray-800 px-2 sm:px-3 lg:px-4 py-2 sm:py-3 lg:py-4 flex-shrink-0">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">Jami:</span>
                      <span className="text-lg sm:text-xl lg:text-2xl font-black text-green-400 truncate">
                        <span className="text-green-400 mr-1">$</span>
                        {formatNum(total)}
                      </span>
                    </div>
                    {/* Tanlanganni o'chirish va Hammasidan senik tugmalari */}
                    {checkItems.length > 0 && (
                      <div className="mt-3 flex gap-2">
                        {/* Tanlanganni o'chirish tugmasi */}
                        {selectedItems.size > 0 && (
                          <button
                            onClick={() => {
                              // Tanlangan mahsulotlarni o'chirish
                              selectedItems.forEach(itemId => {
                                removeFromCart(itemId);
                              });
                              setSelectedItems(new Set());
                              toast.success(`${selectedItems.size} ta mahsulot o'chirildi`);
                            }}
                            className="flex-1 py-2 px-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            {selectedItems.size} ta o'chirish
                          </button>
                        )}
                        <button
                          onClick={() => {
                            // Har bir mahsulot uchun default soni = 1
                            const quantities: Record<string, number> = {};
                            checkItems.forEach(item => {
                              quantities[item.id] = 1;
                            });
                            setBulkLabelQuantities(quantities);
                            setBulkLabelOpen(true);
                          }}
                          className="flex-1 py-2 px-3 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-400 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2"
                        >
                          <Tag className="w-4 h-4" />
                          Hammasidan senik
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ===== RIGHT SIDE: NUMPAD ===== */}
              <div className="w-full lg:w-[280px] xl:w-[320px] 2xl:w-[360px] flex-shrink-0 order-1 lg:order-2">
                {/* NUMPAD CARD - Telefonda kattaroq */}
                <div className={`bg-gradient-to-br from-slate-900 via-blue-950/30 to-slate-900 rounded-xl border overflow-hidden flex flex-col h-full p-3 sm:p-4 ${isRefundMode ? "border-orange-600/50" : "border-gray-700"}`}>
                  
                  {/* Code Input */}
                  <input
                    type="text"
                    placeholder="Kod kiriting..."
                    value={numpadValue}
                    onChange={(e) => setNumpadValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const value = e.currentTarget.value.trim();
                        if (value) {
                          addProductBySku(value).catch(console.error);
                        }
                        setNumpadValue(""); // Har doim tozalash
                      }
                    }}
                    className="w-full h-12 sm:h-14 mb-3 sm:mb-4 text-center text-lg sm:text-xl font-bold bg-gray-800 text-white placeholder:text-gray-500 rounded-xl border border-gray-700 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all"
                    autoComplete="off"
                  />

                  {/* Numpad Grid - 4x4 layout - Kattaroq tugmalar */}
                  <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
                    {/* Row 1: 7, 8, 9, C */}
                    {["7", "8", "9"].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleNumpadPress(key)}
                        className="aspect-square rounded-xl text-xl sm:text-2xl font-bold bg-slate-800/80 text-white border border-slate-600/50 hover:bg-slate-700 hover:border-slate-500 active:bg-slate-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all flex items-center justify-center touch-manipulation shadow-lg shadow-black/20"
                      >
                        {key}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleNumpadPress("C")}
                      className="aspect-square rounded-xl text-xl sm:text-2xl font-bold bg-red-500 text-white hover:bg-red-400 active:bg-red-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all flex items-center justify-center touch-manipulation shadow-lg shadow-red-500/30"
                    >
                      C
                    </button>

                    {/* Row 2: 4, 5, 6, ⌫ */}
                    {["4", "5", "6"].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleNumpadPress(key)}
                        className="aspect-square rounded-xl text-xl sm:text-2xl font-bold bg-slate-800/80 text-white border border-slate-600/50 hover:bg-slate-700 hover:border-slate-500 active:bg-slate-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all flex items-center justify-center touch-manipulation shadow-lg shadow-black/20"
                      >
                        {key}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleNumpadPress("⌫")}
                      className="aspect-square rounded-xl text-xl sm:text-2xl font-bold bg-orange-500 text-white hover:bg-orange-400 active:bg-orange-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-orange-400/50 transition-all flex items-center justify-center touch-manipulation shadow-lg shadow-orange-500/30"
                    >
                      ⌫
                    </button>

                    {/* Row 3: 1, 2, 3, + (spans 2 rows) */}
                    {["1", "2", "3"].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleNumpadPress(key)}
                        className="aspect-square rounded-xl text-xl sm:text-2xl font-bold bg-slate-800/80 text-white border border-slate-600/50 hover:bg-slate-700 hover:border-slate-500 active:bg-slate-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all flex items-center justify-center touch-manipulation shadow-lg shadow-black/20"
                      >
                        {key}
                      </button>
                    ))}
                    <button 
                      type="button"
                      onClick={() => handleNumpadPress("OK")} 
                      className="row-span-2 rounded-xl text-2xl sm:text-3xl font-bold bg-emerald-500 text-white hover:bg-emerald-400 active:bg-emerald-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all flex items-center justify-center touch-manipulation shadow-lg shadow-emerald-500/30"
                    >
                      +
                    </button>

                    {/* Row 4: 0, 00 */}
                    {["0", "00"].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleNumpadPress(key)}
                        className="aspect-square rounded-xl text-xl sm:text-2xl font-bold bg-slate-800/80 text-white border border-slate-600/50 hover:bg-slate-700 hover:border-slate-500 active:bg-slate-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all flex items-center justify-center touch-manipulation shadow-lg shadow-black/20"
                      >
                        {key}
                      </button>
                    ))}
                    {/* Bo'sh joy */}
                    <div className="aspect-square"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS - Footer - Mobile: faqat icon, Desktop: icon + matn */}
            <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 flex-shrink-0">
              {/* Search Button */}
              <button 
                onClick={() => setSearchOpen(true)} 
                className="flex items-center justify-center gap-2 p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-red-500/20"
              >
                <Search className="w-5 h-5" />
                <span className="hidden sm:inline">Qidirish</span>
              </button>

              {/* Qaytarish tugmasi */}
              {!isRefundMode ? (
                // Oddiy holat - Qaytarish tugmasi
                <button 
                  onClick={() => {
                    setIsRefundMode(true);
                    refreshCache(); // Cache ni tozalash
                    console.log('[Kassa] 🔄 Switched to refund mode, cache refreshed');
                    
                    // Test notification
                    toast.success('Qaytarish rejimiga o\'tildi! Validation ishlaydi.', { duration: 3000 });
                  }} 
                  className="flex items-center justify-center gap-1.5 p-2 sm:px-4 sm:py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-all active:scale-95 shadow-lg shadow-orange-500/20"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Qaytarish</span>
                </button>
              ) : (
                // Qaytarish rejimi faol
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setIsRefundMode(false);
                      setIsDefective(false);
                      setSelectedItems(new Set());
                    }} 
                    className="flex items-center justify-center gap-1.5 p-2 sm:px-4 sm:py-2.5 rounded-xl bg-orange-500 text-white font-bold text-xs transition-all active:scale-95 shadow-lg shadow-orange-500/20 ring-2 ring-orange-400"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Qaytarish</span>
                  </button>
                  
                  {/* Test notification button */}
                  <button 
                    onClick={() => {
                      console.log('[Kassa] 🧪 Testing refund validation notification');
                      
                      // Test the event system
                      try {
                        const testEvent = new CustomEvent('refund-limit-exceeded', { 
                          detail: { 
                            name: 'Test mahsulot', 
                            maxReturn: 5,
                            requested: 10,
                            soldQuantity: 8,
                            defectiveCount: 3,
                            initialStock: 15
                          },
                          bubbles: true,
                          cancelable: true
                        });
                        
                        console.log('[Kassa] 🧪 Dispatching test event');
                        window.dispatchEvent(testEvent);
                        
                        // Also test direct toast
                        setTimeout(() => {
                          toast.error('Bu test xabari - agar ko\'rsangiz, toast ishlaydi!', { 
                            duration: 5000,
                            position: 'top-center'
                          });
                        }, 1000);
                        
                      } catch (error) {
                        console.error('[Kassa] 🧪 Test failed:', error);
                        alert('Test xatosi: ' + error.message);
                      }
                    }} 
                    className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                    title="Notification tizimini test qilish"
                  >
                    🧪
                  </button>
                  
                  {/* API Test button */}
                  <button 
                    onClick={async () => {
                      console.log('[Kassa] 🔍 Testing API directly...');
                      
                      try {
                        const userId = user?.id || '';
                        const userPhone = user?.phone || '';
                        const timestamp = Date.now();
                        const randomId = Math.random().toString(36).substring(7);
                        
                        const apiBase = window.location.protocol === 'file:' 
                          ? 'http://127.0.0.1:5174' 
                          : (import.meta.env.VITE_API_BASE_URL || '');
                        
                        const url = `${apiBase}/api/products?userId=${userId}&userPhone=${userPhone}&limit=5&_t=${timestamp}&_r=${randomId}&_nocache=true`;
                        
                        console.log('[Kassa] 🔍 API URL:', url);
                        
                        const response = await fetch(url, {
                          method: 'GET',
                          headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                            'Pragma': 'no-cache',
                            'Expires': '0'
                          }
                        });
                        
                        if (response.ok) {
                          const data = await response.json();
                          console.log('[Kassa] 🔍 API Response:', data.length, 'products');
                          
                          if (data.length > 0) {
                            const firstProduct = data[0];
                            console.log('[Kassa] 🔍 First product:');
                            console.log('SKU:', firstProduct.sku);
                            console.log('Name:', firstProduct.name);
                            console.log('Stock:', firstProduct.stock);
                            console.log('InitialStock:', firstProduct.initialStock);
                            console.log('InitialStock type:', typeof firstProduct.initialStock);
                            
                            toast.success(`API Test: ${data.length} products, first initialStock: ${firstProduct.initialStock}`, { duration: 5000 });
                          }
                        } else {
                          console.error('[Kassa] 🔍 API Error:', response.status);
                          toast.error(`API Error: ${response.status}`, { duration: 3000 });
                        }
                        
                      } catch (error) {
                        console.error('[Kassa] 🔍 API Test failed:', error);
                        toast.error('API Test failed: ' + error.message, { duration: 3000 });
                      }
                    }} 
                    className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-xs transition-all active:scale-95 shadow-lg shadow-green-500/20"
                    title="API ni to'g'ridan-to'g'ri test qilish"
                  >
                    🔍
                  </button>
                </div>
              )}

              {/* Save Check */}
              <button 
                onClick={savePendingCheck} 
                disabled={checkItems.length === 0}
                className="flex items-center justify-center gap-2 p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-sm border border-slate-600/50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-black/20"
              >
                <Pause className="w-5 h-5" />
                <span className="hidden sm:inline">Saqlash</span>
              </button>

              {/* Payment Button */}
              <button
                onClick={() => {
                  if (hasStockError) {
                    if (isRefundMode) {
                      // Qaytarish cheklovi xabari
                      const errorNames = stockErrorItems.map(i => {
                        const defectiveKey = i.id.includes('-v') ? i.id : i.productId; // Variant uchun variantId
                        const defectiveCount = defectiveCounts.get(defectiveKey) || 0;
                        const iStock = i.stock ?? 0;
                        const iInitialStock = i.initialStock; // MUHIM: Faqat serverdan kelgan qiymat
                        const soldQuantity = iInitialStock - iStock;
                        const maxReturn = soldQuantity - defectiveCount;
                        return `"${i.name}" (max ${maxReturn > 0 ? maxReturn : 0} ta)`;
                      }).join(', ');
                      toast.error(`Sotilgan miqdordan ortiq qaytara olmaysiz: ${errorNames}`);
                    } else {
                      const errorNames = stockErrorItems.map(i => `"${i.name}" (${i.quantity}/${i.stock ?? 0})`).join(', ');
                      toast.error(`Omborda yetarli emas: ${errorNames}`);
                    }
                    return;
                  }
                  setPaymentOpen(true);
                }}
                disabled={checkItems.length === 0 || hasStockError}
                className={`flex items-center justify-center gap-2 p-2.5 sm:px-5 sm:py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                  hasStockError
                    ? "bg-red-500 text-white shadow-red-500/20"
                    : isRefundMode 
                      ? "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20" 
                      : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
                }`}
                title={hasStockError ? (isRefundMode ? 'Sotilgan miqdordan ortiq qaytara olmaysiz' : `Omborda yetarli emas: ${stockErrorItems.map(i => i.name).join(', ')}`) : ''}
              >
                <CreditCard className="w-5 h-5" />
                <span className="hidden sm:inline">{hasStockError ? "Yetarli emas" : isRefundMode ? "Qaytarish" : "To'lov"}</span>
              </button>

              {/* Spacer */}
              <div className="flex-1 min-w-0" />
            </div>
          </div>
        </main>
      </div>


      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl xl:max-w-3xl bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border-slate-700/50 backdrop-blur-xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-slate-200 text-xl font-bold flex items-center gap-3">
              <Search className="w-5 h-5 text-red-400" />
              Mahsulot qidirish
              {!isOnline && <span className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full font-medium">Offline</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nom yoki shtrix-kod kiriting..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="bg-slate-800/80 border-slate-700/50 text-slate-200 h-14 text-base rounded-2xl px-5"
            />
            <div className="max-h-[55vh] overflow-auto space-y-2 pr-2">
              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                  <span className="ml-3 text-slate-400 font-medium">Qidirilmoqda...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center text-slate-500 py-12">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  {searchQuery ? "Mahsulot topilmadi" : `Qidirish uchun yozing... (${productsCount} ta mahsulot)`}
                </div>
              ) : (
                searchResults.slice(0, 50).map((result) => {
                  // Yangi SearchResult interfeysi bilan ishlash
                  const isVariantResult = result.isVariant;
                  const displayStock = result.displayStock;
                  const displayPrice = result.displayPrice;
                  const displayName = result.displayName;
                  const parentName = result.parentProductName;
                  const displaySku = result.displaySku;
                  const isOutOfStock = displayStock <= 0;
                  
                  return (
                    <div
                      key={isVariantResult ? `${result.product.id}-v${result.variantIndex}` : result.product.id}
                      className={`p-2.5 border-2 rounded-xl flex justify-between items-center gap-3 transition-all ${
                        isOutOfStock 
                          ? "border-red-500/30 bg-gradient-to-r from-red-900/20 to-red-800/10 opacity-60 cursor-not-allowed" 
                          : isVariantResult 
                            ? "border-purple-500/70 bg-gradient-to-r from-purple-900/40 to-purple-800/30 hover:from-purple-900/50 hover:to-purple-800/40 shadow-lg shadow-purple-500/20 cursor-pointer" 
                            : "border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/50 cursor-pointer"
                      }`}
                      onClick={() => {
                        // 0 stock mahsulotlarni ham to'g'ridan-to'g'ri qo'shish
                        addProduct(result.product, isVariantResult ? result.variantIndex : undefined).catch(console.error);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        {/* Variant uchun parent mahsulot nomi - yuqorida ko'rsatish */}
                        {isVariantResult && parentName && (
                          <div className="text-xs text-purple-400/80 font-medium mb-1 truncate flex items-center gap-1">
                            <span className="text-purple-500">📦</span> 
                            <span className="truncate">{parentName}</span>
                            <span className="text-purple-500/50 flex-shrink-0">→</span>
                          </div>
                        )}
                        
                        {/* Mahsulot nomi - bir qatorda */}
                        <div className={`font-bold text-sm truncate flex items-center gap-2 ${isOutOfStock ? "text-slate-500" : isVariantResult ? "text-purple-100" : "text-slate-200"}`}>
                          {/* Variant uchun: faqat variant nomi ko'rsatiladi */}
                          {isVariantResult ? (
                            <>
                              <span className="text-purple-300 font-black truncate flex-1">{displayName || `Xil ${displaySku || 'Nomsiz'}`}</span>
                              <span className="text-[9px] bg-gradient-to-r from-purple-600 to-pink-600 text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide shadow-lg shadow-purple-500/30 flex-shrink-0">
                                Xil
                              </span>
                            </>
                          ) : (
                            <span className="truncate">{displayName || `Kod: ${displaySku || result.product.id.slice(-6)}`}</span>
                          )}
                          {/* 0 stock uchun ko'rsatkich */}
                          {isOutOfStock && !isRefundMode && (
                            <span className="text-red-400 text-xs flex-shrink-0">🚫</span>
                          )}
                        </div>
                        
                        {/* Ma'lumotlar - bir qatorda */}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {displaySku && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${isVariantResult ? "bg-purple-500/30 text-purple-300" : "bg-slate-700/50 text-slate-400"}`}>
                              Kod: {displaySku}
                            </span>
                          )}
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${isOutOfStock ? "bg-red-500/30 text-red-400 border border-red-500/50" : "bg-emerald-500/30 text-emerald-400"}`}>
                            {isOutOfStock ? "TUGAGAN" : `${displayStock} dona`}
                          </span>
                        </div>
                      </div>
                      
                      {/* Narx - o'ng tomonda */}
                      <div className={`text-lg font-black flex-shrink-0 ${isOutOfStock ? "text-slate-500" : isVariantResult ? "text-purple-300" : "text-green-400"}`}>
                        <span className="text-green-400 text-xs opacity-70 mr-1">$</span>{formatNum(displayPrice)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sales History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border-slate-700/50 backdrop-blur-xl rounded-3xl">
          <DialogHeader className="pr-10">
            <DialogTitle className="text-slate-200 text-xl font-bold flex items-center gap-3">
              <History className="w-5 h-5 text-emerald-400" />
              Sotuvlar tarixi
              {pendingSalesCount > 0 && <span className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full font-medium">{pendingSalesCount} ta sinxronlanmagan</span>}
            </DialogTitle>
          </DialogHeader>
          
          {/* Bugun / O'tgan Switch */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setHistoryFilter("today")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                historyFilter === "today"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              Bugun
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter("past")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                historyFilter === "past"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              O'tgan
            </button>
          </div>
          
          <div className="max-h-[60vh] overflow-auto space-y-4 pr-2">
            {(() => {
              // Bugungi sanani olish
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              // Filtrlangan tarix
              const filteredHistory = salesHistory.filter((sale) => {
                const saleDate = new Date(sale.date);
                saleDate.setHours(0, 0, 0, 0);
                
                if (historyFilter === "today") {
                  return saleDate.getTime() === today.getTime();
                } else {
                  return saleDate.getTime() < today.getTime();
                }
              });
              
              if (filteredHistory.length === 0) {
                return (
                  <div className="text-center text-slate-500 py-12">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    {historyFilter === "today" ? "Bugun sotuvlar yo'q" : "O'tgan kunlarda sotuvlar yo'q"}
                  </div>
                );
              }
              
              // Sanalar bo'yicha guruhlash
              const grouped: Record<string, SaleHistory[]> = {};
              filteredHistory.forEach((sale) => {
                const dateKey = new Date(sale.date).toLocaleDateString("ru-RU");
                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(sale);
              });
              
              return Object.entries(grouped).map(([dateKey, sales]) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-lg font-bold text-slate-200">{dateKey}</div>
                    <div className="flex-1 h-px bg-slate-700/50" />
                    <div className="text-sm text-slate-500">{sales.length} ta</div>
                  </div>
                  <div className="space-y-2 ml-2">
                    {sales.map((sale, idx) => {
                      const PaymentIcon = sale.paymentType === "Naqd" ? Banknote : sale.paymentType === "Karta" ? CreditCard : sale.paymentType === "O'tkazma" ? Smartphone : Wallet;
                      const isRefund = sale.type === "refund";
                      // Mahsulot nomlari - birinchi 2 tasini ko'rsatish
                      const productNames = sale.items.map(item => item.name);
                      const displayNames = productNames.slice(0, 2).join(", ");
                      const moreCount = productNames.length > 2 ? productNames.length - 2 : 0;
                      
                      return (
                        <div
                          key={sale.id}
                          className={`p-4 border rounded-2xl cursor-pointer transition-all ${isRefund ? "border-red-500/40 bg-red-900/20 hover:bg-red-800/30" : "border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/50"}`}
                          onClick={() => setSelectedSale(sale)}
                        >
                          {/* Mahsulot nomlari */}
                          <div className={`text-sm font-medium mb-2 truncate ${isRefund ? "text-red-300" : "text-slate-300"}`}>
                            {displayNames}
                            {moreCount > 0 && <span className="text-slate-500 ml-1">+{moreCount} ta</span>}
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                              {isRefund && <RotateCcw className="w-4 h-4 text-red-500" />}
                              <span className={`font-bold ${isRefund ? "text-red-400" : "text-slate-200"}`}>#{idx + 1}</span>
                              <span className="text-slate-500 text-sm">{new Date(sale.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                              <PaymentIcon className={`w-4 h-4 ${isRefund ? "text-red-400" : "text-slate-400"}`} />
                              {!sale.synced && <span title="Sinxronlanmagan"><CloudOff className="w-3 h-3 text-amber-500" /></span>}
                            </div>
                            <span className={`text-xl font-black ${isRefund ? "text-red-500" : "text-green-500"}`}>
                              <span className="text-green-400 mr-1">$</span>{isRefund ? "-" : ""}{formatNum(sale.total)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending Checks Dialog */}
      <Dialog open={pendingChecksOpen} onOpenChange={setPendingChecksOpen}>
        <DialogContent className="max-w-md bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border-slate-700/50 backdrop-blur-xl rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-slate-700/50 bg-slate-800/50">
            <DialogTitle className="text-slate-200 text-lg font-bold flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-400" />
              Saqlangan mahsulotlar
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-auto">
            {pendingChecks.length === 0 ? (
              <div className="text-center text-slate-500 py-12">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                Saqlangan mahsulotlar yo'q
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {pendingChecks.map((check, index) => (
                  <div key={check.id} className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 font-medium">#{index + 1}</span>
                        <span className="text-lg font-black text-red-400">{formatNum(check.total)}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{check.items.length} ta mahsulot</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => restorePendingCheck(check)} className="p-3 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 transition-all" title="Qaytarish">
                        <RotateCcw className="w-5 h-5" />
                      </button>
                      <button onClick={() => deletePendingCheck(check.id)} className="p-3 rounded-2xl bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-all" title="O'chirish">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sale Detail Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-lg p-0 bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border-slate-700/50 backdrop-blur-xl rounded-3xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-700/50 bg-gradient-to-r from-red-900/30 to-transparent">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${selectedSale?.type === "refund" ? "bg-red-500/20 border border-red-500/30" : "bg-emerald-500/20 border border-emerald-500/30"}`}>
                {selectedSale?.type === "refund" ? <RotateCcw className="w-6 h-6 text-red-400" /> : <CreditCard className="w-6 h-6 text-emerald-400" />}
              </div>
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  {selectedSale?.type === "refund" ? "Qaytarish" : "Chek"}
                  {selectedSale && !selectedSale.synced && <CloudOff className="w-4 h-4 text-amber-500" />}
                </h2>
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <span>{selectedSale && new Date(selectedSale.date).toLocaleDateString("ru-RU")}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                  <span>{selectedSale && new Date(selectedSale.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            </div>
          </div>
          {selectedSale && (
            <div className="p-6 space-y-4">
              <div className="border border-slate-700/50 rounded-2xl overflow-hidden bg-slate-800/30">
                <div className="bg-slate-900/60 px-5 py-4 border-b border-slate-700/50">
                  <div className="grid grid-cols-[1fr_80px_110px] gap-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <div>Mahsulot</div>
                    <div className="text-center">Soni</div>
                    <div className="text-right">Narxi</div>
                  </div>
                </div>
                <div className="max-h-[40vh] overflow-auto">
                  {selectedSale.items.map((item, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_110px] gap-3 px-5 py-4 border-b border-slate-700/30 hover:bg-slate-700/20">
                      <div className="text-sm text-slate-200 truncate font-medium">{item.name}</div>
                      <div className="text-center">
                        <span className="px-3 py-1.5 rounded-xl bg-slate-700/50 text-sm text-slate-300 font-bold">{item.quantity}</span>
                      </div>
                      <div className="text-right text-sm text-slate-300 font-medium">{formatNum((item.quantity || 0) * (item.price || 0))}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-900/60 px-5 py-5 border-t border-slate-700/50">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Jami:</span>
                    <span className={`text-2xl font-black ${selectedSale.type === "refund" ? "text-red-500" : "text-green-500"}`}>
                      <span className="text-green-400 mr-1">$</span>{selectedSale.type === "refund" ? "-" : ""}{formatNum(selectedSale.total)}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                className="w-full h-14 gap-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-lg"
                onClick={async () => {
                  setIsPrinting(true);
                  try {
                    const receiptData: ReceiptData = {
                      type: selectedSale.type || "sale",
                      items: selectedSale.items.map((item: any) => ({ 
                        name: item.name, 
                        sku: item.sku,
                        quantity: item.quantity, 
                        price: item.price, 
                        discount: item.discount 
                      })),
                      total: selectedSale.total,
                      paymentType: selectedSale.paymentType || "Naqd",
                      cashier: user?.name,
                      date: new Date(selectedSale.date),
                      receiptNumber: selectedSale.id,
                      // Do'kon ma'lumotlari
                      storeName: storeInfo.storeName,
                      storeAddress: storeInfo.storeAddress,
                      storePhone: storeInfo.storePhone,
                    };
                    await printReceipt(selectedPrinter, receiptData);
                  } catch (e) { 
                    console.error("Print error:", e); 
                  } finally { 
                    setIsPrinting(false); 
                  }
                }}
                disabled={isPrinting}
              >
                {isPrinting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Printer className="w-6 h-6" />}
                Chekni chop etish
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-md bg-slate-900/95 border-slate-700/50 backdrop-blur-xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-slate-200 flex items-center gap-3 text-xl font-bold">
              {isRefundMode && <RotateCcw className="w-5 h-5 text-orange-500" />}
              {isRefundMode ? "Qaytarish turini tanlang" : "To'lov turini tanlang"}
              {!isOnline && <span className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full font-medium ml-2">Offline</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className={`text-center p-6 rounded-2xl border ${isRefundMode ? "bg-orange-900/20 border-orange-500/40" : "bg-slate-800/50 border-slate-700/50"}`}>
              <div className={`text-sm font-medium ${isRefundMode ? "text-orange-400" : "text-slate-400"}`}>{isRefundMode ? "Qaytarish summasi" : "Jami summa"}</div>
              <div className={`text-4xl font-black mt-2 ${isRefundMode ? "text-orange-500" : "text-green-500"}`} style={{ textShadow: isRefundMode ? "0 0 30px rgba(251,146,60,0.5)" : "0 0 30px rgba(16,185,129,0.5)" }}>
                <span className="text-green-400 mr-1">$</span>
                {formatNum(total)}
              </div>
              {!isOnline && <div className="text-xs text-amber-400 mt-3 font-medium">⚡ Offline rejimda saqlanadi</div>}
            </div>
            
            {/* Yaroqli/Yaroqsiz switch - faqat qaytarish rejimida */}
            {isRefundMode && (
              <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-700/50 bg-slate-800/50">
                <div className="flex flex-col">
                  <Label htmlFor="defective-switch" className="text-slate-200 font-semibold">
                    Mahsulot holati
                  </Label>
                  <span className="text-xs text-slate-400 mt-1">
                    {isDefective ? "Yaroqsiz - omborga qaytmaydi" : "Yaroqli - omborga qaytadi"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${!isDefective ? "text-emerald-400" : "text-slate-500"}`}>Yaroqli</span>
                  <Switch
                    id="defective-switch"
                    checked={isDefective}
                    onCheckedChange={setIsDefective}
                    className="data-[state=checked]:bg-red-500"
                  />
                  <span className={`text-sm font-medium ${isDefective ? "text-red-400" : "text-slate-500"}`}>Yaroqsiz</span>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              {[
                { type: "Naqd", icon: Banknote, color: isRefundMode ? "from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 shadow-orange-500/30" : "from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-emerald-500/30" },
                { type: "Karta", icon: CreditCard, color: "from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-blue-500/30" },
                { type: "O'tkazma", icon: Smartphone, color: "from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 shadow-purple-500/30" },
                { type: "Aralash", icon: Wallet, color: "from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 shadow-amber-500/30" },
              ].map(({ type, icon: Icon, color }) => (
                <Button key={type} className={`h-24 flex-col gap-3 bg-gradient-to-br ${color} text-white rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`} onClick={() => handlePayment(type)} disabled={isPrinting || isProcessingPayment}>
                  <Icon className="w-8 h-8" />
                  <span className="text-lg font-bold">{type}</span>
                </Button>
              ))}
            </div>
            {(isPrinting || isProcessingPayment) && (
              <div className="flex items-center justify-center gap-3 text-slate-400 text-sm py-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">{isPrinting ? "Chop etilmoqda..." : "To'lov amalga oshirilmoqda..."}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Printer Settings Dialog */}
      <Dialog open={printerSettingsOpen} onOpenChange={setPrinterSettingsOpen}>
        <DialogContent className="max-w-lg bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border-slate-700/50 backdrop-blur-xl rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-200 flex items-center gap-3 text-xl font-bold">
              <Settings className="w-5 h-5 text-purple-400" />
              Printer sozlamalari
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            
            {/* CHEK PRINTER */}
            <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <Printer className="w-4 h-4" />
                <span>Chek printer</span>
              </div>
              <Select value={selectedPrinter || ""} onValueChange={(value) => { setSelectedPrinter(value); setDefaultPrinterId(value); }}>
                <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-slate-200 h-11 rounded-xl">
                  <SelectValue placeholder="Chek printer tanlang..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 rounded-xl">
                  {printers.length === 0 ? (
                    <SelectItem value="none" disabled className="text-slate-500">Printer topilmadi</SelectItem>
                  ) : (
                    printers.map((printer) => (
                      <SelectItem key={printer.id} value={printer.id} className="text-slate-200">
                        <div className="flex items-center gap-2">
                          <Printer className="w-4 h-4" />
                          <span>{printer.name}</span>
                          <span className="text-xs text-slate-500">({printer.type})</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Qog'oz kengligi:</span>
                <Select value={String(receiptPaperWidth)} onValueChange={(value) => { const w = Number(value) as ReceiptPaperWidth; setReceiptPaperWidth(w); savePrinterSettings({ receiptPaperWidth: w }); }}>
                  <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-slate-200 h-9 w-24 rounded-lg text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 rounded-lg">
                    <SelectItem value="58" className="text-slate-200">58mm</SelectItem>
                    <SelectItem value="80" className="text-slate-200">80mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedPrinter && (
                <Button className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm" onClick={async () => { setIsPrinting(true); try { await printTestReceipt(selectedPrinter); } catch (e) { console.error("Test print error:", e); } finally { setIsPrinting(false); } }} disabled={isPrinting}>
                  {isPrinting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
                  Test chek
                </Button>
              )}
            </div>

            {/* SENIK PRINTER */}
            <div className="p-4 bg-slate-800/50 rounded-2xl border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-semibold">
                <Tag className="w-4 h-4" />
                <span>Senik printer (Xprinter)</span>
              </div>
              <Select value={selectedLabelPrinter || "none"} onValueChange={(value) => { 
                const actualValue = value === "none" ? null : value;
                setSelectedLabelPrinter(actualValue); 
                setDefaultLabelPrinterId(actualValue);
                // Tanlangan printer uchun saqlangan qog'oz o'lchamlarini yuklash
                if (actualValue) {
                  const paperSettings = getPrinterPaperSettings(actualValue);
                  setLabelPaperWidth(paperSettings.width as LabelPaperWidth);
                  setLabelHeight(paperSettings.height);
                }
              }}>
                <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-slate-200 h-11 rounded-xl">
                  <SelectValue placeholder="Senik printer tanlang..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 rounded-xl">
                  <SelectItem value="none" className="text-slate-400">Tanlanmagan (chek printer ishlatiladi)</SelectItem>
                  {printers.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id} className="text-slate-200">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        <span>{printer.name}</span>
                        <span className="text-xs text-slate-500">({printer.type})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Qog'oz o'lchamlari - faqat printer tanlanganda ko'rinadi */}
              {selectedLabelPrinter && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400">Kenglik (mm):</span>
                    <Input
                      type="number"
                      min="10"
                      max="120"
                      value={labelPaperWidth}
                      onChange={(e) => { 
                        const w = Math.max(10, Math.min(120, parseInt(e.target.value) || 40)); 
                        setLabelPaperWidth(w as LabelPaperWidth);
                        // Shu printer uchun qog'oz o'lchamini saqlash
                        if (selectedLabelPrinter) {
                          setPrinterPaperSettings(selectedLabelPrinter, { width: w, height: labelHeight });
                        }
                      }}
                      className="w-full h-9 text-center text-xs bg-slate-900/60 border-slate-600/50 text-slate-200 rounded-lg"
                      placeholder="Kenglik kiriting"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400">Balandlik (mm):</span>
                    <Input
                      type="number"
                      min="10"
                      max="120"
                      value={labelHeight}
                      onChange={(e) => { 
                        const h = Math.max(10, Math.min(120, parseInt(e.target.value) || 30)); 
                        setLabelHeight(h);
                        // Shu printer uchun qog'oz o'lchamini saqlash
                        if (selectedLabelPrinter) {
                          setPrinterPaperSettings(selectedLabelPrinter, { width: labelPaperWidth, height: h });
                        }
                      }}
                      className="w-full h-9 text-center text-xs bg-slate-900/60 border-slate-600/50 text-slate-200 rounded-lg"
                      placeholder="Balandlik kiriting"
                    />
                  </div>
                </div>
              )}
              <Button className="w-full h-10 bg-amber-600 hover:bg-amber-500 rounded-xl text-sm" onClick={async () => { 
                setIsPrinting(true); 
                try { 
                  await printLabel(selectedLabelPrinter || selectedPrinter, { 
                    name: "Test mahsulot", 
                    price: 50000, 
                    sku: "TEST-001", 
                    barcode: "1234567890", 
                    barcodeType: "CODE128",
                    paperWidth: labelPaperWidth,
                    paperHeight: labelHeight,
                  }); 
                } catch (e) { console.error("Test label error:", e); } 
                finally { setIsPrinting(false); } 
              }} disabled={isPrinting || (!selectedLabelPrinter && !selectedPrinter)}>
                {isPrinting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Tag className="w-4 h-4 mr-2" />}
                Test senik
              </Button>
            </div>

            {/* UMUMIY AMALLAR */}
            <div className="flex gap-2">
              {"usb" in navigator && (
                <Button variant="outline" className="flex-1 h-10 border-slate-700/50 text-slate-300 hover:bg-slate-800 rounded-xl text-xs" onClick={async () => {
                  const printer = await requestUSBPrinter();
                  if (printer) { setPrinters((prev) => prev.some((p) => p.id === printer.id) ? prev : [...prev, printer]); }
                }}>
                  + USB qo'shish
                </Button>
              )}
              <Button variant="outline" className="flex-1 h-10 border-slate-700/50 text-slate-300 hover:bg-slate-800 rounded-xl text-xs" onClick={async () => { const printerList = await listPrinters(); setPrinters(printerList); }}>
                <RefreshCw className="w-3 h-3 mr-1" />
                Yangilash
              </Button>
              {selectedPrinter && (
                <Button variant="outline" className="flex-1 h-10 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-xs" onClick={async () => { try { await openCashDrawer(selectedPrinter); } catch (e) { console.error("Cash drawer error:", e); } }}>
                  Kassa ochish
                </Button>
              )}
            </div>

            <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-700/50">
              <p>• Chek printer - sotuvlar cheki uchun (58mm yoki 80mm)</p>
              <p>• Senik printer - mahsulot etiketkalari uchun (Xprinter XP-365B va h.k.)</p>
              <p>• Agar senik printer tanlanmasa, chek printer ishlatiladi</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Senik Chop Etish Dialog - Soddalashtirilgan */}
      <Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
        <DialogContent className="max-w-md bg-slate-900/95 border-slate-700/50 backdrop-blur-xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-slate-200 flex items-center gap-3 text-lg font-bold">
              <Tag className="w-5 h-5 text-amber-400" />
              Senik chop etish
            </DialogTitle>
          </DialogHeader>
          {labelDialogItem && (
            <div className="space-y-4">
              
              {/* Mahsulot ma'lumotlari - kompakt */}
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <div className="text-base font-bold text-slate-200 mb-2">{labelDialogItem.name}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-purple-400 font-medium">Kod: {labelDialogItem.sku || '-'}</span>
                  <span className="text-green-400 font-bold">$<span className="ml-1">{formatNum(labelDialogItem.price)}</span></span>
                </div>
              </div>

              {/* Printer tanlash */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400 font-medium">Printer</label>
                <div className="flex gap-2">
                  <Select 
                    value={selectedLabelPrinter || ""} 
                    onValueChange={(value) => { 
                      setSelectedLabelPrinter(value); 
                      setDefaultLabelPrinterId(value);
                    }}
                  >
                    <SelectTrigger className="flex-1 bg-slate-800/80 border-slate-700/50 text-slate-200 h-11 rounded-xl">
                      <SelectValue placeholder="Printer tanlang..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 rounded-xl">
                      {printers.length === 0 ? (
                        <SelectItem value="none" disabled className="text-slate-500">Printer topilmadi</SelectItem>
                      ) : (
                        printers.map((printer) => (
                          <SelectItem key={printer.id} value={printer.id} className="text-slate-200">
                            {printer.name} ({printer.type})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {"usb" in navigator && (
                    <Button 
                      variant="outline" 
                      className="h-11 px-3 border-amber-500/50 text-amber-400 hover:bg-amber-500/20 rounded-xl"
                      onClick={async () => {
                        const printer = await requestUSBPrinter();
                        if (printer) {
                          setPrinters((prev) => prev.some((p) => p.id === printer.id) ? prev : [...prev, printer]);
                          setSelectedLabelPrinter(printer.id);
                          setDefaultLabelPrinterId(printer.id);
                        }
                      }}
                    >
                      + USB
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500">USB printer ulash uchun "+ USB" tugmasini bosing va qurilmani tanlang</p>
              </div>

              {/* Qog'oz o'lchami */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-400 font-medium">Qog'oz o'lchami (mm)</label>
                  <button
                    onClick={() => setUseCustomSize(!useCustomSize)}
                    className={`text-xs px-2 py-1 rounded-lg transition-all ${useCustomSize ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/50 text-slate-500'}`}
                  >
                    {useCustomSize ? 'Qo\'lda' : 'Tayyor'}
                  </button>
                </div>
                
                {useCustomSize ? (
                  // Qo'lda kiritish
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500">Kenglik</label>
                      <input
                        type="number"
                        min="20"
                        max="100"
                        value={customLabelWidth}
                        onChange={(e) => setCustomLabelWidth(Math.max(20, Math.min(100, parseInt(e.target.value) || 40)))}
                        className="w-full h-10 text-center text-lg font-bold bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>
                    <span className="text-slate-500 text-lg mt-5">×</span>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500">Balandlik</label>
                      <input
                        type="number"
                        min="15"
                        max="100"
                        value={customLabelHeight}
                        onChange={(e) => setCustomLabelHeight(Math.max(15, Math.min(100, parseInt(e.target.value) || 30)))}
                        className="w-full h-10 text-center text-lg font-bold bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                ) : (
                  // Tayyor razmerlar - 4 ta variant
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => { setLabelSize('mini'); setCustomLabelWidth(20); setCustomLabelHeight(30); }}
                      className={`p-2 rounded-xl border-2 transition-all ${customLabelWidth === 20 && customLabelHeight === 30 ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-slate-700 bg-slate-800/50 text-slate-400'}`}
                    >
                      <div className="font-bold text-xs">20×30</div>
                      <div className="text-[9px] opacity-70">Mini</div>
                    </button>
                    <button
                      onClick={() => { setLabelSize('small'); setCustomLabelWidth(40); setCustomLabelHeight(30); }}
                      className={`p-2 rounded-xl border-2 transition-all ${customLabelWidth === 40 && customLabelHeight === 30 ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-slate-700 bg-slate-800/50 text-slate-400'}`}
                    >
                      <div className="font-bold text-xs">40×30</div>
                      <div className="text-[9px] opacity-70">Kichik</div>
                    </button>
                    <button
                      onClick={() => { setLabelSize('medium'); setCustomLabelWidth(57); setCustomLabelHeight(30); }}
                      className={`p-2 rounded-xl border-2 transition-all ${customLabelWidth === 57 && customLabelHeight === 30 ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-slate-700 bg-slate-800/50 text-slate-400'}`}
                    >
                      <div className="font-bold text-xs">57×30</div>
                      <div className="text-[9px] opacity-70">XP-365B ✓</div>
                    </button>
                    <button
                      onClick={() => { setLabelSize('large'); setCustomLabelWidth(60); setCustomLabelHeight(40); }}
                      className={`p-2 rounded-xl border-2 transition-all ${customLabelWidth === 60 && customLabelHeight === 40 ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-slate-700 bg-slate-800/50 text-slate-400'}`}
                    >
                      <div className="font-bold text-xs">60×40</div>
                      <div className="text-[9px] opacity-70">Katta</div>
                    </button>
                  </div>
                )}
              </div>

              {/* Soni */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400 font-medium">Nechta senik?</label>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setLabelQuantity(Math.max(1, (labelQuantity || 0) - 1))}
                    className="w-11 h-11 rounded-xl bg-slate-700/80 hover:bg-slate-600/80 text-slate-200 text-xl font-bold"
                  >-</button>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={labelQuantity ?? ''}
                    placeholder="Sonini kiriting"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setLabelQuantity(null);
                      } else {
                        const num = parseInt(val);
                        if (!isNaN(num)) {
                          setLabelQuantity(Math.min(100, Math.max(1, num)));
                        }
                      }
                    }}
                    className="flex-1 h-11 text-center text-xl font-bold bg-slate-800/80 border border-slate-700/50 rounded-xl text-slate-200 outline-none focus:border-amber-500 placeholder:text-slate-500 placeholder:text-sm placeholder:font-normal"
                  />
                  <button 
                    onClick={() => setLabelQuantity(Math.min(100, (labelQuantity || 0) + 1))}
                    className="w-11 h-11 rounded-xl bg-slate-700/80 hover:bg-slate-600/80 text-slate-200 text-xl font-bold"
                  >+</button>
                </div>
              </div>

              {/* Chop etish tugmalari */}
              <div className="space-y-2">
                {/* USB/Tanlangan printer orqali chop etish */}
                <Button 
                  className="w-full h-12 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 rounded-xl text-base font-bold shadow-lg shadow-amber-500/30"
                  onClick={async () => {
                    if (!labelDialogItem) return;
                    
                    setIsPrinting(true);
                    try {
                      // Qisqa barcode ID yaratish - oxirgi 8 ta belgi
                      // Bu yetarlicha unikal va scanner oson o'qiydi
                      const fullId = labelDialogItem.productId;
                      const shortId = fullId.slice(-8).toUpperCase();
                      
                      console.log("[Kassa] Using short barcode ID:", shortId, "from:", fullId);
                      
                      const labelPrinter = selectedLabelPrinter || selectedPrinter;
                      const paperWidth = useCustomSize ? customLabelWidth : LABEL_SIZE_CONFIGS[labelSize].width;
                      const paperHeight = useCustomSize ? customLabelHeight : LABEL_SIZE_CONFIGS[labelSize].height;
                      
                      for (let i = 0; i < (labelQuantity || 0); i++) {
                        const success = await printLabel(labelPrinter || 'browser-print', {
                          name: labelDialogItem.name,
                          price: labelDialogItem.price,
                          sku: labelDialogItem.sku,
                          barcode: shortId, // Qisqa 8 belgili ID
                          barcodeType: "CODE128",
                          stock: labelStock,
                          labelSize: useCustomSize ? undefined : labelSize,
                          paperWidth,
                          paperHeight,
                        });
                        if (!success) {
                          console.warn("Label print failed for item", i + 1);
                        }
                      }
                      setLabelDialogOpen(false);
                    } catch (e) {
                      console.error("Label print error:", e);
                      toast.error("Senik chop etishda xatolik");
                    } finally {
                      setIsPrinting(false);
                    }
                  }}
                  disabled={isPrinting || !labelQuantity || labelQuantity < 1}
                >
                  {isPrinting ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Chop etilmoqda...</>
                  ) : (
                    <><Printer className="w-5 h-5 mr-2" />{labelQuantity || 0} ta senik ({useCustomSize ? `${customLabelWidth}×${customLabelHeight}` : `${LABEL_SIZE_CONFIGS[labelSize].width}×${LABEL_SIZE_CONFIGS[labelSize].height}`}mm)</>
                  )}
                </Button>
                
                {/* Printer holati haqida ma'lumot */}
                {selectedLabelPrinter?.startsWith('usb:') && (
                  <p className="text-xs text-emerald-400 text-center">✓ USB printer tanlangan: {printers.find(p => p.id === selectedLabelPrinter)?.name || 'USB Printer'}</p>
                )}
                {!selectedLabelPrinter && !selectedPrinter && (
                  <p className="text-xs text-amber-400 text-center">⚠ Printer tanlanmagan - brauzer orqali chop etiladi</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Label Modal - Hammasidan senik chop etish */}
      <Dialog open={bulkLabelOpen} onOpenChange={setBulkLabelOpen}>
        <DialogContent className="max-w-lg bg-slate-900/95 border-slate-700/50 backdrop-blur-xl rounded-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-slate-200 text-xl font-bold flex items-center gap-3">
              <Tag className="w-5 h-5 text-yellow-400" />
              Hammasidan senik chop etish
            </DialogTitle>
          </DialogHeader>
          
          {/* Qog'oz o'lchami */}
          <div className="py-3 border-b border-slate-700/50">
            <label className="text-xs text-slate-400 mb-2 block">Qog'oz o'lchami (mm)</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(LABEL_SIZE_CONFIGS).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setLabelSize(key as LabelSize)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    labelSize === key
                      ? 'bg-yellow-500 text-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {config.width}×{config.height}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 py-4">
            {/* Mahsulotlar ro'yxati - har biri uchun soni */}
            {checkItems.map((item) => {
              const qty = bulkLabelQuantities[item.id] ?? 1;
              return (
                <div key={item.id} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-200 truncate">{item.name}</div>
                      <div className="text-xs text-slate-400">Kod: {item.sku || '-'}</div>
                    </div>
                    <div className="text-lg font-bold text-green-400 ml-2">${formatNum(item.price)}</div>
                  </div>
                  {/* Nechta senik */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Nechta:</span>
                    <button
                      onClick={() => setBulkLabelQuantities(prev => ({...prev, [item.id]: Math.max(0, qty - 1)}))}
                      className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold transition-all text-sm"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={qty}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setBulkLabelQuantities(prev => ({...prev, [item.id]: val}));
                      }}
                      className="w-14 h-7 px-2 text-center text-sm font-bold bg-slate-700 border border-slate-600 rounded-lg text-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                    />
                    <button
                      onClick={() => setBulkLabelQuantities(prev => ({...prev, [item.id]: qty + 1}))}
                      className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold transition-all text-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="flex gap-3 mt-3">
            <Button
              onClick={() => setBulkLabelOpen(false)}
              variant="outline"
              className="flex-1 border-slate-600 text-slate-400 hover:bg-slate-800"
            >
              Bekor qilish
            </Button>
            <Button
              onClick={() => {
                // Jami senik sonini hisoblash
                const totalLabels = checkItems.reduce((sum, item) => {
                  return sum + (bulkLabelQuantities[item.id] ?? 1);
                }, 0);
                
                if (totalLabels === 0) {
                  toast.error("Kamida 1 ta senik tanlang");
                  return;
                }
                
                setBulkLabelOpen(false);
                
                const paperWidth = LABEL_SIZE_CONFIGS[labelSize].width;
                const paperHeight = LABEL_SIZE_CONFIGS[labelSize].height;
                
                // Barcha mahsulotlar uchun label ma'lumotlarini tayyorlash (soniga qarab ko'paytirish)
                const labels: LabelData[] = [];
                checkItems.forEach(item => {
                  const qty = bulkLabelQuantities[item.id] ?? 1;
                  const fullId = item.productId;
                  const shortId = fullId.slice(-8).toUpperCase();
                  
                  // Har bir mahsulot uchun qty ta label qo'shish
                  for (let i = 0; i < qty; i++) {
                    labels.push({
                      name: item.name,
                      price: item.price,
                      sku: item.sku,
                      barcode: shortId,
                      barcodeType: "CODE128" as const,
                      stock: item.stock || 0,
                      labelSize,
                      paperWidth,
                      paperHeight,
                    });
                  }
                });
                
                // Bitta print dialog da barcha labellarni chop etish
                const success = printBulkLabelsViaBrowser(labels);
                
                if (success) {
                  toast.success(`${totalLabels} ta senik chop etildi`);
                } else {
                  toast.error("Senik chop etishda xatolik");
                }
              }}
              disabled={isPrinting}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
            >
              <Tag className="w-4 h-4 mr-2" />
              {checkItems.reduce((sum, item) => sum + (bulkLabelQuantities[item.id] ?? 1), 0)} ta senik chop etish
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
