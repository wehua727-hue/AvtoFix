import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';
import { useNavigate } from 'react-router-dom';

interface Store {
  id: string;
  name: string;
}

interface StoreCategory {
  id: string;
  name: string;
  storeId: string;
}

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);

  // Load stores from localStorage + API, and categories from localStorage + API on mount
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
        console.error('Failed to load categories from localStorage:', error);
      }
    }

    // Load stores from backend (MongoDB)
    fetch('/api/stores')
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.stores) && data.stores.length > 0) {
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
          if (Array.isArray(data?.categories) && data.categories.length > 0) {
            setCategories(data.categories as StoreCategory[]);
          }
        })
        .catch((err) => {
          console.error('Failed to load categories from API:', err);
        });
    }
  }, [user?.id, user?.phone]);

  // Save stores to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('stores', JSON.stringify(stores));
  }, [stores]);

  // Save categories to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('categories', JSON.stringify(categories));
  }, [categories]);

  const handleAddStore = (store: Store) => {
    setStores([...stores, store]);
  };

  const handleAddCategory = (category: StoreCategory) => {
    setCategories([...categories, category]);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onAddStore={handleAddStore}
        onAddCategory={handleAddCategory}
        stores={stores}
        categories={categories}
        onCollapsedChange={setSidebarCollapsed}
      />
      <Navbar onMenuClick={() => setSidebarOpen((prev) => !prev)} sidebarCollapsed={sidebarCollapsed} />

      {/* Main content wrapper (Index page is now minimal, real home is Products page) */}
      <div className={`pt-12 sm:pt-14 lg:pt-16 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="rounded-lg border border-gray-700 bg-gradient-to-br from-slate-900 via-blue-950/30 to-slate-900 p-6 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">
              Tizimga xush kelibsiz
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Asosiy ish maydoni sifatida "Mahsulotlar" sahifasidan foydalaning. Sidebar orqali mahsulotlar va kategoriyalar bilan ishlashingiz mumkin.
            </p>
            <button
              onClick={() => navigate('/products')}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-all"
            >
              Mahsulotlar sahifasiga o'tish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
