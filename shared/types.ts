// Shared types between frontend and backend

export interface Product {
  id: string;
  name: string;
  price: number;
  sku: string;
  stock: number;
  categoryId?: string | null;
  imageUrl?: string | null;
  status?: 'available' | 'pending' | 'out-of-stock' | 'discontinued';
  sizes?: string[];
  variants?: ProductVariant[];
  video?: {
    filename: string;
    url?: string;
    size?: number;
  };
  store?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductVariant {
  name: string;
  options: string[];
}

export interface SyncRecord {
  id: string;
  product: Product;
  action: 'create' | 'update' | 'delete';
  synced: boolean;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export interface SyncResponse {
  success: boolean;
  syncedIds: string[];
  errors?: Array<{
    id: string;
    error: string;
  }>;
  message?: string;
}

export interface OfflineState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime?: number;
  pendingCount: number;
  errors: string[];
}
