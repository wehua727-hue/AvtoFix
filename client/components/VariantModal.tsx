import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ProductStatus } from '@/components/ProductStatusSelector';
import CurrencyPriceInput, { type Currency } from '@/components/CurrencyPriceInput';
import { X, Plus, Trash2, CheckCircle2, Clock, XCircle, ChevronRight, FolderPlus, Pencil, Check, Tag } from 'lucide-react';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'; // ✅ YANGI: Barcode scanner hook

interface CategoryOption {
  id: string;
  name: string;
  level: number;
  parentId?: string | null;
}

interface VariantData {
  name: string;
  sku: string; // Xil uchun alohida SKU/kod
  customId?: string; // ✅ YANGI: Qo'lda kiritilgan ID
  basePrice: string;
  priceMultiplier: string;
  price: string;
  priceCurrency: Currency;
  stock: string;
  status: ProductStatus;
  categoryId?: string; // Xil uchun kategoriya
  images: File[]; // New File objects to upload
  imagePreviews: string[]; // All previews (server URLs + blob URLs)
  existingImageUrls?: string[]; // Existing server URLs to keep
}

interface VariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (variant: VariantData) => void;
  exchangeRates: { usd: number; rub: number; cny: number } | null;
  mode?: 'create' | 'edit';
  initialData?: VariantData | null;
  nextSku?: string; // Keyingi avtomatik SKU
  productCurrency?: Currency; // Mahsulotning pul birligi
  categories?: CategoryOption[]; // Kategoriyalar ro'yxati
  onCreateCategory?: (name: string, parentId?: string) => Promise<CategoryOption | null>; // Kategoriya yaratish
  onUpdateCategory?: (id: string, name: string) => Promise<void>; // Kategoriya tahrirlash
  onDeleteCategory?: (id: string) => Promise<boolean>; // Kategoriya o'chirish
  productCategoryId?: string; // Mahsulotning kategoriyasi (default)
  recentBasePrices?: string[]; // Oxirgi kiritilgan asl narxlar (suggestions uchun)
  onBasePriceUsed?: (price: string) => void; // Asl narx ishlatilganda chaqiriladi
  onRemoveBasePrice?: (price: string) => void; // Asl narxni ro'yxatdan o'chirish
}

export default function VariantModal({
  isOpen,
  onClose,
  onSave,
  exchangeRates,
  mode = 'create',
  initialData,
  nextSku,
  productCurrency,
  categories = [],
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  productCategoryId,
  recentBasePrices = [],
  onBasePriceUsed,
  onRemoveBasePrice
}: VariantModalProps) {

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [customId, setCustomId] = useState(''); // ✅ YANGI: Xil uchun Custom ID
  const [basePrice, setBasePrice] = useState('');
  const [priceMultiplier, setPriceMultiplier] = useState('25');
  const [price, setPrice] = useState('');
  const [priceCurrency, setPriceCurrency] = useState<Currency>('USD');
  const [stock, setStock] = useState('1');
  const [status, setStatus] = useState<ProductStatus>('available');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isPriceManuallyEdited, setIsPriceManuallyEdited] = useState(false);

  // Asl narx suggestions uchun
  const [showBasePriceSuggestions, setShowBasePriceSuggestions] = useState(false);

  // Kategoriya state'lari
  const [categoryId, setCategoryId] = useState('');
  const [selectedParent, setSelectedParent] = useState<CategoryOption | null>(null);
  const [selectedPath, setSelectedPath] = useState<CategoryOption[]>([]);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [createCategoryLoading, setCreateCategoryLoading] = useState(false);
  const [updateCategoryLoading, setUpdateCategoryLoading] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [deleteCategoryLoading, setDeleteCategoryLoading] = useState(false);

  // LOCAL CATEGORIES - props dan nusxa olish va lokal boshqarish
  const [localCategories, setLocalCategories] = useState<CategoryOption[]>([]);

  // Set initial currency when productCurrency changes
  useEffect(() => {
    if (productCurrency) {
      setPriceCurrency(productCurrency);
    }
  }, [productCurrency]);

  // Categories prop o'zgarganda local categories ni yangilash
  useEffect(() => {
    console.log('[VariantModal] Syncing localCategories from props:', categories.length);
    setLocalCategories([...categories]);
  }, [categories]);

  // Reset form when modal opens, or fill with initialData in edit mode
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && initialData) {
      setName(initialData.name ?? '');
      setSku(initialData.sku ?? '');
      setCustomId((initialData as any).customId ?? ''); // ✅ YANGI: Custom ID
      setBasePrice(initialData.basePrice ?? '');
      setPriceMultiplier(initialData.priceMultiplier ?? '25');
      setPrice(initialData.price ?? '');
      setPriceCurrency(initialData.priceCurrency ?? (initialData as any).currency ?? productCurrency ?? 'USD');
      setStock(initialData.stock ?? '');
      setStatus(initialData.status ?? 'available');
      setCategoryId(initialData.categoryId ?? ''); // Faqat xilning o'z kategoriyasi
      setImages(initialData.images ?? []);
      setImagePreviews(initialData.imagePreviews ?? []);
      setImageError(null);
      setIsPriceManuallyEdited(false);
    } else {
      setName('');
      setSku(nextSku ?? ''); // Avtomatik keyingi SKU
      setCustomId(''); // ✅ YANGI: Custom ID tozalash
      setBasePrice('');
      setPriceMultiplier('25');
      setPrice('');
      setPriceCurrency(productCurrency || 'USD'); // Mahsulotning currency sini ishlatish
      setStock('1');
      setStatus('available');
      setCategoryId(''); // Yangi xil uchun kategoriya bo'sh - alohida tanlanadi
      setImages([]);
      setImagePreviews([]);
      setImageError(null);
      setIsPriceManuallyEdited(false);
    }
    // Kategoriya state'larini tozalash
    setSelectedParent(null);
    setSelectedPath([]);
    setIsCreatingCategory(false);
    setNewCategoryName('');
    setEditingCategoryId(null);
    setEditingCategoryName('');
  }, [isOpen, mode, initialData, nextSku, productCategoryId]);

  // CategoryId o'zgarganda path ni to'ldirish
  useEffect(() => {
    if (!categoryId || !localCategories.length) {
      setSelectedPath([]);
      setSelectedParent(null);
      return;
    }

    // Kategoriya path ni qurish
    const buildPath = (catId: string): CategoryOption[] => {
      const path: CategoryOption[] = [];
      let currentId: string | undefined = catId;

      while (currentId) {
        const cat = localCategories.find(c => c.id === currentId);
        if (!cat) break;
        path.unshift(cat); // Boshiga qo'shish
        currentId = cat.parentId || undefined;
      }

      return path;
    };

    const path = buildPath(categoryId);
    setSelectedPath(path);

    // Oxirgi kategoriyani parent qilish
    if (path.length > 0) {
      setSelectedParent(path[path.length - 1]);
    }
  }, [categoryId, localCategories]);

  // Auto-calculate price from basePrice and priceMultiplier
  useEffect(() => {
    if (isPriceManuallyEdited) return;

    const base = parseFloat(basePrice);
    const percent = parseFloat(priceMultiplier);

    if (!base || isNaN(base)) {
      setPrice('');
      return;
    }

    const percentValue = percent || 0;
    const total = base + base * (percentValue / 100);

    if (!isFinite(total)) {
      setPrice('');
      return;
    }

    const formatted = Number.isInteger(total) ? String(total) : total.toFixed(2);
    setPrice(formatted);
  }, [basePrice, priceMultiplier, isPriceManuallyEdited]);

  // Auto-calculate priceMultiplier from price and basePrice
  useEffect(() => {
    if (!isPriceManuallyEdited) return;

    const base = parseFloat(basePrice);
    const finalPrice = parseFloat(price);

    if (!base || base === 0 || !finalPrice || isNaN(base) || isNaN(finalPrice)) {
      return;
    }

    const calculatedPercent = ((finalPrice - base) / base) * 100;

    if (!isFinite(calculatedPercent)) {
      return;
    }

    const formatted = Number.isInteger(calculatedPercent)
      ? String(calculatedPercent)
      : calculatedPercent.toFixed(2);

    setPriceMultiplier(formatted);
  }, [price, basePrice, isPriceManuallyEdited]);

  /* -------------------------------------------------------------------------- */
  /*                             BARCODE SCANNER                                */
  /* -------------------------------------------------------------------------- */

  // Barcode scanner handler
  const handleBarcodeScan = (barcode: string) => {
    // Agar modal ochiq bo'lmasa, ishlamasligi kerak (lekin hook modal ichida, demak modal ochiq)
    if (!isOpen) return;

    // CustomID ni o'rnatish
    setCustomId(barcode.toUpperCase());

    // Vizual effekt
    const input = document.getElementById('variant-custom-id-input');
    if (input) {
      input.focus();
      // Kichik animatsiya yoki border rangi o'zgarishi mumkin
      input.classList.add('ring-2', 'ring-green-500');
      setTimeout(() => input.classList.remove('ring-2', 'ring-green-500'), 1000);
    }
  };

  useBarcodeScanner({
    onScan: handleBarcodeScan,
    minLength: 3,
    scanTimeout: 500,
    enabled: isOpen, // Faqat modal ochiq bo'lganda ishlaydi
    preventDefault: true,
  });

  // Cleanup image previews
  useEffect(() => {
    return () => {
      imagePreviews.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [imagePreviews]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validImages = files.filter((f) => {
      if (!f.type.startsWith('image/')) {
        setImageError('Faqat rasm fayllarini tanlang');
        return false;
      }
      if (f.size > 50 * 1024 * 1024) {
        setImageError(`${f.name} hajmi 50MB dan oshmasligi kerak`);
        return false;
      }
      return true;
    });

    if (validImages.length > 0) {
      setImages((prev) => [...prev, ...validImages]);
      const newPreviews = validImages.map((f) => URL.createObjectURL(f));
      setImagePreviews((prev) => [...prev, ...newPreviews]);
      setImageError(null);
    }
  };

  const handleRemoveImage = (index: number) => {
    const preview = imagePreviews[index];

    // Only revoke blob URLs (new images)
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
      // Remove from images array (File objects)
      setImages((prev) => prev.filter((_, i) => i !== index));
    }

    // Always remove from previews (both server URLs and blob URLs)
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Kategoriya yaratish
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !onCreateCategory) return;

    setCreateCategoryLoading(true);
    try {
      const parentId = selectedParent?.id;
      const newCategory = await onCreateCategory(newCategoryName.trim(), parentId);
      if (newCategory) {
        // LOCAL STATE GA QO'SHISH
        setLocalCategories(prev => [...prev, newCategory]);
        setCategoryId(newCategory.id);
        setIsCreatingCategory(false);
        setNewCategoryName('');
      }
    } catch (error) {
      console.error('Error creating category:', error);
    } finally {
      setCreateCategoryLoading(false);
    }
  };

  // Kategoriya tahrirlash
  const handleSaveCategoryEdit = async () => {
    if (!editingCategoryId || !editingCategoryName.trim() || !onUpdateCategory) return;

    const catId = editingCategoryId;
    const newName = editingCategoryName.trim();

    setUpdateCategoryLoading(true);
    try {
      console.log('[VariantModal] Updating category:', catId, newName);

      // DARHOL LOCAL STATE NI YANGILASH - UI darhol yangilanadi
      setLocalCategories(prev => prev.map(c => c.id === catId ? { ...c, name: newName } : c));

      // Serverga yuborish (background da)
      await onUpdateCategory(catId, newName);
      console.log('[VariantModal] Category updated successfully');

      // Tahrirlash holatini tozalash
      setEditingCategoryId(null);
      setEditingCategoryName('');
    } catch (error) {
      console.error('Error updating category:', error);
      // Xatolik bo'lsa, eski qiymatga qaytarish
      setLocalCategories(prev => prev.map(c => c.id === catId ? { ...c, name: categories.find(cat => cat.id === catId)?.name || c.name } : c));
    } finally {
      setUpdateCategoryLoading(false);
    }
  };

  // Kategoriya o'chirish - modal ochish
  const handleDeleteCategoryClick = (catId: string) => {
    setDeleteCategoryId(catId);
  };

  // Kategoriya o'chirishni tasdiqlash
  const handleConfirmDeleteCategory = async () => {
    if (!deleteCategoryId || !onDeleteCategory) return;

    const catIdToDelete = deleteCategoryId;

    setDeleteCategoryLoading(true);
    try {
      // DARHOL LOCAL STATE DAN O'CHIRISH
      setLocalCategories(prev => prev.filter(c => c.id !== catIdToDelete));

      const success = await onDeleteCategory(catIdToDelete);
      if (success) {
        // Agar o'chirilgan kategoriya tanlangan bo'lsa, tanlovni tozalash
        if (categoryId === catIdToDelete) {
          setCategoryId('');
        }
        // Agar o'chirilgan kategoriya selectedParent bo'lsa, orqaga qaytish
        if (selectedParent?.id === catIdToDelete) {
          const newPath = [...selectedPath];
          newPath.pop();
          setSelectedPath(newPath);
          setSelectedParent(newPath[newPath.length - 1] || null);
        }
      } else {
        // Xatolik bo'lsa, qaytarish
        setLocalCategories(prev => [...prev, ...categories.filter(c => c.id === catIdToDelete)]);
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      // Xatolik bo'lsa, qaytarish
      setLocalCategories(prev => [...prev, ...categories.filter(c => c.id === catIdToDelete)]);
    } finally {
      setDeleteCategoryLoading(false);
      setDeleteCategoryId(null);
    }
  };

  // O'chirishni bekor qilish
  const handleCancelDeleteCategory = () => {
    setDeleteCategoryId(null);
  };

  const handleSave = () => {
    if (!name.trim() || !sku.trim() || !basePrice.trim() || !priceMultiplier.trim() || !stock.trim()) {
      alert('Iltimos, barcha majburiy maydonlarni to\'ldiring');
      return;
    }

    // Asl narxni tarixga saqlash (suggestions uchun)
    if (basePrice.trim()) {
      onBasePriceUsed?.(basePrice.trim());
    }

    // Separate existing URLs from new files
    const existingUrls = imagePreviews.filter(p => !p.startsWith('blob:'));

    onSave({
      name: name.trim(),
      sku: sku.trim(),
      customId: customId.trim() || undefined, // ✅ YANGI: Custom ID
      basePrice,
      priceMultiplier,
      price,
      priceCurrency,
      stock,
      status,
      categoryId: categoryId || undefined,
      images, // New File objects
      imagePreviews, // All previews
      existingImageUrls: existingUrls, // Existing server URLs
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm px-2 sm:px-4">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-full sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-2 sm:mx-4 rounded-2xl border border-border bg-card text-card-foreground shadow-2xl shadow-black/70 flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-5 pt-3 pb-2 border-b border-border bg-muted rounded-t-2xl">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3 mb-1">
                <h2 className="text-base sm:text-lg font-semibold truncate text-foreground">
                  {mode === 'edit' ? "Xilni tahrirlash" : "Xil qo'shish"}
                </h2>

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
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {mode === 'edit' ? "Xil ma'lumotlarini tahrirlang" : "Xil ma'lumotlarini kiriting"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition flex-shrink-0 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 pt-5 pb-4 space-y-5 overflow-y-auto">
            {/* Xil nomi va SKU - Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Xil nomi */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">
                  Xil nomi <span className="text-destructive">*</span>
                </label>
                <div className="relative flex gap-2">
                  <input
                    id="variant-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('variant-baseprice-input')?.focus();
                      }
                    }}
                    className="flex-1 px-4 py-3 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                    placeholder="Masalan: Qizil, Katta, 15mm"
                  />
                  {/* Lotin → Kiril tugmasi */}
                  {name && /[a-zA-Z]/.test(name.trim().split(/[\s\-\.]+/)[0] || '') && (
                    <button
                      type="button"
                      onClick={() => {
                        // Lotin → Kiril konvertatsiya
                        const map: Record<string, string> = {
                          'A': 'А', 'B': 'Б', 'D': 'Д', 'E': 'Е', 'F': 'Ф', 'G': 'Г', 'H': 'Ҳ',
                          'I': 'И', 'J': 'Ж', 'K': 'К', 'L': 'Л', 'M': 'М', 'N': 'Н', 'O': 'О',
                          'P': 'П', 'Q': 'Қ', 'R': 'Р', 'S': 'С', 'T': 'Т', 'U': 'У', 'V': 'В',
                          'X': 'Х', 'Y': 'Й', 'Z': 'З',
                          'a': 'а', 'b': 'б', 'd': 'д', 'e': 'е', 'f': 'ф', 'g': 'г', 'h': 'ҳ',
                          'i': 'и', 'j': 'ж', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о',
                          'p': 'п', 'q': 'қ', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у', 'v': 'в',
                          'x': 'х', 'y': 'й', 'z': 'з',
                        };
                        const digraphs: Record<string, string> = {
                          'Sh': 'Ш', 'SH': 'Ш', 'Ch': 'Ч', 'CH': 'Ч',
                          'sh': 'ш', 'ch': 'ч',
                        };
                        
                        let result = '';
                        let i = 0;
                        const text = name;
                        
                        while (i < text.length) {
                          let converted = false;
                          
                          if (i < text.length - 1) {
                            const twoChar = text.substring(i, i + 2);
                            if (digraphs[twoChar]) {
                              result += digraphs[twoChar];
                              i += 2;
                              converted = true;
                            }
                          }
                          
                          if (!converted) {
                            const oneChar = text[i];
                            result += map[oneChar] || oneChar;
                            i++;
                          }
                        }
                        
                        setName(result);
                      }}
                      className="px-3 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-medium transition-all flex items-center gap-1 whitespace-nowrap"
                      title="Lotindan kirilga o'girish"
                    >
                      <span>🔤</span>
                      <span className="hidden sm:inline">Kiril</span>
                    </button>
                  )}
                </div>
              </div>

              {/* SKU / Kod */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">
                  SKU / Kod <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                  placeholder="Masalan: 2"
                />
              </div>
            </div>

            {/* Custom ID - Qo'lda kiritilgan ID */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                Custom ID
                <span className="text-xs font-normal text-muted-foreground">(ixtiyoriy)</span>
              </label>
              <input
                id="variant-custom-id-input" // ✅ ID qo'shildi
                type="text"
                value={customId}
                onChange={(e) => setCustomId(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  // ✅ YANGI: Enter tugmasini bloklash (scanner uchun)
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    // Focus ni keyingi input ga o'tkazish
                    document.getElementById('variant-baseprice-input')?.focus();
                  }
                }}
                className="w-full px-4 py-3 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                placeholder="Masalan: 98F3C471"
              />
              <p className="text-xs text-muted-foreground">
                Eski senik yopishtirgan mahsulotni qayta qo'shganda, eski ID ni bu yerga kiriting
              </p>
            </div>

            {/* Narx ma'lumotlari - Card */}
            <div className="rounded-2xl border border-border bg-muted/30 p-4 sm:p-5 space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Narx hisob-kitobi
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Asl narxi */}
                <div className="space-y-2 relative">
                  <label className="block text-xs font-semibold text-foreground">
                    Asl narxi <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="variant-baseprice-input"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    onFocus={() => setShowBasePriceSuggestions(true)}
                    onBlur={() => {
                      // Kichik kechikish - suggestion bosilishini kutish
                      setTimeout(() => setShowBasePriceSuggestions(false), 150);
                    }}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('variant-stock-input')?.focus();
                      }
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                    placeholder="10000"
                  />

                  {/* Asl narx suggestions dropdown */}
                  {showBasePriceSuggestions && recentBasePrices.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-40 overflow-y-auto">
                      <div className="p-1.5">
                        <p className="text-[10px] text-muted-foreground px-2 py-1">Oxirgi narxlar:</p>
                        {recentBasePrices.slice(0, 10).map((priceItem, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1 hover:bg-muted rounded-lg transition-colors"
                          >
                            {/* X tugmasi - o'chirish */}
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onRemoveBasePrice?.(priceItem);
                              }}
                              className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            {/* Narx tanlash */}
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setBasePrice(priceItem);
                                onBasePriceUsed?.(priceItem);
                                setShowBasePriceSuggestions(false);
                              }}
                              className="flex-1 text-left px-2 py-2 text-sm flex items-center justify-between"
                            >
                              <span className="font-medium">{priceItem}</span>
                              <span className="text-[10px] text-muted-foreground">tanlash</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Foizi */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-foreground">
                    Foizi (%) <span className="text-destructive">*</span>
                    {!isPriceManuallyEdited && (
                      <span className="ml-2 text-[10px] font-normal text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">avtomatik</span>
                    )}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={priceMultiplier}
                    onChange={(e) => {
                      setPriceMultiplier(e.target.value);
                      setIsPriceManuallyEdited(false);
                    }}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                    className="w-full px-4 py-3 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                    placeholder="10"
                  />
                </div>
              </div>

              {/* Sotiladigan narxi - Full width in card */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <CurrencyPriceInput
                  value={price}
                  onChange={(newPrice, currency) => {
                    setPrice(newPrice);
                    setPriceCurrency(currency);
                    setIsPriceManuallyEdited(true);
                  }}
                  initialCurrency={priceCurrency}
                  label="Sotiladigan narxi"
                  className="w-full"
                />
              </div>
            </div>

            {/* Ombordagi soni */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                Ombordagi soni <span className="text-destructive">*</span>
              </label>
              <input
                id="variant-stock-input"
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    // Enter bosilganda hech narsa qilmasin
                  }
                }}
                className="w-full px-4 py-3 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                placeholder="10"
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                Mahsulot statusi <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProductStatus)}
                  className="w-full px-4 py-3 pr-10 rounded-xl bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all appearance-none cursor-pointer"
                >
                  <option value="available" className="flex items-center gap-2">
                    ✅ Yangi
                  </option>
                  <option value="pending" className="flex items-center gap-2">
                    ⏱️ O'rtacha
                  </option>
                  <option value="out-of-stock" className="flex items-center gap-2">
                    ❌ Eski
                  </option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Status preview */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
                {status === 'available' && (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-foreground">Yangi yoki deyarli ishlatilmagan mahsulot</span>
                  </>
                )}
                {status === 'pending' && (
                  <>
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-foreground">O'rtacha holatda, normal ishlatilgan mahsulot</span>
                  </>
                )}
                {status === 'out-of-stock' && (
                  <>
                    <XCircle className="w-4 h-4 text-orange-500" />
                    <span className="text-xs text-foreground">Eski yoki ko'proq ishlatilgan mahsulot</span>
                  </>
                )}
              </div>
            </div>

            {/* Kategoriya tanlash */}
            {localCategories.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">
                  Kategoriya
                </label>
                <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2 max-h-48 overflow-y-auto">
                  {/* Tanlangan kategoriya */}
                  <p className="text-xs text-muted-foreground">
                    Tanlangan:
                    <span className="ml-1 font-semibold text-foreground">
                      {categoryId
                        ? localCategories.find((c) => c.id === categoryId)?.name ?? 'Tanlanmagan'
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
                        className="ml-2 text-destructive hover:underline text-[10px]"
                      >
                        Tozalash
                      </button>
                    )}
                  </p>

                  {/* Kategoriyalar ro'yxati */}
                  <div className="space-y-1">
                    {(selectedParent
                      ? localCategories.filter((c) => c.parentId === selectedParent.id)
                      : localCategories.filter((c) => !c.parentId)
                    ).map((c) => {
                      const isSelected = categoryId === c.id;
                      const isEditing = editingCategoryId === c.id;
                      const hasChildren = localCategories.some((cat) => cat.parentId === c.id);

                      return (
                        <div
                          key={c.id}
                          className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${isSelected
                              ? 'bg-primary/20 border border-primary/40'
                              : 'hover:bg-muted border border-transparent'
                            }`}
                        >
                          {isEditing ? (
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                type="text"
                                value={editingCategoryName}
                                onChange={(e) => setEditingCategoryName(e.target.value)}
                                className="flex-1 px-2 py-1 rounded bg-background border border-input text-xs"
                                autoFocus
                                disabled={updateCategoryLoading}
                              />
                              <button
                                type="button"
                                onClick={handleSaveCategoryEdit}
                                disabled={updateCategoryLoading || !editingCategoryName.trim()}
                                className="p-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
                              >
                                {updateCategoryLoading ? (
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategoryId(null);
                                  setEditingCategoryName('');
                                }}
                                disabled={updateCategoryLoading}
                                className="p-1 rounded bg-muted text-muted-foreground disabled:opacity-50"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div
                                className="flex-1 flex items-center gap-2"
                                onClick={() => {
                                  // Har doim tanlaymiz
                                  setCategoryId(c.id);
                                  // Ichki kategoriyalari bo'lsa, ichiga kiramiz
                                  if (hasChildren) {
                                    setSelectedParent(c);
                                    setSelectedPath((prev) => [...prev, c]);
                                  }
                                }}
                              >
                                <span className="text-xs font-medium text-foreground">{c.name}</span>
                                {hasChildren && (
                                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                )}
                              </div>
                              {/* Ichiga kirish tugmasi - ichki kategoriya qo'shish uchun */}
                              {!hasChildren && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCategoryId(c.id);
                                    setSelectedParent(c);
                                    setSelectedPath((prev) => [...prev, c]);
                                  }}
                                  className="p-1 rounded hover:bg-muted"
                                  title="Ichiga kirish"
                                >
                                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                </button>
                              )}
                              <div className="flex items-center gap-1">
                                {onUpdateCategory && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCategoryId(c.id);
                                      setEditingCategoryName(c.name);
                                    }}
                                    className="p-1 rounded hover:bg-muted"
                                    title="Tahrirlash"
                                  >
                                    <Pencil className="w-3 h-3 text-muted-foreground" />
                                  </button>
                                )}
                                {onDeleteCategory && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteCategoryClick(c.id);
                                    }}
                                    className="p-1 rounded hover:bg-destructive/20"
                                    title="O'chirish"
                                  >
                                    <Trash2 className="w-3 h-3 text-destructive" />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Orqaga tugmasi */}
                  {selectedParent && (
                    <button
                      type="button"
                      onClick={() => {
                        const newPath = [...selectedPath];
                        newPath.pop();
                        setSelectedPath(newPath);
                        setSelectedParent(newPath[newPath.length - 1] || null);
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      ← Orqaga
                    </button>
                  )}

                  {/* Yangi kategoriya qo'shish */}
                  {onCreateCategory && (
                    <div className="pt-2 border-t border-border">
                      {isCreatingCategory ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Kategoriya nomi"
                            className="flex-1 px-2 py-1.5 rounded-lg bg-background border border-input text-xs"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleCreateCategory}
                            disabled={createCategoryLoading || !newCategoryName.trim()}
                            className="px-2 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs disabled:opacity-50"
                          >
                            {createCategoryLoading ? '...' : 'Qo\'shish'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingCategory(false);
                              setNewCategoryName('');
                            }}
                            className="p-1.5 rounded-lg bg-muted text-muted-foreground"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsCreatingCategory(true)}
                          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                        >
                          <FolderPlus className="w-3 h-3" />
                          {selectedParent ? 'Ichki kategoriya qo\'shish' : 'Kategoriya qo\'shish'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rasmlar - DISABLED */}
            <div className="space-y-3 hidden">
              <label className="block text-sm font-semibold text-foreground flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Rasmlar
                <span className="text-xs font-normal text-muted-foreground">(cheksiz)</span>
              </label>

              {/* Image previews */}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-border bg-muted hover:border-primary transition-colors">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-destructive text-destructive-foreground opacity-100 shadow-lg hover:scale-110 transform"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              <div
                className="w-full border-2 border-dashed border-border rounded-xl bg-muted/50 px-4 py-6 sm:py-8 flex items-center justify-center text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group"
                onClick={() => {
                  const input = document.getElementById('variant-images-input') as HTMLInputElement | null;
                  input?.click();
                }}
              >
                <input
                  id="variant-images-input"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Plus className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Rasm qo'shish</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      PNG, JPG, WEBP
                    </p>
                  </div>
                </div>
              </div>

              {imageError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <svg className="w-4 h-4 text-destructive flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-destructive font-medium">{imageError}</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between sm:justify-end gap-3 px-4 sm:px-6 py-4 border-t border-border bg-muted/50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-medium hover:bg-muted hover:border-primary/50 transition-all"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-red-700 to-red-600 text-white text-sm font-semibold shadow-lg shadow-red-900/40 hover:from-red-700 hover:via-red-800 hover:to-red-700 hover:shadow-xl hover:shadow-red-900/50 transition-all"
            >
              Saqlash
            </button>
          </div>
        </motion.div>

        {/* Kategoriya o'chirish tasdiqlash modali */}
        {deleteCategoryId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
            onClick={handleCancelDeleteCategory}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 max-w-sm mx-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Kategoriyani o'chirish</h3>
                  <p className="text-sm text-muted-foreground">
                    "{categories.find(c => c.id === deleteCategoryId)?.name}" kategoriyasini o'chirasizmi?
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelDeleteCategory}
                  disabled={deleteCategoryLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-all disabled:opacity-50"
                >
                  Yo'q
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCategory}
                  disabled={deleteCategoryLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-all disabled:opacity-50"
                >
                  {deleteCategoryLoading ? 'O\'chirilmoqda...' : 'Ha, o\'chirish'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
