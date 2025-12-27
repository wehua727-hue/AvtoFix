import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
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
import { 
  TrendingUp, DollarSign, Package, RefreshCw, Sparkles,
  Users, ShoppingCart, Calendar, BarChart3, AlertTriangle, Trash2
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { getLocalDailyStats, getLocalWeeklyStats, getDefectiveProducts, DefectiveProduct, clearDefectiveProducts } from '@/db/offlineDB';
import { toast } from 'sonner';

const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  if (window.location.protocol === 'file:') return 'http://127.0.0.1:5174';
  return import.meta.env.VITE_API_URL || '';
})();

interface DailyStats {
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  totalOrders: number;
  totalCustomers: number;
  topProducts: Array<{ name: string; sales: number; revenue: number; profit: number }>;
}

interface WeeklyStats {
  totalSales: number;
  totalRevenue: number;
  totalOrders: number;
  dailyData: Array<{ day: string; sales: number; revenue: number; orders: number }>;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 }
};

export default function Stats() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'defective'>('daily');
  const [defectiveProducts, setDefectiveProducts] = useState<DefectiveProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    totalSales: 0, totalRevenue: 0, totalProfit: 0, totalOrders: 0, totalCustomers: 0, topProducts: [],
  });
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    totalSales: 0, totalRevenue: 0, totalOrders: 0, dailyData: [],
  });
  const { user } = useAuth();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  useEffect(() => {
    if (!user) return;
    loadStats(user.id);
    loadDefectiveProducts(user.id);
  }, [user]);

  const loadDefectiveProducts = async (userId: string) => {
    try {
      const defective = await getDefectiveProducts(userId);
      setDefectiveProducts(defective);
    } catch (error) {
      console.error('Yaroqsiz mahsulotlarni yuklashda xato:', error);
    }
  };

  // Yaroqsiz mahsulotlarni tozalash (egasi va admin uchun)
  const handleClearDefectiveProducts = async () => {
    if (!user || (user.role !== 'egasi' && user.role !== 'admin')) return;
    
    try {
      // IndexedDB dan o'chirish
      await clearDefectiveProducts(user.id);
      
      // MongoDB dan o'chirish (server API)
      const res = await fetch(`${API_BASE}/api/defective/clear`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      if (!res.ok) {
        console.warn('Server dan o\'chirishda xato, lekin lokal o\'chirildi');
      }
      
      // State ni yangilash
      setDefectiveProducts([]);
      setClearDialogOpen(false);
      toast.success('Yaroqsiz mahsulotlar tozalandi');
    } catch (error) {
      console.error('Yaroqsiz mahsulotlarni tozalashda xato:', error);
      toast.error('Xatolik yuz berdi');
    }
  };

  const loadStats = async (userId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/sales/offline/stats?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();

      if (res.ok && data.success) {
        const serverDaily = data.daily || {};
        const serverWeekly = data.weekly || {};
        
        setDailyStats({
          totalSales: serverDaily.totalSales || 0,
          totalRevenue: serverDaily.totalRevenue || 0,
          totalProfit: serverDaily.totalProfit || 0,
          totalOrders: serverDaily.totalOrders || 0,
          totalCustomers: serverDaily.totalCustomers || 0,
          topProducts: (serverDaily.topProducts || []).map((p: any) => ({ ...p, profit: p.profit || 0 })),
        });

        setWeeklyStats({
          totalSales: serverWeekly.totalSales || 0,
          totalRevenue: serverWeekly.totalRevenue || 0,
          totalOrders: serverWeekly.totalOrders || 0,
          dailyData: serverWeekly.dailyData || [],
        });

        const [localDaily, localWeekly] = await Promise.all([
          getLocalDailyStats(userId), getLocalWeeklyStats(userId)
        ]);
        
        if (localDaily.totalSales > 0 || localWeekly.totalSales > 0) {
          setDailyStats(prev => ({
            ...prev,
            totalSales: prev.totalSales + localDaily.totalSales,
            totalRevenue: prev.totalRevenue + localDaily.totalRevenue,
            totalProfit: prev.totalProfit + (localDaily.totalProfit || 0),
            totalOrders: prev.totalOrders + localDaily.totalOrders,
          }));
          
          setWeeklyStats(prev => ({
            ...prev,
            totalSales: prev.totalSales + localWeekly.totalSales,
            totalRevenue: prev.totalRevenue + localWeekly.totalRevenue,
            totalOrders: prev.totalOrders + localWeekly.totalOrders,
            dailyData: prev.dailyData.map((serverDay, index) => {
              const localDay = localWeekly.dailyData[index] || { sales: 0, revenue: 0, orders: 0 };
              return { ...serverDay, sales: serverDay.sales + localDay.sales, revenue: serverDay.revenue + localDay.revenue, orders: serverDay.orders + localDay.orders };
            }),
          }));
        }
      } else {
        const [localDaily, localWeekly] = await Promise.all([getLocalDailyStats(userId), getLocalWeeklyStats(userId)]);
        setDailyStats({ ...localDaily, totalCustomers: 0 });
        setWeeklyStats(localWeekly);
      }
    } catch (error) {
      console.error('Statistika yuklashda xato:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => '$ ' + new Intl.NumberFormat('en-US').format(amount);

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <motion.div variants={itemVariants} whileHover={{ y: -4, scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
      <Card className={`relative overflow-hidden bg-gradient-to-br ${color} border-0 shadow-lg hover:shadow-xl transition-all duration-300 h-full`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
        <CardContent className="p-4 sm:p-5 md:p-6 relative z-10 h-full">
          <div className="flex items-center justify-between h-full">
            <div className="space-y-1 sm:space-y-2">
              <p className="text-xs sm:text-sm font-medium text-white/80">{title}</p>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight">{value}</h3>
            </div>
            <div className="p-2 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Icon className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full mx-auto" />
          <p className="text-slate-400 animate-pulse">Statistika yuklanmoqda...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onCollapsedChange={setSidebarCollapsed} />
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed} />
      
      <div className={`min-h-screen transition-colors duration-300 ${isLight ? 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100' : 'bg-gradient-to-br from-slate-900 via-slate-800/50 to-slate-900'}`}>
        <main className={`pt-14 sm:pt-16 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`}>
          <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
            
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className={`w-5 h-5 sm:w-6 sm:h-6 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                  <h1 className={`text-xl sm:text-2xl lg:text-3xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Statistika</h1>
                </div>
                <p className={`text-xs sm:text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Savdo va daromad tahlili</p>
              </div>
              <Button onClick={() => user && loadStats(user.id)} variant="outline" size="sm" className={`w-full sm:w-auto ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700/50'}`}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Yangilash
              </Button>
            </motion.div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4 sm:space-y-6">
              <div className="flex justify-center">
                <TabsList className={`inline-flex gap-1 p-1.5 ${isLight ? 'bg-slate-100 border border-slate-200' : 'bg-slate-800/60 border border-slate-700/50'} rounded-2xl shadow-lg`}>
                  <TabsTrigger value="daily" className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-medium transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg ${isLight ? 'text-slate-600 hover:text-slate-800' : 'text-slate-400 hover:text-white'}`}>
                    <Calendar className="w-4 h-4" />
                    Kunlik
                  </TabsTrigger>
                  <TabsTrigger value="weekly" className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-medium transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg ${isLight ? 'text-slate-600 hover:text-slate-800' : 'text-slate-400 hover:text-white'}`}>
                    <BarChart3 className="w-4 h-4" />
                    Haftalik
                  </TabsTrigger>
                  <TabsTrigger value="defective" className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-medium transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg ${isLight ? 'text-slate-600 hover:text-slate-800' : 'text-slate-400 hover:text-white'}`}>
                    <AlertTriangle className="w-4 h-4" />
                    Yaroqsiz
                    <Badge variant="destructive" className="ml-1 px-1.5 py-0.5 text-xs">{defectiveProducts.length}</Badge>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Kunlik Tab */}
              <TabsContent value="daily" className="space-y-4 sm:space-y-6">
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                  <StatCard title="Daromad" value={formatCurrency(dailyStats.totalRevenue)} icon={DollarSign} color="from-emerald-500 to-teal-600" />
                  <StatCard title="Sotilgan" value={dailyStats.totalSales} icon={Package} color="from-blue-500 to-indigo-600" />
                  <StatCard title="Buyurtmalar" value={dailyStats.totalOrders} icon={ShoppingCart} color="from-purple-500 to-pink-600" />
                  <StatCard title="Mijozlar" value={dailyStats.totalCustomers} icon={Users} color="from-orange-500 to-red-600" />
                </motion.div>

                {/* Top Mahsulotlar */}
                <motion.div variants={itemVariants} initial="hidden" animate="visible">
                  <Card className={`${isLight ? 'bg-white border-slate-200' : 'bg-slate-800/50 border-slate-700/50'} shadow-lg backdrop-blur-sm`}>
                    <CardHeader className="pb-2 sm:pb-4">
                      <CardTitle className={`flex items-center gap-2 text-base sm:text-lg ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        <div className="p-1.5 sm:p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                          <Package className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        Sotilgan mahsulotlar
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6">
                      {dailyStats.topProducts.length > 0 ? (
                        <div className="space-y-2 sm:space-y-3">
                          {dailyStats.topProducts.map((product, index) => (
                            <motion.div key={index} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} whileHover={{ scale: 1.01 }}
                              className={`flex items-center justify-between p-3 sm:p-4 rounded-xl ${isLight ? 'bg-slate-50 hover:bg-slate-100 border border-slate-200' : 'bg-slate-900/50 hover:bg-slate-900/70 border border-slate-700/50'} transition-all`}>
                              <div className="flex items-center gap-2 sm:gap-4">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base" style={{ background: `linear-gradient(135deg, ${COLORS[index % COLORS.length]}, ${COLORS[(index + 1) % COLORS.length]})` }}>
                                  {index + 1}
                                </div>
                                <div>
                                  <p className={`font-semibold text-sm sm:text-base ${isLight ? 'text-slate-800' : 'text-white'}`}>{product.name}</p>
                                  <p className={`text-xs sm:text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{product.sales} dona</p>
                                </div>
                              </div>
                              <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 text-xs sm:text-sm">{formatCurrency(product.revenue)}</Badge>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 sm:py-12">
                          <Package className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
                          <p className={`text-sm sm:text-base ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Bugun hali mahsulot sotilmagan</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Pie Chart */}
                {dailyStats.topProducts.length > 0 && (
                  <motion.div variants={itemVariants} initial="hidden" animate="visible">
                    <Card className={`${isLight ? 'bg-white border-slate-200' : 'bg-slate-800/50 border-slate-700/50'} shadow-lg`}>
                      <CardHeader>
                        <CardTitle className={`text-base sm:text-lg ${isLight ? 'text-slate-800' : 'text-white'}`}>Mahsulotlar taqsimoti</CardTitle>
                      </CardHeader>
                      <CardContent className="p-2 sm:p-6">
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie data={dailyStats.topProducts} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="sales">
                              {dailyStats.topProducts.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: isLight ? '#fff' : 'rgba(15, 23, 42, 0.95)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: isLight ? '#1e293b' : '#fff' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </TabsContent>

              {/* Haftalik Tab */}
              <TabsContent value="weekly" className="space-y-4 sm:space-y-6">
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                  <StatCard title="Haftalik Daromad" value={formatCurrency(weeklyStats.totalRevenue)} icon={DollarSign} color="from-blue-500 to-cyan-600" />
                  <StatCard title="Sotilgan" value={weeklyStats.totalSales} icon={Package} color="from-pink-500 to-rose-600" />
                  <StatCard title="Buyurtmalar" value={weeklyStats.totalOrders} icon={ShoppingCart} color="from-amber-500 to-orange-600" />
                </motion.div>

                {/* Area Chart */}
                <motion.div variants={itemVariants} initial="hidden" animate="visible">
                  <Card className={`${isLight ? 'bg-white border-slate-200' : 'bg-slate-800/50 border-slate-700/50'} shadow-lg`}>
                    <CardHeader>
                      <CardTitle className={`flex items-center gap-2 text-base sm:text-lg ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                        Kunlik daromad dinamikasi
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-6">
                      {weeklyStats.dailyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <AreaChart data={weeklyStats.dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'} />
                            <XAxis dataKey="day" stroke={isLight ? '#64748b' : '#94a3b8'} tick={{ fontSize: 11 }} />
                            <YAxis stroke={isLight ? '#64748b' : '#94a3b8'} tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                            <Tooltip contentStyle={{ backgroundColor: isLight ? '#fff' : 'rgba(15, 23, 42, 0.95)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: isLight ? '#1e293b' : '#fff' }} formatter={(value: number) => formatCurrency(value)} />
                            <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name="Daromad" dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center py-12">
                          <TrendingUp className={`w-16 h-16 mx-auto mb-4 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
                          <p className={isLight ? 'text-slate-500' : 'text-slate-400'}>Ma'lumotlar yo'q</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Bar Chart */}
                <motion.div variants={itemVariants} initial="hidden" animate="visible">
                  <Card className={`${isLight ? 'bg-white border-slate-200' : 'bg-slate-800/50 border-slate-700/50'} shadow-lg`}>
                    <CardHeader>
                      <CardTitle className={`flex items-center gap-2 text-base sm:text-lg ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        <BarChart3 className="w-5 h-5 text-purple-500" />
                        Sotuvlar
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-6">
                      {weeklyStats.dailyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={weeklyStats.dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'} />
                            <XAxis dataKey="day" stroke={isLight ? '#64748b' : '#94a3b8'} tick={{ fontSize: 11 }} />
                            <YAxis stroke={isLight ? '#64748b' : '#94a3b8'} tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ backgroundColor: isLight ? '#fff' : 'rgba(15, 23, 42, 0.95)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: isLight ? '#1e293b' : '#fff' }} />
                            <Legend />
                            <Bar dataKey="sales" fill="#ec4899" name="Sotilgan" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center py-12">
                          <BarChart3 className={`w-16 h-16 mx-auto mb-4 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
                          <p className={isLight ? 'text-slate-500' : 'text-slate-400'}>Ma'lumotlar yo'q</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Line Chart */}
                <motion.div variants={itemVariants} initial="hidden" animate="visible">
                  <Card className={`${isLight ? 'bg-white border-slate-200' : 'bg-slate-800/50 border-slate-700/50'} shadow-lg`}>
                    <CardHeader>
                      <CardTitle className={`flex items-center gap-2 text-base sm:text-lg ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        <Package className="w-5 h-5 text-green-500" />
                        Sotuvlar trendi
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-6">
                      {weeklyStats.dailyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={weeklyStats.dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'} />
                            <XAxis dataKey="day" stroke={isLight ? '#64748b' : '#94a3b8'} tick={{ fontSize: 11 }} />
                            <YAxis stroke={isLight ? '#64748b' : '#94a3b8'} tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ backgroundColor: isLight ? '#fff' : 'rgba(15, 23, 42, 0.95)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: isLight ? '#1e293b' : '#fff' }} />
                            <Legend />
                            <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={3} name="Sotilgan" dot={{ fill: '#10b981', r: 5 }} activeDot={{ r: 7 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center py-12">
                          <Package className={`w-16 h-16 mx-auto mb-4 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
                          <p className={isLight ? 'text-slate-500' : 'text-slate-400'}>Ma'lumotlar yo'q</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Yaroqsiz Tab */}
              <TabsContent value="defective" className="space-y-4 sm:space-y-6">
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                  <StatCard title="Yaroqsiz mahsulotlar" value={defectiveProducts.length} icon={AlertTriangle} color="from-red-500 to-rose-600" />
                  <StatCard title="Jami miqdor" value={defectiveProducts.reduce((sum, p) => sum + p.quantity, 0)} icon={Package} color="from-amber-500 to-orange-600" />
                  <StatCard title="Jami zarar" value={formatCurrency(defectiveProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0))} icon={DollarSign} color="from-purple-500 to-violet-600" />
                </motion.div>

                <motion.div variants={itemVariants} initial="hidden" animate="visible">
                  <Card className={`${isLight ? 'bg-white border-slate-200' : 'bg-slate-800/50 border-slate-700/50'} shadow-lg`}>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className={`flex items-center gap-2 text-base sm:text-lg ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        Yaroqsiz mahsulotlar ro'yxati
                      </CardTitle>
                      {(user?.role === 'egasi' || user?.role === 'admin') && defectiveProducts.length > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setClearDialogOpen(true)}
                          className="flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Tozalash
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6">
                      {defectiveProducts.length > 0 ? (
                        <div className="space-y-2 sm:space-y-3 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
                          {defectiveProducts.map((product, index) => (
                            <motion.div key={product.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-xl ${isLight ? 'bg-red-50 border border-red-200' : 'bg-red-900/20 border border-red-700/40'} gap-2 sm:gap-4`}>
                              <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold text-sm">
                                  {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`font-semibold text-sm sm:text-base truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{product.productName}</p>
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                                    {product.sku && <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>SKU: {product.sku}</span>}
                                    <Badge variant="destructive" className="text-xs">Miqdor: {product.quantity}</Badge>
                                    <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{new Date(product.createdAt).toLocaleDateString('uz-UZ')}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right pl-11 sm:pl-0">
                                <p className={`font-semibold text-sm sm:text-base ${isLight ? 'text-red-600' : 'text-red-400'}`}>{formatCurrency(product.price * product.quantity)}</p>
                                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{formatCurrency(product.price)} x {product.quantity}</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 sm:py-12">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Package className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                          </div>
                          <p className="text-green-500 font-semibold text-sm sm:text-base">Yaroqsiz mahsulotlar yo'q</p>
                          <p className={`text-xs sm:text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Barcha mahsulotlar yaxshi holatda</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Yaroqsiz mahsulotlarni tozalash dialogi */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent className={`${isLight ? 'bg-white' : 'bg-slate-900 border-slate-700'}`}>
          <AlertDialogHeader>
            <AlertDialogTitle className={`flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
              <Trash2 className="w-5 h-5 text-red-500" />
              Yaroqsiz mahsulotlarni tozalash
            </AlertDialogTitle>
            <AlertDialogDescription className={isLight ? 'text-slate-600' : 'text-slate-400'}>
              Barcha yaroqsiz mahsulotlar o'chiriladi. Bu amalni qaytarib bo'lmaydi. Davom etasizmi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={isLight ? '' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}>
              Bekor qilish
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearDefectiveProducts}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Ha, tozalash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
