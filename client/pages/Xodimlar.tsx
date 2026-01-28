import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';
import { UserCog, Phone, MapPin, Loader2, LogIn, Eye, EyeOff } from 'lucide-react';

interface Xodim {
  id: string;
  name: string;
  phone: string;
  address: string;
  role: string;
  createdBy?: string;
  canEditProducts?: boolean;
  createdAt: string;
}

// API base URL
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  if (window.location.protocol === 'file:') return 'http://127.0.0.1:5174';
  return import.meta.env.VITE_API_URL || '';
})();

export default function Xodimlar() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser, loginAs } = useAuth();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [xodimlar, setXodimlar] = useState<Xodim[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingInAs, setLoggingInAs] = useState<string | null>(null);
  const [togglingPermission, setTogglingPermission] = useState<string | null>(null);

  // Egasi va admin ko'ra oladi
  const hasAccess = currentUser?.role === 'egasi' || currentUser?.role === 'admin';

  useEffect(() => {
    if (!hasAccess) {
      navigate('/kassa');
      return;
    }
    fetchXodimlar();
  }, [hasAccess, navigate, currentUser]);

  const fetchXodimlar = async () => {
    try {
      // Filtrlash parametrlarini qo'shish
      const params = new URLSearchParams();
      if (currentUser?.id) params.append('userId', currentUser.id);
      if (currentUser?.role) params.append('userRole', currentUser.role);
      
      const res = await fetch(`${API_BASE}/api/users?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        // Faqat xodim rolidagilarni filtrlash
        const xodimlarList = data.users.filter((u: Xodim) => u.role === 'xodim');
        setXodimlar(xodimlarList);
      }
    } catch (error) {
      console.error('Xodimlarni yuklashda xato:', error);
      toast({ title: 'Xato', description: 'Xodimlarni yuklashda xatolik', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };


  // Xodimning mahsulot tahrirlash huquqini o'zgartirish
  const toggleCanEditProducts = async (xodim: Xodim, e: React.MouseEvent) => {
    e.stopPropagation(); // Card bosilishini to'xtatish
    setTogglingPermission(xodim.id);
    try {
      const res = await fetch(`${API_BASE}/api/users/${xodim.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canEditProducts: !xodim.canEditProducts })
      });
      const data = await res.json();
      if (data.success) {
        setXodimlar(prev => prev.map(x => 
          x.id === xodim.id ? { ...x, canEditProducts: !x.canEditProducts } : x
        ));
        toast({ 
          title: 'Muvaffaqiyat', 
          description: !xodim.canEditProducts 
            ? `${xodim.name} endi mahsulotlarni tahrirlashi mumkin` 
            : `${xodim.name} endi mahsulotlarni tahrirlay olmaydi`
        });
      }
    } catch (error) {
      console.error('Huquqni o\'zgartirishda xato:', error);
      toast({ title: 'Xato', description: 'Huquqni o\'zgartirishda xatolik', variant: 'destructive' });
    } finally {
      setTogglingPermission(null);
    }
  };

  // Admin faqat o'zi qo'shgan xodimga kira oladi
  const canLoginAs = (xodim: Xodim): boolean => {
    if (currentUser?.role === 'egasi') return true; // Egasi hammaga kira oladi
    if (currentUser?.role === 'admin') {
      // Admin faqat o'zi qo'shgan xodimga kira oladi
      return xodim.createdBy === currentUser.id;
    }
    return false;
  };

  // Xodim sifatida kirish
  const handleLoginAs = async (xodim: Xodim) => {
    // Admin uchun tekshiruv
    if (!canLoginAs(xodim)) {
      toast({ title: 'Ruxsat yo\'q', description: 'Siz faqat o\'zingiz qo\'shgan xodimlarga kira olasiz', variant: 'destructive' });
      return;
    }
    
    setLoggingInAs(xodim.id);
    try {
      // loginAs funksiyasi orqali xodim accountiga kirish
      if (loginAs) {
        await loginAs(xodim.id);
        toast({ title: 'Muvaffaqiyat', description: `${xodim.name} sifatida kirdingiz` });
        navigate('/kassa');
      } else {
        // Agar loginAs yo'q bo'lsa, oddiy login qilamiz
        const res = await fetch(`${API_BASE}/api/auth/login-as`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: xodim.id, adminId: currentUser?.id })
        });
        const data = await res.json();
        if (data.success) {
          // Token va user ma'lumotlarini saqlash
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          window.location.href = '/kassa';
        } else {
          throw new Error(data.error || 'Kirishda xatolik');
        }
      }
    } catch (error: any) {
      console.error('Xodim sifatida kirishda xato:', error);
      toast({ title: 'Xato', description: error.message || 'Kirishda xatolik', variant: 'destructive' });
    } finally {
      setLoggingInAs(null);
    }
  };

  // Telefon raqamni formatlash
  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 9) {
      return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 12 && digits.startsWith('998')) {
      return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`;
    }
    return phone;
  };

  if (!hasAccess) return null;

  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed} />
      
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
        {/* Animated background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-20 w-72 h-72 bg-green-500/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        <main className={`pt-14 lg:pt-16 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`}>
          <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto relative z-10">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 sm:mb-8"
            >
              <div className="flex items-center gap-3">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="p-2.5 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/20"
                >
                  <UserCog className="w-6 h-6 sm:w-7 sm:h-7 text-green-400" />
                </motion.div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Xodimlar</h1>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{xodimlar.length} ta xodim</p>
                </div>
              </div>
            </motion.div>

            {/* Loading */}
            {loading ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <div className="relative">
                  <div className="w-14 h-14 border-4 border-green-500/20 rounded-full" />
                  <div className="absolute inset-0 w-14 h-14 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-gray-400 mt-4 animate-pulse">Yuklanmoqda...</p>
              </motion.div>
            ) : xodimlar.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16 sm:py-20 bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700/50"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                >
                  <UserCog className="w-14 sm:w-16 h-14 sm:h-16 text-gray-500 mx-auto mb-4" />
                </motion.div>
                <p className="text-gray-400 text-base sm:text-lg">Hozircha xodimlar yo'q</p>
                <p className="text-gray-500 text-xs sm:text-sm mt-2 px-4">
                  Foydalanuvchilar sahifasidan yangi xodim qo'shing
                </p>
              </motion.div>
            ) : (
              /* Xodimlar Grid - Responsive */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {xodimlar.map((xodim, index) => (
                  <motion.div
                    key={xodim.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -6, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card 
                      className={`backdrop-blur-xl transition-all duration-300 overflow-hidden relative ${
                        canLoginAs(xodim) 
                          ? 'bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 border border-gray-700/60 hover:shadow-2xl hover:shadow-green-500/20 hover:border-green-500/60 cursor-pointer group' 
                          : 'bg-gray-800/40 border border-gray-700/30 opacity-50 cursor-not-allowed'
                      }`}
                      onClick={() => canLoginAs(xodim) && handleLoginAs(xodim)}
                    >
                      {/* Gradient overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-emerald-500/0 group-hover:from-green-500/10 group-hover:to-emerald-500/5 transition-all duration-300" />
                      {/* Animated border glow */}
                      <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{
                        background: 'radial-gradient(circle at top right, rgba(34, 197, 94, 0.1), transparent 70%)'
                      }} />
                      <CardContent className="p-4 sm:p-5 relative z-10">
                        {/* Ko'rsin/Ko'rmasin Switch */}
                        <div 
                          className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700/60"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2.5">
                            {xodim.canEditProducts ? (
                              <Eye className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-green-400" />
                            ) : (
                              <EyeOff className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-gray-500" />
                            )}
                            <span className={`text-xs sm:text-sm font-semibold ${xodim.canEditProducts ? 'text-green-400' : 'text-gray-500'}`}>
                              {xodim.canEditProducts ? "Tahrirlashi mumkin" : "Tahrirlashi mumkin emas"}
                            </span>
                          </div>
                          {togglingPermission === xodim.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-green-500" />
                          ) : (
                            <Switch
                              checked={xodim.canEditProducts || false}
                              onCheckedChange={() => {}}
                              onClick={(e) => toggleCanEditProducts(xodim, e)}
                              className="data-[state=checked]:bg-green-500"
                            />
                          )}
                        </div>

                        {/* Avatar va Ism */}
                        <div className="flex items-center gap-3 sm:gap-4 mb-4">
                          <motion.div 
                            whileHover={{ scale: 1.15 }}
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/30 border-2 border-green-500/40 flex items-center justify-center flex-shrink-0 shadow-lg shadow-green-500/20"
                          >
                            <span className="text-green-300 font-bold text-lg sm:text-xl">
                              {xodim.name.charAt(0).toUpperCase()}
                            </span>
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white text-sm sm:text-base truncate">
                              {xodim.name}
                            </h3>
                            <span className="text-xs sm:text-sm text-green-400 font-semibold">Xodim</span>
                          </div>
                          {loggingInAs === xodim.id ? (
                            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-green-500 flex-shrink-0" />
                          ) : (
                            <LogIn className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500 group-hover:text-green-400 transition-colors flex-shrink-0" />
                          )}
                        </div>

                        {/* Telefon */}
                        <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-400 mb-3 px-3 py-2 rounded-lg bg-gray-800/40">
                          <Phone className="w-4 h-4 flex-shrink-0 text-green-400" />
                          <span className="truncate">{formatPhone(xodim.phone)}</span>
                        </div>

                        {/* Manzil */}
                        {xodim.address && (
                          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-500 px-3 py-2 rounded-lg bg-gray-800/30 mb-4">
                            <MapPin className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                            <span className="truncate">{xodim.address}</span>
                          </div>
                        )}

                        {/* Kirish tugmasi */}
                        <div className="mt-4 pt-4 border-t border-gray-700/60">
                          <div className="text-xs sm:text-sm text-center text-gray-500 group-hover:text-green-400 transition-colors flex items-center justify-center gap-2 font-semibold">
                            <LogIn className="w-4 h-4" />
                            Bosib kirish
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
