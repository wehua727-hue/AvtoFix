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
  imageUrl?: string | null;
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

const formatMoney = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);

// Electron (file://) uchun backendga to'g'ri ulanish
const API_BASE_URL = typeof window !== 'undefined' && window.location.protocol === 'file:'
  ? 'http://127.0.0.1:3000'
  : '';

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
  const [printerSizes, setPrinterSizes] = useState<PrinterSizesMap>({});
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [isSizeConfigOpen, setIsSizeConfigOpen] = useState(false);
  const [sizeInput, setSizeInput] = useState('');

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

          setProduct({
            id: p.id,
            name: p.name,
            code: p.sku ?? "",
            stock: typeof p.stock === "number" ? p.stock : 0,
            price: typeof p.price === "number" ? p.price : 0,
            imageUrl: p.imageUrl ?? null,
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
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-600/40 bg-gray-900/60 text-sm text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-500/60 transition-all shadow-lg"
            >
              <span className="text-lg">←</span>
              <span className="font-semibold">Orqaga</span>
            </button>
          </div>

          {/* Sizes / variants (xillar) - Improved Design */}
          {sizes.length > 0 && (
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
                {sizes.map((size, idx) => (
                  <div
                    key={`${size.label}-${size.price ?? 'no-price'}-${idx}`}
                    className="group relative overflow-hidden rounded-xl border border-red-600/30 bg-gradient-to-br from-gray-900/80 to-gray-800/80 hover:from-red-900/30 hover:to-gray-900/80 px-4 py-3 transition-all duration-300 hover:shadow-lg hover:shadow-red-900/30 hover:border-red-500/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 group-hover:bg-red-400 transition-colors"></div>
                        <span className="font-bold text-white text-base group-hover:text-red-100 transition-colors">
                          {size.label}
                        </span>
                      </div>
                      {size.price ? (
                        <span className="text-sm font-semibold text-red-400 group-hover:text-red-300 transition-colors whitespace-nowrap">
                          {size.price} so'm
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500 italic">Narx yo'q</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main product card */}
          <div className="max-w-4xl mx-auto rounded-2xl border border-red-600/30 bg-gradient-to-br from-gray-800/90 via-gray-900/90 to-gray-800/90 backdrop-blur-xl shadow-2xl shadow-red-900/20 p-5 sm:p-7">
            <div className="flex flex-col md:flex-row gap-6 items-stretch">
              {/* Left: Product media (image or video) */}
              <div className="flex-shrink-0 flex flex-col gap-3">
                {/* Main media display */}
                <div 
                  className="w-full md:w-48 aspect-square rounded-2xl overflow-hidden border-2 border-red-600/40 bg-gray-900/60 flex items-center justify-center shadow-xl shadow-red-900/30 hover:border-red-500/60 transition-all cursor-pointer group"
                  onClick={() => {
                    if (product.video?.filename) {
                      setIsVideoModalOpen(true);
                    }
                  }}
                >
                  {product.imageUrl ? (
                    <img
                      src={resolveMediaUrl(product.imageUrl)}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : product.video?.filename ? (
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
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-gray-500">Media yo'q</span>
                    </div>
                  )}
                </div>
                
                {/* Media info badges */}
                {(product.imageUrl || product.video?.filename) && (
                  <div className="flex flex-col gap-1.5">
                    {product.imageUrl && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/60 border border-red-600/20">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs text-gray-300">Rasm mavjud</span>
                      </div>
                    )}
                    {product.video?.filename && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/60 border border-red-600/20">
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs text-gray-300">Video mavjud</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Product info */}
              <div className="flex-1 min-w-0 flex flex-col gap-5">
                {/* Name */}
                <div>
                  <p className="text-xs uppercase tracking-wider text-red-400 mb-2 font-semibold">Mahsulot nomi</p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white break-words leading-tight">
                    {product.name}
                  </h2>
                </div>

                {/* Info grid: Code, Stock, Price */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Code */}
                  <div className="bg-gray-900/60 border border-red-600/20 rounded-xl p-3 hover:border-red-500/40 transition-all">
                    <span className="text-xs uppercase tracking-wider text-gray-400 block mb-1.5">
                      Mahsulot kodi
                    </span>
                    <span className="text-base sm:text-lg font-bold text-white">
                      {product.code}
                    </span>
                  </div>

                  {/* Stock */}
                  <div className="bg-gray-900/60 border border-red-600/20 rounded-xl p-3 hover:border-red-500/40 transition-all">
                    <span className="text-xs uppercase tracking-wider text-gray-400 block mb-1.5">
                      Omborda
                    </span>
                    <span className="text-base sm:text-lg font-bold text-white">
                      {product.stock} dona
                    </span>
                  </div>

                  {/* Price */}
                  <div className="md:col-span-1 col-span-2 bg-gradient-to-br from-red-600 to-red-700 border border-red-500/50 rounded-xl p-3 shadow-lg shadow-red-900/40">
                    <span className="text-xs uppercase tracking-wider text-red-100 block mb-1.5">
                      Narx
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl sm:text-2xl font-extrabold text-white">
                        {formatMoney(product.price)}
                      </span>
                      <span className="text-sm font-semibold text-red-100">so'm</span>
                    </div>
                  </div>
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
