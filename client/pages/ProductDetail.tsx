import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tag, Loader2, Printer } from 'lucide-react';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';
import { useAuth } from '@/lib/auth-context';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
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

interface Product {
  id: string;
  name: string;
  code?: string; // Excel dan kelgan kod
  catalogNumber?: string; // Excel dan kelgan katalog
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
  code?: string; // Excel dan kelgan kod
  catalogNumber?: string; // Excel dan kelgan katalog
  basePrice?: number;
  priceMultiplier?: number;
  price?: number;
  currency?: 'USD' | 'RUB' | 'CNY' | 'UZS';
  categoryId?: string;
  categoryName?: string;
  stock?: number;
  status?: string;
  imagePaths?: string[];
  imagePreviews?: string[];
}

const formatMoney = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);

// Pul birligi nomlarini qaytarish (belgi bilan)
const getCurrencyName = (currency?: string): string => {
  const names: Record<string, string> = {
    'USD': 'dollar ($)',
    'RUB': 'rubl (₽)',
    'CNY': 'yuan (¥)',
    'UZS': "so'm"
  };
  return names[currency || 'UZS'] || "so'm";
};

// Pul birligi qisqa nomini qaytarish (faqat belgi yoki qisqa nom)
const getCurrencyShort = (currency?: string): string => {
  const shorts: Record<string, string> = {
    'USD': '$',
    'RUB': '₽',
    'CNY': '¥',
    'UZS': "so'm"
  };
  return shorts[currency || 'UZS'] || "so'm";
};

// Pul birligi belgisini qaytarish
const getCurrencySymbol = (currency?: string): string => {
  const symbols: Record<string, string> = {
    'USD': '$',
    'RUB': '₽',
    'CNY': '¥',
    'UZS': "so'm"
  };
  return symbols[currency || 'UZS'] || "so'm";
};

// Electron (file://) uchun backendga to'g'ri ulanish
// API base URL - production va development uchun
const API_BASE_URL = (() => {
  if (typeof window === 'undefined') return '';
  
  // Electron (file://) uchun - port 5175
  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:5175';
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
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
  
  // Senik chop etish state'lari
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [labelDialogProduct, setLabelDialogProduct] = useState<{ name: string; price: number; sku: string; stock: number; productId: string } | null>(null);
  const [labelQuantity, setLabelQuantity] = useState<number | null>(null);
  const [labelSize, setLabelSize] = useState<LabelSize>('large');
  const [customLabelWidth, setCustomLabelWidth] = useState<number>(DEFAULT_LABEL_WIDTH);
  const [customLabelHeight, setCustomLabelHeight] = useState<number>(DEFAULT_LABEL_HEIGHT);
  const [useCustomSize, setUseCustomSize] = useState<boolean>(false);
  const [labelPrinters, setLabelPrinters] = useState<PrinterInfo[]>([]);
  const [selectedLabelPrinter, setSelectedLabelPrinter] = useState<string | null>(null);
  const [isLabelPrinting, setIsLabelPrinting] = useState(false);
  
  // Printerlarni yuklash
  useEffect(() => {
    const loadPrinters = async () => {
      try {
        const printerList = await listPrinters();
        setLabelPrinters(printerList);
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
      setIsLoading(true);
      // Load from MongoDB via /api/products/:id
      try {
        // Добавляем userId и userPhone для проверки доступа
        const params = new URLSearchParams();
        if (user?.id) params.append('userId', user.id);
        if (user?.phone) params.append('userPhone', user.phone);
        const queryString = params.toString();
        const url = `${API_BASE_URL}/api/products/${id}${queryString ? `?${queryString}` : ''}`;
        
        const res = await fetch(url, {
          headers: user?.id ? { 'x-user-id': user.id } : {}
        });
        if (!res.ok) {
          setIsLoading(false);
          return;
        }
        const data = await res.json();
        if (data?.success && data.product && !isCancelled) {
          const rawProduct = data.product;
          const p = {
            ...rawProduct,
            id: rawProduct.id || rawProduct._id, // MongoDB _id fallback
          } as {
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
          const rawVariantSummaries = (p as any).variantSummaries;
          const productCurrency = (p as any).currency || 'UZS'; // Mahsulotning valyutasi
          console.log('[ProductDetail] Raw variantSummaries from API:', rawVariantSummaries);
          console.log('[ProductDetail] Product currency:', productCurrency);
          if (Array.isArray(rawVariantSummaries) && rawVariantSummaries.length > 0) {
            const parsedVariants: VariantSummary[] = rawVariantSummaries.map((v: any) => {
              // String qiymatlarni number ga aylantirish
              const parsedBasePrice = v.basePrice != null ? Number(v.basePrice) : undefined;
              const parsedPriceMultiplier = v.priceMultiplier != null ? Number(v.priceMultiplier) : undefined;
              const parsedPrice = v.price != null ? Number(v.price) : undefined;
              const parsedStock = v.stock != null ? Number(v.stock) : undefined;
              
              return {
                name: (v.name || '').toString().trim(),
                sku: typeof v.sku === 'string' ? v.sku : (v.sku != null ? String(v.sku) : undefined),
                code: typeof v.code === 'string' ? v.code : (v.code != null ? String(v.code) : undefined), // Excel dan kelgan kod
                catalogNumber: typeof v.catalogNumber === 'string' ? v.catalogNumber : (v.catalogNumber != null ? String(v.catalogNumber) : undefined), // Katalog raqami
                basePrice: parsedBasePrice != null && !isNaN(parsedBasePrice) ? parsedBasePrice : undefined,
                priceMultiplier: parsedPriceMultiplier != null && !isNaN(parsedPriceMultiplier) ? parsedPriceMultiplier : undefined,
                price: parsedPrice != null && !isNaN(parsedPrice) ? parsedPrice : undefined,
                currency: v.currency || productCurrency, // Xilning valyutasi yoki mahsulotning valyutasi
                categoryId: typeof v.categoryId === 'string' ? v.categoryId : undefined,
                stock: parsedStock != null && !isNaN(parsedStock) ? parsedStock : undefined,
                status: typeof v.status === 'string' ? v.status : undefined,
                imagePaths: Array.isArray(v.imagePaths) ? v.imagePaths : [],
                imagePreviews: Array.isArray(v.imagePaths) ? v.imagePaths.map((path: string) => resolveMediaUrl(path)) : [],
              };
            });
            console.log('[ProductDetail] Parsed variantSummaries:', parsedVariants);
            
            // Xillar uchun kategoriya nomlarini olish
            if (user?.id) {
              try {
                const params = new URLSearchParams({ userId: user.id });
                if (user.phone) {
                  params.append('userPhone', user.phone);
                }
                const catRes = await fetch(`${API_BASE_URL}/api/categories?${params}`);
                if (catRes.ok) {
                  const catData = await catRes.json();
                  if (Array.isArray(catData?.categories)) {
                    // Har bir xilga kategoriya nomini qo'shish
                    parsedVariants.forEach((variant) => {
                      if (variant.categoryId) {
                        const category = catData.categories.find((c: any) => 
                          (c.id || c._id) === variant.categoryId
                        );
                        if (category) {
                          variant.categoryName = category.name || undefined;
                        }
                      }
                    });
                  }
                }
              } catch (err) {
                console.error('[ProductDetail] Failed to fetch categories for variants:', err);
              }
            }
            
            setVariantSummaries(parsedVariants);
          } else {
            console.log('[ProductDetail] No variantSummaries found');
            setVariantSummaries([]);
          }

          const imagePaths = Array.isArray((p as any).imagePaths) ? (p as any).imagePaths : (p.imageUrl ? [p.imageUrl] : []);
          
          // Fetch category name if categoryId exists
          let categoryName: string | null = null;
          if ((p as any).categoryId && user?.id) {
            try {
              const params = new URLSearchParams({ userId: user.id });
              if (user.phone) {
                params.append('userPhone', user.phone);
              }
              const catRes = await fetch(`${API_BASE_URL}/api/categories?${params}`);
              if (catRes.ok) {
                const catData = await catRes.json();
                if (Array.isArray(catData?.categories)) {
                  const category = catData.categories.find((c: any) => 
                    (c.id || c._id) === (p as any).categoryId
                  );
                  if (category) {
                    categoryName = category.name || null;
                  }
                }
              }
            } catch (err) {
              console.error('[ProductDetail] Failed to fetch category:', err);
            }
          }
          
          // String qiymatlarni number ga aylantirish
          const parsedBasePrice = (p as any).basePrice != null ? Number((p as any).basePrice) : undefined;
          const parsedPriceMultiplier = (p as any).priceMultiplier != null ? Number((p as any).priceMultiplier) : undefined;
          const parsedStock = p.stock != null ? Number(p.stock) : 0;
          const parsedPrice = p.price != null ? Number(p.price) : 0;
          
          setProduct({
            id: p.id,
            name: p.name,
            code: (p as any).code ?? "", // Excel dan kelgan kod
            catalogNumber: (p as any).catalogNumber ?? "", // Excel dan kelgan katalog
            stock: !isNaN(parsedStock) ? parsedStock : 0,
            price: !isNaN(parsedPrice) ? parsedPrice : 0,
            basePrice: parsedBasePrice != null && !isNaN(parsedBasePrice) ? parsedBasePrice : undefined,
            priceMultiplier: parsedPriceMultiplier != null && !isNaN(parsedPriceMultiplier) ? parsedPriceMultiplier : undefined,
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
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [id, user?.id, user?.phone]);

  // WebSocket orqali product-updated eventini tinglash
  // Kassa da sotganda stock yangilanadi va bu yerda real-time ko'rinadi
  useEffect(() => {
    if (!id || !user?.id) return;
    
    const handleProductUpdated = (event: CustomEvent<{ productId: string; productName: string }>) => {
      const { productId } = event.detail;
      
      // Faqat joriy mahsulot yangilangan bo'lsa
      if (productId !== id) return;
      
      console.log('[ProductDetail] product-updated event received:', productId);
      
      // Mahsulotni serverdan qayta yuklash
      const params = new URLSearchParams();
      if (user?.id) params.append('userId', user.id);
      if (user?.phone) params.append('userPhone', user.phone);
      const queryString = params.toString();
      
      fetch(`${API_BASE_URL}/api/products/${id}${queryString ? `?${queryString}` : ''}`)
        .then(res => res.json())
        .then(data => {
          if (data?.success && data.product) {
            const rawProduct = data.product;
            
            // Stock va variantSummaries ni yangilash
            setProduct(prev => prev ? {
              ...prev,
              stock: rawProduct.stock ?? prev.stock,
            } : prev);
            
            // VariantSummaries ni yangilash
            if (Array.isArray(rawProduct.variantSummaries)) {
              const parsedVariants: VariantSummary[] = rawProduct.variantSummaries.map((v: any) => ({
                name: (v.name || '').toString().trim(),
                sku: typeof v.sku === 'string' ? v.sku : (v.sku != null ? String(v.sku) : undefined),
                code: typeof v.code === 'string' ? v.code : (v.code != null ? String(v.code) : undefined), // Excel dan kelgan kod
                catalogNumber: typeof v.catalogNumber === 'string' ? v.catalogNumber : (v.catalogNumber != null ? String(v.catalogNumber) : undefined),
                basePrice: v.basePrice != null ? Number(v.basePrice) : undefined,
                priceMultiplier: v.priceMultiplier != null ? Number(v.priceMultiplier) : undefined,
                price: v.price != null ? Number(v.price) : undefined,
                currency: v.currency || rawProduct.currency || 'UZS',
                stock: v.stock != null ? Number(v.stock) : undefined,
                status: typeof v.status === 'string' ? v.status : undefined,
                imagePaths: Array.isArray(v.imagePaths) ? v.imagePaths : [],
                imagePreviews: Array.isArray(v.imagePaths) ? v.imagePaths.map((path: string) => resolveMediaUrl(path)) : [],
              }));
              setVariantSummaries(parsedVariants);
            }
            
            console.log('[ProductDetail] Product updated from event, stock:', rawProduct.stock);
          }
        })
        .catch(err => {
          console.error('[ProductDetail] Failed to reload product after update:', err);
        });
    };
    
    window.addEventListener('product-updated', handleProductUpdated as EventListener);
    
    return () => {
      window.removeEventListener('product-updated', handleProductUpdated as EventListener);
    };
  }, [id, user?.id, user?.phone]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onCollapsedChange={setSidebarCollapsed}
        />
        <Navbar onMenuClick={() => setSidebarOpen(true)} sidebarCollapsed={sidebarCollapsed} />
        <div className={`flex-1 flex items-center justify-center px-4 pt-16 pb-8 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'
        }`}>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-900/30 border-2 border-blue-600/40 mb-4">
              <svg className="w-10 h-10 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Mahsulot yuklanmoqda...</h2>
            <p className="text-muted-foreground mb-6">Iltimos, biroz kuting</p>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onCollapsedChange={setSidebarCollapsed}
        />
        <Navbar onMenuClick={() => setSidebarOpen(true)} sidebarCollapsed={sidebarCollapsed} />
        <div className={`flex-1 flex items-center justify-center px-4 pt-16 pb-8 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'
        }`}>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-900/30 border-2 border-red-600/40 mb-4">
              <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Mahsulot topilmadi</h2>
            <p className="text-muted-foreground mb-6">Siz qidirayotgan mahsulot mavjud emas</p>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-primary/40 bg-card/60 text-foreground hover:bg-primary/10 hover:border-primary/60 transition-all shadow-lg"
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
    <div className="min-h-screen bg-gray-900 text-foreground print:bg-white flex flex-col">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />
      <Navbar onMenuClick={() => setSidebarOpen(true)} sidebarCollapsed={sidebarCollapsed} />

      {/* Screen View - Modern Product Details */}
      <main
        className={`flex-1 overflow-y-auto pt-12 sm:pt-14 lg:pt-16 pb-8 print:hidden transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header row (title + back button) aligned with main card */}
          <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/40 bg-card/60 text-sm text-foreground hover:bg-primary/10 hover:text-foreground hover:border-primary/60 transition-all shadow-lg"
            >
              <span className="text-lg">←</span>
              <span className="font-semibold">Orqaga</span>
            </button>
          </div>

          {/* Sizes / variants (xillar) - Improved Design - Only show when no variant is selected */}
          {!selectedVariant && (variantSummaries.length > 0 || sizes.length > 0) && (
            <div className="max-w-4xl mx-auto mb-6 rounded-lg border border-border bg-card p-5 sm:p-6">
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
                      console.log('[ProductDetail] Selected variant:', variant);
                      console.log('[ProductDetail] Variant currency:', variant.currency);
                      console.log('[ProductDetail] Product currency:', product.currency);
                      setSelectedVariant(variant);
                    }}
                    className="group relative overflow-hidden rounded-lg border border-border bg-card hover:bg-muted px-4 py-3 transition-all duration-300 hover:border-border cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 group-hover:bg-red-400 transition-colors"></div>
                        {variant.sku && (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-700/60 px-1.5 py-0.5 rounded">
                            #{variant.sku}
                          </span>
                        )}
                        <span className="font-bold text-foreground text-base group-hover:text-primary transition-colors">
                          {variant.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Senik chop etish tugmasi */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Senik uchun faqat xilning o'z nomi
                            // 5 talik kod olish - MUHIM: code -> catalogNumber -> sku tartibida
                            const variantCode = (variant as any).code || (variant as any).catalogNumber || variant.sku || '';
                            
                            setLabelDialogProduct({
                              name: variant.name,
                              price: variant.price ?? product.price ?? 0,
                              sku: variant.sku || product.code || '',
                              stock: variant.stock ?? product.stock ?? 0,
                              productId: `${product.id}-v${idx}`,
                              code: variantCode // 5 talik kod qo'shamiz
                            } as any);
                            setLabelQuantity(null);
                            setLabelSize('large');
                            setCustomLabelWidth(DEFAULT_LABEL_WIDTH);
                            setCustomLabelHeight(DEFAULT_LABEL_HEIGHT);
                            setUseCustomSize(false);
                            setLabelDialogOpen(true);
                          }}
                          disabled={isLabelPrinting}
                          className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-amber-600 hover:bg-amber-500 text-white transition-all z-10"
                          title="Senik chop etish"
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex flex-col items-end gap-1">
                        {variant.price ? (
                          <span className="text-sm font-semibold text-red-400 group-hover:text-red-300 transition-colors whitespace-nowrap flex items-center gap-1">
                            {(variant.currency || product.currency) === 'USD' && <span className="text-green-400">$</span>}
                            {(variant.currency || product.currency) === 'RUB' && <span className="text-purple-400">₽</span>}
                            {(variant.currency || product.currency) === 'CNY' && <span className="text-yellow-400">¥</span>}
                            {formatMoney(variant.price)}
                            {(!(variant.currency || product.currency) || (variant.currency || product.currency) === 'UZS') && <span className="text-blue-400">so'm</span>}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Narx yo'q</span>
                        )}
                      </div>
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
                    className="group relative overflow-hidden rounded-lg border border-border bg-card hover:bg-muted px-4 py-3 transition-all duration-300 hover:border-border cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 group-hover:bg-red-400 transition-colors"></div>
                        <span className="font-bold text-foreground text-base group-hover:text-primary transition-colors">
                          {size.label}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                      {size.price ? (
                        <span className="text-sm font-semibold text-red-400 group-hover:text-red-300 transition-colors whitespace-nowrap flex items-center gap-1">
                          {product.currency === 'USD' && <span className="text-green-400">$</span>}
                          {product.currency === 'RUB' && <span className="text-purple-400">₽</span>}
                          {product.currency === 'CNY' && <span className="text-yellow-400">¥</span>}
                          {size.price}
                          {(!product.currency || product.currency === 'UZS') && <span className="text-blue-400">so'm</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Narx yo'q</span>
                      )}
                    </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main product card or variant card */}
          <div className="max-w-4xl mx-auto rounded-lg border border-border bg-card p-5 sm:p-7">
            <div className="flex flex-col md:flex-row gap-6 items-stretch">
              {/* Left: Product media (image or video) - HIDDEN */}
              <div className="flex-shrink-0 flex-col gap-3 hidden">
                {/* Main media display with carousel */}
                <div 
                  className="w-full md:w-48 aspect-square rounded-lg overflow-hidden border-2 border-border bg-muted flex items-center justify-center hover:border-border transition-all cursor-pointer group relative"
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
                              <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-background/80 backdrop-blur-sm text-foreground text-xs sm:text-sm font-semibold shadow-lg">
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
                          <p className="text-xs text-muted-foreground font-medium group-hover:text-foreground transition-colors">Video mavjud</p>
                          <p className="text-[10px] text-muted-foreground break-all">{product.video.filename}</p>
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
                          <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs text-muted-foreground">Media yo'q</span>
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

              {/* Right: Product info */}
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                {/* 1. Name - Full width */}
                <div className="col-span-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs uppercase tracking-wider text-red-400 mb-1.5 font-semibold">
                        {selectedVariant ? 'Xil nomi' : 'Mahsulot nomi'}
                      </p>
                      <h2 className="text-xl sm:text-2xl font-bold text-foreground break-words leading-tight">
                        {selectedVariant ? selectedVariant.name : product.name}
                      </h2>
                    </div>
                    {/* Senik chop etish tugmasi */}
                    <button
                      type="button"
                      onClick={() => {
                        // Senik uchun faqat xilning o'z nomi yoki mahsulot nomi
                        const displayName = selectedVariant ? selectedVariant.name : product.name;
                        const displayPrice = selectedVariant ? (selectedVariant.price ?? product.price ?? 0) : (product.price ?? 0);
                        const displaySku = selectedVariant ? (selectedVariant.sku || product.code || '') : (product.code || '');
                        const displayStock = selectedVariant ? (selectedVariant.stock ?? product.stock ?? 0) : (product.stock ?? 0);
                        
                        // 5 talik kod olish - MUHIM: code -> catalogNumber -> sku tartibida
                        let displayCode = '';
                        if (selectedVariant) {
                          displayCode = (selectedVariant as any).code || (selectedVariant as any).catalogNumber || selectedVariant.sku || '';
                        } else {
                          displayCode = (product as any).code || (product as any).catalogNumber || product.sku || '';
                        }
                        
                        // Agar xil tanlangan bo'lsa, uning indexini topamiz
                        let displayId = product.id;
                        if (selectedVariant) {
                          const variantIdx = variantSummaries.findIndex(v => 
                            v.name === selectedVariant.name && v.sku === selectedVariant.sku
                          );
                          if (variantIdx >= 0) {
                            displayId = `${product.id}-v${variantIdx}`;
                          }
                        }
                        
                        setLabelDialogProduct({
                          name: displayName,
                          price: displayPrice,
                          sku: displaySku,
                          stock: displayStock,
                          productId: displayId,
                          code: displayCode // 5 talik kod qo'shamiz
                        } as any);
                        setLabelQuantity(null);
                        setLabelSize('large');
                        setCustomLabelWidth(DEFAULT_LABEL_WIDTH);
                        setCustomLabelHeight(DEFAULT_LABEL_HEIGHT);
                        setUseCustomSize(false);
                        setLabelDialogOpen(true);
                      }}
                      disabled={isLabelPrinting}
                      className="flex-shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-lg shadow-amber-500/30"
                      title="Senik chop etish"
                    >
                      <Tag className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Grid for cards - Kod va Katalog */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Mahsulot kodi (Excel dan) */}
                  {(selectedVariant ? (selectedVariant as any).code : (product as any).code) && (
                    <div className="bg-card border border-border rounded-lg p-3 hover:border-border transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                          </svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Kod
                        </span>
                      </div>
                      <span className="text-base font-bold text-foreground">
                        {selectedVariant ? (selectedVariant as any).code : (product as any).code}
                      </span>
                    </div>
                  )}

                  {/* Katalog raqami (Excel dan) */}
                  {(selectedVariant ? (selectedVariant as any).catalogNumber : (product as any).catalogNumber) && (
                    <div className="bg-card border border-border rounded-lg p-3 hover:border-border transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-red-600/20 flex items-center justify-center group-hover:bg-red-600/30 transition-colors">
                          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Katalog №
                        </span>
                      </div>
                      <span className="text-base font-bold text-foreground">
                        {selectedVariant ? (selectedVariant as any).catalogNumber : (product as any).catalogNumber}
                      </span>
                    </div>
                  )}
                </div>

                {/* Grid for price cards - 2 columns */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Base Price */}
                  {(selectedVariant ? selectedVariant.basePrice !== undefined : product.basePrice !== undefined) && (
                    <div className="bg-card border border-border rounded-lg p-3 hover:border-border transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Asl narxi
                        </span>
                      </div>
                      <span className="text-base font-bold text-white flex items-center gap-1.5">
                        {((selectedVariant?.currency || product.currency) === 'USD') && <span className="text-green-400 text-lg">$</span>}
                        {((selectedVariant?.currency || product.currency) === 'RUB') && <span className="text-purple-400 text-lg">₽</span>}
                        {((selectedVariant?.currency || product.currency) === 'CNY') && <span className="text-yellow-400 text-lg">¥</span>}
                        {formatMoney(selectedVariant ? (selectedVariant.basePrice ?? 0) : (product.basePrice ?? 0))}
                        {(!(selectedVariant?.currency || product.currency) || (selectedVariant?.currency || product.currency) === 'UZS') && <span className="text-blue-400">so'm</span>}
                      </span>
                    </div>
                  )}

                  {/* Price Multiplier */}
                  {(selectedVariant ? selectedVariant.priceMultiplier !== undefined : product.priceMultiplier !== undefined) && (
                    <div className="bg-card border border-border rounded-lg p-3 hover:border-border transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-600/20 flex items-center justify-center group-hover:bg-purple-600/30 transition-colors">
                          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Foizi
                        </span>
                      </div>
                      <span className="text-base font-bold text-foreground">
                        {selectedVariant ? selectedVariant.priceMultiplier : product.priceMultiplier}%
                      </span>
                    </div>
                  )}

                  {/* 5. Final Price */}
                  <div className="bg-grey-900 border border-gray-900 rounded-lg p-3 hover:bg-gray-800 transition-all group">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-gray-300 font-semibold">
                        Sotiladigan
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-base font-extrabold text-white flex items-center gap-1.5">
                        {((selectedVariant?.currency || product.currency) === 'USD') && <span className="text-green-300 text-xl">$</span>}
                        {((selectedVariant?.currency || product.currency) === 'RUB') && <span className="text-purple-300 text-xl">₽</span>}
                        {((selectedVariant?.currency || product.currency) === 'CNY') && <span className="text-yellow-300 text-xl">¥</span>}
                        {formatMoney(selectedVariant ? (selectedVariant.price ?? 0) : product.price)}
                      </span>
                      <span className="text-[10px] font-semibold text-red-100 flex items-center gap-1">
                        {((selectedVariant?.currency || product.currency) === 'USD') && <span className="text-green-300">dollar</span>}
                        {((selectedVariant?.currency || product.currency) === 'RUB') && <span className="text-purple-300">rubl</span>}
                        {((selectedVariant?.currency || product.currency) === 'CNY') && <span className="text-yellow-300">yuan</span>}
                        {(!(selectedVariant?.currency || product.currency) || (selectedVariant?.currency || product.currency) === 'UZS') && <span>so'm</span>}
                      </span>
                    </div>
                  </div>

                  {/* 6. Stock */}
                  <div className="bg-card border border-border rounded-lg p-3 hover:border-border transition-all group">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-green-600/20 flex items-center justify-center group-hover:bg-green-600/30 transition-colors">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Omborda
                      </span>
                    </div>
                    <span className="text-base font-bold text-foreground">
                      {selectedVariant ? (selectedVariant.stock ?? 0) : product.stock} dona
                    </span>
                  </div>

                  {/* 7. Category - for both main product and variant */}
                  {(selectedVariant?.categoryName || (!selectedVariant && product.categoryName)) && (
                    <div className="bg-card border border-border rounded-lg p-3 hover:border-border transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-yellow-600/20 flex items-center justify-center group-hover:bg-yellow-600/30 transition-colors">
                          <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Kategoriya
                        </span>
                      </div>
                      <span className="text-base font-bold text-white truncate block">
                        {selectedVariant ? selectedVariant.categoryName : product.categoryName}
                      </span>
                    </div>
                  )}

                  {/* 8. Status - for both main product and variant */}
                  {(selectedVariant?.status || (!selectedVariant && product.status)) && (
                    <div className={`bg-grey-900 border border-gray-950 rounded-xl p-3 hover:border-gray-800 transition-all group ${!selectedVariant && !product.categoryName ? 'col-span-2' : ''}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center group-hover:bg-indigo-600/30 transition-colors">
                          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
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
                </div>
              </div>
            </div>
          </div>


          {/* Statistics Panel */}
          <div className="mt-6 max-w-4xl mx-auto rounded-lg border border-border bg-card p-5 sm:p-6">
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
                  <p className="text-muted-foreground text-xs">
                    Mahsulotning jami narxi va sof foydasi.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 1. Tan narx = Asl narx × Ombor */}
                <div className="group relative overflow-hidden rounded-lg border border-primary/50 bg-card hover:bg-muted p-5 transition-all duration-300 hover:border-primary">
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-blue-300">Tan narx</p>
                        <p className="text-[10px] text-blue-400/80">Asl narx × Ombor</p>
                      </div>
                    </div>
                    <div className="text-center py-2">
                      <p className="text-2xl font-black text-white mb-1">
                        {formatMoney(
                          (selectedVariant ? (selectedVariant.basePrice ?? 0) : (product.basePrice ?? 0)) * 
                          (selectedVariant ? (selectedVariant.stock ?? 0) : (product.stock ?? 0))
                        )}
                      </p>
                      <p className="text-xs font-semibold text-blue-300">
                        {getCurrencyName(selectedVariant?.currency || product.currency)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Daromad = Sotiladigan narx × Ombor */}
                <div className="group relative overflow-hidden rounded-lg border border-green-600/50 bg-gray-900 hover:bg-gray-800 p-5 transition-all duration-300 hover:border-green-500">
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-green-300">Daromad</p>
                        <p className="text-[10px] text-green-400/80">Sotish × Ombor</p>
                      </div>
                    </div>
                    <div className="text-center py-2">
                      <p className="text-2xl font-black text-white mb-1">
                        {formatMoney(
                          (selectedVariant ? (selectedVariant.price ?? 0) : (product.price ?? 0)) * 
                          (selectedVariant ? (selectedVariant.stock ?? 0) : (product.stock ?? 0))
                        )}
                      </p>
                      <p className="text-xs font-semibold text-green-300">
                        {getCurrencyName(selectedVariant?.currency || product.currency)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Sof foyda = Daromad - Tan narx */}
                <div className="group relative overflow-hidden rounded-lg border border-purple-600/50 bg-gray-900 hover:bg-gray-800 p-5 transition-all duration-300 hover:border-purple-500">
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-purple-300">Sof foyda</p>
                        <p className="text-[10px] text-purple-400/80">Daromad - Tan narx</p>
                      </div>
                    </div>
                    <div className="text-center py-2">
                      <p className="text-2xl font-black text-white mb-1">
                        {formatMoney(
                          ((selectedVariant ? (selectedVariant.price ?? 0) : (product.price ?? 0)) * 
                           (selectedVariant ? (selectedVariant.stock ?? 0) : (product.stock ?? 0))) -
                          ((selectedVariant ? (selectedVariant.basePrice ?? 0) : (product.basePrice ?? 0)) * 
                           (selectedVariant ? (selectedVariant.stock ?? 0) : (product.stock ?? 0)))
                        )}
                      </p>
                      <p className="text-xs font-semibold text-purple-300">
                        {getCurrencyName(selectedVariant?.currency || product.currency)}
                      </p>
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
                      {formatMoney(selectedVariant ? (selectedVariant.basePrice ?? selectedVariant.price ?? 0) : (product.basePrice ?? product.price ?? 0))}
                      <span className="text-xs text-gray-400 ml-1">{getCurrencyName(selectedVariant?.currency || product.currency)}</span>
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
                      {formatMoney(selectedVariant ? (selectedVariant.price ?? 0) : (product.price ?? 0))}
                      <span className="text-xs text-gray-400 ml-1">{getCurrencyName(selectedVariant?.currency || product.currency)}</span>
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
                <span className="text-2xl font-extrabold text-gray-900">{formatMoney(product.price)} {getCurrencyName(product.currency)}</span>
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
                <div className="text-xs font-bold text-yellow-300">{formatMoney(product?.price || 0)} {getCurrencyName(product?.currency)}</div>
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
                <span>1 x {formatMoney(product?.price || 0)} {getCurrencyName(product?.currency)}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-gray-600 pt-1 mt-1">
                <span className="font-semibold">JAMI</span>
                <span className="font-bold text-yellow-300">{formatMoney(product?.price || 0)} {getCurrencyName(product?.currency)}</span>
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
                      {labelPrinters.length === 0 ? (
                        <SelectItem value="none" disabled className="text-slate-500">Printer topilmadi</SelectItem>
                      ) : (
                        labelPrinters.map((printer) => (
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
                          setLabelPrinters((prev) => prev.some((p) => p.id === printer.id) ? prev : [...prev, printer]);
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
                  
                  setIsLabelPrinting(true);
                  try {
                    // Barcode ID - Kassa bilan bir xil format
                    const productIdString = typeof labelDialogProduct.productId === 'string' ? labelDialogProduct.productId : labelDialogProduct.productId.toString();
                    let barcodeId = productIdString.slice(-8).toUpperCase();
                    
                    // Agar xil bo'lsa (productId da "-v" bor), chiziqchasiz format
                    if (labelDialogProduct.productId.includes('-v')) {
                      const parts = labelDialogProduct.productId.split('-v');
                      const productIdShort = parts[0].slice(-8).toUpperCase();
                      const variantIndex = parts[1];
                      barcodeId = `${productIdShort}V${variantIndex}`;
                    }
                    
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
                    setIsLabelPrinting(false);
                  }
                }}
                disabled={isLabelPrinting || !labelQuantity || labelQuantity < 1}
              >
                {isLabelPrinting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Chop etilmoqda...</>
                ) : (
                  <><Printer className="w-5 h-5 mr-2" />{labelQuantity || 0} ta senik ({useCustomSize ? `${customLabelWidth}×${customLabelHeight}` : `${LABEL_SIZE_CONFIGS[labelSize].width}×${LABEL_SIZE_CONFIGS[labelSize].height}`}mm)</>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
