import { useState, useEffect } from 'react';
import { Plus, Layers, ChevronRight, ChevronLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface Store {
  id: string;
  name: string;
}

interface StoreCategory {
  id: string;
  name: string;
  storeId: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStore?: (store: Store) => void;
  onAddCategory?: (category: StoreCategory) => void;
  stores?: Store[];
  categories?: StoreCategory[];
  onCollapsedChange?: (collapsed: boolean) => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  onAddStore,
  onAddCategory,
  stores = [],
  categories = [],
  onCollapsedChange,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(true);

  const pathname = location.pathname;
  const isStoresActive = pathname === '/stores';
  const isAddCategoryActive = pathname.startsWith('/add-category');
  const isProductsActive = pathname === '/' || pathname.startsWith('/products');
  const isStatsActive = pathname.startsWith('/stats');

  // notify parent on mount and whenever collapsed changes
  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  // On mobile, when opened from burger, show full width by default
  useEffect(() => {
    if (isOpen) {
      if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) {
        setCollapsed(false);
      }
    }
  }, [isOpen]);

  return (
    <>
      {/* Overlay - show when sidebar is open (all viewports), but content layout stays unchanged */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => onClose()}
        />
      )}

      {/* Sidebar - fixed overlay layer */}
      <div
        className={`fixed left-0 top-14 lg:top-16 h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-4rem)] 
          bg-gradient-to-b from-gray-50 via-gray-100 to-gray-50 
          dark:from-gray-900/95 dark:via-gray-800/95 dark:to-gray-900/95
          backdrop-blur-xl border-r border-border dark:border-red-600/30 
          shadow-lg shadow-black/10 dark:shadow-2xl dark:shadow-red-900/20
          transition-all duration-300 z-50 flex flex-col overflow-y-auto
          w-80 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 ${collapsed ? 'lg:w-20' : 'lg:w-80'}`}
      >
        {/* Toggle Button (desktop only) */}
        <div className="hidden lg:flex justify-end p-2 border-b border-red-600/20 bg-gradient-to-r from-red-900/10 to-transparent">
          <button
            onClick={() => {
              const next = !collapsed;
              setCollapsed(next);
              onCollapsedChange?.(next);
            }}
            className="p-1.5 hover:bg-red-900/30 rounded-lg transition-all"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5 text-red-400" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-red-400" />
            )}
          </button>
        </div>

        {/* Buttons Container */}
        <div className="flex flex-col gap-3 p-3 flex-1">
          {/**
           * Stores Button (Magazinlar)
           * Temporarily disabled per user request
           */}
          {false && (
            <button
              onClick={() => {
                navigate('/');
                if (!collapsed) onClose();
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group ${
                collapsed ? 'justify-center px-2' : ''
              } ${
                isStoresActive
                  ? 'bg-red-600 text-white shadow-lg shadow-red-900/50'
                  : 'bg-gray-900/60 border-red-600/40 hover:bg-gray-800/80 text-gray-200 hover:text-white'
              }`}
              title="Magazinlar"
            >
              <svg className="w-5 h-5 text-red-400 group-hover:text-red-300 flex-shrink-0 transition" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
              </svg>
              {!collapsed && (
                <span className="text-gray-200 group-hover:text-white font-semibold text-sm whitespace-nowrap transition">
                  Magazinlar
                </span>
              )}
            </button>
          )}

          {/* Products Button */}
          <button
            onClick={() => {
              navigate('/products');
              if (!collapsed) onClose();
            }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group ${
              collapsed ? 'justify-center px-2' : ''
            } ${
              isProductsActive
                ? 'border-red-500 bg-red-600 shadow-lg shadow-red-900/50 text-white'
                : 'border-red-600/40 bg-gray-900/60 hover:bg-gray-800/80 text-gray-200 hover:text-white'
            }`}
            title="Mahsulotlar"
          >
            <svg className="w-5 h-5 text-red-400 group-hover:text-red-300 flex-shrink-0 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="14" rx="2" ry="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {!collapsed && (
              <span className="font-semibold text-sm whitespace-nowrap">
                Mahsulotlar
              </span>
            )}
          </button>

          {/* Add Category Button */}
          <button
            onClick={() => {
              navigate('/add-category');
              if (!collapsed) onClose();
            }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group ${
              collapsed ? 'justify-center px-2' : ''
            } ${
              isAddCategoryActive
                ? 'border-red-500 bg-red-600 shadow-lg shadow-red-900/50 text-white'
                : 'border-red-600/40 bg-gray-900/60 hover:bg-gray-800/80 text-gray-200 hover:text-white'
            }`}
            title="Kategoriya qo'shish"
          >
            <Layers className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
              <span className="font-semibold text-sm whitespace-nowrap">
                Kategoriya qo'shish
              </span>
            )}
          </button>

          {/* Stats Button */}
          <button
            onClick={() => {
              navigate('/stats');
              if (!collapsed) onClose();
            }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group ${
              collapsed ? 'justify-center px-2' : ''
            } ${
              isStatsActive
                ? 'border-emerald-500 bg-emerald-600 shadow-lg shadow-emerald-900/50 text-white'
                : 'border-emerald-600/40 bg-gray-900/60 hover:bg-gray-800/80 text-gray-200 hover:text-white'
            }`}
            title="Statistikalar"
          >
            <svg
              className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300 flex-shrink-0 transition"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19V9" />
              <path d="M9 19V5" />
              <path d="M14 19v-7" />
              <path d="M19 19V8" />
            </svg>
            {!collapsed && (
              <span className="font-semibold text-sm whitespace-nowrap">
                Statistikalar
              </span>
            )}
          </button>
        </div>

      </div>
    </>
  );
}
