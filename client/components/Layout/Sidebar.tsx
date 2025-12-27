import { useState, useEffect } from 'react';
import { Layers, Users, Wallet, UserCheck, LogOut, MenuIcon, X, Calculator, UserCog, Crown, Shield, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
  const { user, originalUser, logout, returnToOriginal } = useAuth();
  const [collapsed, setCollapsed] = useState(true);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  
  // Egasi va admin Foydalanuvchilarni ko'ra oladi
  const canSeeUsers = user?.role === 'egasi' || user?.role === 'admin' || user?.phone === '910712828' || user?.phone === '+998910712828';
  
  // Egasi va admin Xodimlarni ko'ra oladi
  const canSeeXodimlar = user?.role === 'egasi' || user?.role === 'admin';

  const handleLogoutConfirm = () => {
    logout();
    navigate('/login');
    setLogoutConfirm(false);
  };
 
  const pathname = location.pathname;
  const isStoresActive = pathname === '/stores';
  const isAddCategoryActive = pathname.startsWith('/add-category');
  const isProductsActive = pathname.startsWith('/products');
  const isStatsActive = pathname.startsWith('/stats');
  const isUsersActive = pathname.startsWith('/users');
  const isXodimlarActive = pathname.startsWith('/xodimlar');
  const isDebtsActive = pathname.startsWith('/debts');
  const isCustomersActive = pathname.startsWith('/customers');
  const isCashRegisterActive = pathname === '/' || pathname.startsWith('/kassa');

  // notify parent on mount and whenever collapsed changes
  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  // On mobile, when opened from burger, show full width by default
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = !window.matchMedia('(min-width: 1024px)').matches;
      if (isOpen && isMobile) {
        setCollapsed(false);
      }
    }
  }, [isOpen]);

  return (
    <>
      {/* Overlay - Minimalist */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => onClose()}
        />
      )}

      {/* Sidebar - fixed overlay layer */}
      <aside
        className={`fixed left-0 top-0 h-screen
          bg-gray-950 dark:bg-gray-950 border-r border-gray-800/50 dark:border-gray-800/50
          transition-all duration-300 z-[9999] flex flex-col overflow-y-auto
          w-72 sm:w-80 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 ${collapsed ? 'lg:w-20' : 'lg:w-72 xl:w-80'}
          will-change-transform`}
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999 }}
      >
        {/* Header with toggle button */}
        <div className="flex items-center justify-end h-12 sm:h-14 lg:h-16 px-3 sm:px-4 border-b border-gray-800/50 dark:border-gray-800/50 bg-gray-900/80 dark:bg-gray-900/80 backdrop-blur-sm flex-shrink-0">
          <button
            onClick={() => {
              const next = !collapsed;
              setCollapsed(next);
              onCollapsedChange?.(next);
            }}
            className="hidden lg:flex p-2 hover:bg-gray-800/50 rounded-lg transition-all"
          >
            {collapsed ? (
              <MenuIcon className="w-5 h-5 text-gray-400" />
            ) : (
              <X className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>

        {/* Buttons Container */}
        <div className="flex flex-col gap-2 sm:gap-3 p-2 sm:p-3 flex-1 overflow-y-auto bg-gray-900/80 dark:bg-gray-900/80">
         
          {/* Kassa Button */}
          <button
            onClick={() => {
              navigate('/kassa');
              if (!collapsed) onClose();
            }}
            className={`flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-4 rounded-lg transition-all group ${
              collapsed ? 'justify-center px-2 sm:px-3' : ''
            } ${
              isCashRegisterActive
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                : 'bg-gray-900/30 hover:bg-gray-900/50 text-gray-300 hover:text-white border border-transparent hover:border-gray-700/50'
            }`}
            title="Kassa"
          >
            <Calculator className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 transition ${isCashRegisterActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
            {!collapsed && (
              <span className="font-semibold text-sm sm:text-base whitespace-nowrap">
                Kassa
              </span>
            )}
          </button>

          {/* Products Button - TEGMASLIK KERAK */}
          <button
            onClick={() => {
              navigate('/products');
              if (!collapsed) onClose();
            }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
              collapsed ? 'justify-center px-2' : ''
            } ${
              isProductsActive
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                : 'bg-gray-900/30 hover:bg-gray-900/50 text-gray-300 hover:text-white border border-transparent hover:border-gray-700/50'
            }`}
            title="Mahsulotlar"
          >
            <svg className={`w-5 h-5 flex-shrink-0 transition ${isProductsActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            className={`flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-4 rounded-lg transition-all group ${
              collapsed ? 'justify-center px-2 sm:px-3' : ''
            } ${
              isAddCategoryActive
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                : 'bg-gray-900/30 hover:bg-gray-900/50 text-gray-300 hover:text-white border border-transparent hover:border-gray-700/50'
            }`}
            title="Kategoriya qo'shish"
          >
            <Layers className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 transition ${isAddCategoryActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
            {!collapsed && (
              <span className="font-semibold text-sm sm:text-base whitespace-nowrap">
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
            className={`flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-4 rounded-lg transition-all group ${
              collapsed ? 'justify-center px-2 sm:px-3' : ''
            } ${
              isStatsActive
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                : 'bg-gray-900/30 hover:bg-gray-900/50 text-gray-300 hover:text-white border border-transparent hover:border-gray-700/50'
            }`}
            title="Statistikalar"
          >
            <svg
              className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 transition ${isStatsActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}
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
              <span className="font-semibold text-sm sm:text-base whitespace-nowrap">
                Statistikalar
              </span>
            )}
          </button>

          {/* Users Button - Faqat ma'lum foydalanuvchiga ko'rinadi */}
          {canSeeUsers && (
            <button
              onClick={() => {
                navigate('/users');
                if (!collapsed) onClose();
              }}
              className={`flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-4 rounded-lg transition-all group ${
                collapsed ? 'justify-center px-2 sm:px-3' : ''
              } ${
                isUsersActive
                  ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                  : 'bg-gray-900/30 hover:bg-gray-900/50 text-gray-300 hover:text-white border border-transparent hover:border-gray-700/50'
              }`}
              title="Foydalanuvchilar"
            >
              <Users className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 transition ${isUsersActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
              {!collapsed && (
                <span className="font-semibold text-sm sm:text-base whitespace-nowrap">
                  Foydalanuvchilar
                </span>
              )}
            </button>
          )}

          {/* Xodimlar Button - Faqat egasiga ko'rinadi */}
          {canSeeXodimlar && (
            <button
              onClick={() => {
                navigate('/xodimlar');
                if (!collapsed) onClose();
              }}
              className={`flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-4 rounded-lg transition-all group ${
                collapsed ? 'justify-center px-2 sm:px-3' : ''
              } ${
                isXodimlarActive
                  ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                  : 'bg-gray-900/30 hover:bg-gray-900/50 text-gray-300 hover:text-white border border-transparent hover:border-gray-700/50'
              }`}
              title="Xodimlar"
            >
              <UserCog className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 transition ${isXodimlarActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
              {!collapsed && (
                <span className="font-semibold text-sm sm:text-base whitespace-nowrap">
                  Xodimlar
                </span>
              )}
            </button>
          )}

          {/* Debts Button */}
          <button
            onClick={() => {
              navigate('/debts');
              if (!collapsed) onClose();
            }}
            className={`flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-4 rounded-lg transition-all group ${
              collapsed ? 'justify-center px-2 sm:px-3' : ''
            } ${
              isDebtsActive
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                : 'bg-gray-900/30 hover:bg-gray-900/50 text-gray-300 hover:text-white border border-transparent hover:border-gray-700/50'
            }`}
            title="Qarzlar"
          >
            <Wallet className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 transition ${isDebtsActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
            {!collapsed && (
              <span className="font-semibold text-sm sm:text-base whitespace-nowrap">
                Qarzlar
              </span>
            )}
          </button>

          {/* Customers Button */}
          <button
            onClick={() => {
              navigate('/customers');
              if (!collapsed) onClose();
            }}
            className={`flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-4 rounded-lg transition-all group ${
              collapsed ? 'justify-center px-2 sm:px-3' : ''
            } ${
              isCustomersActive
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                : 'bg-gray-900/30 hover:bg-gray-900/50 text-gray-300 hover:text-white border border-transparent hover:border-gray-700/50'
            }`}
            title="Mijozlar"
          >
            <UserCheck className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 transition ${isCustomersActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
            {!collapsed && (
              <span className="font-semibold text-sm sm:text-base whitespace-nowrap">
                Mijozlar
              </span>
            )}
          </button>
        </div>

        {/* Profil Button - Sidebar pastida */}
        <div className="p-2 sm:p-3 border-t border-gray-800/50 dark:border-gray-800/50 mt-auto bg-gray-900/80 dark:bg-gray-900/80 backdrop-blur-sm space-y-2">
          {/* Profil ma'lumotlari - Desktop uchun Popover, Mobile uchun oddiy ko'rinish */}
          <div className="hidden lg:block">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={`flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-4 rounded-lg transition-all group w-full ${
                    collapsed ? 'justify-center px-2 sm:px-3' : ''
                  } bg-gray-900/30 hover:bg-gray-900/50 text-gray-300 hover:text-white border border-transparent hover:border-gray-700/50`}
                  title="Profil"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  {!collapsed && (
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-semibold text-sm text-white truncate">{user?.name || 'Foydalanuvchi'}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {user?.role === 'egasi' ? 'Egasi' : user?.role === 'admin' ? 'Admin' : 'Xodim'}
                      </p>
                    </div>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent 
                side="right" 
                align="end" 
                sideOffset={10}
                className="w-64 p-0 bg-gray-900 border-gray-700 z-[10000]"
              >
                {/* Profil ma'lumotlari */}
                <div className="p-4 border-b border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{user?.name || 'Foydalanuvchi'}</p>
                      <p className="text-sm text-gray-400 truncate">{user?.phone || ''}</p>
                    </div>
                  </div>
                  {/* Rol badge */}
                  <div className="mt-3 flex items-center gap-2">
                    {user?.role === 'egasi' ? (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
                        <Crown className="w-3 h-3" />
                        Egasi
                      </div>
                    ) : user?.role === 'admin' ? (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                        <Shield className="w-3 h-3" />
                        Admin
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                        <UserCog className="w-3 h-3" />
                        Xodim
                      </div>
                    )}
                  </div>
                </div>
                {/* O'zimnikiga qaytish tugmasi (agar loginAs ishlatilgan bo'lsa) */}
                {originalUser && (
                  <div className="p-2 border-b border-gray-700">
                    <button
                      onClick={() => {
                        returnToOriginal();
                        navigate('/kassa');
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <div className="text-left">
                        <span className="text-sm font-medium block">O'zimnikiga qaytish</span>
                        <span className="text-xs text-gray-500">{originalUser.name}</span>
                      </div>
                    </button>
                  </div>
                )}
                {/* Chiqish tugmasi */}
                <div className="p-2">
                  <button
                    onClick={() => setLogoutConfirm(true)}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">Chiqish</span>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Mobile uchun - Popover siz, to'g'ridan-to'g'ri ko'rinish */}
          <div className="lg:hidden">
            {/* Profil ma'lumotlari */}
            <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-gray-900/30 border border-gray-700/50 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-base">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-white truncate">{user?.name || 'Foydalanuvchi'}</p>
                <p className="text-xs text-gray-400 truncate">{user?.phone || ''}</p>
              </div>
              {/* Rol badge */}
              {user?.role === 'egasi' ? (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
                  <Crown className="w-3 h-3" />
                </div>
              ) : user?.role === 'admin' ? (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                  <Shield className="w-3 h-3" />
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                  <UserCog className="w-3 h-3" />
                </div>
              )}
            </div>

            {/* O'zimnikiga qaytish tugmasi (agar loginAs ishlatilgan bo'lsa) */}
            {originalUser && (
              <button
                onClick={() => {
                  returnToOriginal();
                  navigate('/kassa');
                  onClose();
                }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors mb-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <div className="text-left">
                  <span className="text-sm font-medium block">O'zimnikiga qaytish</span>
                  <span className="text-xs text-gray-500">{originalUser.name}</span>
                </div>
              </button>
            )}

            {/* Chiqish tugmasi - KATTA va ANIQ */}
            <button
              onClick={() => setLogoutConfirm(true)}
              className="flex items-center justify-center gap-3 w-full px-4 py-4 rounded-lg text-white bg-red-600 hover:bg-red-700 active:bg-red-800 transition-colors font-semibold text-base shadow-lg shadow-red-900/30"
            >
              <LogOut className="w-5 h-5" />
              <span>Chiqish</span>
            </button>
          </div>
        </div>

      </aside>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        open={logoutConfirm}
        onOpenChange={setLogoutConfirm}
        title="Tizimdan chiqish"
        description="Tizimdan chiqmoqchimisiz? Qayta kirish uchun login qilishingiz kerak bo'ladi."
        confirmText="Chiqish"
        cancelText="Bekor qilish"
        onConfirm={handleLogoutConfirm}
        variant="destructive"
      />
    </>
  );
}
