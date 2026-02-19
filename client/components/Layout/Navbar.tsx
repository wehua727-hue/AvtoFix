import { Menu, LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReactNode, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth-context';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface NavbarProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
  rightSlot?: ReactNode;
}

// Sahifa nomlari
const pageNames: Record<string, string> = {
  '/': 'Mahsulotlar',
  '/products': 'Mahsulotlar',
  '/add-category': 'Kategoriyalar',
  '/stats': 'Statistika',
  '/users': 'Foydalanuvchilar',
  '/debts': 'Qarzlar',
  '/customers': 'Mijozlar',
  '/customer-data': 'Mijoz Datalari',
  '/stores': 'Magazinlar',
  '/kassa': 'Kassa',
};

export default function Navbar({ onMenuClick, sidebarCollapsed, rightSlot }: NavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const handleLogoutConfirm = () => {
    logout();
    navigate('/login');
    setLogoutConfirm(false);
  };
  
  // Joriy sahifa nomini olish
  const getPageName = () => {
    const path = location.pathname;
    if (pageNames[path]) return pageNames[path];
    
    // Dinamik yo'llar uchun
    if (path.startsWith('/product/')) return 'Mahsulot';
    if (path.startsWith('/store/')) return 'Magazin';
    
    return 'Sahifa';
  };

  return (
    <header 
      className={`fixed top-0 right-0 z-[9999] h-12 sm:h-14 lg:h-16 bg-gray-900/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-800/50 dark:border-gray-800/50 transition-all duration-300 ${
        sidebarCollapsed ? 'left-0 lg:left-20' : 'left-0 lg:left-72 xl:left-80'
      } will-change-transform`}
      style={{ position: 'fixed', top: 0, zIndex: 9999 }}
    >
      <div className="h-full px-2 sm:px-3 lg:px-4 flex items-center justify-between gap-2">
        {/* Left: Mobile menu button + Page title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2.5 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 hover:text-white transition-all flex-shrink-0 shadow-lg border border-gray-700/50"
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          
          <h1 className="text-sm sm:text-base lg:text-lg font-semibold text-white dark:text-white truncate">
            {getPageName()}
          </h1>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 overflow-x-auto">
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          {rightSlot}
          {/* Logout Button */}
          <button
            onClick={() => setLogoutConfirm(true)}
            className="p-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white transition-all flex-shrink-0 shadow-lg border border-red-500/50 hover:border-red-400"
            title="Chiqish"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

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
    </header>
  );
}
