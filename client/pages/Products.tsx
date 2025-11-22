import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Layout/Header';
import Sidebar from '@/components/Layout/Sidebar';
import ProductStatusSelector, { productStatusConfig, type ProductStatus } from '@/components/ProductStatusSelector';
import { VideoUpload } from '@/components/VideoUpload';
import { useVideoUpload } from '@/hooks/useVideoUpload';
import { Badge } from '@/components/ui/badge';

interface ProductVariant {
  name: string;
  options: string[];
}

interface Product {
  id: string;
  name: string;
  price: number | null;
  sku: string;
  categoryId?: string | null;
  stock?: number | null;
  sizes?: string[];
  variants?: ProductVariant[];
  imageUrl?: string | null;
  status?: ProductStatus;
  video?: {
    filename: string;
    url?: string;
    size?: number;
  };
}

interface CategoryOption {
  id: string;
  name: string;
  level: number;
  parentId?: string | null;
}

// Electron (file://) uchun backendga to'g'ri ulanish
const API_BASE_URL = typeof window !== 'undefined' && window.location.protocol === 'file:'
  ? 'http://127.0.0.1:3000'
  : '';

const resolveMediaUrl = (url?: string | null): string => {
  if (!url) return '';
  if (/^(https?:)?\/\//.test(url) || url.startsWith('blob:')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
};

const getNextAutoSku = (items: Product[]): string => {
  const numericValues: number[] = items
    .map((p) => (p.sku ?? '').trim())
    .filter((s) => /^\d+$/.test(s))
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n));

  const max = numericValues.length ? Math.max(...numericValues) : 0;
  const next = max + 1;
  // Avval kod "00001" ko'rinishida edi, endi foydalanuvchi talabi bo'yicha oddiy "1, 2, 3..." ko'rinishida qaytaramiz
  return String(next);
};

const getSkuNumeric = (sku: string | undefined | null): number => {
  const s = (sku ?? '').trim();
  if (!/^\d+$/.test(s)) return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
};

const sortProductsBySku = (items: Product[]): Product[] => {
  return [...items].sort((a, b) => {
    const aNum = getSkuNumeric(a.sku);
    const bNum = getSkuNumeric(b.sku);
    if (aNum !== bNum) return aNum - bNum;
    return (a.sku ?? '').localeCompare(b.sku ?? '');
  });
};

const buildVariantsFromSizesText = (sizesText: string): ProductVariant[] => {
  const labels = sizesText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => entry.split('|')[0]?.trim())
    .filter(Boolean);

  const uniqueLabels = Array.from(new Set(labels));
  if (!uniqueLabels.length) return [];

  return [
    {
      name: "o'lcham",
      options: uniqueLabels,
    },
  ];
};

const getTodaySalesMap = (): Record<string, number> => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = `productSales:${today}`;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch (e) {
    console.error('Failed to read productSales from localStorage', e);
    return {};
  }
};

const getStatusForSales = (count: number): { label: string; color: string } => {
  if (count >= 10) return { label: 'Active', color: 'bg-green-600/80 text-white' };
  if (count >= 3) return { label: `O'rtacha`, color: 'bg-yellow-500/90 text-black' };
  return { label: 'Passiv', color: 'bg-gray-600/80 text-white' };
};

const normalizeProductStatus = (value: unknown): ProductStatus => {
  if (typeof value === 'string' && value in productStatusConfig) {
    return value as ProductStatus;
  }
  return 'available';
};

export default function Products() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [priceMultiplier, setPriceMultiplier] = useState('');
  const [stock, setStock] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedParent, setSelectedParent] = useState<CategoryOption | null>(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  // Use video upload hook
  const videoUpload = useVideoUpload();
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [sizesText, setSizesText] = useState('');
  const [productStatus, setProductStatus] = useState<ProductStatus>('available');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<CategoryOption[]>([]);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<{ filename: string; url?: string; size?: number } | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [sizeDraft, setSizeDraft] = useState('');
  const [sizePriceDraft, setSizePriceDraft] = useState('');
  const [isAddingSize, setIsAddingSize] = useState(false);
  const [editingSizeIndex, setEditingSizeIndex] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [todaySalesMap, setTodaySalesMap] = useState<Record<string, number>>({});
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [createCategoryLoading, setCreateCategoryLoading] = useState(false);
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleStartEditCategory = (category: CategoryOption) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  };

  const handleSaveCategoryEdit = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) {
      alert('Iltimos, kategoriya nomini kiriting');
      return;
    }

    try {
      setCreateCategoryLoading(true);
      
      console.log('[handleSaveCategoryEdit] Updating category:', editingCategoryId, 'with name:', editingCategoryName);
      
      // First, find the category to get its current data
      const categoryToUpdate = categories.find(cat => cat.id === editingCategoryId);
      if (!categoryToUpdate) {
        throw new Error('Kategoriya topilmadi');
      }

      const response = await fetch(`${API_BASE_URL}/api/categories/${editingCategoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: editingCategoryName,
          parentId: categoryToUpdate.parentId // Keep the original parentId
        }),
      });

      console.log('[handleSaveCategoryEdit] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[handleSaveCategoryEdit] Error response:', errorData);
        // Agar backend xato qaytarsa ham, hech bo'lmaganda lokal ro'yxatda nomni yangilaymiz
        setCategories(prev =>
          prev.map(cat =>
            cat.id === editingCategoryId
              ? { ...cat, name: editingCategoryName }
              : cat
          )
        );

        // Tahrirlash holatini tozalaymiz
        setEditingCategoryId(null);
        setEditingCategoryName('');
        // Foydalanuvchiga alert ko'rsatmaymiz, faqat logda qoladi
        return;
      }

      const data = await response.json();
      console.log('[handleSaveCategoryEdit] Response data:', data);
      
      // Update the category in local state
      if (data?.success && data.category) {
        setCategories(prev =>
          prev.map(cat =>
            cat.id === editingCategoryId
              ? { ...cat, name: data.category.name }
              : cat
          )
        );
      } else {
        // Fallback to using the input value
        setCategories(prev =>
          prev.map(cat =>
            cat.id === editingCategoryId
              ? { ...cat, name: editingCategoryName }
              : cat
          )
        );
      }
      
      // Reset editing state
      setEditingCategoryId(null);
      setEditingCategoryName('');
      
      console.log('[handleSaveCategoryEdit] Category updated successfully');
    } catch (error) {
      console.error('Error updating category:', error);
      // Electron/offline rejimida ham lokal ro'yxatda nomni yangilab, tahrirlash rejimidan chiqamiz
      if (editingCategoryId && editingCategoryName.trim()) {
        setCategories((prev) =>
          prev.map((cat) =>
            cat.id === editingCategoryId ? { ...cat, name: editingCategoryName } : cat,
          ),
        );
        setEditingCategoryId(null);
        setEditingCategoryName('');
      }
      // Foydalanuvchiga alert ko'rsatmaymiz, faqat logda qoladi
    } finally {
      setCreateCategoryLoading(false);
    }
  };

  const confirmDelete = (categoryId: string) => {
    setCategoryToDelete(categoryId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    
    try {
      setCreateCategoryLoading(true);
      
      console.log('[handleDeleteCategory] Deleting category:', categoryToDelete);
      
      // First, verify the category exists
      const categoryExists = categories.some(cat => cat.id === categoryToDelete);
      if (!categoryExists) {
        throw new Error('Kategoriya topilmadi');
      }

      const response = await fetch(`${API_BASE_URL}/api/categories/${categoryToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('[handleDeleteCategory] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[handleDeleteCategory] Error response:', errorData);
        throw new Error(errorData.message || 'Kategoriyani o\'chirishda xatolik yuz berdi');
      }

      const data = await response.json();
      console.log('[handleDeleteCategory] Response data:', data);

      // Remove the category from local state
      const updatedCategories = categories.filter(c => c.id !== categoryToDelete);
      setCategories(updatedCategories);
      
      // Clear category selection if the deleted category was selected
      if (categoryToDelete === categoryId) {
        setCategoryId('');
      }
      
      // If we're viewing a parent category that was deleted, clear the selection
      if (selectedParent?.id === categoryToDelete) {
        setSelectedParent(null);
      }
      
      console.log('[handleDeleteCategory] Category deleted successfully');
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Kategoriyani o\'chirishda xatolik yuz berdi: ' + (error instanceof Error ? error.message : 'Noma\'lum xatolik'));
    } finally {
      // Close the modal and reset state
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
      setCreateCategoryLoading(false);
    }
  };

  useEffect(() => {
    // Hozircha barcha mahsulotlarni ko'rsatish (keyinroq filtr qo'shamiz)
    const url = `${API_BASE_URL}/api/products`;
    
    fetch(url)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        console.log('[Products] Loaded products:', data.products);
        if (Array.isArray(data?.products)) {
          setProducts(sortProductsBySku(data.products as Product[]));
        }
      })
      .catch((err) => {
        console.error('Failed to load products from API:', err);
      });

    fetch(`${API_BASE_URL}/api/categories`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.categories)) {
          setCategories(
            (data.categories as any[])
              .map((c) => ({
                id: c.id ?? c._id ?? '',
                name: c.name ?? '',
                level: typeof c.level === 'number' ? c.level : 0,
                parentId: (c.parentId as string | null | undefined) ?? null,
              }))
              .filter((c) => c.id && c.name)
              .sort((a, b) => a.level - b.level)
          );
        }
      })
      .catch((err) => {
        console.error('Failed to load categories from API:', err);
      });

    setTodaySalesMap(getTodaySalesMap());
  }, []);

  const parseNumberInput = (value: string): number | null => {
    if (!value.trim()) return null;
    const normalized = value.replace(/\s/g, '').replace(/,/g, '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  useEffect(() => {
    const base = parseNumberInput(basePrice);
    const percent = parseNumberInput(priceMultiplier);

    if (base == null) {
      setPrice('');
      return;
    }

    const percentValue = percent ?? 0;
    const total = base + base * (percentValue / 100);
    if (!Number.isFinite(total)) {
      setPrice('');
      return;
    }

    const formatted = Number.isInteger(total) ? String(total) : total.toFixed(2);
    setPrice(formatted);
  }, [basePrice, priceMultiplier]);

  useEffect(() => {
    if (!isImageModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsImageModalOpen(false);
        setPreviewImageUrl(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isImageModalOpen]);

  // Lock background scroll when add/edit modals are open
  useEffect(() => {
    const anyModalOpen = Boolean(showAddForm || editingId);
    const htmlEl = document.documentElement as HTMLElement;
    const bodyEl = document.body as HTMLElement;
    const prevHtmlOverflow = htmlEl.style.overflow;
    const prevBodyOverflow = bodyEl.style.overflow;

    if (anyModalOpen) {
      htmlEl.style.overflow = 'hidden';
      bodyEl.style.overflow = 'hidden';
    } else {
      htmlEl.style.overflow = prevHtmlOverflow || '';
      bodyEl.style.overflow = prevBodyOverflow || '';
    }

    return () => {
      htmlEl.style.overflow = '';
      bodyEl.style.overflow = '';
    };
  }, [showAddForm, editingId]);

  // Cleanup video preview URL on unmount
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Majburiy maydonlar: nom, SKU/kod, asl narx, foiz, ombordagi soni, katta kategoriya
    if (
      !name.trim() ||
      !sku.trim() ||
      !basePrice.trim() ||
      !priceMultiplier.trim() ||
      !stock.trim() ||
      !categoryId.trim()
    ) {
      return;
    }

    setIsSaving(true);
    try {
      // Helper to post payload once image (if any) is prepared
      const submitPayload = async (imageBase64?: string, videoBase64?: string) => {
        // Joriy do'konni olish
        const currentStoreId = localStorage.getItem('currentStoreId') || '691aed70dac62e0c47226161';
        
        console.log('[Products] Submitting product with image:', {
          hasImage: !!imageBase64,
          imageLength: imageBase64?.length || 0,
          imagePreview: imageBase64?.substring(0, 50)
        });

        const payload: any = {
          name: name.trim(),
          sku: sku.trim(),
          price: Number(price) || 0,
          basePrice: Number(basePrice) || 0,
          priceMultiplier: Number(priceMultiplier) || 0,
          stock: Number(stock) || 0,
          categoryId,
          store: currentStoreId,
          status: productStatus,
        };
        
        console.log('[Products] Payload to send:', { price: payload.price, basePrice: payload.basePrice, priceMultiplier: payload.priceMultiplier });

        if (sizesText.trim()) {
          payload.sizes = sizesText.trim();
          const variants = buildVariantsFromSizesText(sizesText);
          if (variants.length) {
            payload.variants = variants;
          }
        }

        if (imageBase64) {
          console.log('[Products] Adding imageBase64 to payload');
          payload.imageBase64 = imageBase64;
        } else if (editingId && removeExistingImage) {
          // Tahrirlash rejimida foydalanuvchi rasmini o'chirgan bo'lsa, backendga bo'sh qiymat yuboramiz
          payload.imageBase64 = '';
        } else {
          console.log('[Products] No image to upload');
        }

        // Video ma'lumotlarini qo'shish
        const videoPayload = await videoUpload.getVideoPayload();
        Object.assign(payload, videoPayload);

        const url = editingId ? `${API_BASE_URL}/api/products/${editingId}` : `${API_BASE_URL}/api/products`;
        const method = editingId ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error('Failed to save product:', res.status, errorData);
          return;
        }

        const data = await res.json();
        if (!data?.success || !data.product) return;

        if (editingId) {
          setProducts((prev) =>
            sortProductsBySku(prev.map((p) => (p.id === editingId ? (data.product as Product) : p))),
          );
        } else {
          setProducts((prev) => sortProductsBySku([...prev, data.product as Product]));
        }

        // Har ikki holatda ham formani tozalaymiz va modalni yopamiz
        setName('');
        setSku('');
        setPrice('');
        setBasePrice('');
        setPriceMultiplier('');
        setStock('');
        setCategoryId('');
        setSelectedParent(null);
        setEditingId(null);
        setShowAddForm(false);
        setImageFiles([]);
        setImagePreviews([]);
        setImageError(null);
        videoUpload.clearAll(); // Use hook method to clear video data
        setSizesText('');
        setSizeDraft('');
        setSizePriceDraft('');
        setIsAddingSize(false);
        setEditingSizeIndex(null);
        setProductStatus('available');
      };

      // Helper function to convert file to base64
      const toBase64 = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

      // Convert image and video to base64
      let imageBase64: string | undefined;
      let videoBase64: string | undefined;

      // Process image - use imagePreviews to check if image exists
      console.log('[Products] imageFiles.length:', imageFiles.length, 'imagePreviews.length:', imagePreviews.length);
      if (imagePreviews.length > 0 && imageFiles.length > 0) {
        const firstImage = imageFiles[0];
        console.log('[Products] Converting image to base64:', firstImage.name, firstImage.size);
        setImageError(null);
        try {
          imageBase64 = await toBase64(firstImage);
          console.log('[Products] Image converted successfully, length:', imageBase64?.length);
        } catch (err) {
          console.error('Failed to convert image to base64', err);
        }
      } else if (imagePreviews.length > 0 && imagePreviews[0]?.startsWith('data:')) {
        // If preview is already base64 (from new upload), use it directly
        console.log('[Products] Using existing preview as base64');
        imageBase64 = imagePreviews[0];
      } else {
        console.log('[Products] No image files selected. imageFiles:', imageFiles.length, 'previews:', imagePreviews.length);
      }

      // Process video (only if it's a new upload with actual file data)
      if (videoFile && videoFile.size > 0 && videoPreviewUrl && !videoPreviewUrl.startsWith('http')) {
        setVideoError(null);
        try {
          videoBase64 = await toBase64(videoFile);
        } catch (err) {
          console.error('Failed to convert video to base64', err);
          setVideoError('Video yuklashda xatolik yuz berdi');
        }
      }

      // Submit with both image and video
      await submitPayload(imageBase64, videoBase64);
    } catch (err) {
      console.error('Error creating product:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImagePreview = (url?: string | null) => {
    if (!url) return;
    setPreviewImageUrl(url);
    setIsImageModalOpen(true);
  };

  const handleCloseImageModal = () => {
    setIsImageModalOpen(false);
    setPreviewImageUrl(null);
  };

  const handleVideoPreview = (video?: { filename: string; url?: string; size?: number } | null) => {
    if (!video) return;
    setPreviewVideo(video);
    setIsVideoModalOpen(true);
  };

  const handleCloseVideoModal = () => {
    setIsVideoModalOpen(false);
    setPreviewVideo(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) {
        setProducts((prev) => sortProductsBySku(prev.filter((x) => x.id !== deleteTarget.id)));
        setDeleteTarget(null);
      }
    } catch (err) {
      console.error('Failed to delete product', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setCreateCategoryError('Kategoriya nomi kiritilishi shart');
      return;
    }

    setCreateCategoryLoading(true);
    setCreateCategoryError(null);

    try {
      const payload: any = {
        name,
      };

      // Agar selectedParent bo'lsa, ichki kategoriya yaratamiz
      if (selectedParent) {
        payload.parentId = selectedParent.id;
        payload.level = (selectedParent.level ?? 0) + 1;
      } else {
        payload.parentId = null;
        payload.level = 0;
      }

      const res = await fetch(`${API_BASE_URL}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Kategoriya yaratishda xatolik');
      }

      const data = await res.json();
      if (!data?.success || !data.category) {
        throw new Error('Kategoriya yaratilmadi');
      }

      // Yangi kategoriyani ro'yxatga qo'shamiz
      const newCategory: CategoryOption = {
        id: data.category.id,
        name: data.category.name,
        level: typeof data.category.level === 'number' ? data.category.level : 0,
        parentId: data.category.parentId ?? null,
      };

      setCategories((prev) => [...prev, newCategory].sort((a, b) => a.level - b.level));

      // Yangi kategoriyani darhol tanlaymiz
      setCategoryId(newCategory.id);

      // Formani tozalaymiz
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setCreateCategoryError(null);
    } catch (err) {
      console.error('Error creating category:', err);
      setCreateCategoryError(err instanceof Error ? err.message : 'Kategoriya yaratishda xatolik');
    } finally {
      setCreateCategoryLoading(false);
    }
  };

  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      <Header onMenuClick={() => setSidebarOpen((prev) => !prev)} />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Scrollable content area under fixed navbar */}
      <div
        className={`flex-1 ${showAddForm ? 'overflow-hidden' : 'overflow-y-auto'} pt-24 sm:pt-28 lg:pt-28 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold text-foreground">
              Mahsulotlar
            </h1>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:items-center">
              <div className="flex-1 min-w-[220px] sm:min-w-[260px] sm:max-w-md">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="mahsulotni qidirish"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                onClick={() =>
                  setShowAddForm((prev) => {
                    const next = !prev;
                    if (next) {
                      setEditingId(null);
                      setName('');
                      setPrice('');
                      setBasePrice('');
                      setPriceMultiplier('');
                      setStock('');
                      setCategoryId('');
                      setSelectedParent(null);
                      setImageFiles([]);
                      setImagePreviews([]);
                      setImageError(null);
                      setVideoFile(null);
                      setVideoError(null);
                      setRemoveExistingImage(false);
                      setSizesText('');
                      setSku(getNextAutoSku(products));
                      setIsCreatingCategory(false);
                      setNewCategoryName('');
                      setCreateCategoryError(null);
                      setProductStatus('available');
                    }
                    return next;
                  })
                }
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 via-red-700 to-red-600 text-white text-sm font-semibold shadow-lg shadow-red-900/40 hover:from-red-700 hover:via-red-800 hover:to-red-700 transition-all"
              >
                <span>Mahsulot qo'shish</span>
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showAddForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-2 sm:px-4">
                <motion.div
                  key="product-modal"
                  initial={{ opacity: 0, y: 40, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 40, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="w-full max-w-full sm:max-w-xl lg:max-w-3xl mx-2 sm:mx-4 mb-2 sm:mb-0 rounded-2xl border border-border bg-card text-card-foreground shadow-2xl shadow-black/70 flex flex-col max-h-[90vh]"
                >
                  <div className="flex items-center justify-between px-4 sm:px-5 pt-3 pb-2 border-b border-border bg-muted rounded-t-2xl">
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-semibold truncate text-foreground">
                      {editingId ? 'Mahsulotni tahrirlash' : 'Mahsulot qo\'shish'}
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      Mahsulot ma`lumotlarini kiriting yoki tahrirlang
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingId(null);
                      setName('');
                      setSku('');
                      setPrice('');
                      setBasePrice('');
                      setPriceMultiplier('');
                      setStock('');
                      setCategoryId('');
                      setSelectedParent(null);
                      setImageFiles([]);
                      setImagePreviews([]);
                      setImageError(null);
                      setVideoFile(null);
                      setVideoError(null);
                      setRemoveExistingImage(false);
                      setSizesText('');
                      setSizeDraft('');
                      setSizePriceDraft('');
                      setIsAddingSize(false);
                      setEditingSizeIndex(null);
                      setIsCreatingCategory(false);
                      setNewCategoryName('');
                      setCreateCategoryError(null);
                      setProductStatus('available');
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition"
                    disabled={isSaving}
                  >
                    ×
                  </button>
                  </div>

                  <form onSubmit={handleSubmit} className="px-4 sm:px-5 pt-4 pb-4 space-y-4 overflow-y-auto">
                  <div className="space-y-4 pb-1">
                    {/* Nom + SKU */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">Mahsulot nomi</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="Masalan: Bolt 15mm"
                          disabled={isSaving}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">SKU / Kod</label>
                        <input
                          type="text"
                          value={sku}
                          onChange={(e) => setSku(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="Masalan: CC-001"
                          disabled={isSaving}
                        />
                      </div>
                    </div>

                    {/* Narx hisob-kitobi */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">Asl narxi</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={basePrice}
                          onChange={(e) => setBasePrice(e.target.value)}
                          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                          className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="Masalan: 10000"
                          disabled={isSaving}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">Foizi (%)</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={priceMultiplier}
                          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                          onChange={(e) => setPriceMultiplier(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="Masalan: 10"
                          disabled={isSaving}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">Sotiladigan narxi</label>
                        <input
                          type="text"
                          value={
                            price
                              ? (() => {
                                  const numeric = Number(price);
                                  return Number.isFinite(numeric) ? numeric.toLocaleString('uz-UZ') : price;
                                })()
                              : ''
                          }
                          readOnly
                          className="w-full px-4 py-2.5 rounded-xl bg-muted border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none"
                          placeholder="Avtomatik hisoblanadi"
                        />
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Formula: sotiladigan narx = asl narx + (asl narx × foiz / 100)
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Ombordagi soni</label>
                      <input
                        type="number"
                        value={stock}
                        onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                        onChange={(e) => setStock(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-background border border-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Masalan: 10"
                        disabled={isSaving}
                      />
                    </div>

                    <ProductStatusSelector
                      value={productStatus}
                      onChange={setProductStatus}
                      disabled={isSaving}
                    />

                    {/* Kategoriya */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Kategoriya</label>
                      <div className="rounded-2xl border border-border bg-muted p-3 flex flex-col gap-3 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs text-muted-foreground">
                            <span>Kategoriyalar</span>
                            {selectedParent && (
                              <>
                                <span className="text-primary mx-1">/</span>
                                <span className="text-primary font-medium">{selectedParent.name}</span>
                              </>
                            )}

                      {/* Video tanlangan bo'lsa, uning nomini ko'rsatamiz */}
                      {videoFile && !videoError && (
                        <div className="mt-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-foreground flex items-center justify-between">
                          <div>
                            <span className="font-semibold">Video:</span>{' '}
                            <span className="text-muted-foreground">{videoFile.name}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">(faqat nom saqlanadi, alohida upload kerak bo'lishi mumkin)</span>
                        </div>
                      )}
                          </div>
                          {selectedParent && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPath((prev) => {
                                  const next = prev.slice(0, -1);
                                  setSelectedParent(next.length ? next[next.length - 1] : null);
                                  return next;
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-[11px] text-foreground hover:bg-muted transition"
                              disabled={isSaving}
                            >
                              <span>Ortga</span>
                            </button>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Tanlangan kategoriya:
                          <span className="ml-1 font-semibold text-foreground">
                            {categoryId
                              ? categories.find((c) => c.id === categoryId)?.name ?? 'Tanlanmagan'
                              : 'Tanlanmagan'}
                          </span>
                          {categoryId && (
                            <button
                              type="button"
                              onClick={() => {
                                setCategoryId('');
                                setSelectedParent(null);
                                setSelectedPath([]);
                              }}
                              className="ml-2 text-[11px] text-red-400 hover:text-red-300 underline"
                              disabled={isSaving}
                            >
                              Tozalash
                            </button>
                          )}
                        </div>

                        <div className="mt-2 flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                          {(selectedParent
                            ? categories.filter((c) => c.parentId === selectedParent.id)
                            : categories.filter((c) => !c.parentId)
                          ).map((c) => {
                            const isSelected = categoryId === c.id;
                            const isEditing = editingCategoryId === c.id;
                            return (
                              <div
                                key={c.id}
                                className={`w-full flex items-center gap-2 rounded-xl border text-xs transition-all px-3 py-2 ${
                                  isSelected
                                    ? 'border-primary bg-primary/20 text-primary-foreground'
                                    : 'border-border bg-background text-foreground hover:bg-muted'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Agar aynan shu kategoriya hozir tahrirlash rejimida bo'lsa, ichiga kirmaymiz
                                    if (isEditing) return;

                                    // Tanlangan kategoriyani belgilaymiz
                                    setCategoryId(c.id);
                                    // Sidebardagi kabi: har doim shu kategoriyani joriy parent sifatida ochamiz,
                                    // ichida hozircha child bo'lmasa ham keyinchalik ichki kategoriya qo'shish mumkin bo'ladi
                                    setSelectedParent(c);
                                    setSelectedPath((prev) => [...prev, c]);
                                  }}
                                  className="flex-1 text-left truncate"
                                  disabled={isSaving}
                                >
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={editingCategoryName}
                                      onChange={(e) => setEditingCategoryName(e.target.value)}
                                      className="w-full bg-background border border-input rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                      autoFocus
                                    />
                                  ) : (
                                    <span>{c.name}</span>
                                  )}
                                </button>

                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={handleSaveCategoryEdit}
                                      className="px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90"
                                      disabled={createCategoryLoading}
                                    >
                                      Saqlash
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCategoryId(null);
                                        setEditingCategoryName('');
                                      }}
                                      className="px-2 py-0.5 rounded-md border border-border text-[10px] hover:bg-muted"
                                      disabled={createCategoryLoading}
                                    >
                                      Bekor
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditCategory(c)}
                                      className="px-2 py-0.5 rounded-md border border-border text-[10px] hover:bg-muted"
                                      disabled={createCategoryLoading}
                                    >
                                      Tahrir
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => confirmDelete(c.id)}
                                      className="px-2 py-0.5 rounded-md bg-destructive text-destructive-foreground text-[10px] hover:bg-destructive/90"
                                      disabled={createCategoryLoading}
                                    >
                                      O'chir
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {(!selectedParent && categories.filter((c) => !c.parentId).length === 0) ||
                          (selectedParent && categories.filter((c) => c.parentId === selectedParent.id).length === 0) ? (
                            <p className="text-[11px] text-gray-500 py-2">
                              Bu bo'limda hozircha kategoriya yo'q.
                            </p>
                          ) : null}
                        </div>

                        {/* Yangi kategoriya yaratish inline form */}
                        {!isCreatingCategory ? (
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingCategory(true);
                              setNewCategoryName('');
                              setCreateCategoryError(null);
                            }}
                            className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-primary/60 bg-primary/5 text-primary text-[11px] font-semibold hover:bg-primary/10 transition-all disabled:opacity-60"
                            disabled={isSaving}
                          >
                            <span className="text-sm">+</span>
                            <span>Kategoriya yaratish</span>
                          </button>
                        ) : (
                          <div className="rounded-xl border border-primary/40 bg-card/60 p-3 space-y-2">
                            <div className="text-[11px] text-muted-foreground mb-1">
                              {selectedParent ? `"${selectedParent.name}" ichida yangi kategoriya` : 'Yangi kategoriya'}
                            </div>
                            <input
                              type="text"
                              value={newCategoryName}
                              onChange={(e) => {
                                setNewCategoryName(e.target.value);
                                setCreateCategoryError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCreateCategory();
                                }
                              }}
                              placeholder="Kategoriya nomi"
                              className="w-full px-3 py-2 rounded-lg bg-background border border-input text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                              disabled={createCategoryLoading}
                              autoFocus
                            />
                            {createCategoryError && (
                              <p className="text-[10px] text-destructive">{createCategoryError}</p>
                            )}
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCreatingCategory(false);
                                  setNewCategoryName('');
                                  setCreateCategoryError(null);
                                }}
                                className="px-3 py-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground text-[11px] hover:bg-muted transition-all"
                                disabled={createCategoryLoading}
                              >
                                Bekor qilish
                              </button>
                              <button
                                type="button"
                                onClick={handleCreateCategory}
                                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-all disabled:opacity-60"
                                disabled={createCategoryLoading || !newCategoryName.trim()}
                              >
                                {createCategoryLoading ? 'Saqlanmoqda...' : 'Saqlash'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Xillar / o'lchamlar</label>
                      <div className="rounded-2xl border border-input bg-background/60 p-3 flex flex-col gap-2">
                        {/* Saqlangan xillar card ko'rinishida */}
                        {sizesText.trim() ? (
                          <div className="flex flex-wrap gap-2">
                            {sizesText
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .map((s, idx) => {
                                const [label, price] = s.split('|');
                                return (
                                  <div
                                    key={`${s}-${idx}`}
                                    className="inline-flex items-center gap-1 rounded-xl bg-muted px-2.5 py-1 border border-border text-[11px] text-foreground shadow-sm"
                                  >
                                    <span>{label}</span>
                                    {price && (
                                      <span className="text-[10px] text-muted-foreground ml-1">
                                        {price} so'm
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const arr = sizesText
                                          .split(',')
                                          .map((x) => x.trim())
                                          .filter(Boolean);
                                        const raw = arr[idx] ?? '';
                                        const [lbl, pr] = raw.split('|');
                                        setSizeDraft(lbl ?? '');
                                        setSizePriceDraft(pr ?? '');
                                        setIsAddingSize(true);
                                        setEditingSizeIndex(idx);
                                      }}
                                      className="ml-1 px-1 rounded bg-background/60 hover:bg-background text-[10px]"
                                      disabled={isSaving}
                                    >
                                      Tahrirlash
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const arr = sizesText
                                          .split(',')
                                          .map((x) => x.trim())
                                          .filter(Boolean);
                                        arr.splice(idx, 1);
                                        setSizesText(arr.join(', '));
                                        if (editingSizeIndex === idx) {
                                          setEditingSizeIndex(null);
                                          setSizeDraft('');
                                          setSizePriceDraft('');
                                          setIsAddingSize(false);
                                        }
                                      }}
                                      className="ml-1 px-1 rounded bg-destructive/80 text-destructive-foreground hover:bg-destructive text-[10px]"
                                      disabled={isSaving}
                                    >
                                      O'chirish
                                    </button>
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            Hozircha xil qo'shilmagan. "Xil qo'shish" tugmasini bosing.
                          </p>
                        )}

                        {/* Xil qo'shish tugmasi */}
                        {!isAddingSize && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingSize(true);
                              setEditingSizeIndex(null);
                              setSizeDraft('');
                              setSizePriceDraft('');
                            }}
                            className="self-start mt-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-[11px] text-foreground hover:bg-muted transition disabled:opacity-60"
                            disabled={isSaving}
                          >
                            Xil qo'shish
                          </button>
                        )}

                        {/* Xil kiritish input + saqlash tugmasi */}
                        {isAddingSize && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex flex-1 gap-2">
                              <input
                                type="text"
                                value={sizeDraft}
                                onChange={(e) => setSizeDraft(e.target.value)}
                                className="w-1/2 px-3 py-2 rounded-xl bg-background border border-input text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Xil: 15mm yoki S"
                                disabled={isSaving}
                              />
                              <input
                                type="number"
                                min={0}
                                value={sizePriceDraft}
                                onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                                onChange={(e) => setSizePriceDraft(e.target.value)}
                                className="w-1/2 px-3 py-2 rounded-xl bg-background border border-input text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Narx (ixtiyoriy)"
                                disabled={isSaving}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const label = sizeDraft.trim();
                                if (!label) return;

                                const existing = sizesText
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter(Boolean);

                                const entry = sizePriceDraft.trim()
                                  ? `${label}|${sizePriceDraft.trim()}`
                                  : label;

                                if (editingSizeIndex != null) {
                                  // tahrirlash rejimi
                                  const copy = [...existing];
                                  copy[editingSizeIndex] = entry;
                                  setSizesText(copy.join(', '));
                                } else {
                                  // yangi xil qo'shish
                                  if (existing.includes(entry)) {
                                    setSizeDraft('');
                                    setSizePriceDraft('');
                                    return;
                                  }
                                  const next = existing.length ? `${existing.join(', ')}, ${entry}` : entry;
                                  setSizesText(next);
                                }

                                setSizeDraft('');
                                setSizePriceDraft('');
                                setEditingSizeIndex(null);
                                // yana keyingi xil kiritish uchun input ochiq qoladi
                              }}
                              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 disabled:opacity-60"
                              disabled={isSaving}
                            >
                              Saqlash
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Mahsulot rasmlari / videolari */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-2">Mahsulot media (rasm / video)</label>
                      
                      {/* Fayl tanlash tugmasi */}
                      <div
                        className="w-full border-2 border-dashed border-border rounded-xl bg-muted/50 px-4 py-4 flex items-center justify-center text-center cursor-pointer hover:border-primary hover:bg-muted/70 transition"
                        onClick={() => {
                          const input = document.getElementById('product-images-input') as HTMLInputElement | null;
                          input?.click();
                        }}
                      >
                        <input
                          id="product-images-input"
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            console.log('[Products] Files selected:', files.length, files.map(f => ({ name: f.name, type: f.type, size: f.size })));
                            if (files.length === 0) return;

                            const imageCandidates: File[] = [];
                            let pickedVideo: File | null = null;

                            files.forEach((f) => {
                              if (f.type.startsWith('video/')) {
                                if (!pickedVideo) {
                                  pickedVideo = f;
                                }
                              } else if (f.type.startsWith('image/')) {
                                imageCandidates.push(f);
                              }
                            });

                            console.log('[Products] Image candidates:', imageCandidates.length);

                            // Validate images (max 5MB each)
                            const validImages = imageCandidates.filter((f) => {
                              if (f.size > 5 * 1024 * 1024) {
                                setImageError(`${f.name} hajmi 5MB dan oshmasligi kerak`);
                                return false;
                              }
                              return true;
                            });

                            console.log('[Products] Valid images:', validImages.length);

                            if (validImages.length > 0) {
                              setImageFiles((prev) => [...prev, ...validImages]);
                              const newPreviews = validImages.map((f) => URL.createObjectURL(f));
                              setImagePreviews((prev) => [...prev, ...newPreviews]);
                              setImageError(null);
                              console.log('[Products] Image files set:', validImages.length);
                            }

                            // Handle single video (max 50MB)
                            if (pickedVideo) {
                              if (pickedVideo.size > 50 * 1024 * 1024) {
                                setVideoError(`${pickedVideo.name} hajmi 50MB dan oshmasligi kerak`);
                                setVideoFile(null);
                                setVideoPreviewUrl(null);
                              } else {
                                setVideoFile(pickedVideo);
                                setVideoError(null);
                                // Create preview URL for video
                                const videoUrl = URL.createObjectURL(pickedVideo);
                                setVideoPreviewUrl(videoUrl);
                              }
                            }
                            
                            // Reset input
                            e.target.value = '';
                          }}
                        />
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-3xl">📁</span>
                            <span className="text-2xl">🎬</span>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-foreground">Rasm yoki video tanlang</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Rasmlar: max 5MB har biri | Video: max 50MB
                            </p>
                          </div>
                        </div>
                      </div>

                      {imageError && (
                        <p className="text-xs text-destructive mt-2">{imageError}</p>
                      )}
                      {videoError && (
                        <p className="text-xs text-destructive mt-1">{videoError}</p>
                      )}

                      {/* Rasmlar preview */}
                      {imagePreviews.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-foreground mb-2">Tanlangan rasmlar:</p>
                          <div className="flex flex-wrap gap-2">
                            {imagePreviews.map((preview, index) => (
                              <div
                                key={index}
                                className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-border bg-background shadow-sm group hover:border-primary transition-all"
                              >
                                <img
                                  src={preview}
                                  alt={`Rasm ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    URL.revokeObjectURL(preview);
                                    setImagePreviews(prev => prev.filter((_, i) => i !== index));
                                    setImageFiles(prev => prev.filter((_, i) => i !== index));
                                  }}
                                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-lg"
                                  disabled={isSaving}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Video preview */}
                      {videoFile && !videoError && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-foreground mb-2">Tanlangan video:</p>
                          <div className="relative rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden shadow-lg">
                            {/* Video player - only if preview URL exists */}
                            {videoPreviewUrl && (
                              <div className="relative w-full aspect-video bg-black">
                                <video
                                  controls
                                  className="w-full h-full"
                                  src={videoPreviewUrl}
                                >
                                  <source src={videoPreviewUrl} type={videoFile.type} />
                                  Brauzeringiz video o'ynatishni qo'llab-quvvatlamaydi.
                                </video>
                              </div>
                            )}
                            
                            {/* Video info */}
                            <div className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">{videoFile.name}</p>
                                  {videoFile.size > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Hajmi: {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                                    </p>
                                  )}
                                  <p className="text-[10px] text-muted-foreground mt-1 italic">
                                    {videoPreviewUrl 
                                      ? 'Video preview ko\'rsatilmoqda. Saqlashda faqat nom saqlanadi.' 
                                      : 'Mavjud video. Yangi video yuklash uchun fayl tanlang.'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (videoPreviewUrl && !videoPreviewUrl.startsWith('http')) {
                                      URL.revokeObjectURL(videoPreviewUrl);
                                    }
                                    setVideoFile(null);
                                    setVideoError(null);
                                    setVideoPreviewUrl(null);
                                  }}
                                  className="flex-shrink-0 w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm flex items-center justify-center transition-all shadow-lg"
                                  disabled={isSaving}
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingId(null);
                        setName('');
                        setSku('');
                        setPrice('');
                        setBasePrice('');
                        setPriceMultiplier('');
                        setStock('');
                        setCategoryId('');
                        setSelectedParent(null);
                        setImageFiles([]);
                        setImagePreviews([]);
                        setImageError(null);
                        setVideoFile(null);
                        setVideoError(null);
                        setSizesText('');
                        setSizeDraft('');
                        setSizePriceDraft('');
                        setIsAddingSize(false);
                        setEditingSizeIndex(null);
                        setIsCreatingCategory(false);
                        setNewCategoryName('');
                        setCreateCategoryError(null);
                        setProductStatus('available');
                      }}
                      className="px-4 py-2 rounded-lg border border-border bg-secondary text-secondary-foreground text-xs hover:bg-muted transition-all"
                      disabled={isSaving}
                    >
                      Bekor qilish
                    </button>
                    <button
                      type="submit"
                      disabled={
                        isSaving ||
                        !name.trim() ||
                        !sku.trim() ||
                        !basePrice.trim() ||
                        !priceMultiplier.trim() ||
                        !stock.trim() ||
                        !categoryId.trim()
                      }
                      className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-lg shadow-red-900/40 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Saqlanmoqda...' : editingId ? 'Mahsulotni yangilash' : 'Mahsulot qo\'shish'}
                    </button>
                  </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">Mahsulotlar Yuklanyapti...</p>
          ) : (
            <div
              className={`grid gap-3 sm:gap-4 transition-all ${
                sidebarCollapsed
                  ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
                  : 'grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
              }`}
            >
              {products
                .filter((p) => {
                  if (!search.trim()) return true;
                  const q = search.toLowerCase();
                  return p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q);
                })
                 .map((p) => {
                  const statusKey = normalizeProductStatus(p.status);
                  const statusMeta = productStatusConfig[statusKey];
                  const salesCount = todaySalesMap[p.id] ?? 0;
                  const salesStatus = getStatusForSales(salesCount);

                  const hasVideo = p.video?.filename;
                  
                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/product/${p.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/product/${p.id}`);
                        }
                      }}
                      className="group relative flex w-full flex-col rounded-2xl border border-red-700/40 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 backdrop-blur-sm shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(127,29,29,0.55)] hover:border-red-400/80 overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500/80 min-h-[320px]"
                    >
                      {/* Media section - Image or Video */}
                      <div 
                        className="relative w-full h-36 sm:h-40 bg-gradient-to-b from-gray-800/90 via-gray-900/95 to-black overflow-hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (p.imageUrl) {
                            handleImagePreview(resolveMediaUrl(p.imageUrl));
                          } else if (hasVideo && p.video) {
                            handleVideoPreview(p.video);
                          }
                        }}
                      >
                        {p.imageUrl ? (
                          <img
                            src={resolveMediaUrl(p.imageUrl)}
                            alt={p.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : hasVideo ? (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900/30 to-gray-900/60 group-hover:from-red-900/40 group-hover:to-gray-900/70 transition-all">
                            <div className="text-center">
                              <div className="relative">
                                <svg className="w-16 h-16 text-red-400 mx-auto group-hover:text-red-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="w-12 h-12 rounded-full bg-red-600/80 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-2 group-hover:text-gray-300 transition-colors">Video mavjud</p>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center">
                              <svg className="w-8 h-8 text-gray-600 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-[10px] text-gray-500">Media yo'q</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Price badge */}
                        {/* Optional quick preview icon (doesn't navigate) */}
                        {(p.imageUrl || hasVideo) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasVideo && p.video) {
                                handleVideoPreview(p.video);
                              } else if (p.imageUrl) {
                                handleImagePreview(resolveMediaUrl(p.imageUrl));
                              }
                            }}
                            className="absolute bottom-2 right-2 inline-flex items-center justify-center rounded-full bg-black/70 hover:bg-black/90 text-[10px] text-gray-100 px-2.5 py-1 border border-red-400/70 shadow-lg shadow-black/60"
                          >
                            Media
                          </button>
                        )}
                      </div>

                      {/* Content section */}
                      <div className="px-2.5 pb-2 pt-1.5 flex flex-col gap-1.5 bg-gradient-to-t from-gray-950/95 via-gray-950/90 to-transparent">
                    {/* Name + price row */}
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="flex-1 text-[13px] sm:text-sm font-semibold text-white line-clamp-2 leading-tight tracking-tight">
                        {p.name}
                      </h3>
                      <div className="flex flex-col items-end text-white">
                        <span className="text-[9px] uppercase tracking-[0.18em] text-gray-400 font-semibold">narx</span>
                        <span className="text-sm font-bold text-red-300 leading-none text-red-600">
                          {p.price != null ? p.price.toLocaleString('uz-UZ') : '0'}
                          <span className="text-[9px] ml-0.5 opacity-90 text-red-600">so'm</span>
                        </span>
                      </div>
                    </div>
<hr />
                        {/* Info row */}
                        <div className="flex items-center justify-between gap-1.5 text-[11px] text-gray-100">
                          <div className="flex flex-col">
                            <span className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-semibold">Kod</span>
                            <span className="font-semibold truncate text-red-600">{p.sku || '-'}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-semibold">Ombor</span>
                            <span className="font-semibold text-red-600">{p.stock != null ? p.stock : '-'} dona</span>
                          </div>
                        </div>

                        {/* Status badges */}
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-gray-900/80 border border-red-600/35 px-2 py-0.5 text-[10px] font-semibold text-gray-50">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            {statusMeta.label}
                          </span>
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${salesStatus.color}`}>
                            {salesCount} sotildi
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1.5 pt-1.5 border-t border-red-900/40 mt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(p.id);
                              setShowAddForm(true);
                              setName(p.name);
                              setSku(p.sku);
                              const existingPrice = p.price != null ? String(p.price) : '';
                              setPrice(existingPrice);
                              setBasePrice(existingPrice);
                              setPriceMultiplier(existingPrice ? '0' : '');
                              setStock(p.stock != null ? String(p.stock) : '');
                              setCategoryId(p.categoryId ?? '');
                              setSizesText(Array.isArray(p.sizes) && p.sizes.length ? p.sizes.join(', ') : '');
                              setImageFiles([]);
                              setImagePreviews(p.imageUrl ? [resolveMediaUrl(p.imageUrl)] : []);
                              setImageError(null);
                              setRemoveExistingImage(false);
                              // Load video if exists
                              if (p.video?.filename) {
                                // Create a mock File object for display purposes
                                const mockVideoFile = new File([], p.video.filename, { type: 'video/mp4' });
                                Object.defineProperty(mockVideoFile, 'size', { value: p.video.size || 0 });
                                setVideoFile(mockVideoFile);
                                // If video has URL, set it as preview
                                if (p.video.url) {
                                  setVideoPreviewUrl(p.video.url);
                                }
                              } else {
                                setVideoFile(null);
                                setVideoPreviewUrl(null);
                              }
                              setVideoError(null);
                              setProductStatus(normalizeProductStatus(p.status));
                            }}
                            disabled={isSaving}
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600/80 hover:bg-blue-600 px-2 py-1.5 text-[11px] font-bold text-white transition-all"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Tahrir
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(p);
                            }}
                            disabled={isSaving}
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-red-600/80 hover:bg-red-600 px-2 py-1.5 text-[11px] font-bold text-white transition-all"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            O'chir
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {isImageModalOpen && previewImageUrl && (
            <div
              className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
              onClick={handleCloseImageModal}
            >
              <div
                className="relative max-h-[90vh] w-full max-w-3xl"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <button
                  type="button"
                  onClick={handleCloseImageModal}
                  className="absolute -top-4 -right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-2xl text-white transition hover:bg-black/80"
                >
                  ×
                </button>
                <img
                  src={previewImageUrl}
                  alt="Mahsulot rasmi kattalashtirilgan"
                  className="max-h-[90vh] w-full rounded-3xl object-contain shadow-2xl"
                />
              </div>
            </div>
          )}

          {isVideoModalOpen && previewVideo && (
            <div
              className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-sm px-4"
              onClick={handleCloseVideoModal}
            >
              <div
                className="relative w-full max-w-4xl bg-gradient-to-br from-gray-800/95 to-gray-900/95 rounded-2xl border-2 border-red-600/40 shadow-2xl shadow-red-900/50 p-6"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <button
                  type="button"
                  onClick={handleCloseVideoModal}
                  className="absolute -top-4 -right-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-2xl text-white transition shadow-lg z-10"
                >
                  ×
                </button>
                
                <div className="flex flex-col gap-4">
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-2">Mahsulot videosi</h3>
                  </div>

                  {/* Video player */}
                  {previewVideo.url ? (
                    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
                      <video
                        controls
                        autoPlay
                        className="w-full h-full"
                        src={previewVideo.url}
                      >
                        <source src={previewVideo.url} type="video/mp4" />
                        <source src={previewVideo.url} type="video/webm" />
                        <source src={previewVideo.url} type="video/ogg" />
                        Brauzeringiz video o'ynatishni qo'llab-quvvatlamaydi.
                      </video>
                    </div>
                  ) : (
                    <div className="w-full aspect-video bg-gray-900/60 rounded-xl border-2 border-dashed border-red-600/30 flex flex-col items-center justify-center gap-4 p-8">
                      <div className="w-20 h-20 rounded-full bg-red-900/30 flex items-center justify-center">
                        <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-400 mb-2">Video fayl nomi:</p>
                        <div className="bg-gray-900/60 border border-red-600/30 rounded-xl px-4 py-3 max-w-md mx-auto">
                          <p className="text-sm text-white font-mono break-all">{previewVideo.filename}</p>
                        </div>
                        {previewVideo.size && (
                          <p className="text-xs text-gray-400 mt-2">
                            Hajmi: {(previewVideo.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        )}
                        <p className="text-xs text-yellow-400 mt-4">
                          ⚠️ Video URL mavjud emas. Video faylni serverga yuklash kerak.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Video info */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-gray-900/60 border border-red-600/20 rounded-lg px-3 py-2">
                      <p className="text-gray-400 mb-1">Fayl nomi</p>
                      <p className="text-white font-medium truncate">{previewVideo.filename}</p>
                    </div>
                    {previewVideo.size && (
                      <div className="bg-gray-900/60 border border-red-600/20 rounded-lg px-3 py-2">
                        <p className="text-gray-400 mb-1">Hajmi</p>
                        <p className="text-white font-medium">{(previewVideo.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="w-full max-w-sm mx-4 rounded-2xl bg-card border border-destructive/60 shadow-2xl shadow-black/60 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-sm font-bold">
                    !
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-foreground mb-1">Mahsulotni o'chirish</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      "{deleteTarget.name}" mahsulotini o'chirishni rostdan ham xohlaysizmi? Bu amalni qaytarib bo'lmaydi.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => !isDeleting && setDeleteTarget(null)}
                        className="px-3 py-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground text-xs hover:bg-muted transition-all disabled:opacity-60"
                        disabled={isDeleting}
                      >
                        Bekor qilish
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDelete}
                        className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-all disabled:opacity-60"
                        disabled={isDeleting}
                      >
                        {isDeleting ? 'O\'chirilmoqda...' : 'Ha, o\'chirish'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {deleteConfirmOpen && categoryToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="w-full max-w-sm mx-4 rounded-2xl bg-card border border-destructive/60 shadow-2xl shadow-black/60 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-sm font-bold">
                    !
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-foreground mb-1">Kategoriyani o'chirish</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Ushbu kategoriyani o'chirishni rostdan ham xohlaysizmi? Bu amalni qaytarib bo'lmaydi.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirmOpen(false);
                          setCategoryToDelete(null);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground text-xs hover:bg-muted transition-all disabled:opacity-60"
                        disabled={createCategoryLoading}
                      >
                        Bekor qilish
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteCategory}
                        className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-all disabled:opacity-60"
                        disabled={createCategoryLoading}
                      >
                        {createCategoryLoading ? 'O\'chirilmoqda...' : 'Ha, o\'chirish'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
