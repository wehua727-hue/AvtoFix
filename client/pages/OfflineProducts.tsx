/**
 * Offline Products Page
 * Demonstrates offline-first functionality with product management
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';
import { OfflineProductForm } from '@/components/OfflineProductForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Package, RefreshCw, Trash2, CheckCircle, 
  Clock, AlertCircle 
} from 'lucide-react';
import { 
  getAllOfflineProducts, 
  getRecentSyncLogs, 
  deleteSyncedProducts 
} from '@/lib/db';
import { autoSync } from '@/lib/sync';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { toast } from 'sonner';

export default function OfflineProducts() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [prods, logs] = await Promise.all([
        getAllOfflineProducts(),
        getRecentSyncLogs(5),
      ]);
      setProducts(prods);
      setSyncLogs(logs);
    } catch (error) {
      console.error('[OfflineProducts] Error loading data:', error);
      toast.error('Ma\'lumotlarni yuklashda xato');
    }
  };

  const handleSync = async () => {
    if (!isOnline) {
      toast.error('Internet aloqasi yo\'q');
      return;
    }

    setIsSyncing(true);
    toast.info('Sinxronizatsiya boshlanmoqda...');

    try {
      const result = await autoSync();
      
      if (result.success && result.syncedCount > 0) {
        toast.success(`${result.syncedCount} ta mahsulot sinxronlandi`);
        await loadData();
      } else if (result.failedCount > 0) {
        toast.error(`Sinxronizatsiya xatosi: ${result.errors.join(', ')}`);
      } else {
        toast.info('Sinxronlash uchun ma\'lumot yo\'q');
      }
    } catch (error) {
      console.error('[OfflineProducts] Sync error:', error);
      toast.error('Sinxronizatsiya xatosi');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearSynced = async () => {
    try {
      await deleteSyncedProducts();
      await loadData();
      toast.success('Sinxronlangan mahsulotlar o\'chirildi');
    } catch (error) {
      console.error('[OfflineProducts] Clear error:', error);
      toast.error('O\'chirishda xato');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('uz-UZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const unsyncedProducts = products.filter(p => !p.synced);
  const syncedProducts = products.filter(p => p.synced);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed} />

      <main className={`pt-16 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`}>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-500" />
              Offline Mahsulotlar
            </h1>
            <p className="text-gray-400">
              Offline rejimda mahsulot qo'shing va internet qaytganda avtomatik sinxronlang
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Product Form */}
            <div>
              <OfflineProductForm />
            </div>

            {/* Stats and Sync */}
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-gray-900 border-orange-600">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-orange-300 mb-1.5 font-medium">
                          Sinxronlanmagan
                        </p>
                        <h3 className="text-3xl font-bold text-white">
                          {unsyncedProducts.length}
                        </h3>
                      </div>
                      <div className="p-3 rounded-xl bg-orange-500/20">
                        <Clock className="w-7 h-7 text-orange-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-900 border-green-600">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-green-300 mb-1.5 font-medium">
                          Sinxronlangan
                        </p>
                        <h3 className="text-3xl font-bold text-white">
                          {syncedProducts.length}
                        </h3>
                      </div>
                      <div className="p-3 rounded-xl bg-green-500/20">
                        <CheckCircle className="w-7 h-7 text-green-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sync Actions */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-blue-500" />
                    Sinxronizatsiya
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSync}
                      disabled={isSyncing || !isOnline || unsyncedProducts.length === 0}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Sinxronlanmoqda...' : 'Sinxronlash'}
                    </Button>
                    <Button
                      onClick={handleClearSynced}
                      disabled={syncedProducts.length === 0}
                      variant="outline"
                      className="border-gray-700 text-gray-300 hover:bg-gray-800"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Tozalash
                    </Button>
                  </div>

                  {!isOnline && (
                    <div className="flex items-center gap-2 text-orange-400 text-sm bg-orange-900/20 p-3 rounded-lg">
                      <AlertCircle className="w-4 h-4" />
                      <span>Internet aloqasi yo'q. Sinxronizatsiya imkonsiz.</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sync Logs */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm">
                    Oxirgi sinxronizatsiyalar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {syncLogs.length > 0 ? (
                    <div className="space-y-2">
                      {syncLogs.map((log, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg text-sm"
                        >
                          <div className="flex items-center gap-2">
                            {log.status === 'success' ? (
                              <CheckCircle className="w-4 h-4 text-green-400" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-400" />
                            )}
                            <span className="text-gray-300">
                              {log.itemCount} ta mahsulot
                            </span>
                          </div>
                          <span className="text-gray-500 text-xs">
                            {formatDate(log.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-4">
                      Hali sinxronizatsiya amalga oshirilmagan
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Products List */}
          {products.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6"
            >
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">
                    Barcha mahsulotlar ({products.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {products.map((product) => (
                      <div
                        key={product.offlineId}
                        className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700"
                      >
                        <div className="flex-1">
                          <h4 className="text-white font-medium">{product.name}</h4>
                          <p className="text-gray-400 text-sm">
                            {product.price.toLocaleString()} UZS • {product.category || 'Kategoriyasiz'}
                          </p>
                          <p className="text-gray-500 text-xs mt-1">
                            {formatDate(product.createdAt)}
                          </p>
                        </div>
                        <div>
                          {product.synced ? (
                            <span className="flex items-center gap-1 text-green-400 text-sm">
                              <CheckCircle className="w-4 h-4" />
                              Sinxronlangan
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-orange-400 text-sm">
                              <Clock className="w-4 h-4" />
                              Kutilmoqda
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
