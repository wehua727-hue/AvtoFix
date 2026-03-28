// Shared types between frontend and backend

// 🆕 Kategoriya interfeysi
export interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  level?: number;
  order?: number;
  isActive?: boolean;
  slug?: string;
  markupPercentage: number;  // Ustama foiz (default: 25)
}

// Bola mahsulot interfeysi
export interface ChildProduct {
  productId: string;  // Bola mahsulot ID
  name: string;       // Bola mahsulot nomi
  autoActivate: boolean; // Ota tugaganda avtomatik faollashtirilsinmi?
}

export interface Product {
  id: string;
  name: string;
  price: number;                  // Sotilish narxi (selling price)
  basePrice?: number;             // Asl narx (base price) - o'zgarmaydi
  priceMultiplier?: number;
  markupPercentage?: number;      // 🆕 Ustama foiz (kategoriyadan olinadi)
  currency?: string;
  sku: string;
  stock: number;
  categoryId?: string | null;
  imageUrl?: string | null;
  status?: 'available' | 'pending' | 'out-of-stock' | 'discontinued';
  sizes?: string[];
  variants?: ProductVariant[];
  variantSummaries?: VariantSummary[];
  video?: {
    filename: string;
    url?: string;
    size?: number;
  };
  store?: string;
  // Ota-bola mahsulot tizimi
  parentProductId?: string; // Ota mahsulot ID (agar bu bola mahsulot bo'lsa)
  childProducts?: ChildProduct[]; // Bola mahsulotlar ro'yxati
  isHidden?: boolean; // Yashirinmi? (ota mahsulot tugamaguncha ko'rinmaydi)
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductVariant {
  name: string;
  options: string[];
}

export interface VariantSummary {
  name: string;
  sku?: string;
  customId?: string; // ✅ YANGI: Qo'lda kiritilgan ID
  basePrice?: number;
  priceMultiplier?: number;
  price?: number;
  currency?: string;
  stock?: number;
  status?: string;
  imagePaths?: string[];
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
