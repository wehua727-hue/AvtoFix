import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search,
  CreditCard,
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
  Truck,
  ShoppingCart,
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
import { syncManager } from "@/services/syncManager";

// Barcode scanner hook
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";

// POS Print service
import {
  listPrinters,
  requestUSBPrinter,
  printReceipt,
  openCashDrawer,
  setDefaultPrinterId,
  setDefaultLabelPrinterId,
  getPrinterSettings,
  savePrinterSettings,
  getPrinterPaperSettings,
  setPrinterPaperSettings,
  PrinterInfo,
  ReceiptData,
  ReceiptPaperWidth,
  LabelPaperWidth,
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
    productsCount,
    pendingSalesCount,
    error,
    addToCart,
    removeFromCart,
    updateQuantity: updateCartQuantity,
    clearCart,
    search,
    searchBySkuWithVariant,
    completeSale,
    getProduct,
    refreshCache,
  } = useOfflineKassa(userId, userPhone, defectiveCounts);

  // Unused but needed for compatibility
  const reloadProducts = () => { };
  const triggerSync = () => { };
  const isSyncing = false;

  // Local state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [salesHistory, setSalesHistory] = useState<SaleHistory[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleHistory | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [mixedPaymentOpen, setMixedPaymentOpen] = useState(false);
  const [mixedPayments, setMixedPayments] = useState<Array<{ type: string, amount: number }>>([]);
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [selectedPaymentType, setSelectedPaymentType] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const [isRefundMode, setIsRefundMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set()); // Tanlangan mahsulotlar (checkbox)
  const [isDefective, setIsDefective] = useState(false); // Yaroqsiz mahsulotmi?
  const [numpadValue, setNumpadValue] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"today" | "past">("today"); // Tarix filtri: Bugun yoki O'tgan

  // Numpad KOD/SON qismi
  const [activeInput, setActiveInput] = useState<"code" | "quantity">("code"); // KOD yoki SON
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null); // Tanlangan mahsulot index
  const quantityInputRefs = useRef<Record<number, HTMLInputElement | null>>({}); // Quantity input refs
  const checkItemsRef = useRef(checkItems); // Track latest checkItems

  // Update ref when checkItems changes
  useEffect(() => {
    checkItemsRef.current = checkItems;
  }, [checkItems]);

  // Agar kassa bo'sh bo'lsa, avtomatik "KOD" ga qaytish
  useEffect(() => {
    console.log('[Kassa] Cart length:', checkItems.length, 'Active input:', activeInput);
    if (checkItems.length === 0 && activeInput === "quantity") {
      console.log('[Kassa] Switching to CODE mode');
      setActiveInput("code");
      setSelectedItemIndex(null);
    }
  }, [checkItems.length, activeInput]);

  // Printer state
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null); // Chek printer
  const [receiptPaperWidth, setReceiptPaperWidth] = useState<ReceiptPaperWidth>(80);
  const [printerSettingsOpen, setPrinterSettingsOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<string | null>(null);

  // Clear history confirmation dialog
  const [clearHistoryConfirmOpen, setClearHistoryConfirmOpen] = useState(false);

  // Yaroqsiz qaytarilgan sonlarni yuklash (barcha foydalanuvchilar uchun)
  useEffect(() => {
    if (userId) {
      getAllDefectiveCounts(userId).then(counts => {
        setDefectiveCounts(counts);

      });
    }
  }, [userId]);

  // Dominant valyutani aniqlash - agar barcha mahsulotlar bir xil valyutada bo'lsa
  // Stock exceeded event listener - omborda yetarli mahsulot yo'q (faqat sotish rejimida)
  useEffect(() => {
    const handleStockExceeded = (e: CustomEvent<{ name: string; stock: number; requested: number }>) => {
      // Qaytarish rejimida bu xabarni ko'rsatmaslik
      if (isRefundMode) {

        return;
      }

      const { name, stock } = e.detail;
      const message = `Omborda yetarli emas! "${name}" - faqat ${stock} ta mavjud`;


      try {
        toast.error(message);

      } catch (error) {

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



      // Faqat qaytarish rejimida bu xabarni ko'rsatish
      if (!isRefundMode) {

        return;
      }

      const { name, maxReturn, soldQuantity, defectiveCount, initialStock } = e.detail;
      const message = `"${name}" - boshlang'ich ${initialStock} ta, ${soldQuantity} ta sotilgan, ${defectiveCount > 0 ? `${defectiveCount} ta yaroqsiz qaytarilgan, ` : ''}${maxReturn} tadan ortiq qaytara olmaysiz!`;



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

      } catch (error) {

      }
    };



    window.addEventListener('stock-exceeded', handleStockExceeded as EventListener);
    window.addEventListener('refund-limit-exceeded', handleRefundLimitExceeded as EventListener);

    return () => {

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
      const currentInitialStock = item.initialStock ?? 0;
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
      const currentInitialStock = item.initialStock ?? 0;
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
      const currentInitialStock = errorItem.initialStock ?? 0;
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

        // Chek qog'oz kengligi
        setReceiptPaperWidth(settings.receiptPaperWidth);
      } catch (e) {

      }
    };
    loadPrinters();
  }, []);

  // Load pending checks and sales history
  useEffect(() => {
    if (!userId) return;

    // Initialize sync manager
    syncManager.initialize(userId).catch(err => {
      console.error('[Kassa] Failed to initialize sync manager:', err);
    });

    const loadLocalData = async () => {
      try {
        // 1. AVVAL serverdan tarixni olish (MongoDB)
        try {
          const apiBase = window.location.protocol === 'file:'
            ? 'http://127.0.0.1:5174'
            : (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '');



          const response = await fetch(`${apiBase}/api/sales/offline?userId=${encodeURIComponent(userId)}&limit=1000`);

          if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.sales)) {


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



              // Birlashtirilgan tarix (local + server)
              const combinedHistory = [...localHistory, ...serverHistory];

              // Sanasi bo'yicha tartiblash (eng yangi birinchi)
              combinedHistory.sort((a, b) => b.date.getTime() - a.date.getTime());

              setSalesHistory(combinedHistory.slice(0, 1000));
              return;
            }
          }
        } catch (serverError) {

        }

        // 3. Server xato bersa, faqat IndexedDB dan olish (fallback)
        const sales = await offlineDB.offlineSales.where("userId").equals(userId).reverse().sortBy("createdAt");
        setSalesHistory(
          sales.slice(0, 1000).map((s) => ({
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

      }
    };
    loadLocalData();
  }, [userId]);

  // Load sales history on mount
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

      // MUHIM: Har doim serverdan mahsulot ma'lumotlarini olish (initialStock uchun)
      // Qaytarish rejimida initialStock kerak bo'ladi
      freshProduct = await getProduct(product.id) || product;

      if (variantIndex !== undefined && freshProduct.variantSummaries?.[variantIndex]) {
        const variant = freshProduct.variantSummaries[variantIndex];
        const variantStock = variant.stock ?? 0;
        const variantInitialStock = variant.initialStock ?? variant.stock ?? 0;

        const variantId = `${freshProduct.id}-v${variantIndex}`;
        const variantProduct: OfflineProduct = {
          ...freshProduct,
          id: variantId,
          name: variant.name,
          sku: variant.sku || freshProduct.sku,
          barcode: variant.barcode || freshProduct.barcode,
          price: variant.price || freshProduct.price,
          costPrice: variant.costPrice || freshProduct.costPrice || 0,
          currency: variant.currency || freshProduct.currency || 'UZS',
          stock: variantStock,
          initialStock: variantInitialStock,
          productId: freshProduct.id,
          customId: variant.customId, // ✅ YANGI: Variant Custom ID
          imageUrl: variant.imageUrl || freshProduct.imageUrl
        };

        addToCart(variantProduct, isRefundMode);
      } else {
        const productInitialStock = freshProduct.initialStock ?? freshProduct.stock ?? 0;

        addToCart({
          ...freshProduct,
          initialStock: productInitialStock,
          productId: freshProduct.id
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


      try {
        // Variant va asosiy mahsulot SKU ni qidirish
        const result = await searchBySkuWithVariant(sku);


        if (!result) {

          return false;
        }

        // Variant yoki asosiy mahsulotni qo'shish

        await addProduct(result.product, result.variantIndex);

        return true;
      } catch (error) {

        return false;
      }
    },
    [searchBySkuWithVariant, addProduct, checkItems.length]
  );

  // Barcode scanner
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    setLastScanResult(barcode);

    try {
      // Variant va asosiy mahsulot SKU/barcode ni qidirish
      const result = await searchBySkuWithVariant(barcode);

      if (result) {
        await addProduct(result.product, result.variantIndex);
        setTimeout(() => setLastScanResult(null), 2000);
      } else {
        // Agar topilmasa, qidiruv oynasini ochish
        setSearchQuery(barcode);
        setSearchOpen(true);
        setTimeout(() => setLastScanResult(null), 3000);
      }
    } catch (error) {
      console.error('[handleBarcodeScan] Xatolik:', error);
      setTimeout(() => setLastScanResult(null), 3000);
    }
  }, [searchBySkuWithVariant, addProduct, productsCount]);
  const scannerEnabled = !searchOpen && !paymentOpen && !mixedPaymentOpen && !historyOpen && !printerSettingsOpen;

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
        if (activeInput === "code") {
          setNumpadValue("");
        } else if (selectedItemIndex !== null && quantityInputRefs.current[selectedItemIndex]) {
          quantityInputRefs.current[selectedItemIndex]!.value = "";
        }
        return;
      }

      if (key === "⌫") {
        // Orqaga o'chirish
        if (activeInput === "code") {
          setNumpadValue((prev) => prev.slice(0, -1));
        } else if (selectedItemIndex !== null) {
          const input = quantityInputRefs.current[selectedItemIndex];
          if (input) {
            const newValue = (input.value || "").slice(0, -1);
            input.value = newValue;
            const val = parseInt(newValue) || 0;

            if (val > 0) {
              updateQuantity(selectedItemIndex, val);
            }
          }
        }
        return;
      }

      if (key === "OK") {
        if (activeInput === "code") {
          // KOD qismida: Mahsulot qo'shish
          const currentValue = numpadValueRef.current;
          if (currentValue && currentValue.trim()) {
            // Fire-and-forget - asinxron qilish
            addProductBySku(currentValue).catch(() => { });
          }
          setNumpadValue("");
        } else if (activeInput === "quantity" && selectedItemIndex !== null) {
          // SON qismida: Soni tasdiqlash va KOD qismiga qaytish
          const input = quantityInputRefs.current[selectedItemIndex];
          const qty = parseInt(input?.value || "0") || 0;


          if (qty > 0) {
            // Quantity allaqachon updateQuantity orqali yangilangan

          }

          // KOD qismiga qaytish
          setActiveInput("code");
          setSelectedItemIndex(null);
          setNumpadValue("");
        }
        return;
      }

      // Raqamlar va "00"
      if (key === "00") {
        if (activeInput === "code") {
          setNumpadValue((prev) => prev + "00");
        } else if (selectedItemIndex !== null) {
          const input = quantityInputRefs.current[selectedItemIndex];
          if (input) {
            let newValue = (input.value || "") + "00";
            // Oldiga 0 bo'lsa o'chirish
            newValue = newValue.replace(/^0+/, '') || "0";
            const val = parseInt(newValue) || 0;

            if (val > 0) {
              updateQuantity(selectedItemIndex, val);
            }
          }
        }
        return;
      }

      if (/^\d$/.test(key)) {
        if (activeInput === "code") {
          setNumpadValue((prev) => prev + key);
        } else if (selectedItemIndex !== null) {
          const input = quantityInputRefs.current[selectedItemIndex];
          if (input) {
            let newValue = (input.value || "") + key;
            // Oldiga 0 bo'lsa o'chirish (masalan: 01 → 1)
            newValue = newValue.replace(/^0+/, '') || "0";
            const val = parseInt(newValue) || 0;

            if (val > 0) {
              updateQuantity(selectedItemIndex, val);
            }
          }
        }
        return;
      }
    },
    [activeInput, selectedItemIndex, addProductBySku, updateQuantity]
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
      if (searchOpen || paymentOpen || mixedPaymentOpen || historyOpen || isInputFocused) return;

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
  }, [searchOpen, paymentOpen, mixedPaymentOpen, historyOpen, handleNumpadPress]);



  // Do'kon ma'lumotlari (chek uchun)
  const storeInfo = {
    storeName: user?.role === 'admin'
      ? `${user?.name || 'Admin'} do'koni`
      : user?.name
        ? `AVTOFIX - ${user.name}`
        : "AVTOFIX - Avto ehtiyot qismlari do'koni",
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

          // Tarixga qo'shish - har bir mahsulot alohida entry sifatida
          const historyEntries = checkItems.map((item) => ({
            id: generateUUID(),
            items: [{
              id: generateUUID(),
              productId: item.productId,
              name: item.name,
              sku: item.sku,
              quantity: item.quantity,
              price: item.price,
              discount: item.discount,
            }],
            total: item.quantity * item.price - item.discount,
            date: new Date(),
            paymentType,
            type: "refund" as "sale" | "refund",
            synced: false,
          }));

          setSalesHistory((prev) => [...historyEntries, ...prev]);

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
              userRole: user?.role as 'admin' | 'xodim' | 'ega',
            };
            await printReceipt(selectedPrinter, receiptData);
          } catch (e) {

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

          }
          setDefectiveCounts(newCounts);

          // Yaroqsiz qaytarilgan sonlarni qayta yuklash (database dan)
          getAllDefectiveCounts(userId).then(counts => {
            setDefectiveCounts(counts);

          });

          toast.success("Yaroqsiz mahsulotlar qayd etildi");
          clearCart();
          setPaymentOpen(false);
          setIsRefundMode(false);
          setIsDefective(false);
          return;
        }

        // Oddiy sotuv yoki yaroqli qaytarish
        if (checkItems.length === 0) {
          toast.error("Kassada mahsulot yo'q");
          setIsProcessingPayment(false);
          return;
        }

        const sale = await completeSale(paymentType, isRefundMode ? "refund" : "sale");
        if (sale) {
          // Tarixga qo'shish - butun chekni bitta yozuv sifatida
          const historyEntry: SaleHistory = {
            id: sale.id,
            items: sale.items.map((item) => ({
              id: generateUUID(),
              productId: item.productId,
              name: item.name,
              sku: item.sku,
              quantity: item.quantity,
              price: item.price,
              discount: item.discount,
            })),
            total: sale.total,
            date: new Date(sale.createdAt),
            paymentType: sale.paymentType,
            type: sale.saleType as "sale" | "refund",
            synced: sale.synced,
          };

          setSalesHistory((prev) => [historyEntry, ...prev]);

          // Reload history from IndexedDB to ensure persistence
          setTimeout(async () => {
            try {
              console.log('[Kassa] Reloading history from IndexedDB for userId:', userId);

              const localSales = await offlineDB.offlineSales
                .where("userId").equals(userId)
                .reverse()
                .sortBy("createdAt");

              console.log('[Kassa] Found sales in IndexedDB:', localSales.length);

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
                synced: s.synced,
              }));

              setSalesHistory(localHistory.slice(0, 1000));
              console.log('[Kassa] History reloaded from IndexedDB:', localHistory.length, 'items');
            } catch (err) {
              console.error('[Kassa] Failed to reload history:', err);
            }
          }, 1000);

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
              userRole: user?.role as 'admin' | 'xodim' | 'ega',
            };
            await printReceipt(selectedPrinter, receiptData);
          } catch (e) {
            // Print error
          } finally {
            setIsPrinting(false);
          }
          setPaymentOpen(false);
          if (isRefundMode) {
            setIsRefundMode(false);
            setIsDefective(false);
          }
        }
      } catch (error) {
        toast.error("To'lov xatosi yuz berdi");
      } finally {
        setIsProcessingPayment(false);
      }
    },
    [completeSale, isRefundMode, isDefective, checkItems, total, userId, clearCart, selectedPrinter, user, storeInfo, defectiveCounts, isProcessingPayment]
  );

  // Clear history function - only for owner role
  const clearHistory = useCallback(
    async () => {
      console.log("[clearHistory] Starting clear history process");
      try {
        console.log("[clearHistory] Clearing local state");
        // Clear local state immediately
        setSalesHistory([]);
        setHistoryOpen(false);

        console.log("[clearHistory] Showing success toast");
        // Show success toast
        toast.success("Tarix tozalandi");

        console.log("[clearHistory] Starting background IndexedDB clear");
        // Clear IndexedDB in background (fire and forget)
        offlineDB.offlineSales
          .where("userId")
          .equals(userId)
          .delete()
          .then(() => console.log("[clearHistory] IndexedDB cleared successfully"))
          .catch(err => console.error("[clearHistory] Failed to clear IndexedDB:", err));

        console.log("[clearHistory] Starting background server clear");
        // Try to clear server-side history (fire and forget)
        try {
          const apiBase = window.location.protocol === 'file:'
            ? 'http://127.0.0.1:5174'
            : (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '');

          console.log("[clearHistory] API base:", apiBase);

          fetch(`${apiBase}/api/sales/clear-history?userId=${encodeURIComponent(userId)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
          })
            .then(res => console.log("[clearHistory] Server response:", res.status))
            .catch(err => console.error("[clearHistory] Failed to clear server history:", err));
        } catch (serverError) {
          console.error("[clearHistory] Server error:", serverError);
        }

        console.log("[clearHistory] Clear history process completed");
      } catch (error) {
        console.error("[clearHistory] Error:", error);
        toast.error("Tarix tozalashda xatolik yuz berdi");
      }
    },
    [userId]
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
              <button onClick={async () => { await reloadProducts(); await triggerSync(); }} disabled={isSyncing || isLoading} className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${isSyncing || isLoading ? "animate-spin" : ""}`} />
              </button>
            )}
            <button onClick={() => setHistoryOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-300 hover:bg-slate-700/80 hover:border-slate-600/50 transition-all shadow-md">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline text-sm font-medium">Tarix</span>
              {salesHistory.length > 0 && <span className="bg-emerald-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{salesHistory.length}</span>}
            </button>
          </div>
        }
      />

      <div className={`pt-12 sm:pt-14 lg:pt-16 pb-20 md:pb-4 transition-all duration-300 ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-72 xl:pl-80"}`}>
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

            {/* Middle Section: Table + Numpad - More space for table */}
            <div className="flex-1 flex flex-col lg:flex-row gap-1 sm:gap-2 md:gap-2 min-h-0 overflow-auto lg:overflow-hidden">

              {/* TABLE CONTAINER - Responsive - Extended on mobile */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden order-2 lg:order-1 lg:max-h-none">
                <div className={`flex-1 bg-gradient-to-br from-slate-900 via-blue-950/30 to-slate-900 rounded-lg border overflow-hidden flex flex-col ${isRefundMode ? "border-orange-600/50" : "border-gray-700"}`}>

                  {/* Table Header - Responsive */}
                  <div className="bg-gray-800 border-b border-gray-700 flex-shrink-0 overflow-x-auto">
                    <div className="grid grid-cols-[28px_45px_1fr_55px_75px_85px_95px_75px] sm:grid-cols-[28px_50px_1fr_60px_80px_100px_110px_80px] lg:grid-cols-[32px_60px_1fr_70px_90px_110px_130px_90px] gap-1 sm:gap-2 lg:gap-3 px-3 sm:px-3 lg:px-4 py-3 sm:py-3 lg:py-4 text-xs sm:text-xs font-bold text-slate-400 uppercase tracking-wider min-w-[600px]">
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
                              className={`grid grid-cols-[28px_45px_1fr_55px_75px_85px_95px_75px] sm:grid-cols-[28px_50px_1fr_60px_80px_100px_110px_80px] lg:grid-cols-[32px_60px_1fr_70px_90px_110px_130px_90px] gap-1 sm:gap-2 lg:gap-3 px-3 sm:px-3 lg:px-4 py-3 sm:py-3 lg:py-4 border-b border-slate-700/30 cursor-pointer transition-all hover:bg-slate-700/30 ${selectedItems.has(item.id) ? "bg-blue-500/10" : ""}`}
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
                              <div className="text-xs sm:text-xs text-purple-400 font-bold self-center truncate">{item.sku || "-"}</div>
                              <div className="text-sm sm:text-sm text-slate-200 self-center font-medium min-w-0 overflow-hidden">
                                <div className="overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent hover:scrollbar-thumb-slate-500 pb-0.5 pr-2" title={item.name}>
                                  {item.name}
                                </div>
                              </div>
                              <div className={`text-xs sm:text-xs font-bold self-center text-center ${stockColor}`}>{currentStock}</div>
                              <div className="flex items-center justify-center">
                                <input
                                  ref={(el) => {
                                    if (el) {
                                      quantityInputRefs.current[index] = el;
                                    }
                                  }}
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  placeholder="Soni"
                                  value={item.quantity > 0 ? item.quantity.toString() : ""}
                                  onChange={(e) => {
                                    const inputVal = e.target.value.replace(/[^\d]/g, '');
                                    const val = parseInt(inputVal) || 0;
                                    updateQuantity(index, val, val === 0);
                                  }}
                                  onFocus={(e) => {
                                    e.target.value = '';
                                    setActiveInput("quantity");
                                    setSelectedItemIndex(index);
                                  }}
                                  onBlur={(e) => {
                                    const currentValue = e.target.value;
                                    if (currentValue === '') {
                                      e.target.value = item.quantity.toString();
                                    }
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveInput("quantity");
                                    setSelectedItemIndex(index);
                                  }}
                                  className="w-16 sm:w-20 lg:w-24 h-6 sm:h-7 lg:h-8 text-center text-xs sm:text-sm font-bold text-slate-200 bg-slate-700/80 border border-slate-600/50 rounded-lg sm:rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                />
                              </div>
                              <div className="text-right text-xs sm:text-xs lg:text-sm text-slate-400 self-center font-medium truncate">{formatNum(item.price)}</div>
                              <div className="text-right text-xs sm:text-xs lg:text-sm font-bold text-slate-200 self-center overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-slate-600" title={formatNum(itemTotal)}>
                                {formatNum(itemTotal)}
                              </div>
                              <div className="flex justify-center self-center gap-1">
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
                    {/* Tanlanganni o'chirish tugmasi */}
                    {checkItems.length > 0 && selectedItems.size > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={() => {
                            // Tanlangan mahsulotlarni o'chirish
                            selectedItems.forEach(itemId => {
                              removeFromCart(itemId);
                            });
                            setSelectedItems(new Set());
                            toast.success(`${selectedItems.size} ta mahsulot o'chirildi`);
                          }}
                          className="w-full py-2 px-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          {selectedItems.size} ta o'chirish
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ===== RIGHT SIDE: NUMPAD ===== */}
              <div className="w-full h-96 sm:h-[28rem] lg:w-[240px] lg:h-auto xl:w-[280px] 2xl:w-[320px] flex-shrink-0 order-1 lg:order-2">
                {/* NUMPAD CARD - Very small */}
                <div className={`bg-gradient-to-br from-slate-900 via-blue-950/30 to-slate-900 rounded-xl border overflow-hidden flex flex-col h-full p-3 sm:p-4 lg:p-5 pb-6 sm:pb-7 lg:pb-8 ${isRefundMode ? "border-orange-600/50" : "border-gray-700"}`}>

                  {/* KOD/SON Toggle Buttons */}
                  <div className="flex gap-3 mb-3 sm:mb-4 lg:mb-5">
                    <button
                      onClick={() => setActiveInput("code")}
                      className={`flex-1 py-3 sm:py-4 lg:py-4 px-4 rounded-lg font-bold text-base sm:text-lg lg:text-xl transition-all ${activeInput === "code"
                          ? "bg-blue-600 text-white border border-blue-500"
                          : "bg-slate-700 text-gray-300 border border-slate-600 hover:bg-slate-600"
                        }`}
                    >
                      KOD
                    </button>
                    <button
                      onClick={() => {
                        if (checkItems.length > 0) {
                          setActiveInput("quantity");
                          setSelectedItemIndex(checkItems.length - 1);
                        }
                      }}
                      disabled={checkItems.length === 0}
                      className={`flex-1 py-3 sm:py-4 lg:py-4 px-4 rounded-lg font-bold text-base sm:text-lg lg:text-xl transition-all ${activeInput === "quantity"
                          ? "bg-blue-600 text-white border border-blue-500"
                          : checkItems.length === 0
                            ? "bg-slate-700 text-gray-500 border border-slate-600 cursor-not-allowed opacity-50"
                            : "bg-slate-700 text-gray-300 border border-slate-600 hover:bg-slate-600"
                        }`}
                    >
                      SON
                    </button>
                  </div>

                  {/* Code/Quantity Input */}
                  <input
                    type="text"
                    placeholder={activeInput === "code" ? "Kod kiriting..." : "Soni..."}
                    value={activeInput === "code" ? numpadValue : (selectedItemIndex !== null && quantityInputRefs.current[selectedItemIndex]?.value) || ""}
                    onChange={(e) => {
                      if (activeInput === "code") {
                        setNumpadValue(e.target.value);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (activeInput === "code") {
                          const value = e.currentTarget.value.trim();
                          if (value) {

                          }
                          setNumpadValue("");
                        } else {
                          handleNumpadPress("OK");
                        }
                      }
                    }}
                    className="w-full h-14 sm:h-16 lg:h-18 mb-3 sm:mb-4 lg:mb-5 text-center text-lg sm:text-xl lg:text-2xl font-bold bg-gray-800 text-white placeholder:text-gray-500 rounded-lg border border-gray-700 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all"
                    autoComplete="off"
                    readOnly={activeInput === "quantity"}
                  />

                  {/* Numpad Grid - 4x4 layout - Large rectangular buttons */}
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2 lg:gap-3">
                    {/* Row 1: 7, 8, 9, C */}
                    {["7", "8", "9"].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleNumpadPress(key)}
                        className="h-16 sm:h-18 lg:h-20 rounded-lg text-2xl sm:text-3xl lg:text-4xl font-bold bg-slate-800/80 text-white border border-slate-600/50 hover:bg-slate-700 hover:border-slate-500 active:bg-slate-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all flex items-center justify-center touch-manipulation shadow-lg shadow-black/20"
                      >
                        {key}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleNumpadPress("C")}
                      className="h-16 sm:h-18 lg:h-20 rounded-lg text-2xl sm:text-3xl lg:text-4xl font-bold bg-red-500 text-white hover:bg-red-400 active:bg-red-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all flex items-center justify-center touch-manipulation shadow-lg shadow-red-500/30"
                    >
                      C
                    </button>

                    {/* Row 2: 4, 5, 6, ⌫ */}
                    {["4", "5", "6"].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleNumpadPress(key)}
                        className="h-16 sm:h-18 lg:h-20 rounded-lg text-2xl sm:text-3xl lg:text-4xl font-bold bg-slate-800/80 text-white border border-slate-600/50 hover:bg-slate-700 hover:border-slate-500 active:bg-slate-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all flex items-center justify-center touch-manipulation shadow-lg shadow-black/20"
                      >
                        {key}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleNumpadPress("⌫")}
                      className="h-16 sm:h-18 lg:h-20 rounded-lg text-2xl sm:text-3xl lg:text-4xl font-bold bg-orange-500 text-white hover:bg-orange-400 active:bg-orange-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-orange-400/50 transition-all flex items-center justify-center touch-manipulation shadow-lg shadow-orange-500/30"
                    >
                      ⌫
                    </button>

                    {/* Row 3: 1, 2, 3, + (spans 2 rows but smaller) */}
                    {["1", "2", "3"].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleNumpadPress(key)}
                        className="h-16 sm:h-18 lg:h-20 rounded-lg text-2xl sm:text-3xl lg:text-4xl font-bold bg-slate-800/80 text-white border border-slate-600/50 hover:bg-slate-700 hover:border-slate-500 active:bg-slate-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all flex items-center justify-center touch-manipulation shadow-lg shadow-black/20"
                      >
                        {key}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleNumpadPress("OK")}
                      className="row-span-2 h-[7.5rem] sm:h-[8.5rem] lg:h-[9.5rem] rounded-lg text-lg sm:text-xl lg:text-2xl font-bold bg-emerald-500 text-white hover:bg-emerald-400 active:bg-emerald-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all flex items-center justify-center touch-manipulation shadow-lg shadow-emerald-500/30"
                    >
                      +
                    </button>

                    {/* Row 4: 0, 00 */}
                    {["0", "00"].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleNumpadPress(key)}
                        className="h-16 sm:h-18 lg:h-20 rounded-lg text-2xl sm:text-3xl lg:text-4xl font-bold bg-slate-800/80 text-white border border-slate-600/50 hover:bg-slate-700 hover:border-slate-500 active:bg-slate-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all flex items-center justify-center touch-manipulation shadow-lg shadow-black/20"
                      >
                        {key}
                      </button>
                    ))}
                    {/* Bo'sh joy */}
                    <div className="h-16 sm:h-18 lg:h-20"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS - Footer - Hidden on mobile, shown on desktop */}
            <div className="hidden md:flex items-center gap-1.5 sm:gap-2 lg:gap-3 flex-shrink-0 flex-wrap">
              {/* Search Button */}
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 sm:px-4 sm:py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold text-sm sm:text-sm transition-all active:scale-95 shadow-md shadow-red-500/20 flex-1 sm:flex-initial min-w-[100px]"
              >
                <Search className="w-4 h-4 sm:w-4 sm:h-4" />
                <span>Qidirish</span>
              </button>

              {/* Qaytarish tugmasi */}
              {!isRefundMode ? (
                // Oddiy holat - Qaytarish tugmasi
                <button
                  onClick={() => {
                    setIsRefundMode(true);
                    refreshCache(); // Cache ni tozalash


                    // Test notification
                    toast.success('Qaytarish rejimiga o\'tildi! Validation ishlaydi.', { duration: 3000 });
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 sm:px-4 sm:py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm sm:text-sm transition-all active:scale-95 shadow-md shadow-orange-500/20 flex-1 sm:flex-initial min-w-[100px]"
                >
                  <RotateCcw className="w-4 h-4 sm:w-4 sm:h-4" />
                  <span>Qaytarish</span>
                </button>
              ) : (
                // Qaytarish rejimi faol
                <button
                  onClick={() => {
                    setIsRefundMode(false);
                    setIsDefective(false);
                    setSelectedItems(new Set());
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 sm:px-4 sm:py-2.5 rounded-lg bg-orange-500 text-white font-semibold text-sm sm:text-sm transition-all active:scale-95 shadow-md shadow-orange-500/20 ring-2 ring-orange-400 flex-1 sm:flex-initial min-w-[100px]"
                >
                  <RotateCcw className="w-4 h-4 sm:w-4 sm:h-4" />
                  <span>Qaytarish</span>
                </button>
              )}

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
                        const iInitialStock = i.initialStock ?? 0;
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
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 sm:px-4 sm:py-2.5 rounded-lg font-semibold text-sm sm:text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex-1 sm:flex-initial min-w-[100px] ${hasStockError
                    ? "bg-red-500 text-white shadow-red-500/20"
                    : isRefundMode
                      ? "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20"
                      : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
                  }`}
                title={hasStockError ? (isRefundMode ? 'Sotilgan miqdordan ortiq qaytara olmaysiz' : `Omborda yetarli emas: ${stockErrorItems.map(i => i.name).join(', ')}`) : ''}
              >
                <CreditCard className="w-4 h-4 sm:w-4 sm:h-4" />
                <span>{hasStockError ? "Yetarli emas" : isRefundMode ? "Qaytarish" : "To'lov"}</span>
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation - Only visible on mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[9998] bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 backdrop-blur-sm border-t border-gray-700/50 shadow-2xl">
        <div className="flex items-center justify-around py-3 px-2">
          {/* Search Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 transition-all duration-200 shadow-lg min-w-[60px]"
            title="Qidirish"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-red-400 to-red-600 flex items-center justify-center">
              <Search className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium">Qidirish</span>
          </button>

          {/* Return Button */}
          {!isRefundMode ? (
            <button
              onClick={() => {
                setIsRefundMode(true);
                refreshCache();
                toast.success('Qaytarish rejimiga o\'tildi!', { duration: 3000 });
              }}
              className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/30 text-orange-400 hover:text-orange-300 transition-all duration-200 shadow-lg min-w-[60px]"
              title="Qaytarish"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 flex items-center justify-center">
                <RotateCcw className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium">Qaytarish</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setIsRefundMode(false);
                setIsDefective(false);
                setSelectedItems(new Set());
              }}
              className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-orange-600/30 border-2 border-orange-400/50 text-orange-300 transition-all duration-200 shadow-lg min-w-[60px]"
              title="Qaytarish rejimi faol"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 flex items-center justify-center">
                <RotateCcw className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium">Qaytarish</span>
            </button>
          )}

          {/* Payment Button */}
          <button
            onClick={() => {
              if (hasStockError) {
                if (isRefundMode) {
                  const errorNames = stockErrorItems.map(i => {
                    const defectiveKey = i.id.includes('-v') ? i.id : i.productId;
                    const defectiveCount = defectiveCounts.get(defectiveKey) || 0;
                    const iStock = i.stock ?? 0;
                    const iInitialStock = i.initialStock ?? 0;
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
            className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-all duration-200 shadow-lg min-w-[60px] ${hasStockError
                ? "bg-red-600/20 border-red-500/30 text-red-400 opacity-50"
                : isRefundMode
                  ? "bg-orange-600/20 hover:bg-orange-600/30 border-orange-500/30 text-orange-400 hover:text-orange-300"
                  : "bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/30 text-emerald-400 hover:text-emerald-300"
              }`}
            title={hasStockError ? (isRefundMode ? 'Sotilgan miqdordan ortiq qaytara olmaysiz' : 'Omborda yetarli emas') : (isRefundMode ? 'Qaytarish' : 'To\'lov')}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${hasStockError
                ? "bg-gradient-to-r from-red-400 to-red-600"
                : isRefundMode
                  ? "bg-gradient-to-r from-orange-400 to-orange-600"
                  : "bg-gradient-to-r from-emerald-400 to-emerald-600"
              }`}>
              <CreditCard className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium">
              {hasStockError ? "Xato" : isRefundMode ? "Qaytarish" : "To'lov"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile padding for bottom navigation */}
      <div className="md:hidden h-20"></div>


      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[95vh] p-0 bg-slate-900 border-slate-700 rounded-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 rounded-xl bg-red-500/10 border-2 border-red-500/30">
                  <Search className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold text-white">Mahsulot qidirish</h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5 sm:mt-1">
                    {productsCount} ta mahsulot mavjud
                    {!isOnline && <span className="ml-2 text-amber-400">• Offline</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Search Input */}
            <div className="mt-3 sm:mt-4">
              <Input
                placeholder="Mahsulot nomi yoki shtrix-kod kiriting..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="bg-slate-800 border-slate-700 text-white h-12 sm:h-14 text-base sm:text-lg rounded-xl px-4 sm:px-5 placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto p-6">
            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-12 h-12 animate-spin text-slate-400 mb-4" />
                <span className="text-slate-400 font-medium">Qidirilmoqda...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="w-16 h-16 text-slate-600 mb-4" />
                <p className="text-slate-400 text-lg">
                  {searchQuery ? "Mahsulot topilmadi" : "Qidirish uchun nom yoki kod kiriting"}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {searchResults.slice(0, 50).map((result) => {
                  const isVariantResult = result.isVariant;
                  const displayStock = result.displayStock;
                  const displayPrice = result.displayPrice;
                  const displayName = result.displayName;
                  const parentName = result.parentProductName;
                  const displaySku = result.displaySku;
                  const isOutOfStock = displayStock <= 0;

                  // Highlight funksiyasi - qidiruv so'zini ajratib ko'rsatish
                  const highlightText = (text: string, query: string) => {
                    if (!query || !text) return text;

                    // Regex maxsus belgilarini escape qilish
                    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                    try {
                      const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
                      return (
                        <>
                          {parts.map((part, i) =>
                            part.toLowerCase() === query.toLowerCase() ? (
                              <mark key={i} className="bg-yellow-400 text-black px-1 rounded font-bold">
                                {part}
                              </mark>
                            ) : (
                              <span key={i}>{part}</span>
                            )
                          )}
                        </>
                      );
                    } catch (e) {
                      // Agar regex xato bo'lsa, oddiy textni qaytarish
                      return text;
                    }
                  };

                  return (
                    <div
                      key={isVariantResult ? `${result.product.id}-v${result.variantIndex}` : result.product.id}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${isOutOfStock
                          ? "border-red-500/30 bg-red-900/10 opacity-60"
                          : isVariantResult
                            ? "border-purple-500/50 bg-purple-900/20 hover:bg-purple-900/30 hover:border-purple-500/70"
                            : "border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600"
                        }`}
                      onClick={() => {
                        if (!isOutOfStock || isRefundMode) {
                          if (isVariantResult && result.variantIndex !== undefined) {
                            addProduct(result.product, result.variantIndex);
                          } else {
                            addProduct(result.product);
                          }
                          setSearchOpen(false);
                          setSearchQuery("");
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-4">
                        {/* Left: Product Info */}
                        <div className="flex-1 min-w-0">
                          {/* Parent name for variants */}
                          {isVariantResult && parentName && (
                            <div className="text-xs text-purple-400 mb-1 flex items-center gap-1">
                              <span>📦</span>
                              <span className="truncate">{highlightText(parentName, searchQuery)}</span>
                              <span className="text-purple-500/50">→</span>
                            </div>
                          )}

                          {/* Product Name */}
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className={`text-lg font-bold truncate ${isOutOfStock ? "text-slate-500" :
                                isVariantResult ? "text-purple-300" : "text-white"
                              }`}>
                              {displayName ? highlightText(displayName, searchQuery) : `Kod: ${displaySku || result.product.id.slice(-6)}`}
                            </h3>
                            {isVariantResult && (
                              <span className="px-2 py-0.5 text-xs bg-purple-600 text-white rounded-full font-bold">
                                VARIANT
                              </span>
                            )}
                            {isOutOfStock && !isRefundMode && (
                              <span className="text-red-400">🚫</span>
                            )}
                          </div>

                          {/* Meta Info */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {displaySku && (
                              <span className={`px-2 py-1 text-xs font-semibold rounded ${isVariantResult ? "bg-purple-500/20 text-purple-300" : "bg-slate-700 text-slate-300"
                                }`}>
                                Kod: {highlightText(displaySku, searchQuery)}
                              </span>
                            )}
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${isOutOfStock ? "bg-red-500/20 text-red-400 border border-red-500/50" : "bg-green-500/20 text-green-400"
                              }`}>
                              {isOutOfStock ? "TUGAGAN" : `${displayStock} dona`}
                            </span>
                          </div>
                        </div>

                        {/* Right: Price */}
                        <div className={`text-2xl font-bold ${isOutOfStock ? "text-slate-500" :
                            isVariantResult ? "text-purple-300" : "text-green-400"
                          }`}>
                          ${formatNum(displayPrice)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sales History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border-slate-700/50 backdrop-blur-xl rounded-3xl">
          <DialogHeader className="pr-10 flex flex-row items-center justify-between">
            <DialogTitle className="text-slate-200 text-2xl font-bold flex items-center gap-3">
              <History className="w-6 h-6 text-emerald-400" />
              Sotuvlar tarixi
              {pendingSalesCount > 0 && <span className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full font-medium">{pendingSalesCount} ta sinxronlanmagan</span>}
            </DialogTitle>
            {user?.role === 'egasi' && (
              <button
                onClick={() => {
                  console.log("[ClearButton] Clear button clicked");
                  setClearHistoryConfirmOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 hover:border-red-500/50 transition-all text-sm font-medium"
                title="Tarixni tozalash (faqat ega uchun)"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Tozalash</span>
              </button>
            )}
          </DialogHeader>

          {/* Search Input */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Sana bo'yicha qidirish (yyyy-mm-dd)..."
                className="pl-12 pr-4 py-3 bg-slate-800/50 border-slate-600/50 text-slate-200 placeholder-slate-400 rounded-xl focus:border-emerald-500/50 focus:ring-emerald-500/20"
                value={searchQuery}
                onChange={(e) => {
                  // Faqat raqam va "-" belgisini qabul qilish
                  const value = e.target.value.replace(/[^0-9-]/g, '');
                  setSearchQuery(value);
                }}
                onKeyDown={(e) => {
                  // Faqat raqam, "-", backspace, delete, arrow keys ga ruxsat
                  const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
                  const isNumber = /^[0-9]$/.test(e.key);
                  const isDash = e.key === '-';

                  if (!isNumber && !isDash && !allowedKeys.includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                maxLength={10} // yyyy-mm-dd = 10 belgi
              />
            </div>
          </div>

          {/* Bugun / O'tgan Switch */}
          <div className="flex gap-3 mb-6">
            <button
              type="button"
              onClick={() => setHistoryFilter("today")}
              className={`flex-1 py-3 rounded-xl text-base font-bold transition-all ${historyFilter === "today"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
            >
              Bugun
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter("past")}
              className={`flex-1 py-3 rounded-xl text-base font-bold transition-all ${historyFilter === "past"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
            >
              O'tgan kunlar
            </button>
          </div>

          <div className="max-h-[65vh] overflow-auto space-y-6 pr-2">
            {(() => {
              // Bugungi sanani olish
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              // Sana qidiruv filtri
              // Sana qidiruv filtri - yyyy-mm-dd format (soddalashtirilgan)
              const matchesSearchDate = (saleDate: Date, searchText: string) => {
                if (!searchText.trim()) return true;

                // Sale sanasini yyyy-mm-dd formatga o'tkazish
                const year = saleDate.getFullYear();
                const month = String(saleDate.getMonth() + 1).padStart(2, '0');
                const day = String(saleDate.getDate()).padStart(2, '0');
                const saleDateStr = `${year}-${month}-${day}`;

                const searchTrimmed = searchText.trim();

                // Debug logging
                console.log('[History Search] Sale date:', saleDateStr, 'Search:', searchTrimmed);

                // To'liq mos kelish
                if (saleDateStr === searchTrimmed) {
                  console.log('[History Search] Exact match found!');
                  return true;
                }

                // Qisman mos kelish - boshidan
                if (saleDateStr.startsWith(searchTrimmed)) {
                  console.log('[History Search] Partial match found!');
                  return true;
                }

                console.log('[History Search] No match found');
                return false;
              };

              // Filtrlangan tarix
              const filteredHistory = salesHistory.filter((sale) => {
                const saleDate = new Date(sale.date);
                saleDate.setHours(0, 0, 0, 0);

                console.log('[History Filter] Processing sale:', sale.id, 'Date:', saleDate, 'Search query:', searchQuery);

                // Sana qidiruv filtri
                if (searchQuery && !matchesSearchDate(saleDate, searchQuery)) {
                  console.log('[History Filter] Sale filtered out by date search');
                  return false;
                }

                // Tarix dialogida BARCHA sotuvlar va qaytarishlar ko'rsatiladi
                // Qaytarish rejimida faqat refund turini ko'rsatish
                if (isRefundMode && sale.type !== "refund") {
                  console.log('[History Filter] Sale filtered out by refund mode');
                  return false;
                }

                // Agar qidiruv bo'lsa, bugun/o'tgan filtrini e'tiborsiz qoldirish
                if (searchQuery) {
                  console.log('[History Filter] Sale passed search filter');
                  return true;
                }

                // Sotish rejimida BARCHA turlarni ko'rsatish (sale va refund)
                // Faqat sana filtri qo'llaniladi

                if (historyFilter === "today") {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const result = saleDate.getTime() === today.getTime();
                  console.log('[History Filter] Today filter result:', result);
                  return result;
                } else {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const result = saleDate.getTime() < today.getTime();
                  console.log('[History Filter] Past filter result:', result);
                  return result;
                }
              });

              console.log('[History Filter] Total sales:', salesHistory.length, 'Filtered:', filteredHistory.length);

              if (filteredHistory.length === 0) {
                return (
                  <div className="text-center text-slate-500 py-16">
                    <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <h3 className="text-xl font-semibold mb-2">
                      {searchQuery ? "Topilmadi" : historyFilter === "today" ? "Bugun sotuvlar yo'q" : "O'tgan kunlarda sotuvlar yo'q"}
                    </h3>
                    <p className="text-slate-400">
                      {searchQuery ? `"${searchQuery}" sanasida sotuvlar topilmadi` : historyFilter === "today" ? "Birinchi sotuvni amalga oshiring" : "Boshqa sanani tanlang"}
                    </p>
                  </div>
                );
              }

              // Sanalar bo'yicha guruhlash
              const grouped: Record<string, SaleHistory[]> = {};
              filteredHistory.forEach((sale) => {
                const saleDate = new Date(sale.date);
                const year = saleDate.getFullYear();
                const month = String(saleDate.getMonth() + 1).padStart(2, '0');
                const day = String(saleDate.getDate()).padStart(2, '0');
                const dateKey = `${year}-${month}-${day}`;

                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(sale);
              });

              return Object.entries(grouped).map(([dateKey, sales]) => (
                <div key={dateKey} className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="text-2xl font-bold text-slate-200">{dateKey}</div>
                    <div className="flex-1 h-px bg-gradient-to-r from-slate-600/50 to-transparent" />
                    <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-medium">
                      {sales.length} ta sotuv
                    </div>
                  </div>
                  <div className="space-y-3">
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
                          className={`p-4 border rounded-xl cursor-pointer transition-all hover:scale-[1.02] ${isRefund
                              ? "border-red-500/40 bg-red-900/20 hover:bg-red-800/30 hover:border-red-400/60"
                              : "border-slate-600/50 bg-slate-700/30 hover:bg-slate-600/50 hover:border-slate-500/60"
                            }`}
                          onClick={() => setSelectedSale(sale)}
                        >
                          <div className="flex items-center gap-4">
                            {/* Truck Icon */}
                            <div className={`p-3 rounded-xl flex-shrink-0 ${isRefund ? "bg-red-500/20" : "bg-emerald-500/20"}`}>
                              <Truck className={`w-6 h-6 ${isRefund ? "text-red-400" : "text-emerald-400"}`} />
                            </div>

                            {/* Ma'lumotlar */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                {isRefund && <RotateCcw className="w-4 h-4 text-red-400" />}
                                <span className={`font-bold ${isRefund ? "text-red-400" : "text-slate-200"}`}>
                                  #{idx + 1}
                                </span>
                                <span className="text-slate-400 text-sm">
                                  {new Date(sale.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <PaymentIcon className={`w-4 h-4 ${isRefund ? "text-red-400" : "text-slate-400"}`} />
                                {!sale.synced && <CloudOff className="w-4 h-4 text-amber-500" title="Sinxronlanmagan" />}
                              </div>

                              {/* Mahsulot nomlari */}
                              <div className={`text-sm font-medium truncate ${isRefund ? "text-red-300" : "text-slate-300"}`}>
                                {displayNames}
                                {moreCount > 0 && <span className="text-slate-500 ml-1">+{moreCount} ta</span>}
                              </div>
                            </div>

                            {/* Summa */}
                            <div className="flex-shrink-0">
                              <span className={`text-xl font-black ${isRefund ? "text-red-500" : "text-emerald-500"}`}>
                                {isRefund ? "-" : ""}{formatNum(sale.total)}
                                <span className="text-sm ml-1 opacity-70">so'm</span>
                              </span>
                            </div>
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

      {/* Sale Detail Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 bg-slate-900 border-slate-700 rounded-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-8 py-6 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-xl ${selectedSale?.type === "refund" ? "bg-red-500/10 border-2 border-red-500/30" : "bg-green-500/10 border-2 border-green-500/30"}`}>
                  {selectedSale?.type === "refund" ? (
                    <RotateCcw className="w-8 h-8 text-red-400" />
                  ) : (
                    <ShoppingCart className="w-8 h-8 text-green-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {selectedSale?.type === "refund" ? "Qaytarish Cheki" : "Sotuv Cheki"}
                  </h2>
                  <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                    <span>{selectedSale && new Date(selectedSale.date).toLocaleDateString("uz-UZ")}</span>
                    <span>•</span>
                    <span>{selectedSale && new Date(selectedSale.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                    {selectedSale && !selectedSale.synced && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-amber-400">
                          <CloudOff className="w-3 h-3" />
                          Offline
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          {selectedSale && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-8">
                {/* Items */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                  {/* Table Header */}
                  <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
                    <div className="grid grid-cols-[3fr_1fr_1.5fr_1.5fr] gap-4 text-xs font-semibold text-slate-400 uppercase">
                      <div>Mahsulot</div>
                      <div className="text-center">Soni</div>
                      <div className="text-right">Narxi</div>
                      <div className="text-right">Summa</div>
                    </div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-slate-700/50">
                    {selectedSale.items.map((item, i) => {
                      const itemTotal = (item.quantity || 0) * (item.price || 0);
                      return (
                        <div key={i} className="px-6 py-4 hover:bg-slate-700/30 transition-colors">
                          <div className="grid grid-cols-[3fr_1fr_1.5fr_1.5fr] gap-4 items-center">
                            <div>
                              <div className="text-white font-medium">{item.name}</div>
                              {item.sku && <div className="text-xs text-slate-500 mt-1">SKU: {item.sku}</div>}
                            </div>
                            <div className="text-center">
                              <span className="inline-block px-3 py-1 bg-slate-700 rounded-lg text-white font-semibold">
                                {item.quantity}
                              </span>
                            </div>
                            <div className="text-right text-slate-300 font-medium">
                              {formatNum(item.price || 0)}
                            </div>
                            <div className="text-right text-white font-semibold">
                              {formatNum(itemTotal)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total */}
                  <div className="bg-slate-800 px-6 py-5 border-t-2 border-slate-700">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-slate-300">JAMI:</span>
                      <span className={`text-3xl font-bold ${selectedSale.type === "refund" ? "text-red-400" : "text-green-400"}`}>
                        {selectedSale.type === "refund" ? "-" : ""}${formatNum(selectedSale.total)}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      To'lov turi: <span className="text-white font-medium">{selectedSale.paymentType || "Naqd"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-8 py-6 bg-slate-800 border-t border-slate-700 flex-shrink-0">
            <Button
              className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-semibold text-lg rounded-xl flex items-center justify-center gap-3 transition-all"
              onClick={async () => {
                setIsPrinting(true);
                try {
                  const receiptData: ReceiptData = {
                    type: selectedSale!.type || "sale",
                    items: selectedSale!.items.map((item: any) => ({
                      name: item.name,
                      sku: item.sku,
                      quantity: item.quantity,
                      price: item.price,
                      discount: item.discount
                    })),
                    total: selectedSale!.total,
                    paymentType: selectedSale!.paymentType || "Naqd",
                    cashier: user?.name,
                    date: new Date(selectedSale!.date),
                    receiptNumber: selectedSale!.id,
                    storeName: storeInfo.storeName,
                    storeAddress: storeInfo.storeAddress,
                    storePhone: storeInfo.storePhone,
                    userRole: user?.role as 'admin' | 'xodim' | 'ega',
                  };
                  await printReceipt(selectedPrinter, receiptData);
                } catch (e) {
                  console.error('Print error:', e);
                } finally {
                  setIsPrinting(false);
                }
              }}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Chop etilmoqda...
                </>
              ) : (
                <>
                  <Printer className="w-6 h-6" />
                  Chekni chop etish
                </>
              )}
            </Button>
          </div>
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
                <Button key={type} className={`h-24 flex-col gap-3 bg-gradient-to-br ${color} text-white rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`} onClick={() => {
                  if (type === "Aralash") {
                    setMixedPayments([]);
                    setRemainingAmount(total);
                    setSelectedPaymentType(null);
                    setPaymentAmount("");
                    setMixedPaymentOpen(true);
                  } else {
                    handlePayment(type);
                  }
                }} disabled={isPrinting || isProcessingPayment}>
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

      {/* Mixed Payment Dialog */}
      <Dialog open={mixedPaymentOpen} onOpenChange={setMixedPaymentOpen}>
        <DialogContent className="max-w-md bg-slate-900/95 border-slate-700/50 backdrop-blur-xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-slate-200 flex items-center gap-3 text-xl font-bold">
              <Wallet className="w-5 h-5 text-amber-500" />
              Aralash to'lov
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Jami va qolgan summa */}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-4 rounded-2xl border bg-slate-800/50 border-slate-700/50">
                <div className="text-sm font-medium text-slate-400">Jami summa</div>
                <div className="text-2xl font-black text-green-500 mt-1">
                  {formatNum(total)}
                </div>
              </div>
              <div className="text-center p-4 rounded-2xl border bg-amber-900/20 border-amber-500/40">
                <div className="text-sm font-medium text-amber-400">Qolgan</div>
                <div className="text-2xl font-black text-amber-500 mt-1">
                  {Math.abs(remainingAmount) < 0.01 ? "0" : formatNum(Math.round(remainingAmount * 100) / 100)}
                </div>
              </div>
            </div>

            {/* To'lov turlari */}
            {!selectedPaymentType ? (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { type: "Naqd", icon: Banknote, color: "from-emerald-600 to-emerald-700" },
                  { type: "Karta", icon: CreditCard, color: "from-blue-600 to-blue-700" },
                  { type: "O'tkazma", icon: Smartphone, color: "from-purple-600 to-purple-700" },
                ].map(({ type, icon: Icon, color }) => (
                  <Button
                    key={type}
                    className={`h-20 flex-col gap-2 bg-gradient-to-br ${color} text-white rounded-2xl`}
                    onClick={() => {
                      setSelectedPaymentType(type);
                      setPaymentAmount(remainingAmount.toString());
                    }}
                    disabled={remainingAmount <= 0}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-sm font-bold">{type}</span>
                  </Button>
                ))}
              </div>
            ) : (
              /* Input form */
              <div className="space-y-4">
                <div className="text-center p-4 rounded-2xl border bg-blue-900/20 border-blue-500/40">
                  <div className="text-sm font-medium text-blue-400">Tanlangan to'lov turi</div>
                  <div className="text-xl font-bold text-blue-300 mt-1 flex items-center justify-center gap-2">
                    {selectedPaymentType === "Naqd" && <Banknote className="w-5 h-5" />}
                    {selectedPaymentType === "Karta" && <CreditCard className="w-5 h-5" />}
                    {selectedPaymentType === "O'tkazma" && <Smartphone className="w-5 h-5" />}
                    {selectedPaymentType}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Summa kiriting:</label>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0"
                    className="bg-slate-800/50 border-slate-600/50 text-white text-xl text-center h-14 rounded-xl"
                    autoFocus
                  />
                  <div className="text-xs text-slate-500 text-center">
                    Maksimal: {formatNum(remainingAmount)}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-slate-700 text-slate-300"
                    onClick={() => {
                      setSelectedPaymentType(null);
                      setPaymentAmount("");
                    }}
                  >
                    Bekor qilish
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0}
                    onClick={() => {
                      const amount = Math.min(Number(paymentAmount), remainingAmount);
                      setMixedPayments(prev => [...prev, { type: selectedPaymentType!, amount }]);
                      setRemainingAmount(prev => Math.round((prev - amount) * 100) / 100);
                      setSelectedPaymentType(null);
                      setPaymentAmount("");
                    }}
                  >
                    Qo'shish
                  </Button>
                </div>
              </div>
            )}

            {/* Qo'shilgan to'lovlar */}
            {mixedPayments.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-400">Qo'shilgan to'lovlar:</div>
                {mixedPayments.map((payment, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                    <div className="flex items-center gap-2">
                      {payment.type === "Naqd" && <Banknote className="w-4 h-4 text-emerald-400" />}
                      {payment.type === "Karta" && <CreditCard className="w-4 h-4 text-blue-400" />}
                      {payment.type === "O'tkazma" && <Smartphone className="w-4 h-4 text-purple-400" />}
                      <span className="text-slate-200">{payment.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold">{formatNum(payment.amount)}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                        onClick={() => {
                          setRemainingAmount(prev => Math.round((prev + payment.amount) * 100) / 100);
                          setMixedPayments(prev => prev.filter((_, i) => i !== index));
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tugmalar */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-slate-700 text-slate-300"
                onClick={() => {
                  setMixedPaymentOpen(false);
                  setSelectedPaymentType(null);
                  setPaymentAmount("");
                }}
              >
                Bekor qilish
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={Math.abs(remainingAmount) > 0.01 || mixedPayments.length === 0}
                onClick={() => {
                  const paymentTypes = mixedPayments.map(p => `${p.type}: ${formatNum(p.amount)}`).join(', ');
                  handlePayment(`Aralash (${paymentTypes})`);
                  setMixedPaymentOpen(false);
                }}
              >
                To'lovni yakunlash
              </Button>
            </div>
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
                <Button
                  onClick={async () => {
                    setIsPrinting(true);
                    try {
                      const receiptData: ReceiptData = {
                        type: "sale",
                        items: [],
                        total: 0,
                        discount: 0,
                        paymentType: "test",
                        cashier: user?.name,
                        date: new Date(),
                        receiptNumber: "TEST",
                        storeName: storeInfo.storeName,
                        storeAddress: storeInfo.storeAddress,
                        storePhone: storeInfo.storePhone,
                        userRole: user?.role as 'admin' | 'xodim' | 'ega',
                      };
                      await printReceipt(selectedPrinter, receiptData);
                    } catch (e) {
                      toast.error("Test chek chop etishda xatolik");
                    } finally {
                      setIsPrinting(false);
                    }
                  }}
                  disabled={isPrinting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isPrinting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
                  Test chek
                </Button>
              )}
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
                <Button variant="outline" className="flex-1 h-10 border-slate-700/50 text-slate-300 hover:bg-slate-800 rounded-xl text-xs" onClick={async () => { await openCashDrawer(selectedPrinter); }}>
                  Kassa ochish
                </Button>
              )}
            </div>

            <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-700/50">
              <p>• Chek printer - sotuvlar cheki uchun (58mm yoki 80mm)</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear History Confirmation Dialog */}
      <AlertDialog open={clearHistoryConfirmOpen} onOpenChange={setClearHistoryConfirmOpen}>
        <AlertDialogContent className="bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border-slate-700/50 backdrop-blur-xl fixed z-[99999]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Tarixni tozalash
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300 text-base">
              Tarixni butunlay tozalashni xohlaysizmi? Bu amalni qaytarib bo'lmaydi va barcha sotuvlar tarixini o'chirib yuboradi!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700">
              Bekor qilish
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                console.log("[AlertDialog] Ha, tozalash button clicked");
                clearHistory();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Ha, tozalash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
