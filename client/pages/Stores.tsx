import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Store as StoreIcon, ChevronRight, Package } from 'lucide-react';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';
import { useAuth } from '@/lib/auth-context';

interface Store {
  id: string;
  name: string;
}

interface StoreCategory {
  id: string;
  name: string;
  storeId: string;
}

export default function Stores() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);

  // Load stores and categories from localStorage + backend on mount
  useEffect(() => {
    const savedStores = localStorage.getItem('stores');
    const savedCategories = localStorage.getItem('categories');
    
    if (savedStores) {
      try {
        setStores(JSON.parse(savedStores));
      } catch (error) {
        console.error('Failed to load stores:', error);
      }
    }
    
    if (savedCategories) {
      try {
        setCategories(JSON.parse(savedCategories));
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    }

    // Load stores from backend (MongoDB)
    fetch('/api/stores')
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.stores)) {
          setStores(data.stores as Store[]);
        }
      })
      .catch((err) => {
        console.error('Failed to load stores from API:', err);
      });

    // Load categories from backend (MongoDB) with userId filter
    if (user?.id) {
      const params = new URLSearchParams({ userId: user.id });
      if (user.phone) {
        params.append('userPhone', user.phone);
      }
      
      fetch(`/api/categories?${params}`)
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          if (Array.isArray(data?.categories)) {
            setCategories(data.categories as StoreCategory[]);
          }
        })
        .catch((err) => {
          console.error('Failed to load categories from API:', err);
        });
    }
  }, [user?.id, user?.phone]);

  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        stores={stores}
        categories={categories}
        onCollapsedChange={setSidebarCollapsed}
      />
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed} />

      {/* Main content wrapper */}
      <div className={`pt-16 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`}>
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 relative">
            <div className="rounded-lg border border-gray-700 bg-gray-900 px-5 sm:px-8 lg:px-10 py-8 lg:py-10">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-3 text-white">
                    Magazinlar
                  </h1>
                  <p className="text-base lg:text-xl text-gray-400">
                    Barcha magazinlaringizni bir joyda boshqaring
                  </p>
                </div>
                
                <div className="hidden sm:flex items-center justify-center w-20 h-20 bg-red-600 rounded-lg">
                  <StoreIcon className="w-10 h-10 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stores Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-white">
              Magazinlar ro'yxati
            </h2>
            <div className="flex-1 h-px bg-gray-700"></div>
            <button
              onClick={() => navigate('/add-store')}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Magazin qo'shish
            </button>
          </div>

          {stores.length === 0 ? (
            <div className="text-center py-16 rounded-lg border border-gray-700 bg-gray-900">
              <div className="flex justify-center mb-6">
                <div className="relative group">
                  <div className="absolute inset-0 bg-red-600 rounded-2xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity"></div>
                  <div className="relative bg-gradient-to-br from-red-600 via-red-700 to-red-800 p-6 rounded-2xl shadow-2xl">
                    <StoreIcon className="w-12 h-12 text-white" />
                  </div>
                </div>
              </div>
              <p className="text-gray-400 text-lg mb-6">Hali magazin qo'shilmagan</p>
              <button
                onClick={() => navigate('/add-store')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 via-red-700 to-red-600 hover:from-red-700 hover:via-red-800 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg shadow-red-900/50 transition-all"
              >
                <Plus className="w-5 h-5" />
                Birinchi magazinni qo'shing
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stores.map((store) => {
                const storeCategories = categories.filter(c => c.storeId === store.id);
                return (
                  <button
                    key={store.id}
                    onClick={() => navigate(`/store/${store.id}`)}
                    className="relative group rounded-2xl border border-red-600/30 bg-gradient-to-br from-gray-800/80 via-gray-900/80 to-gray-800/80 backdrop-blur-xl shadow-xl shadow-red-900/20 p-6 hover:border-red-500/50 transition-all overflow-hidden text-left w-full cursor-pointer"
                  >
                    {/* Hover effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-red-600/0 via-red-600/10 to-red-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/50">
                            <StoreIcon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-white group-hover:text-red-400 transition">
                              {store.name}
                            </h3>
                            <p className="text-gray-400 text-xs mt-1">
                              {storeCategories.length} kategoriya
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-red-400 transition" />
                      </div>
                      
                      {storeCategories.length > 0 && (
                        <div className="space-y-2 mt-4 pt-4 border-t border-red-600/20">
                          <div className="flex items-center gap-2 text-gray-400 text-xs">
                            <Package className="w-3 h-3" />
                            <span>Kategoriyalar:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {storeCategories.slice(0, 3).map((cat) => (
                              <span
                                key={cat.id}
                                className="px-2 py-1 bg-gray-700/50 border border-red-600/20 rounded-lg text-gray-300 text-xs"
                              >
                                {cat.name}
                              </span>
                            ))}
                            {storeCategories.length > 3 && (
                              <span className="px-2 py-1 bg-gray-700/50 border border-red-600/20 rounded-lg text-gray-400 text-xs">
                                +{storeCategories.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {storeCategories.length === 0 && (
                        <p className="text-gray-500 text-sm italic mt-4 pt-4 border-t border-red-600/20">
                          Kategoriya yo'q
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
