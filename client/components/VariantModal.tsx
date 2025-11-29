import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ProductStatus } from '@/components/ProductStatusSelector';
import CurrencyPriceInput, { type Currency } from '@/components/CurrencyPriceInput';
import { X, Plus, Trash2, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface CategoryOption {
  id: string;
  name: string;
  level: number;
  parentId?: string | null;
}

interface VariantData {
  name: string;
  sku: string; // Xil uchun alohida SKU/kod
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
  onCreateCategory?: (name: string, parentId?: string) => Promise<CategoryOption>; // Kategoriya yaratish funksiyasi
  onEditCategory?: (categoryId: string, newName: string) => Promise<void>; // Kategoriya tahrirlash
  onDeleteCategory?: (categoryId: string) => Promise<void>; // Kategoriya o'chirish
}

export default function VariantModal({ isOpen, onClose, onSave, exchangeRates, mode = 'create', initialData, nextSku, productCurrency, categories = [], onCreateCategory, onEditCategory, onDeleteCategory }: VariantModalProps) {
  
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [priceMultiplier, setPriceMultiplier] = useState('');
  const [price, setPrice] = useState('');
  const [priceCurrency, setPriceCurrency] = useState<Currency>('UZS');
  const [stock, setStock] = useState('');
  const [status, setStatus] = useState<ProductStatus>('available');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isPriceManuallyEdited, setIsPriceManuallyEdited] = useState(false);
  
  // Kategoriya state lari
  const [categoryId, setCategoryId] = useState('');
  const [selectedParent, setSelectedParent] = useState<CategoryOption | null>(null);
  const [selectedPath, setSelectedPath] = useState<CategoryOption[]>([]);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [createCategoryLoading, setCreateCategoryLoading] = useState(false);
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(null);
  
  // Kategoriya tahrirlash state lari
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  // Set initial currency when productCurrency changes
  useEffect(() => {
    if (productCurrency) {
      setPriceCurrency(productCurrency);
    }
  }, [productCurrency]);

  // Reset form when modal opens, or fill with initialData in edit mode
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && initialData) {
      setName(initialData.name ?? '');
      setSku(initialData.sku ?? '');
      setBasePrice(initialData.basePrice ?? '');
      setPriceMultiplier(initialData.priceMultiplier ?? '');
      setPrice(initialData.price ?? '');
      setPriceCurrency(initialData.priceCurrency ?? 'UZS');
      setStock(initialData.stock ?? '');
      setStatus(initialData.status ?? 'available');
      setCategoryId(initialData.categoryId ?? '');
      setImages(initialData.images ?? []);
      setImagePreviews(initialData.imagePreviews ?? []);
      setImageError(null);
      setIsPriceManuallyEdited(false);
      // Kategoriya state larini reset qilish
      setSelectedParent(null);
      setSelectedPath([]);
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setCreateCategoryError(null);
    } else {
      setName('');
      setSku(nextSku ?? ''); // Avtomatik keyingi SKU
      setBasePrice('');
      setPriceMultiplier('');
      setPrice('');
      setPriceCurrency(productCurrency || 'UZS'); // Mahsulotning currency sini ishlatish
      setStock('');
      setStatus('available');
      setCategoryId('');
      setImages([]);
      setImagePreviews([]);
      setImageError(null);
      setIsPriceManuallyEdited(false);
      // Kategoriya state larini reset qilish
      setSelectedParent(null);
      setSelectedPath([]);
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setCreateCategoryError(null);
    }
  }, [isOpen, mode, initialData, nextSku]);

  // Helper function to parse number input (handles both comma and dot)
  const parseNumberInput = (value: string): number => {
    if (!value || !value.trim()) return 0;
    // O'zbekistonda vergul o'nlik ajratuvchi sifatida ishlatiladi
    // Lekin hisoblash uchun nuqtaga o'tkazamiz
    const normalized = value.replace(/,/g, '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Helper function to format number for display (with comma as decimal separator)
  const formatNumberForDisplay = (value: number): string => {
    if (!Number.isFinite(value)) return '';
    // O'zbekistonda vergul ishlatiladi
    const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2);
    return formatted.replace('.', ',');
  };
  // Auto-calculate price from basePrice and priceMultiplier
  useEffect(() => {
    if (isPriceManuallyEdited) return;

    const base = parseNumberInput(basePrice);
    const percent = parseNumberInput(priceMultiplier);

    console.log('[VariantModal] Auto-calculating price:', { 
      basePrice, 
      priceMultiplier, 
      parsedBase: base, 
      parsedPercent: percent 
    });

    if (base <= 0) {
      setPrice('');
      return;
    }

    const percentValue = percent || 0;
    const total = base + base * (percentValue / 100);
    
    console.log('[VariantModal] Calculation:', { 
      base, 
      percentValue, 
      formula: `${base} + ${base} * (${percentValue} / 100)`,
      result: total 
    });
    
    if (!Number.isFinite(total)) {
      setPrice('');
      return;
    }

    // Format with proper decimal places and comma separator
    const formatted = formatNumberForDisplay(total);
    console.log('[VariantModal] Setting formatted price:', formatted);
    setPrice(formatted);
  }, [basePrice, priceMultiplier, isPriceManuallyEdited]);

  // Auto-calculate priceMultiplier from price and basePrice
  useEffect(() => {
    if (!isPriceManuallyEdited) return;

    const base = parseNumberInput(basePrice);
    const finalPrice = parseNumberInput(price);

    console.log('[VariantModal] Auto-calculating multiplier:', { 
      basePrice, 
      price, 
      parsedBase: base, 
      parsedFinalPrice: finalPrice 
    });

    if (base <= 0 || finalPrice <= 0) {
      return;
    }

    // Formula: foiz = ((sotiladigan_narx - asl_narx) / asl_narx) × 100
    const calculatedPercent = ((finalPrice - base) / base) * 100;
    
    console.log('[VariantModal] Multiplier calculation:', { 
      base, 
      finalPrice, 
      formula: `((${finalPrice} - ${base}) / ${base}) * 100`,
      result: calculatedPercent 
    });
    
    if (!Number.isFinite(calculatedPercent)) {
      return;
    }

    // Format with proper decimal places and comma separator
    const formatted = formatNumberForDisplay(calculatedPercent);
    console.log('[VariantModal] Setting formatted multiplier:', formatted);
    setPriceMultiplier(formatted);
  }, [price, basePrice, isPriceManuallyEdited]);

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

  // Kategoriya yaratish funksiyasi
  const handleCreateCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setCreateCategoryError('Kategoriya nomi kiritilishi shart');
      return;
    }

    if (!onCreateCategory) {
      setCreateCategoryError('Kategoriya yaratish funksiyasi mavjud emas');
      return;
    }

    setCreateCategoryLoading(true);
    setCreateCategoryError(null);

    try {
      const parentId = selectedParent?.id;
      const newCategory = await onCreateCategory(trimmedName, parentId);
      
      // Yangi kategoriyani tanlash
      setCategoryId(newCategory.id);
      if (selectedParent) {
        setSelectedPath([selectedParent, newCategory]);
      } else {
        setSelectedPath([newCategory]);
        setSelectedParent(newCategory);
      }
      
      // Formani tozalash
      setIsCreatingCategory(false);
      setNewCategoryName('');
    } catch (err) {
      console.error('Error creating category:', err);
      setCreateCategoryError(err instanceof Error ? err.message : 'Kategoriya yaratishda xatolik');
    } finally {
      setCreateCategoryLoading(false);
    }
  };

  const handleSave = () => {
    if (!name.trim() || !sku.trim() || !basePrice.trim() || !priceMultiplier.trim() || !stock.trim()) {
      alert('Iltimos, barcha majburiy maydonlarni to\'ldiring');
      return;
    }

    // Separate existing URLs from new files
    const existingUrls = imagePreviews.filter(p => !p.startsWith('blob:'));

    console.log('[VariantModal] Saving variant with categoryId:', categoryId);

    const variantData = {
      name: name.trim(),
      sku: sku.trim(),
      basePrice,
      priceMultiplier,
      price,
      priceCurrency,
      stock,
      status,
      categoryId: categoryId || undefined, // Kategoriya ID sini qo'shish
      images, // New File objects
      imagePreviews, // All previews
      existingImageUrls: existingUrls, // Existing server URLs
    };

    console.log('[VariantModal] Full variant data:', variantData);

    onSave(variantData);

    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-2 sm:px-4">
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
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                  placeholder="Masalan: Qizil, Katta, 15mm"
                />
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
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-foreground">
                    Asl narxi <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={basePrice}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Faqat raqamlar, nuqta va vergulga ruxsat berish
                      if (/^[0-9.,]*$/.test(value)) {
                        console.log('[VariantModal] Base price input changed:', value);
                        setBasePrice(value);
                        // Asl narx o'zgarsa, narx avtomatik hisoblanadi
                        if (value.trim()) {
                          setIsPriceManuallyEdited(false);
                        }
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
                    className="w-full px-4 py-3 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                    placeholder="10000"
                  />
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
                    type="text"
                    inputMode="decimal"
                    value={priceMultiplier}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Faqat raqamlar, nuqta va vergulga ruxsat berish
                      if (/^[0-9.,]*$/.test(value)) {
                        console.log('[VariantModal] Price multiplier input changed:', value);
                        setPriceMultiplier(value);
                        // Foiz o'zgarsa, narx avtomatik hisoblanadi
                        if (value.trim()) {
                          setIsPriceManuallyEdited(false);
                        }
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
                    console.log('[VariantModal] Price manually changed via CurrencyPriceInput:', { newPrice, currency });
                    setPrice(newPrice);
                    setPriceCurrency(currency);
                    setIsPriceManuallyEdited(true);
                  }}
                  initialCurrency={productCurrency || 'UZS'}
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
                type="text"
                inputMode="numeric"
                value={stock}
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
                onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                className="w-full px-4 py-3 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                placeholder="10"
              />
            </div>

            {/* Kategoriya */}
            <div className="rounded-2xl border border-border bg-muted/30 p-4 sm:p-5 space-y-4">
              {/* Header - Tanlangan kategoriya va Ortga tugmasi */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="text-sm font-bold text-foreground">Tanlangan kategoriya:</span>
                  <span className="text-sm font-semibold text-primary">
                    {categoryId ? (categories.find(c => c.id === categoryId)?.name || 'Tanlanmagan') : 'Tanlanmagan'}
                  </span>
                </div>
                {selectedParent && (
                  <button
                    type="button"
                    onClick={() => {
                      // Ortga qaytish - parent kategoriyaga
                      const parentOfParent = categories.find(c => c.id === selectedParent.parentId);
                      if (parentOfParent) {
                        setSelectedParent(parentOfParent);
                        setSelectedPath(prev => prev.slice(0, -1));
                      } else {
                        setSelectedParent(null);
                        setSelectedPath([]);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border text-xs font-medium text-foreground hover:bg-muted/80 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Ortga
                  </button>
                )}
              </div>

              {/* Kategoriyalar ro'yxati */}
              <div className="rounded-xl border border-border bg-background overflow-hidden max-h-[200px] overflow-y-auto">
                {(() => {
                  // Hozirgi darajadagi kategoriyalarni olish
                  const currentCategories = selectedParent
                    ? categories.filter(cat => cat.parentId === selectedParent.id)
                    : categories.filter(cat => cat.level === 0);

                  if (currentCategories.length === 0) {
                    return (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                        {selectedParent ? `"${selectedParent.name}" ichida kategoriya yo'q` : "Kategoriyalar yo'q"}
                      </div>
                    );
                  }

                  return currentCategories.map((cat, index) => {
                    const isSelected = categoryId === cat.id;
                    const isEditing = editingCategoryId === cat.id;
                    const isDeleting = deletingCategoryId === cat.id;

                    return (
                      <div
                        key={cat.id}
                        className={`flex items-center justify-between px-4 py-3 ${
                          index !== currentCategories.length - 1 ? 'border-b border-border' : ''
                        } ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'} transition-colors`}
                      >
                        {isEditing ? (
                          // Tahrirlash rejimi
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={editingCategoryName}
                              onChange={(e) => setEditingCategoryName(e.target.value)}
                              className="flex-1 px-2 py-1 rounded-md bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                              autoFocus
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (onEditCategory && editingCategoryName.trim()) {
                                    try {
                                      await onEditCategory(cat.id, editingCategoryName.trim());
                                    } catch (err) {
                                      console.error('Kategoriya tahrirlashda xatolik:', err);
                                    }
                                    setEditingCategoryId(null);
                                    setEditingCategoryName('');
                                  }
                                } else if (e.key === 'Escape') {
                                  setEditingCategoryId(null);
                                  setEditingCategoryName('');
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                if (onEditCategory && editingCategoryName.trim()) {
                                  try {
                                    await onEditCategory(cat.id, editingCategoryName.trim());
                                  } catch (err) {
                                    console.error('Kategoriya tahrirlashda xatolik:', err);
                                  }
                                  setEditingCategoryId(null);
                                  setEditingCategoryName('');
                                }
                              }}
                              className="px-2 py-1 rounded-md bg-primary text-primary-foreground text-[10px] font-medium"
                            >
                              Saqlash
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategoryId(null);
                                setEditingCategoryName('');
                              }}
                              className="px-2 py-1 rounded-md bg-muted text-foreground text-[10px] font-medium"
                            >
                              Bekor
                            </button>
                          </div>
                        ) : isDeleting ? (
                          // O'chirish tasdiqlash
                          <div className="flex-1 flex items-center gap-2">
                            <span className="text-xs text-destructive">O'chirishni tasdiqlaysizmi?</span>
                            <button
                              type="button"
                              onClick={async () => {
                                if (onDeleteCategory) {
                                  try {
                                    await onDeleteCategory(cat.id);
                                    if (categoryId === cat.id) {
                                      setCategoryId('');
                                    }
                                  } catch (err) {
                                    console.error('Kategoriya o\'chirishda xatolik:', err);
                                  }
                                  setDeletingCategoryId(null);
                                }
                              }}
                              className="px-2 py-1 rounded-md bg-destructive text-destructive-foreground text-[10px] font-medium"
                            >
                              Ha
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingCategoryId(null)}
                              className="px-2 py-1 rounded-md bg-muted text-foreground text-[10px] font-medium"
                            >
                              Yo'q
                            </button>
                          </div>
                        ) : (
                          // Normal ko'rinish
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                // Kategoriyani tanlash (ichiga kirmasdan)
                                console.log('[VariantModal] Selecting category:', cat.id, cat.name);
                                setCategoryId(cat.id);
                              }}
                              className={`flex-1 text-left text-sm font-medium ${
                                isSelected ? 'text-primary' : 'text-foreground'
                              }`}
                            >
                              {cat.name}
                            </button>
                            <div className="flex items-center gap-1.5">
                              {/* Ichiga kirish tugmasi */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Ichki kategoriyalarga kirish
                                  console.log('[VariantModal] Entering category:', cat.id, cat.name);
                                  setSelectedParent(cat);
                                  setCategoryId(cat.id);
                                  if (selectedParent) {
                                    setSelectedPath([...selectedPath.filter(p => p.id !== cat.id), cat]);
                                  } else {
                                    setSelectedPath([cat]);
                                  }
                                }}
                                className="px-2 py-1 rounded-md bg-blue-600/80 hover:bg-blue-600 text-white text-[10px] font-medium transition-colors"
                              >
                                Kirish
                              </button>
                              {onEditCategory && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCategoryId(cat.id);
                                    setEditingCategoryName(cat.name);
                                  }}
                                  className="px-2 py-1 rounded-md bg-muted border border-border text-[10px] font-medium text-foreground hover:bg-muted/80 transition-colors"
                                >
                                  Tahrir
                                </button>
                              )}
                              {onDeleteCategory && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingCategoryId(cat.id);
                                  }}
                                  className="px-2 py-1 rounded-md bg-destructive/90 text-destructive-foreground text-[10px] font-medium hover:bg-destructive transition-colors"
                                >
                                  O'chir
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Yangi kategoriya qo'shish */}
              {onCreateCategory && (
                <div className="pt-2 border-t border-border/50">
                  {!isCreatingCategory ? (
                    <button
                      type="button"
                      onClick={() => setIsCreatingCategory(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      {selectedParent ? `"${selectedParent.name}" ichiga kategoriya qo'shish` : "Yangi kategoriya qo'shish"}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder={selectedParent ? `"${selectedParent.name}" ichiga yangi kategoriya` : "Yangi kategoriya nomi"}
                          className="flex-1 px-3 py-2 rounded-lg bg-background border border-input text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCreateCategory();
                            } else if (e.key === 'Escape') {
                                setIsCreatingCategory(false);
                                setNewCategoryName('');
                                setCreateCategoryError(null);
                              }
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleCreateCategory}
                            disabled={createCategoryLoading || !newCategoryName.trim()}
                            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            {createCategoryLoading ? (
                              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                            ) : (
                              'Qo\'shish'
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingCategory(false);
                              setNewCategoryName('');
                              setCreateCategoryError(null);
                            }}
                            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {createCategoryError && (
                          <p className="text-xs text-destructive">{createCategoryError}</p>
                        )}
                        {selectedParent && (
                          <p className="text-[10px] text-muted-foreground">
                            "{selectedParent.name}" kategoriyasi ichiga qo'shiladi
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
            </div>

            {/* Rasmlar */}
            <div className="space-y-3">
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
      </div>
    </AnimatePresence>
  );
}
