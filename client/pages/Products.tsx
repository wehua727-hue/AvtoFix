import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Layout/Header';
import Sidebar from '@/components/Layout/Sidebar';
import ProductStatusSelector, { productStatusConfig, type ProductStatus } from '@/components/ProductStatusSelector';
import { VideoUpload } from '@/components/VideoUpload';
import { useVideoUpload } from '@/hooks/useVideoUpload';
import { Badge } from '@/components/ui/badge';
import CurrencyPriceInput, { type Currency } from '@/components/CurrencyPriceInput';
import VariantModal from '@/components/VariantModal';

interface ProductVariant {
  name: string;
  options: string[];
}

interface Product {
  id: string;
  name: string;
  price: number | null;
  basePrice?: number | null;
  priceMultiplier?: number | null;
  currency?: Currency;
  sku: string;
  categoryId?: string | null;
  stock?: number | null;
  sizes?: string[];
  variants?: ProductVariant[];
  imageUrl?: string | null;
  imagePaths?: string[];
  status?: ProductStatus;
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
}

// API base URL - production va development uchun
const API_BASE_URL = (() => {
  if (typeof window === 'undefined') return '';

  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:5173';
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
    
    // Xillarning SKU lari
    if (Array.isArray(p.variants)) {
      p.variants.forEach((v: any) => {
        if (Array.isArray(v.variantSummaries)) {
          v.variantSummaries.forEach((vs: any) => {
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
    }
    
    // variantSummaries to'g'ridan-to'g'ri mahsulotda
    if (Array.isArray((p as any).variantSummaries)) {
      (p as any).variantSummaries.forEach((vs: any) => {
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

export default function Products() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [priceCurrency, setPriceCurrency] = useState<Currency>('UZS');
  const [basePrice, setBasePrice] = useState('');
  const [priceMultiplier, setPriceMultiplier] = useState('');
  const [stock, setStock] = useState('');
  const [isPriceManuallyEdited, setIsPriceManuallyEdited] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedParent, setSelectedParent] = useState<CategoryOption | null>(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productLoadingId, setProductLoadingId] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  // Use video upload hook
  const videoUpload = useVideoUpload();
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
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [exchangeRates, setExchangeRates] = useState<{ usd: number; rub: number; cny: number } | null>(null);
  const [isLoadingRate, setIsLoadingRate] = useState(false);

  // Convert UZS price back to original currency (same as ProductDetail)
  const convertFromUZS = (uzsPrice: number, currency?: string): number => {
    if (!currency || currency === 'UZS') {
      return uzsPrice;
    }
    
    if (!exchangeRates) {
      return uzsPrice;
    }
    
    const rate = currency === 'USD' ? exchangeRates.usd 
               : currency === 'RUB' ? exchangeRates.rub 
               : currency === 'CNY' ? exchangeRates.cny 
               : 1;
    
    return uzsPrice / rate;
  };
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);
  const [editingVariantInitialData, setEditingVariantInitialData] = useState<any | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [variantSummaries, setVariantSummaries] = useState<any[]>([]);
  const navigate = useNavigate();

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
      // Electron/offline rejimida ham lokal ro'yxatda nomni yangilab, tahrirlash rejimidan chiqamiz
      if (editingCategoryId && editingCategoryName.trim()) {
        setCategories((prev) =>
          prev.map((cat) =>
            cat.id === editingCategoryId ? { ...cat, name: editingCategoryName } : cat,
          ),
        );
        setEditingCategoryId(null);
        setEditingCategoryName('');
      }
      // Foydalanuvchiga alert ko'rsatmaymiz, faqat logda qoladi
    } finally {
      setCreateCategoryLoading(false);
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

  useEffect(() => {
    // Hozircha barcha mahsulotlarni ko'rsatish (keyinroq filtr qo'shamiz)
    const url = `${API_BASE_URL}/api/products`;
    
    setIsLoadingProducts(true);
    fetch(url)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        console.log('[Products] Loaded products:', data.products);
        if (Array.isArray(data?.products)) {
          setProducts(sortProductsBySku(data.products as Product[]));
        }
      })
      .catch((err) => {
        console.error('Failed to load products from API:', err);
      })
      .finally(() => {
        setIsLoadingProducts(false);
      });

    fetch(`${API_BASE_URL}/api/categories`)
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
    
    return () => clearInterval(rateInterval);
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

        // Convert price to UZS based on selected currency
        // Vergulni nuqtaga aylantirish faqat hisoblash uchun
        const numericPrice = price.replace(/,/g, '.');
        let finalPrice = Number(numericPrice) || 0;
        if (priceCurrency !== 'UZS' && finalPrice > 0) {
          try {
            // Fetch exchange rates
            const rateResponse = await fetch(`${API_BASE_URL}/api/currency/rates`);
            if (rateResponse.ok) {
              const rateData = await rateResponse.json();
              if (rateData.success && rateData.rates) {
                const rate = priceCurrency === 'USD' ? rateData.rates.usd 
                           : priceCurrency === 'RUB' ? rateData.rates.rub 
                           : rateData.rates.cny;
                finalPrice = finalPrice * rate;
                console.log(`[Products] Converted ${Number(price)} ${priceCurrency} to ${finalPrice} UZS (rate: ${rate})`);
              }
            }
          } catch (err) {
            console.error('[Products] Failed to fetch exchange rates, using price as-is:', err);
          }
        }

        // Convert basePrice to UZS as well
        // Vergulni nuqtaga aylantirish faqat hisoblash uchun
        const numericBasePrice = basePrice.replace(/,/g, '.');
        let finalBasePrice = Number(numericBasePrice) || 0;
        if (priceCurrency !== 'UZS' && finalBasePrice > 0) {
          try {
            const rateResponse = await fetch(`${API_BASE_URL}/api/currency/rates`);
            if (rateResponse.ok) {
              const rateData = await rateResponse.json();
              if (rateData.success && rateData.rates) {
                const rate = priceCurrency === 'USD' ? rateData.rates.usd 
                           : priceCurrency === 'RUB' ? rateData.rates.rub 
                           : rateData.rates.cny;
                finalBasePrice = finalBasePrice * rate;
                console.log(`[Products] Converted basePrice ${Number(basePrice)} ${priceCurrency} to ${finalBasePrice} UZS (rate: ${rate})`);
              }
            }
          } catch (err) {
            console.error('[Products] Failed to fetch exchange rates for basePrice, using price as-is:', err);
          }
        }

        const payload: any = {
          name: name.trim(),
          sku: sku.trim(),
          price: finalPrice, // Always in UZS (number)
          basePrice: finalBasePrice, // Always in UZS (number)
          priceMultiplier: Number(priceMultiplier) || 0,
          stock: Number(stock) || 0,
          categoryId,
          store: currentStoreId,
          status: productStatus,
          currency: priceCurrency, // Include currency info for reference
          originalPriceString: price, // Asl format (string)
          originalBasePriceString: basePrice, // Asl format (string)
        };
        
        console.log('[Products] Payload to send:', { 
          price: payload.price, 
          basePrice: payload.basePrice, 
          priceMultiplier: payload.priceMultiplier,
          currency: payload.currency,
          originalPrice: price,
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
            let basePrice = typeof v.basePrice === 'number' ? v.basePrice : parseFloat(v.basePrice) || 0;
            const priceMultiplier = typeof v.priceMultiplier === 'number' ? v.priceMultiplier : parseFloat(v.priceMultiplier) || 0;
            let price = typeof v.price === 'number' ? v.price : parseFloat(v.price) || 0;
            const stock = typeof v.stock === 'number' ? v.stock : parseInt(v.stock) || 0;
            const variantCurrency = v.priceCurrency || priceCurrency; // Use variant currency or main product currency

            // Convert variant prices to UZS if needed
            if (variantCurrency !== 'UZS') {
              try {
                const rateResponse = await fetch(`${API_BASE_URL}/api/currency/rates`);
                if (rateResponse.ok) {
                  const rateData = await rateResponse.json();
                  if (rateData.success && rateData.rates) {
                    const rate = variantCurrency === 'USD' ? rateData.rates.usd 
                               : variantCurrency === 'RUB' ? rateData.rates.rub 
                               : rateData.rates.cny;
                    basePrice = basePrice * rate;
                    price = price * rate;
                    console.log(`[Products] Converted variant "${v.name}" prices to UZS (rate: ${rate})`);
                  }
                }
              } catch (err) {
                console.error('[Products] Failed to fetch exchange rates for variant, using prices as-is:', err);
              }
            }

            const variantPayload: any = {
              name: v.name,
              sku: v.sku, // SKU ni ham qo'shamiz
              basePrice: basePrice, // UZS da saqlangan narx
              priceMultiplier: priceMultiplier,
              price: price, // UZS da saqlangan narx
              currency: variantCurrency, // Include currency info
              originalBasePrice: typeof v.basePrice === 'number' ? v.basePrice : parseFloat(v.basePrice) || 0, // Asl valyutadagi narx
              originalPrice: typeof v.price === 'number' ? v.price : parseFloat(v.price) || 0, // Asl valyutadagi narx
              stock: stock,
              status: v.status,
              imagePaths: v.imagePaths || [],
            };

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

        // Video ma'lumotlarini qo'shish
        const videoPayload = await videoUpload.getVideoPayload();
        Object.assign(payload, videoPayload);

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
          alert(`Xatolik: ${errorData.message || 'Ma\'lumotlarni saqlashda xatolik yuz berdi'}`);
          return;
        }

        const data = await res.json();
        if (!data?.success || !data.product) return;

        if (editingId) {
          const updated = data.product as Product;
          console.log('[Products] Updated product:', updated);
          console.log('[Products] Server returned variantSummaries:', (updated as any).variantSummaries);
          
          // Merge server response with local state
          // Server has the final imagePaths (including newly uploaded images)
          // We need to update imagePaths and imagePreviews from server
          if (Array.isArray((updated as any).variantSummaries)) {
            const serverVariants = (updated as any).variantSummaries;
            
            setVariantSummaries((prev) => {
              // Match server variants with local variants by index
              return serverVariants.map((serverV: any, index: number) => {
                const localV = prev[index] || {};
                
                // Use server's imagePaths (this includes newly uploaded images)
                const imagePaths = Array.isArray(serverV.imagePaths) ? serverV.imagePaths : [];
                const imagePreviews = imagePaths.map((p: string) => resolveMediaUrl(p));
                
                console.log(`[Products] Variant ${index} after save:`, {
                  name: serverV.name,
                  imagePathsCount: imagePaths.length,
                  imagePreviewsCount: imagePreviews.length
                });
                
                return {
                  ...serverV, // Use all server data (name, prices, stock, etc.)
                  images: [], // Clear File objects (they're now on server)
                  imagePaths: imagePaths, // Server's final image paths
                  imagePreviews: imagePreviews // Resolved URLs for display
                };
              });
            });
            
            console.log('[Products] Updated variantSummaries from server response');
          }
          
          setProducts((prev) =>
            sortProductsBySku(prev.map((p) => (p.id === updated.id ? updated : p))),
          );
        } else {
          const created = data.product as Product;
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
          
          setProducts((prev) => sortProductsBySku([...prev, created]));
        }

        // Har ikki holatda ham formani tozalaymiz va modalni yopamiz
        setName('');
        setSku('');
        setPrice('');
        setPriceCurrency('UZS');
        setBasePrice('');
        setPriceMultiplier('');
        setStock('');
        setCategoryId('');
        setSelectedParent(null);
        setEditingId(null);
        setShowAddForm(false);
        setImageFiles([]);
        setImagePreviews([]);
        setImageError(null);
        videoUpload.clearAll(); // Use hook method to clear video data
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
      const res = await fetch(`${API_BASE_URL}/api/products/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) {
        setProducts((prev) => sortProductsBySku(prev.filter((x) => x.id !== deleteTarget.id)));
        setDeleteTarget(null);
      }
    } catch (err) {
      console.error('Failed to delete product', err);
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
    <div className="h-screen bg-background text-foreground flex flex-col">
      <Header onMenuClick={() => setSidebarOpen((prev) => !prev)} />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Scrollable content area under fixed navbar */}
      <div
        className={`flex-1 ${showAddForm ? 'overflow-hidden' : 'overflow-y-auto'} pt-24 sm:pt-28 lg:pt-28 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">


          <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold text-foreground">
              Mahsulotlar
            </h1>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:items-center">
              <div className="flex-1 min-w-[220px] sm:min-w-[260px] sm:max-w-md">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="mahsulotni qidirish"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() =>
                    setShowAddForm((prev) => {
                      const next = !prev;
                      if (next) {
                        setEditingId(null);
                        setName('');
                        setPrice('');
                        setPriceCurrency('UZS');
                        setBasePrice('');
                        setPriceMultiplier('');
                        setStock('');
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
                      }
                      return next;
                    })
                  }
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 via-red-700 to-red-600 text-white text-sm font-semibold shadow-lg shadow-red-900/40 hover:from-red-700 hover:via-red-800 hover:to-red-700 transition-all"
                >
                  <span>Mahsulot qo'shish</span>
                </button>
                
                {/* Jami daromad - kichik ko'rinish */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-600/10 to-green-700/10 border border-green-500/20 backdrop-blur-sm">
                  <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-green-300 font-medium">
                    {(() => {
                      // Barcha mahsulotlarning cardda ko'rsatilgan daromadini qo'shish
                      const totalRevenue = products.reduce((sum, p) => {
                        // Har bir mahsulot uchun cardda ko'rsatilgan daromadni hisoblash
                        // (aynan cardda ishlatilgan mantiq)
                        const currency = p.currency || 'UZS';
                        
                        // Asosiy mahsulot daromadi (sotiladigan narx × ombordagi son)
                        const mainPrice = p.price != null ? p.price : 0;
                        const mainStock = p.stock != null ? p.stock : 0;
                        const mainRevenue = mainPrice * mainStock;
                        
                        // Xillar daromadi (sotiladigan narx × ombordagi son)
                        const variantSummaries = (p as any).variantSummaries || [];
                        const variantsRevenue = variantSummaries.reduce((vSum: number, variant: any) => {
                          const variantPrice = variant.price != null ? variant.price : 0;
                          const variantStock = variant.stock != null ? variant.stock : 0;
                          return vSum + (variantPrice * variantStock);
                        }, 0);
                        
                        // Jami daromad (UZS da)
                        const productTotalRevenue = mainRevenue + variantsRevenue;
                        
                        // Barcha narxlar allaqachon UZS da saqlangan, shuning uchun to'g'ridan-to'g'ri qo'shamiz
                        const revenueInUZS = productTotalRevenue;
                        
                        return sum + revenueInUZS;
                      }, 0);
                      
                      // UZS da ko'rsatish (har doim so'm da)
                      const formatted = totalRevenue.toLocaleString('uz-UZ', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      });
                      
                      return `${formatted} so'm`;
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {showAddForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-2 sm:px-4">
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
                        <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border backdrop-blur-sm ${
                          priceCurrency === 'USD' 
                            ? 'bg-gradient-to-r from-green-600/25 via-green-700/25 to-green-600/25 border-green-600/40'
                            : priceCurrency === 'RUB'
                            ? 'bg-gradient-to-r from-purple-600/25 via-purple-700/25 to-purple-600/25 border-purple-600/40'
                            : priceCurrency === 'CNY'
                            ? 'bg-gradient-to-r from-red-600/25 via-red-700/25 to-red-600/25 border-red-600/40'
                            : 'bg-gradient-to-r from-blue-600/25 via-blue-700/25 to-blue-600/25 border-blue-600/40'
                        }`}>
                          <svg className={`w-3.5 h-3.5 flex-shrink-0 ${
                            priceCurrency === 'USD' ? 'text-green-400' 
                            : priceCurrency === 'RUB' ? 'text-purple-400'
                            : priceCurrency === 'CNY' ? 'text-red-400'
                            : 'text-blue-400'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className={`text-[10px] font-bold whitespace-nowrap ${
                            priceCurrency === 'USD' ? 'text-green-300'
                            : priceCurrency === 'RUB' ? 'text-purple-300'
                            : priceCurrency === 'CNY' ? 'text-red-300'
                            : 'text-blue-300'
                          }`}>
                            1 {priceCurrency === 'USD' ? 'USD' : priceCurrency === 'RUB' ? 'RUB' : priceCurrency === 'CNY' ? 'CNY' : 'USD'}
                          </span>
                          <span className={`text-[10px] font-semibold ${
                            priceCurrency === 'USD' ? 'text-green-400'
                            : priceCurrency === 'RUB' ? 'text-purple-400'
                            : priceCurrency === 'CNY' ? 'text-red-400'
                            : 'text-blue-400'
                          }`}>=</span>
                          <span className={`text-[10px] font-extrabold whitespace-nowrap ${
                            priceCurrency === 'USD' ? 'text-green-200'
                            : priceCurrency === 'RUB' ? 'text-purple-200'
                            : priceCurrency === 'CNY' ? 'text-red-200'
                            : 'text-blue-200'
                          }`}>
                            {(priceCurrency === 'USD' ? exchangeRates.usd : priceCurrency === 'RUB' ? exchangeRates.rub : priceCurrency === 'CNY' ? exchangeRates.cny : exchangeRates.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className={`text-[10px] font-bold whitespace-nowrap ${
                            priceCurrency === 'USD' ? 'text-green-300'
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
                      setPrice('');
                      setPriceCurrency('UZS');
                      setBasePrice('');
                      setPriceMultiplier('');
                      setStock('');
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
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition flex-shrink-0 ml-2"
                    disabled={isSaving}
                  >
                    ×
                  </button>
                  </div>

                  <form onSubmit={handleSubmit} className="px-4 sm:px-5 pt-4 pb-4 space-y-4 overflow-y-auto">
                  <div className="space-y-4 pb-1">
                    {/* Nom + SKU - Responsive grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">Mahsulot nomi</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                          placeholder="Masalan: Bolt 15mm"
                          disabled={isSaving}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">SKU / Kod</label>
                        <input
                          type="text"
                          value={sku}
                          onChange={(e) => setSku(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                          placeholder="Masalan: CC-001"
                          disabled={isSaving}
                        />
                      </div>
                    </div>

                    {/* Narx hisob-kitobi - Responsive grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">Asl narxi</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={basePrice}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Faqat raqamlar, nuqta va vergulga ruxsat berish
                            if (/^[0-9.,]*$/.test(value)) {
                              setBasePrice(value);
                              // Asl narx o'zgarsa, agar narx qo'lda o'zgartirilgan bo'lsa foiz qayta hisoblanadi
                              // Aks holda narx qayta hisoblanadi (useEffect orqali)
                            }
                          }}
                          onKeyDown={(e) => {
                            // Raqamlar, nuqta, vergul, backspace, delete, arrow keys, tab ga ruxsat berish
                            const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
                            const isNumber = /^[0-9]$/.test(e.key);
                            const isDecimal = e.key === '.' || e.key === ',';
                            
                            if (!isNumber && !isDecimal && !allowedKeys.includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                          className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                          placeholder="Masalan: 10000"
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
                          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Faqat raqamlar, nuqta va vergulga ruxsat berish
                            if (/^[0-9.,]*$/.test(value)) {
                              setPriceMultiplier(value);
                              setIsPriceManuallyEdited(false); // Foiz o'zgarsa, narx avtomatik hisoblanadi
                            }
                          }}
                          onKeyDown={(e) => {
                            // Raqamlar, nuqta, vergul, backspace, delete, arrow keys, tab ga ruxsat berish
                            const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
                            const isNumber = /^[0-9]$/.test(e.key);
                            const isDecimal = e.key === '.' || e.key === ',';
                            
                            if (!isNumber && !isDecimal && !allowedKeys.includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                          placeholder="Masalan: 10"
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

                    {/* Ombordagi soni - Full width */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">Ombordagi soni</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={stock}
                        onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Faqat raqamlarga ruxsat berish (ombordagi son uchun nuqta va vergul kerak emas)
                          if (/^[0-9]*$/.test(value)) {
                            setStock(value);
                          }
                        }}
                        onKeyDown={(e) => {
                          // Faqat raqamlar, backspace, delete, arrow keys, tab ga ruxsat berish
                          const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
                          const isNumber = /^[0-9]$/.test(e.key);
                          
                          if (!isNumber && !allowedKeys.includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                        placeholder="Masalan: 10"
                        disabled={isSaving}
                      />
                    </div>

                    {/* Status - Pastga tushirildi */}
                    <div>
                      <ProductStatusSelector
                        value={productStatus}
                        onChange={setProductStatus}
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
                                className={`w-full flex items-center gap-2 rounded-xl border text-xs transition-all px-3 py-2 ${
                                  isSelected
                                    ? 'border-primary bg-primary/20 text-primary-foreground'
                                    : 'border-border bg-background text-foreground hover:bg-muted'
                                }`}
                              >
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
                                      className="px-2 py-0.5 rounded-md bg-destructive text-destructive-foreground text-[10px] hover:bg-destructive/90"
                                      disabled={createCategoryLoading}
                                    >
                                      O'chir
                                    </button>
                                  </div>
                                )}
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
                        {/* Saqlangan xillar card ko'rinishida */}
                        {sizesText.trim() ? (
                          <div className="flex flex-wrap gap-2">
                            {sizesText
                              .split(';')
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .map((s, idx) => {
                                const [label, priceRaw] = s.split('|');
                                // Narxni vergul bilan ko'rsatish uchun nuqtani vergulga o'tkazamiz
                                const price = priceRaw ? priceRaw.replace('.', ',') : '';
                                return (
                                  <div
                                    key={`${s}-${idx}`}
                                    className="inline-flex items-center gap-1 rounded-xl bg-muted px-2.5 py-1 border border-border text-[11px] text-foreground shadow-sm"
                                  >
                                    {/* SKU ko'rsatish */}
                                    {variantSummaries[idx]?.sku && (
                                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                        #{variantSummaries[idx].sku}
                                      </span>
                                    )}
                                    <span>{label}</span>
                                    {price && (
                                      <span className="text-[10px] text-muted-foreground ml-1">
                                        {price} {(() => {
                                          const currency = priceCurrency || 'UZS';
                                          if (currency === 'USD') return 'USD';
                                          if (currency === 'RUB') return 'RUB';
                                          if (currency === 'CNY') return 'CNY';
                                          return 'UZS';
                                        })()}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Har doim modal orqali tahrirlash
                                        const v = variantSummaries[idx];

                                        // Legacy sizesText dan label/narxni olish
                                        const arr = sizesText
                                          .split(',')
                                          .map((x) => x.trim())
                                          .filter(Boolean);
                                        const raw = arr[idx] ?? '';
                                        const [lbl, pr] = raw.split('|');

                                        const baseFromVariant = v?.basePrice != null ? Number(v.basePrice) : undefined;
                                        const priceFromVariant = v?.price != null ? Number(v.price) : undefined;
                                        const priceFromText = pr ? Number(pr) : undefined;

                                        setEditingVariantIndex(idx);
                                        
                                        // Get existing images from imagePaths (server URLs)
                                        const existingImagePaths = Array.isArray(v?.imagePaths) ? v.imagePaths : [];
                                        const resolvedImagePreviews = existingImagePaths.map((img: string) => resolveMediaUrl(img));
                                        
                                        console.log('[Products] Opening variant for edit:', {
                                          name: v?.name,
                                          sku: v?.sku,
                                          imagePaths: existingImagePaths,
                                          resolvedPreviews: resolvedImagePreviews
                                        });
                                        
                                        // Get variant currency and convert prices back to original currency for editing
                                        const variantCurrency = v?.currency ?? priceCurrency ?? 'UZS';
                                        
                                        // Use original prices if available, otherwise convert from UZS (for backward compatibility)
                                        // Helper function to format number with comma
                                        const formatWithComma = (num: number): string => {
                                          if (!Number.isFinite(num)) return '';
                                          return num.toString().replace('.', ',');
                                        };
                                        const convertedBasePrice = (() => {
                                          // Agar asl narx mavjud bo'lsa, uni ishlatamiz (konvertatsiya qilmasdan)
                                          if (v?.originalBasePrice != null && Number.isFinite(v.originalBasePrice)) {
                                            console.log('[Products] Using original basePrice for variant:', v.name, v.originalBasePrice);
                                            return formatWithComma(v.originalBasePrice);
                                          }
                                          // Agar asl narx yo'q bo'lsa (eski xillar uchun), UZS dan konvertatsiya qilamiz
                                          console.log('[Products] Converting basePrice from UZS for variant:', v.name);
                                          if (baseFromVariant != null && Number.isFinite(baseFromVariant)) {
                                            const converted = convertFromUZS(baseFromVariant, variantCurrency);
                                            return formatWithComma(converted);
                                          } else if (priceFromText != null && Number.isFinite(priceFromText)) {
                                            const converted = convertFromUZS(priceFromText, variantCurrency);
                                            return formatWithComma(converted);
                                          }
                                          return '';
                                        })();
                                        
                                        const convertedPrice = (() => {
                                          // Agar asl narx mavjud bo'lsa, uni ishlatamiz (konvertatsiya qilmasdan)
                                          if (v?.originalPrice != null && Number.isFinite(v.originalPrice)) {
                                            console.log('[Products] Using original price for variant:', v.name, v.originalPrice);
                                            return formatWithComma(v.originalPrice);
                                          }
                                          // Agar asl narx yo'q bo'lsa (eski xillar uchun), UZS dan konvertatsiya qilamiz
                                          console.log('[Products] Converting price from UZS for variant:', v.name);
                                          if (priceFromVariant != null && Number.isFinite(priceFromVariant)) {
                                            const converted = convertFromUZS(priceFromVariant, variantCurrency);
                                            return formatWithComma(converted);
                                          } else if (priceFromText != null && Number.isFinite(priceFromText)) {
                                            const converted = convertFromUZS(priceFromText, variantCurrency);
                                            return formatWithComma(converted);
                                          }
                                          return '';
                                        })();

                                        setEditingVariantInitialData({
                                          name: (v?.name ?? lbl ?? ''),
                                          sku: v?.sku ?? '',
                                          basePrice: convertedBasePrice,
                                          priceMultiplier: v?.priceMultiplier != null ? formatWithComma(v.priceMultiplier) : '',
                                          price: convertedPrice,
                                          priceCurrency: variantCurrency,
                                          stock: v?.stock != null ? String(v.stock) : (stock || ''),
                                          status: v?.status ?? 'available',
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
                                      onClick={() => {
                                        const arr = sizesText
                                          .split(',')
                                          .map((x) => x.trim())
                                          .filter(Boolean);
                                        arr.splice(idx, 1);
                                        setSizesText(arr.join(', '));
                                        setVariantSummaries((prev) => {
                                          const copy = [...prev];
                                          if (idx >= 0 && idx < copy.length) {
                                            copy.splice(idx, 1);
                                          }
                                          return copy;
                                        });
                                        if (editingSizeIndex === idx) {
                                          setEditingSizeIndex(null);
                                          setSizeDraft('');
                                          setSizePriceDraft('');
                                          setIsAddingSize(false);
                                        }
                                      }}
                                      className="ml-1 px-2 py-1 rounded-lg bg-red-600/90 text-white hover:bg-red-700 text-[11px] sm:text-[10px] shadow-md active:scale-[0.98]"
                                      disabled={isSaving}
                                    >
                                      O'chirish
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
                    {/* Mahsulot rasmlari / videolari */}
                    <div>
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
                        setPrice('');
                        setBasePrice('');
                        setPriceMultiplier('');
                        setStock('');
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
            <div className="flex flex-col items-center justify-center py-20 px-4 rounded-2xl border border-red-600/30 bg-gradient-to-br from-gray-800/80 via-gray-900/80 to-gray-800/80 backdrop-blur-xl">
              <div className="relative group mb-6">
                <div className="absolute inset-0 bg-red-600 rounded-2xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity"></div>
                <div className="relative bg-gradient-to-br from-red-600 via-red-700 to-red-800 p-6 rounded-2xl shadow-2xl">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Hali mahsulotlar yo'q</h3>
              <p className="text-red-500 text-center mb-6 max-w-md">
                Birinchi mahsulotingizni qo'shish uchun yuqoridagi <br /> "Mahsulot qo'shish" tugmasini bosing
              </p>
             
            </div>
          ) : (
            <div
              className={`grid gap-3 sm:gap-4 transition-all ${
                sidebarCollapsed
                  ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
                  : 'grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
              }`}
            >
              {products
                .filter((p) => {
                  if (!search.trim()) return true;
                  const q = search.toLowerCase();
                  return p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q);
                })
                 .map((p) => {
                  const statusKey = normalizeProductStatus(p.status);
                  const statusMeta = productStatusConfig[statusKey];
                  const salesCount = todaySalesMap[p.id] ?? 0;
                  const salesStatus = getStatusForSales(salesCount);

                  const hasVideo = p.video?.filename;
                  
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
                      className="group relative flex w-full h-full flex-col rounded-2xl border border-red-700/40 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 backdrop-blur-sm shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(127,29,29,0.55)] hover:border-red-400/80 overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500/80"
                    >
                      {/* Media section - Image or Video - Only show if media exists */}
                      {(() => {
                        const images = (p as any).imagePaths && Array.isArray((p as any).imagePaths) && (p as any).imagePaths.length > 0 
                          ? (p as any).imagePaths 
                          : (p.imageUrl ? [p.imageUrl] : []);
                        const firstImage = images.length > 0 ? images[0] : null;
                        const hasMedia = firstImage || hasVideo;
                        
                        if (!hasMedia) return null;
                        
                        return (
                          <div 
                            className="relative w-full h-36 sm:h-40 bg-gradient-to-b from-gray-800/90 via-gray-900/95 to-black overflow-hidden"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (images.length > 0) {
                                const resolvedImages = images.map((img: string) => resolveMediaUrl(img));
                                handleImagePreview(resolvedImages[0], resolvedImages);
                              } else if (hasVideo && p.video) {
                                handleVideoPreview(p.video);
                              }
                            }}
                          >
                            {firstImage ? (
                              <div className="relative w-full h-full">
                                <img
                                  src={resolveMediaUrl(firstImage)}
                                  alt={p.name}
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                                {images.length > 1 && (
                                  <div className="absolute top-2 right-2 inline-flex items-center justify-center rounded-full bg-black/70 text-[10px] text-white px-2 py-0.5 border border-white/30">
                                    +{images.length - 1}
                                  </div>
                                )}
                              </div>
                            ) : hasVideo ? (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900/30 to-gray-900/60 group-hover:from-red-900/40 group-hover:to-gray-900/70 transition-all">
                                <div className="text-center">
                                  <div className="relative">
                                    <svg className="w-16 h-16 text-red-400 mx-auto group-hover:text-red-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className="w-12 h-12 rounded-full bg-red-600/80 flex items-center justify-center">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        </svg>
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-gray-400 mt-2 group-hover:text-gray-300 transition-colors">Video mavjud</p>
                                </div>
                              </div>
                            ) : null}
                            
                            {/* Optional quick preview icon (doesn't navigate) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (hasVideo && p.video) {
                                  handleVideoPreview(p.video);
                                } else if (images.length > 0) {
                                  const resolvedImages = images.map((img: string) => resolveMediaUrl(img));
                                  handleImagePreview(resolvedImages[0], resolvedImages);
                                }
                              }}
                              className="absolute bottom-2 right-2 inline-flex items-center justify-center rounded-full bg-black/70 hover:bg-black/90 text-[10px] text-gray-100 px-2.5 py-1 border border-red-400/70 shadow-lg shadow-black/60"
                            >
                              Rasm
                            </button>
                          </div>
                        );
                      })()}

                      {/* Content section */}
                      <div className="px-2.5 pb-2 pt-1.5 flex flex-col flex-1 justify-between gap-1.5 bg-gradient-to-t from-gray-950/95 via-gray-950/90 to-transparent">
                    {/* Total price in header */}
                    <div className="mb-2 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <span className="text-lg font-bold text-red-400">
                          {(() => {
                            const currency = p.currency || 'UZS';
                            
                            // Asosiy mahsulot daromadi (sotiladigan narx × ombordagi son)
                            const mainPrice = p.price != null ? p.price : 0;
                            const mainStock = p.stock != null ? p.stock : 0;
                            const mainRevenue = mainPrice * mainStock;
                            
                            // Barcha xillarning daromadlari yig'indisi (sotiladigan narx × ombordagi son)
                            const variantSummaries = (p as any).variantSummaries || [];
                            const variantsRevenue = variantSummaries.reduce((sum: number, variant: any) => {
                              const variantPrice = variant.price != null ? variant.price : 0;
                              const variantStock = variant.stock != null ? variant.stock : 0;
                              const variantRevenue = variantPrice * variantStock;
                              return sum + variantRevenue;
                            }, 0);
                            
                            // Jami daromad (asosiy mahsulot daromadi + xillar daromadi)
                            const totalRevenue = mainRevenue + variantsRevenue;
                            const convertedTotalRevenue = convertFromUZS(totalRevenue, currency);
                            
                            if (convertedTotalRevenue <= 0) return '0';
                            
                            return convertedTotalRevenue.toLocaleString('uz-UZ', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2
                            });
                          })()}
                        </span>
                        
                        {/* Currency icon and label */}
                        <div className="flex items-center gap-0.5">
                          {(() => {
                            const currency = p.currency || 'UZS';
                            if (currency === 'USD') {
                              return (
                                <>
                                  <svg className="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                                  </svg>
                                  <span className="text-[9px] text-green-400 font-bold">USD</span>
                                </>
                              );
                            } else if (currency === 'RUB') {
                              return (
                                <>
                                  <svg className="w-3.5 h-3.5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14 10.5h-3V9h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zm0-4h-3V5h3c.83 0 1.5.67 1.5 1.5S14.83 7.5 14 7.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2 16h-3v-2H9v-1h2v-2H9v-1h2V9H9V8h2V6h3c1.38 0 2.5 1.12 2.5 2.5 0 .69-.28 1.31-.73 1.76.45.45.73 1.07.73 1.76 0 1.38-1.12 2.5-2.5 2.5z"/>
                                  </svg>
                                  <span className="text-[9px] text-purple-400 font-bold">RUB</span>
                                </>
                              );
                            } else if (currency === 'CNY') {
                              return (
                                <>
                                  <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H11.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h1.33v-1.68c1.72-.3 2.82-1.34 2.82-2.97-.01-2.24-1.85-2.91-4.74-3.21z"/>
                                  </svg>
                                  <span className="text-[9px] text-red-400 font-bold">CNY</span>
                                </>
                              );
                            } else {
                              return (
                                <>
                                  <svg className="w-3.5 h-3.5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                                  </svg>
                                  <span className="text-[9px] text-blue-400 font-bold">UZS</span>
                                </>
                              );
                            }
                          })()}
                        </div>
                      </div>
                      
                      {/* Product name */}
                      <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight">
                        {p.name}
                      </h3>
                      
                      {/* Daromad label */}
                      <p className="text-[10px] text-gray-400 mt-1">Jami daromad</p>
                    </div>

                    {/* Price info - Simple and clean */}
                    <div className="space-y-2 mb-3">
                      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                        <div className="text-center">
                          <div className="text-gray-400 mb-0.5">ASL NARX</div>
                          <div className="font-bold text-blue-400">
                            {(() => {
                              const currency = p.currency || 'UZS';
                              const basePrice = p.basePrice != null ? p.basePrice : 0;
                              const convertedBasePrice = convertFromUZS(basePrice, currency);
                              
                              return convertedBasePrice > 0 
                                ? convertedBasePrice.toLocaleString('uz-UZ', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2
                                  })
                                : '-';
                            })()}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400 mb-0.5">FOIZ</div>
                          <div className="font-bold text-green-400">
                            {p.priceMultiplier != null ? `${p.priceMultiplier}%` : '-'}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400 mb-0.5">SOTISH</div>
                          <div className="font-bold text-red-400">
                            {(() => {
                              const currency = p.currency || 'UZS';
                              const price = p.price != null ? p.price : 0;
                              const convertedPrice = convertFromUZS(price, currency);
                              
                              return convertedPrice > 0 
                                ? convertedPrice.toLocaleString('uz-UZ', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2
                                  })
                                : '-';
                            })()}
                          </div>
                        </div>
                      </div>
                      

                    </div>

                        {/* Status badges */}
                        <div className="flex flex-wrap gap-1 mb-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-gray-800/60 px-2 py-1 text-[9px] font-medium text-gray-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            {statusMeta.label}
                          </span>
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-[9px] font-medium ${salesStatus.color}`}>
                            {salesCount} sotildi
                          </span>
                        </div>

                        {/* Bottom row - Action icons (left) and Stock (right) */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
                          {/* Action icons - Left side */}
                          <div className="flex gap-2">
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

                                  // Get original currency and prices
                                  const originalCurrency = productData.currency || p.currency || 'UZS';
                                  
                                  // For prices, we need to convert back from UZS to original currency for editing
                                  const existingPrice = (() => {
                                    // Avval asl string formatni ishlatishga harakat qilamiz
                                    if (productData.originalPriceString) {
                                      return productData.originalPriceString;
                                    }
                                    // Agar asl format yo'q bo'lsa, konvertatsiya qilamiz (eski mahsulotlar uchun)
                                    if (productData.price != null) {
                                      const convertedPrice = convertFromUZS(productData.price, originalCurrency);
                                      return String(convertedPrice);
                                    } else if (p.price != null) {
                                      const convertedPrice = convertFromUZS(p.price, originalCurrency);
                                      return String(convertedPrice);
                                    }
                                    return '';
                                  })();
                                  
                                  const existingBasePrice = (() => {
                                    // Avval asl string formatni ishlatishga harakat qilamiz
                                    if (productData.originalBasePriceString) {
                                      return productData.originalBasePriceString;
                                    }
                                    // Agar asl format yo'q bo'lsa, konvertatsiya qilamiz (eski mahsulotlar uchun)
                                    if (productData.basePrice != null) {
                                      const convertedBasePrice = convertFromUZS(productData.basePrice, originalCurrency);
                                      return String(convertedBasePrice);
                                    } else if (p.basePrice != null) {
                                      const convertedBasePrice = convertFromUZS(p.basePrice, originalCurrency);
                                      return String(convertedBasePrice);
                                    }
                                    return '';
                                  })();
                                  
                                  const existingPriceMultiplier =
                                    productData.priceMultiplier != null
                                      ? String(productData.priceMultiplier)
                                      : (p.priceMultiplier != null ? String(p.priceMultiplier) : '');

                                  setPrice(existingPrice);
                                  setPriceCurrency(originalCurrency); // Preserve original currency
                                  setBasePrice(existingBasePrice);
                                  setPriceMultiplier(existingPriceMultiplier);

                                  const stockValue = productData.stock != null ? productData.stock : p.stock;
                                  setStock(stockValue != null ? String(stockValue) : '');

                                  const hasAutoCalculation = existingBasePrice && existingPriceMultiplier;
                                  setIsPriceManuallyEdited(!hasAutoCalculation);
                                  setCategoryId(productData.categoryId ?? p.categoryId ?? '');

                                  const sizesSource =
                                    Array.isArray(productData.sizes) && productData.sizes.length
                                      ? productData.sizes
                                      : (Array.isArray(p.sizes) ? p.sizes : []);
                                  setSizesText(sizesSource.length ? sizesSource.join(', ') : '');
                                  
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
                              disabled={isSaving || productLoadingId === p.id}
                              className="w-7 h-7 rounded-full bg-blue-600/80 hover:bg-blue-600 flex items-center justify-center text-white transition-all hover:scale-110"
                              title="Tahrirlash"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(p);
                              }}
                              disabled={isSaving}
                              className="w-7 h-7 rounded-full bg-red-600/80 hover:bg-red-600 flex items-center justify-center text-white transition-all hover:scale-110"
                              title="O'chirish"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          
                          {/* Stock info - Right side */}
                          <div className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <span className="text-[10px] font-bold text-orange-400">
                              {p.stock != null ? p.stock : '-'} dona
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {isImageModalOpen && previewImages.length > 0 && (
            <div
              className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 backdrop-blur-sm px-4"
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
              className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-sm px-4"
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
                    <div className="w-full aspect-video bg-gray-900/60 rounded-xl border-2 border-dashed border-red-600/30 flex flex-col items-center justify-center gap-4 p-8">
                      <div className="w-20 h-20 rounded-full bg-red-900/30 flex items-center justify-center">
                        <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-400 mb-2">Video fayl nomi:</p>
                        <div className="bg-gray-900/60 border border-red-600/30 rounded-xl px-4 py-3 max-w-md mx-auto">
                          <p className="text-sm text-white font-mono break-all">{previewVideo.filename}</p>
                        </div>
                        {previewVideo.size && (
                          <p className="text-xs text-gray-400 mt-2">
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
                    <div className="bg-gray-900/60 border border-red-600/20 rounded-lg px-3 py-2">
                      <p className="text-gray-400 mb-1">Fayl nomi</p>
                      <p className="text-white font-medium truncate">{previewVideo.filename}</p>
                    </div>
                    {previewVideo.size && (
                      <div className="bg-gray-900/60 border border-red-600/20 rounded-lg px-3 py-2">
                        <p className="text-gray-400 mb-1">Hajmi</p>
                        <p className="text-white font-medium">{(previewVideo.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
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
            }}
            mode={editingVariantIndex != null ? 'edit' : 'create'}
            initialData={editingVariantInitialData}
            productCurrency={priceCurrency}
            exchangeRates={exchangeRates}
            nextSku={(() => {
              // Hozirgi mahsulot SKU va barcha variantlar SKU larini yig'ib, keyingi SKU ni topamiz
              const allSkus: number[] = [];
              
              // Mahsulot o'zining SKU si
              if (sku) {
                const skuNum = getSkuNumeric(sku);
                if (skuNum > 0) allSkus.push(skuNum);
              }
              
              // Barcha variantlar SKU lari
              variantSummaries.forEach((v) => {
                if (v.sku) {
                  const skuNum = getSkuNumeric(v.sku);
                  if (skuNum > 0) allSkus.push(skuNum);
                }
              });
              
              // Eng katta SKU ni topib, 1 qo'shamiz
              const maxSku = allSkus.length > 0 ? Math.max(...allSkus) : getSkuNumeric(sku) || 0;
              return String(maxSku + 1);
            })()}
            onSave={(variant) => {
              // Xil ma'lumotlarini sizesText formatida saqlash
              console.log('[Products] Saving variant with data:', {
                name: variant.name,
                basePrice: variant.basePrice,
                priceMultiplier: variant.priceMultiplier,
                price: variant.price,
                priceCurrency: variant.priceCurrency
              });
              
              // Narxni nuqta bilan saqlash (vergul muammosini oldini olish uchun)
              const priceForStorage = variant.price.replace(/,/g, '.');
              const variantEntry = `${variant.name}|${priceForStorage}`;
              console.log('[Products] Created variantEntry:', variantEntry);
              
              // Xillarni ajratish uchun "; " (nuqta-vergul + bo'sh joy) ishlatamiz
              const existing = sizesText
                .split(';')
                .map((s) => s.trim())
                .filter(Boolean);

              if (editingVariantIndex != null && editingVariantIndex >= 0 && editingVariantIndex < existing.length) {
                // Mavjud xilni tahrirlash
                existing[editingVariantIndex] = variantEntry;
                setSizesText(existing.join('; '));

                setVariantSummaries((prev) => {
                  const copy = [...prev];
                  const current = copy[editingVariantIndex];
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
                      index: editingVariantIndex,
                      name: variant.name,
                      sku: variant.sku,
                      existingPaths: existingPaths,
                      newImagesCount: variant.images.length,
                      totalImages: existingPaths.length + variant.images.length
                    });

                    copy[editingVariantIndex] = {
                      ...current,
                      name: variant.name,
                      sku: variant.sku,
                      basePrice: parseFloat(variant.basePrice.replace(/,/g, '.')) || 0,
                      priceMultiplier: parseFloat(variant.priceMultiplier.replace(/,/g, '.')) || 0,
                      price: parseFloat(variant.price.replace(/,/g, '.')) || 0,
                      currency: variant.priceCurrency, // Valyutani ham saqlaymiz
                      stock: parseInt(variant.stock) || 0,
                      status: variant.status,
                      images: variant.images, // NEW File objects to upload
                      imagePaths: existingPaths, // EXISTING server paths to keep
                      imagePreviews: variant.imagePreviews || [], // All previews for display
                    };
                  }
                  return copy;
                });
              } else {
                // Yangi xil qo'shish
                const next = existing.length ? `${existing.join('; ')}; ${variantEntry}` : variantEntry;
                setSizesText(next);

                console.log('[Products] Creating new variant:', {
                  name: variant.name,
                  sku: variant.sku,
                  basePrice: variant.basePrice,
                  priceMultiplier: variant.priceMultiplier,
                  imagesCount: variant.images.length,
                  imagePreviewsCount: variant.imagePreviews.length
                });

                const newVariantSummary = {
                  name: variant.name,
                  sku: variant.sku,
                  basePrice: parseFloat(variant.basePrice.replace(/,/g, '.')) || 0,
                  priceMultiplier: parseFloat(variant.priceMultiplier.replace(/,/g, '.')) || 0,
                  price: parseFloat(variant.price.replace(/,/g, '.')) || 0,
                  currency: variant.priceCurrency, // Valyutani ham saqlaymiz
                  stock: parseInt(variant.stock) || 0,
                  status: variant.status,
                  imagePaths: [], // Will be filled after upload
                  images: variant.images, // File objects to upload
                  imagePreviews: variant.imagePreviews || [], // Blob URLs for preview
                };

                setVariantSummaries((prev) => {
                  const updated = [...prev, newVariantSummary];
                  console.log('[Products] Updated variantSummaries:', updated);
                  return updated;
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
    </div>
  );
}
