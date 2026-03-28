import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';
import { useAuth } from '@/lib/auth-context';

interface Store {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  storeId: string;
  parentId?: string | null;
  level?: number;
  order?: number;
  isActive?: boolean;
  slug?: string;
  markupPercentage?: number; // 🆕 Ustama foiz
}

export default function AddCategory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categoryName, setCategoryName] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedParent, setSelectedParent] = useState<Category | null>(null);
  const [inlineName, setInlineName] = useState('');
  const [inlineLoading, setInlineLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    
    const savedStores = localStorage.getItem('stores');
    if (savedStores) {
      try {
        setStores(JSON.parse(savedStores));
      } catch (error) {
        console.error('Failed to load stores:', error);
      }
    }

    // Load categories from backend (MongoDB) with userId filter
    const params = new URLSearchParams({ userId: user.id });
    if (user.phone) {
      params.append('userPhone', user.phone);
    }
    
    fetch(`/api/categories?${params}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.categories)) {
          setCategories(data.categories as Category[]);
        }
      })
      .catch((err) => {
        console.error('Failed to load categories from API:', err);
      });
  }, [user?.id, user?.phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim() || !selectedStoreId || !user?.id) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: categoryName.trim(),
          storeId: selectedStoreId,
          userId: user.id,
        }),
      });

      if (!res.ok) {
        console.error('Failed to create category');
        return;
      }

      const data = await res.json();
      if (data?.success && data.category) {
        setCategories((prev) => [...prev, data.category as Category]);
        setCategoryName('');
        setSelectedStoreId('');
        setShowForm(false);
      }
    } catch (err) {
      console.error('Error creating category:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;

    setEditLoading(true);
    try {
      console.log('[handleSaveEdit] Updating category:', editingId, 'with name:', name);
      const res = await fetch(`/api/categories/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      console.log('[handleSaveEdit] Response status:', res.status);
      const data = await res.json();
      console.log('[handleSaveEdit] Response data:', data);

      if (!res.ok) {
        console.error('Failed to update category:', data);
        alert(`Xatolik: ${data?.message || 'Kategoriyani yangilab bo\'lmadi'}`);
        return;
      }

      if (data?.success && data.category) {
        setCategories((prev) =>
          prev.map((c) => (c.id === data.category.id ? (data.category as Category) : c)),
        );
        setEditingId(null);
        setEditingName('');
        console.log('[handleSaveEdit] Category updated successfully');
      } else {
        console.error('[handleSaveEdit] Unexpected response format:', data);
        alert('Kategoriya yangilandi, lekin javob formati kutilmagan');
      }
    } catch (err) {
      console.error('Error updating category:', err);
      alert(`Xatolik yuz berdi: ${err instanceof Error ? err.message : 'Noma\'lum xatolik'}`);
    } finally {
      setEditLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      console.log('[handleConfirmDelete] Deleting category:', deleteId);
      const res = await fetch(`/api/categories/${deleteId}`, {
        method: 'DELETE',
      });
      
      console.log('[handleConfirmDelete] Response status:', res.status);
      const data = await res.json();
      console.log('[handleConfirmDelete] Response data:', data);

      if (!res.ok) {
        console.error('Failed to delete category:', data);
        alert(`Xatolik: ${data?.message || 'Kategoriyani o\'chirib bo\'lmadi'}`);
        return;
      }

      if (data?.success) {
        setCategories((prev) => prev.filter((c) => c.id !== deleteId));
        setDeleteId(null);
        if (selectedParent && selectedParent.id === deleteId) {
          setSelectedParent(null);
        }
        console.log('[handleConfirmDelete] Category deleted successfully');
      } else {
        console.error('[handleConfirmDelete] Unexpected response format:', data);
        alert('Kategoriya o\'chirildi, lekin javob formati kutilmagan');
      }
    } catch (err) {
      console.error('Error deleting category:', err);
      alert(`Xatolik yuz berdi: ${err instanceof Error ? err.message : 'Noma\'lum xatolik'}`);
    }
  };

  const handleInlineCreate = async () => {
    const name = inlineName.trim();
    if (!name || !user?.id) return;

    setInlineLoading(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          selectedParent
            ? {
                name,
                parentId: selectedParent.id,
                level: (selectedParent.level ?? 0) + 1,
                userId: user.id,
              }
            : {
                name,
                parentId: null,
                level: 0,
                userId: user.id,
              }
        ),
      });

      if (!res.ok) {
        console.error('Failed to create inner category');
        return;
      }

      const data = await res.json();
      if (data?.success && data.category) {
        setCategories((prev) => [...prev, data.category as Category]);
        setInlineName('');
      }
    } catch (err) {
      console.error('Error creating inner category:', err);
    } finally {
      setInlineLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />
      <Navbar 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)} 
        sidebarCollapsed={sidebarCollapsed}
        rightSlot={
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-600/30 text-sm font-medium text-white bg-gray-800/50 hover:bg-gray-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Orqaga
          </button>
        }
      />

      {/* Main Content */}
      <div
        className={`pt-12 sm:pt-14 lg:pt-16 pb-12 px-4 sm:px-6 lg:px-8 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'
        }`}
      >
        <div className="max-w-4xl mx-auto mt-8">

          {/* Hierarchical categories list */}
          <div className="bg-gray-900/80 rounded-xl border border-red-600/20 p-4 sm:p-6">
            {/* Breadcrumb + title for selected parent */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-600/20 border border-red-600/30">
                  <Layers className="w-5 h-5 text-red-400" />
                </div>
                {selectedParent ? (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span className="text-gray-500">Kategoriyalar</span>
                      <span className="text-red-400">/</span>
                      <span className="text-white font-medium">{selectedParent.name}</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-white font-medium">Barcha kategoriyalar</span>
                )}
              </div>

              {selectedParent && (
                <button
                  type="button"
                  onClick={() => setSelectedParent(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-600/30 text-sm text-gray-300 hover:bg-red-600/10 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Ortga
                </button>
              )}
            </div>

            {categories.length === 0 ? (
              <div className="space-y-3">
                <p className="text-gray-400 text-sm">
                  Hali kategoriya qo&apos;shilmagan.
                </p>

                {/* Yangi root kategoriya uchun inline input – kategoriyalar bo'lmasa ham ko'rinadi */}
                <div className="w-full mt-1 rounded-xl border border-dashed border-gray-600 bg-gray-900/60 px-4 py-3 flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      type="text"
                      placeholder="Katta kategoriya nomi"
                      value={inlineName}
                      onChange={(e) => setInlineName(e.target.value)}
                      className="flex-1 bg-gray-800/80 border border-gray-600/70 text-xs sm:text-sm"
                      disabled={inlineLoading}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 px-3 text-xs bg-gray-800/60 hover:bg-gray-700/80 text-gray-300"
                        disabled={inlineLoading}
                        onClick={() => {
                          setInlineName('');
                        }}
                      >
                        Bekor qilish
                      </Button>
                      <Button
                        type="button"
                        className="h-9 px-3 text-xs bg-red-600 hover:bg-red-700 text-white"
                        disabled={inlineLoading || !inlineName.trim()}
                        onClick={handleInlineCreate}
                      >
                        {inlineLoading ? 'Saqlanmoqda...' : "+ Saqlash"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {(selectedParent
                  ? categories.filter((c) => c.parentId === selectedParent.id)
                  : categories.filter((c) => !c.parentId)
                ).map((cat) => {
                  const isEditing = editingId === cat.id;
                  
                  return (
                    <div
                      key={cat.id}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-900/80 border border-gray-700/70 hover:border-red-500/60 hover:bg-gray-900 transition text-left group"
                    >
                      <button
                        type="button"
                        onClick={() => !isEditing && setSelectedParent(cat)}
                        className="flex-1 flex flex-col text-left"
                        disabled={isEditing}
                      >
                        {isEditing ? (
                          <Input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="bg-gray-800/80 border border-gray-600/70 text-xs sm:text-sm"
                            disabled={editLoading}
                          />
                        ) : (
                          <span className="text-sm sm:text-base font-medium text-gray-100 group-hover:text-red-300">
                            {cat.name}
                          </span>
                        )}
                      </button>
                      <div className="flex items-center gap-2 ml-3">
                        {isEditing ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 px-3 text-xs bg-gray-800/60 hover:bg-gray-700/80 text-gray-300"
                              disabled={editLoading}
                              onClick={handleCancelEdit}
                            >
                              Bekor
                            </Button>
                            <Button
                              type="button"
                              className="h-8 px-3 text-xs bg-red-600 hover:bg-red-700 text-white"
                              disabled={editLoading || !editingName.trim()}
                              onClick={handleSaveEdit}
                            >
                              {editLoading ? 'Saqlanmoqda...' : 'Saqlash'}
                            </Button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="p-2 rounded-full bg-yellow-500/10 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/20 transition"
                              onClick={() => handleStartEdit(cat)}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="p-2 rounded-full bg-red-900/10 border border-red-600/50 text-red-400 hover:bg-red-900/30 transition"
                              onClick={() => setDeleteId(cat.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Inline add row */}
                {selectedParent ? (
                  <div className="w-full mt-3 rounded-xl border border-dashed border-gray-600 bg-gray-900/60 px-4 py-3 flex flex-col gap-2">
                    <div className="text-xs text-gray-400 mb-1">
                      {selectedParent.name} ichida yangi kategoriya
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        type="text"
                        placeholder="Ichki kategoriya nomi"
                        value={inlineName}
                        onChange={(e) => setInlineName(e.target.value)}
                        className="flex-1 bg-gray-800/80 border border-gray-600/70 text-xs sm:text-sm"
                        disabled={inlineLoading}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 px-3 text-xs bg-gray-800/60 hover:bg-gray-700/80 text-gray-300"
                          disabled={inlineLoading}
                          onClick={() => {
                            setInlineName('');
                          }}
                        >
                          Bekor qilish
                        </Button>
                        <Button
                          type="button"
                          className="h-9 px-3 text-xs bg-red-600 hover:bg-red-700 text-white"
                          disabled={inlineLoading || !inlineName.trim()}
                          onClick={handleInlineCreate}
                        >
                          {inlineLoading ? 'Saqlanmoqda...' : "+ Saqlash"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full mt-3 rounded-xl border border-dashed border-gray-600 bg-gray-900/60 px-4 py-3 flex flex-col gap-2">
                    <div className="text-xs text-gray-400 mb-1">
                      Yangi root kategoriya
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        type="text"
                        placeholder="Katta kategoriya nomi"
                        value={inlineName}
                        onChange={(e) => setInlineName(e.target.value)}
                        className="flex-1 bg-gray-800/80 border border-gray-600/70 text-xs sm:text-sm"
                        disabled={inlineLoading}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 px-3 text-xs bg-gray-800/60 hover:bg-gray-700/80 text-gray-300"
                          disabled={inlineLoading}
                          onClick={() => {
                            setInlineName('');
                          }}
                        >
                          Bekor qilish
                        </Button>
                        <Button
                          type="button"
                          className="h-9 px-3 text-xs bg-red-600 hover:bg-red-700 text-white"
                          disabled={inlineLoading || !inlineName.trim()}
                          onClick={handleInlineCreate}
                        >
                          {inlineLoading ? 'Saqlanmoqda...' : "+ Saqlash"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Delete confirm modal */}
            {deleteId && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
                <div className="bg-gray-900/95 border border-red-600/50 rounded-2xl px-6 py-5 shadow-2xl max-w-sm w-full mx-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Kategoriyani o'chirish?</h3>
                  <p className="text-sm text-gray-300 mb-4">
                    Ushbu kategoriyani o'chirishni xohlaysizmi? Bu amalni qaytarib bo'lmaydi.
                  </p>
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-4 py-2 h-9 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm"
                      onClick={() => setDeleteId(null)}
                    >
                      Bekor qilish
                    </Button>
                    <Button
                      type="button"
                      className="px-4 py-2 h-9 bg-red-600 hover:bg-red-700 text-white text-sm"
                      onClick={handleConfirmDelete}
                    >
                      Ha, o'chirish
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Form Card */}
            {showForm && (
              <div className="relative bg-gradient-to-br from-gray-800/90 via-gray-900/90 to-gray-800/90 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-red-900/20 p-8 border border-red-600/30 overflow-hidden">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-red-600/0 via-red-600/20 to-red-600/0 opacity-50"></div>

                <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
                  {/* Store Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-3">
                      Magazin tanlang
                    </label>
                    {stores.length === 0 ? (
                      <div className="bg-red-900/20 border border-red-600/30 rounded-xl p-4 text-center">
                        <p className="text-gray-400 mb-3">Hali magazin qo'shilmagan</p>
                        <Button
                          type="button"
                          onClick={() => navigate('/add-store')}
                          className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-2 rounded-lg"
                        >
                          Magazin qo'shish
                        </Button>
                      </div>
                    ) : (
                      <select
                        value={selectedStoreId}
                        onChange={(e) => setSelectedStoreId(e.target.value)}
                        className="w-full px-4 py-3.5 bg-gray-700/50 border border-red-600/20 hover:border-red-500/40 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 transition-all text-lg"
                        disabled={isLoading}
                      >
                        <option value="">-- Magazin tanlang --</option>
                        {stores.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Category Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-3">
                      Kategoriya nomi
                    </label>
                    <Input
                      type="text"
                      placeholder="Masalan: Ichimliklar"
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      className="w-full px-4 py-3.5 bg-gray-700/50 border border-red-600/20 hover:border-red-500/40 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 transition-all text-lg"
                      disabled={isLoading || stores.length === 0}
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setCategoryName('');
                        setSelectedStoreId('');
                      }}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-3.5 rounded-xl border border-gray-600 transition-all"
                      disabled={isLoading}
                    >
                      Bekor qilish
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading || !categoryName.trim() || !selectedStoreId || stores.length === 0}
                      className="relative flex-1 bg-gradient-to-r from-red-600 via-red-700 to-red-600 hover:from-red-700 hover:via-red-800 hover:to-red-700 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-red-900/50 hover:shadow-red-800/60 transition-all disabled:opacity-50 overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-red-600/0 via-white/20 to-red-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        <Plus className="w-5 h-5" />
                        {isLoading ? 'Saqlanmoqda...' : 'Saqlash'}
                      </span>
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}