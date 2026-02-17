import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Trash2, Tag, Loader2, Printer, X, FileSpreadsheet, Plus, Search, History, Download } from 'lucide-react';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';
import ProductStatusSelector, { productStatusConfig, type ProductStatus } from '@/components/ProductStatusSelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  listPrinters,
  requestUSBPrinter,
  printLabel,
  PrinterInfo,
  LabelSize,
  LABEL_SIZE_CONFIGS,
  DEFAULT_LABEL_WIDTH,
  DEFAULT_LABEL_HEIGHT,
  getDefaultLabelPrinterId,
  setDefaultLabelPrinterId,
} from '@/lib/pos-print';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import CurrencyPriceInput, { type Currency } from '@/components/CurrencyPriceInput';
import VariantModal from '@/components/VariantModal';
import { ExcelImportModal } from '@/components/ExcelImportModal';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'; // ✅ YANGI: Barcode scanner hook

interface ProductVariant {
  name: string;
  options: string[];
}

interface VariantSummary {
  name: string;
  sku?: string;
  customId?: string; // ✅ YANGI: Xil uchun Custom ID
  basePrice?: number;
  priceMultiplier?: number;
  price?: number;
  currency?: Currency;
  categoryId?: string;
  stock?: number;
  status?: string;
  imagePaths?: string[];
}

interface Product {
  id: string;
  name: string;
  price: number | null;
  basePrice?: number | null;
  priceMultiplier?: number | null;
  currency?: Currency;
  sku: string;
  customId?: string; // ✅ YANGI: Custom ID
  categoryId?: string | null;
  stock?: number | null;
  sizes?: string[];
  variants?: ProductVariant[];
  variantSummaries?: VariantSummary[];
  imageUrl?: string | null;
  imagePaths?: string[];
  status?: ProductStatus;
  description?: string;
  video?: {
    filename: string;
    url?: string;
    size?: number;
  };
}

interface CategoryOption {
  id: string;
  name: string;
  level: number;
  parentId?: string | null;
  markupPercentage?: number; // 🆕
}

// Mahsulot qo'shish/tahrirlash tarixi
interface ProductHistoryItem {
  id: string;
  type: 'create' | 'update' | 'delete' | 'variant_create' | 'variant_update';
  productId: string;
  productName: string;
  sku: string;
  variantName?: string;
  stock: number;
  addedStock?: number;
  price: number;
  currency: string;
  timestamp: Date;
  message: string;
  source?: 'manual' | 'excel'; // 'manual' - qo'lda qo'shilgan, 'excel' - Excel bilan qo'shilgan
  // Mahsulot ichidagi xillar (guruhlanganlar uchun)
  variants?: Array<{
    name: string;
    sku?: string;
    stock: number;
    price: number;
    currency?: string;
  }>;
  // MUHIM: Tahrirlash uchun o'zgarishlar - eski va yangi qiymatlar
  changes?: Array<{
    field: string; // Qaysi field o'zgartirildi (name, price, stock, etc.)
    oldValue: any; // Eski qiymat
    newValue: any; // Yangi qiymat
  }>;
}

// Qidiruv natijasi uchun interface - mahsulot yoki xil bo'lishi mumkin
interface SearchResultItem {
  type: 'product' | 'variant';
  product: Product;
  variant?: VariantSummary;
  variantIndex?: number;
  displayName: string;
  displayPrice: number;
  displayStock: number;
  displayImage?: string;
  daromad: number;
}

// API base URL - production va development uchun
const API_BASE_URL = (() => {
  if (typeof window === 'undefined') return '';

  // Electron (file://) uchun - port 5175
  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:5175';
  }

  const envApiUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

  const isPlaceholder = envApiUrl && (
    envApiUrl.includes('YOUR_PUBLIC_IP') ||
    envApiUrl.includes('your_public_ip')
  );

  if (envApiUrl && !isPlaceholder) {
    try {
      const u = new URL(envApiUrl);
      const pageIsHttps = window.location.protocol === 'https:';
      const apiIsHttp = u.protocol === 'http:';
      if (pageIsHttps && apiIsHttp) {
        u.protocol = 'https:';
      }
      return u.toString().replace(/\/$/, '');
    } catch {
      return envApiUrl;
    }
  }

  return '';
})();

const resolveMediaUrl = (url?: string | null): string => {
  if (!url) return '';
  if (/^(https?:)?\/\//.test(url) || url.startsWith('blob:')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
};

const getNextAutoSku = (items: Product[]): string => {
  // Barcha SKU larni to'plash: mahsulotlar + ularning xillari
  const allSkus: number[] = [];

  items.forEach((p) => {
    // Mahsulotning o'z SKU si
    const mainSku = (p.sku ?? '').trim();
    if (/^\d+$/.test(mainSku)) {
      const num = parseInt(mainSku, 10);
      if (Number.isFinite(num)) {
        allSkus.push(num);
      }
    }

    // variantSummaries - xillarning SKU lari
    if (Array.isArray(p.variantSummaries)) {
      p.variantSummaries.forEach((vs) => {
        const variantSku = (vs.sku ?? '').trim();
        if (/^\d+$/.test(variantSku)) {
          const num = parseInt(variantSku, 10);
          if (Number.isFinite(num)) {
            allSkus.push(num);
          }
        }
      });
    }
  });

  const max = allSkus.length ? Math.max(...allSkus) : 0;
  const next = max + 1;
  return String(next);
};

const getSkuNumeric = (sku: string | undefined | null): number => {
  const s = (sku ?? '').trim();
  if (!/^\d+$/.test(s)) return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
};

const fetchProductDetails = async (productId: string): Promise<any | null> => {
  if (!productId) return null;
  try {
    const response = await fetch(`${API_BASE_URL}/api/products/${productId}`);
    if (!response.ok) {
      console.warn('[Products] Failed to fetch product details:', { productId, status: response.status });
      return null;
    }

    const data = await response.json().catch(() => null);
    return data?.product ?? null;
  } catch (error) {
    console.error('[Products] Error fetching product details:', error);
    return null;
  }
};

const sortProductsBySku = (items: Product[]): Product[] => {
  return [...items].sort((a, b) => {
    const aNum = getSkuNumeric(a.sku);
    const bNum = getSkuNumeric(b.sku);
    if (aNum !== bNum) return aNum - bNum;
    return (a.sku ?? '').localeCompare(b.sku ?? '');
  });
};

const buildVariantsFromSizesText = (sizesText: string): ProductVariant[] => {
  const labels = sizesText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => entry.split('|')[0]?.trim())
    .filter(Boolean);

  const uniqueLabels = Array.from(new Set(labels));
  if (!uniqueLabels.length) return [];

  return [
    {
      name: "o'lcham",
      options: uniqueLabels,
    },
  ];
};

const getTodaySalesMap = (): Record<string, number> => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = `productSales:${today}`;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch (e) {
    console.error('Failed to read productSales from localStorage', e);
    return {};
  }
};

const getStatusForSales = (count: number): { label: string; color: string } => {
  if (count >= 10) return { label: 'Active', color: 'bg-green-600/80 text-white' };
  if (count >= 3) return { label: `O'rtacha`, color: 'bg-yellow-500/90 text-black' };
  return { label: 'Passiv', color: 'bg-gray-600/80 text-white' };
};

const normalizeProductStatus = (value: unknown): ProductStatus => {
  if (typeof value === 'string' && value in productStatusConfig) {
    return value as ProductStatus;
  }
  return 'available';
};

/**
 * Mahsulotlar va xillarni qidirish
 * Qidiruv so'zi bo'sh bo'lsa - faqat mahsulotlarni qaytaradi
 * Qidiruv so'zi bor bo'lsa - mahsulot nomi, kodi va xil nomi, kodini tekshiradi
 * MUHIM: Har bir mahsulot va xil o'z stockini ko'rsatadi
 */
const searchProductsAndVariants = (
  products: Product[],
  searchQuery: string
): SearchResultItem[] => {
  const results: SearchResultItem[] = [];
  const q = searchQuery.toLowerCase().trim();

  // Qidiruv bo'sh bo'lsa - faqat mahsulotlarni qaytarish
  if (!q) {
    return products.map(p => {
      // MUHIM: Har bir mahsulot o'z stockini ko'rsatadi (xillar yig'indisi emas)
      const mainStock = p.stock ?? 0;

      // Mahsulotning o'z daromadi
      let totalDaromad = (p.price ?? 0) * mainStock;

      // Xillarning daromadini qo'shish
      if (p.variantSummaries && p.variantSummaries.length > 0) {
        for (const v of p.variantSummaries) {
          const vPrice = v.price ?? 0;
          const vStock = v.stock ?? 0;
          totalDaromad += vPrice * vStock;
        }
      }

      // Mahsulot har doim o'zi ko'rsatiladi (stock 0 bo'lsa ham)
      return {
        type: 'product' as const,
        product: p,
        displayName: p.name,
        displayPrice: p.price ?? 0,
        displayStock: mainStock, // Faqat o'z stocki
        displayImage: p.imagePaths?.[0] || p.imageUrl || undefined,
        daromad: totalDaromad
      };
    });
  }

  for (const product of products) {
    // 1. Mahsulot nomi, SKU, kod yoki katalog bo'yicha qidirish
    const productMatches =
      product.name.toLowerCase().includes(q) ||
      (product.sku ?? '').toLowerCase().includes(q) ||
      ((product as any).code ?? '').toLowerCase().includes(q) ||
      ((product as any).catalogNumber ?? '').toLowerCase().includes(q);

    if (productMatches) {
      // MUHIM: Har bir mahsulot o'z stockini ko'rsatadi
      const mainStock = product.stock ?? 0;

      // Mahsulotning o'z daromadi + xillarning daromadi
      let totalDaromad = (product.price ?? 0) * mainStock;
      if (product.variantSummaries && product.variantSummaries.length > 0) {
        for (const v of product.variantSummaries) {
          totalDaromad += (v.price ?? 0) * (v.stock ?? 0);
        }
      }

      // Mahsulot har doim o'zi ko'rsatiladi (stock 0 bo'lsa ham)
      results.push({
        type: 'product',
        product,
        displayName: product.name,
        displayPrice: product.price ?? 0,
        displayStock: mainStock, // Faqat o'z stocki
        displayImage: product.imagePaths?.[0] || product.imageUrl || undefined,
        daromad: totalDaromad
      });
    }

    // 2. Xillarni tekshirish - nom, SKU, kod yoki katalog bo'yicha
    if (product.variantSummaries && product.variantSummaries.length > 0) {
      for (let i = 0; i < product.variantSummaries.length; i++) {
        const variant = product.variantSummaries[i];
        const variantMatches =
          variant.name.toLowerCase().includes(q) ||
          (variant.sku ?? '').toLowerCase().includes(q) ||
          ((variant as any).code ?? '').toLowerCase().includes(q) ||
          ((variant as any).catalogNumber ?? '').toLowerCase().includes(q);

        if (variantMatches) {
          // Xil rasmi yoki mahsulot rasmi
          const variantImage = variant.imagePaths?.[0] || product.imagePaths?.[0] || product.imageUrl || undefined;
          const variantPrice = variant.price ?? product.price ?? 0;
          const variantStock = variant.stock ?? 0; // MUHIM: Faqat xilning o'z stocki

          results.push({
            type: 'variant',
            product,
            variant,
            variantIndex: i,
            displayName: `${variant.name} (${product.name})`,
            displayPrice: variantPrice,
            displayStock: variantStock, // MUHIM: Faqat xilning o'z stocki
            displayImage: variantImage,
            daromad: variantPrice * variantStock
          });
        }
      }
    }
  }

  return results;
};

export default function Products() {
  const { user } = useAuth();
  const { toggleTheme } = useTheme();

  // Xodim mahsulotlarni tahrirlash/o'chirish huquqi
  // Egasi va admin har doim tahrirlashi mumkin
  // Xodim umuman tahrirlashi mumkin emas (switch qanday bo'lsa ham)
  // Xodim faqat o'chirish huquqiga ega bo'lishi mumkin (canEditProducts = true bo'lganda)
  const canEditOrDelete = user?.role === 'egasi' || user?.role === 'admin';
  const canDelete = user?.role === 'egasi' || user?.role === 'admin' || user?.canEditProducts === true;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  // Debug: categories state o'zgarganda log qilish
  useEffect(() => {
    console.log('[Products] categories state changed:', categories.length, categories.map(c => ({ id: c.id, name: c.name })));

    // 🆕 Kategoriyalar yuklanganida markuplarni initialize qilish
    const markups: Record<string, number> = {};
    categories.forEach(cat => {
      markups[cat.id] = (cat as any).markupPercentage ?? 25;
    });
    setCategoryMarkups(markups);
  }, [categories]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [showExportCategoryDialog, setShowExportCategoryDialog] = useState(false);
  const [selectedExportCategory, setSelectedExportCategory] = useState<string>('');
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearMinCode, setClearMinCode] = useState<string>('');
  const [clearMaxCode, setClearMaxCode] = useState<string>('');

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [customId, setCustomId] = useState(''); // ✅ YANGI: Custom ID
  const [price, setPrice] = useState('');
  const [priceCurrency, setPriceCurrency] = useState<Currency>('USD');
  const [basePrice, setBasePrice] = useState('');
  const [priceMultiplier, setPriceMultiplier] = useState('25');
  const [stock, setStock] = useState('1');
  const [isPriceManuallyEdited, setIsPriceManuallyEdited] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedParent, setSelectedParent] = useState<CategoryOption | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productLoadingId, setProductLoadingId] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [oldProductData, setOldProductData] = useState<any | null>(null); // MUHIM: Tahrirlash uchun eski mahsulot ma'lumotlari
  const oldProductDataRef = useRef<any | null>(null); // MUHIM: Ref orqali eski ma'lumotlarni saqlash (asinxron muammo uchun)
  const [imageError, setImageError] = useState<string | null>(null);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [sizesText, setSizesText] = useState('');
  const [productStatus, setProductStatus] = useState<ProductStatus>('available');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [selectedPath, setSelectedPath] = useState<CategoryOption[]>([]);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<{ filename: string; url?: string; size?: number } | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [sizeDraft, setSizeDraft] = useState('');
  const [sizePriceDraft, setSizePriceDraft] = useState('');
  const [isAddingSize, setIsAddingSize] = useState(false);
  const [editingSizeIndex, setEditingSizeIndex] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [todaySalesMap, setTodaySalesMap] = useState<Record<string, number>>({});
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [createCategoryLoading, setCreateCategoryLoading] = useState(false);
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [updatingCategoryMarkupId, setUpdatingCategoryMarkupId] = useState<string | null>(null); // 🆕
  const [categoryMarkups, setCategoryMarkups] = useState<Record<string, number>>({}); // 🆕
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  // Scroll button state
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);

  // Pagination state
  const [displayedCount, setDisplayedCount] = useState(50); // Dastlab 50 ta
  const ITEMS_PER_PAGE = 50;

  // Reset displayed count when search changes
  useEffect(() => {
    setDisplayedCount(50);
  }, [search]);

  // Debounce search - 300ms kutish
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Memoized search results - faqat products yoki debouncedSearch o'zgarganda hisoblash
  const filteredProducts = useMemo(() => {
    return searchProductsAndVariants(products, debouncedSearch);
  }, [products, debouncedSearch]);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [exchangeRates, setExchangeRates] = useState<{ usd: number; rub: number; cny: number } | null>(null);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);

  /* -------------------------------------------------------------------------- */
  /*                             BARCODE SCANNER                                */
  /* -------------------------------------------------------------------------- */

  // Barcode scanner handler
  const handleProductBarcodeScan = useCallback((barcode: string) => {
    // Agar variant modal ochiq bo'lsa, bu yerda ishlamasligi kerak (VariantModal o'zi handle qiladi)
    if (isVariantModalOpen) return;

    // Agar qidiruv inputi fokusda bo'lsa, qidiruvga yozsin (scanner o'zi yozadi)
    if (document.activeElement?.id === 'search-input') return;

    // CustomID ni o'rnatish
    setCustomId(barcode.toUpperCase());

    // CustomID inputiga fokus qilish (vizual effekt uchun)
    // Lekin user typing qilishi shart emas
    toast.success(`ID skanerlandi: ${barcode}`);
  }, [isVariantModalOpen]);

  useBarcodeScanner({
    onScan: handleProductBarcodeScan,
    minLength: 3,
    scanTimeout: 500,
    enabled: true, // Har doim ishlaydi (modal ochiq bo'lmasa)
    preventDefault: true,
  });

  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);
  const [editingVariantInitialData, setEditingVariantInitialData] = useState<any | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [variantSummaries, setVariantSummaries] = useState<any[]>([]);

  // Oxirgi kiritilgan asl narxlar (variant uchun suggestions)
  const [recentBasePrices, setRecentBasePrices] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('recentBasePrices');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Mahsulot qo'shish/tahrirlash tarixi
  const [productHistory, setProductHistory] = useState<ProductHistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTab, setHistoryTab] = useState<'today' | 'past'>('today');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ProductHistoryItem | null>(null);

  // Memoized profit calculation - faqat products yoki exchangeRates o'zgarganda hisoblash
  const { totalProfitUSD, totalDaromadUSD } = useMemo(() => {
    const toUSD = (amount: number, currency?: string): number => {
      if (!amount) return 0;
      const defaultUsdRate = 12500;
      const rates = exchangeRates || { usd: defaultUsdRate, rub: 140, cny: 1750 };

      switch (currency) {
        case 'USD': return amount;
        case 'UZS': return amount / rates.usd;
        case 'RUB': return (amount * rates.rub) / rates.usd;
        case 'CNY': return (amount * rates.cny) / rates.usd;
        default: return amount / rates.usd;
      }
    };

    let totalProfitUSD = 0;
    let totalDaromadUSD = 0;

    // Mahsulotlarning sof foydasini va daromadini hisoblash
    for (const product of products) {
      // Mahsulotning o'z sof foydasini hisoblash
      const basePrice = product.basePrice ? parseFloat(String(product.basePrice)) : 0;
      const sellingPrice = product.price ? parseFloat(String(product.price)) : 0;
      const stock = product.stock || 0;
      const profitPerUnit = sellingPrice - basePrice;
      const productProfit = profitPerUnit * stock;
      const productDaromad = sellingPrice * stock;

      totalProfitUSD += toUSD(productProfit, product.currency);
      totalDaromadUSD += toUSD(productDaromad, product.currency);

      // Xillarning sof foydasini va daromadini hisoblash
      if (product.variantSummaries && product.variantSummaries.length > 0) {
        for (const variant of product.variantSummaries) {
          const variantBasePrice = variant.basePrice ? parseFloat(String(variant.basePrice)) : 0;
          const variantSellingPrice = variant.price ? parseFloat(String(variant.price)) : 0;
          const variantStock = variant.stock || 0;
          const variantProfitPerUnit = variantSellingPrice - variantBasePrice;
          const variantProfit = variantProfitPerUnit * variantStock;
          const variantDaromad = variantSellingPrice * variantStock;

          totalProfitUSD += toUSD(variantProfit, variant.currency);
          totalDaromadUSD += toUSD(variantDaromad, variant.currency);
        }
      }
    }

    return { totalProfitUSD, totalDaromadUSD };
  }, [products, exchangeRates]);

  // Memoized sorted categories - faqat categories o'zgarganda sort qilish
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.level - b.level);
  }, [categories]);

  const [selectedVariantDetail, setSelectedVariantDetail] = useState<{
    name: string;
    sku?: string;
    stock: number;
    price: number;
    currency?: string;
    timestamp?: Date;
  } | null>(null);

  // Senik chop etish state'lari
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [labelDialogProduct, setLabelDialogProduct] = useState<{ name: string; price: number; sku: string; stock: number; productId: string } | null>(null);
  const [labelQuantity, setLabelQuantity] = useState<number | null>(null);
  const [labelSize, setLabelSize] = useState<LabelSize>('large');
  const [customLabelWidth, setCustomLabelWidth] = useState<number>(DEFAULT_LABEL_WIDTH);
  const [customLabelHeight, setCustomLabelHeight] = useState<number>(DEFAULT_LABEL_HEIGHT);
  const [useCustomSize, setUseCustomSize] = useState<boolean>(false);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);

  // Ommaviy senik chiqarish state'lari
  const [bulkLabelDialogOpen, setBulkLabelDialogOpen] = useState(false);
  const [bulkMinSku, setBulkMinSku] = useState<string>('');
  const [bulkMaxSku, setBulkMaxSku] = useState<string>('');
  const [bulkLabelSize, setBulkLabelSize] = useState<LabelSize>('large');
  const [bulkCustomWidth, setBulkCustomWidth] = useState<number>(DEFAULT_LABEL_WIDTH);
  const [bulkCustomHeight, setBulkCustomHeight] = useState<number>(DEFAULT_LABEL_HEIGHT);
  const [bulkUseCustomSize, setBulkUseCustomSize] = useState<boolean>(false);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [bulkQuantity, setBulkQuantity] = useState<number | null>(null); // Har bir mahsulotdan nechta
  const [selectedLabelPrinter, setSelectedLabelPrinter] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // 🆕 Bo'sh kodlar state'lari
  const [emptyCodesDialogOpen, setEmptyCodesDialogOpen] = useState(false);
  const [emptyCodes, setEmptyCodes] = useState<number[]>([]);

  // Confirmation modal states
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => { },
  });

  const navigate = useNavigate();

  // Helper function to show confirmation modal
  const showConfirmModal = useCallback((options: {
    title: string;
    description: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
  }) => {
    setConfirmModal({
      open: true,
      ...options,
    });
  }, []);

  // Helper function to close confirmation modal
  const closeConfirmModal = useCallback(() => {
    setConfirmModal(prev => ({ ...prev, open: false }));
  }, []);

  // Mahsulot o'zgarishlarini kuzatish - eski va yangi qiymatlarni solishtirish
  const trackProductChanges = (oldProduct: any, newProduct: any): Array<{ field: string; oldValue: any; newValue: any }> => {
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

    const fieldsToCheck = ['name', 'sku', 'basePrice', 'price', 'priceMultiplier', 'stock', 'currency'];

    fieldsToCheck.forEach(field => {
      const oldVal = oldProduct?.[field];
      const newVal = newProduct?.[field];

      // Raqamlarni solishtirish uchun normalizatsiya qilish
      let oldNorm = oldVal;
      let newNorm = newVal;

      if (typeof oldVal === 'number' && typeof newVal === 'number') {
        oldNorm = oldVal;
        newNorm = newVal;
      } else if (typeof oldVal === 'string' && typeof newVal === 'string') {
        oldNorm = oldVal.trim();
        newNorm = newVal.trim();
      }

      // Agar qiymatlar boshqacha bo'lsa, o'zgarish qo'shish
      if (oldNorm !== newNorm && (oldNorm !== undefined || newNorm !== undefined)) {
        changes.push({
          field,
          oldValue: oldVal,
          newValue: newVal
        });
      }
    });

    return changes;
  };

  // Tarixga yozish va MongoDB ga saklash
  const addToHistory = useCallback(async (item: Omit<ProductHistoryItem, 'id'>) => {
    const historyItem: ProductHistoryItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Duplikat tekshiruvi - oxirgi 5 daqiqa ichida bir xil productId va type bo'lsa qo'shmaslik
    // LEKIN: 'delete' type uchun duplikat tekshiruvi o'tkazmaslik (har doim saqlash)
    if (item.type !== 'delete') {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const isDuplicate = productHistory.some(h =>
        h.productId === item.productId &&
        h.type === item.type &&
        new Date(h.timestamp).getTime() > fiveMinutesAgo &&
        h.productName === item.productName
      );

      if (isDuplicate) {
        console.log('[Products] Duplicate history item, skipping:', item.productName);
        return;
      }
    }

    console.log('[Products] Adding to history:', item.type, item.productName);

    // Local state ga qo'shish (limitni cheksiz qilish)
    setProductHistory(prev => [historyItem, ...prev]);

    // MongoDB ga saqlash
    if (user?.id) {
      try {
        console.log('[Products] Saving history to MongoDB:', item.type, item.productName);
        console.log('[Products] Changes to save:', item.changes);
        const response = await fetch(`${API_BASE_URL}/api/product-history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            type: item.type,
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            stock: item.stock,
            addedStock: item.addedStock,
            price: item.price,
            currency: item.currency,
            message: item.message,
            variants: item.variants,
            source: item.source || 'manual',
            changes: item.changes,
          }),
        });

        if (response.ok) {
          console.log('[Products] ✅ History saved to MongoDB:', item.type);
        } else {
          console.error('[Products] ❌ Failed to save history:', response.status);
        }
      } catch (err) {
        console.error('[Products] Failed to save history to MongoDB:', err);
      }
    }
  }, [user?.id, productHistory]);

  // Tarixdan o'chirish funksiyasi (faqat ega uchun)
  const deleteHistoryItem = useCallback(async (historyId: string) => {
    const isOwner = user?.role === 'egasi' || user?.role === 'owner' || user?.role === 'admin';
    if (!user?.id || !isOwner) return;

    // Local state dan o'chirish
    setProductHistory(prev => prev.filter(h => h.id !== historyId));

    // MongoDB dan o'chirish
    try {
      await fetch(`${API_BASE_URL}/api/product-history/${historyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch (err) {
      console.error('Failed to delete history from MongoDB:', err);
    }
  }, [user?.id, user?.role]);

  // Oxirgi kiritilgan asl narxni saqlash (variant uchun suggestions)
  const addRecentBasePrice = useCallback((price: string) => {
    if (!price || price.trim() === '') return;
    const priceStr = price.trim();
    setRecentBasePrices(prev => {
      // Agar allaqachon mavjud bo'lsa, boshiga ko'chirish
      const filtered = prev.filter(p => p !== priceStr);
      const updated = [priceStr, ...filtered].slice(0, 20); // Oxirgi 20 ta
      localStorage.setItem('recentBasePrices', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Asl narxni ro'yxatdan o'chirish (variant suggestions uchun)
  const removeRecentBasePrice = useCallback((price: string) => {
    setRecentBasePrices(prev => {
      const updated = prev.filter(p => p !== price);
      localStorage.setItem('recentBasePrices', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleStartEditCategory = (category: CategoryOption) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  };

  const handleSaveCategoryEdit = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) {
      alert('Iltimos, kategoriya nomini kiriting');
      return;
    }

    try {
      setCreateCategoryLoading(true);

      console.log('[handleSaveCategoryEdit] Updating category:', editingCategoryId, 'with name:', editingCategoryName);

      // First, find the category to get its current data
      const categoryToUpdate = categories.find(cat => cat.id === editingCategoryId);
      if (!categoryToUpdate) {
        throw new Error('Kategoriya topilmadi');
      }

      const response = await fetch(`${API_BASE_URL}/api/categories/${editingCategoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingCategoryName,
          parentId: categoryToUpdate.parentId // Keep the original parentId
        }),
      });

      console.log('[handleSaveCategoryEdit] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[handleSaveCategoryEdit] Error response:', errorData);
        // Agar backend xato qaytarsa ham, hech bo'lmaganda lokal ro'yxatda nomni yangilaymiz
        setCategories(prev =>
          prev.map(cat =>
            cat.id === editingCategoryId
              ? { ...cat, name: editingCategoryName }
              : cat
          )
        );

        // Tahrirlash holatini tozalaymiz
        setEditingCategoryId(null);
        setEditingCategoryName('');
        // Foydalanuvchiga alert ko'rsatmaymiz, faqat logda qoladi
        return;
      }

      const data = await response.json();
      console.log('[handleSaveCategoryEdit] Response data:', data);

      // Update the category in local state
      if (data?.success && data.category) {
        setCategories(prev =>
          prev.map(cat =>
            cat.id === editingCategoryId
              ? { ...cat, name: data.category.name }
              : cat
          )
        );
      } else {
        // Fallback to using the input value
        setCategories(prev =>
          prev.map(cat =>
            cat.id === editingCategoryId
              ? { ...cat, name: editingCategoryName }
              : cat
          )
        );
      }

      // Reset editing state
      setEditingCategoryId(null);
      setEditingCategoryName('');

      console.log('[handleSaveCategoryEdit] Category updated successfully');
    } catch (error) {
      console.error('Error updating category:', error);
      if (editingCategoryId && editingCategoryName.trim()) {
        setCategories((prev) =>
          prev.map((cat) =>
            cat.id === editingCategoryId ? { ...cat, name: editingCategoryName } : cat,
          ),
        );
        setEditingCategoryId(null);
        setEditingCategoryName('');
      }
    } finally {
      setCreateCategoryLoading(false);
    }
  };

  // 🆕 Kategoriya foizini yangilash funksiyasi
  const handleUpdateCategoryMarkup = async (categoryId: string, newMarkup: number) => {
    console.log('[handleUpdateCategoryMarkup] Starting update:', { categoryId, newMarkup });

    if (newMarkup < 0) {
      toast.error('Foiz manfiy bo\'lishi mumkin emas');
      return;
    }

    setUpdatingCategoryMarkupId(categoryId);
    try {
      console.log('[handleUpdateCategoryMarkup] Sending request to:', `${API_BASE_URL}/api/categories/${categoryId}/markup`);

      const res = await fetch(`${API_BASE_URL}/api/categories/${categoryId}/markup`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markupPercentage: newMarkup }),
      });

      const data = await res.json();
      console.log('[handleUpdateCategoryMarkup] Response:', data);

      if (!res.ok) {
        toast.error(`Xatolik: ${data?.message || 'Foizni yangilab bo\'lmadi'}`);
        setUpdatingCategoryMarkupId(null);
        return;
      }

      if (data?.success) {
        console.log('[handleUpdateCategoryMarkup] Success! Updated products:', data.updatedProductsCount);

        // Kategoriyani yangilash
        setCategories((prev) =>
          prev.map((c) => (c.id === categoryId ? { ...c, markupPercentage: newMarkup } as any : c))
        );

        // Mahsulotlarni qayta yuklash
        if (user?.id) {
          console.log('[handleUpdateCategoryMarkup] Reloading products...');
          const params = new URLSearchParams({ userId: user.id });
          if (user.phone) {
            params.append('userPhone', user.phone);
          }

          const response = await fetch(`${API_BASE_URL}/api/products?${params.toString()}`);
          console.log('[handleUpdateCategoryMarkup] Products API response status:', response.status);

          if (response.ok) {
            const productsData = await response.json();
            console.log('[handleUpdateCategoryMarkup] Products API response:', productsData);

            // API to'g'ridan-to'g'ri array qaytarishi mumkin yoki { products: [...] } formatida
            const loadedProducts = Array.isArray(productsData)
              ? productsData
              : (Array.isArray(productsData.products) ? productsData.products : []);

            console.log('[handleUpdateCategoryMarkup] Reloaded products:', loadedProducts.length);

            // Debug: Mahsulotlarning categoryId ni tekshirish
            if (loadedProducts.length > 0) {
              console.log('[handleUpdateCategoryMarkup] Sample product:', {
                id: loadedProducts[0].id,
                name: loadedProducts[0].name,
                categoryId: loadedProducts[0].categoryId,
                price: loadedProducts[0].price,
                basePrice: loadedProducts[0].basePrice,
                markupPercentage: loadedProducts[0].markupPercentage,
                priceMultiplier: loadedProducts[0].priceMultiplier
              });

              // Tanlangan kategoriyaga tegishli mahsulotlarni sanash
              const productsInCategory = loadedProducts.filter((p: any) => p.categoryId === categoryId);
              console.log('[handleUpdateCategoryMarkup] Products in selected category:', productsInCategory.length);
            } else {
              console.warn('[handleUpdateCategoryMarkup] No products loaded! API returned empty array');
            }

            const sorted = sortProductsBySku(loadedProducts);
            setProducts(sorted);
          } else {
            console.error('[handleUpdateCategoryMarkup] Products API failed:', response.status, response.statusText);
          }
        }

        toast.success(`✅ ${data.message || 'Kategoriya va mahsulotlar narxi yangilandi'}`);

        // Select ni tozalash
        setTimeout(() => {
          setUpdatingCategoryMarkupId(null);
        }, 500);
      }
    } catch (err) {
      console.error('[handleUpdateCategoryMarkup] Error updating markup:', err);
      toast.error(`Xatolik yuz berdi: ${err instanceof Error ? err.message : 'Noma\'lum xatolik'}`);
      setUpdatingCategoryMarkupId(null);
    }
  };

  // 🆕 Bo'sh kodlarni topish funksiyasi
  const findEmptyCodes = () => {
    console.log('[findEmptyCodes] Boshlandi...');

    // Barcha mavjud SKU larni to'plash (mahsulotlar + xillar)
    const allSkus: number[] = [];

    products.forEach((p) => {
      // Mahsulotning o'z SKU si
      const mainSku = (p.sku ?? '').trim();
      if (/^\d+$/.test(mainSku)) {
        const num = parseInt(mainSku, 10);
        if (Number.isFinite(num)) {
          allSkus.push(num);
        }
      }

      // variantSummaries - xillarning SKU lari
      if (Array.isArray(p.variantSummaries)) {
        p.variantSummaries.forEach((vs) => {
          const variantSku = (vs.sku ?? '').trim();
          if (/^\d+$/.test(variantSku)) {
            const num = parseInt(variantSku, 10);
            if (Number.isFinite(num)) {
              allSkus.push(num);
            }
          }
        });
      }
    });

    if (allSkus.length === 0) {
      toast.info('Hech qanday mahsulot topilmadi');
      return;
    }

    // Eng katta SKU ni topish
    const maxSku = Math.max(...allSkus);
    console.log('[findEmptyCodes] Eng katta SKU:', maxSku);
    console.log('[findEmptyCodes] Mavjud SKU lar:', allSkus.length, 'ta');

    // 1 dan maxSku gacha bo'sh kodlarni topish
    const empty: number[] = [];
    for (let i = 1; i <= maxSku; i++) {
      if (!allSkus.includes(i)) {
        empty.push(i);
      }
    }

    console.log('[findEmptyCodes] Bo\'sh kodlar:', empty.length, 'ta');
    console.log('[findEmptyCodes] Bo\'sh kodlar ro\'yxati:', empty);

    setEmptyCodes(empty);
    setEmptyCodesDialogOpen(true);

    if (empty.length === 0) {
      toast.success('✅ Barcha kodlar band! Bo\'sh kod yo\'q.');
    } else {
      toast.info(`📋 ${empty.length} ta bo'sh kod topildi`);
    }
  };

  // 🆕 Kod bo'yicha tozalash funksiyasi
  const handleClearByCodeRange = async () => {
    const minCode = parseInt(clearMinCode);
    const maxCode = parseInt(clearMaxCode);

    if (isNaN(minCode) || isNaN(maxCode)) {
      toast.error('Iltimos, to\'g\'ri kod kiriting');
      return;
    }

    if (minCode > maxCode) {
      toast.error('Minimum kod maksimumdan katta bo\'lishi mumkin emas');
      return;
    }

    // Kod oralig'idagi mahsulotlarni topish (ota mahsulot va xillar)
    const productsToDelete = products.filter(p => {
      const productCode = parseInt(p.sku);

      // Ota mahsulot kodi oraliqda bo'lsa
      if (!isNaN(productCode) && productCode >= minCode && productCode <= maxCode) {
        return true;
      }

      // Xillarning kodini tekshirish
      if (p.variantSummaries && p.variantSummaries.length > 0) {
        const hasVariantInRange = p.variantSummaries.some(v => {
          if (!v.sku) return false;
          const variantCode = parseInt(v.sku);
          return !isNaN(variantCode) && variantCode >= minCode && variantCode <= maxCode;
        });

        if (hasVariantInRange) {
          return true; // Agar biror xil oraliqda bo'lsa, butun mahsulotni o'chirish
        }
      }

      return false;
    });

    if (productsToDelete.length === 0) {
      toast.error('Bu kod oralig\'ida mahsulotlar topilmadi');
      return;
    }

    showConfirmModal({
      title: "Kod bo'yicha tozalash",
      description: `${minCode} dan ${maxCode} gacha ${productsToDelete.length} ta mahsulot (xillar bilan) o'chiriladi. Davom etasizmi?`,
      confirmText: "O'chirish",
      cancelText: "Bekor qilish",
      variant: 'destructive',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          // Har bir mahsulotni o'chirish
          const deletePromises = productsToDelete.map(p =>
            fetch(`${API_BASE_URL}/api/products/${p.id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userRole: user?.role,
                canEditProducts: user?.canEditProducts
              })
            })
          );

          await Promise.all(deletePromises);

          // State'dan o'chirish
          setProducts(prev => prev.filter(p => {
            const productCode = parseInt(p.sku);

            // Ota mahsulot kodi oraliqda bo'lsa - o'chirish
            if (!isNaN(productCode) && productCode >= minCode && productCode <= maxCode) {
              return false;
            }

            // Xillarning kodini tekshirish
            if (p.variantSummaries && p.variantSummaries.length > 0) {
              const hasVariantInRange = p.variantSummaries.some(v => {
                if (!v.sku) return false;
                const variantCode = parseInt(v.sku);
                return !isNaN(variantCode) && variantCode >= minCode && variantCode <= maxCode;
              });

              if (hasVariantInRange) {
                return false; // O'chirish
              }
            }

            return true; // Qoldirish
          }));

          toast.success(`✅ ${productsToDelete.length} ta mahsulot o'chirildi`);
          setShowClearDialog(false);
          setClearMinCode('');
          setClearMaxCode('');
        } catch (error) {
          console.error('Failed to delete products:', error);
          toast.error('Xatolik yuz berdi');
        }
      }
    });
  };

  // 🆕 To'liq tozalash funksiyasi
  const handleClearAll = async () => {
    showConfirmModal({
      title: "To'liq tozalash",
      description: `Barcha ${products.length} ta mahsulot o'chiriladi. Bu amalni qaytarib bo'lmaydi!`,
      confirmText: "Barchasini o'chirish",
      cancelText: "Bekor qilish",
      variant: 'destructive',
      onConfirm: async () => {
        closeConfirmModal();
        if (user?.id) {
          try {
            const res = await fetch(`${API_BASE_URL}/api/products/clear-all`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id }),
            });
            const data = await res.json();
            if (data.success) {
              setProducts([]);
              toast.success(data.message || "Barcha mahsulotlar o'chirildi");
              setShowClearDialog(false);
            } else {
              toast.error(data.error || "Xatolik yuz berdi");
            }
          } catch (err) {
            console.error('Failed to clear products:', err);
            toast.error("Xatolik yuz berdi");
          }
        }
      }
    });
  };

  // 🆕 Excel export funksiyasi - barcha mahsulotlar va xillarni yuklab olish
  const handleExportToExcel = async (selectedCategoryId?: string) => {
    try {
      // Dinamik import - faqat kerak bo'lganda yuklanadi
      const XLSX = await import('xlsx');

      // Kategoriya bo'yicha filtrlash
      const productsToExport = selectedCategoryId
        ? products.filter(p => p.categoryId === selectedCategoryId)
        : products;

      if (productsToExport.length === 0) {
        toast.error('Bu kategoriyada mahsulotlar yo\'q');
        return;
      }

      const categoryName = selectedCategoryId
        ? categories.find(c => c.id === selectedCategoryId)?.name || 'Noma\'lum'
        : 'Barcha';

      console.log('[handleExportToExcel] ========== EXPORT BOSHLANDI ==========');
      console.log('[handleExportToExcel] Kategoriya:', categoryName);
      console.log('[handleExportToExcel] Total products:', productsToExport.length);

      // Excel uchun ma'lumotlarni tayyorlash
      const excelData: any[] = [];
      let rowNumber = 1;

      // Har bir mahsulotni va uning xillarini qo'shish
      productsToExport.forEach((product) => {
        const price = product.price || 0;
        const stock = product.stock || 0;
        const summa = price * stock;

        // 1. Ota mahsulotni qo'shish
        excelData.push({
          '№': rowNumber++,
          'Код': (product as any).code || '',
          'Наименование': product.name,
          '№ по каталогу': (product as any).catalogNumber || '',
          'Ед': 'шт',
          'Кол-во': stock,
          'Цена': price,
          'Сумма': summa,
          'Вес': '',
          'Итого': ''
        });

        // 2. Xillarni qo'shish
        if (product.variantSummaries && product.variantSummaries.length > 0) {
          product.variantSummaries.forEach((variant) => {
            const variantPrice = variant.price || product.price || 0;
            const variantStock = variant.stock || 0;
            const variantSumma = variantPrice * variantStock;

            excelData.push({
              '№': rowNumber++,
              'Код': (variant as any).code || (product as any).code || '',
              'Наименование': variant.name || product.name,
              '№ по каталогу': (variant as any).catalogNumber || (product as any).catalogNumber || '',
              'Ед': 'шт',
              'Кол-во': variantStock,
              'Цена': variantPrice,
              'Сумма': variantSumma,
              'Вес': '',
              'Итого': ''
            });
          });
        }
      });

      console.log('[handleExportToExcel] Excel qatorlar:', excelData.length);

      // Worksheet yaratish
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Ustun kengliklarini o'rnatish
      worksheet['!cols'] = [
        { wch: 5 },   // №
        { wch: 12 },  // Код
        { wch: 50 },  // Наименование
        { wch: 18 },  // № по каталогу
        { wch: 5 },   // Ед
        { wch: 8 },   // Кол-во
        { wch: 10 },  // Цена
        { wch: 12 },  // Сумма
        { wch: 8 },   // Вес
        { wch: 12 },  // Итого
      ];

      // Range olish
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

      // 🎨 PROFESSIONAL STYLING - Rasmga mos

      // Border style - barcha tomonlarda
      const thinBorder = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      };

      // Header style - yashil fon, oq matn, bold
      const headerStyle = {
        font: {
          bold: true,
          sz: 11,
          color: { rgb: 'FFFFFF' },
          name: 'Arial'
        },
        fill: {
          fgColor: { rgb: '70AD47' }  // Yashil rang
        },
        alignment: {
          horizontal: 'center',
          vertical: 'center',
          wrapText: true
        },
        border: thinBorder
      };

      // Data style - oddiy matn
      const dataStyle = {
        font: {
          sz: 10,
          name: 'Arial'
        },
        alignment: {
          horizontal: 'left',
          vertical: 'center',
          wrapText: false
        },
        border: thinBorder
      };

      // Number style - raqamlar o'ngga
      const numberStyle = {
        font: {
          sz: 10,
          name: 'Arial'
        },
        alignment: {
          horizontal: 'right',
          vertical: 'center'
        },
        border: thinBorder,
        numFmt: '#,##0.00'  // Raqam formati
      };

      // Center style - markazga
      const centerStyle = {
        font: {
          sz: 10,
          name: 'Arial'
        },
        alignment: {
          horizontal: 'center',
          vertical: 'center'
        },
        border: thinBorder
      };

      // Har bir katakchaga style qo'llash
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });

          if (!worksheet[cellAddress]) {
            // Bo'sh katakcha yaratish
            worksheet[cellAddress] = { t: 's', v: '' };
          }

          // Header qatori (0)
          if (R === 0) {
            worksheet[cellAddress].s = headerStyle;
          }
          // Data qatorlari
          else {
            // Ustun bo'yicha style tanlash
            switch (C) {
              case 0: // № - markaz
                worksheet[cellAddress].s = centerStyle;
                break;
              case 1: // Код - markaz
                worksheet[cellAddress].s = centerStyle;
                break;
              case 2: // Наименование - chap
                worksheet[cellAddress].s = dataStyle;
                break;
              case 3: // № по каталогу - markaz
                worksheet[cellAddress].s = centerStyle;
                break;
              case 4: // Ед - markaz
                worksheet[cellAddress].s = centerStyle;
                break;
              case 5: // Кол-во - o'ng
              case 6: // Цена - o'ng
              case 7: // Сумма - o'ng
              case 8: // Вес - o'ng
              case 9: // Итого - o'ng
                worksheet[cellAddress].s = numberStyle;
                break;
              default:
                worksheet[cellAddress].s = dataStyle;
            }
          }
        }
      }

      // Qator balandliklarini o'rnatish
      const rowHeights: any[] = [];
      for (let i = 0; i <= range.e.r; i++) {
        rowHeights.push({
          hpt: i === 0 ? 30 : 20  // Header 30px, data 20px
        });
      }
      worksheet['!rows'] = rowHeights;

      // Workbook yaratish
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Mahsulotlar');

      // Fayl nomini yaratish
      const date = new Date();
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const fileName = selectedCategoryId
        ? `mahsulotlar_${categoryName}_${dateStr}.xlsx`
        : `mahsulotlar_${dateStr}.xlsx`;

      // Faylni yuklab olish
      XLSX.writeFile(workbook, fileName);

      toast.success(`✅ ${excelData.length} ta mahsulot Excel fayliga yuklandi`);
    } catch (error) {
      console.error('[handleExportToExcel] Error:', error);
      toast.error('Excel faylini yaratishda xatolik yuz berdi');
    }
  };

  const confirmDelete = (categoryId: string) => {
    setCategoryToDelete(categoryId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;

    try {
      setCreateCategoryLoading(true);

      console.log('[handleDeleteCategory] Deleting category:', categoryToDelete);

      // First, verify the category exists
      const categoryExists = categories.some(cat => cat.id === categoryToDelete);
      if (!categoryExists) {
        throw new Error('Kategoriya topilmadi');
      }

      const response = await fetch(`${API_BASE_URL}/api/categories/${categoryToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('[handleDeleteCategory] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[handleDeleteCategory] Error response:', errorData);
        throw new Error(errorData.message || 'Kategoriyani o\'chirishda xatolik yuz berdi');
      }

      const data = await response.json();
      console.log('[handleDeleteCategory] Response data:', data);

      // Remove the category from local state
      const updatedCategories = categories.filter(c => c.id !== categoryToDelete);
      setCategories(updatedCategories);

      // Clear category selection if the deleted category was selected
      if (categoryToDelete === categoryId) {
        setCategoryId('');
      }

      // If we're viewing a parent category that was deleted, clear the selection
      if (selectedParent?.id === categoryToDelete) {
        setSelectedParent(null);
      }

      console.log('[handleDeleteCategory] Category deleted successfully');
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Kategoriyani o\'chirishda xatolik yuz berdi: ' + (error instanceof Error ? error.message : 'Noma\'lum xatolik'));
    } finally {
      // Close the modal and reset state
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
      setCreateCategoryLoading(false);
    }
  };

  // Printerlarni yuklash
  useEffect(() => {
    const loadPrinters = async () => {
      try {
        const printerList = await listPrinters();
        setPrinters(printerList);
        const savedLabelPrinter = getDefaultLabelPrinterId();
        if (savedLabelPrinter && printerList.some(p => p.id === savedLabelPrinter)) {
          setSelectedLabelPrinter(savedLabelPrinter);
        } else if (printerList.length > 0) {
          setSelectedLabelPrinter(printerList[0].id);
        }
      } catch (e) {
        console.error("Failed to load printers:", e);
      }
    };
    loadPrinters();
  }, []);

  // Tarix state ni localStorage ga saqlash va yuklash
  useEffect(() => {
    if (!user?.id) return;

    // Tarix state ni localStorage dan yuklash
    const loadHistoryFromStorage = async () => {
      try {
        const storedHistory = localStorage.getItem(`productHistory_${user.id}`);
        if (storedHistory) {
          const parsed = JSON.parse(storedHistory);
          setProductHistory(parsed);
          console.log('[Products] Loaded history from localStorage:', parsed.length);
        }
      } catch (err) {
        console.error('[Products] Failed to load history from localStorage:', err);
      }

      // MongoDB dan tarix yuklash
      try {
        const response = await fetch(`${API_BASE_URL}/api/product-history?userId=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.history)) {
            const historyWithDates = data.history.map((h: any) => ({
              ...h,
              timestamp: new Date(h.timestamp),
            }));
            setProductHistory(historyWithDates);
            // localStorage ga saqlash (quota boshqaruvi bilan)
            try {
              localStorage.setItem(`productHistory_${user.id}`, JSON.stringify(historyWithDates));
              console.log('[Products] Loaded history from MongoDB:', historyWithDates.length);
            } catch (err) {
              // QuotaExceededError bo'lsa, ro'yxatni kichraytirib saqlashga urinish
              try {
                const limited = historyWithDates.slice(-500);
                localStorage.setItem(`productHistory_${user.id}`, JSON.stringify(limited));
                console.warn('[Products] History truncated to 500 items due to storage quota');
              } catch (err2) {
                // Fallback: sessionStorage
                try {
                  sessionStorage.setItem(`productHistory_${user.id}`, JSON.stringify(historyWithDates));
                  console.warn('[Products] Saved history to sessionStorage due to storage quota');
                } catch {
                  // Oxirgi chora: saqlashni o'tkazib yuborish
                  console.error('[Products] Failed to save history (storage quota)');
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('[Products] Failed to load history from MongoDB:', err);
      }
    };

    loadHistoryFromStorage();
  }, [user?.id]);

  // Tarix state o'zgarganda localStorage ga saqlash
  useEffect(() => {
    if (!user?.id || productHistory.length === 0) return;

    try {
      localStorage.setItem(`productHistory_${user.id}`, JSON.stringify(productHistory));
      console.log('[Products] Saved history to localStorage:', productHistory.length);
    } catch (err) {
      // QuotaExceededError bo'lsa, truncation va fallback
      try {
        const limited = productHistory.slice(-500);
        localStorage.setItem(`productHistory_${user.id}`, JSON.stringify(limited));
        console.warn('[Products] History truncated to 500 items due to storage quota');
      } catch (err2) {
        try {
          sessionStorage.setItem(`productHistory_${user.id}`, JSON.stringify(productHistory));
          console.warn('[Products] Saved history to sessionStorage due to storage quota');
        } catch {
          console.error('[Products] Failed to save history (storage quota)');
        }
      }
    }
  }, [productHistory, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    // Mahsulotlarni yuklash funksiyasi
    const loadProducts = () => {
      const params = new URLSearchParams({ userId: user.id });
      if (user.phone) {
        params.append("userPhone", user.phone);
      }
      const url = `${API_BASE_URL}/api/products?${params}`;

      setIsLoadingProducts(true);
      fetch(url)
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          console.log('[Products] Loaded products:', data);
          // Backend returns array directly, not wrapped in {products: [...]}
          let productsArray: any[] = [];
          if (Array.isArray(data)) {
            productsArray = data;
          } else if (Array.isArray(data?.products)) {
            productsArray = data.products;
          }

          // Map _id to id for frontend compatibility
          const mappedProducts = productsArray.map((p: any) => ({
            ...p,
            id: p.id || p._id,
          }));

          setProducts(sortProductsBySku(mappedProducts as Product[]));
        })
        .catch((err) => {
          console.error('Failed to load products from API:', err);
        })
        .finally(() => {
          setIsLoadingProducts(false);
        });
    };

    // Dastlab mahsulotlarni yuklash
    loadProducts();

    const catParams = new URLSearchParams({ userId: user.id });
    if (user.phone) {
      catParams.append("userPhone", user.phone);
    }
    console.log('[Products] Loading categories with params:', {
      userId: user.id,
      userPhone: user.phone,
      url: `${API_BASE_URL}/api/categories?${catParams}`
    });
    fetch(`${API_BASE_URL}/api/categories?${catParams}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.categories)) {
          setCategories(
            (data.categories as any[])
              .map((c) => ({
                id: c.id ?? c._id ?? '',
                name: c.name ?? '',
                level: typeof c.level === 'number' ? c.level : 0,
                parentId: (c.parentId as string | null | undefined) ?? null,
              }))
              .filter((c) => c.id && c.name)
              .sort((a, b) => a.level - b.level)
          );
        }
      })
      .catch((err) => {
        console.error('Failed to load categories from API:', err);
      });

    setTodaySalesMap(getTodaySalesMap());

    // Fetch exchange rates on mount and set interval to refresh every hour
    const fetchExchangeRates = async () => {
      setIsLoadingRate(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/currency/rates`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.rates) {
            setExchangeRates(data.rates);
            console.log('[Products] Exchange rates loaded:', data.rates);
          }
        }
      } catch (error) {
        console.error('[Products] Failed to fetch exchange rates:', error);
      } finally {
        setIsLoadingRate(false);
      }
    };

    fetchExchangeRates();

    // Refresh exchange rates every hour (3600000 ms)
    const rateInterval = setInterval(fetchExchangeRates, 60 * 60 * 1000);

    // Sahifa ko'rinib qolganda mahsulotlarni yangilash (boshqa tabdan qaytganda)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Products] Page became visible, reloading products...');
        loadProducts();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(rateInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, user?.phone]);

  // WebSocket orqali product-updated eventini tinglash
  // Kassa da sotganda stock yangilanadi va bu yerda real-time ko'rinadi
  useEffect(() => {
    if (!user?.id) return;

    const handleProductUpdated = (event: CustomEvent<{ productId: string; productName: string }>) => {
      const { productId, productName } = event.detail;
      console.log('[Products] product-updated event received:', productId, productName);

      // Mahsulotni serverdan qayta yuklash
      const params = new URLSearchParams({ userId: user.id });
      if (user.phone) {
        params.append('userPhone', user.phone);
      }

      fetch(`${API_BASE_URL}/api/products/${productId}?${params}`)
        .then(res => res.json())
        .then(data => {
          if (data?.success && data.product) {
            const updatedProduct = {
              ...data.product,
              id: data.product.id || data.product._id,
            };

            // Products state ni yangilash
            setProducts(prev => prev.map(p =>
              p.id === updatedProduct.id ? updatedProduct : p
            ));

            console.log('[Products] Product updated from event:', updatedProduct.name, 'stock:', updatedProduct.stock);
          }
        })
        .catch(err => {
          console.error('[Products] Failed to reload product after update:', err);
        });
    };

    window.addEventListener('product-updated', handleProductUpdated as EventListener);

    return () => {
      window.removeEventListener('product-updated', handleProductUpdated as EventListener);
    };
  }, [user?.id, user?.phone]);

  const parseNumberInput = (value: string): number | null => {
    if (!value.trim()) return null;
    const normalized = value.replace(/\s/g, '').replace(/,/g, '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  // Foiz o'zgarsa → Sotiladigan narx avtomatik hisoblanadi
  useEffect(() => {
    if (isPriceManuallyEdited) return;

    const base = parseNumberInput(basePrice);
    const percent = parseNumberInput(priceMultiplier);

    if (base == null) {
      setPrice('');
      return;
    }

    const percentValue = percent ?? 0;
    const total = base + base * (percentValue / 100);
    if (!Number.isFinite(total)) {
      setPrice('');
      return;
    }

    const formatted = Number.isInteger(total) ? String(total) : total.toFixed(2);
    setPrice(formatted);
  }, [basePrice, priceMultiplier, isPriceManuallyEdited]);

  // Sotiladigan narx qo'lda o'zgarsa → Foiz avtomatik hisoblanadi
  useEffect(() => {
    if (!isPriceManuallyEdited) return;

    const base = parseNumberInput(basePrice);
    const finalPrice = parseNumberInput(price);

    if (base == null || base === 0 || finalPrice == null) {
      return;
    }

    // Formula: foiz = ((sotiladigan_narx - asl_narx) / asl_narx) × 100
    const calculatedPercent = ((finalPrice - base) / base) * 100;

    if (!Number.isFinite(calculatedPercent)) {
      return;
    }

    const formatted = Number.isInteger(calculatedPercent)
      ? String(calculatedPercent)
      : calculatedPercent.toFixed(2);

    setPriceMultiplier(formatted);
  }, [price, basePrice, isPriceManuallyEdited]);

  useEffect(() => {
    if (!isImageModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsImageModalOpen(false);
        setPreviewImageUrl(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isImageModalOpen]);

  // Lock background scroll when add/edit modals are open
  useEffect(() => {
    const anyModalOpen = Boolean(showAddForm || editingId);
    const htmlEl = document.documentElement as HTMLElement;
    const bodyEl = document.body as HTMLElement;
    const prevHtmlOverflow = htmlEl.style.overflow;
    const prevBodyOverflow = bodyEl.style.overflow;

    if (anyModalOpen) {
      htmlEl.style.overflow = 'hidden';
      bodyEl.style.overflow = 'hidden';
    } else {
      htmlEl.style.overflow = prevHtmlOverflow || '';
      bodyEl.style.overflow = prevBodyOverflow || '';
    }

    return () => {
      htmlEl.style.overflow = '';
      bodyEl.style.overflow = '';
    };
  }, [showAddForm, editingId]);

  // Cleanup video preview URL on unmount
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  // Scroll button logic + Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;

      // Always show button
      setShowScrollButton(true);

      // Check if at top (within 100px from top)
      const isNearTop = scrollTop < 100;

      // Check if at bottom (within 100px from bottom)
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;

      // Show DOWN button if at top, show UP button if at bottom
      if (isNearTop) {
        setIsAtTop(true); // Show DOWN button
      } else if (isNearBottom) {
        setIsAtTop(false); // Show UP button

        // Infinite scroll - load more products
        if (displayedCount < filteredProducts.length) {
          setDisplayedCount(prev => Math.min(prev + ITEMS_PER_PAGE, filteredProducts.length));
        }
      }
      // If in middle, keep current state
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayedCount, products, search, ITEMS_PER_PAGE]);

  // Scroll functions - 50 ta mahsulot sakrab o'tish
  const scrollByProducts = (direction: 'up' | 'down') => {
    // Har bir mahsulot kartochkasining taxminiy balandligi
    // Grid layout: gap + card height ≈ 400px (responsive)
    const isMobile = window.innerWidth < 768;
    const productHeight = isMobile ? 450 : 400; // Mobile da biroz balandroq
    const productsToScroll = 50;
    const scrollAmount = productHeight * productsToScroll;

    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    const targetScroll = direction === 'down'
      ? currentScroll + scrollAmount
      : currentScroll - scrollAmount;

    window.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: 'smooth'
    });
  };

  const scrollToTop = () => scrollByProducts('up');
  const scrollToBottom = () => scrollByProducts('down');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // MUHIM: Xodim tahrirlash uchun ruxsat tekshiruvi (faqat tahrirlash uchun, yangi mahsulot qo'shish uchun emas)
    if (editingId && !canEditOrDelete) {
      alert('Siz mahsulotlarni tahrirlay olmaysiz. Ega sizga ruxsat berishi kerak.');
      return;
    }

    // MUHIM: oldProductDataRef dan eski ma'lumotlarni saqlab qolish (mahsulot saqlashda kerak bo'ladi)
    let oldProductDataForChanges = oldProductDataRef.current;

    // Agar oldProductDataRef null bo'lsa, formadagi qiymatlardan eski ma'lumotlarni yaratish
    if (!oldProductDataForChanges && editingId) {
      oldProductDataForChanges = {
        name,
        sku,
        price: parseNumberInput(price) || 0,
        basePrice: parseNumberInput(basePrice) || 0,
        priceMultiplier: parseNumberInput(priceMultiplier) || 0,
        stock: parseInt(stock) || 0,
        currency: priceCurrency,
        description: '',
      };
    }

    console.log('[Products] handleSubmit - oldProductDataForChanges:', oldProductDataForChanges);

    // Majburiy maydonlar: nom, SKU/kod, asl narx, foiz, ombordagi soni, katta kategoriya
    // Validate required fields
    if (!name.trim()) {
      alert('Mahsulot nomini kiriting');
      return;
    }
    if (!sku.trim()) {
      alert('SKU/Kod ni kiriting');
      return;
    }
    if (!basePrice.trim()) {
      alert('Asl narxini kiriting');
      return;
    }
    if (!priceMultiplier.trim()) {
      alert('Foizini kiriting');
      return;
    }
    if (!stock.trim()) {
      alert('Ombordagi sonini kiriting');
      return;
    }
    if (!categoryId.trim()) {
      alert('Kategoriyani tanlang');
      return;
    }

    // ✨ YANGI: SKU duplikati tekshirish - REAL-TIME DA KO'RSATILADI
    // Tugma bosilganda yana tekshirilmaydi (input joyida allaqachon ko'rsatilgan)

    setIsSaving(true);
    try {
      // Helper to post payload once images are prepared
      const submitPayload = async (imagePaths?: string[], videoBase64?: string) => {
        // Joriy do'konni olish
        const currentStoreId = localStorage.getItem('currentStoreId') || '691aed70dac62e0c47226161';

        console.log('[Products] Submitting product with images:', {
          hasImages: !!(imagePaths && imagePaths.length > 0),
          imageCount: imagePaths?.length || 0,
        });

        // Narxlar tanlangan valyutada saqlanadi (konvertatsiya qilinmaydi)
        // Foydalanuvchi qaysi valyutada kiritsa, shunda saqlanadi
        const finalPrice = Number(price) || 0;
        const finalBasePrice = Number(basePrice) || 0;

        const payload: any = {
          name: name.trim(),
          sku: sku.trim(),
          customId: customId.trim() || undefined, // ✅ YANGI: Custom ID (agar bo'sh bo'lsa undefined)
          price: finalPrice, // Tanlangan valyutada
          basePrice: finalBasePrice, // Tanlangan valyutada
          priceMultiplier: Number(priceMultiplier) || 0,
          stock: Number(stock) || 0,
          categoryId,
          store: currentStoreId,
          status: productStatus,
          currency: priceCurrency, // Qaysi valyutada saqlangani
          userId: user?.id, // Привязка к пользователю
          userRole: user?.role, // Foydalanuvchi roli (xodim uchun initialStock saqlash)
          canEditProducts: user?.canEditProducts, // Xodim tahrirlash huquqi
        };

        console.log('[Products] Payload to send:', {
          price: payload.price,
          basePrice: payload.basePrice,
          priceMultiplier: payload.priceMultiplier,
          currency: payload.currency,
          originalPrice: price,
          customId: payload.customId, // ✅ DEBUG: CustomId ni log qilish
        });

        if (sizesText.trim()) {
          payload.sizes = sizesText.trim();
          const variants = buildVariantsFromSizesText(sizesText);
          if (variants.length) {
            payload.variants = variants;
          }
        } else if (editingId) {
          // Clear sizes on edit when user removed all entries
          (payload as any).sizes = '';
          payload.variants = [];
        }

        // Add variantSummaries to payload
        if (variantSummaries.length > 0) {
          console.log('[Products] Processing variantSummaries:', variantSummaries.length);
          console.log('[Products] variantSummaries state:', variantSummaries.map(v => ({
            name: v.name,
            imagesCount: v.images?.length || 0,
            imagePathsCount: v.imagePaths?.length || 0,
            imagePreviewsCount: v.imagePreviews?.length || 0
          })));

          const variantSummariesPayload: any[] = [];

          for (const v of variantSummaries) {
            // Ensure numeric values are properly converted
            const basePrice = typeof v.basePrice === 'number' ? v.basePrice : parseFloat(v.basePrice) || 0;
            const priceMultiplier = typeof v.priceMultiplier === 'number' ? v.priceMultiplier : parseFloat(v.priceMultiplier) || 0;
            const price = typeof v.price === 'number' ? v.price : parseFloat(v.price) || 0;
            const stock = typeof v.stock === 'number' ? v.stock : parseInt(v.stock) || 0;

            const variantPayload: any = {
              id: v.id || v._id, // ID ni qo'shamiz (serverda tanib olish uchun)
              name: v.name,
              sku: v.sku, // SKU ni ham qo'shamiz
              customId: v.customId, // ✅ YANGI: Custom ID
              basePrice: basePrice,
              priceMultiplier: priceMultiplier,
              price: price,
              currency: v.currency || priceCurrency, // Xilning valyutasi yoki mahsulotning valyutasi
              categoryId: v.categoryId, // Xilning kategoriyasi
              stock: stock,
              status: v.status,
              imagePaths: v.imagePaths || [],
            };

            console.log('[Products] Variant payload created:', {
              name: variantPayload.name,
              sku: variantPayload.sku,
              customId: variantPayload.customId, // ✅ DEBUG
              hasCustomId: !!variantPayload.customId,
              rawCustomId: v.customId, // ✅ DEBUG: Raw value from state
            });

            console.log('[Products] Processing variant:', {
              name: v.name,
              hasImages: Array.isArray(v.images),
              imagesLength: v.images?.length || 0,
              images: v.images
            });

            // Upload variant images via multipart and reuse resulting URLs
            if (Array.isArray(v.images) && v.images.length > 0) {
              console.log('[Products] Uploading variant images via multipart:', v.images.length);
              const uploadedVariantPaths: string[] = [];
              for (const img of v.images) {
                try {
                  const form = new FormData();
                  form.append('image', img);
                  const res = await fetch(`${API_BASE_URL}/api/products/upload-image`, { method: 'POST', body: form });
                  if (!res.ok) {
                    const errText = await res.text().catch(() => '');
                    throw new Error(`Upload failed: ${res.status} ${errText}`);
                  }
                  const data = await res.json();
                  if (data?.success && typeof data.url === 'string') {
                    uploadedVariantPaths.push(data.url);
                    console.log('[Products] ✓ Uploaded variant image:', data.url);
                  } else {
                    throw new Error('Invalid upload response');
                  }
                } catch (err) {
                  console.error('[Products] ✗ Failed to upload variant image:', err);
                  const message =
                    err instanceof Error ? err.message : 'Variant image upload failed';
                  throw new Error(`"${v.name}" rasmini yuklashda xatolik: ${message}`);
                }
              }

              if (uploadedVariantPaths.length > 0) {
                variantPayload.imagePaths = [
                  ...(variantPayload.imagePaths || []),
                  ...uploadedVariantPaths,
                ];
                console.log('[Products] ✓ Added uploaded variant images to payload:', uploadedVariantPaths.length);
              }
            } else {
              console.log('[Products] No new images to upload for this variant');
            }

            variantSummariesPayload.push(variantPayload);
          }

          payload.variantSummaries = variantSummariesPayload;
          console.log('[Products] Total variantSummaries in payload:', variantSummariesPayload.length);
        }

        // If editing and all variants were removed, send empty array to backend to clear
        if (editingId && variantSummaries.length === 0) {
          console.log('[Products] Clearing variantSummaries in edit mode');
          (payload as any).variantSummaries = [];
        }

        // Add images to payload using pre-uploaded URLs
        if (imagePaths && imagePaths.length > 0) {
          payload.imagePaths = imagePaths;
          console.log('[Products] Added imagePaths to payload:', imagePaths.length);
        } else {
          console.log('[Products] No images to add to payload');
        }

        const url = editingId ? `${API_BASE_URL}/api/products/${editingId}` : `${API_BASE_URL}/api/products`;
        const method = editingId ? 'PUT' : 'POST';

        console.log('[Products] Submitting to server:', {
          url,
          method,
          editingId,
          payloadKeys: Object.keys(payload),
          variantSummariesCount: payload.variantSummaries?.length || 0,
          imagesCount: (payload.imagePaths?.length || 0)
        });

        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        console.log('[Products] Server response status:', res.status);

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error('[Products] Failed to save product:', res.status, errorData);

          // SKU duplicate xatolik uchun maxsus xabar
          if (errorData.error && errorData.error.includes('allaqachon ishlatilgan')) {
            alert(`SKU Xatolik: ${errorData.error}\n\nTavsiya etilgan SKU: ${errorData.suggestedSku || 'Avtomatik beriladi'}`);
          } else {
            alert(`Xatolik: ${errorData.error || errorData.message || 'Ma\'lumotlarni saqlashda xatolik yuz berdi'}`);
          }
          return;
        }

        const data = await res.json();

        // Server response formatini tekshirish
        // Yangi format: { success: true, product: {...} }
        // Eski format: { _id: ..., name: ..., ... } (to'g'ridan-to'g'ri product)
        const savedProduct = data?.product || (data?._id ? data : null);
        const isSuccess = data?.success !== false && savedProduct;

        if (!isSuccess) {
          console.error('[Products] Invalid server response:', data);
          alert('Mahsulot saqlanmadi. Qaytadan urinib ko\'ring.');
          return;
        }

        // Agar stock yangilangan bo'lsa (bir xil SKU li mahsulot mavjud edi)
        if (data?.stockUpdated) {
          toast.success(data.message || `Mahsulot mavjud edi. Ombordagi soni oshirildi.`);
          // Mahsulotlar ro'yxatini yangilash
          const updatedProduct = {
            ...savedProduct,
            id: savedProduct.id || savedProduct._id,
          };
          setProducts((prev) =>
            sortProductsBySku(prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))),
          );

          // Tarixga yozish - mahsulot yoki xil yangilandi
          // Xil yangilanganda - formadagi name (foydalanuvchi kiritgan nom) ishlatiladi
          // Mahsulot yangilanganda - mahsulot nomi ishlatiladi
          const displayName = data?.variantUpdated
            ? (name || sku) // Xil uchun: formadagi nom yoki SKU
            : (updatedProduct.name || savedProduct.name); // Mahsulot uchun

          const updateVariants = (updatedProduct.variantSummaries || []).map((v: any) => ({
            name: v.name,
            sku: v.sku,
            stock: v.stock ?? 0,
            price: v.price ?? 0,
            currency: v.currency || priceCurrency,
          }));

          console.log('[Products] Update history with variants:', {
            updatedProductVariants: updatedProduct.variantSummaries?.length || 0,
            updateVariants: updateVariants.length,
            updateVariantsData: updateVariants
          });

          // MUHIM: O'zgarishlarni kuzatish
          const newProductData = {
            name,
            sku,
            price: updatedProduct.price || 0,
            basePrice: parseNumberInput(basePrice) || 0,
            priceMultiplier: parseNumberInput(priceMultiplier) || 0,
            stock: updatedProduct.stock || 0,
            currency: updatedProduct.currency || priceCurrency,
            description: updatedProduct.description || '',
          };

          console.log('[Products] newProductData:', newProductData);

          // MUHIM: Eski ma'lumotlarni olish
          let changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
          if (oldProductDataForChanges) {
            const normalizedOldData = {
              ...oldProductDataForChanges,
              price: typeof oldProductDataForChanges.price === 'string' ? parseNumberInput(oldProductDataForChanges.price) || 0 : oldProductDataForChanges.price,
              basePrice: typeof oldProductDataForChanges.basePrice === 'string' ? parseNumberInput(oldProductDataForChanges.basePrice) || 0 : oldProductDataForChanges.basePrice,
              priceMultiplier: typeof oldProductDataForChanges.priceMultiplier === 'string' ? parseNumberInput(oldProductDataForChanges.priceMultiplier) || 0 : oldProductDataForChanges.priceMultiplier,
              stock: typeof oldProductDataForChanges.stock === 'string' ? parseInt(oldProductDataForChanges.stock) || 0 : oldProductDataForChanges.stock,
            };

            console.log('[Products] normalizedOldData:', normalizedOldData);
            console.log('[Products] newProductData:', newProductData);
            changes = trackProductChanges(normalizedOldData, newProductData);
            console.log('[Products] Changes tracked:', { changes, changesLength: changes.length });
          } else {
            console.log('[Products] oldProductDataForChanges is null/undefined');
          }

          addToHistory({
            type: data?.variantUpdated ? 'variant_update' : 'update',
            productId: updatedProduct.id,
            productName: displayName,
            sku: savedProduct.sku || sku,
            stock: updatedProduct.stock || 0,
            addedStock: data?.addedStock || Number(stock) || 0,
            price: updatedProduct.price || 0,
            currency: updatedProduct.currency || priceCurrency,
            changes: changes && changes.length > 0 ? changes : [],
            timestamp: new Date(),
            message: data?.variantUpdated
              ? `Xil yangilandi: ${displayName}`
              : `Mahsulot yangilandi: +${data?.addedStock || stock} ta qo'shildi`,
            variants: updateVariants.length > 0 ? updateVariants : undefined,
            source: 'manual', // Qo'lda tahrirlangan
          });
          // Formani tozalash
          setName('');
          setSku('');
          setCustomId(''); // ✅ YANGI: Custom ID ni tozalash
          setPrice('');
          setPriceCurrency('USD');
          setBasePrice('');
          setPriceMultiplier('25');
          setStock('1');
          setCategoryId('');
          setSelectedParent(null);
          setEditingId(null);
          setOldProductData(null); // MUHIM: Eski ma'lumotlarni tozalash
          oldProductDataRef.current = null; // MUHIM: Ref ni ham tozalash
          setShowAddForm(false);
          setImageFiles([]);
          setImagePreviews([]);
          setImageError(null);
          setSizesText('');
          setSizeDraft('');
          setSizePriceDraft('');
          setIsAddingSize(false);
          setEditingSizeIndex(null);
          setProductStatus('available');
          setIsPriceManuallyEdited(false);
          setVariantSummaries([]);
          return;
        }

        if (editingId) {
          const updated = savedProduct as Product;
          console.log('[Products] Updated product:', updated);
          console.log('[Products] Server returned variantSummaries:', (updated as any).variantSummaries);

          // Serverdan kelgan variantSummaries ni olish
          const serverVariants = Array.isArray((updated as any).variantSummaries)
            ? (updated as any).variantSummaries
            : [];

          // Map _id to id for frontend compatibility
          // MUHIM: variantSummaries ni serverdan kelgan ma'lumotlar bilan yangilash
          const mappedUpdated = {
            ...updated,
            id: updated.id || (updated as any)._id,
            variantSummaries: serverVariants,
          };

          console.log('[Products] Mapped updated product with variants:', mappedUpdated.id, serverVariants.length);

          // Mahsulotlar ro'yxatini yangilash
          setProducts((prev) =>
            sortProductsBySku(prev.map((p) => (p.id === mappedUpdated.id ? mappedUpdated : p))),
          );

          // Local variantSummaries state ni ham yangilash (forma uchun)
          if (serverVariants.length > 0) {
            setVariantSummaries(serverVariants.map((serverV: any) => {
              const imagePaths = Array.isArray(serverV.imagePaths) ? serverV.imagePaths : [];
              const imagePreviews = imagePaths.map((p: string) => resolveMediaUrl(p));

              return {
                ...serverV,
                images: [],
                imagePaths: imagePaths,
                imagePreviews: imagePreviews
              };
            }));

            console.log('[Products] Updated variantSummaries from server response');
          }

          // Tarixga yozish - mahsulot tahrirlandi
          if (data.historyItems && Array.isArray(data.historyItems)) {
            // ✨ YANGI: Serverdan kelgan tayyor tarix itemlarini ishlatish
            // Server endi xil va mahsulot o'zgarishlarini alohida qaytaradi
            console.log('[Products] Using history items from server response:', data.historyItems.length);
            setProductHistory(prev => [...data.historyItems, ...prev]);
          } else if (data.historyItem) {
            // ✨ YANGI: Serverdan kelgan tayyor tarix itemini ishlatish
            // Bu serverda aniqlangan o'zgarishlar va variantlarni o'z ichiga oladi
            // Va server allaqachon DB ga saqlagan, shuning uchun qayta saqlash shart emas
            console.log('[Products] Using history item from server response:', data.historyItem);
            setProductHistory(prev => [data.historyItem, ...prev]);
          } else {
            // Fallback (agar server eski bo'lsa) - eski logika
            // ✨ YANGI: Faqat tahrirlangan xillarni saqlash (barcha xillarni emas)
            // MUHIM: Tahrirlashdan oldingi xillarni olish
            const originalVariants = oldProductDataRef.current?.variantSummaries || [];

            const editedVariants = (mappedUpdated.variantSummaries || [])
              .filter((v: any) => {
                // Eski variantSummaries da bu xil bor edi va o'zgartirildi
                const oldVariant = originalVariants.find((ov: any) => ov.sku === v.sku || ov.name === v.name);
                if (!oldVariant) return true; // Yangi xil - saqlash

                // Xil o'zgartirildi - saqlash
                return oldVariant.price !== v.price ||
                  oldVariant.stock !== v.stock ||
                  oldVariant.name !== v.name;
              })
              .map((v: any) => ({
                name: v.name,
                sku: v.sku,
                stock: v.stock ?? 0,
                price: v.price ?? 0,
                currency: v.currency || priceCurrency,
              }));

            // MUHIM: O'zgarishlarni kuzatish (tahrirlash uchun)
            let updateChanges: Array<{ field: string; oldValue: any; newValue: any }> = [];
            if (oldProductDataRef.current) {
              const normalizedOldData = {
                ...oldProductDataRef.current,
                price: typeof oldProductDataRef.current.price === 'string' ? parseNumberInput(oldProductDataRef.current.price) || 0 : oldProductDataRef.current.price,
                basePrice: typeof oldProductDataRef.current.basePrice === 'string' ? parseNumberInput(oldProductDataRef.current.basePrice) || 0 : oldProductDataRef.current.basePrice,
                priceMultiplier: typeof oldProductDataRef.current.priceMultiplier === 'string' ? parseNumberInput(oldProductDataRef.current.priceMultiplier) || 0 : oldProductDataRef.current.priceMultiplier,
                stock: typeof oldProductDataRef.current.stock === 'string' ? parseInt(oldProductDataRef.current.stock) || 0 : oldProductDataRef.current.stock,
              };

              const newProductData = {
                name: mappedUpdated.name,
                sku: mappedUpdated.sku,
                price: mappedUpdated.price || 0,
                basePrice: mappedUpdated.basePrice || 0,
                priceMultiplier: mappedUpdated.priceMultiplier || 0,
                stock: mappedUpdated.stock || 0,
                currency: mappedUpdated.currency || priceCurrency,
              };

              updateChanges = trackProductChanges(normalizedOldData, newProductData);
            }

            // MUHIM: Faqat o'zgarish bo'lsa tarixga qo'shish
            const hasChanges = (updateChanges && updateChanges.length > 0) || (editedVariants.length > 0);
            if (hasChanges) {
              addToHistory({
                type: 'update',
                productId: mappedUpdated.id,
                productName: mappedUpdated.name,
                sku: mappedUpdated.sku || sku,
                stock: mappedUpdated.stock || 0,
                price: mappedUpdated.price || 0,
                currency: mappedUpdated.currency || priceCurrency,
                timestamp: new Date(),
                message: `Mahsulot tahrirlandi: ${mappedUpdated.name}`,
                variants: editedVariants.length > 0 ? editedVariants : undefined, // Faqat tahrirlangan xillar
                changes: updateChanges && updateChanges.length > 0 ? updateChanges : [], // O'zgarishlar
                source: 'manual', // Qo'lda tahrirlangan
              });
            }
          }
        } else {
          const created = savedProduct as Product;
          console.log('[Products] Created product:', created);
          console.log('[Products] Created product imagePaths:', created.imagePaths);
          console.log('[Products] Server returned variantSummaries:', (created as any).variantSummaries);

          // For new products, use server response to get the saved imagePaths
          if (Array.isArray((created as any).variantSummaries)) {
            setVariantSummaries((created as any).variantSummaries.map((v: any) => ({
              ...v,
              images: [], // Clear File objects after upload
              imagePreviews: Array.isArray(v.imagePaths) ? v.imagePaths.map((p: string) => resolveMediaUrl(p)) : []
            })));
            console.log('[Products] Updated variantSummaries from server response');
          }

          // Images are already uploaded prior to submit via multipart
          // No need to upload again inside this request

          // Map _id to id for frontend compatibility
          const mappedProduct = {
            ...created,
            id: created.id || (created as any)._id,
          };

          setProducts((prev) => sortProductsBySku([...prev, mappedProduct]));

          // Tarixga yozish - yangi mahsulot yaratildi (xillar bilan birga)
          const historyVariants = (mappedProduct.variantSummaries || variantSummaries || []).map((v: any) => ({
            name: v.name,
            sku: v.sku,
            stock: v.stock ?? 0,
            price: v.price ?? 0,
            currency: v.currency || priceCurrency,
          }));

          console.log('[Products] Creating history with variants:', {
            mappedProductVariants: mappedProduct.variantSummaries?.length || 0,
            localVariantSummaries: variantSummaries?.length || 0,
            historyVariants: historyVariants.length,
            historyVariantsData: historyVariants
          });

          addToHistory({
            type: 'create',
            productId: mappedProduct.id,
            productName: mappedProduct.name,
            sku: mappedProduct.sku || sku,
            stock: mappedProduct.stock || Number(stock) || 0,
            price: mappedProduct.price || 0,
            currency: mappedProduct.currency || priceCurrency,
            timestamp: new Date(),
            message: `Yangi mahsulot qo'shildi: ${mappedProduct.name} (${mappedProduct.stock || stock} ta)`,
            variants: historyVariants.length > 0 ? historyVariants : undefined,
            source: 'manual', // Qo'lda qo'shilgan
          });
        }

        // Har ikki holatda ham formani tozalaymiz va modalni yopamiz
        setName('');
        setSku('');
        setCustomId(''); // ✅ YANGI: Custom ID ni tozalash
        setPrice('');
        setPriceCurrency('USD');
        setBasePrice('');
        setPriceMultiplier('25');
        setStock('1');
        setCategoryId('');
        setSelectedParent(null);
        setEditingId(null);
        setShowAddForm(false);
        setImageFiles([]);
        setImagePreviews([]);
        setImageError(null);
        setSizesText('');
        setSizeDraft('');
        setSizePriceDraft('');
        setIsAddingSize(false);
        setEditingSizeIndex(null);
        setProductStatus('available');
        setIsPriceManuallyEdited(false);
        setVariantSummaries([]);
      };

      // Helper function to convert file to base64
      const toBase64 = (file: File) =>
        new Promise<string>((resolve, reject) => {
          console.log('[toBase64] Converting file:', {
            name: file.name,
            size: file.size,
            type: file.type
          });

          const reader = new FileReader();

          reader.onload = () => {
            const result = reader.result as string;
            console.log('[toBase64] Conversion successful, size:', result.length);
            resolve(result);
          };

          reader.onerror = (error) => {
            console.error('[toBase64] Conversion failed:', error);
            reject(error);
          };

          try {
            reader.readAsDataURL(file);
          } catch (error) {
            console.error('[toBase64] readAsDataURL failed:', error);
            reject(error);
          }
        });

      // Upload images via multipart to avoid huge JSON bodies
      const uploadedImagePaths: string[] = [];
      if (imageFiles.length > 0) {
        console.log('[Products] Uploading images via multipart:', imageFiles.length);
        for (const file of imageFiles) {
          try {
            const form = new FormData();
            form.append('image', file);
            const res = await fetch(`${API_BASE_URL}/api/products/upload-image`, { method: 'POST', body: form });
            if (!res.ok) {
              const errText = await res.text().catch(() => '');
              throw new Error(`Upload failed: ${res.status} ${errText}`);
            }
            const data = await res.json();
            if (data?.success && typeof data.url === 'string') {
              uploadedImagePaths.push(data.url);
              console.log('[Products] ✓ Uploaded image:', data.url);
            } else {
              throw new Error('Invalid upload response');
            }
          } catch (err) {
            console.error('Failed to upload image:', err);
            setImageError('Rasmlarni yuklashda xatolik yuz berdi');
          }
        }
        console.log('[Products] Uploaded images:', uploadedImagePaths.length);
      }

      // Convert video to base64
      let videoBase64: string | undefined;

      // Process video (only if it's a new upload with actual file data)
      if (videoFile && videoFile.size > 0 && videoPreviewUrl && !videoPreviewUrl.startsWith('http')) {
        setVideoError(null);
        try {
          videoBase64 = await toBase64(videoFile);
        } catch (err) {
          console.error('Failed to convert video to base64', err);
          setVideoError('Video yuklashda xatolik yuz berdi');
        }
      }

      // Submit with images and video
      await submitPayload(uploadedImagePaths.length > 0 ? uploadedImagePaths : undefined, videoBase64);
    } catch (err) {
      console.error('Error creating product:', err);
      const message = err instanceof Error ? err.message : 'Mahsulotni saqlashda xatolik yuz berdi';
      alert(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImagePreview = (url?: string | null, allImages?: string[]) => {
    if (!url) return;
    const images = allImages && allImages.length > 0 ? allImages : [url];
    const index = images.indexOf(url);
    setPreviewImages(images);
    setPreviewImageIndex(index >= 0 ? index : 0);
    setPreviewImageUrl(url);
    setIsImageModalOpen(true);
  };

  const handleCloseImageModal = () => {
    setIsImageModalOpen(false);
    setPreviewImageUrl(null);
    setPreviewImages([]);
    setPreviewImageIndex(0);
  };

  const handleVideoPreview = (video?: { filename: string; url?: string; size?: number } | null) => {
    if (!video) return;
    setPreviewVideo(video);
    setIsVideoModalOpen(true);
  };

  const handleCloseVideoModal = () => {
    setIsVideoModalOpen(false);
    setPreviewVideo(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      console.log('[Products] Deleting product:', deleteTarget.id, deleteTarget.name);

      const res = await fetch(`${API_BASE_URL}/api/products/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userRole: user?.role,
          canEditProducts: user?.canEditProducts
        })
      });

      console.log('[Products] Delete response status:', res.status);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('[Products] Delete error:', res.status, errorData);
        toast.error(`O'chirishda xatolik: ${errorData.error || res.statusText}`);
        return;
      }

      const data = await res.json();
      console.log('[Products] Delete response:', data);

      if (data?.success) {
        setProducts((prev) => sortProductsBySku(prev.filter((x) => x.id !== deleteTarget.id)));

        // Tarixga yozish - mahsulot o'chirildi
        addToHistory({
          type: 'delete', // O'chirildi - delete type
          productId: deleteTarget.id,
          productName: deleteTarget.name,
          sku: deleteTarget.sku || '',
          stock: deleteTarget.stock || 0,
          price: deleteTarget.price || 0,
          currency: deleteTarget.currency || 'UZS',
          timestamp: new Date(),
          message: `Mahsulot o'chirildi: ${deleteTarget.name}`,
          source: 'manual', // Qo'lda o'chirilgan
        });

        toast.success(`"${deleteTarget.name}" o'chirildi`);
        setDeleteTarget(null);
      } else {
        toast.error(data?.error || 'O\'chirishda xatolik');
      }
    } catch (err) {
      console.error('[Products] Failed to delete product', err);
      toast.error('O\'chirishda xatolik yuz berdi');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setCreateCategoryError('Kategoriya nomi kiritilishi shart');
      return;
    }

    setCreateCategoryLoading(true);
    setCreateCategoryError(null);

    try {
      const payload: any = {
        name,
        userId: user?.id, // Привязка к пользователю
      };

      // Agar selectedParent bo'lsa, ichki kategoriya yaratamiz
      if (selectedParent) {
        payload.parentId = selectedParent.id;
        payload.level = (selectedParent.level ?? 0) + 1;
      } else {
        payload.parentId = null;
        payload.level = 0;
      }

      const res = await fetch(`${API_BASE_URL}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Kategoriya yaratishda xatolik');
      }

      const data = await res.json();
      if (!data?.success || !data.category) {
        throw new Error('Kategoriya yaratilmadi');
      }

      // Yangi kategoriyani ro'yxatga qo'shamiz
      const newCategory: CategoryOption = {
        id: data.category.id,
        name: data.category.name,
        level: typeof data.category.level === 'number' ? data.category.level : 0,
        parentId: data.category.parentId ?? null,
      };

      setCategories((prev) => [...prev, newCategory].sort((a, b) => a.level - b.level));

      // Yangi kategoriyani darhol tanlaymiz
      setCategoryId(newCategory.id);

      // Formani tozalaymiz
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setCreateCategoryError(null);
    } catch (err) {
      console.error('Error creating category:', err);
      setCreateCategoryError(err instanceof Error ? err.message : 'Kategoriya yaratishda xatolik');
    } finally {
      setCreateCategoryLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />
      <Navbar
        onMenuClick={() => setSidebarOpen((prev) => !prev)}
        sidebarCollapsed={sidebarCollapsed}
        rightSlot={
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop da ko'rinadigan qismlar */}
            <div className="hidden md:flex items-center gap-2 sm:gap-3">
              {/* Sof Foyda - ko'k rangda */}
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-700/20 border border-cyan-500/30">
                <span className="text-cyan-400 font-bold text-base">💰</span>
                <span className="text-sm sm:text-base font-bold text-cyan-300">
                  ${totalProfitUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>

              {/* Jami Daromad - yashil rangda */}
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-green-600/20 to-green-700/20 border border-green-500/30">
                <span className="text-green-400 font-bold text-base">$</span>
                <span className="text-sm sm:text-base font-bold text-green-300">
                  {totalDaromadUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Desktop Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Qidirish..."
              className="hidden md:block w-24 sm:w-40 md:w-48 px-3 py-2 rounded-xl bg-card border border-primary/30 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />

            {/* Desktop Buttons */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() =>
                  setShowAddForm((prev) => {
                    const next = !prev;
                    if (next) {
                      setEditingId(null);
                      setName('');
                      setCustomId(''); // ✅ YANGI: Custom ID ni tozalash
                      setPrice('');
                      setPriceCurrency('USD');
                      setBasePrice('');
                      setPriceMultiplier('25');
                      setStock('1');
                      setCategoryId('');
                      setSelectedParent(null);
                      setImageFiles([]);
                      setImagePreviews([]);
                      setImageError(null);
                      setVideoFile(null);
                      setVideoError(null);
                      setRemoveExistingImage(false);
                      setSizesText('');
                      setSku(getNextAutoSku(products));
                      setIsCreatingCategory(false);
                      setNewCategoryName('');
                      setCreateCategoryError(null);
                      setProductStatus('available');
                      setIsPriceManuallyEdited(false);
                      setVariantSummaries([]);
                    }
                    return next;
                  })
                }
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-w-[44px] rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm sm:text-base font-semibold transition-colors shadow-lg"
              >
                <span>Qo'shish</span>
              </button>
              <button
                onClick={() => setShowHistoryModal(true)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-w-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base font-semibold transition-colors shadow-lg"
                title="Mahsulot tarixini ko'rish"
              >
                <span>Tarix</span>
              </button>
            </div>
          </div>
        }
      />

      {/* Scrollable content area */}
      <div
        className={`flex-1 ${showAddForm ? 'overflow-hidden' : 'overflow-y-auto'} pt-12 sm:pt-14 lg:pt-16 pb-20 md:pb-4 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

          {/* Mobile Search Input */}
          <div className="md:hidden mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mahsulot nomi yoki SKU kiriting..."
              className="w-full px-4 py-3 rounded-xl bg-card border border-primary/30 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Jami ombordagi mahsulotlar soni va xillar soni */}
          <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>
              Jami omborda: <span className="font-bold text-blue-400">
                {(() => {
                  let totalStock = 0;
                  for (const product of products) {
                    totalStock += product.stock || 0;
                    if (product.variantSummaries) {
                      for (const variant of product.variantSummaries) {
                        totalStock += variant.stock || 0;
                      }
                    }
                  }
                  return totalStock.toLocaleString();
                })()}
              </span> dona
            </span>
            <span className="text-gray-600">|</span>
            <span>
              Xillar soni: <span className="font-bold text-green-400">
                {(() => {
                  let totalTypes = 0;
                  for (const product of products) {
                    // Har bir mahsulotdan 1 ta
                    totalTypes += 1;
                    // Har bir xildan ham 1 ta
                    if (product.variantSummaries && product.variantSummaries.length > 0) {
                      totalTypes += product.variantSummaries.length;
                    }
                  }
                  return totalTypes;
                })()}
              </span> xil
            </span>
            <span className="text-gray-600">|</span>
            <button
              type="button"
              onClick={() => setShowExcelImport(true)}
              className="flex items-center gap-1.5 text-green-400 hover:text-green-300 transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="font-medium">Excel import</span>
            </button>
            <span className="text-gray-600">|</span>
            <button
              type="button"
              onClick={() => setShowExportCategoryDialog(true)}
              className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition"
            >
              <Download className="w-4 h-4" />
              <span className="font-medium">Excel export</span>
            </button>
            <span className="text-gray-600">|</span>
            <button
              type="button"
              onClick={() => setBulkLabelDialogOpen(true)}
              className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition"
            >
              <Tag className="w-4 h-4" />
              <span className="font-medium">Ommaviy senik</span>
            </button>
            <span className="text-gray-600">|</span>
            {/* 🆕 Bo'sh kodlar tugmasi */}
            <button
              type="button"
              onClick={findEmptyCodes}
              className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition"
            >
              <Search className="w-4 h-4" />
              <span className="font-medium">Bo'sh kodlar</span>
            </button>
            {/* Hammasini o'chirish - faqat ega uchun */}
            {(user?.role === 'egasi' || user?.role === 'owner' || user?.role === 'admin') && products.length > 0 && (
              <>
                <span className="text-gray-600">|</span>
                <button
                  type="button"
                  onClick={() => setShowClearDialog(true)}
                  className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="font-medium">Tozalash</span>
                </button>
              </>
            )}
          </div>

          {/* 🆕 Kategoriyalar bo'limi - Foizni sozlash */}
          {categories.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 mb-6 p-5 rounded-2xl bg-gradient-to-br from-card/80 via-card/60 to-card/40 border border-border/50 backdrop-blur-sm shadow-lg"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Kategoriya ustama foizini sozlash
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Kategoriya bo'yicha barcha mahsulotlar narxini boshqaring
                    </p>
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                  <span className="text-xs font-semibold text-primary">
                    {categories.filter(c => !c.parentId).length} ta kategoriya
                  </span>
                </div>
              </div>

              {/* Select va foiz sozlash */}
              <div className="flex flex-col lg:flex-row items-start lg:items-end gap-4">
                {/* Kategoriya tanlash */}
                <div className="flex-1 w-full">
                  <label className="block text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Kategoriyani tanlang
                  </label>
                  <Select
                    value={updatingCategoryMarkupId || ''}
                    onValueChange={(value) => {
                      setUpdatingCategoryMarkupId(value);
                      // MUHIM: Kategoriya tanlanganda inputni bo'sh qoldirish
                      setCategoryMarkups(prev => ({
                        ...prev,
                        [value]: '' as any
                      }));
                    }}
                  >
                    <SelectTrigger className="w-full h-11 bg-background/80 border-input hover:border-primary/50 transition-colors">
                      <SelectValue placeholder="Kategoriyani tanlang..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => !c.parentId).map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex items-center gap-2.5 py-0.5">
                            <div className="w-2 h-2 rounded-full bg-gradient-to-br from-primary to-primary/60"></div>
                            <span className="font-medium">{category.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Foiz input va tugma */}
                {updatingCategoryMarkupId && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 w-full lg:w-auto"
                  >
                    {/* Foiz input */}
                    <div className="w-full sm:w-auto">
                      <label className="block text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Yangi foiz
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={categoryMarkups[updatingCategoryMarkupId] ?? ''}
                          onChange={(e) => setCategoryMarkups(prev => ({
                            ...prev,
                            [updatingCategoryMarkupId]: e.target.value ? Number(e.target.value) : '' as any
                          }))}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="25"
                          className="w-28 h-11 bg-background/80 border border-input rounded-lg px-4 text-sm font-semibold text-center focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-muted-foreground/50"
                        />
                        <span className="text-sm font-medium text-muted-foreground">%</span>
                      </div>
                    </div>

                    {/* Yangilash tugmasi */}
                    <button
                      type="button"
                      onClick={async () => {
                        const newMarkup = categoryMarkups[updatingCategoryMarkupId] || 20;
                        await handleUpdateCategoryMarkup(updatingCategoryMarkupId, newMarkup);
                      }}
                      disabled={!updatingCategoryMarkupId}
                      className="h-11 px-6 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Narxlarni yangilash
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Tanlangan kategoriya haqida ma'lumot */}
              {updatingCategoryMarkupId && (() => {
                const selectedCategory = categories.find(c => c.id === updatingCategoryMarkupId);
                const currentMarkup = (selectedCategory as any)?.markupPercentage ?? 25;
                const newMarkup = categoryMarkups[updatingCategoryMarkupId] || 25;

                // MUHIM: Ota mahsulotlar + xillar sonini hisoblash
                const productsInCategoryData = products.filter(p => p.categoryId === updatingCategoryMarkupId);
                const productsCount = productsInCategoryData.length; // Ota mahsulotlar
                let variantsCount = 0; // Xillar

                // Har bir mahsulotning xillarini sanash
                productsInCategoryData.forEach(p => {
                  if (p.variantSummaries && Array.isArray(p.variantSummaries)) {
                    variantsCount += p.variantSummaries.length;
                  }
                });

                const totalCount = productsCount + variantsCount; // Jami

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 backdrop-blur-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground mb-2">
                          "{selectedCategory?.name}" kategoriyasi
                        </p>
                        <div className="space-y-1.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <span>
                              <span className="font-semibold text-blue-400">{totalCount}</span> ta mahsulot
                              {variantsCount > 0 && (
                                <span className="text-muted-foreground ml-1">
                                  ({productsCount} ota + {variantsCount} xil)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                        {newMarkup !== currentMarkup && (
                          <div className="mt-3 pt-3 border-t border-blue-500/20">
                            <p className="text-xs text-blue-400 font-medium flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Barcha mahsulotlar narxi avtomatik yangilanadi
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
            </motion.div>
          )}

          <AnimatePresence>
            {showAddForm && (
              <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm px-2 sm:px-4">
                <ErrorBoundary
                  fallback={
                    <div className="w-full max-w-md mx-4 p-6 rounded-2xl bg-card border border-border text-center">
                      <p className="text-red-400 font-medium mb-3">Forma yuklanmadi</p>
                      <button
                        onClick={() => setShowAddForm(false)}
                        className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm"
                      >
                        Yopish
                      </button>
                    </div>
                  }
                >
                  <motion.div
                    key="product-modal"
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 40, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="w-full max-w-full sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-2 sm:mx-4 mb-2 sm:mb-0 rounded-2xl border border-border bg-card text-card-foreground shadow-2xl shadow-black/70 flex flex-col max-h-[90vh]"
                  >
                    <div className="flex items-center justify-between px-4 sm:px-5 pt-3 pb-2 border-b border-border bg-muted rounded-t-2xl">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <h2 className="text-base sm:text-lg font-semibold truncate text-foreground">
                            {editingId ? 'Mahsulotni tahrirlash' : 'Mahsulot qo\'shish'}
                          </h2>

                          {/* Exchange Rate Display in Modal Header - Dynamic based on selected currency */}
                          {exchangeRates && (
                            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border backdrop-blur-sm ${priceCurrency === 'USD'
                              ? 'bg-gradient-to-r from-green-600/25 via-green-700/25 to-green-600/25 border-green-600/40'
                              : priceCurrency === 'RUB'
                                ? 'bg-gradient-to-r from-purple-600/25 via-purple-700/25 to-purple-600/25 border-purple-600/40'
                                : priceCurrency === 'CNY'
                                  ? 'bg-gradient-to-r from-red-600/25 via-red-700/25 to-red-600/25 border-red-600/40'
                                  : 'bg-gradient-to-r from-blue-600/25 via-blue-700/25 to-blue-600/25 border-blue-600/40'
                              }`}>
                              <svg className={`w-3.5 h-3.5 flex-shrink-0 ${priceCurrency === 'USD' ? 'text-green-400'
                                : priceCurrency === 'RUB' ? 'text-purple-400'
                                  : priceCurrency === 'CNY' ? 'text-red-400'
                                    : 'text-blue-400'
                                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className={`text-[10px] font-bold whitespace-nowrap ${priceCurrency === 'USD' ? 'text-green-300'
                                : priceCurrency === 'RUB' ? 'text-purple-300'
                                  : priceCurrency === 'CNY' ? 'text-red-300'
                                    : 'text-blue-300'
                                }`}>
                                1 {priceCurrency === 'USD' ? 'USD' : priceCurrency === 'RUB' ? 'RUB' : priceCurrency === 'CNY' ? 'CNY' : 'USD'}
                              </span>
                              <span className={`text-[10px] font-semibold ${priceCurrency === 'USD' ? 'text-green-400'
                                : priceCurrency === 'RUB' ? 'text-purple-400'
                                  : priceCurrency === 'CNY' ? 'text-red-400'
                                    : 'text-blue-400'
                                }`}>=</span>
                              <span className={`text-[10px] font-extrabold whitespace-nowrap ${priceCurrency === 'USD' ? 'text-green-200'
                                : priceCurrency === 'RUB' ? 'text-purple-200'
                                  : priceCurrency === 'CNY' ? 'text-red-200'
                                    : 'text-blue-200'
                                }`}>
                                {(priceCurrency === 'USD' ? exchangeRates.usd : priceCurrency === 'RUB' ? exchangeRates.rub : priceCurrency === 'CNY' ? exchangeRates.cny : exchangeRates.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className={`text-[10px] font-bold whitespace-nowrap ${priceCurrency === 'USD' ? 'text-green-300'
                                : priceCurrency === 'RUB' ? 'text-purple-300'
                                  : priceCurrency === 'CNY' ? 'text-red-300'
                                    : 'text-blue-300'
                                }`}>UZS</span>
                            </div>
                          )}

                          {isLoadingRate && !exchangeRates && (
                            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border">
                              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-[10px] text-muted-foreground">Kurs...</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Mahsulot ma`lumotlarini kiriting yoki tahrirlang
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddForm(false);
                          setEditingId(null);
                          setName('');
                          setSku('');
                          setCustomId(''); // ✅ YANGI: Custom ID ni tozalash
                          setPrice('');
                          setPriceCurrency('USD');
                          setBasePrice('');
                          setPriceMultiplier('25');
                          setStock('1');
                          setCategoryId('');
                          setSelectedParent(null);
                          setImageFiles([]);
                          setImagePreviews([]);
                          setImageError(null);
                          setVideoFile(null);
                          setVideoError(null);
                          setRemoveExistingImage(false);
                          setSizesText('');
                          setSizeDraft('');
                          setSizePriceDraft('');
                          setIsAddingSize(false);
                          setEditingSizeIndex(null);
                          setIsCreatingCategory(false);
                          setNewCategoryName('');
                          setCreateCategoryError(null);
                          setProductStatus('available');
                          setIsPriceManuallyEdited(false);
                          setVariantSummaries([]); // MUHIM: Forma yopilganda xillarni tozalash
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition flex-shrink-0 ml-2"
                        disabled={isSaving}
                      >
                        ×
                      </button>
                    </div>

                    <div className="px-4 sm:px-5 pt-4 pb-4 overflow-y-auto flex-1">
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-4 pb-1">
                          {/* Nom + SKU - Responsive grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-foreground mb-1.5">Mahsulot nomi</label>
                              <input
                                id="product-name-input"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    document.getElementById('product-baseprice-input')?.focus();
                                  }
                                }}
                                className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                                placeholder="Masalan: Bolt 15mm"
                                disabled={isSaving}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-foreground mb-1.5">SKU / Kod</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={sku}
                                  onChange={(e) => {
                                    const newSku = e.target.value;
                                    setSku(newSku);

                                    // ✨ YANGI: Real-time SKU duplikati tekshirish
                                    if (newSku.trim() && !editingId) {
                                      const skuLower = newSku.trim().toLowerCase();
                                      let existingProduct: Product | null = null;

                                      for (const product of products) {
                                        // Mahsulotning o'z SKU si
                                        if (product.sku?.trim().toLowerCase() === skuLower) {
                                          existingProduct = product;
                                          break;
                                        }

                                        // Xillarning SKU lari
                                        if (product.variantSummaries) {
                                          for (const variant of product.variantSummaries) {
                                            if (variant.sku?.trim().toLowerCase() === skuLower) {
                                              existingProduct = product;
                                              break;
                                            }
                                          }
                                          if (existingProduct) break;
                                        }
                                      }

                                      if (existingProduct) {
                                        // Ogohlantirish ko'rsatish
                                        toast.warning(
                                          `⚠️ "${newSku}" kodli mahsulot allaqachon mavjud: "${existingProduct.name}"`,
                                          {
                                            duration: 3000,
                                            position: 'top-right',
                                            style: {
                                              backgroundColor: '#f59e0b',
                                              color: 'white',
                                              fontSize: '13px',
                                              fontWeight: 'bold'
                                            }
                                          }
                                        );
                                      }
                                    }
                                  }}
                                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                                  placeholder="Masalan: CC-001"
                                  disabled={isSaving}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-foreground mb-1.5">
                                Custom ID (ixtiyoriy)
                                <span className="text-muted-foreground ml-1 text-[10px]">- Barcode scanner bilan skanerlang</span>
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={customId}
                                  onChange={(e) => {
                                    const newCustomId = e.target.value.toUpperCase();
                                    setCustomId(newCustomId);

                                    // ✨ YANGI: Real-time CustomId duplikati tekshirish
                                    if (newCustomId.trim() && !editingId) {
                                      const customIdUpper = newCustomId.trim();
                                      const existingProduct = products.find(p => p.customId?.toUpperCase() === customIdUpper);

                                      if (existingProduct) {
                                        // Ogohlantirish ko'rsatish
                                        toast.warning(
                                          `⚠️ "${newCustomId}" ID allaqachon mavjud: "${existingProduct.name}"`,
                                          {
                                            duration: 3000,
                                            position: 'top-right',
                                            style: {
                                              backgroundColor: '#f59e0b',
                                              color: 'white',
                                              fontSize: '13px',
                                              fontWeight: 'bold'
                                            }
                                          }
                                        );
                                      }
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    // ✅ YANGI: Enter tugmasini bloklash (scanner uchun)
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      // Focus ni keyingi input ga o'tkazish (ixtiyoriy)
                                      const form = e.currentTarget.form;
                                      if (form) {
                                        const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
                                        const currentIndex = inputs.indexOf(e.currentTarget);
                                        const nextInput = inputs[currentIndex + 1] as HTMLElement;
                                        if (nextInput) {
                                          nextInput.focus();
                                        }
                                      }
                                    }
                                  }}
                                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                                  placeholder="Masalan: 98F3C471 (agar kiritmasangiz, avtomatik beriladi)"
                                  disabled={isSaving}
                                />
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  💡 Eski stikerdan barcode ni skanerlang yoki qo'lda kiriting
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Narx hisob-kitobi - Responsive grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-foreground mb-1.5">Asl narxi</label>
                              <input
                                id="product-baseprice-input"
                                type="text"
                                inputMode="decimal"
                                value={basePrice}
                                onChange={(e) => {
                                  // Faqat raqamlar, nuqta va vergulni qabul qilish
                                  const value = e.target.value.replace(/[^\d.,]/g, '');
                                  setBasePrice(value);
                                  // Asl narx o'zgarsa, agar narx qo'lda o'zgartirilgan bo'lsa foiz qayta hisoblanadi
                                  // Aks holda narx qayta hisoblanadi (useEffect orqali)
                                }}
                                onBlur={(e) => {
                                  // Fokusdan chiqqanda formatlash
                                  if (basePrice) {
                                    const cleanValue = basePrice.replace(/\s/g, '').replace(',', '.');
                                    const num = parseFloat(cleanValue);
                                    if (!isNaN(num)) {
                                      // Formatlangan qiymatni ko'rsatish
                                      setBasePrice(num.toLocaleString('uz-UZ'));
                                    }
                                  }
                                }}
                                onFocus={(e) => {
                                  // Fokusga kelganda formatni olib tashlash
                                  if (basePrice) {
                                    const cleanValue = basePrice.replace(/\s/g, '').replace(',', '.');
                                    setBasePrice(cleanValue);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    document.getElementById('product-stock-input')?.focus();
                                  }
                                }}
                                className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                                placeholder="Masalan: 10000 yoki 1,5"
                                disabled={isSaving}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-foreground mb-1.5">
                                Foizi (%)
                                {!isPriceManuallyEdited && (
                                  <span className="ml-2 text-[10px] text-green-500">(avtomatik)</span>
                                )}
                              </label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={priceMultiplier}
                                onChange={(e) => {
                                  // Vergul va nuqtani qabul qilish - faqat raqamlar, nuqta va vergul
                                  const value = e.target.value.replace(/[^\d.,]/g, '');
                                  setPriceMultiplier(value);
                                  setIsPriceManuallyEdited(false); // Foiz o'zgarsa, narx avtomatik hisoblanadi
                                }}
                                className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                                placeholder="Masalan: 10 yoki 1,5"
                                disabled={isSaving}
                              />
                            </div>
                            <div className="md:col-span-2 lg:col-span-1">
                              <CurrencyPriceInput
                                value={price}
                                onChange={(newPrice, currency) => {
                                  setPrice(newPrice);
                                  setPriceCurrency(currency);
                                  setIsPriceManuallyEdited(true);
                                }}
                                initialCurrency={priceCurrency}
                                label="Sotiladigan narxi"
                                disabled={isSaving}
                                className="w-full"
                              />
                            </div>
                          </div>

                          {/* Status - Yuqoriga ko'tarildi */}
                          <div>
                            <ProductStatusSelector
                              value={productStatus}
                              onChange={setProductStatus}
                              disabled={isSaving}
                            />
                          </div>

                          {/* Ombordagi soni - Full width */}
                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">Ombordagi soni</label>
                            <input
                              id="product-stock-input"
                              type="number"
                              value={stock}
                              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                              onChange={(e) => setStock(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  // Enter bosilganda hech narsa qilmasin (formani yubormasin)
                                }
                              }}
                              className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                              placeholder="Masalan: 10"
                              disabled={isSaving}
                            />
                          </div>

                          {/* Kategoriya */}
                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1">Kategoriya</label>
                            <div className="rounded-2xl border border-border bg-muted p-3 flex flex-col gap-3 shadow-sm">
                              <div className="flex items-center justify-between mb-1">
                                <div className="text-xs text-muted-foreground">
                                  <span>Kategoriyalar</span>
                                  {selectedParent && (
                                    <>
                                      <span className="text-primary mx-1">/</span>
                                      <span className="text-primary font-medium">{selectedParent.name}</span>
                                    </>
                                  )}

                                  {/* Video tanlangan bo'lsa, uning nomini ko'rsatamiz */}
                                  {videoFile && !videoError && (
                                    <div className="mt-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-foreground flex items-center justify-between">
                                      <div>
                                        <span className="font-semibold">Video:</span>{' '}
                                        <span className="text-muted-foreground">{videoFile.name}</span>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground">(faqat nom saqlanadi, alohida upload kerak bo'lishi mumkin)</span>
                                    </div>
                                  )}
                                </div>
                                {selectedParent && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedPath((prev) => {
                                        const next = prev.slice(0, -1);
                                        setSelectedParent(next.length ? next[next.length - 1] : null);
                                        return next;
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-[11px] text-foreground hover:bg-muted transition"
                                    disabled={isSaving}
                                  >
                                    <span>Ortga</span>
                                  </button>
                                )}
                              </div>

                              <div className="text-xs text-muted-foreground">
                                Tanlangan kategoriya:
                                <span className="ml-1 font-semibold text-foreground">
                                  {categoryId
                                    ? categories.find((c) => c.id === categoryId)?.name ?? 'Tanlanmagan'
                                    : 'Tanlanmagan'}
                                </span>
                                {categoryId && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCategoryId('');
                                      setSelectedParent(null);
                                      setSelectedPath([]);
                                    }}
                                    className="ml-2 text-[11px] text-red-400 hover:text-red-300 underline"
                                    disabled={isSaving}
                                  >
                                    Tozalash
                                  </button>
                                )}
                              </div>

                              <div className="mt-2 flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                                {(selectedParent
                                  ? categories.filter((c) => c.parentId === selectedParent.id)
                                  : categories.filter((c) => !c.parentId)
                                ).map((c) => {
                                  const isSelected = categoryId === c.id;
                                  const isEditing = editingCategoryId === c.id;

                                  return (
                                    <div
                                      key={c.id}
                                      className={`w-full flex flex-col gap-2 rounded-xl border text-xs transition-all px-3 py-2 ${isSelected
                                        ? 'border-primary bg-primary/20 text-primary-foreground'
                                        : 'border-border bg-background text-foreground hover:bg-muted'
                                        }`}
                                    >
                                      {/* Kategoriya nomi va tugmalar */}
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            // Agar aynan shu kategoriya hozir tahrirlash rejimida bo'lsa, ichiga kirmaymiz
                                            if (isEditing) return;

                                            // Tanlangan kategoriyani belgilaymiz
                                            setCategoryId(c.id);
                                            // Sidebardagi kabi: har doim shu kategoriyani joriy parent sifatida ochamiz,
                                            // ichida hozircha child bo'lmasa ham keyinchalik ichki kategoriya qo'shish mumkin bo'ladi
                                            setSelectedParent(c);
                                            setSelectedPath((prev) => [...prev, c]);
                                          }}
                                          className="flex-1 text-left truncate"
                                          disabled={isSaving}
                                        >
                                          {isEditing ? (
                                            <input
                                              type="text"
                                              value={editingCategoryName}
                                              onChange={(e) => setEditingCategoryName(e.target.value)}
                                              className="w-full bg-background border border-input rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                              autoFocus
                                            />
                                          ) : (
                                            <span>{c.name}</span>
                                          )}
                                        </button>

                                        {isEditing ? (
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={handleSaveCategoryEdit}
                                              className="px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90"
                                              disabled={createCategoryLoading}
                                            >
                                              Saqlash
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingCategoryId(null);
                                                setEditingCategoryName('');
                                              }}
                                              className="px-2 py-0.5 rounded-md border border-border text-[10px] hover:bg-muted"
                                              disabled={createCategoryLoading}
                                            >
                                              Bekor
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => handleStartEditCategory(c)}
                                              className="px-2 py-0.5 rounded-md border border-border text-[10px] hover:bg-muted"
                                              disabled={createCategoryLoading}
                                            >
                                              Tahrir
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => confirmDelete(c.id)}
                                              className="px-2 py-0.5 rounded-md border border-destructive text-destructive text-[10px] hover:bg-destructive/10"
                                              disabled={createCategoryLoading}
                                            >
                                              O'chirish
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}

                                {(!selectedParent && categories.filter((c) => !c.parentId).length === 0) ||
                                  (selectedParent && categories.filter((c) => c.parentId === selectedParent.id).length === 0) ? (
                                  <p className="text-[11px] text-gray-500 py-2">
                                    Bu bo'limda hozircha kategoriya yo'q.
                                  </p>
                                ) : null}
                              </div>

                              {/* Yangi kategoriya yaratish inline form */}
                              {!isCreatingCategory ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCreatingCategory(true);
                                    setNewCategoryName('');
                                    setCreateCategoryError(null);
                                  }}
                                  className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-primary/60 bg-primary/5 text-primary text-[11px] font-semibold hover:bg-primary/10 transition-all disabled:opacity-60"
                                  disabled={isSaving}
                                >
                                  <span className="text-sm">+</span>
                                  <span>Kategoriya yaratish</span>
                                </button>
                              ) : (
                                <div className="rounded-xl border border-primary/40 bg-card/60 p-3 space-y-2">
                                  <div className="text-[11px] text-muted-foreground mb-1">
                                    {selectedParent ? `"${selectedParent.name}" ichida yangi kategoriya` : 'Yangi kategoriya'}
                                  </div>
                                  <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={(e) => {
                                      setNewCategoryName(e.target.value);
                                      setCreateCategoryError(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCreateCategory();
                                      }
                                    }}
                                    placeholder="Kategoriya nomi"
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-input text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    disabled={createCategoryLoading}
                                    autoFocus
                                  />
                                  {createCategoryError && (
                                    <p className="text-[10px] text-destructive">{createCategoryError}</p>
                                  )}
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsCreatingCategory(false);
                                        setNewCategoryName('');
                                        setCreateCategoryError(null);
                                      }}
                                      className="px-3 py-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground text-[11px] hover:bg-muted transition-all"
                                      disabled={createCategoryLoading}
                                    >
                                      Bekor qilish
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCreateCategory}
                                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-all disabled:opacity-60"
                                      disabled={createCategoryLoading || !newCategoryName.trim()}
                                    >
                                      {createCategoryLoading ? 'Saqlanmoqda...' : 'Saqlash'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1">Xillar / o'lchamlar</label>
                            <div className="rounded-2xl border border-input bg-background/60 p-3 flex flex-col gap-2">
                              {/* Saqlangan xillar card ko'rinishida - variantSummaries dan ko'rsatish */}
                              {variantSummaries.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {variantSummaries.map((v, idx) => {
                                    const label = v.name || '';
                                    const price = v.basePrice || v.price || '';
                                    return (
                                      <div
                                        key={`variant-${idx}-${v.sku || v.name}`}
                                        className="inline-flex items-center gap-1 rounded-xl bg-muted px-2.5 py-1 border border-border text-[11px] text-foreground shadow-sm"
                                      >
                                        {/* SKU ko'rsatish */}
                                        {v.sku && (
                                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                            #{v.sku}
                                          </span>
                                        )}
                                        <span>{label}</span>
                                        {price && (
                                          <span className="text-[10px] text-muted-foreground ml-1 flex items-center gap-0.5">
                                            {(v.currency || priceCurrency) === 'USD' && <span className="text-green-500">$</span>}
                                            {(v.currency || priceCurrency) === 'RUB' && <span className="text-purple-500">₽</span>}
                                            {(v.currency || priceCurrency) === 'CNY' && <span className="text-yellow-500">¥</span>}
                                            {price}
                                            {(!(v.currency || priceCurrency) || (v.currency || priceCurrency) === 'UZS') && <span className="text-blue-500">so'm</span>}
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            // Har doim modal orqali tahrirlash
                                            const variant = variantSummaries[idx];

                                            const baseFromVariant = variant?.basePrice != null ? Number(variant.basePrice) : undefined;
                                            const priceFromVariant = variant?.price != null ? Number(variant.price) : undefined;

                                            setEditingVariantIndex(idx);

                                            // MUHIM: Variant tahrirlash vaqtida oldProductDataRef ni o'rnatish
                                            // Bu eski xil ma'lumotlarini saqlash uchun kerak (changes tracking uchun)
                                            if (!oldProductDataRef.current) {
                                              oldProductDataRef.current = {
                                                name: name,
                                                sku: sku,
                                                price: variant?.price || 0,
                                                basePrice: variant?.basePrice || 0,
                                                priceMultiplier: variant?.priceMultiplier || 0,
                                                stock: variant?.stock || 0,
                                                currency: priceCurrency || 'USD',
                                                description: '',
                                              };
                                              console.log('[Products] Variant edit - oldProductDataRef set:', oldProductDataRef.current);
                                            }

                                            console.log('[Products] Variant edit opened, oldProductDataRef:', oldProductDataRef.current);

                                            // Get existing images from imagePaths (server URLs)
                                            const existingImagePaths = Array.isArray(variant?.imagePaths) ? variant.imagePaths : [];
                                            const resolvedImagePreviews = existingImagePaths.map((img: string) => resolveMediaUrl(img));

                                            console.log('[Products] Opening variant for edit:', {
                                              name: variant?.name,
                                              sku: variant?.sku,
                                              imagePaths: existingImagePaths,
                                              resolvedPreviews: resolvedImagePreviews
                                            });

                                            setEditingVariantInitialData({
                                              name: variant?.name ?? '',
                                              sku: variant?.sku ?? '',
                                              customId: variant?.customId ?? '', // ✅ CustomId ni yuklash
                                              basePrice: baseFromVariant != null && Number.isFinite(baseFromVariant)
                                                ? String(baseFromVariant)
                                                : '',
                                              priceMultiplier: variant?.priceMultiplier != null ? String(variant.priceMultiplier) : '25',
                                              price: priceFromVariant != null && Number.isFinite(priceFromVariant)
                                                ? String(priceFromVariant)
                                                : '',
                                              priceCurrency: variant?.currency ?? variant?.priceCurrency ?? 'UZS',
                                              categoryId: variant?.categoryId ?? '', // Xilning kategoriyasi
                                              stock: variant?.stock != null ? String(variant.stock) : (stock || ''),
                                              status: variant?.status ?? 'available',
                                              images: [], // No File objects for existing images
                                              imagePreviews: resolvedImagePreviews, // Server URLs
                                            });

                                            // Inline input rejimini o'chirib qo'yamiz
                                            setIsAddingSize(false);
                                            setEditingSizeIndex(null);

                                            setIsVariantModalOpen(true);
                                          }}
                                          className="ml-1 px-2 py-1 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white text-[11px] sm:text-[10px] shadow-md active:scale-[0.98]"
                                          disabled={isSaving}
                                        >
                                          Tahrirlash
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            console.log('[Products] Deleting variant at index:', idx, 'editingId:', editingId);

                                            // Yangi variantSummaries yaratish (avval o'chirish)
                                            const newVariants = variantSummaries.filter((_, i) => i !== idx);
                                            console.log('[Products] New variants after delete:', newVariants.length, newVariants);

                                            // sizesText ni yangilash
                                            const newSizesText = newVariants
                                              .map((vr) => `${vr.name || ''}|${vr.basePrice || vr.price || ''}`)
                                              .join(', ');
                                            setSizesText(newSizesText);
                                            setVariantSummaries(newVariants);

                                            if (editingSizeIndex === idx) {
                                              setEditingSizeIndex(null);
                                              setSizeDraft('');
                                              setSizePriceDraft('');
                                              setIsAddingSize(false);
                                            }

                                            // Agar tahrirlash rejimida bo'lsa, serverga saqlash
                                            if (editingId) {
                                              console.log('[Products] Saving variant deletion to server, editingId:', editingId);
                                              try {
                                                const response = await fetch(`${API_BASE_URL}/api/products/${editingId}`, {
                                                  method: 'PUT',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({
                                                    variantSummaries: newVariants,
                                                    userId: user?.id,
                                                  }),
                                                });
                                                console.log('[Products] Server response status:', response.status);
                                                if (response.ok) {
                                                  toast.success('Xil o\'chirildi');
                                                  // Mahsulotlar ro'yxatini yangilash
                                                  const data = await response.json();
                                                  console.log('[Products] Server response data:', data);
                                                  const updatedProduct = data.product || data;
                                                  if (updatedProduct) {
                                                    setProducts((prev) =>
                                                      prev.map((p) => (p.id === editingId ? { ...p, ...updatedProduct, id: editingId } : p))
                                                    );
                                                  }
                                                } else {
                                                  const errorData = await response.text();
                                                  console.error('[Products] Server error:', errorData);
                                                  toast.error('Xilni o\'chirishda xatolik');
                                                }
                                              } catch (err) {
                                                console.error('[Products] Failed to delete variant:', err);
                                                toast.error('Xilni o\'chirishda xatolik');
                                              }
                                            } else {
                                              console.log('[Products] No editingId, variant deleted locally only');
                                            }
                                          }}
                                          className="ml-1 w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 flex items-center justify-center transition-all"
                                          disabled={isSaving}
                                          title="O'chirish"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-[11px] text-muted-foreground">
                                  Hozircha xil qo'shilmagan. "Xil qo'shish" tugmasini bosing.
                                </p>
                              )}

                              {/* Xil qo'shish tugmasi */}
                              {!isAddingSize && (
                                <button
                                  type="button"
                                  onClick={() => setIsVariantModalOpen(true)}
                                  className="self-start mt-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-[11px] text-foreground hover:bg-muted transition disabled:opacity-60"
                                  disabled={isSaving}
                                >
                                  Xil qo'shish
                                </button>
                              )}

                              {/* Xil kiritish input + saqlash tugmasi */}
                              {isAddingSize && (
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex flex-1 gap-2">
                                    <input
                                      type="text"
                                      value={sizeDraft}
                                      onChange={(e) => setSizeDraft(e.target.value)}
                                      className="w-1/2 px-3 py-2 rounded-xl bg-background border border-input text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                      placeholder="Xil: 15mm yoki S"
                                      disabled={isSaving}
                                    />
                                    <input
                                      type="number"
                                      min={0}
                                      value={sizePriceDraft}
                                      onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                                      onChange={(e) => setSizePriceDraft(e.target.value)}
                                      className="w-1/2 px-3 py-2 rounded-xl bg-background border border-input text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                      placeholder="Narx (ixtiyoriy)"
                                      disabled={isSaving}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const label = sizeDraft.trim();
                                      if (!label) return;

                                      const existing = sizesText
                                        .split(',')
                                        .map((s) => s.trim())
                                        .filter(Boolean);

                                      const entry = sizePriceDraft.trim()
                                        ? `${label}|${sizePriceDraft.trim()}`
                                        : label;

                                      if (editingSizeIndex != null) {
                                        // tahrirlash rejimi
                                        const copy = [...existing];
                                        copy[editingSizeIndex] = entry;
                                        setSizesText(copy.join(', '));
                                      } else {
                                        // yangi xil qo'shish
                                        if (existing.includes(entry)) {
                                          setSizeDraft('');
                                          setSizePriceDraft('');
                                          return;
                                        }
                                        const next = existing.length ? `${existing.join(', ')}, ${entry}` : entry;
                                        setSizesText(next);
                                      }

                                      setSizeDraft('');
                                      setSizePriceDraft('');
                                      setEditingSizeIndex(null);
                                      // yana keyingi xil kiritish uchun input ochiq qoladi
                                    }}
                                    className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 disabled:opacity-60"
                                    disabled={isSaving}
                                  >
                                    Saqlash
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Mahsulot rasmlari / videolari - DISABLED */}
                          <div className="hidden">
                            <label className="block text-xs font-semibold text-foreground mb-2">Mahsulot media (rasm / video)</label>

                            {/* Rasmlar preview - yuqorida ko'rsatish */}
                            {imagePreviews.length > 0 && (
                              <div className="mb-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-semibold text-foreground">
                                    Tanlangan rasmlar ({imagePreviews.length})
                                  </p>
                                </div>
                                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                                  {imagePreviews.map((preview, index) => (
                                    <div
                                      key={`${preview}-${index}`}
                                      className="relative aspect-square rounded-lg overflow-hidden border-2 border-border bg-background shadow-sm group hover:border-primary transition-all"
                                      draggable
                                      onDragStart={(e) => {
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData('text/plain', index.toString());
                                      }}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                                        const toIndex = index;

                                        if (fromIndex === toIndex) return;

                                        // Reorder images
                                        setImagePreviews(prev => {
                                          const newPreviews = [...prev];
                                          const [movedItem] = newPreviews.splice(fromIndex, 1);
                                          newPreviews.splice(toIndex, 0, movedItem);
                                          return newPreviews;
                                        });

                                        // Reorder files
                                        setImageFiles(prev => {
                                          const newFiles = [...prev];
                                          const [movedFile] = newFiles.splice(fromIndex, 1);
                                          newFiles.splice(toIndex, 0, movedFile);
                                          return newFiles;
                                        });
                                      }}
                                    >
                                      <img
                                        src={preview}
                                        alt={`Rasm ${index + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                      {/* Delete button */}
                                      <button
                                        type="button"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          console.log('[Products] Deleting image at index:', index);
                                          console.log('[Products] Preview URL:', preview);
                                          console.log('[Products] Editing ID:', editingId);

                                          // If editing existing product and this is a server image (not blob)
                                          if (editingId && !preview.startsWith('blob:')) {
                                            try {
                                              console.log('[Products] Deleting image from server...');
                                              const response = await fetch(`${API_BASE_URL}/api/products/${editingId}/images/${index}`, {
                                                method: 'DELETE',
                                              });

                                              if (!response.ok) {
                                                throw new Error('Failed to delete image from server');
                                              }

                                              const data = await response.json();
                                              console.log('[Products] Server response:', data);

                                              // Update local state with server response
                                              if (data.success && Array.isArray(data.imagePaths)) {
                                                const resolvedPaths = data.imagePaths.map((img: string) => resolveMediaUrl(img));
                                                setImagePreviews(resolvedPaths);
                                                console.log('[Products] Updated imagePreviews from server:', resolvedPaths);
                                              }
                                            } catch (error) {
                                              console.error('[Products] Error deleting image from server:', error);
                                              alert('Rasmni serverdan o\'chirishda xatolik yuz berdi');
                                              return;
                                            }
                                          } else {
                                            // New image (blob URL) - just remove from local state
                                            console.log('[Products] Removing local image preview');

                                            // Only revoke blob URLs
                                            if (preview.startsWith('blob:')) {
                                              URL.revokeObjectURL(preview);
                                            }

                                            // Remove from both arrays
                                            setImagePreviews(prev => {
                                              const newPreviews = prev.filter((_, i) => i !== index);
                                              console.log('[Products] New imagePreviews after delete:', newPreviews);
                                              return newPreviews;
                                            });

                                            setImageFiles(prev => {
                                              const newFiles = prev.filter((_, i) => i !== index);
                                              console.log('[Products] New imageFiles after delete:', newFiles);
                                              return newFiles;
                                            });
                                          }
                                        }}
                                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center opacity-100 hover:bg-red-700 shadow-lg z-10"
                                        disabled={isSaving}
                                      >
                                        ×
                                      </button>
                                      {/* Image number */}
                                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-semibold">
                                        {index + 1}
                                      </div>
                                      {/* Drag indicator */}
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                        <svg className="w-6 h-6 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                        </svg>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Rasmlarni sudrab tartibini o'zgartiring
                                </p>
                              </div>
                            )}

                            {/* Fayl tanlash tugmalari */}
                            <div className="grid grid-cols-1 gap-2">
                              {/* Galereyadan tanlash (ko'p rasm) */}
                              <div
                                className="w-full border-2 border-dashed border-border rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-center text-center cursor-pointer hover:border-primary hover:bg-muted/70 transition"
                                onClick={() => {
                                  const input = document.getElementById('product-images-gallery') as HTMLInputElement | null;
                                  input?.click();
                                }}
                              >
                                <input
                                  id="product-images-gallery"
                                  type="file"
                                  accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/webm"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    console.log('[Products] Gallery files selected:', files.length);
                                    if (files.length === 0) return;

                                    const imageCandidates: File[] = [];
                                    let pickedVideo: File | null = null;

                                    files.forEach((f) => {
                                      if (f.type.startsWith('video/')) {
                                        if (!pickedVideo) pickedVideo = f;
                                      } else if (f.type.startsWith('image/')) {
                                        imageCandidates.push(f);
                                      }
                                    });

                                    const validImages = imageCandidates;

                                    if (validImages.length > 0) {
                                      setImageFiles((prev) => [...prev, ...validImages]);
                                      const newPreviews = validImages.map((f) => URL.createObjectURL(f));
                                      setImagePreviews((prev) => [...prev, ...newPreviews]);
                                      setImageError(null);
                                      console.log('[Products] Added images:', validImages.length);
                                    }

                                    if (pickedVideo) {
                                      setVideoFile(pickedVideo);
                                      setVideoError(null);
                                      setVideoPreviewUrl(URL.createObjectURL(pickedVideo));
                                    }

                                    e.target.value = '';
                                  }}
                                />
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                  <div className="text-left">
                                    <p className="text-sm font-semibold text-foreground">Galereyadan tanlash</p>
                                    <p className="text-xs text-muted-foreground">Ko'p rasm tanlash mumkin</p>
                                  </div>
                                </div>
                              </div>

                              {/* Kameradan suratga olish (bitta rasm) */}
                              <div
                                className="w-full border-2 border-dashed border-border rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-center text-center cursor-pointer hover:border-primary hover:bg-muted/70 transition"
                                onClick={() => {
                                  const input = document.getElementById('product-images-camera') as HTMLInputElement | null;
                                  input?.click();
                                }}
                              >
                                <input
                                  id="product-images-camera"
                                  type="file"
                                  accept="image/jpeg,image/jpg,image/png,image/webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    console.log('[Products] Camera file selected:', files.length);
                                    if (files.length === 0) return;

                                    const validImages = files.filter((f) => f.type.startsWith('image/'));

                                    if (validImages.length > 0) {
                                      setImageFiles((prev) => [...prev, ...validImages]);
                                      const newPreviews = validImages.map((f) => URL.createObjectURL(f));
                                      setImagePreviews((prev) => [...prev, ...newPreviews]);
                                      setImageError(null);
                                      console.log('[Products] Added camera image');
                                    }

                                    e.target.value = '';
                                  }}
                                />
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  </div>
                                  <div className="text-left">
                                    <p className="text-sm font-semibold text-foreground">Kameradan suratga olish</p>
                                    <p className="text-xs text-muted-foreground">Har safar bitta rasm</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {imageError && (
                              <p className="text-xs text-destructive mt-2">{imageError}</p>
                            )}
                            {videoError && (
                              <p className="text-xs text-destructive mt-1">{videoError}</p>
                            )}

                            {/* Video preview */}
                            {videoFile && !videoError && (
                              <div className="mt-3">
                                <p className="text-xs font-semibold text-foreground mb-2">Tanlangan rasm:</p>
                                <div className="relative rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden shadow-lg">
                                  {/* Video player - only if preview URL exists */}
                                  {videoPreviewUrl && (
                                    <div className="relative w-full aspect-video bg-black">
                                      <video
                                        controls
                                        className="w-full h-full"
                                        src={videoPreviewUrl}
                                      >
                                        <source src={videoPreviewUrl} type={videoFile.type} />
                                        Brauzeringiz video o'ynatishni qo'llab-quvvatlamaydi.
                                      </video>
                                    </div>
                                  )}

                                  {/* Video info */}
                                  <div className="p-4">
                                    <div className="flex items-start gap-3">
                                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground truncate">{videoFile.name}</p>
                                        {videoFile.size > 0 && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Hajmi: {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                                          </p>
                                        )}
                                        <p className="text-[10px] text-muted-foreground mt-1 italic">
                                          {videoPreviewUrl
                                            ? 'Video preview ko\'rsatilmoqda. Saqlashda faqat nom saqlanadi.'
                                            : 'Mavjud video. Yangi video yuklash uchun fayl tanlang.'}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (videoPreviewUrl && !videoPreviewUrl.startsWith('http')) {
                                            URL.revokeObjectURL(videoPreviewUrl);
                                          }
                                          setVideoFile(null);
                                          setVideoError(null);
                                          setVideoPreviewUrl(null);
                                        }}
                                        className="flex-shrink-0 w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm flex items-center justify-center transition-all shadow-lg"
                                        disabled={isSaving}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddForm(false);
                              setEditingId(null);
                              setName('');
                              setSku('');
                              setCustomId(''); // ✅ YANGI: Custom ID ni tozalash
                              setPrice('');
                              setBasePrice('');
                              setPriceMultiplier('25');
                              setStock('1');
                              setCategoryId('');
                              setSelectedParent(null);
                              setImageFiles([]);
                              setImagePreviews([]);
                              setImageError(null);
                              setVideoFile(null);
                              setVideoError(null);
                              setSizesText('');
                              setSizeDraft('');
                              setSizePriceDraft('');
                              setIsAddingSize(false);
                              setEditingSizeIndex(null);
                              setIsCreatingCategory(false);
                              setNewCategoryName('');
                              setCreateCategoryError(null);
                              setProductStatus('available');
                              setIsPriceManuallyEdited(false);
                              setVariantSummaries([]); // MUHIM: Bekor qilganda xillarni tozalash
                            }}
                            className="px-4 py-2 rounded-lg border border-border bg-secondary text-secondary-foreground text-xs hover:bg-muted transition-all"
                            disabled={isSaving}
                          >
                            Bekor qilish
                          </button>
                          <button
                            type="submit"
                            disabled={
                              isSaving ||
                              !name.trim() ||
                              !sku.trim() ||
                              !basePrice.trim() ||
                              !priceMultiplier.trim() ||
                              !stock.trim() ||
                              !categoryId.trim()
                            }
                            className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-lg shadow-red-900/40 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isSaving ? 'Saqlanmoqda...' : editingId ? 'Mahsulotni yangilash' : 'Mahsulot qo\'shish'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </motion.div>
                </ErrorBoundary>
              </div>
            )}
          </AnimatePresence>

          {/* Tarix Modal */}
          <AnimatePresence>
            {showHistoryModal && (
              <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="text-base font-semibold text-foreground">Tarix</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Hammasini tozalash tugmasi - faqat ega uchun */}
                      {(user?.role === 'egasi' || user?.role === 'owner' || user?.role === 'admin') && productHistory.length > 0 && (
                        <button
                          onClick={() => {
                            showConfirmModal({
                              title: "Tarixni tozalash",
                              description: "Barcha tarixni o'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo'lmaydi.",
                              confirmText: "Tozalash",
                              cancelText: "Bekor qilish",
                              variant: 'destructive',
                              onConfirm: async () => {
                                closeConfirmModal();
                                // Barcha tarixni o'chirish
                                if (user?.id) {
                                  try {
                                    await fetch(`${API_BASE_URL}/api/product-history/clear`, {
                                      method: 'DELETE',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ userId: user.id }),
                                    });
                                    setProductHistory([]);
                                  } catch (err) {
                                    console.error('Failed to clear history:', err);
                                  }
                                }
                              }
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium"
                        >
                          Tozalash
                        </button>
                      )}
                      <button
                        onClick={() => setShowHistoryModal(false)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex p-3 gap-2">
                    <button
                      onClick={() => setHistoryTab('today')}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${historyTab === 'today'
                        ? 'bg-green-500 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                    >
                      Bugun
                    </button>
                    <button
                      onClick={() => setHistoryTab('past')}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${historyTab === 'past'
                        ? 'bg-green-500 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                    >
                      O'tgan
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-3 max-h-[400px] overflow-y-auto">
                    {(() => {
                      const today = new Date().toDateString();
                      const filteredHistory = productHistory.filter(item => {
                        const itemDate = new Date(item.timestamp).toDateString();
                        const isToday = historyTab === 'today' ? itemDate === today : itemDate !== today;
                        // Faqat 'manual' source bo'lganlarni ko'rsatish (Excel bilan qo'shilganlarni hisoblamaslik)
                        const isManual = item.source !== 'excel';
                        return isToday && isManual;
                      });

                      // Mahsulot va xillarni guruhlash MANTIQI O'CHIRILDI
                      // Sabab: Foydalanuvchi xil va mahsulot o'zgarishlari alohida ko'rinishini xohladi
                      // Shuning uchun biz shunchaki ID bo'yicha takrorlanishlarni olib tashlaymiz
                      const uniqueHistory: ProductHistoryItem[] = [];
                      const processedIds = new Set<string>();

                      for (const item of filteredHistory) {
                        if (!processedIds.has(item.id)) {
                          uniqueHistory.push(item);
                          processedIds.add(item.id);
                        }
                      }

                      // Vaqt bo'yicha saralash (eng yangisi tepada)
                      const sortedHistory = uniqueHistory.sort((a, b) =>
                        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                      );

                      if (sortedHistory.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                            <svg className="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm">{historyTab === 'today' ? "Bugun tarix yo'q" : "O'tgan kunlar tarixi yo'q"}</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2">
                          {sortedHistory.map((item) => {
                            // Rang va matn aniqlash
                            const isCreate = item.type === 'create';
                            const isDelete = item.type === 'delete';
                            const isVariant = item.type === 'variant_create' || item.type === 'variant_update';
                            const isVariantCreate = item.type === 'variant_create';
                            const hasVariants = item.variants && item.variants.length > 0;

                            const bgClass = isCreate
                              ? 'bg-green-500/10 border-green-500/30'
                              : isDelete
                                ? 'bg-red-500/10 border-red-500/30'
                                : isVariant
                                  ? 'bg-amber-500/10 border-amber-500/30'
                                  : 'bg-blue-500/10 border-blue-500/30';

                            const textClass = isCreate
                              ? 'text-green-400'
                              : isDelete
                                ? 'text-red-400'
                                : isVariant
                                  ? 'text-amber-400'
                                  : 'text-blue-400';

                            const label = isCreate
                              ? 'Qo\'shildi'
                              : isDelete
                                ? 'O\'chirildi'
                                : isVariantCreate
                                  ? 'Xil qo\'shildi'
                                  : isVariant
                                    ? 'Xil tahrirlandi'
                                    : 'Tahrirlandi';

                            return (
                              <div
                                key={item.id}
                                className={`p-3 rounded-xl border ${bgClass} cursor-pointer hover:opacity-80 transition relative`}
                                onClick={() => setSelectedHistoryItem(item)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-semibold ${textClass}`}>
                                      {label}
                                      {hasVariants && (
                                        <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                                          +{item.variants!.length} xil
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-foreground text-sm mt-1 break-words">
                                      {item.productName}
                                    </p>

                                    {/* O'zgarishlarni ko'rsatish - tahrirlash uchun */}
                                    {item.type === 'update' && item.changes && item.changes.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        {item.changes.slice(0, 2).map((change, idx) => {
                                          const fieldLabels: Record<string, string> = {
                                            'name': 'Nomi',
                                            'sku': 'Kod',
                                            'price': 'Narxi',
                                            'basePrice': 'Asl narxi',
                                            'priceMultiplier': 'Foiz',
                                            'stock': 'Ombor',
                                            'currency': 'Valyuta',
                                          };
                                          const fieldLabel = fieldLabels[change.field] || change.field;
                                          const oldVal = change.oldValue === null || change.oldValue === undefined ? '(bo\'sh)' : String(change.oldValue);
                                          const newVal = change.newValue === null || change.newValue === undefined ? '(bo\'sh)' : String(change.newValue);

                                          return (
                                            <p key={idx} className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                              <span className="text-blue-400 font-medium">{fieldLabel}:</span>
                                              <span className="text-red-400/80 line-through decoration-red-400/50">{oldVal}</span>
                                              <span className="text-muted-foreground font-bold">→</span>
                                              <span className="text-green-400 font-medium">{newVal}</span>
                                            </p>
                                          );
                                        })}
                                        {item.changes.length > 2 && (
                                          <p className="text-xs text-muted-foreground">
                                            +{item.changes.length - 2} ta o'zgarish ko'proq
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    {/* Xil tahrirlash uchun o'zgarishlarni ko'rsatish */}
                                    {item.type === 'variant_update' && item.changes && item.changes.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        {item.changes.slice(0, 2).map((change, idx) => {
                                          const fieldLabels: Record<string, string> = {
                                            'name': 'Nomi',
                                            'sku': 'Kod',
                                            'price': 'Narxi',
                                            'basePrice': 'Asl narxi',
                                            'priceMultiplier': 'Foiz',
                                            'stock': 'Ombor',
                                            'currency': 'Valyuta',
                                          };
                                          const fieldLabel = fieldLabels[change.field] || change.field;
                                          const oldVal = change.oldValue === null || change.oldValue === undefined ? '(bo\'sh)' : String(change.oldValue);
                                          const newVal = change.newValue === null || change.newValue === undefined ? '(bo\'sh)' : String(change.newValue);

                                          return (
                                            <p key={idx} className="text-xs text-muted-foreground">
                                              <span className="text-amber-400">{fieldLabel}:</span> <span className="text-red-400">{oldVal}</span> <span className="text-muted-foreground">→</span> <span className="text-green-400">{newVal}</span>
                                            </p>
                                          );
                                        })}
                                        {item.changes.length > 2 && (
                                          <p className="text-xs text-muted-foreground">
                                            +{item.changes.length - 2} ta o'zgarish ko'proq
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right flex-shrink-0 flex items-start gap-2">
                                    <div>
                                      {historyTab === 'past' && (
                                        <p className="text-xs text-muted-foreground">
                                          {new Date(item.timestamp).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' })}
                                        </p>
                                      )}
                                      <p className="text-xs text-muted-foreground">
                                        {new Date(item.timestamp).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                    {/* O'chirish tugmasi - faqat ega uchun */}
                                    {(user?.role === 'egasi' || user?.role === 'owner' || user?.role === 'admin') && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          showConfirmModal({
                                            title: "Tarixdan o'chirish",
                                            description: `"${item.productName}" ni tarixdan o'chirishni tasdiqlaysizmi?`,
                                            confirmText: "O'chirish",
                                            cancelText: "Bekor qilish",
                                            variant: 'destructive',
                                            onConfirm: () => {
                                              closeConfirmModal();
                                              deleteHistoryItem(item.id);
                                            }
                                          });
                                        }}
                                        className="w-9 h-9 rounded-full bg-red-500/30 hover:bg-red-500/50 text-red-400 flex items-center justify-center"
                                        title="O'chirish"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Tarix Detail Modal */}
          <AnimatePresence>
            {selectedHistoryItem && (
              <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted">
                    <h3 className="text-base font-semibold text-foreground">
                      {selectedHistoryItem.type === 'create' ? "Qo'shilgan mahsulot"
                        : selectedHistoryItem.type === 'delete' ? "O'chirilgan mahsulot"
                          : selectedHistoryItem.type === 'variant_create' ? "Qo'shilgan xil"
                            : selectedHistoryItem.type === 'variant_update' ? "Yangilangan xil"
                              : "Yangilangan mahsulot"}
                    </h3>
                    <button
                      onClick={() => setSelectedHistoryItem(null)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-4">
                    {/* Nomi */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Nomi:</span>
                      <span className="text-sm font-semibold text-foreground">{selectedHistoryItem.productName}</span>
                    </div>

                    {/* Kod */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Kod:</span>
                      <span className="text-sm font-semibold text-foreground">{selectedHistoryItem.sku}</span>
                    </div>

                    {/* Soni */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Soni:</span>
                      <span className="text-sm font-semibold text-emerald-400">
                        {selectedHistoryItem.addedStock ? `+${selectedHistoryItem.addedStock}` : selectedHistoryItem.stock} ta
                      </span>
                    </div>

                    {/* Narxi */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Narxi:</span>
                      <span className="text-sm font-semibold text-green-400">
                        {selectedHistoryItem.price} {selectedHistoryItem.currency}
                      </span>
                    </div>

                    {/* Vaqti */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Vaqti:</span>
                      <span className="text-sm font-semibold text-foreground">
                        {new Date(selectedHistoryItem.timestamp).toLocaleDateString('uz-UZ', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })} {new Date(selectedHistoryItem.timestamp).toLocaleTimeString('uz-UZ', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    {/* O'zgarishlar (agar mavjud bo'lsa) - TAHRIRLASH UCHUN */}
                    {selectedHistoryItem.changes && selectedHistoryItem.changes.length > 0 && (
                      <div className="pt-3 border-t border-border">
                        <p className="text-sm text-muted-foreground mb-2">O'zgarishlar:</p>
                        <div className="space-y-2">
                          {selectedHistoryItem.changes.map((change, idx) => {
                            // Field nomini o'zbek tiliga tarjima qilish
                            const fieldLabels: Record<string, string> = {
                              'name': 'Nomi',
                              'sku': 'Kod',
                              'price': 'Narxi',
                              'basePrice': 'Asl narxi',
                              'priceMultiplier': 'Foiz',
                              'stock': 'Ombor',
                              'currency': 'Valyuta',
                              'description': 'Tavsifi',
                            };

                            const fieldLabel = fieldLabels[change.field] || change.field;

                            // Qiymatlarni formatlash - "eski > yangi" formatida
                            const formatValue = (val: any): string => {
                              if (val === null || val === undefined) return '(bo\'sh)';
                              if (typeof val === 'number') return val.toString();
                              return String(val);
                            };

                            const oldValueStr = formatValue(change.oldValue);
                            const newValueStr = formatValue(change.newValue);
                            const changeMessage = `${oldValueStr} > ${newValueStr}`;

                            return (
                              <div key={idx} className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                                <p className="text-xs font-semibold text-blue-400 mb-1">{fieldLabel}</p>
                                <div className="text-xs text-foreground font-mono flex items-center gap-2 flex-wrap">
                                  <span className="text-red-400 line-through opacity-80">{oldValueStr}</span>
                                  <span className="text-muted-foreground font-bold">→</span>
                                  <span className="text-green-400 font-semibold">{newValueStr}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Xillar (agar mavjud bo'lsa) */}
                    {selectedHistoryItem.variants && selectedHistoryItem.variants.length > 0 && (
                      <div className="pt-3 border-t border-border">
                        <p className="text-sm text-muted-foreground mb-2">Xillar ({selectedHistoryItem.variants.length} ta):</p>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {selectedHistoryItem.variants.map((v, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 cursor-pointer hover:bg-amber-500/20 transition"
                              onClick={() => setSelectedVariantDetail({
                                ...v,
                                timestamp: selectedHistoryItem.timestamp
                              })}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-amber-400">{v.name}</span>
                                {v.sku && <span className="text-xs text-muted-foreground">#{v.sku}</span>}
                              </div>
                              <div className="flex items-center justify-between mt-1 text-xs">
                                <span className="text-emerald-400">{v.stock} ta</span>
                                <span className="text-green-400">{v.price} {v.currency || selectedHistoryItem.currency}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-4 pb-4 space-y-2">
                    {/* O'chirish tugmasi - faqat ega uchun */}
                    {(user?.role === 'egasi' || user?.role === 'owner' || user?.role === 'admin') && (
                      <button
                        onClick={() => {
                          showConfirmModal({
                            title: "Tarixdan o'chirish",
                            description: `"${selectedHistoryItem.productName}" ni tarixdan o'chirishni tasdiqlaysizmi?`,
                            confirmText: "O'chirish",
                            cancelText: "Bekor qilish",
                            variant: 'destructive',
                            onConfirm: () => {
                              closeConfirmModal();
                              deleteHistoryItem(selectedHistoryItem.id);
                              setSelectedHistoryItem(null);
                            }
                          });
                        }}
                        className="w-full py-2.5 rounded-xl bg-red-500/20 text-red-400 font-semibold hover:bg-red-500/30 transition border border-red-500/30"
                      >
                        O'chirish
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedHistoryItem(null)}
                      className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition"
                    >
                      Yopish
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Xil Detail Modal */}
          <AnimatePresence>
            {selectedVariantDetail && (
              <div className="fixed inset-0 z-[10003] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full max-w-sm bg-card border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/30 bg-amber-500/10">
                    <h3 className="text-base font-semibold text-amber-400">Xil ma'lumotlari</h3>
                    <button
                      onClick={() => setSelectedVariantDetail(null)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-4">
                    {/* Nomi */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Nomi:</span>
                      <span className="text-sm font-semibold text-foreground">{selectedVariantDetail.name}</span>
                    </div>

                    {/* Kod */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Kod:</span>
                      <span className="text-sm font-semibold text-foreground">{selectedVariantDetail.sku || '-'}</span>
                    </div>

                    {/* Soni */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Soni:</span>
                      <span className="text-sm font-semibold text-emerald-400">{selectedVariantDetail.stock} ta</span>
                    </div>

                    {/* Narxi */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Narxi:</span>
                      <span className="text-sm font-semibold text-green-400">
                        {selectedVariantDetail.price} {selectedVariantDetail.currency || 'UZS'}
                      </span>
                    </div>

                    {/* Vaqti */}
                    {selectedVariantDetail.timestamp && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Vaqti:</span>
                        <span className="text-sm font-semibold text-foreground">
                          {new Date(selectedVariantDetail.timestamp).toLocaleDateString('uz-UZ', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })} {new Date(selectedVariantDetail.timestamp).toLocaleTimeString('uz-UZ', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}

                    {/* O'zgarishlar (agar mavjud bo'lsa) - TAHRIRLASH UCHUN */}
                    {selectedHistoryItem && selectedHistoryItem.type === 'variant_update' && selectedHistoryItem.changes && selectedHistoryItem.changes.length > 0 && (
                      <div className="pt-3 border-t border-amber-500/30">
                        <p className="text-sm text-muted-foreground mb-2">O'zgarishlar:</p>
                        <div className="space-y-2">
                          {selectedHistoryItem.changes.map((change, idx) => {
                            // Field nomini o'zbek tiliga tarjima qilish
                            const fieldLabels: Record<string, string> = {
                              'name': 'Nomi',
                              'sku': 'Kod',
                              'price': 'Narxi',
                              'basePrice': 'Asl narxi',
                              'priceMultiplier': 'Foiz',
                              'stock': 'Ombor',
                              'currency': 'Valyuta',
                            };

                            const fieldLabel = fieldLabels[change.field] || change.field;

                            // Qiymatlarni formatlash - "eski > yangi" formatida
                            const formatValue = (val: any): string => {
                              if (val === null || val === undefined) return '(bo\'sh)';
                              if (typeof val === 'number') return val.toString();
                              return String(val);
                            };

                            const oldValueStr = formatValue(change.oldValue);
                            const newValueStr = formatValue(change.newValue);

                            return (
                              <div key={idx} className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                <p className="text-xs font-semibold text-amber-400 mb-1">{fieldLabel}</p>
                                <div className="text-xs text-foreground font-mono">
                                  <span className="text-red-400">{oldValueStr}</span>
                                  <span className="text-muted-foreground mx-1">→</span>
                                  <span className="text-green-400 font-semibold">{newValueStr}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-4 pb-4 space-y-2">
                    {/* O'chirish tugmasi - faqat ega uchun */}
                    {(user?.role === 'egasi' || user?.role === 'owner' || user?.role === 'admin') && selectedHistoryItem && (
                      <button
                        onClick={() => {
                          showConfirmModal({
                            title: "Xilni tarixdan o'chirish",
                            description: `"${selectedVariantDetail.name}" xilini tarixdan o'chirishni tasdiqlaysizmi?`,
                            confirmText: "O'chirish",
                            cancelText: "Bekor qilish",
                            variant: 'destructive',
                            onConfirm: () => {
                              closeConfirmModal();
                              // Xilni tarix yozuvidan olib tashlash
                              const updatedVariants = selectedHistoryItem.variants?.filter(
                                (v: any) => v.name !== selectedVariantDetail.name || v.sku !== selectedVariantDetail.sku
                              ) || [];

                              // Agar boshqa xillar qolmasa - butun tarix yozuvini o'chirish
                              if (updatedVariants.length === 0) {
                                deleteHistoryItem(selectedHistoryItem.id);
                                setSelectedHistoryItem(null);
                              } else {
                                // Faqat xilni olib tashlash - local state yangilash
                                setProductHistory(prev => prev.map(item =>
                                  item.id === selectedHistoryItem.id
                                    ? { ...item, variants: updatedVariants }
                                    : item
                                ));
                                setSelectedHistoryItem(prev => prev ? { ...prev, variants: updatedVariants } : null);
                              }
                              setSelectedVariantDetail(null);
                            }
                          });
                        }}
                        className="w-full py-2.5 rounded-xl bg-red-500/20 text-red-400 font-semibold hover:bg-red-500/30 transition border border-red-500/30"
                      >
                        O'chirish
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedVariantDetail(null)}
                      className="w-full py-2.5 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-500 transition"
                    >
                      Yopish
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {isLoadingProducts ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-base text-muted-foreground font-medium">Mahsulotlar yuklanmoqda...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 rounded-2xl border border-primary/30 bg-card backdrop-blur-xl">
              <div className="relative group mb-6">
                <div className="absolute inset-0 bg-primary rounded-2xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity"></div>
                <div className="relative bg-gradient-to-br from-primary via-primary to-primary p-6 rounded-2xl shadow-2xl">
                  <svg className="w-12 h-12 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Hali mahsulotlar yo'q</h3>
              <p className="text-red-500 text-center mb-6 max-w-md">
                Birinchi mahsulotingizni qo'shish uchun yuqoridagi <br /> "Mahsulot qo'shish" tugmasini bosing
              </p>

            </div>
          ) : (
            <div
              className={`grid gap-5 transition-all ${sidebarCollapsed
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4'
                : 'grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3'
                }`}
            >
              {filteredProducts.slice(0, displayedCount).map((item) => {
                const p = item.product;
                const isVariant = item.type === 'variant';
                const statusKey = normalizeProductStatus(p.status);
                const statusMeta = productStatusConfig[statusKey];
                const salesCount = todaySalesMap[p.id] ?? 0;
                const salesStatus = getStatusForSales(salesCount);

                const hasVideo = p.video?.filename;

                // Xil uchun alohida card
                if (isVariant && item.variant) {
                  return (
                    <div
                      key={`${p.id}-variant-${item.variantIndex}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/product/${p.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/product/${p.id}`);
                        }
                      }}
                      className="group relative flex w-full h-full flex-col rounded-xl border-2 border-emerald-500/60 transition-all duration-200 overflow-hidden cursor-pointer focus:outline-none focus:ring-2 bg-gradient-to-br from-emerald-900/30 via-gray-900 to-emerald-900/20 shadow-lg shadow-emerald-500/10 hover:-translate-y-0.5 hover:shadow-xl hover:border-emerald-400/80 focus:ring-emerald-500/60"
                    >
                      {/* Xil badge */}
                      <div className="absolute top-2 right-2 z-10">
                        <Badge className="text-[10px] font-bold px-2 py-0.5 shadow-lg bg-purple-600 text-white">
                          Xil
                        </Badge>
                      </div>

                      {/* Content */}
                      <div className="p-3 flex-1 flex flex-col">
                        {/* Daromad - yashil rang */}
                        <div className="flex items-center justify-center gap-1.5 mb-2">
                          <span className="text-xl font-bold text-emerald-400">
                            {item.daromad.toLocaleString('uz-UZ', { maximumFractionDigits: 2 })}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                            {item.variant.currency || p.currency || 'UZS'}
                          </span>
                        </div>

                        {/* Xil nomi (Mahsulot nomi) */}
                        <h3 className="text-center text-sm font-semibold mb-0.5 line-clamp-2 leading-tight min-h-[2.5rem] text-emerald-200">
                          {item.displayName}
                        </h3>

                        {/* Statistika */}
                        <div className="grid grid-cols-3 gap-1 text-center mb-3">
                          <div className="rounded-lg p-1.5 bg-emerald-800/30">
                            <p className="text-[8px] uppercase font-medium mb-0.5 text-emerald-400">KOD</p>
                            <p className="text-[10px] font-bold truncate text-emerald-300">
                              {item.variant.sku || '-'}
                            </p>
                          </div>
                          <div className="rounded-lg p-1.5 bg-emerald-800/30">
                            <p className="text-[8px] uppercase font-medium mb-0.5 text-emerald-400">NARX</p>
                            <p className="text-[10px] font-bold truncate text-emerald-300">
                              {item.displayPrice.toLocaleString('uz-UZ')}
                            </p>
                          </div>
                          <div className="rounded-lg p-1.5 bg-emerald-800/30">
                            <p className="text-[8px] uppercase font-medium mb-0.5 text-emerald-400">OMBOR</p>
                            <p className="text-[10px] font-bold truncate text-emerald-300">
                              {item.displayStock}
                            </p>
                          </div>
                        </div>

                        {/* Xilni o'chirish tugmasi + Status - hr dan yuqorida */}
                        <div className="flex items-center gap-1.5 mt-auto">
                          {/* Xilni o'chirish tugmasi - sariq X */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (isSaving || productLoadingId === p.id) return;

                              const variantName = item.variant?.name || 'Xil';
                              const variantIdx = item.variantIndex;
                              const productId = p.id;

                              showConfirmModal({
                                title: "Xilni o'chirish",
                                description: `"${variantName}" xilni o'chirishni tasdiqlaysizmi?`,
                                confirmText: "O'chirish",
                                cancelText: "Bekor qilish",
                                variant: 'destructive',
                                onConfirm: async () => {
                                  closeConfirmModal();
                                  setProductLoadingId(productId);

                                  try {
                                    // Mahsulot ma'lumotlarini yuklash
                                    const detailed = await fetchProductDetails(productId);
                                    const productData = detailed || p;

                                    // Xilni variantSummaries dan olib tashlash
                                    const rawVariants = (productData as any)?.variantSummaries || [];
                                    const updatedVariants = rawVariants.filter((_: any, idx: number) => idx !== variantIdx);

                                    // Mahsulotni yangilash
                                    const response = await fetch(`${API_BASE_URL}/api/products/${productId}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        ...productData,
                                        variantSummaries: updatedVariants
                                      }),
                                    });

                                    if (!response.ok) {
                                      throw new Error('Xilni o\'chirishda xatolik');
                                    }

                                    // Mahsulotlar ro'yxatini yangilash
                                    const params = new URLSearchParams();
                                    if (user?.id) params.append('userId', user.id);
                                    if (user?.phone) params.append('userPhone', user.phone);
                                    const productsRes = await fetch(`${API_BASE_URL}/api/products?${params}`);
                                    if (productsRes.ok) {
                                      const productsData = await productsRes.json();
                                      const productsArray = Array.isArray(productsData) ? productsData : productsData.products || [];
                                      const mappedProducts = productsArray.map((prod: any) => ({
                                        ...prod,
                                        id: prod.id || prod._id,
                                      }));
                                      setProducts(sortProductsBySku(mappedProducts as Product[]));
                                    }
                                    toast.success(`"${variantName}" muvaffaqiyatli o'chirildi`);
                                  } catch (error) {
                                    console.error('[Products] Failed to delete variant:', error);
                                    toast.error('Xilni o\'chirishda xatolik: ' + (error instanceof Error ? error.message : 'Noma\'lum xatolik'));
                                  } finally {
                                    setProductLoadingId(null);
                                  }
                                },
                              });
                            }}
                            disabled={isSaving || productLoadingId === p.id || !canEditOrDelete}
                            className={`w-6 h-6 inline-flex items-center justify-center rounded-full transition-all z-10 ${canEditOrDelete
                              ? 'bg-orange-600 hover:bg-orange-500 text-white'
                              : 'hidden'
                              }`}
                            title="Xilni o'chirish"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          {/* Status badge */}
                          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium bg-emerald-800/50 text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {item.variant.status || 'available'}
                          </span>
                        </div>
                      </div>

                      {/* Bottom actions - faqat isReplacement bo'lsa ogohlantirish ko'rsatish */}
                      <div className="flex items-center justify-between px-3 py-2 border-t gap-2 border-emerald-500/30 bg-emerald-950/30">
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (isSaving) return;

                            setProductLoadingId(p.id);

                            try {
                              let productData: any = p;
                              const detailed = await fetchProductDetails(p.id);
                              if (detailed) {
                                productData = detailed;
                              }

                              // MUHIM: Eski mahsulot ma'lumotlarini saqlash (tahrirlash uchun)
                              const oldData = {
                                name: productData.name ?? p.name,
                                sku: productData.sku ?? p.sku,
                                price: productData.price ?? p.price,
                                basePrice: productData.basePrice ?? p.basePrice,
                                priceMultiplier: productData.priceMultiplier ?? p.priceMultiplier,
                                stock: productData.stock ?? p.stock,
                                currency: productData.currency || p.currency || 'USD',
                                description: productData.description ?? p.description,
                              };
                              console.log('[Products] Setting oldProductDataRef:', oldData);
                              setOldProductData(oldData);
                              oldProductDataRef.current = oldData; // MUHIM: Ref ga ham saqlash

                              setEditingId(productData.id ?? p.id);
                              setShowAddForm(true);
                              setName(productData.name ?? p.name ?? '');
                              setSku(productData.sku ?? p.sku ?? '');
                              setCustomId(productData.customId ?? p.customId ?? ''); // ✅ YANGI: Custom ID ni yuklash

                              const existingPrice =
                                productData.price != null
                                  ? String(productData.price)
                                  : (p.price != null ? String(p.price) : '');
                              const existingBasePrice =
                                productData.basePrice != null
                                  ? String(productData.basePrice)
                                  : (p.basePrice != null ? String(p.basePrice) : '');
                              // MUHIM: markupPercentage va priceMultiplier bir xil narsa
                              // Avval markupPercentage ni tekshiramiz, keyin priceMultiplier
                              const existingMarkup = productData.markupPercentage ?? p.markupPercentage;
                              const existingPriceMultiplier = existingMarkup != null
                                ? String(existingMarkup)
                                : (productData.priceMultiplier != null
                                  ? String(productData.priceMultiplier)
                                  : (p.priceMultiplier != null ? String(p.priceMultiplier) : ''));

                              setPrice(existingPrice);
                              setPriceCurrency(productData.currency || p.currency || 'USD');
                              setBasePrice(existingBasePrice);
                              setPriceMultiplier(existingPriceMultiplier);

                              const stockValue = productData.stock != null ? productData.stock : p.stock;
                              setStock(stockValue != null ? String(stockValue) : '');

                              const hasAutoCalculation = existingBasePrice && existingPriceMultiplier;
                              setIsPriceManuallyEdited(!hasAutoCalculation);
                              setCategoryId(productData.categoryId ?? p.categoryId ?? '');

                              // Load variantSummaries
                              const rawVariants = (productData as any)?.variantSummaries;
                              const loadedVariants = Array.isArray(rawVariants)
                                ? rawVariants.map((v: any) => {
                                  const imagePaths = Array.isArray(v.imagePaths) ? v.imagePaths : [];
                                  const imagePreviews = imagePaths.map((img: string) => resolveMediaUrl(img));

                                  return {
                                    ...v,
                                    images: [],
                                    imagePaths: imagePaths,
                                    imagePreviews: imagePreviews
                                  };
                                })
                                : [];

                              setVariantSummaries(loadedVariants);

                              // Update oldProductDataRef with loaded variants
                              if (oldProductDataRef.current) {
                                oldProductDataRef.current.variantSummaries = JSON.parse(JSON.stringify(loadedVariants));
                              }

                              if (loadedVariants.length > 0) {
                                const sizesFromVariants = loadedVariants.map((v: any) => {
                                  const name = v.name || '';
                                  const price = v.price != null ? v.price : '';
                                  return price ? `${name}|${price}` : name;
                                }).filter(Boolean);
                                setSizesText(sizesFromVariants.join(', '));
                              } else {
                                const sizesSource =
                                  Array.isArray(productData.sizes) && productData.sizes.length
                                    ? productData.sizes
                                    : (Array.isArray(p.sizes) ? p.sizes : []);
                                setSizesText(sizesSource.length ? sizesSource.join(', ') : '');
                              }
                              setImageFiles([]);
                              const imagePathSource =
                                productData.imagePaths && Array.isArray(productData.imagePaths) && productData.imagePaths.length > 0
                                  ? productData.imagePaths
                                  : (Array.isArray(p.imagePaths) ? p.imagePaths : []);
                              const existingImages =
                                imagePathSource.length > 0
                                  ? imagePathSource.map((img: string) => resolveMediaUrl(img))
                                  : (productData.imageUrl
                                    ? [resolveMediaUrl(productData.imageUrl)]
                                    : (p.imageUrl ? [resolveMediaUrl(p.imageUrl)] : []));
                              setImagePreviews(existingImages);
                              setImageError(null);
                              setRemoveExistingImage(false);

                              // Load video if exists
                              const videoData = (productData as any)?.video ?? (p as any)?.video;
                              if (videoData?.filename) {
                                const mockVideoFile = new File([], videoData.filename, { type: 'video/mp4' });
                                Object.defineProperty(mockVideoFile, 'size', { value: videoData.size || 0 });
                                setVideoFile(mockVideoFile);
                                if (videoData.url) {
                                  setVideoPreviewUrl(videoData.url);
                                } else {
                                  setVideoPreviewUrl(null);
                                }
                              } else {
                                setVideoFile(null);
                                setVideoPreviewUrl(null);
                              }
                              setVideoError(null);
                              setProductStatus(normalizeProductStatus(productData.status ?? p.status));
                            } catch (error) {
                              console.error('[Products] Failed to open product for edit:', error);
                              alert('Mahsulot ma\'lumotlarini yuklashda xatolik yuz berdi. Qaytadan urinib ko\'ring.');
                            } finally {
                              setProductLoadingId(null);
                            }
                          }}
                          disabled={isSaving || productLoadingId === p.id || !canEditOrDelete}
                          className={`w-8 h-8 inline-flex items-center justify-center rounded-full transition-all ${canEditOrDelete
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed hidden'
                            }`}
                          title="Tahrirlash"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {/* Xil uchun senik chop etish tugmasi */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const variantPrice = item.variant?.price ?? p.price ?? 0;
                            const variantSku = item.variant?.sku || p.sku || '';
                            const variantStock = item.variant?.stock ?? 0;

                            // 5 talik kod olish - MUHIM: code -> catalogNumber -> sku tartibida
                            let variantCode = '';
                            if (item.type === 'variant' && item.variant) {
                              variantCode = (item.variant as any).code || (item.variant as any).catalogNumber || item.variant.sku || '';
                            } else {
                              variantCode = (p as any).code || (p as any).catalogNumber || p.sku || '';
                            }

                            // Senik uchun faqat xilning o'z nomi
                            // item.variant.name - xilning o'z nomi (bazadan)
                            // Agar xil bo'lmasa - mahsulot nomi
                            const variantName = item.type === 'variant' && item.variant
                              ? item.variant.name
                              : p.name;
                            console.log('[Products] Senik chiqarish:', { type: item.type, variantName, variant: item.variant, code: variantCode });
                            setLabelDialogProduct({
                              name: variantName,
                              price: variantPrice,
                              sku: variantSku,
                              stock: variantStock,
                              productId: item.type === 'variant' ? `${p.id}-v${item.variantIndex}` : p.id,
                              code: variantCode // 5 talik kod qo'shamiz
                            } as any);
                            setLabelQuantity(null);
                            setLabelSize('large');
                            setCustomLabelWidth(DEFAULT_LABEL_WIDTH);
                            setCustomLabelHeight(DEFAULT_LABEL_HEIGHT);
                            setUseCustomSize(false);
                            setLabelDialogOpen(true);
                          }}
                          disabled={isPrinting}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-amber-600 hover:bg-amber-500 text-white transition-all"
                          title="Senik chop etish"
                        >
                          <Tag className="w-4 h-4" />
                        </button>

                      </div>
                    </div>
                  );
                }

                // Oddiy mahsulot card
                const isOutOfStock = item.displayStock <= 0;

                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/product/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/product/${p.id}`);
                      }
                    }}
                    className={`group relative flex w-full h-full flex-col rounded-xl border-2 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl overflow-hidden cursor-pointer focus:outline-none focus:ring-2 ${isOutOfStock
                      ? 'border-red-500/70 bg-red-950/20 focus:ring-red-500/60 hover:border-red-400/80'
                      : statusKey === 'tolangan'
                        ? 'border-green-500/70 bg-green-950/20 focus:ring-green-500/60 hover:border-green-400/80 shadow-green-500/20'
                        : 'border-primary/60 bg-card focus:ring-primary/60 hover:border-primary/80'
                      }`}
                  >
                    {/* Content - flex-1 to push actions to bottom */}
                    <div className="p-3 flex-1 flex flex-col">
                      {/* Daromad (mahsulot + xillar daromadi yig'indisi) + Currency */}
                      <div className="flex items-center justify-center gap-1.5 mb-2">
                        <span className="text-xl font-bold text-green-400">
                          {item.daromad.toLocaleString('uz-UZ', { maximumFractionDigits: 2 })}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${p.currency === 'USD' ? 'bg-green-500/20 text-green-400' :
                          p.currency === 'RUB' ? 'bg-purple-500/20 text-purple-400' :
                            p.currency === 'CNY' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-blue-500/20 text-blue-400'
                          }`}>
                          {p.currency === 'USD' ? '$ USD' : p.currency === 'RUB' ? '₽' : p.currency === 'CNY' ? '¥' : 'UZS'}
                        </span>
                      </div>

                      {/* Product name */}
                      <h3 className="text-center text-sm font-semibold text-foreground mb-0.5 leading-tight">
                        {p.name}
                      </h3>

                      {/* Statistika - 3 ta card: Asl narx, Foiz, Sotiladigan narx */}
                      <div className="grid grid-cols-3 gap-1 text-center mb-3">
                        {/* ASL NARX */}
                        <div className="bg-muted/50 rounded-lg p-1.5">
                          <p className="text-[8px] uppercase text-muted-foreground font-medium mb-0.5">ASL NARX</p>
                          <p className="text-[10px] font-bold text-blue-400 truncate">
                            {p.basePrice != null && p.basePrice > 0 ? p.basePrice.toLocaleString('uz-UZ') : '-'}
                          </p>
                        </div>
                        {/* FOIZ */}
                        <div className="bg-gray-800/50 rounded-lg p-1.5">
                          <p className="text-[8px] uppercase text-gray-500 font-medium mb-0.5">FOIZ</p>
                          <p className="text-[10px] font-bold text-green-400 truncate">
                            {p.priceMultiplier != null ? `${p.priceMultiplier}%` : '-'}
                          </p>
                        </div>
                        {/* SOTILADIGAN NARX */}
                        <div className="bg-gray-800/50 rounded-lg p-1.5">
                          <p className="text-[8px] uppercase text-gray-500 font-medium mb-0.5">SOTISH</p>
                          <p className="text-[10px] font-bold text-red-400 truncate">
                            {p.price != null && p.price > 0 ? p.price.toLocaleString('uz-UZ') : '-'}
                          </p>
                        </div>
                      </div>

                      {/* Status badges - mt-auto pushes to bottom of flex container */}
                      <div className="flex gap-1.5 mt-auto">
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          {statusMeta.label}
                        </span>
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-gray-800/50 text-gray-500`}>
                          {salesCount} sotildi
                        </span>
                      </div>
                    </div>

                    {/* Bottom actions - always at bottom */}
                    <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-background/30 gap-2">
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (isSaving) return;

                          setProductLoadingId(p.id);

                          try {
                            let productData: any = p;
                            const detailed = await fetchProductDetails(p.id);
                            if (detailed) {
                              productData = detailed;
                            }

                            setEditingId(productData.id ?? p.id);
                            setShowAddForm(true);
                            setName(productData.name ?? p.name ?? '');
                            setSku(productData.sku ?? p.sku ?? '');
                            setCustomId(productData.customId ?? p.customId ?? ''); // ✅ YANGI: Custom ID ni yuklash

                            const existingPrice =
                              productData.price != null
                                ? String(productData.price)
                                : (p.price != null ? String(p.price) : '');
                            const existingBasePrice =
                              productData.basePrice != null
                                ? String(productData.basePrice)
                                : (p.basePrice != null ? String(p.basePrice) : '');
                            // MUHIM: markupPercentage va priceMultiplier bir xil narsa
                            // Avval markupPercentage ni tekshiramiz, keyin priceMultiplier
                            const existingMarkup = productData.markupPercentage ?? p.markupPercentage;
                            const existingPriceMultiplier = existingMarkup != null
                              ? String(existingMarkup)
                              : (productData.priceMultiplier != null
                                ? String(productData.priceMultiplier)
                                : (p.priceMultiplier != null ? String(p.priceMultiplier) : ''));

                            setPrice(existingPrice);
                            setPriceCurrency(productData.currency || p.currency || 'USD'); // Preserve original currency
                            setBasePrice(existingBasePrice);
                            setPriceMultiplier(existingPriceMultiplier);

                            const stockValue = productData.stock != null ? productData.stock : p.stock;
                            setStock(stockValue != null ? String(stockValue) : '');

                            const hasAutoCalculation = existingBasePrice && existingPriceMultiplier;
                            setIsPriceManuallyEdited(!hasAutoCalculation);
                            setCategoryId(productData.categoryId ?? p.categoryId ?? '');

                            // Load variantSummaries and convert imagePaths to imagePreviews
                            const rawVariants = (productData as any)?.variantSummaries;
                            console.log('[Products] Raw variantSummaries from product:', rawVariants);

                            const loadedVariants = Array.isArray(rawVariants)
                              ? rawVariants.map((v: any) => {
                                const imagePaths = Array.isArray(v.imagePaths) ? v.imagePaths : [];
                                const imagePreviews = imagePaths.map((img: string) => resolveMediaUrl(img));

                                console.log('[Products] Processing variant:', {
                                  name: v.name,
                                  sku: v.sku,
                                  imagePaths: imagePaths,
                                  imagePreviews: imagePreviews
                                });

                                return {
                                  ...v,
                                  images: [], // No File objects for existing images
                                  imagePaths: imagePaths, // Keep original paths
                                  imagePreviews: imagePreviews // Resolved URLs for display
                                };
                              })
                              : [];

                            console.log('[Products] Loading variants for edit:', {
                              productId: p.id,
                              variantsCount: loadedVariants.length,
                              variants: loadedVariants
                            });

                            setVariantSummaries(loadedVariants);

                            // sizesText ni variantSummaries dan yaratish (agar mavjud bo'lsa)
                            // Aks holda sizes arraydan olish
                            if (loadedVariants.length > 0) {
                              const sizesFromVariants = loadedVariants.map((v: any) => {
                                const name = v.name || '';
                                const price = v.price != null ? v.price : '';
                                return price ? `${name}|${price}` : name;
                              }).filter(Boolean);
                              setSizesText(sizesFromVariants.join(', '));
                              console.log('[Products] sizesText from variantSummaries:', sizesFromVariants.join(', '));
                            } else {
                              const sizesSource =
                                Array.isArray(productData.sizes) && productData.sizes.length
                                  ? productData.sizes
                                  : (Array.isArray(p.sizes) ? p.sizes : []);
                              setSizesText(sizesSource.length ? sizesSource.join(', ') : '');
                            }
                            setImageFiles([]);
                            // Barcha rasmlarni yuklash
                            const imagePathSource =
                              productData.imagePaths && Array.isArray(productData.imagePaths) && productData.imagePaths.length > 0
                                ? productData.imagePaths
                                : (Array.isArray(p.imagePaths) ? p.imagePaths : []);
                            const existingImages =
                              imagePathSource.length > 0
                                ? imagePathSource.map((img: string) => resolveMediaUrl(img))
                                : (productData.imageUrl
                                  ? [resolveMediaUrl(productData.imageUrl)]
                                  : (p.imageUrl ? [resolveMediaUrl(p.imageUrl)] : []));
                            setImagePreviews(existingImages);
                            setImageError(null);
                            setRemoveExistingImage(false);
                            // Load video if exists
                            const videoData = (productData as any)?.video ?? (p as any)?.video;
                            if (videoData?.filename) {
                              // Create a mock File object for display purposes
                              const mockVideoFile = new File([], videoData.filename, { type: 'video/mp4' });
                              Object.defineProperty(mockVideoFile, 'size', { value: videoData.size || 0 });
                              setVideoFile(mockVideoFile);
                              // If video has URL, set it as preview
                              if (videoData.url) {
                                setVideoPreviewUrl(videoData.url);
                              } else {
                                setVideoPreviewUrl(null);
                              }
                            } else {
                              setVideoFile(null);
                              setVideoPreviewUrl(null);
                            }
                            setVideoError(null);
                            setProductStatus(normalizeProductStatus(productData.status ?? p.status));
                          } catch (error) {
                            console.error('[Products] Failed to open product for edit:', error);
                            alert('Mahsulot ma\'lumotlarini yuklashda xatolik yuz berdi. Qaytadan urinib ko\'ring.');
                          } finally {
                            setProductLoadingId(null);
                          }
                        }}
                        disabled={isSaving || productLoadingId === p.id || !canEditOrDelete}
                        className={`w-8 h-8 inline-flex items-center justify-center rounded-full transition-all ${canEditOrDelete
                          ? 'bg-blue-600 hover:bg-blue-500 text-white'
                          : 'bg-gray-700 text-gray-500 cursor-not-allowed hidden'
                          }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(p);
                          }}
                          disabled={isSaving}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-red-600 hover:bg-red-500 text-white transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                      {/* Senik chop etish tugmasi */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();

                          // 5 talik kod olish - MUHIM: code -> catalogNumber -> sku tartibida
                          const productCode = (p as any).code || (p as any).catalogNumber || p.sku || '';

                          setLabelDialogProduct({
                            name: p.name,
                            price: p.price ?? 0,
                            sku: p.sku || '',
                            stock: p.stock ?? 0,
                            productId: p.id,
                            code: productCode // 5 talik kod qo'shamiz
                          } as any);
                          setLabelQuantity(null);
                          setLabelSize('large');
                          setCustomLabelWidth(DEFAULT_LABEL_WIDTH);
                          setCustomLabelHeight(DEFAULT_LABEL_HEIGHT);
                          setUseCustomSize(false);
                          setLabelDialogOpen(true);
                        }}
                        disabled={isPrinting}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-amber-600 hover:bg-amber-500 text-white transition-all"
                        title="Senik chop etish"
                      >
                        <Tag className="w-4 h-4" />
                      </button>
                      {/* Mahsulot kodi */}
                      {p.sku && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700/60 border border-slate-600/50">
                          <span className="text-[10px] text-slate-400">#</span>
                          <span className="text-xs font-bold text-slate-200">{p.sku}</span>
                        </div>
                      )}
                      {/* Stock - har bir mahsulot o'z stockini ko'rsatadi */}
                      <div className="ml-auto flex items-center gap-1 text-amber-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span className="text-xs font-bold">
                          {/* MUHIM: Har bir mahsulot o'z stockini ko'rsatadi */}
                          {item.displayStock} dona
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isImageModalOpen && previewImages.length > 0 && (
            <div
              className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 backdrop-blur-sm px-4"
              onClick={handleCloseImageModal}
            >
              <div
                className="relative max-h-[90vh] w-full max-w-4xl"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <button
                  type="button"
                  onClick={handleCloseImageModal}
                  className="absolute -top-4 -right-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-2xl text-white transition shadow-lg z-10"
                >
                  ×
                </button>

                <div className="relative">
                  <img
                    src={previewImages[previewImageIndex]}
                    alt={`Mahsulot rasmi ${previewImageIndex + 1}`}
                    className="max-h-[90vh] w-full rounded-3xl object-contain shadow-2xl"
                  />

                  {previewImages.length > 1 && (
                    <>
                      {/* Oldingi tugma */}
                      <button
                        type="button"
                        onClick={() => setPreviewImageIndex((prev) => (prev - 1 + previewImages.length) % previewImages.length)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg"
                        title="Oldingi rasm"
                      >
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>

                      {/* Keyingi tugma */}
                      <button
                        type="button"
                        onClick={() => setPreviewImageIndex((prev) => (prev + 1) % previewImages.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg"
                        title="Keyingi rasm"
                      >
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      {/* Counter */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/80 text-white text-sm font-semibold shadow-lg">
                        {previewImageIndex + 1} / {previewImages.length}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {isVideoModalOpen && previewVideo && (
            <div
              className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-sm px-4"
              onClick={handleCloseVideoModal}
            >
              <div
                className="relative w-full max-w-4xl bg-gradient-to-br from-gray-800/95 to-gray-900/95 rounded-2xl border-2 border-red-600/40 shadow-2xl shadow-red-900/50 p-6"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <button
                  type="button"
                  onClick={handleCloseVideoModal}
                  className="absolute -top-4 -right-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-2xl text-white transition shadow-lg z-10"
                >
                  ×
                </button>

                <div className="flex flex-col gap-4">
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-2">Mahsulot videosi</h3>
                  </div>

                  {/* Video player */}
                  {previewVideo.url ? (
                    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
                      <video
                        controls
                        autoPlay
                        className="w-full h-full"
                        src={previewVideo.url}
                      >
                        <source src={previewVideo.url} type="video/mp4" />
                        <source src={previewVideo.url} type="video/webm" />
                        <source src={previewVideo.url} type="video/ogg" />
                        Brauzeringiz video o'ynatishni qo'llab-quvvatlamaydi.
                      </video>
                    </div>
                  ) : (
                    <div className="w-full aspect-video bg-card/60 rounded-xl border-2 border-dashed border-primary/30 flex flex-col items-center justify-center gap-4 p-8">
                      <div className="w-20 h-20 rounded-full bg-red-900/30 flex items-center justify-center">
                        <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-400 mb-2">Video fayl nomi:</p>
                        <div className="bg-card/60 border border-primary/30 rounded-xl px-4 py-3 max-w-md mx-auto">
                          <p className="text-sm text-foreground font-mono break-all">{previewVideo.filename}</p>
                        </div>
                        {previewVideo.size && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Hajmi: {(previewVideo.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        )}
                        <p className="text-xs text-yellow-400 mt-4">
                          ⚠️ Video URL mavjud emas. Video faylni serverga yuklash kerak.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Video info */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-card/60 border border-primary/20 rounded-lg px-3 py-2">
                      <p className="text-muted-foreground mb-1">Fayl nomi</p>
                      <p className="text-foreground font-medium truncate">{previewVideo.filename}</p>
                    </div>
                    {previewVideo.size && (
                      <div className="bg-card/60 border border-primary/20 rounded-lg px-3 py-2">
                        <p className="text-muted-foreground mb-1">Hajmi</p>
                        <p className="text-foreground font-medium">{(previewVideo.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {deleteTarget && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60">
              <div className="w-full max-w-sm mx-4 rounded-2xl bg-card border border-destructive/60 shadow-2xl shadow-black/60 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-sm font-bold">
                    !
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-foreground mb-1">Mahsulotni o'chirish</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      "{deleteTarget.name}" mahsulotini o'chirishni rostdan ham xohlaysizmi? Bu amalni qaytarib bo'lmaydi.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => !isDeleting && setDeleteTarget(null)}
                        className="px-3 py-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground text-xs hover:bg-muted transition-all disabled:opacity-60"
                        disabled={isDeleting}
                      >
                        Bekor qilish
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDelete}
                        className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-all disabled:opacity-60"
                        disabled={isDeleting}
                      >
                        {isDeleting ? 'O\'chirilmoqda...' : 'Ha, o\'chirish'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {deleteConfirmOpen && categoryToDelete && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60">
              <div className="w-full max-w-sm mx-4 rounded-2xl bg-card border border-destructive/60 shadow-2xl shadow-black/60 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-sm font-bold">
                    !
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-foreground mb-1">Kategoriyani o'chirish</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Ushbu kategoriyani o'chirishni rostdan ham xohlaysizmi? Bu amalni qaytarib bo'lmaydi.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirmOpen(false);
                          setCategoryToDelete(null);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground text-xs hover:bg-muted transition-all disabled:opacity-60"
                        disabled={createCategoryLoading}
                      >
                        Bekor qilish
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteCategory}
                        className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-all disabled:opacity-60"
                        disabled={createCategoryLoading}
                      >
                        {createCategoryLoading ? 'O\'chirilmoqda...' : 'Ha, o\'chirish'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Variant Modal */}
          <VariantModal
            isOpen={isVariantModalOpen}
            onClose={() => {
              setIsVariantModalOpen(false);
              setEditingVariantIndex(null);
              setEditingVariantInitialData(null);
              // MUHIM: oldProductDataRef ni tozalash emas! Mahsulot tahrirlashda kerak bo'ladi
              // Faqat variant modal state larini tozalash kerak
            }}
            mode={editingVariantIndex != null ? 'edit' : 'create'}
            initialData={editingVariantInitialData}
            productCurrency={priceCurrency}
            exchangeRates={exchangeRates}
            categories={categories}
            recentBasePrices={recentBasePrices}
            onBasePriceUsed={addRecentBasePrice}
            onRemoveBasePrice={removeRecentBasePrice}
            productCategoryId={categoryId}
            onCreateCategory={async (name, parentId) => {
              if (!user?.id) return null;
              try {
                const response = await fetch(`${API_BASE_URL}/api/categories`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name,
                    parentId: parentId || null,
                    userId: user.id,
                  }),
                });
                if (!response.ok) return null;
                const data = await response.json();
                if (data.success && data.category) {
                  const newCategory = {
                    id: data.category.id || data.category._id,
                    name: data.category.name,
                    level: parentId ? (categories.find(c => c.id === parentId)?.level ?? 0) + 1 : 0,
                    parentId: parentId || null,
                  };
                  setCategories(prev => [...prev, newCategory]);
                  return newCategory;
                }
                return null;
              } catch (error) {
                console.error('Error creating category:', error);
                return null;
              }
            }}
            onUpdateCategory={async (id, name) => {
              try {
                const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name }),
                });
                if (response.ok) {
                  // Darhol state'ni yangilaymiz - MUHIM: yangi massiv yaratish
                  setCategories(prev => {
                    const updated = prev.map(c => c.id === id ? { ...c, name } : c);
                    console.log('[Products] Category updated:', id, name);
                    return [...updated]; // Yangi massiv qaytarish - React qayta render qilishi uchun
                  });
                } else {
                  console.error('[Products] Failed to update category:', response.status);
                }
              } catch (error) {
                console.error('Error updating category:', error);
              }
            }}
            onDeleteCategory={async (id) => {
              try {
                const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
                  method: 'DELETE',
                });
                if (response.ok) {
                  setCategories(prev => prev.filter(c => c.id !== id));
                  return true;
                }
                return false;
              } catch (error) {
                console.error('Error deleting category:', error);
                return false;
              }
            }}
            nextSku={(() => {
              // BARCHA mahsulotlar va ularning variantlari SKU larini yig'ib, keyingi SKU ni topamiz
              const allSkus: number[] = [];

              // Barcha mahsulotlarning SKU lari
              products.forEach((p) => {
                if (p.sku) {
                  const skuNum = getSkuNumeric(p.sku);
                  if (skuNum > 0) allSkus.push(skuNum);
                }
                // Mahsulotning barcha variantlari SKU lari
                if (p.variantSummaries && Array.isArray(p.variantSummaries)) {
                  p.variantSummaries.forEach((v: any) => {
                    if (v.sku) {
                      const skuNum = getSkuNumeric(v.sku);
                      if (skuNum > 0) allSkus.push(skuNum);
                    }
                  });
                }
              });

              // MUHIM: Hozirgi formadagi mahsulot SKU si (yangi yoki tahrirlanayotgan)
              if (sku) {
                const skuNum = getSkuNumeric(sku);
                if (skuNum > 0) allSkus.push(skuNum);
              }

              // Hozirgi formadagi variantlar ham (yangi qo'shilganlar)
              variantSummaries.forEach((v) => {
                if (v.sku) {
                  const skuNum = getSkuNumeric(v.sku);
                  if (skuNum > 0) allSkus.push(skuNum);
                }
              });

              // Eng katta SKU ni topib, 1 qo'shamiz
              const maxSku = allSkus.length > 0 ? Math.max(...allSkus) : 0;
              return String(maxSku + 1);
            })()}
            onSave={(variant) => {
              // MUHIM: editingVariantIndex ni saqlab qolish (variant modal yopilganda tozalanadi)
              const currentEditingVariantIndex = editingVariantIndex;

              // Xil ma'lumotlarini sizesText formatida saqlash
              const variantEntry = `${variant.name}|${variant.price}`;
              const existing = sizesText
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

              if (currentEditingVariantIndex != null && currentEditingVariantIndex >= 0 && currentEditingVariantIndex < existing.length) {
                // Mavjud xilni tahrirlash
                existing[currentEditingVariantIndex] = variantEntry;
                setSizesText(existing.join(', '));

                setVariantSummaries((prev) => {
                  const copy = [...prev];
                  const current = copy[currentEditingVariantIndex];
                  if (current) {
                    // Use existingImageUrls from modal (already filtered)
                    const existingUrls = variant.existingImageUrls || [];

                    // Convert URLs to paths
                    const existingPaths = existingUrls.map((url) => {
                      if (url.startsWith('http')) {
                        try {
                          const u = new URL(url);
                          return u.pathname;
                        } catch {
                          return url;
                        }
                      }
                      return url;
                    });

                    console.log('[Products] Updating variant in edit mode:', {
                      index: currentEditingVariantIndex,
                      name: variant.name,
                      sku: variant.sku,
                      existingPaths: existingPaths,
                      newImagesCount: variant.images.length,
                      totalImages: existingPaths.length + variant.images.length
                    });

                    copy[currentEditingVariantIndex] = {
                      ...current,
                      name: variant.name,
                      sku: variant.sku,
                      customId: variant.customId, // ✅ YANGI: Custom ID
                      basePrice: parseFloat(variant.basePrice) || 0,
                      priceMultiplier: parseFloat(variant.priceMultiplier) || 0,
                      price: parseFloat(variant.price) || 0,
                      currency: variant.priceCurrency, // Valyutani ham saqlaymiz
                      categoryId: variant.categoryId, // Kategoriyani ham saqlaymiz
                      stock: parseInt(variant.stock) || 0,
                      status: variant.status,
                      images: variant.images, // NEW File objects to upload
                      imagePaths: existingPaths, // EXISTING server paths to keep
                      imagePreviews: variant.imagePreviews || [], // All previews for display
                    };

                    // Tarixga yozish - xil tahrirlandi
                    // MUHIM: O'zgarishlarni kuzatish
                    let variantChanges: Array<{ field: string; oldValue: any; newValue: any }> = [];
                    if (editingVariantInitialData) {
                      variantChanges = trackProductChanges(editingVariantInitialData, {
                        name: variant.name,
                        sku: variant.sku,
                        price: parseFloat(variant.price) || 0,
                        basePrice: parseFloat(variant.basePrice) || 0,
                        priceMultiplier: parseFloat(variant.priceMultiplier) || 0,
                        stock: parseInt(variant.stock) || 0,
                        currency: variant.priceCurrency || 'USD',
                      });
                    }

                    addToHistory({
                      type: 'variant_update',
                      productId: editingId || '',
                      productName: variant.name || variant.sku || 'Xil',
                      sku: variant.sku || '',
                      stock: parseInt(variant.stock) || 0,
                      price: parseFloat(variant.price) || 0,
                      currency: variant.priceCurrency || 'USD',
                      timestamp: new Date(),
                      message: `Xil tahrirlandi: ${variant.name || variant.sku}`,
                      changes: variantChanges && variantChanges.length > 0 ? variantChanges : [], // O'zgarishlar
                      source: 'manual', // Qo'lda tahrirlangan
                    });
                  }
                  return copy;
                });
              } else {
                // Yangi xil qo'shish
                const next = existing.length ? `${existing.join(', ')}, ${variantEntry}` : variantEntry;
                setSizesText(next);

                console.log('[Products] Creating new variant:', {
                  name: variant.name,
                  sku: variant.sku,
                  customId: variant.customId, // ✅ DEBUG
                  basePrice: variant.basePrice,
                  priceMultiplier: variant.priceMultiplier,
                  imagesCount: variant.images.length,
                  imagePreviewsCount: variant.imagePreviews.length
                });

                const newVariantSummary = {
                  name: variant.name,
                  sku: variant.sku,
                  customId: variant.customId, // ✅ YANGI: Custom ID
                  basePrice: parseFloat(variant.basePrice) || 0,
                  priceMultiplier: parseFloat(variant.priceMultiplier) || 0,
                  price: parseFloat(variant.price) || 0,
                  currency: variant.priceCurrency, // Valyutani ham saqlaymiz
                  categoryId: variant.categoryId, // Kategoriyani ham saqlaymiz
                  stock: parseInt(variant.stock) || 0,
                  status: variant.status,
                  imagePaths: [], // Will be filled after upload
                  images: variant.images, // File objects to upload
                  imagePreviews: variant.imagePreviews || [], // Blob URLs for preview
                };

                console.log('[Products] New variant summary created:', {
                  name: newVariantSummary.name,
                  sku: newVariantSummary.sku,
                  customId: newVariantSummary.customId, // ✅ DEBUG
                  hasCustomId: !!newVariantSummary.customId
                });

                setVariantSummaries((prev) => {
                  const updated = [...prev, newVariantSummary];
                  console.log('[Products] Updated variantSummaries:', updated);
                  return updated;
                });

                // Tarixga yozish - xil qo'shildi
                addToHistory({
                  type: 'variant_create',
                  productId: editingId || '',
                  productName: variant.name || variant.sku || 'Xil',
                  sku: variant.sku || '',
                  stock: parseInt(variant.stock) || 0,
                  price: parseFloat(variant.price) || 0,
                  currency: variant.priceCurrency || 'USD',
                  timestamp: new Date(),
                  message: `Xil qo'shildi: ${variant.name || variant.sku}`,
                  source: 'manual', // Qo'lda qo'shilgan
                });

                console.log('[Products] New variant added to variantSummaries');
              }

              // Modal yopilganda tahrirlash holatini tozalash
              setEditingVariantIndex(null);
              setEditingVariantInitialData(null);
            }}
          />
        </div>
      </div>

      {/* Senik Chop Etish Dialog */}
      <Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
        <DialogContent className="max-w-md bg-slate-900/95 border-slate-700/50 backdrop-blur-xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-slate-200 flex items-center gap-3 text-lg font-bold">
              <Tag className="w-5 h-5 text-amber-400" />
              Senik chop etish
            </DialogTitle>
          </DialogHeader>
          {labelDialogProduct && (
            <div className="space-y-4">
              {/* Mahsulot ma'lumotlari */}
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <div className="text-2xl font-extrabold text-slate-100 mb-3 leading-tight">{labelDialogProduct.name}</div>
                <div className="flex items-center justify-between">
                  <span className="text-purple-400 font-bold text-xl">Kod: {labelDialogProduct.sku || '-'}</span>
                  <span className="text-green-400 font-bold text-base">${labelDialogProduct.price.toLocaleString()}</span>
                </div>
                {(labelDialogProduct as any).code && (
                  <div className="mt-3 text-base text-amber-400 font-semibold">5 talik kod: {(labelDialogProduct as any).code}</div>
                )}
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
                      <div className="text-[9px] opacity-70">XP-365B</div>
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

              {/* Chop etish tugmasi */}
              <Button
                className="w-full h-12 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 rounded-xl text-base font-bold shadow-lg shadow-amber-500/30"
                onClick={async () => {
                  if (!labelDialogProduct) return;

                  setIsPrinting(true);
                  try {
                    // Barcode ID - productId oxirgi 8 ta belgisi
                    const productIdString = typeof labelDialogProduct.productId === 'string' ? labelDialogProduct.productId : labelDialogProduct.productId.toString();
                    const barcodeId = productIdString.slice(-8).toUpperCase();
                    // Barcode qiymati - ID (scanner uchun, Kassa bilan bir xil)
                    const barcode = barcodeId;
                    const labelPrinter = selectedLabelPrinter;
                    const paperWidth = useCustomSize ? customLabelWidth : LABEL_SIZE_CONFIGS[labelSize].width;
                    const paperHeight = useCustomSize ? customLabelHeight : LABEL_SIZE_CONFIGS[labelSize].height;

                    for (let i = 0; i < (labelQuantity || 0); i++) {
                      await printLabel(labelPrinter || 'browser-print', {
                        name: labelDialogProduct.name,
                        price: labelDialogProduct.price,
                        sku: labelDialogProduct.sku,
                        code: (labelDialogProduct as any).code || undefined, // 5 talik kod
                        barcode: barcode,
                        barcodeId: barcodeId,
                        barcodeType: "CODE128",
                        stock: labelDialogProduct.stock,
                        labelSize: useCustomSize ? undefined : labelSize,
                        paperWidth,
                        paperHeight,
                      });
                    }
                    setLabelDialogOpen(false);
                    toast.success(`${labelQuantity} ta senik chop etildi`);
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ommaviy Senik Chop Etish Dialog */}
      <Dialog open={bulkLabelDialogOpen} onOpenChange={setBulkLabelDialogOpen}>
        <DialogContent className="max-w-2xl bg-slate-900/95 border-slate-700/50 backdrop-blur-xl rounded-3xl p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-slate-200 flex items-center gap-3 text-xl font-bold">
              <Tag className="w-6 h-6 text-amber-400" />
              Ommaviy senik chiqarish
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Kod oralig'i */}
            <div className="space-y-3">
              <label className="text-base text-slate-300 font-semibold">Mahsulot kodi oralig'i</label>
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  placeholder="1"
                  value={bulkMinSku}
                  onChange={(e) => setBulkMinSku(e.target.value)}
                  className="flex-1 h-14 px-4 text-lg font-semibold text-center bg-slate-800/80 border-2 border-slate-700/50 rounded-xl text-slate-200 outline-none focus:border-amber-500 focus:bg-slate-800 placeholder:text-slate-500 transition-all"
                />
                <span className="text-slate-400 text-2xl font-bold">→</span>
                <input
                  type="text"
                  placeholder="100"
                  value={bulkMaxSku}
                  onChange={(e) => {
                    const value = e.target.value;
                    setBulkMaxSku(value);

                    // Maksimum kod tekshirish
                    if (value && bulkMinSku) {
                      const minSkuNum = parseInt(bulkMinSku);
                      const maxSkuNum = parseInt(value);

                      if (!isNaN(minSkuNum) && !isNaN(maxSkuNum)) {
                        // Barcha mahsulotlarni olish
                        const allProductsForCheck: string[] = [];
                        products.forEach(p => {
                          if (p.sku) allProductsForCheck.push(p.sku);
                          if (p.variantSummaries) {
                            p.variantSummaries.forEach(v => {
                              if (v.sku) allProductsForCheck.push(v.sku);
                            });
                          }
                        });

                        // Maksimum kodli mahsulot bormi tekshirish
                        const hasMaxSku = allProductsForCheck.some(sku => {
                          const skuNum = parseInt(sku);
                          return !isNaN(skuNum) && skuNum === maxSkuNum;
                        });

                        if (!hasMaxSku) {
                          toast.error(`${maxSkuNum} kodli mahsulot topilmadi`);
                        }
                      }
                    }
                  }}
                  className="flex-1 h-14 px-4 text-lg font-semibold text-center bg-slate-800/80 border-2 border-slate-700/50 rounded-xl text-slate-200 outline-none focus:border-amber-500 focus:bg-slate-800 placeholder:text-slate-500 transition-all"
                />
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Masalan: 1 dan 100 gacha
              </p>
            </div>

            {/* Har bir mahsulotdan nechta senik */}
            <div className="space-y-3">
              <label className="text-base text-slate-300 font-semibold">Har bir mahsulotdan nechta senik?</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setBulkQuantity(Math.max(1, (bulkQuantity || 0) - 1))}
                  className="w-12 h-12 rounded-xl bg-slate-700/80 hover:bg-slate-600/80 text-slate-200 text-xl font-bold transition-all"
                >-</button>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={bulkQuantity ?? ''}
                  placeholder="Soni"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setBulkQuantity(null);
                    } else {
                      const num = parseInt(val);
                      if (!isNaN(num)) {
                        setBulkQuantity(Math.min(100, Math.max(1, num)));
                      }
                    }
                  }}
                  className="flex-1 h-12 text-center text-xl font-bold bg-slate-800/80 border-2 border-slate-700/50 rounded-xl text-slate-200 outline-none focus:border-amber-500 placeholder:text-slate-500"
                />
                <button
                  onClick={() => setBulkQuantity(Math.min(100, (bulkQuantity || 0) + 1))}
                  className="w-12 h-12 rounded-xl bg-slate-700/80 hover:bg-slate-600/80 text-slate-200 text-xl font-bold transition-all"
                >+</button>
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                {bulkQuantity ? `Har bir mahsulotdan ${bulkQuantity} ta senik chiqariladi` : 'Soni kiriting'}
              </p>
            </div>

            {/* Printer tanlash */}
            <div className="space-y-3">
              <label className="text-base text-slate-300 font-semibold">Printer</label>
              <div className="flex gap-3">
                <Select
                  value={selectedLabelPrinter || ""}
                  onValueChange={(value) => {
                    setSelectedLabelPrinter(value);
                    setDefaultLabelPrinterId(value);
                  }}
                >
                  <SelectTrigger className="flex-1 bg-slate-800/80 border-2 border-slate-700/50 text-slate-200 h-12 rounded-xl text-base font-medium hover:border-slate-600 transition-all">
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
                    className="h-12 px-4 border-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500 rounded-xl font-semibold transition-all"
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
            </div>

            {/* Qog'oz o'lchami */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-base text-slate-300 font-semibold">Qog'oz o'lchami (mm)</label>
                <button
                  onClick={() => setBulkUseCustomSize(!bulkUseCustomSize)}
                  className={`text-sm px-3 py-1.5 rounded-lg font-semibold transition-all ${bulkUseCustomSize ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-slate-700/50 text-slate-400 border border-slate-700'}`}
                >
                  {bulkUseCustomSize ? 'Qo\'lda' : 'Tayyor'}
                </button>
              </div>

              {bulkUseCustomSize ? (
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 font-medium mb-1 block">Kenglik</label>
                    <input
                      type="number"
                      min="20"
                      max="100"
                      value={bulkCustomWidth}
                      onChange={(e) => setBulkCustomWidth(Math.max(20, Math.min(100, parseInt(e.target.value) || 40)))}
                      className="w-full h-12 text-center text-xl font-bold bg-slate-800/80 border-2 border-slate-700/50 rounded-xl text-slate-200 outline-none focus:border-amber-500"
                    />
                  </div>
                  <span className="text-slate-500 text-2xl font-bold mt-5">×</span>
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 font-medium mb-1 block">Balandlik</label>
                    <input
                      type="number"
                      min="15"
                      max="100"
                      value={bulkCustomHeight}
                      onChange={(e) => setBulkCustomHeight(Math.max(15, Math.min(100, parseInt(e.target.value) || 30)))}
                      className="w-full h-12 text-center text-xl font-bold bg-slate-800/80 border-2 border-slate-700/50 rounded-xl text-slate-200 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  <button
                    onClick={() => { setBulkLabelSize('mini'); setBulkCustomWidth(20); setBulkCustomHeight(30); }}
                    className={`p-4 rounded-xl border-2 transition-all ${bulkCustomWidth === 20 && bulkCustomHeight === 30 ? 'border-amber-500 bg-amber-500/20 text-amber-400 shadow-lg shadow-amber-500/20' : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}`}
                  >
                    <div className="font-bold text-base">20×30</div>
                    <div className="text-xs opacity-70 mt-1">Mini</div>
                  </button>
                  <button
                    onClick={() => { setBulkLabelSize('small'); setBulkCustomWidth(40); setBulkCustomHeight(30); }}
                    className={`p-4 rounded-xl border-2 transition-all ${bulkCustomWidth === 40 && bulkCustomHeight === 30 ? 'border-amber-500 bg-amber-500/20 text-amber-400 shadow-lg shadow-amber-500/20' : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}`}
                  >
                    <div className="font-bold text-base">40×30</div>
                    <div className="text-xs opacity-70 mt-1">Kichik</div>
                  </button>
                  <button
                    onClick={() => { setBulkLabelSize('medium'); setBulkCustomWidth(57); setBulkCustomHeight(30); }}
                    className={`p-4 rounded-xl border-2 transition-all ${bulkCustomWidth === 57 && bulkCustomHeight === 30 ? 'border-amber-500 bg-amber-500/20 text-amber-400 shadow-lg shadow-amber-500/20' : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}`}
                  >
                    <div className="font-bold text-base">57×30</div>
                    <div className="text-xs opacity-70 mt-1">XP-365B</div>
                  </button>
                  <button
                    onClick={() => { setBulkLabelSize('large'); setBulkCustomWidth(60); setBulkCustomHeight(40); }}
                    className={`p-4 rounded-xl border-2 transition-all ${bulkCustomWidth === 60 && bulkCustomHeight === 40 ? 'border-amber-500 bg-amber-500/20 text-amber-400 shadow-lg shadow-amber-500/20' : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}`}
                  >
                    <div className="font-bold text-base">60×40</div>
                    <div className="text-xs opacity-70 mt-1">Katta</div>
                  </button>
                </div>
              )}
            </div>

            {/* Chop etish tugmasi */}
            <Button
              className="w-full h-14 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 rounded-xl text-lg font-bold shadow-xl shadow-amber-500/30 transition-all hover:shadow-2xl hover:shadow-amber-500/40"
              onClick={async () => {
                if (!bulkMinSku || !bulkMaxSku) {
                  toast.error('Kod oralig\'ini kiriting');
                  return;
                }

                if (!bulkQuantity || bulkQuantity < 1) {
                  toast.error('Soni kiriting');
                  return;
                }

                setIsBulkPrinting(true);
                try {
                  // Barcha mahsulotlarni olish (asosiy mahsulotlar + xillar)
                  const allProductsForPrint: Array<{ product: Product, sku: string, name: string, productId: string, variantIndex?: number, variant?: any }> = [];

                  products.forEach(p => {
                    // Asosiy mahsulot
                    if (p.sku) {
                      allProductsForPrint.push({
                        product: p,
                        sku: p.sku,
                        name: p.name,
                        productId: p.id // To'liq ID
                      });
                    }

                    // Xillar
                    if (p.variantSummaries && p.variantSummaries.length > 0) {
                      p.variantSummaries.forEach((v, index) => {
                        if (v.sku) {
                          allProductsForPrint.push({
                            product: p,
                            sku: v.sku,
                            name: v.name,
                            productId: `${p.id}-v${index}`, // Xil ID
                            variantIndex: index,
                            variant: v // Xil ma'lumotlarini qo'shamiz
                          });
                        }
                      });
                    }
                  });

                  // Kod oralig'idagi mahsulotlarni topish - raqamli taqqoslash
                  const minSkuNum = parseInt(bulkMinSku);
                  const maxSkuNum = parseInt(bulkMaxSku);

                  const filteredProducts = allProductsForPrint.filter(item => {
                    const sku = (item.sku || '').trim();
                    const skuNum = parseInt(sku);

                    // Agar raqam bo'lsa - raqamli taqqoslash
                    if (!isNaN(skuNum) && !isNaN(minSkuNum) && !isNaN(maxSkuNum)) {
                      return skuNum >= minSkuNum && skuNum <= maxSkuNum;
                    }

                    // Aks holda - string taqqoslash
                    return sku >= bulkMinSku && sku <= bulkMaxSku;
                  }).sort((a, b) => {
                    // SKU bo'yicha o'sish tartibida saralash
                    const skuA = (a.sku || '').trim();
                    const skuB = (b.sku || '').trim();

                    // Faqat raqamlardan iborat SKU'larni tekshirish
                    const isNumericA = /^\d+$/.test(skuA);
                    const isNumericB = /^\d+$/.test(skuB);

                    // Agar ikkala SKU ham faqat raqam bo'lsa - raqamli taqqoslash
                    if (isNumericA && isNumericB) {
                      const skuNumA = parseInt(skuA, 10);
                      const skuNumB = parseInt(skuB, 10);
                      return skuNumA - skuNumB;
                    }

                    // Agar biri raqam, biri matn bo'lsa - raqamni birinchi qo'yish
                    if (isNumericA && !isNumericB) {
                      return -1; // A ni birinchi qo'y
                    }
                    if (!isNumericA && isNumericB) {
                      return 1; // B ni birinchi qo'y
                    }

                    // Aks holda - string taqqoslash
                    return skuA.localeCompare(skuB);
                  });

                  if (filteredProducts.length === 0) {
                    toast.error('Bu kod oralig\'ida mahsulot topilmadi');
                    return;
                  }

                  const labelPrinter = selectedLabelPrinter;
                  const paperWidth = bulkUseCustomSize ? bulkCustomWidth : LABEL_SIZE_CONFIGS[bulkLabelSize].width;
                  const paperHeight = bulkUseCustomSize ? bulkCustomHeight : LABEL_SIZE_CONFIGS[bulkLabelSize].height;

                  // Agar haqiqiy printer tanlangan bo'lsa - printLabel ishlatish
                  if (labelPrinter && labelPrinter !== 'browser-print') {
                    let successCount = 0;
                    for (const item of filteredProducts) {
                      // Barcode ID - Kassa bilan bir xil format
                      const productIdString = typeof item.productId === 'string' ? item.productId : item.productId.toString();
                      let barcodeId = productIdString.slice(-8).toUpperCase();

                      if (item.variantIndex !== undefined) {
                        // Xil uchun - chiziqchasiz format
                        const productIdString = typeof item.product.id === 'string' ? item.product.id : item.product.id.toString();
                        const productIdShort = productIdString.slice(-8).toUpperCase();
                        barcodeId = `${productIdShort}V${item.variantIndex}`;
                      }

                      // Barcode qiymati - ID (scanner uchun, Kassa bilan bir xil)
                      const barcode = barcodeId;

                      for (let i = 0; i < bulkQuantity; i++) {
                        try {
                          // MUHIM: code -> catalogNumber -> sku tartibida tekshirish
                          const productCode = (item.product as any).code || (item.product as any).catalogNumber || (item.product as any).sku;
                          const variantCode = (item.variant as any)?.code || (item.variant as any)?.catalogNumber || (item.variant as any)?.sku;
                          const finalCode = variantCode || productCode || undefined;

                          // MUHIM: Xil narxini tekshirish - agar xil bo'lsa, xil narxini ishlatish
                          const productPrice = item.product.price || 0;
                          const variantPrice = item.variant?.price;
                          const finalPrice = variantPrice !== undefined ? variantPrice : productPrice;

                          console.log('[Bulk Label] Item:', item.name, 'Product price:', productPrice, 'Variant price:', variantPrice, 'Final price:', finalPrice);

                          await printLabel(labelPrinter, {
                            name: item.name,
                            price: finalPrice,
                            sku: item.sku,
                            code: finalCode, // 5 talik kod
                            barcode: barcode,
                            barcodeId: barcodeId,
                            barcodeType: "CODE128",
                            stock: item.product.stock || 0,
                            labelSize: bulkUseCustomSize ? undefined : bulkLabelSize,
                            paperWidth,
                            paperHeight,
                          });
                          successCount++;
                        } catch (e) {
                          console.error('[Bulk Label] Failed to print:', item.sku, e);
                        }
                      }
                    }

                    setBulkLabelDialogOpen(false);
                    const totalExpected = filteredProducts.length * bulkQuantity;
                    toast.success(`${successCount}/${totalExpected} ta senik chop etildi`);
                    return;
                  }

                  // Browser print uchun - bitta HTML yaratish
                  let allLabelsHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta charset="UTF-8">
                      <title>Seniklar - ${bulkMinSku} dan ${bulkMaxSku} gacha</title>
                      <style>
                        @page {
                          size: ${paperWidth}mm ${paperHeight}mm;
                          margin: 0;
                        }
                        body {
                          margin: 0;
                          padding: 0;
                          font-family: Arial, sans-serif;
                        }
                        .label {
                          width: ${paperWidth}mm;
                          height: ${paperHeight}mm;
                          page-break-after: always;
                          display: flex;
                          flex-direction: column;
                          align-items: center;
                          justify-content: center;
                          padding: 2mm;
                          box-sizing: border-box;
                        }
                        .label:last-child {
                          page-break-after: auto;
                        }
                        .name {
                          font-size: ${paperHeight > 35 ? '8pt' : '7pt'};
                          font-weight: bold;
                          text-align: center;
                          margin-bottom: 2mm;
                          max-width: 100%;
                          line-height: 1.2;
                          word-wrap: break-word;
                          overflow-wrap: break-word;
                        }
                        .barcode {
                          margin: 1mm 0;
                          max-width: 95%;
                          height: auto;
                        }
                        .barcode-id {
                          font-size: ${paperHeight > 35 ? '10pt' : '9pt'};
                          font-weight: bold;
                          margin-top: 1mm;
                          letter-spacing: 1px;
                        }
                      </style>
                    </head>
                    <body>
                  `;

                  // Har bir mahsulot uchun senik HTML qo'shish
                  for (const item of filteredProducts) {
                    // Barcode ID - Kassa bilan bir xil format
                    // Asosiy mahsulot: productId oxirgi 8 ta belgisi
                    // Xil: {productIdShort}V{variantIndex} (chiziqchasiz)
                    const productIdString = typeof item.productId === 'string' ? item.productId : item.productId.toString();
                    let barcodeId = productIdString.slice(-8).toUpperCase();

                    if (item.variantIndex !== undefined) {
                      // Xil uchun - chiziqchasiz format
                      const productIdString2 = typeof item.product.id === 'string' ? item.product.id : item.product.id.toString();
                      const productIdShort = productIdString2.slice(-8).toUpperCase();
                      barcodeId = `${productIdShort}V${item.variantIndex}`;
                    }

                    // Barcode qiymati - ID (scanner uchun, Kassa bilan bir xil)
                    const barcode = barcodeId;

                    // Nomni to'liq ko'rsatish (kesmaymiz)
                    const displayName = item.name;

                    // Har bir mahsulotdan bulkQuantity ta senik
                    for (let i = 0; i < bulkQuantity; i++) {
                      // MUHIM: code -> catalogNumber -> sku tartibida tekshirish
                      const productCode = (item.product as any).code || (item.product as any).catalogNumber || (item.product as any).sku;
                      const variantCode = (item.variant as any)?.code || (item.variant as any)?.catalogNumber || (item.variant as any)?.sku;
                      const finalCode = variantCode || productCode || undefined;

                      // MUHIM: Xil narxini tekshirish - agar xil bo'lsa, xil narxini ishlatish
                      const productPrice = item.product.price || 0;
                      const variantPrice = item.variant?.price;
                      const finalPrice = variantPrice !== undefined ? variantPrice : productPrice;

                      console.log('[Bulk Label Browser] Item:', item.name, 'Product price:', productPrice, 'Variant price:', variantPrice, 'Final price:', finalPrice);

                      allLabelsHtml += `
                        <div class="label">
                          <div class="name" style="font-weight: bold;"><strong>${displayName}</strong> (${finalPrice.toLocaleString('uz-UZ')})</div>
                          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 1mm;">
                            ${item.sku ? `<div class="barcode-id" style="color: #000;">(${item.sku})</div>` : '<div></div>'}
                            ${finalCode ? `<div class="barcode-id" style="color: #000; font-weight: bold;"><strong>Kod:</strong> ${finalCode}</div>` : '<div></div>'}
                          </div>
                          <svg class="barcode" jsbarcode-value="${barcode}" jsbarcode-format="CODE128" jsbarcode-width="3" jsbarcode-height="${paperHeight > 35 ? '70' : '60'}" jsbarcode-displayvalue="false" jsbarcode-margin="5"></svg>
                          <div class="barcode-id">${barcodeId}</div>
                        </div>
                      `;
                    }
                  }

                  allLabelsHtml += `
                      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                      <script>
                        JsBarcode(".barcode").init();
                        setTimeout(() => {
                          window.print();
                          setTimeout(() => window.close(), 1000);
                        }, 500);
                        window.onafterprint = function() {
                          setTimeout(() => window.close(), 500);
                        };
                      </script>
                    </body>
                    </html>
                  `;

                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    printWindow.document.write(allLabelsHtml);
                    printWindow.document.close();
                  } else {
                    toast.error('Popup blocker ni o\'chiring');
                  }

                  setBulkLabelDialogOpen(false);
                  toast.success(`${filteredProducts.length} ta mahsulot × ${bulkQuantity} = ${filteredProducts.length * bulkQuantity} ta senik tayyor`);
                } catch (e) {
                  console.error("Bulk label print error:", e);
                  toast.error("Senik chop etishda xatolik");
                } finally {
                  setIsBulkPrinting(false);
                }
              }}
              disabled={isBulkPrinting || !bulkMinSku || !bulkMaxSku || !bulkQuantity || bulkQuantity < 1}
            >
              {isBulkPrinting ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Tayyorlanmoqda...</>
              ) : (
                <><Printer className="w-5 h-5 mr-2" />Senik chiqarish ({bulkUseCustomSize ? `${bulkCustomWidth}×${bulkCustomHeight}` : `${LABEL_SIZE_CONFIGS[bulkLabelSize].width}×${LABEL_SIZE_CONFIGS[bulkLabelSize].height}`}mm)</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🆕 Bo'sh Kodlar Dialog */}
      <Dialog open={emptyCodesDialogOpen} onOpenChange={setEmptyCodesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-slate-900/95 border-slate-700/50 backdrop-blur-xl rounded-3xl p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-slate-200 flex items-center gap-3 text-xl font-bold">
              <Search className="w-6 h-6 text-purple-400" />
              Bo'sh Kodlar
            </DialogTitle>
            <p className="text-slate-400 text-sm mt-2">
              O'chirilgan mahsulotlar kodlari. Yangi mahsulot qo'shganda bu kodlarni ishlatishingiz mumkin.
            </p>
          </DialogHeader>

          <div className="space-y-4">
            {emptyCodes.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">✅</div>
                <p className="text-slate-300 text-lg font-semibold">Barcha kodlar band!</p>
                <p className="text-slate-400 text-sm mt-2">Bo'sh kod topilmadi</p>
              </div>
            ) : (
              <>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <div className="text-center">
                    <p className="text-slate-300 font-semibold">Jami bo'sh kodlar:</p>
                    <p className="text-3xl font-bold text-purple-400">{emptyCodes.length} ta</p>
                  </div>
                </div>

                <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700 max-h-96 overflow-y-auto">
                  <div className="grid grid-cols-10 gap-2">
                    {emptyCodes.map((code) => (
                      <div
                        key={code}
                        className="bg-slate-700/50 hover:bg-slate-700 text-slate-200 rounded px-3 py-2 text-center font-mono text-sm transition cursor-pointer"
                        onClick={() => {
                          navigator.clipboard.writeText(String(code));
                          toast.success(`✅ Kod ${code} nusxalandi!`);
                        }}
                        title={`Kod ${code} ni nusxalash`}
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-slate-400 text-xs text-center">
                  💡 Kodga bosing - nusxalanadi
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setEmptyCodesDialogOpen(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600"
            >
              Yopish
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🆕 Excel Export - Kategoriya Tanlash Dialog */}
      <Dialog open={showExportCategoryDialog} onOpenChange={setShowExportCategoryDialog}>
        <DialogContent className="max-w-md bg-slate-900/95 border-slate-700/50 backdrop-blur-xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-100">
              📊 Excel ga Yuklash
            </DialogTitle>
            <p className="text-slate-400 text-sm mt-2">
              Kategoriya tanlang yoki barcha mahsulotlarni yuklang
            </p>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Kategoriya tanlash */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Kategoriya
              </label>
              <Select
                value={selectedExportCategory}
                onValueChange={setSelectedExportCategory}
              >
                <SelectTrigger className="w-full bg-slate-800 border-slate-700 text-slate-200">
                  <SelectValue placeholder="Kategoriya tanlang..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-slate-200">
                    📦 Barcha mahsulotlar
                  </SelectItem>
                  {categories
                    .filter(c => c.level === 0)
                    .map(category => (
                      <SelectItem
                        key={category.id}
                        value={category.id}
                        className="text-slate-200"
                      >
                        📁 {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Statistika */}
            {selectedExportCategory && (
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-slate-400 text-sm">
                  {selectedExportCategory === 'all' ? (
                    <>
                      <span className="text-blue-400 font-bold">{products.length}</span> ta mahsulot yuklanadi
                    </>
                  ) : (
                    <>
                      <span className="text-blue-400 font-bold">
                        {products.filter(p => p.categoryId === selectedExportCategory).length}
                      </span> ta mahsulot yuklanadi
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowExportCategoryDialog(false);
                setSelectedExportCategory('');
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600"
            >
              Bekor qilish
            </Button>
            <Button
              onClick={() => {
                if (!selectedExportCategory) {
                  toast.error('Kategoriya tanlang');
                  return;
                }
                handleExportToExcel(
                  selectedExportCategory === 'all' ? undefined : selectedExportCategory
                );
                setShowExportCategoryDialog(false);
                setSelectedExportCategory('');
              }}
              disabled={!selectedExportCategory}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              📥 Yuklash
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🆕 Tozalash Dialog - 2 ta variant */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="max-w-lg bg-slate-900/95 border-slate-700/50 backdrop-blur-xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-100">
              🗑️ Mahsulotlarni Tozalash
            </DialogTitle>
            <p className="text-slate-400 text-sm mt-2">
              Tozalash turini tanlang
            </p>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Variant 1: To'liq tozalash */}
            <button
              onClick={handleClearAll}
              className="w-full p-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500/30 hover:border-red-500/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Trash2 className="w-6 h-6 text-red-400" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-bold text-red-400">To'liq Tozalash</h3>
                  <p className="text-sm text-slate-400">
                    Barcha {products.length} ta mahsulotni o'chirish
                  </p>
                </div>
              </div>
            </button>

            {/* Variant 2: Kod bo'yicha tozalash */}
            <div className="p-4 rounded-xl bg-orange-500/10 border-2 border-orange-500/30">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-bold text-orange-400">Kod Bo'yicha Tozalash</h3>
                  <p className="text-sm text-slate-400">
                    Kod oralig'idagi mahsulotlarni o'chirish
                  </p>
                </div>
              </div>

              {/* Kod input'lari */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">
                    Minimum Kod
                  </label>
                  <input
                    type="number"
                    value={clearMinCode}
                    onChange={(e) => setClearMinCode(e.target.value)}
                    placeholder="Masalan: 2000"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">
                    Maksimum Kod
                  </label>
                  <input
                    type="number"
                    value={clearMaxCode}
                    onChange={(e) => setClearMaxCode(e.target.value)}
                    placeholder="Masalan: 3000"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Statistika */}
                {clearMinCode && clearMaxCode && (
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs">
                      <span className="text-orange-400 font-bold">
                        {products.filter(p => {
                          const productCode = parseInt(p.sku);

                          // Ota mahsulot kodi oraliqda bo'lsa
                          if (!isNaN(productCode) && productCode >= parseInt(clearMinCode) && productCode <= parseInt(clearMaxCode)) {
                            return true;
                          }

                          // Xillarning kodini tekshirish
                          if (p.variantSummaries && p.variantSummaries.length > 0) {
                            const hasVariantInRange = p.variantSummaries.some(v => {
                              if (!v.sku) return false;
                              const variantCode = parseInt(v.sku);
                              return !isNaN(variantCode) && variantCode >= parseInt(clearMinCode) && variantCode <= parseInt(clearMaxCode);
                            });

                            if (hasVariantInRange) {
                              return true;
                            }
                          }

                          return false;
                        }).length}
                      </span> ta mahsulot (xillar bilan) o'chiriladi
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleClearByCodeRange}
                  disabled={!clearMinCode || !clearMaxCode}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                >
                  🗑️ Kod Bo'yicha O'chirish
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowClearDialog(false);
                setClearMinCode('');
                setClearMaxCode('');
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600"
            >
              Yopish
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <AlertDialog open={confirmModal.open} onOpenChange={(open) => !open && closeConfirmModal()}>
        <AlertDialogContent className="z-[10010]">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmModal.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmModal.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeConfirmModal}>
              {confirmModal.cancelText || 'Bekor qilish'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmModal.onConfirm}
              className={confirmModal.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {confirmModal.confirmText || 'Tasdiqlash'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={showExcelImport}
        onClose={() => setShowExcelImport(false)}
        categories={categories}
        userId={user?.id || ''}
        onImportComplete={async () => {
          // Fix endpoint ni chaqirish - isHidden va userId ni tuzatish
          try {
            await fetch(`${API_BASE_URL}/api/excel-import/fix`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user?.id }),
            });
          } catch (err) {
            console.error('Fix endpoint error:', err);
          }

          // Mahsulotlarni qayta yuklash
          fetch(`${API_BASE_URL}/api/products?userId=${user?.id}&userPhone=${user?.phone || ''}`)
            .then(res => res.json())
            .then(data => {
              if (Array.isArray(data)) {
                setProducts(sortProductsBySku(data.map((p: any) => ({
                  ...p,
                  id: p.id || p._id,
                }))));
              }
            })
            .catch(err => console.error('Failed to reload products:', err));
          toast.success('Mahsulotlar import qilindi');
        }}
      />

      {/* Mobile Bottom Navigation - faqat telefon rejimida ko'rinadi */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[9998] bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 backdrop-blur-sm border-t border-gray-700/50 shadow-2xl">
        <div className="flex items-center justify-around py-4 px-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 hover:text-purple-300 transition-all duration-200 shadow-lg min-w-[60px]"
            title="Mode"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-400 to-purple-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="text-xs font-medium">Mode</span>
          </button>

          {/* Add Button */}
          <button
            onClick={() =>
              setShowAddForm((prev) => {
                const next = !prev;
                if (next) {
                  setEditingId(null);
                  setName('');
                  setCustomId(''); // ✅ YANGI: Custom ID ni tozalash
                  setPrice('');
                  setPriceCurrency('USD');
                  setBasePrice('');
                  setPriceMultiplier('25');
                  setStock('1');
                  setCategoryId('');
                  setSelectedParent(null);
                  setImageFiles([]);
                  setImagePreviews([]);
                  setImageError(null);
                  setVideoFile(null);
                  setVideoError(null);
                  setRemoveExistingImage(false);
                  setSizesText('');
                  setSku(getNextAutoSku(products));
                  setIsCreatingCategory(false);
                  setNewCategoryName('');
                  setCreateCategoryError(null);
                  setProductStatus('available');
                  setIsPriceManuallyEdited(false);
                  setVariantSummaries([]);
                }
                return next;
              })
            }
            className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 transition-all duration-200 shadow-lg min-w-[60px]"
            title="Mahsulot qo'shish"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-red-400 to-red-600 flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium">Qo'shish</span>
          </button>

          {/* Search Button */}
          <button
            onClick={() => {
              // Focus search input or show search modal
              const searchInput = document.querySelector('input[placeholder*="Mahsulot nomi"]') as HTMLInputElement;
              if (searchInput) {
                searchInput.focus();
                searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
            className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 hover:text-blue-300 transition-all duration-200 shadow-lg min-w-[60px]"
            title="Qidirish"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center">
              <Search className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium">Qidirish</span>
          </button>

          {/* History Button */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 hover:text-green-300 transition-all duration-200 shadow-lg min-w-[60px]"
            title="Mahsulot tarixi"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-center">
              <History className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium">Tarix</span>
          </button>
        </div>
      </div>

      {/* Mobile uchun pastki padding - bottom navigation uchun joy */}
      <div className="md:hidden h-20"></div>

      {/* Scroll Button - Sidebar yonida chap tomonda (yashil - sahifa oxiriga) */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => {
              window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: 'smooth'
              });
            }}
            className={`fixed bottom-24 md:bottom-8 z-50 p-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 ${sidebarCollapsed ? 'left-24' : 'left-[21rem]'
              }`}
            style={{
              transition: 'left 0.3s ease-in-out'
            }}
            title="Sahifa oxiriga o'tish"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Scroll Button - O'ng tomonda (qizil - tepaga) */}
      <AnimatePresence>
        {showScrollButton && !isAtTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed right-4 bottom-24 md:bottom-8 z-50 p-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
            title="Tepaga o'tish"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
