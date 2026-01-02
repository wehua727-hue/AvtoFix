import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Package, Trash2, Edit, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';

interface Store {
  id: string;
  name: string;
}

interface StoreProduct {
  id: string;
  storeId: string;
  name: string;
  code: string;
  price: number;
  stock: number;
}

const formatMoney = (n: number) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm";

export default function StoreProducts() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<StoreProduct | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [productToEdit, setProductToEdit] = useState<StoreProduct | null>(null);
  
  // Form states
  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load store
    const savedStores = localStorage.getItem('stores');
    if (savedStores) {
      const stores: Store[] = JSON.parse(savedStores);
      const foundStore = stores.find(s => s.id === storeId);
      if (foundStore) {
        setStore(foundStore);
      } else {
        navigate('/');
      }
    } else {
      navigate('/');
    }

    // Load products
    const savedProducts = localStorage.getItem('storeProducts');
    if (savedProducts) {
      const allProducts: StoreProduct[] = JSON.parse(savedProducts);
      setProducts(allProducts.filter(p => p.storeId === storeId));
    }
  }, [storeId, navigate]);

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !productCode.trim() || !productPrice || !productStock) return;

    setIsLoading(true);

    const newProduct: StoreProduct = {
      id: Date.now().toString(),
      storeId: storeId!,
      name: productName.trim(),
      code: productCode.trim(),
      price: Number(productPrice),
      stock: Number(productStock),
    };

    // Get all products
    const savedProducts = localStorage.getItem('storeProducts');
    const allProducts: StoreProduct[] = savedProducts ? JSON.parse(savedProducts) : [];
    
    // Add new product
    allProducts.push(newProduct);
    localStorage.setItem('storeProducts', JSON.stringify(allProducts));

    // Update local state
    setProducts(allProducts.filter(p => p.storeId === storeId));

    // Reset form
    setProductName('');
    setProductCode('');
    setProductPrice('');
    setProductStock('');
    setShowAddForm(false);
    setIsLoading(false);
  };

  const handleDeleteClick = (product: StoreProduct) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (!productToDelete) return;

    const savedProducts = localStorage.getItem('storeProducts');
    if (savedProducts) {
      const allProducts: StoreProduct[] = JSON.parse(savedProducts);
      const filtered = allProducts.filter(p => p.id !== productToDelete.id);
      localStorage.setItem('storeProducts', JSON.stringify(filtered));
      setProducts(filtered.filter(p => p.storeId === storeId));
      
      // Show success toast
      toast.success(
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-red-500" />
          <span><strong>{productToDelete.name}</strong> o'chirildi</span>
        </div>
      );
    }

    setShowDeleteModal(false);
    setProductToDelete(null);
  };

  const handleEditClick = (product: StoreProduct) => {
    setProductToEdit(product);
    setProductName(product.name);
    setProductCode(product.code);
    setProductPrice(product.price.toString());
    setProductStock(product.stock.toString());
    setShowEditForm(true);
    setShowAddForm(false);
  };

  const handleUpdateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productToEdit || !productName.trim() || !productCode.trim() || !productPrice || !productStock) return;

    setIsLoading(true);

    const savedProducts = localStorage.getItem('storeProducts');
    if (savedProducts) {
      const allProducts: StoreProduct[] = JSON.parse(savedProducts);
      const updatedProducts = allProducts.map(p => 
        p.id === productToEdit.id 
          ? {
              ...p,
              name: productName.trim(),
              code: productCode.trim(),
              price: Number(productPrice),
              stock: Number(productStock),
            }
          : p
      );
      
      localStorage.setItem('storeProducts', JSON.stringify(updatedProducts));
      setProducts(updatedProducts.filter(p => p.storeId === storeId));

      // Show success toast
      toast.success(
        <div className="flex items-center gap-2">
          <Edit className="w-4 h-4 text-green-500" />
          <span><strong>{productName}</strong> tahrirlandi</span>
        </div>
      );
    }

    // Reset form
    setProductName('');
    setProductCode('');
    setProductPrice('');
    setProductStock('');
    setShowEditForm(false);
    setProductToEdit(null);
    setIsLoading(false);
  };

  // Filter products based on search query
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!store) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed} />

      <div className={`pt-12 sm:pt-14 lg:pt-16 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`}>
        {/* Header Section */}
        <div className="relative overflow-hidden bg-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 relative">
            <div className="rounded-lg border border-gray-700 bg-gray-900 px-5 sm:px-8 lg:px-10 py-8 lg:py-10">
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <div className="absolute inset-0 bg-red-600 rounded-2xl blur-lg opacity-60 group-hover:opacity-80 transition-opacity"></div>
                      <div className="relative bg-red-600 p-3 rounded-lg">
                        <Package className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <div>
                      <h1 className="text-3xl lg:text-4xl font-extrabold text-white">
                        {store.name}
                      </h1>
                      <p className="text-gray-400 mt-1">Magazin mahsulotlari</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white rounded-lg transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Orqaga</span>
                  </button>
                </div>
                
                <div className="h-1 w-32 bg-red-600"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">
                Mahsulotlar
              </h2>
              <span className="px-3 py-1 bg-red-600/20 border border-red-600/30 rounded-lg text-red-400 text-sm font-semibold">
                {filteredProducts.length} / {products.length} ta
              </span>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Mahsulot qo'shish
            </button>
          </div>

          {/* Search Bar */}
          {products.length > 0 && (
            <div className="mb-6">
              <div className="group relative flex items-center rounded-lg bg-gray-900 border border-gray-700 hover:border-gray-600 transition-all">
                <div className="pl-4 text-red-400 relative z-10">
                  <Search className="w-5 h-5 group-hover:text-red-300 transition" />
                </div>
                <input
                  type="text"
                  placeholder="Mahsulot nomi yoki kodi bo'yicha qidiring..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent px-3 py-3.5 text-white placeholder-gray-400 focus:outline-none relative z-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mr-3 px-3 py-1 text-sm text-gray-400 hover:text-white transition relative z-10"
                  >
                    Tozalash
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Edit Product Form */}
          {showEditForm && productToEdit && (
            <div className="mb-6 rounded-lg border border-gray-700 bg-gray-900 p-6">
              <h3 className="text-xl font-bold text-white mb-4">Mahsulotni tahrirlash</h3>
              <form onSubmit={handleUpdateProduct} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Mahsulot nomi</label>
                    <Input
                      type="text"
                      placeholder="Masalan: Coca Cola"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700/50 border border-red-600/20 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Mahsulot kodi</label>
                    <Input
                      type="text"
                      placeholder="Masalan: CC-001"
                      value={productCode}
                      onChange={(e) => setProductCode(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700/50 border border-red-600/20 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Narxi (so'm)</label>
                    <Input
                      type="number"
                      placeholder="15000"
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700/50 border border-red-600/20 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Ombor (dona)</label>
                    <Input
                      type="number"
                      placeholder="100"
                      value={productStock}
                      onChange={(e) => setProductStock(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700/50 border border-red-600/20 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600"
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={isLoading || !productName.trim() || !productCode.trim() || !productPrice || !productStock}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {isLoading ? 'Saqlanmoqda...' : 'Yangilash'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowEditForm(false);
                      setProductToEdit(null);
                      setProductName('');
                      setProductCode('');
                      setProductPrice('');
                      setProductStock('');
                    }}
                    className="px-6 bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 rounded-xl border border-gray-600 transition-all"
                    disabled={isLoading}
                  >
                    Bekor
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Add Product Form */}
          {showAddForm && !showEditForm && (
            <div className="mb-6 rounded-lg border border-gray-700 bg-gray-900 p-6">
              <h3 className="text-xl font-bold text-white mb-4">Yangi mahsulot</h3>
              <form onSubmit={handleAddProduct} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Mahsulot nomi</label>
                    <Input
                      type="text"
                      placeholder="Masalan: Coca Cola"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700/50 border border-red-600/20 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Mahsulot kodi</label>
                    <Input
                      type="text"
                      placeholder="Masalan: CC-001"
                      value={productCode}
                      onChange={(e) => setProductCode(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700/50 border border-red-600/20 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Narxi (so'm)</label>
                    <Input
                      type="number"
                      placeholder="15000"
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700/50 border border-red-600/20 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Ombor (dona)</label>
                    <Input
                      type="number"
                      placeholder="100"
                      value={productStock}
                      onChange={(e) => setProductStock(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700/50 border border-red-600/20 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600"
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={isLoading || !productName.trim() || !productCode.trim() || !productPrice || !productStock}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {isLoading ? 'Saqlanmoqda...' : 'Saqlash'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-6 bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 rounded-xl border border-gray-600 transition-all"
                    disabled={isLoading}
                  >
                    Bekor
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Products List */}
          {filteredProducts.length === 0 && products.length === 0 ? (
            <div className="text-center py-12 rounded-lg border border-gray-700 bg-gray-900">
              <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-4">Hali mahsulot qo'shilmagan</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 rounded-lg border border-gray-700 bg-gray-900">
              <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-2">Qidiruv natijasi topilmadi</p>
              <p className="text-gray-500 text-sm">"{searchQuery}" uchun mahsulot topilmadi</p>
            </div>
          ) : (
            <div className="rounded-lg overflow-hidden border border-gray-700 bg-gray-900">
              {filteredProducts.map((product, idx) => (
                <div
                  key={product.id}
                  className={`relative bg-gradient-to-r from-gray-800/60 via-gray-900/60 to-gray-800/60 hover:from-gray-700/80 hover:via-gray-800/80 hover:to-gray-700/80 transition-all px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-2 md:flex-row md:items-center md:gap-4 group overflow-hidden ${
                    idx !== 0 ? 'border-t-[3px] border-t-red-600/40' : ''
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600/0 via-red-600/10 to-red-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  
                  <button
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="flex-1 relative z-10 text-left"
                  >
                    <div className="text-white font-semibold text-lg mb-1 group-hover:text-red-400 transition">{product.name}</div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-400 text-xs sm:text-sm">
                      <span className="flex items-center gap-1">
                        <span className="text-red-400 text-xs">●</span>
                        Kod: <span className="text-gray-200">{product.code}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-red-400 text-xs">●</span>
                        Ombor: <span className="text-gray-200">{product.stock} ta</span>
                      </span>
                      <span className="bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent font-bold">
                        {formatMoney(product.price)}
                      </span>
                    </div>
                  </button>
                  
                  <div className="flex items-center gap-2 relative z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(product);
                      }}
                      className="p-2 rounded-lg hover:bg-blue-900/40 transition text-blue-400 hover:text-blue-300"
                      title="Tahrirlash"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(product);
                      }}
                      className="p-2 rounded-lg hover:bg-red-900/40 transition text-red-500 hover:text-red-400"
                      title="O'chirish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-gray-800/90 via-gray-900/90 to-gray-800/90 border border-red-600/30 rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-900/30 rounded-xl">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white">Mahsulotni o'chirish</h3>
            </div>
            
            <p className="text-gray-300 mb-6">
              Rostdan ham <strong className="text-white">{productToDelete.name}</strong> mahsulotini o'chirmoqchimisiz?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setProductToDelete(null);
                }}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl border border-gray-600 transition-all font-medium"
              >
                Yo'q
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-xl shadow-lg shadow-red-900/50 transition-all"
              >
                Ha, o'chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
