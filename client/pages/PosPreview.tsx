import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  imageUrl: string;
  description: string;
  category: string;
}

interface Printer {
  id: string;
  name: string;
}

const demoProducts: Product[] = [
  {
    id: '1',
    name: "Kofe Cappuccino",
    price: 13000,
    stock: 24,
    category: 'Ichimliklar',
    imageUrl:
      'https://images.pexels.com/photos/3778963/pexels-photo-3778963.jpeg?auto=compress&cs=tinysrgb&w=600',
    description: "Yangi qahvadan tayyorlangan, sut ko'pigi bilan cappuccino.",
  },
  {
    id: '2',
    name: 'Kuluch',
    price: 8000,
    stock: 12,
    category: 'Non mahsulotlari',
    imageUrl:
      'https://images.pexels.com/photos/2092904/pexels-photo-2092904.jpeg?auto=compress&cs=tinysrgb&w=600',
    description: "Yangi pishirilgan yumshoq kuluch, tong nonushtasi uchun ideal.",
  },
  {
    id: '3',
    name: 'Burger Combo',
    price: 45000,
    stock: 8,
    category: 'Taomlar',
    imageUrl:
      'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=600',
    description: "Katta burger, kartoshka fri va ichimlikdan iborat combo.",
  },
  {
    id: '4',
    name: 'Limonli choy',
    price: 9000,
    stock: 32,
    category: 'Ichimliklar',
    imageUrl:
      'https://images.pexels.com/photos/1417945/pexels-photo-1417945.jpeg?auto=compress&cs=tinysrgb&w=600',
    description: "Limonli issiq choy, sovuq kunlar uchun juda mos.",
  },
  {
    id: '5',
    name: 'Kartoshka fri',
    price: 11000,
    stock: 40,
    category: 'Taomlar',
    imageUrl:
      'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=600',
    description: "Yangi qovurilgan kartoshka fri, souse bilan birga.",
  },
  {
    id: '6',
    name: 'Shokoladli desert',
    price: 16000,
    stock: 15,
    category: 'Desertlar',
    imageUrl:
      'https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=600',
    description: 'Shokoladli kek va muzqaymoqdan iborat shirinlik.',
  },
];

const formatMoney = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);

// Electron API shape (placeholder)
interface ElectronAPI {
  getPrinters?: () => Promise<Printer[]>;
  print?: (payload: {
    printerId: string;
    paperSize: '58' | '80';
    copies: number;
    items: { name: string; price: number; qty: number }[];
    total: number;
  }) => Promise<void>;
  onPrintStatus?: (
    handler: (status: { state: 'preparing' | 'printing' | 'error'; message?: string; remainingSeconds?: number }) => void,
  ) => () => void;
}

const useElectron = () => {
  const api = (window as any).electronAPI as ElectronAPI | undefined;
  return api;
};

export default function PosPreview() {
  const [store, setStore] = useState('AvtoFix');
  const [category, setCategory] = useState<string>('Barchasi');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [qty, setQty] = useState('1');

  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [paperSize, setPaperSize] = useState<'58' | '80'>('58');
  const [copies, setCopies] = useState('1');

  const [printStatus, setPrintStatus] = useState<{
    state: 'idle' | 'preparing' | 'printing' | 'error';
    message: string;
    remainingSeconds?: number;
  }>({ state: 'idle', message: '' });

  const [showPrintModal, setShowPrintModal] = useState(false);

  const electron = useElectron();

  useEffect(() => {
    let unsub: (() => void) | undefined;

    const init = async () => {
      try {
        if (electron?.getPrinters) {
          const list = await electron.getPrinters();
          setPrinters(list);
          if (list[0]) setSelectedPrinter(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load printers from electronAPI', err);
      }

      if (electron?.onPrintStatus) {
        unsub = electron.onPrintStatus((status) => {
          setPrintStatus({
            state: status.state,
            message:
              status.state === 'preparing'
                ? 'Pechatga tayyorlanmoqda'
                : status.state === 'printing'
                ? 'Cheklar chop etilmoqda'
                : 'Printerda xatolik',
            remainingSeconds: status.remainingSeconds,
          });
        });
      }
    };

    void init();

    return () => {
      if (unsub) unsub();
    };
  }, [electron]);

  const filteredProducts = useMemo(() => {
    return demoProducts.filter((p) => {
      const okCategory = category === 'Barchasi' || p.category === category;
      const q = search.trim().toLowerCase();
      const okSearch = !q || p.name.toLowerCase().includes(q);
      return okCategory && okSearch;
    });
  }, [category, search]);

  const statusColor = useMemo(() => {
    if (printStatus.state === 'preparing') return 'bg-blue-600';
    if (printStatus.state === 'printing') return 'bg-green-600';
    if (printStatus.state === 'error') return 'bg-red-600';
    return 'bg-gray-200';
  }, [printStatus.state]);

  const statusText = useMemo(() => {
    if (printStatus.state === 'preparing') return 'Pechatga tayyorlanmoqda...';
    if (printStatus.state === 'printing') return 'Cheklar chop etilmoqda...';
    if (printStatus.state === 'error') return 'Printerda xatolik';
    return '';
  }, [printStatus.state]);

  const handleOpenProduct = (product: Product) => {
    setSelectedProduct(product);
    setQty('1');
    setSidebarOpen(true);
  };

  const handleAddToCart = () => {
    // Bu yerda savatchaga qo'shish logikasi bo'ladi
    setShowPrintModal(true);
  };

  const handlePrint = async () => {
    if (!selectedProduct) return;

    const copiesNum = Number.parseInt(copies || '1', 10) || 1;
    const qtyNum = Number.parseInt(qty || '1', 10) || 1;

    setPrintStatus({ state: 'preparing', message: 'Pechatga tayyorlanmoqda...' });

    try {
      if (electron?.print && selectedPrinter) {
        await electron.print({
          printerId: selectedPrinter,
          paperSize,
          copies: copiesNum,
          items: [
            {
              name: selectedProduct.name,
              price: selectedProduct.price,
              qty: qtyNum,
            },
          ],
          total: selectedProduct.price * qtyNum,
        });
      } else {
        console.log('Simulated print', {
          printerId: selectedPrinter,
          paperSize,
          copies: copiesNum,
          product: selectedProduct,
        });
      }

      setPrintStatus({
        state: 'printing',
        message: `Cheklar chop etilmoqda...`,
        remainingSeconds: 3,
      });

      setTimeout(() => {
        setPrintStatus({ state: 'idle', message: '' });
        setShowPrintModal(false);
      }, 3000);
    } catch (err) {
      console.error('Print error', err);
      setPrintStatus({ state: 'error', message: 'Printerda xatolik yuz berdi' });
    }
  };

  const totalForPreview = selectedProduct
    ? selectedProduct.price * (Number.parseInt(qty || '1', 10) || 1)
    : 0;

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Left: Store + Category */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-lg font-bold text-blue-600 tracking-tight hidden sm:block">POS UI</div>

            <div className="flex items-center gap-2">
              <select
                value={store}
                onChange={(e) => setStore(e.target.value)}
                className="text-xs sm:text-sm rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
              >
                <option>AvtoFix</option>
                <option>AvtoFix 2-filial</option>
              </select>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="text-xs sm:text-sm rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
              >
                <option>Barchasi</option>
                <option>Ichimliklar</option>
                <option>Taomlar</option>
                <option>Non mahsulotlari</option>
                <option>Desertlar</option>
              </select>
            </div>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Mahsulot qidirish..."
                className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 text-xs">
                Ctrl + K
              </span>
            </div>
          </div>

          {/* Right: icons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 text-xs"
            >
              
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 text-xs"
            >
              
            </button>
          </div>
        </div>

        {/* PRINT STATUS BAR */}
        <AnimatePresence>
          {printStatus.state !== 'idle' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gray-100 bg-gray-50/90"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${statusColor}`}>
                    {printStatus.state === 'error' ? '!' : 'P'}
                  </div>
                  <div className="text-xs sm:text-sm">
                    <div className="font-medium text-gray-800">{statusText}</div>
                    {printStatus.remainingSeconds != null && (
                      <div className="text-[11px] text-gray-500">
                        Taxminan {printStatus.remainingSeconds} soniya qoldi
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 max-w-xs">
                  <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div className={`h-full ${statusColor} animate-pulse`} style={{ width: '70%' }} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* MAIN LAYOUT */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex gap-4">
        {/* PRODUCT GRID */}
        <div className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
            {filteredProducts.map((product) => (
              <motion.button
                key={product.id}
                layout
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleOpenProduct(product)}
                className="group flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden text-left"
              >
                <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute top-1.5 right-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-gray-700 shadow">
                    Omborda: {product.stock}
                  </div>
                </div>
                <div className="p-2.5 flex flex-col gap-1">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400 truncate">
                    {product.category}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                    {product.name}
                  </div>
                  <div className="mt-1 text-sm font-bold text-blue-600">
                    {formatMoney(product.price)} <span className="text-xs font-semibold">so'm</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* PRODUCT DETAIL SIDEBAR */}
        <AnimatePresence>
          {sidebarOpen && selectedProduct && (
            <motion.aside
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="hidden md:flex w-80 lg:w-96 flex-shrink-0 flex-col rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden"
            >
              <div className="relative h-40 bg-gray-100">
                <img
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white text-xs hover:bg-black/70"
                >
                   d
                </button>
              </div>

              <div className="p-4 flex flex-col gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-0.5">
                    {selectedProduct.name}
                  </h2>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {selectedProduct.description}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">Narx</div>
                  <div className="text-lg font-bold text-blue-600">
                    {formatMoney(selectedProduct.price)} <span className="text-xs">so'm</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">Omborda</div>
                  <div className="text-xs font-medium text-gray-800">{selectedProduct.stock} dona</div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[11px] text-gray-500">Miqdor</label>
                    <input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                    />
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-gray-500 mb-0.5">Jami</div>
                    <div className="text-sm font-bold text-gray-900">
                      {formatMoney(totalForPreview)} <span className="text-[11px]">so'm</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
                >
                  Savatchaga qo'shish & Pechat
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* PRINT PREVIEW MODAL */}
      <AnimatePresence>
        {showPrintModal && selectedProduct && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 80, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="w-full md:max-w-lg md:rounded-2xl rounded-t-3xl bg-white shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Chek preview</h3>
                  <p className="text-[11px] text-gray-500">Pechat qilishdan oldin ma'lumotlarni tekshiring</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-xs"
                >
                   d
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 md:flex-row md:gap-4">
                {/* Receipt preview */}
                <div className="flex-1 border border-gray-200 rounded-xl p-3 bg-gray-50 text-xs text-gray-800">
                  <div className="text-center mb-2">
                    <div className="text-sm font-bold">{store}</div>
                    <div className="text-[11px] text-gray-500">POS Chek Preview</div>
                  </div>

                  <div className="flex justify-between text-[11px] mb-1">
                    <span>Mahsulot:</span>
                    <span className="font-medium text-right">{selectedProduct.name}</span>
                  </div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span>Miqdor:</span>
                    <span>
                      {qty} x {formatMoney(selectedProduct.price)} so'm
                    </span>
                  </div>

                  <div className="border-t border-dashed border-gray-300 my-2" />

                  <div className="flex justify-between text-[11px] font-semibold">
                    <span>JAMI:</span>
                    <span>
                      {formatMoney(totalForPreview)} so'm
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="w-full md:w-56 flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-gray-500">Printer</label>
                    <select
                      value={selectedPrinter}
                      onChange={(e) => setSelectedPrinter(e.target.value)}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                    >
                      <option value="">Printer tanlang</option>
                      {printers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-gray-500">Qog'oz o'lchami</label>
                    <select
                      value={paperSize}
                      onChange={(e) => setPaperSize(e.target.value as '58' | '80')}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                    >
                      <option value="58">58 mm</option>
                      <option value="80">80 mm</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-gray-500">Nusxalar soni</label>
                    <input
                      type="number"
                      min={1}
                      value={copies}
                      onChange={(e) => setCopies(e.target.value)}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
                    disabled={!selectedPrinter}
                  >
                    Chekni pechat qilish
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
