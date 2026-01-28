/**
 * Offline/Online status indicator component
 * Shows current network status and sync information
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getUnsyncedProducts, getRecentSyncLogs } from '@/lib/db';
import { autoSync } from '@/lib/sync';
import { toast } from 'sonner';

export function OfflineIndicator() {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load unsynced count
  useEffect(() => {
    const loadUnsyncedCount = async () => {
      try {
        const products = await getUnsyncedProducts();
        setUnsyncedCount(products.length);
      } catch (error) {
        console.error('[OfflineIndicator] Error loading unsynced count:', error);
      }
    };

    loadUnsyncedCount();
    
    // Refresh every 10 seconds
    const interval = setInterval(loadUnsyncedCount, 10000);
    return () => clearInterval(interval);
  }, []);

  // Load last sync time
  useEffect(() => {
    const loadLastSync = async () => {
      try {
        const logs = await getRecentSyncLogs(1);
        if (logs.length > 0 && logs[0].status === 'success') {
          setLastSync(logs[0].timestamp);
        }
      } catch (error) {
        console.error('[OfflineIndicator] Error loading sync logs:', error);
      }
    };

    loadLastSync();
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (wasOffline && isOnline && unsyncedCount > 0) {
      handleSync();
    }
  }, [wasOffline, isOnline, unsyncedCount]);

  const handleSync = async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    toast.info('Sinxronizatsiya boshlanmoqda...');

    try {
      const result = await autoSync();
      
      if (result.success && result.syncedCount > 0) {
        toast.success(`${result.syncedCount} ta mahsulot sinxronlandi`);
        setLastSync(new Date().toISOString());
        
        // Refresh unsynced count
        const products = await getUnsyncedProducts();
        setUnsyncedCount(products.length);
        
        // Refresh page after successful sync
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else if (result.failedCount > 0) {
        toast.error(`Sinxronizatsiya xatosi: ${result.errors.join(', ')}`);
      } else {
        toast.info('Sinxronlash uchun ma\'lumot yo\'q');
      }
    } catch (error) {
      console.error('[OfflineIndicator] Sync error:', error);
      toast.error('Sinxronizatsiya xatosi');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Hozir';
    if (diffMins < 60) return `${diffMins} daqiqa oldin`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} soat oldin`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} kun oldin`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-16 right-4 z-50"
      >
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm border ${
            isOnline
              ? 'bg-green-900/40 border-green-700/30 text-green-300'
              : 'bg-red-900/40 border-red-700/30 text-red-300'
          }`}
        >
          {/* Network Status Icon */}
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-current opacity-30" />

          {/* Sync Status */}
          <div className="flex items-center gap-2">
            {unsyncedCount > 0 ? (
              <>
                <CloudOff className="w-4 h-4" />
                <span className="text-sm">
                  {unsyncedCount} ta sinxronlanmagan
                </span>
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4" />
                <span className="text-sm">Hammasi sinxronlangan</span>
              </>
            )}
          </div>

          {/* Sync Button */}
          {isOnline && unsyncedCount > 0 && (
            <>
              <div className="w-px h-4 bg-current opacity-30" />
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
                />
                <span>{isSyncing ? 'Sinxronlanmoqda...' : 'Sinxronlash'}</span>
              </button>
            </>
          )}

          {/* Last Sync Time */}
          {lastSync && (
            <>
              <div className="w-px h-4 bg-current opacity-30" />
              <span className="text-xs opacity-70">
                Oxirgi: {formatLastSync(lastSync)}
              </span>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
