import { useEffect, useState, useCallback } from 'react';
import { OfflineState } from '@shared/types';
import { syncManager } from '@/services/syncManager';

export function useOfflineSync() {
  const [state, setState] = useState<OfflineState>(syncManager.getState());

  useEffect(() => {
    // Subscribe to sync manager updates
    const unsubscribe = syncManager.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, []);

  const manualSync = useCallback(async () => {
    if (state.isOnline && !state.isSyncing) {
      await syncManager.startSync();
    }
  }, [state.isOnline, state.isSyncing]);

  return {
    isOnline: state.isOnline,
    isSyncing: state.isSyncing,
    pendingCount: state.pendingCount,
    errors: state.errors,
    lastSyncTime: state.lastSyncTime,
    manualSync,
  };
}
