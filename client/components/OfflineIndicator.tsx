import { useOfflineSync } from '@/hooks/useOfflineSync';
import { AlertCircle, Wifi, WifiOff, RefreshCw } from 'lucide-react';

export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingCount, errors, manualSync } = useOfflineSync();

  if (isOnline && pendingCount === 0 && errors.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {/* Offline Badge */}
      {!isOnline && (
        <div className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-semibold">Offline rejim</span>
        </div>
      )}

      {/* Pending Sync Badge */}
      {pendingCount > 0 && (
        <div className="bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-semibold">{pendingCount} kutilmoqda</span>
          {isOnline && !isSyncing && (
            <button
              onClick={manualSync}
              className="ml-2 p-1 hover:bg-yellow-700 rounded transition"
              title="Sinxronizatsiyani boshlash"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Syncing Badge */}
      {isSyncing && (
        <div className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm font-semibold">Sinxronizatsiya...</span>
        </div>
      )}

      {/* Error Badge */}
      {errors.length > 0 && (
        <div className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg max-w-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Xatolik:</p>
            <p className="text-xs opacity-90">{errors[0]}</p>
          </div>
        </div>
      )}
    </div>
  );
}
