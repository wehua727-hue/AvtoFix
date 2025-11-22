import { useEffect, useState } from 'react';
import Header from '@/components/Layout/Header';
import Sidebar from '@/components/Layout/Sidebar';

interface Product {
  id: string;
  name: string;
  price: number | null;
  sku: string;
}

interface ProductWithSales extends Product {
  todaySales: number;
}

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

export default function Stats() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [products, setProducts] = useState<ProductWithSales[]>([]);

  useEffect(() => {
    fetch('/api/products')
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data?.products)) return;
        const salesMap = getTodaySalesMap();
        const withSales: ProductWithSales[] = (data.products as Product[]).map((p) => ({
          ...p,
          todaySales: salesMap[p.id] ?? 0,
        }));
        setProducts(withSales);
      })
      .catch((err) => {
        console.error('Failed to load products for stats:', err);
      });
  }, []);

  const sorted = [...products].sort((a, b) => b.todaySales - a.todaySales);
  const most = sorted.filter((p) => p.todaySales > 0).slice(0, 10);
  const least = [...sorted]
    .reverse()
    .filter((p) => p.todaySales > 0)
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onMenuClick={() => setSidebarOpen((prev) => !prev)} />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />

      <div className={`pt-16 sm:pt-18 lg:pt-20 pb-10 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-foreground">
            Statistikalar (bugun)
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-green-500/40 bg-gray-900/80 p-4 shadow-lg shadow-green-900/30">
              <h2 className="text-lg font-semibold text-green-300 mb-3">Eng ko'p sotilgan mahsulotlar</h2>
              {most.length === 0 ? (
                <p className="text-sm text-gray-400">Hali bugun sotuvlar yo'q.</p>
              ) : (
                <ul className="space-y-2 text-sm text-gray-100">
                  {most.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-xl bg-gray-800/70 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{p.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">Kod: {p.sku}</p>
                      </div>
                      <span className="ml-3 text-xs font-semibold px-2 py-1 rounded-lg bg-green-600/80 text-white">
                        {p.todaySales} marta
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-yellow-500/40 bg-gray-900/80 p-4 shadow-lg shadow-yellow-900/30">
              <h2 className="text-lg font-semibold text-yellow-300 mb-3">Kam sotilgan mahsulotlar</h2>
              {least.length === 0 ? (
                <p className="text-sm text-gray-400">Hali bugun sotuvlar yo'q.</p>
              ) : (
                <ul className="space-y-2 text-sm text-gray-100">
                  {least.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-xl bg-gray-800/70 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{p.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">Kod: {p.sku}</p>
                      </div>
                      <span className="ml-3 text-xs font-semibold px-2 py-1 rounded-lg bg-yellow-600/80 text-black">
                        {p.todaySales} marta
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
