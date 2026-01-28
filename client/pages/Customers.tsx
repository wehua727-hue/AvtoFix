import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';
import CustomerFormDialog from '../components/Customers/CustomerFormDialog';
import VIPCustomersAlert from '../components/Customers/VIPCustomersAlert';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { 
  Users as UsersIcon, Plus, Pencil, Trash2, Loader2, 
  Cake, Phone, Calendar, TrendingUp, Award
} from 'lucide-react';
import type { ICustomer } from '@shared/customer-types';

// API base URL - работает для веб и Electron
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  if (window.location.protocol === 'file:') return 'http://127.0.0.1:5174';
  return import.meta.env.VITE_API_URL || '';
})();

export default function Customers() {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [customers, setCustomers] = useState<ICustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<ICustomer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; customer: ICustomer | null }>({
    open: false,
    customer: null,
  });

  const fetchCustomers = async () => {
    try {
      // localStorage dan userId ni olish
      const userStr = localStorage.getItem('user');
      const userId = userStr ? JSON.parse(userStr).id : null;
      
      console.log('[Customers] fetchCustomers - userId:', userId, 'API_BASE:', API_BASE);
      
      const res = await fetch(`${API_BASE}/api/customers?userId=${userId}`, {
        headers: {
          'x-user-id': userId || '',
        },
      });
      
      console.log('[Customers] Response status:', res.status);
      const data = await res.json();
      console.log('[Customers] Response data:', data);
      
      if (data.success) setCustomers(data.customers);
    } catch (error) {
      console.error('[Customers] Error:', error);
      toast({ title: 'Xatolik', description: 'Yuklashda xatolik', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleDeleteClick = (customer: ICustomer) => {
    setDeleteConfirm({ open: true, customer });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.customer) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/customers/${deleteConfirm.customer._id}`, { 
        method: 'DELETE' 
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Muvaffaqiyat', description: 'Mijoz o\'chirildi' });
        fetchCustomers();
      }
    } catch {
      toast({ title: 'Xatolik', variant: 'destructive' });
    } finally {
      setDeleteConfirm({ open: false, customer: null });
    }
  };

  const openEditDialog = (customer: ICustomer) => {
    setEditingCustomer(customer);
  };

  const handleEditCustomerById = async (customerId: string) => {
    // Mijozni topish va tahrirlash dialogini ochish
    const customer = customers.find(c => c._id === customerId);
    if (customer) {
      setEditingCustomer(customer);
    } else {
      // Agar ro'yxatda yo'q bo'lsa, serverdan olish
      try {
        const res = await fetch(`${API_BASE}/api/customers`);
        const data = await res.json();
        if (data.success) {
          const foundCustomer = data.customers.find((c: ICustomer) => c._id === customerId);
          if (foundCustomer) {
            setEditingCustomer(foundCustomer);
          }
        }
      } catch (error) {
        console.error('Failed to fetch customer:', error);
      }
    }
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const formatBirthDate = (birthDate: string) => {
    const date = new Date(birthDate);
    return date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-pink-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onCollapsedChange={setSidebarCollapsed} />
      <Navbar 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)} 
        sidebarCollapsed={sidebarCollapsed}
        rightSlot={
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button onClick={() => setIsAddOpen(true)} className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-sm px-4 py-2 h-auto shadow-lg shadow-pink-900/30 border-0">
              <Plus className="h-4 w-4 mr-1.5" />Qo'shish
            </Button>
          </motion.div>
        }
      />
      
      <main className={`pt-14 sm:pt-16 lg:pt-18 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`}>
        <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto relative z-10">
          {/* VIP Customers Alert */}
          <VIPCustomersAlert onEditCustomer={handleEditCustomerById} />

          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-6"
          >
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 border border-pink-500/20">
              <UsersIcon className="w-6 h-6 text-pink-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Mijozlar</h1>
              <p className="text-xs sm:text-sm text-gray-400">{customers.length} ta mijoz</p>
            </div>
          </motion.div>

          {/* Customers List */}
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative">
                <div className="w-14 h-14 border-4 border-pink-500/20 rounded-full" />
                <div className="absolute inset-0 w-14 h-14 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-gray-400 mt-4 animate-pulse">Yuklanmoqda...</p>
            </motion.div>
          ) : customers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="bg-gray-800/30 backdrop-blur-sm border-gray-700/50">
                <CardContent className="py-16 sm:py-20 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  >
                    <UsersIcon className="w-14 sm:w-16 h-14 sm:h-16 text-gray-500 mx-auto mb-4" />
                  </motion.div>
                  <p className="text-gray-400 text-sm sm:text-base">Mijozlar yo'q</p>
                  <p className="text-gray-500 text-xs sm:text-sm mt-2">Yangi mijoz qo'shish uchun yuqoridagi tugmani bosing</p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="bg-gray-800/30 backdrop-blur-sm border-gray-700/50 overflow-hidden">
                {/* Mobile: Card view, Desktop: Table view */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-gray-800/50">
                        <th className="text-left p-3 text-xs text-gray-400 uppercase font-medium">Ism Familiya</th>
                        <th className="text-left p-3 text-xs text-gray-400 uppercase font-medium">Telefon</th>
                        <th className="text-left p-3 text-xs text-gray-400 uppercase font-medium">Tug'ilgan Kun</th>
                        <th className="text-left p-3 text-xs text-gray-400 uppercase font-medium">Buyurtmalar</th>
                        <th className="text-center p-3 text-xs text-gray-400 uppercase font-medium">Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <AnimatePresence mode="popLayout">
                        {customers.map((customer, i) => (
                          <motion.tr
                            key={customer._id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="hover:bg-white/5 group"
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center border border-pink-500/30">
                                  <span className="text-pink-400 font-semibold">
                                    {customer.firstName[0]}{customer.lastName[0]}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-white font-medium">
                                    {customer.firstName} {customer.lastName}
                                  </div>
                                  {customer.totalOrders && customer.totalOrders > 10 && (
                                    <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                      <Award className="w-3 h-3 mr-1" />
                                      VIP
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-gray-400">
                              {customer.phone ? (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4" />
                                  {customer.phone}
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="p-3">
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-pink-500/10 border border-pink-500/20">
                                <Cake className="w-4 h-4 text-pink-400" />
                                <span className="text-pink-300 font-medium">
                                  {formatBirthDate(customer.birthDate)}
                                </span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2 text-gray-400">
                                <TrendingUp className="w-4 h-4" />
                                <span className="font-medium">{customer.totalOrders || 0}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex justify-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => openEditDialog(customer)} 
                                  className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
                                  title="Tahrirlash"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDeleteClick(customer)} 
                                  className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                                  title="O'chirish"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Add/Edit Dialog */}
          <CustomerFormDialog
            open={isAddOpen || !!editingCustomer}
            onOpenChange={(open) => {
              if (!open) {
                setIsAddOpen(false);
                setEditingCustomer(null);
              }
            }}
            customer={editingCustomer}
            onSuccess={() => {
              setIsAddOpen(false);
              setEditingCustomer(null);
              fetchCustomers();
            }}
          />

          {/* Delete Confirmation Dialog */}
          <ConfirmDialog
            open={deleteConfirm.open}
            onOpenChange={(open) => setDeleteConfirm({ open, customer: null })}
            title="Mijozni o'chirish"
            description={
              deleteConfirm.customer
                ? `${deleteConfirm.customer.firstName} ${deleteConfirm.customer.lastName} ni o'chirmoqchimisiz? Bu amalni bekor qilib bo'lmaydi.`
                : ''
            }
            confirmText="O'chirish"
            cancelText="Bekor qilish"
            onConfirm={handleDeleteConfirm}
            variant="destructive"
          />
        </div>
      </main>
    </div>
  );
}
