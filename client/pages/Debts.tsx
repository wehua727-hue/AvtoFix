import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, RefreshCw, CheckCircle, XCircle, Edit, Trash2, Wallet, Phone, Calendar, FileText, Ban, AlertTriangle, Search, X, Sparkles, Clock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { getAllDebts, markDebtAsPaid, markDebtAsUnpaid, deleteDebt, getBlacklist } from '@/services/debtService';
import type { IDebt } from '@shared/debt-types';
import DebtFormDialog from '@/components/Debts/DebtFormDialog';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';
import { useAuth } from '@/lib/auth-context';

type FilterType = 'all' | 'pending' | 'overdue' | 'paid' | 'today' | 'tomorrow' | 'unpaid';
type ConfirmationType = 'paid' | 'unpaid' | 'delete' | null;

interface ConfirmationState {
  type: ConfirmationType;
  debtId: string;
  creditor: string;
  isBlacklisted?: boolean;
}

interface BlacklistEntry {
  _id: string;
  creditor: string;
  phone?: string;
  reason?: string;
  totalUnpaidAmount: number;
  createdAt: string;
}

export default function Debts() {
  const [debts, setDebts] = useState<IDebt[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<IDebt | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const loadDebts = async () => {
    setLoading(true);
    try {
      const [debtsResult, blacklistResult] = await Promise.all([
        getAllDebts(),
        getBlacklist()
      ]);
      
      if (debtsResult.success) {
        setDebts(debtsResult.debts);
      }
      if (blacklistResult.success) {
        setBlacklist(blacklistResult.blacklist || []);
      }
    } catch (error: any) {
      toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDebts(); }, []);

  // Modal ochish
  const openConfirmation = (type: ConfirmationType, debtId: string, creditor: string, isBlacklisted?: boolean) => {
    setConfirmation({ type, debtId, creditor, isBlacklisted });
  };

  const closeConfirmation = () => setConfirmation(null);

  // SMS modal ochish
  const handleOpenSmsModal = () => {
    const debtsWithPhone = filteredDebts.filter(d => d.phone);
    if (debtsWithPhone.length === 0) {
      toast({ title: 'Xatolik', description: 'Telefon raqami bor qarzdorlar topilmadi', variant: 'destructive' });
      return;
    }
    setSmsModalOpen(true);
  };

  // SMS URL yaratish (bitta qarzdor uchun)
  const getSmsUrl = (phone: string) => {
    const shopName = user?.name || 'do\'kon';
    const message = `Sizning ${shopName} do'konidan olgan qarz muddatingiz ertaga tugaydi. Iltimos qarzingizni o'z vaqtida to'lab qo'ying!`;
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('998') ? cleanPhone : `998${cleanPhone}`;
    return `sms:+${fullPhone}?&body=${encodeURIComponent(message)}`;
  };

  // Android uchun - barcha qarzdorlarga bittada SMS
  const handleSendAllSmsAndroid = () => {
    const debtsWithPhone = filteredDebts.filter(d => d.phone);
    if (debtsWithPhone.length === 0) return;
    
    const shopName = user?.name || 'do\'kon';
    const message = `Sizning ${shopName} do'konidan olgan qarz muddatingiz ertaga tugaydi. Iltimos qarzingizni o'z vaqtida to'lab qo'ying!`;
    
    // Android uchun nuqta-vergul bilan ajratish
    const phoneNumbers = debtsWithPhone.map(d => {
      const cleanPhone = d.phone!.replace(/\D/g, '');
      return cleanPhone.startsWith('998') ? `+${cleanPhone}` : `+998${cleanPhone}`;
    }).join(';');
    
    window.location.href = `sms:${phoneNumbers}?body=${encodeURIComponent(message)}`;
    setSmsModalOpen(false);
    toast({ title: 'SMS', description: `${debtsWithPhone.length} ta qarzdorga SMS yuborish oynasi ochildi` });
  };



  // Tasdiqlash
  const handleConfirmAction = async () => {
    if (!confirmation) return;
    setActionLoading(true);
    try {
      if (confirmation.type === 'paid') {
        const result = await markDebtAsPaid(confirmation.debtId, 'To\'lov qabul qilindi');
        if (result.success) {
          toast({
            title: 'Muvaffaqiyatli',
            description: confirmation.isBlacklisted ? 'Qarz to\'landi va qora ro\'yxatdan chiqarildi' : 'Qarz to\'langan deb belgilandi',
          });
          loadDebts();
        }
      } else if (confirmation.type === 'unpaid') {
        const result = await markDebtAsUnpaid(confirmation.debtId, 'Qarz to\'lanmadi');
        if (result.success) {
          toast({ title: 'Qora ro\'yxatga qo\'shildi', description: `${confirmation.creditor} endi qarz ola olmaydi`, variant: 'destructive' });
          loadDebts();
        }
      } else if (confirmation.type === 'delete') {
        const result = await deleteDebt(confirmation.debtId, 'Foydalanuvchi o\'chirdi');
        if (result.success) {
          toast({ title: 'Muvaffaqiyatli', description: 'Qarz o\'chirildi' });
          loadDebts();
        }
      }
    } catch (error: any) {
      toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
      closeConfirmation();
    }
  };

  const calculateStats = () => {
    const pending = debts.filter((d) => d.status === 'pending');
    const paid = debts.filter((d) => d.status === 'paid');
    const overdue = debts.filter((d) => d.status === 'overdue');
    const unpaid = debts.filter((d) => d.status === 'unpaid');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueToday = debts.filter((d) => {
      if (d.status === 'paid' || d.status === 'unpaid' || !d.dueDate) return false;
      const dueDate = new Date(d.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === today.getTime();
    });
    
    // Ertaga to'lov muddati keladiganlar
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueTomorrow = debts.filter((d) => {
      if (d.status === 'paid' || d.status === 'unpaid' || !d.dueDate) return false;
      const dueDate = new Date(d.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === tomorrow.getTime();
    });
    
    const totalAmount = [...pending, ...overdue].reduce((sum, d) => sum + d.amount, 0);
    // Qora ro'yxat soni - blacklist API dan yoki unpaid qarzlardan
    const blacklistCount = blacklist.length > 0 ? blacklist.length : unpaid.length;
    return { total: debts.length, pending: pending.length, paid: paid.length, overdue: overdue.length, unpaid: unpaid.length, blacklistCount, dueToday: dueToday.length, dueTomorrow: dueTomorrow.length, totalAmount };
  };

  const stats = calculateStats();
  
  const filteredDebts = useMemo(() => {
    let result = debts;
    
    // Qidiruv filtri
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      // Telefon qidirish uchun faqat raqamlarni olish
      const queryDigits = query.replace(/\D/g, '');
      
      result = result.filter((debt) => {
        // Qarz oluvchi nomi bo'yicha qidirish
        if (debt.creditor.toLowerCase().includes(query)) return true;
        // Telefon raqami bo'yicha qidirish (probellar va boshqa belgilarsiz)
        if (debt.phone) {
          const phoneDigits = debt.phone.replace(/\D/g, '');
          if (phoneDigits.includes(queryDigits) && queryDigits.length > 0) return true;
          if (debt.phone.toLowerCase().includes(query)) return true;
        }
        // Qarz miqdori bo'yicha qidirish
        if (debt.amount.toString().includes(query)) return true;
        // Izoh bo'yicha qidirish
        if (debt.description && debt.description.toLowerCase().includes(query)) return true;
        // Qarz sanasi bo'yicha qidirish (ISO va local format)
        if (debt.debtDate) {
          const debtDateStr = new Date(debt.debtDate).toLocaleDateString('uz-UZ');
          const debtDateISO = debt.debtDate.split('T')[0]; // 2025-12-07 format
          if (debtDateStr.includes(query) || debtDateISO.includes(query)) return true;
        }
        // To'lov muddati bo'yicha qidirish (ISO va local format)
        if (debt.dueDate) {
          const dueDateStr = new Date(debt.dueDate).toLocaleDateString('uz-UZ');
          const dueDateISO = debt.dueDate.split('T')[0]; // 2025-12-07 format
          if (dueDateStr.includes(query) || dueDateISO.includes(query)) return true;
        }
        return false;
      });
    }
    
    // Status filtri
    if (activeFilter === 'all') return result;
    if (activeFilter === 'pending') return result.filter(d => d.status === 'pending');
    if (activeFilter === 'overdue') return result.filter(d => d.status === 'overdue');
    if (activeFilter === 'paid') return result.filter(d => d.status === 'paid');
    if (activeFilter === 'unpaid') return result.filter(d => d.status === 'unpaid');
    if (activeFilter === 'today') {
      return result.filter(d => {
        if (d.status === 'paid' || d.status === 'unpaid' || !d.dueDate) return false;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dueDate = new Date(d.dueDate); dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() === today.getTime();
      });
    }
    if (activeFilter === 'tomorrow') {
      return result.filter(d => {
        if (d.status === 'paid' || d.status === 'unpaid' || !d.dueDate) return false;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        const dueDate = new Date(d.dueDate); dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() === tomorrow.getTime();
      });
    }
    return result;
  }, [debts, searchQuery, activeFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/3 rounded-full blur-3xl" />
      </div>
      
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onCollapsedChange={setSidebarCollapsed} />
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed}
        rightSlot={
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button onClick={() => setIsAddDialogOpen(true)} className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm px-4 py-2 h-auto shadow-lg shadow-red-900/30 border-0">
              <Plus className="w-4 h-4 mr-1.5" />Qo'shish
            </Button>
          </motion.div>
        }
      />

      <main className={`pt-14 sm:pt-16 lg:pt-18 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`}>
        <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto relative z-10">
          {/* Header with animation */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/20">
                <Wallet className="w-6 h-6 text-red-400" />
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Qarzlar</h1>
              <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-400 ml-14">{stats.pending} ta kutilmoqda • {stats.overdue} ta muddati o'tgan • {stats.paid} ta to'langan</p>
          </motion.div>
          
          {/* Qidiruv - Responsive */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-5"
          >
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 sm:py-3 bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-xl text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm sm:text-base"
              />
              {searchQuery && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-gray-700/50 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* Stats Cards - Responsive Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3 mb-6"
          >
            {[
              { key: 'all', label: 'Jami', count: stats.total, gradient: 'from-blue-600 to-blue-700', icon: Wallet },
              { key: 'pending', label: 'Kutilmoqda', count: stats.pending, gradient: 'from-orange-500 to-amber-600', icon: RefreshCw },
              { key: 'today', label: 'Bugun', count: stats.dueToday, gradient: 'from-yellow-500 to-yellow-600', icon: Calendar },
              { key: 'tomorrow', label: 'Ertaga', count: stats.dueTomorrow, gradient: 'from-cyan-500 to-teal-600', icon: Clock },
              { key: 'overdue', label: "Muddati o'tgan", count: stats.overdue, gradient: 'from-red-600 to-rose-600', icon: AlertTriangle },
              { key: 'paid', label: "To'langan", count: stats.paid, gradient: 'from-green-600 to-emerald-600', icon: CheckCircle },
              { key: 'unpaid', label: "Qora ro'yxat", count: stats.blacklistCount, gradient: 'from-gray-600 to-gray-700', icon: Ban },
            ].map(({ key, label, count, gradient, icon: Icon }, index) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="h-full"
              >
                <Card 
                  onClick={() => setActiveFilter(key as FilterType)}
                  className={`cursor-pointer transition-all duration-300 border-2 bg-gradient-to-br ${gradient} shadow-lg hover:shadow-xl h-full ${
                    activeFilter === key 
                      ? 'border-white ring-2 ring-white/30 shadow-2xl' 
                      : 'border-transparent hover:border-white/30'
                  }`}
                >
                  <CardContent className="p-2.5 sm:p-3 h-full">
                    <div className="flex items-center justify-between h-full">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] sm:text-xs text-white/80 mb-0.5 sm:mb-1 font-medium truncate">{label}</p>
                        <p className="text-lg sm:text-xl lg:text-2xl font-bold text-white">{count}</p>
                      </div>
                      <div className="p-1.5 sm:p-2 rounded-lg bg-white/15 backdrop-blur-sm flex-shrink-0 ml-2">
                        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.02, y: -2 }}
              className="h-full"
            >
              <Card className="bg-gradient-to-br from-purple-600 to-violet-700 border-2 border-transparent shadow-lg shadow-purple-900/30 h-full">
                <CardContent className="p-2.5 sm:p-3 h-full">
                  <div className="flex items-center justify-between h-full">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] sm:text-xs text-white/80 mb-0.5 sm:mb-1 font-medium">Jami Summa</p>
                      <p className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">{stats.totalAmount.toLocaleString()}</p>
                    </div>
                    <div className="text-[10px] sm:text-xs text-white/60 ml-2">UZS</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {activeFilter !== 'all' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-4 flex items-center gap-2"
            >
              <Badge variant="outline" className="bg-gray-800/60 backdrop-blur-sm border-gray-700 text-gray-300 px-3 py-1.5 text-xs sm:text-sm">
                {activeFilter === 'pending' && 'Kutilmoqda'}{activeFilter === 'overdue' && "Muddati o'tgan"}{activeFilter === 'today' && 'Bugun'}{activeFilter === 'tomorrow' && 'Ertaga'}{activeFilter === 'paid' && "To'langan"}{activeFilter === 'unpaid' && "Qora ro'yxat"}: {filteredDebts.length} ta
              </Badge>
              {/* Ertaga filtri uchun umumiy SMS tugmasi */}
              {activeFilter === 'tomorrow' && filteredDebts.length > 0 && (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button 
                    size="sm" 
                    className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white h-8 px-3 text-xs font-medium shadow-lg shadow-cyan-900/30"
                    onClick={handleOpenSmsModal}
                  >
                    <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                    SMS yuborish
                  </Button>
                </motion.div>
              )}
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white hover:bg-gray-700/50 h-8 w-8 p-0 rounded-full" onClick={() => setActiveFilter('all')}>
                  <XCircle className="w-4 h-4" />
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* Debts List */}
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-500/20 rounded-full" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-gray-400 mt-4 animate-pulse">Yuklanmoqda...</p>
            </motion.div>
          ) : filteredDebts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/50">
                <CardContent className="py-16 sm:py-20 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  >
                    <Wallet className="w-16 sm:w-20 h-16 sm:h-20 mx-auto opacity-30 text-gray-500 mb-4" />
                  </motion.div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-400 mb-2">{activeFilter === 'all' ? "Qarzlar yo'q" : "Bu kategoriyada qarz yo'q"}</h3>
                  <p className="text-sm text-gray-500">Yangi qarz qo'shish uchun yuqoridagi tugmani bosing</p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              <AnimatePresence mode="popLayout">
                {filteredDebts.map((debt, index) => (
                  <motion.div key={debt._id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: index * 0.05 }} className="h-full">
                    <Card className={`h-full hover:shadow-lg transition-all duration-300 rounded-lg overflow-hidden bg-gray-900/50 dark:bg-gray-900/50 border border-gray-800/50 dark:border-gray-800/50 ${
                      debt.status === 'unpaid' ? 'border-gray-600 dark:border-gray-600' :
                      debt.status === 'paid' ? 'border-green-600/50 dark:border-green-600/50' :
                      debt.status === 'overdue' ? 'border-red-600/50 dark:border-red-600/50' :
                      'border-gray-700 dark:border-gray-700'
                    }`}>
                      <CardContent className="p-0 h-full flex flex-col">
                        {/* Header */}
                        <div className={`px-5 py-4 border-b border-gray-800/50 dark:border-gray-800/50 bg-gray-800/30 dark:bg-gray-800/30`}>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              {debt.status === 'unpaid' ? (
                                <Badge className="bg-gray-600/30 text-gray-300 border-gray-500/40 text-[11px] px-2.5 py-1 font-medium">
                                  <Ban className="w-3 h-3 mr-1.5" />Qora ro'yxat
                                </Badge>
                              ) : debt.status === 'overdue' ? (
                                <Badge className="bg-red-600/30 text-red-300 border-red-500/40 text-[11px] px-2.5 py-1 font-medium animate-pulse">
                                  <AlertTriangle className="w-3 h-3 mr-1.5" />Muddati o'tgan
                                </Badge>
                              ) : debt.status === 'paid' ? (
                                <Badge className="bg-green-600/30 text-green-300 border-green-500/40 text-[11px] px-2.5 py-1 font-medium">
                                  <CheckCircle className="w-3 h-3 mr-1.5" />To'langan
                                </Badge>
                              ) : (
                                <Badge className="bg-orange-600/30 text-orange-300 border-orange-500/40 text-[11px] px-2.5 py-1 font-medium">
                                  <RefreshCw className="w-3 h-3 mr-1.5" />Kutilmoqda
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-sm font-bold text-gray-200 dark:text-gray-200 tracking-wide">{debt.creditor}</h3>
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="px-5 py-4 flex-1">
                          <div className="text-3xl font-black mb-4 tracking-tight text-gray-200 dark:text-gray-200">
                            {debt.amount.toLocaleString()}
                            <span className="text-sm font-medium text-gray-400 dark:text-gray-400 ml-1.5">{debt.currency}</span>
                          </div>

                          {/* Info */}
                          <div className="space-y-2.5 text-[13px]">
                            <div className="flex items-center gap-2.5 text-gray-400 dark:text-gray-400">
                              <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-500" />
                              <span>Qarz sanasi: {new Date(debt.debtDate).toLocaleDateString('uz-UZ')}</span>
                            </div>
                            {debt.dueDate && (
                              <div className={`flex items-center gap-2.5 ${debt.status === 'overdue' ? 'text-red-400 dark:text-red-400 font-semibold' : 'text-gray-400 dark:text-gray-400'}`}>
                                <Calendar className={`w-4 h-4 ${debt.status === 'overdue' ? 'text-red-500 dark:text-red-500' : 'text-gray-500 dark:text-gray-500'}`} />
                                <span>To'lov muddati: {new Date(debt.dueDate).toLocaleDateString('uz-UZ')}</span>
                              </div>
                            )}
                            {debt.phone && (
                              <div className="flex items-center gap-2.5 text-gray-400 dark:text-gray-400">
                                <Phone className="w-4 h-4 text-gray-500 dark:text-gray-500" />
                                <span>{debt.phone}</span>
                              </div>
                            )}
                            {debt.description && (
                              <div className="flex items-start gap-2.5 text-gray-400 dark:text-gray-400">
                                <FileText className="w-4 h-4 text-gray-500 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                                <span className="line-clamp-2">{debt.description}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="px-5 py-4 border-t border-gray-800/50 dark:border-gray-800/50 bg-gray-800/20 dark:bg-gray-800/20">
                          <div className="flex gap-2">
                            {(debt.status === 'pending' || debt.status === 'overdue') && (
                              <>
                                <Button size="sm" className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 h-10 text-xs font-semibold shadow-lg shadow-green-900/30" onClick={() => openConfirmation('paid', debt._id, debt.creditor)}>
                                  <CheckCircle className="w-4 h-4 mr-1.5" />To'landi
                                </Button>
                                <Button size="sm" className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 h-10 text-xs font-semibold shadow-lg shadow-gray-900/30" onClick={() => openConfirmation('unpaid', debt._id, debt.creditor)}>
                                  <XCircle className="w-4 h-4 mr-1.5" />To'lanmadi
                                </Button>

                                <Button size="sm" variant="outline" className="bg-slate-700/60 border-slate-500/50 hover:bg-slate-600 h-10 w-10 p-0" onClick={() => setEditingDebt(debt)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {debt.status === 'unpaid' && (
                              <>
                                <Button size="sm" className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 h-10 text-xs font-semibold shadow-lg shadow-green-900/30" onClick={() => openConfirmation('paid', debt._id, debt.creditor, true)}>
                                  <CheckCircle className="w-4 h-4 mr-1.5" />To'landi
                                </Button>
                                <div className="flex items-center justify-center text-gray-500 px-3">
                                  <Ban className="w-4 h-4" />
                                </div>
                              </>
                            )}
                            {debt.status === 'paid' && (
                              <div className="flex-1 flex items-center justify-center text-green-400/60 text-xs font-medium">
                                <CheckCircle className="w-8 h-10 mr-1.5" />To'langan
                              </div>
                            )}
                            <Button size="sm" variant="outline" className="bg-red-900/40 border-red-600/40 hover:bg-red-800/60 text-red-400 h-10 w-10 p-0" onClick={() => openConfirmation('delete', debt._id, debt.creditor)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          <DebtFormDialog open={isAddDialogOpen || !!editingDebt} onOpenChange={(open) => { if (!open) { setIsAddDialogOpen(false); setEditingDebt(null); } }} debt={editingDebt} onSuccess={() => { setIsAddDialogOpen(false); setEditingDebt(null); loadDebts(); }} />

          {/* Confirmation Modal */}
          <AlertDialog open={!!confirmation} onOpenChange={(open) => !open && closeConfirmation()}>
            <AlertDialogContent className="bg-gray-900 dark:bg-gray-900 border-gray-800/50 dark:border-gray-800/50 max-w-md">
              <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  {confirmation?.type === 'paid' && <div className="p-3 rounded-full bg-green-500/20"><CheckCircle className="w-6 h-6 text-green-400" /></div>}
                  {confirmation?.type === 'unpaid' && <div className="p-3 rounded-full bg-orange-500/20"><AlertTriangle className="w-6 h-6 text-orange-400" /></div>}
                  {confirmation?.type === 'delete' && <div className="p-3 rounded-full bg-red-500/20"><Trash2 className="w-6 h-6 text-red-400" /></div>}
                  <AlertDialogTitle className="text-gray-200 dark:text-gray-200 text-lg">
                    {confirmation?.type === 'paid' && "Qarzni to'langan deb belgilash"}
                    {confirmation?.type === 'unpaid' && "Qora ro'yxatga qo'shish"}
                    {confirmation?.type === 'delete' && "Qarzni o'chirish"}
                  </AlertDialogTitle>
                </div>
                <AlertDialogDescription className="text-gray-400 dark:text-gray-400 text-sm leading-relaxed">
                  {confirmation?.type === 'paid' && <><span className="font-semibold text-gray-200 dark:text-gray-200">{confirmation.creditor}</span> ning qarzini to'langan deb belgilaysizmi?{confirmation.isBlacklisted && <span className="block mt-2 text-green-400 dark:text-green-400">✓ Qora ro'yxatdan ham chiqariladi</span>}</>}
                  {confirmation?.type === 'unpaid' && <><span className="font-semibold text-gray-200 dark:text-gray-200">{confirmation?.creditor}</span> qora ro'yxatga qo'shiladi va <span className="text-orange-400 dark:text-orange-400 font-medium">qaytib qarz ola olmaydi</span>. Davom etasizmi?</>}
                  {confirmation?.type === 'delete' && <><span className="font-semibold text-gray-200 dark:text-gray-200">{confirmation?.creditor}</span> ning qarzini o'chirmoqchimisiz?</>}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 mt-4">
                <AlertDialogCancel className="bg-gray-800/50 dark:bg-gray-800/50 border-gray-700 dark:border-gray-700 text-gray-300 dark:text-gray-300 hover:bg-gray-700 dark:hover:bg-gray-700 hover:text-white dark:hover:text-white" disabled={actionLoading}>Bekor qilish</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmAction} disabled={actionLoading}
                  className={`${confirmation?.type === 'paid' ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' : confirmation?.type === 'unpaid' ? 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700' : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700'} text-white`}>
                  {actionLoading && <RefreshCw className="w-4 h-4 animate-spin mr-2" />}
                  {confirmation?.type === 'paid' && "Ha, to'landi"}{confirmation?.type === 'unpaid' && "Ha, qora ro'yxatga"}{confirmation?.type === 'delete' && "Ha, o'chirish"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* SMS Modal - Har bir qarzdorga alohida SMS yuborish */}
          <AlertDialog open={smsModalOpen} onOpenChange={setSmsModalOpen}>
            <AlertDialogContent className="bg-gray-900 dark:bg-gray-900 border-gray-800/50 dark:border-gray-800/50 max-w-md max-h-[80vh] overflow-hidden">
              <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 rounded-full bg-cyan-500/20">
                    <MessageSquare className="w-6 h-6 text-cyan-400" />
                  </div>
                  <AlertDialogTitle className="text-gray-200 dark:text-gray-200 text-lg">
                    SMS yuborish
                  </AlertDialogTitle>
                </div>
                <AlertDialogDescription className="text-gray-400 dark:text-gray-400 text-sm">
                  Har bir qarzdorga alohida SMS yuborish uchun tugmani bosing
                </AlertDialogDescription>
              </AlertDialogHeader>
              {/* Android uchun - hammasiga bittada yuborish */}
              <div className="mb-3 p-3 bg-green-900/20 rounded-lg border border-green-700/30">
                <p className="text-xs text-green-400 mb-2">Android uchun - hammasiga bittada:</p>
                <Button
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white"
                  onClick={handleSendAllSmsAndroid}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Hammasiga yuborish ({filteredDebts.filter(d => d.phone).length})
                </Button>
              </div>
              
              {/* iPhone uchun - alohida yuborish */}
              <p className="text-xs text-gray-500 mb-2">iPhone uchun - alohida yuborish:</p>
              <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-2">
                {filteredDebts.filter(d => d.phone).map((debt) => (
                  <div key={debt._id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">{debt.creditor}</p>
                      <p className="text-xs text-gray-400">{debt.phone}</p>
                    </div>
                    <a
                      href={getSmsUrl(debt.phone!)}
                      className="inline-flex items-center justify-center bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white h-8 px-3 text-xs ml-2 rounded-md font-medium"
                    >
                      <MessageSquare className="w-3.5 h-3.5 mr-1" />
                      SMS
                    </a>
                  </div>
                ))}
              </div>
              <AlertDialogFooter className="mt-4">
                <AlertDialogCancel className="bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white">
                  Yopish
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
    </div>
  );
}
