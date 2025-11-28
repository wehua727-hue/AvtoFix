import { useMemo, useState } from 'react';
import Header from '@/components/Layout/Header';
import Sidebar from '@/components/Layout/Sidebar';
import { PRODUCTS } from '@/lib/products';
import type { POSDevice, POSTransaction } from '@shared/api';
import { dispatchPrint } from '@/lib/pos-print';
import { Plus, Minus, Trash2, Printer, CheckSquare, MonitorSmartphone } from 'lucide-react';
import { fetchDevices } from '@/lib/devices';

function formatMoney(n: number) { return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"; }

interface BasketLine { id: string; name: string; price: number; qty: number; }

export default function POS() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [basket, setBasket] = useState<Record<string, BasketLine>>({});
  const [copies, setCopies] = useState(1);
  const [devices, setDevices] = useState<POSDevice[]>(['printer']);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [available, setAvailable] = useState<{ id: string; name: string; type: POSDevice }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [perCopies, setPerCopies] = useState<Record<string, number>>({});

  const lines = Object.values(basket);
  const total = useMemo(() => lines.reduce((s, l) => s + l.price * l.qty, 0), [lines]);

  const addProduct = (id: string) => {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p) return;
    setBasket(prev => {
      const existing = prev[id];
      const nextQty = (existing?.qty ?? 0) + 1;
      return { ...prev, [id]: { id, name: p.name, price: p.price, qty: nextQty } };
    });
  };

  const dec = (id: string) => setBasket(prev => {
    const ex = prev[id];
    if (!ex) return prev;
    const nextQty = ex.qty - 1;
    const copy = { ...prev };
    if (nextQty <= 0) delete copy[id]; else copy[id] = { ...ex, qty: nextQty };
    return copy;
  });

  const inc = (id: string) => setBasket(prev => ({ ...prev, [id]: { ...prev[id], qty: prev[id].qty + 1 } }));
  const remove = (id: string) => setBasket(prev => { const copy = { ...prev }; delete copy[id]; return copy; });

  const toggleDevice = (d: POSDevice) => setDevices(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const tx: POSTransaction = useMemo(() => ({
    id: `TX-${Date.now()}`,
    createdAt: new Date().toISOString(),
    lines: lines.map(l => ({ ...l })),
    total,
  }), [lines, total]);

  const onPrint = async () => {
    if (!lines.length) return;
    setIsPrinting(true);
    try {
      await dispatchPrint(tx, copies, devices, { deviceIds: selectedIds, deviceCopies: perCopies });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header
        rightSlot={(
          <button
            onClick={async () => {
              try {
                const list = await fetchDevices();
                const devicesAll = [...list.printers, ...list.others];
                setAvailable(devicesAll);
                const init: Record<string, number> = {};
                devicesAll.forEach(d => { init[d.id] = 1; });
                setPerCopies(prev => Object.keys(prev).length ? prev : init);
                setSelectedIds(prev => prev.length ? prev : devicesAll.map(d => d.id));
                setShowPrint(true);
              } catch {
                setAvailable([]);
                setShowPrint(true);
              }
            }}
            className="hidden md:inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-red-900/50 transition-all"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        )}
      />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onCollapsedChange={setSidebarCollapsed} />

      <div className={`pt-16 sm:pt-18 lg:pt-20 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Product List */}
            <section className="lg:col-span-2">
              <h2 className="text-xl font-bold text-white mb-4">Mahsulotlar</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {PRODUCTS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p.id)}
                    className="bg-gray-800/80 border border-red-900/50 hover:bg-gray-700 hover:border-red-600/50 text-left rounded-xl p-4 transition-all shadow-lg group"
                  >
                    <div className="text-white font-semibold truncate group-hover:text-red-500 transition">{p.name}</div>
                    <div className="text-red-600 font-bold text-sm mt-1">{formatMoney(p.price)}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* Basket / Transaction */}
            <section className="lg:col-span-1">
              <h2 className="text-xl font-bold text-white mb-4">Chek</h2>
              <div className="bg-gray-800/80 rounded-2xl border border-red-900/50 overflow-hidden shadow-xl">
                <div className="max-h-[50vh] overflow-auto divide-y divide-red-900/30">
                  {lines.length === 0 ? (
                    <div className="text-gray-400 p-6 text-center">Hali mahsulot tanlanmadi</div>
                  ) : (
                    lines.map(l => (
                      <div key={l.id} className="p-3 sm:p-4 flex items-center gap-3 hover:bg-gray-700/50 transition">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold truncate">{l.name}</div>
                          <div className="text-gray-400 text-sm">{formatMoney(l.price)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 transition" onClick={() => dec(l.id)}>
                            <Minus className="w-4 h-4 text-gray-300" />
                          </button>
                          <div className="w-8 text-center text-white font-semibold">{l.qty}</div>
                          <button className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 transition" onClick={() => inc(l.id)}>
                            <Plus className="w-4 h-4 text-gray-300" />
                          </button>
                        </div>
                        <div className="w-24 text-right text-red-600 font-bold">{formatMoney(l.price * l.qty)}</div>
                        <button className="p-2 rounded-lg hover:bg-red-900/40 transition" onClick={() => remove(l.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {/* Footer */}
                <div className="p-4 flex items-center justify-between bg-gray-900 border-t border-red-900/50">
                  <div className="text-gray-300 font-medium">Jami:</div>
                  <div className="text-red-600 font-extrabold text-xl">{formatMoney(total)}</div>
                </div>
              </div>

              {/* Print controls */}
              <div className="mt-4 bg-gray-800/80 rounded-2xl border border-red-900/50 p-4 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <label className="text-gray-300 font-medium">Cheklar soni</label>
                  <input
                    type="number"
                    min={1}
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 bg-gray-700 border border-gray-600 rounded-lg text-white px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>
                <div>
                  <div className="text-gray-300 font-medium mb-2">Qurilmalar</div>
                  <div className="flex flex-wrap gap-2">
                    <DeviceTag active={devices.includes('printer')} onClick={() => toggleDevice('printer')} icon={<Printer className="w-4 h-4" />} label="Printer" />
                    <DeviceTag active={devices.includes('kitchen')} onClick={() => toggleDevice('kitchen')} icon={<MonitorSmartphone className="w-4 h-4" />} label="Kitchen" />
                    <DeviceTag active={devices.includes('prep')} onClick={() => toggleDevice('prep')} icon={<CheckSquare className="w-4 h-4" />} label="Prep" />
                  </div>
                </div>
                <button
                  disabled={isPrinting || lines.length === 0}
                  onClick={onPrint}
                  className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-red-900/50"
                >
                  <Printer className="w-5 h-5" />
                  {isPrinting ? 'Chop etilmoqda...' : 'Print'}
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
      <PrintModal
        open={showPrint}
        onClose={() => setShowPrint(false)}
        copies={copies}
        setCopies={(n) => setCopies(n)}
        available={available}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        perCopies={perCopies}
        setPerCopies={setPerCopies}
        onConfirm={() => { onPrint(); setShowPrint(false); }}
      />
    </div>
  );
}

function DeviceTag({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${active ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-900/50' : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600 hover:border-red-600/50'}`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

// Print modal component
function PrintModal({
  open,
  onClose,
  copies,
  setCopies,
  available,
  selectedIds,
  setSelectedIds,
  perCopies,
  setPerCopies,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  copies: number;
  setCopies: (n: number) => void;
  available: { id: string; name: string; type: POSDevice }[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  perCopies: Record<string, number>;
  setPerCopies: (v: Record<string, number>) => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-800 border border-red-900/50 rounded-2xl w-full max-w-2xl mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Print sozlamalari</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">Yopish ✕</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <label className="block text-sm text-gray-300 font-medium mb-2">Umumiy cheklar soni</label>
            <input
              type="number"
              min={1}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
              className="w-28 bg-gray-700 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm text-gray-300 font-medium mb-2">Qurilmalar</label>
            <div className="max-h-64 overflow-auto divide-y divide-red-900/30 border border-red-900/50 rounded-xl bg-gray-900">
              {available.length === 0 ? (
                <div className="p-4 text-gray-400">Qurilmalar topilmadi (demo)</div>
              ) : available.map(d => {
                const checked = selectedIds.includes(d.id);
                return (
                  <div key={d.id} className="flex items-center justify-between p-3 hover:bg-gray-800 transition">
                    <label className="flex items-center gap-3 text-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setSelectedIds(on ? [...selectedIds, d.id] : selectedIds.filter(x => x !== d.id));
                        }}
                        className="w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-600"
                      />
                      <span>{d.name}</span>
                      <span className="text-xs text-gray-400">({d.type})</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">Nusxa:</span>
                      <input
                        type="number"
                        min={1}
                        value={perCopies[d.id] ?? 1}
                        onChange={(e) => setPerCopies({ ...perCopies, [d.id]: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-20 bg-gray-700 border border-gray-600 rounded-lg text-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-600"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600 transition">Bekor</button>
          <button onClick={onConfirm} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold shadow-lg shadow-red-900/50 transition">Pechat</button>
        </div>
      </div>
    </div>
  );
}
