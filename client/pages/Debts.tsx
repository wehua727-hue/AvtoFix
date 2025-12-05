import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, RefreshCw, CheckCircle, XCircle, Edit, Trash2, Wallet, Phone, Calendar, FileText, Ban, AlertTriangle } from 'lucide-react';
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

type FilterType = 'all' | 'pending' | 'overdue' | 'paid' | 'today' | 'unpaid';
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
  const { toast } = useToast();

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
    
    const totalAmount = [...pending, ...overdue].reduce((sum, d) => sum + d.amount, 0);
    // Qora ro'yxat soni - blacklist API dan yoki unpaid qarzlardan
    const blacklistCount = blacklist.length > 0 ? blacklist.length : unpaid.length;
    return { total: debts.length, pending: pending.length, paid: paid.length, overdue: overdue.length, unpaid: unpaid.length, blacklistCount, dueToday: dueToday.length, totalAmount };
  };

  const stats = calculateStats();
  
  const filteredDebts = debts.filter((debt) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'pending') return debt.status === 'pending';
    if (activeFilter === 'overdue') return debt.status === 'overdue';
    if (activeFilter === 'paid') return debt.status === 'paid';
    if (activeFilter === 'unpaid') return debt.status === 'unpaid';
    if (activeFilter === 'today') {
      if (debt.status === 'paid' || debt.status === 'unpaid' || !debt.dueDate) return false;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const dueDate = new Date(debt.dueDate); dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === today.getTime();
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-900/80 dark:bg-gray-900/80">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onCollapsedChange={setSidebarCollapsed} />
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed}
        rightSlot={<Button onClick={() => setIsAddDialogOpen(true)} className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5 h-auto"><Plus className="w-4 h-4 mr-1" />Qo'shish</Button>}
      />

      <main className={`pt-12 sm:pt-14 lg:pt-16 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`}>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <div className="mb-6">
            <p className="text-sm text-gray-400 dark:text-gray-400">{stats.pending} ta kutilmoqda • {stats.overdue} ta muddati o'tgan • {stats.paid} ta to'langan</p>
          </div>

          {/* Stats Cards */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
            {[
              { key: 'all', label: 'Jami', count: stats.total, bgColor: 'bg-blue-600', textColor: 'text-white', icon: Wallet, iconColor: 'text-white' },
              { key: 'pending', label: 'Kutilmoqda', count: stats.pending, bgColor: 'bg-orange-500', textColor: 'text-white', icon: RefreshCw, iconColor: 'text-white' },
              { key: 'today', label: 'Bugun', count: stats.dueToday, bgColor: 'bg-yellow-500', textColor: 'text-white', icon: Calendar, iconColor: 'text-white' },
              { key: 'overdue', label: "Muddati o'tgan", count: stats.overdue, bgColor: 'bg-red-600', textColor: 'text-white', icon: AlertTriangle, iconColor: 'text-white' },
              { key: 'paid', label: "To'langan", count: stats.paid, bgColor: 'bg-green-600', textColor: 'text-white', icon: CheckCircle, iconColor: 'text-white' },
              { key: 'unpaid', label: "", count: stats.blacklistCount, bgColor: 'bg-gray-700', textColor: 'text-white', icon: Ban, iconColor: 'text-white' },
            ].map(({ key, label, count, bgColor, textColor, icon: Icon, iconColor }) => (
              <Card key={key} onClick={() => setActiveFilter(key as FilterType)}
                className={`cursor-pointer transition-all duration-200 border-2 ${
                  activeFilter === key 
                    ? `${bgColor} ${textColor} border-white dark:border-white shadow-lg` 
                    : `${bgColor} ${textColor} border-transparent hover:border-gray-500/50`
                }`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-xs ${textColor} mb-1 font-medium opacity-90`}>{label}</p>
                      <p className={`text-xl font-bold ${textColor}`}>{count}</p>
                    </div>
                    <div className={`p-2 rounded-lg bg-white/10 dark:bg-white/10`}>
                      <Icon className={`w-4 h-4 ${iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card className="bg-purple-600 border-2 border-transparent text-white">
              <CardContent className="p-3">
                <p className="text-xs text-white/90 mb-1 font-medium">Jami Summa</p>
                <p className="text-lg font-bold text-white">{stats.totalAmount.toLocaleString()}</p>
                <p className="text-xs text-white/70">UZS</p>
              </CardContent>
            </Card>
          </motion.div>

          {activeFilter !== 'all' && (
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="outline" className="bg-gray-800/50 dark:bg-gray-800/50 border-gray-700 dark:border-gray-700 text-gray-300 dark:text-gray-300 px-3 py-1">
                {activeFilter === 'pending' && 'Kutilmoqda'}{activeFilter === 'overdue' && "Muddati o'tgan"}{activeFilter === 'today' && 'Bugun'}{activeFilter === 'paid' && "To'langan"}{activeFilter === 'unpaid' && ""}: {filteredDebts.length} ta
              </Badge>
              <Button size="sm" variant="ghost" className="text-gray-400 dark:text-gray-400 hover:text-gray-300 dark:hover:text-gray-300 h-7 px-2" onClick={() => setActiveFilter('all')}><XCircle className="w-4 h-4" /></Button>
            </div>
          )}

          {/* Debts List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="w-12 h-12 animate-spin text-blue-400 mb-4" />
              <p className="text-gray-400">Yuklanmoqda...</p>
            </div>
          ) : filteredDebts.length === 0 ? (
            <Card className="bg-gray-900/50 dark:bg-gray-900/50 border border-gray-800/50 dark:border-gray-800/50">
              <CardContent className="py-20 text-center">
                <Wallet className="w-20 h-20 mx-auto opacity-30 text-gray-500 dark:text-gray-500 mb-4" />
                <h3 className="text-xl font-semibold text-gray-400 dark:text-gray-400 mb-2">{activeFilter === 'all' ? "Qarzlar yo'q" : "Bu kategoriyada qarz yo'q"}</h3>
              </CardContent>
            </Card>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
        </div>
      </main>
    </div>
  );
}
