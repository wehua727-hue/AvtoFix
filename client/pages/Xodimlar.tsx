import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';
import { UserCog, Phone, MapPin, Loader2, LogIn } from 'lucide-react';

interface Xodim {
  id: string;
  name: string;
  phone: string;
  address: string;
  role: string;
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

  // Faqat egasi ko'ra oladi
  const hasAccess = currentUser?.role === 'egasi';

  useEffect(() => {
    if (!hasAccess) {
      navigate('/kassa');
      return;
    }
    fetchXodimlar();
  }, [hasAccess, navigate]);

  const fetchXodimlar = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users`);
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


  // Xodim sifatida kirish
  const handleLoginAs = async (xodim: Xodim) => {
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
      
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900/80">
        <main className={`pt-14 lg:pt-16 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`}>
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <UserCog className="w-8 h-8 text-green-500" />
                Xodimlar
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {xodimlar.length} ta xodim
              </p>
            </motion.div>

            {/* Loading */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : xodimlar.length === 0 ? (
              <div className="text-center py-20">
                <UserCog className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Hozircha xodimlar yo'q</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
                  Foydalanuvchilar sahifasidan yangi xodim qo'shing
                </p>
              </div>
            ) : (
              /* Xodimlar Grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {xodimlar.map((xodim, index) => (
                  <motion.div
                    key={xodim.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card 
                      className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-green-500/50 transition-all cursor-pointer group"
                      onClick={() => handleLoginAs(xodim)}
                    >
                      <CardContent className="p-4">
                        {/* Avatar va Ism */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                            <span className="text-green-500 font-bold text-lg">
                              {xodim.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                              {xodim.name}
                            </h3>
                            <span className="text-xs text-green-500 font-medium">Xodim</span>
                          </div>
                          {loggingInAs === xodim.id ? (
                            <Loader2 className="w-5 h-5 animate-spin text-green-500" />
                          ) : (
                            <LogIn className="w-5 h-5 text-gray-400 group-hover:text-green-500 transition-colors" />
                          )}
                        </div>

                        {/* Telefon */}
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <Phone className="w-4 h-4" />
                          <span>{formatPhone(xodim.phone)}</span>
                        </div>

                        {/* Manzil */}
                        {xodim.address && (
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500">
                            <MapPin className="w-4 h-4" />
                            <span className="truncate">{xodim.address}</span>
                          </div>
                        )}

                        {/* Kirish tugmasi */}
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="text-xs text-center text-gray-500 dark:text-gray-500 group-hover:text-green-500 transition-colors">
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
