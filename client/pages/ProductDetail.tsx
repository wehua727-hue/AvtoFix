import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Layout/Header';
import Sidebar from '@/components/Layout/Sidebar';

interface Product {
  id: string;
  name: string;
  code: string;
  stock: number;
  price: number;
  basePrice?: number;
  priceMultiplier?: number;
  currency?: 'USD' | 'RUB' | 'CNY' | 'UZS';
  categoryId?: string | null;
  categoryName?: string | null;
  status?: 'available' | 'pending' | 'out-of-stock' | 'discontinued';
  imageUrl?: string | null;
  imagePaths?: string[]; // Bir nechta rasmlar uchun
  video?: {
    filename: string;
    url?: string;
    size?: number;
  };
}

interface ProductSizeVariant {
  label: string;
  price?: string;
}

interface VariantSummary {
  name: string;
  sku?: string;
  basePrice?: number;
  priceMultiplier?: number;
  price?: number;
  currency?: 'USD' | 'RUB' | 'CNY' | 'UZS';
  stock?: number;
  status?: string;
  categoryId?: string;
  categoryName?: string | null;
  imagePaths?: string[];
  imagePreviews?: string[];
}

const formatMoney = (n: number) => {
  // Round to 2 decimal places for display
  const rounded = Math.round(n * 100) / 100;
  return new Intl.NumberFormat('uz-UZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(rounded);
};

// Electron (file://) uchun backendga to'g'ri ulanish
// API base URL - production va development uchun
const API_BASE_URL = (() => {
  if (typeof window === 'undefined') return '';
  
  // Electron (file://) uchun
  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:5173';
  }
  
  // Production yoki development - relative URL ishlatamiz (same origin)
  const envApiUrl = import.meta.env.VITE_API_BASE_URL;
  
  // Placeholder yoki noto'g'ri qiymatlarni tekshirish
  const isPlaceholder = envApiUrl && (
    envApiUrl.includes('YOUR_PUBLIC_IP') || 
    envApiUrl.includes('your_public_ip') ||
    envApiUrl.includes('localhost') && window.location.protocol === 'https:'
  );
  
  // Agar HTTPS sahifada HTTP API URL bo'lsa, mixed content xatosi bo'ladi
  // Shu sababli relative URL ishlatamiz
  const isHttpOnHttps = envApiUrl && 
    envApiUrl.startsWith('http://') && 
    window.location.protocol === 'https:';
  
  if (envApiUrl && !isPlaceholder && !isHttpOnHttps) {
    return envApiUrl;
  }
  
  // Default: same origin (relative URL) - HTTPS sahifalar uchun xavfsiz
  return '';
})();

const resolveMediaUrl = (url?: string | null): string => {
  if (!url) return '';
  if (/^(https?:)?\/\//.test(url) || url.startsWith('blob:')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
};
const formatDate = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return { date: `${day}.${month}.${year}`, time: `${hours}:${minutes}` };
};

interface DeviceInfo {
  id: string;
  name: string;
  type: 'printer';
  driver: 'windows' | string;
  isDefault?: boolean;
}

type PrinterSizesMap = Record<string, string[]>;

const PRINTER_SIZES_KEY = 'printerPaperSizes:v1';

const loadPrinterSizes = (): PrinterSizesMap => {
  try {
    const raw = localStorage.getItem(PRINTER_SIZES_KEY);
    return raw ? (JSON.parse(raw) as PrinterSizesMap) : {};
  } catch {
    return {};
  }
};

const savePrinterSizes = (map: PrinterSizesMap) => {
  try {
    localStorage.setItem(PRINTER_SIZES_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
};

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [sizes, setSizes] = useState<ProductSizeVariant[]>([]);
  const [variantSummaries, setVariantSummaries] = useState<VariantSummary[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<VariantSummary | null>(null);
  const { date, time } = formatDate();
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [paperSize, setPaperSize] = useState<string>('');
  const [copiesInput, setCopiesInput] = useState<string>('1');
  const [isElectron, setIsElectron] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Reset image index when product changes
  useEffect(() => {
    if (product) {
      setCurrentImageIndex(0);
    }
  }, [product?.id]);
  const [printerSizes, setPrinterSizes] = useState<PrinterSizesMap>({});
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [isSizeConfigOpen, setIsSizeConfigOpen] = useState(false);
  const [sizeInput, setSizeInput] = useState('');
  const [exchangeRates, setExchangeRates] = useState<{ usd: number; rub: number; cny: number } | null>(null);

  // Convert UZS price back to original currency
  // Backend stores prices in UZS after conversion, we need to convert back
  const convertFromUZS = (uzsPrice: number, currency?: string): number => {
    if (!currency || currency === 'UZS') {
      console.log('[convertFromUZS] No conversion needed (UZS):', { uzsPrice, currency });
      return uzsPrice;
    }
    
    if (!exchangeRates) {
      console.log('[convertFromUZS] No exchange rates available, returning UZS price:', { uzsPrice, currency });
      return uzsPrice;
    }
    
    const rate = currency === 'USD' ? exchangeRates.usd 
               : currency === 'RUB' ? exchangeRates.rub 
               : currency === 'CNY' ? exchangeRates.cny 
               : 1;
    
    const converted = uzsPrice / rate;
    console.log('[convertFromUZS] Converting:', { 
      uzsPrice, 
      currency, 
      rate, 
      converted,
      exchangeRates: exchangeRates 
    });
    return converted;
  };

  const incrementTodaySales = (productId: string, count: number) => {
    try {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const key = `productSales:${today}`;
      const raw = localStorage.getItem(key);
      const parsed: Record<string, number> = raw ? JSON.parse(raw) : {};
      const current = Number.isFinite(parsed[productId]) ? parsed[productId] : 0;
      parsed[productId] = current + count;
      localStorage.setItem(key, JSON.stringify(parsed));
    } catch (e) {
      console.error('Failed to update local sales stats', e);
    }
  };

  // Fetch exchange rates on mount
  useEffect(() => {
    const fetchExchangeRates = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/currency/rates`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.rates) {
            setExchangeRates(data.rates);
            console.log('[ProductDetail] Exchange rates loaded:', data.rates);
          }
        }
      } catch (error) {
        console.error('[ProductDetail] Failed to fetch exchange rates:', error);
      }
    };

    fetchExchangeRates();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      // Load from MongoDB via /api/products/:id
      try {
        const res = await fetch(`${API_BASE_URL}/api/products/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.success && data.product && !isCancelled) {
          const p = data.product as {
            id: string;
            name: string;
            sku?: string;
            price: number | null;
            stock?: number | null;
            imageUrl?: string | null;
            sizes?: string | string[] | null;
          };

          // Parse sizes/xillar if present (string like "S|100,M|200" or array)
          const parsedSizes: ProductSizeVariant[] = [];
          const rawSizes = (p as any).sizes;
          if (typeof rawSizes === 'string') {
            rawSizes
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .forEach((entry) => {
                const [labelRaw, priceRaw] = entry.split('|');
                const label = (labelRaw || '').trim();
                const price = (priceRaw || '').trim();
                if (!label) return;
                parsedSizes.push({ label, price: price || undefined });
              });
          } else if (Array.isArray(rawSizes)) {
            (rawSizes as any[])
              .map((s) => (typeof s === 'string' ? s : String(s)))
              .filter(Boolean)
              .forEach((entry) => {
                const [labelRaw, priceRaw] = entry.split('|');
                const label = (labelRaw || '').trim();
                const price = (priceRaw || '').trim();
                if (!label) return;
                parsedSizes.push({ label, price: price || undefined });
              });
          }
          setSizes(parsedSizes);

          // Parse variantSummaries if present
          const imagePaths = Array.isArray((p as any).imagePaths) ? (p as any).imagePaths : (p.imageUrl ? [p.imageUrl] : []);
          
          // Fetch categories for category names
          let allCategories: any[] = [];
          try {
            const catRes = await fetch(`${API_BASE_URL}/api/categories`);
            if (catRes.ok) {
              const catData = await catRes.json();
              if (Array.isArray(catData?.categories)) {
                allCategories = catData.categories;
              }
            }
          } catch (err) {
            console.error('[ProductDetail] Failed to fetch categories:', err);
          }

          // Helper function to get category name by ID
          const getCategoryName = (catId: string | null | undefined): string | null => {
            if (!catId) return null;
            const category = allCategories.find((c: any) => (c.id || c._id) === catId);
            return category?.name || null;
          };

          const rawVariantSummaries = (p as any).variantSummaries;
          console.log('[ProductDetail] Raw variantSummaries from API:', rawVariantSummaries);
          if (Array.isArray(rawVariantSummaries) && rawVariantSummaries.length > 0) {
            const parsedVariants: VariantSummary[] = rawVariantSummaries.map((v: any) => ({
              name: (v.name || '').toString().trim(),
              sku: typeof v.sku === 'string' ? v.sku : undefined,
              basePrice: typeof v.basePrice === 'number' ? v.basePrice : undefined,
              priceMultiplier: typeof v.priceMultiplier === 'number' ? v.priceMultiplier : undefined,
              price: typeof v.price === 'number' ? v.price : undefined,
              currency: v.currency || 'UZS',
              stock: typeof v.stock === 'number' ? v.stock : undefined,
              status: typeof v.status === 'string' ? v.status : undefined,
              categoryId: typeof v.categoryId === 'string' ? v.categoryId : undefined,
              categoryName: getCategoryName(v.categoryId),
              imagePaths: Array.isArray(v.imagePaths) ? v.imagePaths : [],
              imagePreviews: Array.isArray(v.imagePaths) ? v.imagePaths.map((path: string) => resolveMediaUrl(path)) : [],
            }));
            console.log('[ProductDetail] Parsed variantSummaries:', parsedVariants);
            console.log('[ProductDetail] Variant currencies:', parsedVariants.map(v => ({ name: v.name, currency: v.currency })));
            setVariantSummaries(parsedVariants);
          } else {
            console.log('[ProductDetail] No variantSummaries found');
            setVariantSummaries([]);
          }
          
          // Get category name for main product
          const categoryName: string | null = getCategoryName((p as any).categoryId);
          
          setProduct({
            id: p.id,
            name: p.name,
            code: p.sku ?? "",
            stock: typeof p.stock === "number" ? p.stock : 0,
            price: typeof p.price === "number" ? p.price : 0,
            basePrice: typeof (p as any).basePrice === "number" ? (p as any).basePrice : undefined,
            priceMultiplier: typeof (p as any).priceMultiplier === "number" ? (p as any).priceMultiplier : undefined,
            currency: (p as any).currency || 'UZS',
            categoryId: (p as any).categoryId ?? null,
            categoryName: categoryName,
            status: (p as any).status || 'available',
            imageUrl: p.imageUrl ?? null,
            imagePaths: imagePaths,
          });
        }
      } catch (err) {
        console.error('Failed to load product by id from API:', err);
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [id]);

  // Detect Electron and load printers (Electron or browser fallback)
  useEffect(() => {
    const anyWindow = window as any;

    // Electron mode: use IPC devices + progress events
    if (anyWindow && anyWindow.electronAPI) {
      setIsElectron(true);

      anyWindow.electronAPI
        .listDevices()
        .then((list: DeviceInfo[]) => {
          setDevices(list || []);
          const defaultPrinter = list?.find((d) => d.isDefault) || list?.[0];
          if (defaultPrinter) setSelectedPrinter(defaultPrinter.name);
        })
        .catch((err: unknown) => {
          console.error('Failed to load printers from Electron:', err);
        });

      const unsubscribe = anyWindow.electronAPI.onPrintProgress?.(
        (data: { current: number; total: number }) => {
          setProgress(data);
          if (data.current >= data.total) {
            setTimeout(() => {
              setIsPrinting(false);
              setProgress(null);
            }, 500);
          }
        },
      );

      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }

    // Browser/Electron mode: fetch devices from REST API
    fetch(`${API_BASE_URL}/api/devices/list`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const list: DeviceInfo[] = (data?.printers || []).map((p: any, index: number) => ({
          id: p.id || `rest-${index}-${p.name}`,
          name: p.name,
          type: 'printer',
          driver: (p.driver as string) || 'windows',
          isDefault: Boolean(p.isDefault),
        }));
        setDevices(list);
        const defaultPrinter = list.find((d) => d.isDefault) || list[0];
        if (defaultPrinter) setSelectedPrinter(defaultPrinter.name);
      })
      .catch((err) => {
        console.error('Failed to load printers from REST API:', err);
      });

    return undefined;
  }, []);

  // Load saved printer sizes once on mount
  useEffect(() => {
    setPrinterSizes(loadPrinterSizes());
  }, []);

  // When selected printer or sizes map changes, update available sizes and current paperSize
  useEffect(() => {
    const sizes = selectedPrinter ? printerSizes[selectedPrinter] : undefined;
    const list = sizes && sizes.length ? sizes : [];
    setAvailableSizes(list);

    // agar mavjud sizelar orasida hozirgi paperSize yo'q bo'lsa, va kamida bitta size bo'lsa, birinchisini tanlaymiz
    if (list.length && !list.includes(paperSize)) {
      setPaperSize(list[0]);
    }

    // agar umuman size bo'lmasa, tanlovni bo'shatamiz
    if (!list.length) {
      setPaperSize('');
    }
  }, [selectedPrinter, printerSizes, paperSize]);

  const handleAddSizeForPrinter = () => {
    const printerName = selectedPrinter;
    const value = sizeInput.trim();
    if (!printerName || !value) return;

    setPrinterSizes((prev) => {
      const existing = prev[printerName] ?? [];
      if (existing.includes(value)) {
        return prev;
      }
      const updated: PrinterSizesMap = {
        ...prev,
        [printerName]: [...existing, value],
      };
      savePrinterSizes(updated);
      return updated;
    });

    setSizeInput('');
  };

  const handlePrint = async () => {
    const copies = (() => {
      const n = parseInt(copiesInput || '1', 10);
      return Number.isFinite(n) && n > 0 ? n : 1;
    })();
    // Electron-native printing
    const anyWindow = window as any;
    if (anyWindow && anyWindow.electronAPI && product) {
      if (!selectedPrinter) {
        setErrorMessage("Printer tanlanmagan");
        return;
      }

      if (!paperSize) {
        setErrorMessage("Qog'oz o'lchami tanlanmagan");
        return;
      }

      try {
        setIsPrinting(true);
        setProgress({ current: 0, total: copies });
        await anyWindow.electronAPI.printReceipt({
          printerName: selectedPrinter,
          product,
          paperSize,
          copies,
        });
        incrementTodaySales(product.id, copies);
      } catch (err) {
        console.error('Electron print error:', err);
        setErrorMessage('Pechat vaqtida xatolik yuz berdi');
      } finally {
        // yakuniy holatni progress eventlari ham boshqaradi
      }
      return;
    }

    // Browser mode: send print job to backend (no window.print())
    if (!product) return;

    if (!selectedPrinter) {
      setErrorMessage("Printer tanlanmagan");
      return;
    }

    if (!paperSize) {
      setErrorMessage("Qog'oz o'lchami tanlanmagan");
      return;
    }

    try {
      setIsPrinting(true);
      setProgress({ current: 0, total: copies });

      await fetch(`${API_BASE_URL}/api/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product,
          printerName: selectedPrinter,
          paperSize,
          copies,
        }),
      });

      incrementTodaySales(product.id, copies);

      // Brauzer rejimida progress eventlari yo'q, shuning uchun sun'iy yakunlash
      setProgress({ current: copies, total: copies });
      setTimeout(() => {
        setIsPrinting(false);
        setProgress(null);
      }, 500);
    } catch (err) {
      console.error('REST print error:', err);
      setErrorMessage('Pechat vaqtida xatolik yuz berdi');
      setIsPrinting(false);
      setProgress(null);
    }
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onCollapsedChange={setSidebarCollapsed}
        />
        <div className={`flex-1 flex items-center justify-center px-4 pt-24 pb-8 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'
        }`}>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-900/30 border-2 border-red-600/40 mb-4">
              <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Mahsulot topilmadi</h2>
            <p className="text-gray-400 mb-6">Siz qidirayotgan mahsulot mavjud emas</p>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-red-600/40 bg-gray-900/60 text-white hover:bg-red-900/40 hover:border-red-500/60 transition-all shadow-lg"
            >
              <span className="text-lg">←</span>
              <span className="font-semibold">Orqaga qaytish</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-foreground print:bg-white flex flex-col">
      {/* Global header with sidebar */}
      <Header onMenuClick={() => setSidebarOpen(true)} />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Screen View - Modern Product Details */}
      <main
        className={`flex-1 overflow-y-auto pt-20 sm:pt-24 lg:pt-24 pb-8 print:hidden transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header row (title + back button) aligned with main card */}
          <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Mahsulot ma'lumotlari
            </h1>

            <button
              onClick={() => {
                if (selectedVariant) {
                  setSelectedVariant(null);
                } else {
                  navigate(-1);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-600/40 bg-gray-900/60 text-sm text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-500/60 transition-all shadow-lg"
            >
              <span className="text-lg">←</span>
              <span className="font-semibold">Orqaga</span>
            </button>
          </div>

          {/* Sizes / variants (xillar) - Improved Design - Only show when no variant is selected */}
          {!selectedVariant && (variantSummaries.length > 0 || sizes.length > 0) && (
            <div className="max-w-4xl mx-auto mb-6 rounded-2xl border border-red-600/30 bg-gradient-to-br from-gray-800/90 via-gray-900/90 to-gray-800/90 backdrop-blur-xl shadow-2xl shadow-red-900/20 p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <p className="text-sm uppercase tracking-wider text-red-400 font-semibold">
                  Mavjud xillar va o'lchamlar
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* VariantSummaries cards */}
                {variantSummaries.map((variant, idx) => (
                  <div
                    key={`variant-${variant.name}-${idx}`}
                    onClick={() => {
                      setSelectedVariant(variant);
                    }}
                    className="group relative overflow-hidden rounded-xl border border-red-600/30 bg-gradient-to-br from-gray-900/80 to-gray-800/80 hover:from-red-900/30 hover:to-gray-900/80 px-4 py-3 transition-all duration-300 hover:shadow-lg hover:shadow-red-900/30 hover:border-red-500/50 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 group-hover:bg-red-400 transition-colors"></div>
                        <span className="font-bold text-white text-base group-hover:text-red-100 transition-colors">
                          {variant.name}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                      {variant.price ? (
                        <>
                          <span className="text-sm font-semibold text-red-400 group-hover:text-red-300 transition-colors whitespace-nowrap">
                            {formatMoney(convertFromUZS(variant.price, variant.currency))}
                          </span>
                          <span className="text-[9px] text-red-200/80 font-medium">
                            {variant.currency === 'USD' ? 'Dollar' : variant.currency === 'RUB' ? 'Rubl' : variant.currency === 'CNY' ? 'Yuan' : 'So\'m'}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500 italic">Narx yo'q</span>
                      )}
                    </div>
                    </div>
                  </div>
                ))}
                {/* Legacy sizes cards - only if no variantSummaries to avoid duplicates */}
                {variantSummaries.length === 0 && sizes.map((size, idx) => (
                  <div
                    key={`${size.label}-${size.price ?? 'no-price'}-${idx}`}
                    onClick={() => {
                      const priceNumber = size.price ? Number(String(size.price).replace(/\s/g, '').replace(',', '.')) : undefined;
                      setSelectedVariant({
                        name: size.label,
                        price: Number.isFinite(priceNumber as number) ? (priceNumber as number) : undefined,
                        stock: product.stock,
                        currency: product.currency, // Asosiy mahsulot valyutasini uzatamiz
                      });
                    }}
                    className="group relative overflow-hidden rounded-xl border border-red-600/30 bg-gradient-to-br from-gray-900/80 to-gray-800/80 hover:from-red-900/30 hover:to-gray-900/80 px-4 py-3 transition-all duration-300 hover:shadow-lg hover:shadow-red-900/30 hover:border-red-500/50 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 group-hover:bg-red-400 transition-colors"></div>
                        <span className="font-bold text-white text-base group-hover:text-red-100 transition-colors">
                          {size.label}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                      {size.price ? (
                        <>
                          <span className="text-sm font-semibold text-red-400 group-hover:text-red-300 transition-colors whitespace-nowrap">
                            {size.price}
                          </span>
                          <span className="text-[9px] text-red-200/80 font-medium">
                            {product.currency === 'USD' ? 'Dollar' : product.currency === 'RUB' ? 'Rubl' : product.currency === 'CNY' ? 'Yuan' : 'So\'m'}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500 italic">Narx yo'q</span>
                      )}
                      {/* Currency description for legacy sizes - use main product currency */}
                      {(() => {
                        const currency = product.currency;
                        if (false && currency && currency !== 'UZS') {
                          const currencyNames: Record<string, string> = {
                            'USD': 'Dollarda',
                            'RUB': 'Rublda',
                            'CNY': 'Yuanda'
                          };
                          return (
                            <span className="text-[9px] text-red-200/80 italic">
                              {currencyNames[currency]} hisoblangan
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main product card or variant card */}
          <div className="max-w-4xl mx-auto rounded-2xl border border-red-600/30 bg-gradient-to-br from-gray-800/90 via-gray-900/90 to-gray-800/90 backdrop-blur-xl shadow-2xl shadow-red-900/20 p-5 sm:p-7">
            <div className={`flex flex-col ${(() => {
              const images = selectedVariant
                ? (selectedVariant.imagePreviews && selectedVariant.imagePreviews.length > 0
                    ? selectedVariant.imagePreviews
                    : (selectedVariant.imagePaths && selectedVariant.imagePaths.length > 0
                        ? selectedVariant.imagePaths
                        : []))
                : (product.imagePaths && product.imagePaths.length > 0
                    ? product.imagePaths
                    : (product.imageUrl ? [product.imageUrl] : []));
              const hasMedia = images.length > 0 || (!selectedVariant && product.video?.filename);
              return hasMedia ? 'md:flex-row' : '';
            })()} gap-6 items-stretch`}>
              {/* Left: Product media (image or video) - Only show if media exists */}
              {(() => {
                const images = selectedVariant
                  ? (selectedVariant.imagePreviews && selectedVariant.imagePreviews.length > 0
                      ? selectedVariant.imagePreviews
                      : (selectedVariant.imagePaths && selectedVariant.imagePaths.length > 0
                          ? selectedVariant.imagePaths
                          : []))
                  : (product.imagePaths && product.imagePaths.length > 0
                      ? product.imagePaths
                      : (product.imageUrl ? [product.imageUrl] : []));
                const hasMedia = images.length > 0 || (!selectedVariant && product.video?.filename);
                
                if (!hasMedia) return null;
                
                return (
              <div className="flex-shrink-0 flex flex-col gap-3">
                {/* Main media display with carousel */}
                <div 
                  className="w-full md:w-48 aspect-square rounded-2xl overflow-hidden border-2 border-red-600/40 bg-gray-900/60 flex items-center justify-center shadow-xl shadow-red-900/30 hover:border-red-500/60 transition-all cursor-pointer group relative"
                  onClick={() => {
                    const images = selectedVariant
                      ? (selectedVariant.imagePreviews && selectedVariant.imagePreviews.length > 0
                          ? selectedVariant.imagePreviews
                          : (selectedVariant.imagePaths && selectedVariant.imagePaths.length > 0
                              ? selectedVariant.imagePaths
                              : []))
                      : (product.imagePaths && product.imagePaths.length > 0
                          ? product.imagePaths
                          : (product.imageUrl ? [product.imageUrl] : []));
                    if (images.length > 0) {
                      setCurrentImageIndex(0);
                      setIsImageModalOpen(true);
                    } else if (!selectedVariant && product.video?.filename) {
                      setIsVideoModalOpen(true);
                    }
                  }}
                >
                  {(() => {
                    const images = selectedVariant
                      ? (selectedVariant.imagePreviews && selectedVariant.imagePreviews.length > 0
                          ? selectedVariant.imagePreviews
                          : (selectedVariant.imagePaths && selectedVariant.imagePaths.length > 0
                              ? selectedVariant.imagePaths
                              : []))
                      : (product.imagePaths && product.imagePaths.length > 0
                          ? product.imagePaths
                          : (product.imageUrl ? [product.imageUrl] : []));
                    if (images.length > 0) {
                      const resolvedImages = images.map(img => resolveMediaUrl(img));
                      return (
                        <>
                          <img
                            src={resolvedImages[currentImageIndex]}
                            alt={`${product.name} - ${currentImageIndex + 1}`}
                            className="w-full h-full object-cover transition-transform duration-300"
                            loading="lazy"
                            onError={(e) => {
                              console.error('[ProductDetail] Image load failed:', resolvedImages[currentImageIndex]);
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E';
                            }}
                          />
                          {images.length > 1 && (
                            <>
                              {/* Navigation buttons */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
                                }}
                                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-600/90 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center transition-all shadow-lg z-10 touch-manipulation"
                                title="Oldingi rasm"
                              >
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentImageIndex((prev) => (prev + 1) % images.length);
                                }}
                                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-600/90 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center transition-all shadow-lg z-10 touch-manipulation"
                                title="Keyingi rasm"
                              >
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                              {/* Image counter */}
                              <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black/80 backdrop-blur-sm text-white text-xs sm:text-sm font-semibold shadow-lg">
                                {currentImageIndex + 1} / {images.length}
                              </div>
                              {/* Thumbnail dots */}
                              <div className="absolute bottom-12 sm:bottom-16 left-1/2 -translate-x-1/2 flex gap-2">
                                {images.map((_, idx) => (
                                  <button
                                    key={idx}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCurrentImageIndex(idx);
                                    }}
                                    className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all touch-manipulation ${
                                      idx === currentImageIndex
                                        ? 'bg-red-500 w-6 sm:w-8'
                                        : 'bg-white/50 hover:bg-white/80'
                                    }`}
                                  />
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      );
                    } else if (product.video?.filename) {
                      return (
                        <div className="flex flex-col items-center gap-2 p-4 text-center relative">
                          <svg className="w-16 h-16 text-red-400 group-hover:text-red-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-xs text-gray-400 font-medium group-hover:text-gray-300 transition-colors">Video mavjud</p>
                          <p className="text-[10px] text-gray-500 break-all">{product.video.filename}</p>
                          <div className="absolute inset-0 bg-red-600/0 group-hover:bg-red-600/10 transition-colors rounded-2xl flex items-center justify-center">
                            <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex flex-col items-center gap-2">
                          <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs text-gray-500">Media yo'q</span>
                        </div>
                      );
                    }
                  })()}
                </div>
                
                {/* Media info badges */}
                {(() => {
                  const images = selectedVariant
                    ? (selectedVariant.imagePreviews && selectedVariant.imagePreviews.length > 0
                        ? selectedVariant.imagePreviews
                        : [])
                    : (product.imagePaths && product.imagePaths.length > 0
                        ? product.imagePaths
                        : (product.imageUrl ? [product.imageUrl] : []));

                  const hasVideo = !selectedVariant && !!product.video?.filename;

                  if (images.length > 0 || hasVideo) {
                    return (
                      <div className="flex flex-col gap-1.5">
                        {images.length > 0 && (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/60 border border-red-600/20">
                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs text-gray-300">{images.length} ta rasm mavjud</span>
                          </div>
                        )}
                        {hasVideo && (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/60 border border-red-600/20">
                            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs text-gray-300">Video mavjud</span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
                );
              })()}

              {/* Right: Product info */}
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                {/* 1. Name - Full width */}
                <div className="col-span-2">
                  <p className="text-xs uppercase tracking-wider text-red-400 mb-1.5 font-semibold">
                    {selectedVariant ? 'Xil nomi' : 'Mahsulot nomi'}
                  </p>
                  <h2 className="text-xl sm:text-2xl font-bold text-white break-words leading-tight">
                    {selectedVariant ? selectedVariant.name : product.name}
                  </h2>
                </div>

                {/* Grid for cards - 2 columns */}
                <div className="grid grid-cols-2 gap-3">
                  {/* 2. Code */}
                  <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-red-600/30 rounded-xl p-3 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-900/20 transition-all group">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-red-600/20 flex items-center justify-center group-hover:bg-red-600/30 transition-colors">
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                        {selectedVariant ? 'Xil kodi' : 'Kod'}
                      </span>
                    </div>
                    <span className="text-base font-bold text-white">
                      {selectedVariant ? (selectedVariant.sku || product.code) : product.code}
                    </span>
                  </div>

                  {/* 3. Base Price */}
                  {(selectedVariant ? selectedVariant.basePrice !== undefined : product.basePrice !== undefined) && (
                    <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-red-600/30 rounded-xl p-3 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-900/20 transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                            Asl narxi
                          </span>
                          {(() => {
                            const currency = selectedVariant ? selectedVariant.currency : product.currency;
                            if (currency === 'USD') {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                                  </svg>
                                  <span className="text-[9px] text-green-400 font-medium">Dollar</span>
                                </div>
                              );
                            } else if (currency === 'RUB') {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14 10.5h-3V9h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zm0-4h-3V5h3c.83 0 1.5.67 1.5 1.5S14.83 7.5 14 7.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2 16h-3v-2H9v-1h2v-2H9v-1h2V9H9V8h2V6h3c1.38 0 2.5 1.12 2.5 2.5 0 .69-.28 1.31-.73 1.76.45.45.73 1.07.73 1.76 0 1.38-1.12 2.5-2.5 2.5z"/>
                                  </svg>
                                  <span className="text-[9px] text-purple-400 font-medium">Rubl</span>
                                </div>
                              );
                            } else if (currency === 'CNY') {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H11.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h1.33v-1.68c1.72-.3 2.82-1.34 2.82-2.97-.01-2.24-1.85-2.91-4.74-3.21z"/>
                                  </svg>
                                  <span className="text-[9px] text-red-400 font-medium">Yuan</span>
                                </div>
                              );
                            } else {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                                  </svg>
                                  <span className="text-[9px] text-blue-400 font-medium">So'm</span>
                                </div>
                              );
                            }
                          })()}
                        </div>
                      </div>
                      <span className="text-base font-bold text-white">
                        {(() => {
                          const currency = selectedVariant ? selectedVariant.currency : product.currency;
                          // If basePrice is not set, use price as fallback
                          const basePrice = selectedVariant 
                            ? (selectedVariant.basePrice ?? selectedVariant.price ?? 0) 
                            : (product.basePrice ?? product.price ?? 0);
                          const convertedPrice = convertFromUZS(basePrice, currency);
                          return formatMoney(convertedPrice);
                        })()}
                      </span>
                    </div>
                  )}

                  {/* 4. Price Multiplier */}
                  {(selectedVariant ? selectedVariant.priceMultiplier !== undefined : product.priceMultiplier !== undefined) && (
                    <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-red-600/30 rounded-xl p-3 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-900/20 transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-600/20 flex items-center justify-center group-hover:bg-purple-600/30 transition-colors">
                          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                          Foizi
                        </span>
                      </div>
                      <span className="text-base font-bold text-white">
                        {selectedVariant ? selectedVariant.priceMultiplier : product.priceMultiplier}%
                      </span>
                    </div>
                  )}

                  {/* 5. Final Price */}
                  <div className="bg-gradient-to-br from-red-600 via-red-700 to-red-600 border border-red-500/50 rounded-xl p-3 shadow-xl shadow-red-900/50 hover:shadow-2xl hover:shadow-red-900/60 transition-all group">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] uppercase tracking-wider text-red-100 font-semibold">
                          Sotiladigan
                        </span>
                        {(() => {
                          const currency = selectedVariant ? selectedVariant.currency : product.currency;
                          if (currency === 'USD') {
                            return (
                              <div className="flex items-center gap-1">
                                <svg className="w-3 h-3 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                                </svg>
                                <span className="text-[9px] text-green-300 font-medium">Dollar</span>
                              </div>
                            );
                          } else if (currency === 'RUB') {
                            return (
                              <div className="flex items-center gap-1">
                                <svg className="w-3 h-3 text-purple-300" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M14 10.5h-3V9h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zm0-4h-3V5h3c.83 0 1.5.67 1.5 1.5S14.83 7.5 14 7.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2 16h-3v-2H9v-1h2v-2H9v-1h2V9H9V8h2V6h3c1.38 0 2.5 1.12 2.5 2.5 0 .69-.28 1.31-.73 1.76.45.45.73 1.07.73 1.76 0 1.38-1.12 2.5-2.5 2.5z"/>
                                </svg>
                                <span className="text-[9px] text-purple-300 font-medium">Rubl</span>
                              </div>
                            );
                          } else if (currency === 'CNY') {
                            return (
                              <div className="flex items-center gap-1">
                                <svg className="w-3 h-3 text-red-300" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H11.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h1.33v-1.68c1.72-.3 2.82-1.34 2.82-2.97-.01-2.24-1.85-2.91-4.74-3.21z"/>
                                </svg>
                                <span className="text-[9px] text-red-300 font-medium">Yuan</span>
                              </div>
                            );
                          } else {
                            return (
                              <div className="flex items-center gap-1">
                                <svg className="w-3 h-3 text-blue-300" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                                </svg>
                                <span className="text-[9px] text-blue-300 font-medium">So'm</span>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-base font-extrabold text-white">
                        {(() => {
                          const currency = selectedVariant ? selectedVariant.currency : product.currency;
                          const price = selectedVariant ? (selectedVariant.price ?? 0) : product.price;
                          const convertedPrice = convertFromUZS(price, currency);
                          return formatMoney(convertedPrice);
                        })()}
                      </span>
                      {/* Currency description */}
                      {(() => {
                        const currency = selectedVariant ? selectedVariant.currency : product.currency;
                        if (currency && currency !== 'UZS') {
                          const currencyNames: Record<string, string> = {
                            'USD': 'Dollarda',
                            'RUB': 'Rublda',
                            'CNY': 'Yuanda'
                          };
                          return (
                            <span className="text-[9px] text-red-200/80 italic">
                              {currencyNames[currency]} hisoblangan
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>

                  {/* 6. Stock */}
                  <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-red-600/30 rounded-xl p-3 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-900/20 transition-all group">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-green-600/20 flex items-center justify-center group-hover:bg-green-600/30 transition-colors">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                        Omborda
                      </span>
                    </div>
                    <span className="text-base font-bold text-white">
                      {selectedVariant ? (selectedVariant.stock ?? 0) : product.stock} dona
                    </span>
                  </div>

                  {/* 7. Category - only for main product */}
                  {!selectedVariant && product.categoryName && (
                    <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-red-600/30 rounded-xl p-3 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-900/20 transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-yellow-600/20 flex items-center justify-center group-hover:bg-yellow-600/30 transition-colors">
                          <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                          Kategoriya
                        </span>
                      </div>
                      <span className="text-base font-bold text-white truncate block">
                        {product.categoryName}
                      </span>
                    </div>
                  )}

                  {/* 8. Status - for both main product and variant */}
                  {(selectedVariant?.status || (!selectedVariant && product.status)) && (
                    <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-red-600/30 rounded-xl p-3 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-900/20 transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center group-hover:bg-indigo-600/30 transition-colors">
                          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                          Holati
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(selectedVariant?.status === 'available' || (!selectedVariant && product.status === 'available')) && (
                          <>
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-base font-bold text-emerald-400">Yangi</span>
                          </>
                        )}
                        {(selectedVariant?.status === 'pending' || (!selectedVariant && product.status === 'pending')) && (
                          <>
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div>
                            <span className="text-base font-bold text-amber-400">O'rtacha</span>
                          </>
                        )}
                        {(selectedVariant?.status === 'out-of-stock' || (!selectedVariant && product.status === 'out-of-stock')) && (
                          <>
                            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></div>
                            <span className="text-base font-bold text-orange-400">Eski</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 9. Category - for variant */}
                  {selectedVariant?.categoryId && (
                    <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-red-600/30 rounded-xl p-3 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-900/20 transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-600/20 flex items-center justify-center group-hover:bg-purple-600/30 transition-colors">
                          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                          Kategoriya
                        </span>
                      </div>
                      <span className="text-base font-bold text-purple-400">
                        {selectedVariant.categoryName || selectedVariant.categoryId}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Print controls panel */}
          <div className="mt-6 max-w-4xl mx-auto rounded-2xl border border-red-600/30 bg-gradient-to-br from-gray-800/90 via-gray-900/90 to-gray-800/90 backdrop-blur-xl shadow-2xl shadow-red-900/20 p-5 sm:p-6">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    <p className="text-sm uppercase tracking-wider text-red-400 font-semibold">
                      Pechat sozlamalari
                    </p>
                  </div>
                  <p className="text-gray-400 text-xs">
                    Printer, qog'oz o'lchami va nusxa sonini tanlang.
                  </p>
                </div>
                <div className="hidden sm:flex text-xs text-gray-400 items-center gap-2 bg-gray-900/60 border border-red-600/20 rounded-lg px-3 py-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Mahsulot: <span className="font-semibold text-white">{product.name}</span></span>
                </div>
              </div>

              <div className="space-y-4">
                <div className={`grid gap-3 ${sidebarCollapsed ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-gray-400 font-medium">Printer</span>
                    <select
                      value={selectedPrinter}
                      onChange={(e) => setSelectedPrinter(e.target.value)}
                      className="w-full bg-gray-900/60 border border-red-600/30 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all hover:border-red-500/50"
                    >
                      <option value="">Printer tanlang</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                          {d.isDefault ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-gray-400 font-medium">Qog'oz o'lchami</span>
                    <select
                      value={paperSize}
                      onChange={(e) => setPaperSize(e.target.value)}
                      className="w-full bg-gray-900/60 border border-red-600/30 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all hover:border-red-500/50"
                    >
                      {availableSizes.length === 0 && <option value="">Size yo'q</option>}
                      {availableSizes.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-gray-400 font-medium">Nusxa soni</span>
                    <input
                      type="number"
                      min={1}
                      placeholder="1"
                      value={copiesInput}
                      onChange={(e) => setCopiesInput(e.target.value)}
                      className="w-full bg-gray-900/60 border border-red-600/30 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all hover:border-red-500/50"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsSizeConfigOpen((v) => !v)}
                    className="inline-flex items-center self-start rounded-xl border border-red-600/30 bg-gray-900/40 hover:bg-gray-800/60 px-4 py-2 text-xs text-gray-300 hover:text-white transition-all gap-2 hover:border-red-500/50"
                  >
                    <span className="text-base">⚙️</span>
                    <span className="font-medium">Qog'oz size sozlash</span>
                  </button>

                  {isSizeConfigOpen && (
                    <div className="border border-red-600/30 rounded-xl bg-gray-900/40 px-4 py-3 space-y-3">
                      <p className="text-xs text-gray-400">
                        Avval printerni tanlang, so'ng o'sha printer uchun bir yoki bir nechta size kiriting.
                      </p>

                      {selectedPrinter ? (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {availableSizes.length ? (
                              availableSizes.map((size) => (
                                <span
                                  key={size}
                                  className="px-3 py-1 rounded-lg bg-red-900/30 text-white border border-red-600/40 text-xs font-medium"
                                >
                                  {size}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-500 italic">
                                Hozircha size yo'q
                              </span>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={sizeInput}
                              onChange={(e) => setSizeInput(e.target.value)}
                              placeholder="masalan: 58mm yoki 80x200"
                              className="flex-1 bg-gray-900/60 border border-red-600/30 text-white text-sm rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-gray-500"
                            />
                            <button
                              type="button"
                              onClick={handleAddSizeForPrinter}
                              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              disabled={!sizeInput.trim() || !selectedPrinter}
                            >
                              Saqlash
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-red-400">
                          Avval yuqoridan printer tanlang.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="w-full inline-flex items-center justify-center gap-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold px-6 py-3.5 rounded-xl shadow-xl shadow-red-900/50 transition-all text-base hover:shadow-2xl hover:shadow-red-900/60 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                  {isPrinting ? 'Pechat qilinmoqda...' : 'Pechat qilish'}
                </button>
              </div>
            </div>
          </div>

          {/* Statistics Panel */}
          <div className="mt-6 max-w-4xl mx-auto rounded-2xl border border-red-600/30 bg-gradient-to-br from-gray-800/90 via-gray-900/90 to-gray-800/90 backdrop-blur-xl shadow-2xl shadow-red-900/20 p-5 sm:p-6">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-sm uppercase tracking-wider text-blue-400 font-semibold">
                      Statistika
                    </p>
                  </div>
                  <p className="text-gray-400 text-xs">
                    Mahsulotning tan narxi, daromadi va sof foydasi.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tan narx (eski Jami narx) */}
                <div className="group relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-600/10 via-blue-700/10 to-blue-600/10 hover:from-blue-600/20 hover:via-blue-700/20 hover:to-blue-600/20 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-blue-900/30 hover:border-blue-500/50">
                  {/* Background decoration */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-2xl"></div>
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-all">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-blue-300">Tan narx</p>
                          <p className="text-xs text-blue-400/80">Asl narx × Ombordagi soni</p>
                        </div>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-blue-400 group-hover:bg-blue-300 transition-colors animate-pulse"></div>
                    </div>
                    
                    <div className="text-center py-4">
                      <p className="text-3xl font-black text-white mb-2 tracking-tight">
                        {(() => {
                          const currency = selectedVariant ? selectedVariant.currency : product.currency;
                          const basePrice = selectedVariant ? (selectedVariant.basePrice ?? selectedVariant.price ?? 0) : (product.basePrice ?? product.price ?? 0);
                          const stock = selectedVariant ? (selectedVariant.stock ?? 0) : (product.stock ?? 0);
                          const convertedBasePrice = convertFromUZS(basePrice, currency);
                          const total = convertedBasePrice * stock;
                          return formatMoney(total);
                        })()}
                      </p>
                      
                      {/* Currency description */}
                      {(() => {
                        const currency = selectedVariant ? selectedVariant.currency : product.currency;
                        const currencyNames: Record<string, string> = {
                          'USD': 'Dollarda',
                          'RUB': 'Rublda',
                          'CNY': 'Yuanda',
                          'UZS': 'So\'mda'
                        };
                        return (
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-xs font-medium text-blue-300 mb-3">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {currencyNames[currency || 'UZS']} hisoblangan
                          </span>
                        );
                      })()}
                      
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                        <p className="text-xs font-mono text-blue-300/80">
                          {(() => {
                            const currency = selectedVariant ? selectedVariant.currency : product.currency;
                            const basePrice = selectedVariant ? (selectedVariant.basePrice ?? selectedVariant.price ?? 0) : (product.basePrice ?? product.price ?? 0);
                            const stock = selectedVariant ? (selectedVariant.stock ?? 0) : (product.stock ?? 0);
                            const convertedBasePrice = convertFromUZS(basePrice, currency);
                            return `${formatMoney(convertedBasePrice)} × ${stock}`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Daromad (eski Jami narx) */}
                <div className="group relative overflow-hidden rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-600/10 via-green-700/10 to-green-600/10 hover:from-green-600/20 hover:via-green-700/20 hover:to-green-600/20 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-green-900/30 hover:border-green-500/50">
                  {/* Background decoration */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-transparent rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-green-500/10 to-transparent rounded-full blur-2xl"></div>
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/25 group-hover:shadow-green-500/40 transition-all">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-green-300">Daromad</p>
                          <p className="text-xs text-green-400/80">Sotiladigan narx × Ombordagi soni</p>
                        </div>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-green-400 group-hover:bg-green-300 transition-colors animate-pulse"></div>
                    </div>
                    
                    <div className="text-center py-4">
                      <p className="text-3xl font-black text-white mb-2 tracking-tight">
                        {(() => {
                          const currency = selectedVariant ? selectedVariant.currency : product.currency;
                          const price = selectedVariant ? (selectedVariant.price ?? 0) : (product.price ?? 0);
                          const stock = selectedVariant ? (selectedVariant.stock ?? 0) : (product.stock ?? 0);
                          
                          const convertedPrice = convertFromUZS(price, currency);
                          const total = convertedPrice * stock;
                          return formatMoney(total);
                        })()}
                      </p>
                      
                      {/* Currency description */}
                      {(() => {
                        const currency = selectedVariant ? selectedVariant.currency : product.currency;
                        const currencyNames: Record<string, string> = {
                          'USD': 'Dollarda',
                          'RUB': 'Rublda',
                          'CNY': 'Yuanda',
                          'UZS': 'So\'mda'
                        };
                        return (
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-xs font-medium text-green-300 mb-3">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            {currencyNames[currency || 'UZS']} hisoblangan
                          </span>
                        );
                      })()}
                      
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                        <p className="text-xs font-mono text-green-300/80">
                          {(() => {
                            const currency = selectedVariant ? selectedVariant.currency : product.currency;
                            const price = selectedVariant ? (selectedVariant.price ?? 0) : (product.price ?? 0);
                            const stock = selectedVariant ? (selectedVariant.stock ?? 0) : (product.stock ?? 0);
                            
                            const convertedPrice = convertFromUZS(price, currency);
                            return `${formatMoney(convertedPrice)} × ${stock}`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sof foyda (eski Daromad) */}
                <div className="group relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-600/10 via-purple-700/10 to-purple-600/10 hover:from-purple-600/20 hover:via-purple-700/20 hover:to-purple-600/20 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-purple-900/30 hover:border-purple-500/50">
                  {/* Background decoration */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-2xl"></div>
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:shadow-purple-500/40 transition-all">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-purple-300">Sof foyda</p>
                          <p className="text-xs text-purple-400/80">Foizdan kelib chiqadigan foyda</p>
                        </div>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-purple-400 group-hover:bg-purple-300 transition-colors animate-pulse"></div>
                    </div>
                    
                    <div className="text-center py-4">
                      <p className="text-3xl font-black text-white mb-2 tracking-tight">
                        {(() => {
                          const currency = selectedVariant ? selectedVariant.currency : product.currency;
                          const price = selectedVariant ? (selectedVariant.price ?? 0) : (product.price ?? 0);
                          const basePrice = selectedVariant ? (selectedVariant.basePrice ?? selectedVariant.price ?? 0) : (product.basePrice ?? product.price ?? 0);
                          const stock = selectedVariant ? (selectedVariant.stock ?? 0) : (product.stock ?? 0);
                          
                          const convertedPrice = convertFromUZS(price, currency);
                          const convertedBasePrice = convertFromUZS(basePrice, currency);
                          
                          const profit = (convertedPrice - convertedBasePrice) * stock;
                          return formatMoney(profit);
                        })()}
                      </p>
                      
                      {/* Currency description */}
                      {(() => {
                        const currency = selectedVariant ? selectedVariant.currency : product.currency;
                        const currencyNames: Record<string, string> = {
                          'USD': 'Dollarda',
                          'RUB': 'Rublda',
                          'CNY': 'Yuanda',
                          'UZS': 'So\'mda'
                        };
                        return (
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-xs font-medium text-purple-300 mb-3">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            {currencyNames[currency || 'UZS']} hisoblangan
                          </span>
                        );
                      })()}
                      
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
                        <p className="text-xs font-mono text-purple-300/80 break-all">
                          {(() => {
                            const currency = selectedVariant ? selectedVariant.currency : product.currency;
                            const price = selectedVariant ? (selectedVariant.price ?? 0) : (product.price ?? 0);
                            const basePrice = selectedVariant ? (selectedVariant.basePrice ?? selectedVariant.price ?? 0) : (product.basePrice ?? product.price ?? 0);
                            const stock = selectedVariant ? (selectedVariant.stock ?? 0) : (product.stock ?? 0);
                            
                            const convertedPrice = convertFromUZS(price, currency);
                            const convertedBasePrice = convertFromUZS(basePrice, currency);
                            
                            return `(${formatMoney(convertedPrice)} - ${formatMoney(convertedBasePrice)}) × ${stock}`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Qo'shimcha ma'lumot */}
              <div className="bg-gradient-to-br from-gray-800/50 via-gray-900/50 to-gray-800/50 border border-gray-700/40 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-semibold text-gray-300">Batafsil ma'lumotlar</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4 hover:border-gray-600/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-xs text-gray-400 font-medium">Asl narx (birligi)</p>
                    </div>
                    <p className="text-lg font-bold text-white">
                      {(() => {
                        const currency = selectedVariant ? selectedVariant.currency : product.currency;
                        const basePrice = selectedVariant ? (selectedVariant.basePrice ?? selectedVariant.price ?? 0) : (product.basePrice ?? product.price ?? 0);
                        const convertedPrice = convertFromUZS(basePrice, currency);
                        return formatMoney(convertedPrice);
                      })()}
                      <span className="text-xs text-gray-400 ml-1">
                        {(() => {
                          const currency = selectedVariant ? selectedVariant.currency : product.currency;
                          return currency === 'USD' ? 'Dollar' : currency === 'RUB' ? 'Rubl' : currency === 'CNY' ? 'Yuan' : 'So\'m';
                        })()}
                      </span>
                    </p>
                  </div>
                  
                  <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4 hover:border-gray-600/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <p className="text-xs text-gray-400 font-medium">Sotiladigan narx (birligi)</p>
                    </div>
                    <p className="text-lg font-bold text-white">
                      {(() => {
                        const currency = selectedVariant ? selectedVariant.currency : product.currency;
                        const price = selectedVariant ? (selectedVariant.price ?? 0) : (product.price ?? 0);
                        const convertedPrice = convertFromUZS(price, currency);
                        return formatMoney(convertedPrice);
                      })()}
                      <span className="text-xs text-gray-400 ml-1">
                        {(() => {
                          const currency = selectedVariant ? selectedVariant.currency : product.currency;
                          return currency === 'USD' ? 'Dollar' : currency === 'RUB' ? 'Rubl' : currency === 'CNY' ? 'Yuan' : 'So\'m';
                        })()}
                      </span>
                    </p>
                  </div>
                  
                  <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4 hover:border-gray-600/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <p className="text-xs text-gray-400 font-medium">Ombordagi soni</p>
                    </div>
                    <p className="text-lg font-bold text-white">
                      {selectedVariant ? (selectedVariant.stock ?? 0) : (product.stock ?? 0)}
                      <span className="text-xs text-gray-400 ml-1">ta</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </main>

      {/* Print View - Receipt Format (hidden on screen) */}
      <div className="hidden print:block print:pt-8">
        <div className="max-w-[80mm] mx-auto">
          <div className="bg-white p-0">
            {/* Header with logo */}
            <div className="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4">
              <div className="w-16 h-16 mx-auto mb-3 bg-gray-900 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">AvtoFix</h1>
              <p className="text-sm text-gray-600">Avtomobil ehtiyot qismlari</p>
            </div>

            {/* Receipt info */}
            <div className="space-y-2 text-sm border-b-2 border-dashed border-gray-300 pb-4 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Sana:</span>
                <span className="font-semibold text-gray-900">{date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vaqt:</span>
                <span className="font-semibold text-gray-900">{time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Chek №:</span>
                <span className="font-semibold text-gray-900">{product.id}</span>
              </div>
            </div>

            {/* Product details */}
            <div className="space-y-3 border-b-2 border-dashed border-gray-300 pb-4 mb-4">
              <h2 className="font-bold text-gray-900 text-lg">{product.name}</h2>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Mahsulot kodi:</span>
                  <span className="font-semibold text-gray-900">{product.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Omborda:</span>
                  <span className="font-semibold text-gray-900">{product.stock} dona</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Miqdor:</span>
                  <span className="font-semibold text-gray-900">1 x {formatMoney(product.price)}</span>
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="bg-gray-100 py-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">JAMI:</span>
                <span className="text-2xl font-extrabold text-gray-900">{formatMoney(product.price)} so'm</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-4 border-t-2 border-dashed border-gray-300 space-y-2">
              <p className="text-xs text-gray-600">Xaridingiz uchun rahmat!</p>
              <p className="text-xs text-gray-600">Savollar uchun: +998 90 123 45 67</p>
              <div className="pt-3">
                <div className="w-32 h-16 mx-auto bg-gray-200 rounded flex items-center justify-center">
                  <div className="text-xs text-gray-500 font-mono">
                    ||||||||||||||||
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Barcode: {product.code}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print progress floating card – bottom-left (screen only) */}
      {progress && (
        <div className="fixed left-4 bottom-4 z-40 print:hidden">
          <div className="max-w-xs sm:max-w-sm bg-gradient-to-br from-gray-900/98 to-gray-800/98 border-2 border-red-600/50 rounded-2xl px-5 py-4 shadow-2xl shadow-red-900/60 backdrop-blur-xl flex flex-col gap-3">
            {/* Top status */}
            <div className="flex items-center justify-between gap-3">
              <span className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-bold shadow-lg shadow-red-900/50">
                Pechat jarayoni
              </span>
              <span className="text-xs text-gray-300 font-semibold whitespace-nowrap">
                {progress.current} / {progress.total} chek
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-red-500 to-red-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>

            {/* Chips */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
              <span className="px-2 py-1 rounded-lg bg-gray-800/80 border border-red-600/30-md bg-gray-800 border border-red-700/60">
                Printer: {selectedPrinter || 'tanlanmagan'}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-gray-800 border border-red-700/60">
                Qog'oz: {paperSize === '80' ? '80 mm senik' : '58 mm senik'}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-gray-800 border border-red-700/60">
                Nusxa: {(() => {
                  const n = parseInt(copiesInput || '1', 10);
                  return Number.isFinite(n) && n > 0 ? n : 1;
                })()} ta
              </span>
            </div>

            {/* Mini preview */}
            <div className="border-t border-red-700/40 pt-2 mt-1 flex items-center justify-between gap-3 text-[11px] text-gray-200">
              <div className="min-w-0">
                <div className="font-semibold truncate">{product?.name}</div>
                <div className="text-gray-400 truncate">Kod: {product?.code}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-400">Jami summa</div>
                <div className="text-xs font-bold text-yellow-300">{formatMoney(product?.price || 0)} so'm</div>
              </div>
            </div>

            {/* Sample receipt preview */}
            <div className="mt-2 border border-red-700/40 rounded-xl bg-gray-950/80 px-3 py-2 text-[10px] text-gray-200">
              <div className="flex justify-between mb-1">
                <span className="font-semibold">{product?.name}</span>
                <span>{product?.code}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Miqdor:</span>
                <span>1 x {formatMoney(product?.price || 0)} so'm</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-gray-600 pt-1 mt-1">
                <span className="font-semibold">JAMI</span>
                <span className="font-bold text-yellow-300">{formatMoney(product?.price || 0)} so'm</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error notification card – bottom-left, above progress (screen only) */}
      {errorMessage && (
        <div className="fixed left-4 bottom-4 z-50 mb-28 sm:mb-32 print:hidden animate-in slide-in-from-left duration-300">
          <div className="max-w-xs sm:max-w-sm bg-gradient-to-br from-red-900/98 to-red-800/98 border-2 border-red-500/80 rounded-2xl px-5 py-4 shadow-2xl shadow-red-900/70 backdrop-blur-xl text-sm text-white flex items-start gap-3">
            <div className="mt-0.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-base font-bold shadow-lg">!</span>
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm mb-1.5">Xatolik yuz berdi</div>
              <div className="text-red-100">{errorMessage}</div>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="ml-1 text-base text-red-200 hover:text-white transition-colors hover:bg-red-800/50 rounded-lg px-2 py-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Images carousel modal */}
      {isImageModalOpen && product && (() => {
        const images = selectedVariant 
          ? (selectedVariant.imagePreviews && selectedVariant.imagePreviews.length > 0 ? selectedVariant.imagePreviews : [])
          : (product.imagePaths && product.imagePaths.length > 0 ? product.imagePaths : (product.imageUrl ? [product.imageUrl] : []));
        return images.length > 0;
      })() && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 backdrop-blur-sm px-4"
          onClick={() => {
            setIsImageModalOpen(false);
            setCurrentImageIndex(0);
          }}
        >
          <div
            className="relative w-full max-w-6xl bg-gradient-to-br from-gray-800/95 to-gray-900/95 rounded-2xl border-2 border-red-600/40 shadow-2xl shadow-red-900/50 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setIsImageModalOpen(false);
                setCurrentImageIndex(0);
              }}
              className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-2xl text-white transition shadow-lg z-10"
            >
              ×
            </button>
            
            {(() => {
              const images = selectedVariant 
                ? (selectedVariant.imagePreviews && selectedVariant.imagePreviews.length > 0 ? selectedVariant.imagePreviews : [])
                : (product.imagePaths && product.imagePaths.length > 0 ? product.imagePaths : (product.imageUrl ? [product.imageUrl] : []));
              return (
                <div className="flex flex-col gap-4">
                  <div className="relative w-full rounded-xl overflow-hidden bg-gray-900 flex items-center justify-center min-h-[60vh]">
                    <img
                      src={resolveMediaUrl(images[currentImageIndex])}
                      alt={`${product.name} - ${currentImageIndex + 1}`}
                      className="max-h-[85vh] w-auto max-w-full object-contain"
                    />
                    {images.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)}
                          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition-all"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setCurrentImageIndex((prev) => (prev + 1) % images.length)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition-all"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/70 text-white text-sm">
                          {currentImageIndex + 1} / {images.length}
                        </div>
                      </>
                    )}
                  </div>
                  {images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {images.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                            currentImageIndex === idx ? 'border-red-500 scale-105' : 'border-gray-600 hover:border-gray-400'
                          }`}
                        >
                          <img
                            src={resolveMediaUrl(img)}
                            alt={`${product.name} - ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Video modal */}
      {isVideoModalOpen && product.video?.filename && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-sm px-4"
          onClick={() => setIsVideoModalOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl bg-gradient-to-br from-gray-800/95 to-gray-900/95 rounded-2xl border-2 border-red-600/40 shadow-2xl shadow-red-900/50 p-6"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <button
              type="button"
              onClick={() => setIsVideoModalOpen(false)}
              className="absolute -top-4 -right-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-2xl text-white transition shadow-lg z-10"
            >
              ×
            </button>
            
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2">Mahsulot videosi</h3>
                <p className="text-sm text-gray-400">{product.name}</p>
              </div>

              {/* Video player */}
              {product.video.url ? (
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
                  <video
                    controls
                    autoPlay
                    className="w-full h-full"
                    src={product.video.url}
                  >
                    <source src={product.video.url} type="video/mp4" />
                    <source src={product.video.url} type="video/webm" />
                    <source src={product.video.url} type="video/ogg" />
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
                      <p className="text-sm text-white font-mono break-all">{product.video.filename}</p>
                    </div>
                    {product.video.size && (
                      <p className="text-xs text-gray-400 mt-2">
                        Hajmi: {(product.video.size / (1024 * 1024)).toFixed(2)} MB
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
                  <p className="text-white font-medium truncate">{product.video.filename}</p>
                </div>
                {product.video.size && (
                  <div className="bg-gray-900/60 border border-red-600/20 rounded-lg px-3 py-2">
                    <p className="text-gray-400 mb-1">Hajmi</p>
                    <p className="text-white font-medium">{(product.video.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
