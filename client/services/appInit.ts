import { initDB } from '@/db/indexeddb';
import { syncManager } from '@/services/syncManager';

export async function initializeApp() {
  try {
    console.log('[AppInit] Initializing application...');

    // Initialize IndexedDB
    console.log('[AppInit] Initializing IndexedDB...');
    await initDB();
    console.log('[AppInit] IndexedDB initialized');

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      try {
        console.log('[AppInit] Registering Service Worker...');
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
        });
        console.log('[AppInit] Service Worker registered:', registration);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
      } catch (error) {
        console.warn('[AppInit] Service Worker registration failed:', error);
      }
    }

    // Start sync manager
    console.log('[AppInit] Starting sync manager...');
    if (navigator.onLine) {
      await syncManager.startSync();
    }
    console.log('[AppInit] Sync manager started');

    console.log('[AppInit] Application initialized successfully');
  } catch (error) {
    console.error('[AppInit] Initialization failed:', error);
    throw error;
  }
}
