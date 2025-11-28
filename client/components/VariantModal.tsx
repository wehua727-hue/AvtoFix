import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ProductStatus } from '@/components/ProductStatusSelector';
import CurrencyPriceInput, { type Currency } from '@/components/CurrencyPriceInput';
import { X, Plus, Trash2, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface VariantData {
  name: string;
  sku: string; // Xil uchun alohida SKU/kod
  basePrice: string;
  priceMultiplier: string;
  price: string;
  priceCurrency: Currency;
  stock: string;
  status: ProductStatus;
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
}

export default function VariantModal({ isOpen, onClose, onSave, exchangeRates, mode = 'create', initialData, nextSku, productCurrency }: VariantModalProps) {
  
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
      setImages(initialData.images ?? []);
      setImagePreviews(initialData.imagePreviews ?? []);
      setImageError(null);
      setIsPriceManuallyEdited(false);
    } else {
      setName('');
      setSku(nextSku ?? ''); // Avtomatik keyingi SKU
      setBasePrice('');
      setPriceMultiplier('');
      setPrice('');
      setPriceCurrency(productCurrency || 'UZS'); // Mahsulotning currency sini ishlatish
      setStock('');
      setStatus('available');
      setImages([]);
      setImagePreviews([]);
      setImageError(null);
      setIsPriceManuallyEdited(false);
    }
  }, [isOpen, mode, initialData, nextSku]);

<<<<<<< HEAD
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

=======
>>>>>>> da5fe2d9465930177f205756d8cf3dc75d116d25
  // Auto-calculate price from basePrice and priceMultiplier
  useEffect(() => {
    if (isPriceManuallyEdited) return;

<<<<<<< HEAD
    const base = parseNumberInput(basePrice);
    const percent = parseNumberInput(priceMultiplier);

    console.log('[VariantModal] Auto-calculating price:', { 
      basePrice, 
      priceMultiplier, 
      parsedBase: base, 
      parsedPercent: percent 
    });

    if (base <= 0) {
=======
    const base = parseFloat(basePrice);
    const percent = parseFloat(priceMultiplier);

    if (!base || isNaN(base)) {
>>>>>>> da5fe2d9465930177f205756d8cf3dc75d116d25
      setPrice('');
      return;
    }

    const percentValue = percent || 0;
    const total = base + base * (percentValue / 100);
    
<<<<<<< HEAD
    console.log('[VariantModal] Calculation:', { 
      base, 
      percentValue, 
      formula: `${base} + ${base} * (${percentValue} / 100)`,
      result: total 
    });
    
    if (!Number.isFinite(total)) {
=======
    if (!isFinite(total)) {
>>>>>>> da5fe2d9465930177f205756d8cf3dc75d116d25
      setPrice('');
      return;
    }

<<<<<<< HEAD
    // Format with proper decimal places and comma separator
    const formatted = formatNumberForDisplay(total);
    console.log('[VariantModal] Setting formatted price:', formatted);
=======
    const formatted = Number.isInteger(total) ? String(total) : total.toFixed(2);
>>>>>>> da5fe2d9465930177f205756d8cf3dc75d116d25
    setPrice(formatted);
  }, [basePrice, priceMultiplier, isPriceManuallyEdited]);

  // Auto-calculate priceMultiplier from price and basePrice
  useEffect(() => {
    if (!isPriceManuallyEdited) return;

<<<<<<< HEAD
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
=======
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
    
>>>>>>> da5fe2d9465930177f205756d8cf3dc75d116d25
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

  const handleSave = () => {
    if (!name.trim() || !sku.trim() || !basePrice.trim() || !priceMultiplier.trim() || !stock.trim()) {
      alert('Iltimos, barcha majburiy maydonlarni to\'ldiring');
      return;
    }

    // Separate existing URLs from new files
    const existingUrls = imagePreviews.filter(p => !p.startsWith('blob:'));

    onSave({
      name: name.trim(),
      sku: sku.trim(),
      basePrice,
      priceMultiplier,
      price,
      priceCurrency,
      stock,
      status,
      images, // New File objects
      imagePreviews, // All previews
      existingImageUrls: existingUrls, // Existing server URLs
    });

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
<<<<<<< HEAD
                        console.log('[VariantModal] Base price input changed:', value);
                        setBasePrice(value);
                        // Asl narx o'zgarsa, narx avtomatik hisoblanadi
                        if (value.trim()) {
                          setIsPriceManuallyEdited(false);
                        }
=======
                        setBasePrice(value);
>>>>>>> da5fe2d9465930177f205756d8cf3dc75d116d25
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
<<<<<<< HEAD
                        console.log('[VariantModal] Price multiplier input changed:', value);
                        setPriceMultiplier(value);
                        // Foiz o'zgarsa, narx avtomatik hisoblanadi
                        if (value.trim()) {
                          setIsPriceManuallyEdited(false);
                        }
=======
                        setPriceMultiplier(value);
                        setIsPriceManuallyEdited(false);
>>>>>>> da5fe2d9465930177f205756d8cf3dc75d116d25
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
<<<<<<< HEAD
                    console.log('[VariantModal] Price manually changed via CurrencyPriceInput:', { newPrice, currency });
=======
>>>>>>> da5fe2d9465930177f205756d8cf3dc75d116d25
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
