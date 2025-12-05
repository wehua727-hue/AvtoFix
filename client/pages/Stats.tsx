import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
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
  TrendingUp, DollarSign, Package, 
  Users, ShoppingCart, Calendar, BarChart3, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { getLocalDailyStats, getLocalWeeklyStats, clearLocalStats } from '@/db/offlineDB';

// API base URL - работает для веб и Electron
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  if (window.location.protocol === 'file:') return 'http://127.0.0.1:5174';
  return import.meta.env.VITE_API_URL || '';
})();

interface DailyStats {
  totalSales: number;
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  topProducts: Array<{ name: string; sales: number; revenue: number }>;
}

interface WeeklyStats {
  totalSales: number;
  totalRevenue: number;
  totalOrders: number;
  dailyData: Array<{ day: string; sales: number; revenue: number; orders: number }>;
}

export default function Stats() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    totalSales: 0,
    totalRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    topProducts: [],
  });
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    totalSales: 0,
    totalRevenue: 0,
    totalOrders: 0,
    dailyData: [],
  });
  const [isClearing, setIsClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  const { user } = useAuth();
  const { theme } = useTheme();
  
  // Statistikani tozalash funksiyasi
  const handleClearStats = useCallback(async () => {
    if (!user?.id) return;
    
    setIsClearing(true);
    try {
      // 1. Local IndexedDB dan tozalash
      await clearLocalStats(user.id);
      
      // 2. Serverdan ham tozalash (agar online bo'lsa)
      // days=0 - barcha sotuvlarni o'chirish (nafaqat eskilarini)
      if (navigator.onLine) {
        try {
          const response = await fetch(`${API_BASE}/api/sales/offline/cleanup?userId=${encodeURIComponent(user.id)}&days=0`, {
            method: 'DELETE',
          });
          if (response.ok) {
            const data = await response.json();
            console.log('[Stats] Server sales cleared successfully:', data.deletedCount, 'records deleted');
          } else {
            console.warn('[Stats] Server cleanup failed:', response.status);
          }
        } catch (serverError) {
          console.warn('[Stats] Server cleanup error:', serverError);
          // Server xatosi bo'lsa ham davom etamiz - local tozalangan
        }
      }
      
      // 3. State ni tozalash
      setDailyStats({
        totalSales: 0,
        totalRevenue: 0,
        totalOrders: 0,
        totalCustomers: 0,
        topProducts: [],
      });
      setWeeklyStats({
        totalSales: 0,
        totalRevenue: 0,
        totalOrders: 0,
        dailyData: [],
      });
      
      toast.success('Statistika muvaffaqiyatli tozalandi');
      setShowClearModal(false);
    } catch (error) {
      console.error('Statistikani tozalashda xato:', error);
      toast.error('Statistikani tozalashda xatolik yuz berdi');
    } finally {
      setIsClearing(false);
    }
  }, [user?.id]);
  
  // Стили для светлой темы
  const isLight = theme === 'light';
  const cardStyle = isLight ? { backgroundColor: '#ffffff', borderColor: '#e5e7eb' } : {};
  const textPrimaryStyle = isLight ? { color: '#111827' } : {};
  const textSecondaryStyle = isLight ? { color: '#374151' } : {};
  const textMutedStyle = isLight ? { color: '#6b7280' } : {};
  const tabsListStyle = isLight ? { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' } : {};
  const tabsTriggerStyle = isLight ? { color: '#1f2937' } : {};
  const listItemStyle = isLight ? { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' } : {};
  
  // Стили для графиков
  const chartAxisColor = isLight ? 'rgba(55, 65, 81, 0.6)' : 'rgba(148, 163, 184, 0.6)';
  const chartTickColor = isLight ? 'rgba(55, 65, 81, 0.8)' : 'rgba(148, 163, 184, 0.8)';
  const chartGridColor = isLight ? 'rgba(55, 65, 81, 0.2)' : 'rgba(148, 163, 184, 0.2)';
  const chartTooltipBg = isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.95)';
  const chartTooltipBorder = isLight ? '1px solid rgba(55, 65, 81, 0.2)' : '1px solid rgba(148, 163, 184, 0.2)';
  const chartTooltipColor = isLight ? '#111827' : '#fff';

  useEffect(() => {
    if (!user) return;
    loadStats(user.id);
  }, [user]);

  const loadStats = async (userId: string) => {
    try {
      // 1. Avval IndexedDB dan local statistikani olish (tezkor)
      console.log('[Stats] Loading local stats from IndexedDB...');
      const [localDaily, localWeekly] = await Promise.all([
        getLocalDailyStats(userId),
        getLocalWeeklyStats(userId)
      ]);
      
      console.log('[Stats] Local daily stats:', localDaily);
      console.log('[Stats] Local weekly stats:', localWeekly);
      
      // Local ma'lumotlarni ko'rsatish
      setDailyStats({
        totalSales: localDaily.totalSales,
        totalRevenue: localDaily.totalRevenue,
        totalOrders: localDaily.totalOrders,
        totalCustomers: 0, // IndexedDB da mijozlar yo'q
        topProducts: localDaily.topProducts,
      });
      
      setWeeklyStats({
        totalSales: localWeekly.totalSales,
        totalRevenue: localWeekly.totalRevenue,
        totalOrders: localWeekly.totalOrders,
        dailyData: localWeekly.dailyData,
      });

      // 2. Keyin serverdan yangilangan ma'lumotlarni olish
      console.log('[Stats] Fetching server stats...');
      const res = await fetch(`${API_BASE}/api/sales/offline/stats?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        console.error('Server stats error:', data.error || res.statusText);
        console.log('[Stats] Using local stats only');
        return;
      }

      console.log('[Stats] Server data received:', data);

      // Server ma'lumotlari bilan local ma'lumotlarni birlashtirish
      // Server ma'lumotlari + local (sinxronlanmagan) ma'lumotlar
      const serverDaily = data.daily || {};
      const serverWeekly = data.weekly || {};
      
      setDailyStats({
        totalSales: Math.max(serverDaily.totalSales || 0, localDaily.totalSales),
        totalRevenue: Math.max(serverDaily.totalRevenue || 0, localDaily.totalRevenue),
        totalOrders: Math.max(serverDaily.totalOrders || 0, localDaily.totalOrders),
        totalCustomers: serverDaily.totalCustomers || 0,
        topProducts: serverDaily.topProducts?.length > 0 ? serverDaily.topProducts : localDaily.topProducts,
      });

      const serverDailyData = serverWeekly.dailyData || [];
      
      // Server va local ma'lumotlarni birlashtirish
      const mergedDailyData = localWeekly.dailyData.map((local, index) => {
        const server = serverDailyData[index] || { sales: 0, revenue: 0, orders: 0 };
        return {
          day: local.day,
          sales: Math.max(local.sales, server.sales || 0),
          revenue: Math.max(local.revenue, server.revenue || 0),
          orders: Math.max(local.orders, server.orders || 0),
        };
      });

      setWeeklyStats({
        totalSales: Math.max(serverWeekly.totalSales || 0, localWeekly.totalSales),
        totalRevenue: Math.max(serverWeekly.totalRevenue || 0, localWeekly.totalRevenue),
        totalOrders: Math.max(serverWeekly.totalOrders || 0, localWeekly.totalOrders),
        dailyData: mergedDailyData,
      });
      
      console.log('[Stats] Stats loaded successfully');
    } catch (error) {
      console.error('Statistika yuklashda xato:', error);
      // Xatolik bo'lsa ham local ma'lumotlar ko'rsatiladi
    }
  };

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
  };

  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed} />
      <div className="min-h-screen dark:bg-gray-900/80 bg-gray-50 backdrop-blur-sm border-b border-gray-800/50 dark:border-gray-800/50 transition-all duration-300">

      <main className={`pt-12 sm:pt-14 lg:pt-16 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`} style={{ position: 'relative', zIndex: 1 }}>
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center justify-between"
          >
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white" style={textPrimaryStyle}>Savdo va daromad tahlili</h1>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowClearModal(true)}
              disabled={isClearing}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Tozalash</span>
            </Button>
          </motion.div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'daily' | 'weekly')} className="space-y-8">
            <TabsList className="bg-gray-100 dark:bg-card border-gray-200 dark:border-border shadow-sm" style={tabsListStyle}>
              <TabsTrigger value="daily" className="data-[state=active]:bg-primary data-[state=active]:text-white text-gray-800 dark:text-gray-300 data-[state=inactive]:hover:text-gray-900" style={tabsTriggerStyle}>
                <Calendar className="w-4 h-4 mr-2" />
                Kunlik
              </TabsTrigger>
              <TabsTrigger value="weekly" className="data-[state=active]:bg-primary data-[state=active]:text-white text-gray-800 dark:text-gray-300 data-[state=inactive]:hover:text-gray-900" style={tabsTriggerStyle}>
                <BarChart3 className="w-4 h-4 mr-2" />
                Haftalik
              </TabsTrigger>
            </TabsList>

            {/* Kunlik Statistika */}
            <TabsContent value="daily" className="space-y-8">
              {/* Asosiy Ko'rsatkichlar */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card className="bg-white dark:bg-card border-gray-200 dark:border-border shadow-sm hover:shadow-md transition-shadow" style={cardStyle}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-700 dark:text-gray-400 mb-1.5 font-medium" style={textSecondaryStyle}>Daromad</p>
                          <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white" style={textPrimaryStyle}>
                            {formatCurrency(dailyStats.totalRevenue)}
                          </h3>
                        </div>
                        <div className="p-3 rounded-xl bg-red-50 dark:bg-primary/10">
                          <DollarSign className="w-7 h-7 text-red-600 dark:text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="bg-white dark:bg-card border-gray-200 dark:border-border shadow-sm hover:shadow-md transition-shadow" style={cardStyle}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-700 dark:text-gray-400 mb-1.5 font-medium" style={textSecondaryStyle}>Sotilgan</p>
                          <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white" style={textPrimaryStyle}>
                            {dailyStats.totalSales}
                          </h3>
                        </div>
                        <div className="p-3 rounded-xl bg-gray-100 dark:bg-muted">
                          <Package className="w-7 h-7 text-gray-600 dark:text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card className="bg-white dark:bg-card border-gray-200 dark:border-border shadow-sm hover:shadow-md transition-shadow" style={cardStyle}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-700 dark:text-gray-400 mb-1.5 font-medium" style={textSecondaryStyle}>Buyurtmalar</p>
                          <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white" style={textPrimaryStyle}>
                            {dailyStats.totalOrders}
                          </h3>
                        </div>
                        <div className="p-3 rounded-xl bg-gray-100 dark:bg-secondary">
                          <ShoppingCart className="w-7 h-7 text-gray-700 dark:text-secondary-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Card className="bg-white dark:bg-card border-gray-200 dark:border-border shadow-sm hover:shadow-md transition-shadow" style={cardStyle}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-700 dark:text-gray-400 mb-1.5 font-medium" style={textSecondaryStyle}>Mijozlar</p>
                          <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white" style={textPrimaryStyle}>
                            {dailyStats.totalCustomers}
                          </h3>
                        </div>
                        <div className="p-3 rounded-xl bg-gray-100 dark:bg-accent/10">
                          <Users className="w-7 h-7 text-gray-600 dark:text-accent" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Top Mahsulotlar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-2"
              >
                <Card className="bg-white dark:bg-card border-gray-200 dark:border-border shadow-sm" style={cardStyle}>
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2" style={textPrimaryStyle}>
                      <Package className="w-5 h-5 text-blue-500" />
                      Eng ko'p sotilgan mahsulotlar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dailyStats.topProducts.length > 0 ? (
                      <div className="space-y-4">
                        {dailyStats.topProducts.map((product, index) => (
                          <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-muted rounded-lg border border-gray-200 dark:border-border shadow-sm" style={listItemStyle}>
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold`}
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                                {index + 1}
                              </div>
                              <div>
                                <p className="text-gray-900 dark:text-white font-semibold" style={textPrimaryStyle}>{product.name}</p>
                                <p className="text-gray-600 dark:text-gray-400 text-sm" style={textMutedStyle}>{product.sales} dona sotildi</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-gray-900 dark:text-white font-bold" style={textPrimaryStyle}>{formatCurrency(product.revenue)}</p>
                              <p className="text-gray-700 dark:text-gray-400 text-sm" style={textMutedStyle}>Daromad</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Package className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400" style={textMutedStyle}>Bugun hali mahsulot sotilmagan</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Pie Chart */}
              {dailyStats.topProducts.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mt-2"
                >
                  <Card className="bg-white dark:bg-card border-gray-200 dark:border-border shadow-sm" style={cardStyle}>
                    <CardHeader>
                      <CardTitle className="text-gray-900 dark:text-white" style={textPrimaryStyle}>Mahsulotlar taqsimoti</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={dailyStats.topProducts}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="sales"
                          >
                            {dailyStats.topProducts.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--popover))', 
                              border: '1px solid hsl(var(--border))', 
                              borderRadius: '8px', 
                              color: 'hsl(var(--popover-foreground))' 
                            }}
                            labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </TabsContent>

            {/* Haftalik Statistika */}
            <TabsContent value="weekly" className="space-y-8">
              {/* Asosiy Ko'rsatkichlar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card className="bg-white dark:bg-blue-900/80 border-blue-200 dark:border-blue-700/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-blue-600 dark:text-blue-300 mb-1.5 font-medium">Haftalik Daromad</p>
                          <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                            {formatCurrency(weeklyStats.totalRevenue)}
                          </h3>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-500/20">
                          <DollarSign className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="bg-white dark:bg-pink-900/80 border-pink-200 dark:border-pink-700/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-pink-600 dark:text-pink-300 mb-1.5 font-medium">Sotilgan Mahsulotlar</p>
                          <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                            {weeklyStats.totalSales}
                          </h3>
                        </div>
                        <div className="p-3 rounded-xl bg-pink-100 dark:bg-pink-500/20">
                          <Package className="w-7 h-7 text-pink-600 dark:text-pink-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Line Chart - Daromad */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-2"
              >
                <Card className="bg-white dark:bg-card border-gray-200 dark:border-border shadow-sm" style={cardStyle}>
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2" style={textPrimaryStyle}>
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                      Kunlik daromad dinamikasi
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {weeklyStats.dailyData && weeklyStats.dailyData.length > 0 ? (
                      (() => {
                        const maxRevenue = Math.max(...weeklyStats.dailyData.map(d => d.revenue || 0));
                        const hasData = maxRevenue > 0;
                        return (
                          <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={weeklyStats.dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                              <XAxis 
                                dataKey="day" 
                                stroke={chartAxisColor}
                                tick={{ fill: chartTickColor, fontSize: 12 }}
                                axisLine={{ stroke: chartAxisColor }}
                              />
                              <YAxis 
                                stroke={chartAxisColor}
                                domain={hasData ? [0, (dataMax: number) => Math.max(dataMax * 1.1, 1)] : [0, 1000]}
                                tick={{ fill: chartTickColor, fontSize: 12 }}
                                axisLine={{ stroke: chartAxisColor }}
                                tickFormatter={(value) => value > 0 ? formatCurrency(value) : '0'}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: chartTooltipBg, 
                                  border: chartTooltipBorder, 
                                  borderRadius: '8px',
                                  color: chartTooltipColor,
                                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                                }}
                                labelStyle={{ color: chartTooltipColor, fontWeight: 600 }}
                                formatter={(value: number) => formatCurrency(value)}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="revenue" 
                                stroke="#3b82f6" 
                                strokeWidth={3}
                                fillOpacity={1} 
                                fill="url(#colorRevenue)" 
                                name="Daromad"
                                isAnimationActive={true}
                                connectNulls={false}
                                dot={{ fill: '#3b82f6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        );
                      })()
                    ) : (
                      <div className="text-center py-12">
                        <TrendingUp className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400" style={textMutedStyle}>Hafta davomida ma'lumotlar yo'q</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Bar Chart - Buyurtmalar va Sotuvlar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-2"
              >
                <Card className="bg-white dark:bg-card border-gray-200 dark:border-border shadow-sm" style={cardStyle}>
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2" style={textPrimaryStyle}>
                      <BarChart3 className="w-5 h-5 text-purple-500" />
                      Buyurtmalar va sotuvlar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {weeklyStats.dailyData && weeklyStats.dailyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={weeklyStats.dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis 
                            dataKey="day" 
                            stroke={chartAxisColor}
                            tick={{ fill: chartTickColor, fontSize: 12 }}
                            axisLine={{ stroke: chartAxisColor }}
                          />
                          <YAxis 
                            stroke={chartAxisColor}
                            domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, 1)]}
                            tick={{ fill: chartTickColor, fontSize: 12 }}
                            axisLine={{ stroke: chartAxisColor }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: chartTooltipBg, 
                              border: chartTooltipBorder, 
                              borderRadius: '8px',
                              color: chartTooltipColor,
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                            }}
                            labelStyle={{ color: chartTooltipColor, fontWeight: 600 }}
                          />
                          <Legend 
                            wrapperStyle={{ color: chartTickColor, fontSize: '14px' }}
                            iconType="rect"
                          />
                          <Bar 
                            dataKey="sales" 
                            fill="#ec4899" 
                            name="Sotilgan mahsulotlar" 
                            radius={[8, 8, 0, 0]}
                            isAnimationActive={true}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-12">
                        <BarChart3 className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400" style={textMutedStyle}>Hafta davomida ma'lumotlar yo'q</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Line Chart - Sotuvlar Trendi */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-2"
              >
                <Card className="bg-white dark:bg-card border-gray-200 dark:border-border shadow-sm" style={cardStyle}>
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2" style={textPrimaryStyle}>
                      <Package className="w-5 h-5 text-green-500" />
                      Sotuvlar trendi
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {weeklyStats.dailyData && weeklyStats.dailyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={weeklyStats.dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis 
                            dataKey="day" 
                            stroke={chartAxisColor}
                            tick={{ fill: chartTickColor, fontSize: 12 }}
                            axisLine={{ stroke: chartAxisColor }}
                          />
                          <YAxis 
                            stroke={chartAxisColor}
                            domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, 1)]}
                            tick={{ fill: chartTickColor, fontSize: 12 }}
                            axisLine={{ stroke: chartAxisColor }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: chartTooltipBg, 
                              border: chartTooltipBorder, 
                              borderRadius: '8px',
                              color: chartTooltipColor,
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                            }}
                            labelStyle={{ color: chartTooltipColor, fontWeight: 600 }}
                          />
                          <Legend 
                            wrapperStyle={{ color: chartTickColor, fontSize: '14px' }}
                            iconType="line"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="sales" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            name="Sotilgan mahsulotlar"
                            dot={{ fill: '#10b981', r: 6, strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff', fill: '#10b981' }}
                            isAnimationActive={true}
                            connectNulls={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-12">
                        <Package className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400" style={textMutedStyle}>Hafta davomida ma'lumotlar yo'q</p>
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

      {/* Tozalash tasdiqlash modali */}
      <AlertDialog open={showClearModal} onOpenChange={setShowClearModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Statistikani tozalash</AlertDialogTitle>
            <AlertDialogDescription>
              Barcha statistika ma'lumotlarini o'chirishni tasdiqlaysizmi? Bu amal qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearStats}
              disabled={isClearing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isClearing ? 'Tozalanmoqda...' : 'Ha, tozalash'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
