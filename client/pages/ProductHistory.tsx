import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  History,
  ArrowLeft,
  Package,
  Plus,
  Edit,
  Trash2,
  FileSpreadsheet,
  Clock,
  User,
  Tag,
  DollarSign,
  Loader2,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Sidebar from "@/components/Layout/Sidebar";
import Navbar from "@/components/Layout/Navbar";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

// Safe number formatting
const formatNum = (n: number | undefined | null): string => {
  if (n === undefined || n === null || isNaN(n)) return "0";
  return n.toLocaleString();
};

// Mahsulot qo'shish/tahrirlash tarixi
interface ProductHistoryItem {
  id: string;
  type: 'create' | 'update' | 'delete' | 'variant_create' | 'variant_update';
  productId: string;
  productName: string;
  sku: string;
  variantName?: string;
  stock: number;
  addedStock?: number;
  price: number;
  currency: string;
  timestamp: Date;
  message: string;
  source?: 'manual' | 'excel';
  variants?: Array<{
    name: string;
    sku?: string;
    stock: number;
    price: number;
    currency?: string;
  }>;
  changes?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
}

export default function ProductHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [productHistory, setProductHistory] = useState<ProductHistoryItem[]>([]);
  const [historyTab, setHistoryTab] = useState<'today' | 'past'>('today');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ProductHistoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  // API base URL
  const API_BASE_URL = (() => {
    if (typeof window === "undefined") return "";
    if (window.location.protocol === "file:") return "http://127.0.0.1:5175";
    const envApiUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
    if (envApiUrl && !envApiUrl.includes("YOUR_PUBLIC_IP")) {
      try {
        const u = new URL(envApiUrl);
        if (window.location.protocol === "https:" && u.protocol === "http:") {
          u.protocol = "https:";
        }
        return u.toString().replace(/\/$/, "");
      } catch {
        return envApiUrl;
      }
    }
    return "";
  })();

  // Load product history
  useEffect(() => {
    if (!user?.id) return;

    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/product-history?userId=${user.id}&limit=1000`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.history)) {
            const formattedHistory = data.history.map((item: any) => ({
              ...item,
              timestamp: new Date(item.timestamp || item.createdAt),
            }));
            setProductHistory(formattedHistory);
          }
        } else {
          console.error('Failed to load product history:', response.status);
        }
      } catch (error) {
        console.error('Error loading product history:', error);
        toast.error('Tarixni yuklashda xatolik');
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [user?.id, API_BASE_URL]);

  // Delete history item (only for owner)
  const deleteHistoryItem = useCallback(async (historyId: string) => {
    const isOwner = user?.role === 'egasi' || user?.role === 'owner' || user?.role === 'admin';
    if (!user?.id || !isOwner) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/product-history/${historyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        setProductHistory(prev => prev.filter(h => h.id !== historyId));
        toast.success('Tarix yozuvi o\'chirildi');
      } else {
        toast.error('O\'chirishda xatolik');
      }
    } catch (err) {
      console.error('Failed to delete history:', err);
      toast.error('O\'chirishda xatolik');
    }
  }, [user?.id, user?.role, API_BASE_URL]);

  // Filter history
  const filteredHistory = productHistory.filter((item) => {
    const itemDate = new Date(item.timestamp);
    itemDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Date filter
    const dateMatch = historyTab === 'today' 
      ? itemDate.getTime() === today.getTime()
      : itemDate.getTime() < today.getTime();

    if (!dateMatch) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatch = item.productName.toLowerCase().includes(query);
      const skuMatch = item.sku?.toLowerCase().includes(query);
      const variantMatch = item.variantName?.toLowerCase().includes(query);
      if (!nameMatch && !skuMatch && !variantMatch) return false;
    }

    // Type filter
    if (filterType !== 'all' && item.type !== filterType) return false;

    return true;
  });

  // Get action icon
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'create': return <Plus className="w-4 h-4 text-green-400" />;
      case 'update': return <Edit className="w-4 h-4 text-blue-400" />;
      case 'delete': return <Trash2 className="w-4 h-4 text-red-400" />;
      case 'variant_create': return <Plus className="w-4 h-4 text-purple-400" />;
      case 'variant_update': return <Edit className="w-4 h-4 text-purple-400" />;
      default: return <Package className="w-4 h-4 text-slate-400" />;
    }
  };

  // Get action color
  const getActionColor = (type: string) => {
    switch (type) {
      case 'create': return 'border-green-500/40 bg-green-900/20';
      case 'update': return 'border-blue-500/40 bg-blue-900/20';
      case 'delete': return 'border-red-500/40 bg-red-900/20';
      case 'variant_create': return 'border-purple-500/40 bg-purple-900/20';
      case 'variant_update': return 'border-purple-500/40 bg-purple-900/20';
      default: return 'border-slate-600/50 bg-slate-700/30';
    }
  };

  // Get action text
  const getActionText = (type: string) => {
    switch (type) {
      case 'create': return 'Qo\'shildi';
      case 'update': return 'Tahrirlandi';
      case 'delete': return 'O\'chirildi';
      case 'variant_create': return 'Xil qo\'shildi';
      case 'variant_update': return 'Xil tahrirlandi';
      default: return 'Noma\'lum';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900/80 dark:bg-gray-900/80 text-foreground">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onCollapsedChange={setSidebarCollapsed} />
      <Navbar
        onMenuClick={() => setSidebarOpen(true)}
        sidebarCollapsed={sidebarCollapsed}
        rightSlot={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate('/products')}
              variant="outline"
              className="flex items-center gap-2 bg-slate-800/80 border-slate-700/50 text-slate-300 hover:bg-slate-700/80"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Mahsulotlarga qaytish</span>
            </Button>
          </div>
        }
      />

      <div className={`pt-12 sm:pt-14 lg:pt-16 pb-4 transition-all duration-300 ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-72 xl:pl-80"}`}>
        <main className="p-4 lg:p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-500/10 border-2 border-blue-500/30">
                  <History className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Mahsulotlar tarixi</h1>
                  <p className="text-slate-400">
                    {productHistory.length} ta yozuv
                  </p>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Mahsulot nomi yoki SKU..."
                  className="pl-12 pr-4 py-3 bg-slate-800/50 border-slate-600/50 text-slate-200 placeholder-slate-400 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Type Filter */}
              <div className="relative">
                <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="pl-12 bg-slate-800/50 border-slate-600/50 text-slate-200 rounded-xl">
                    <SelectValue placeholder="Amal turi" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 rounded-xl">
                    <SelectItem value="all" className="text-slate-200">Barcha amallar</SelectItem>
                    <SelectItem value="create" className="text-slate-200">Qo'shilgan</SelectItem>
                    <SelectItem value="update" className="text-slate-200">Tahrirlangan</SelectItem>
                    <SelectItem value="delete" className="text-slate-200">O'chirilgan</SelectItem>
                    <SelectItem value="variant_create" className="text-slate-200">Xil qo'shilgan</SelectItem>
                    <SelectItem value="variant_update" className="text-slate-200">Xil tahrirlangan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Empty div for grid alignment */}
              <div></div>
            </div>

            {/* Date Filter Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => setHistoryTab("today")}
                className={`flex-1 py-3 rounded-xl text-base font-bold transition-all ${historyTab === "today"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
              >
                Bugun
              </Button>
              <Button
                onClick={() => setHistoryTab("past")}
                className={`flex-1 py-3 rounded-xl text-base font-bold transition-all ${historyTab === "past"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
              >
                O'tgan kunlar
              </Button>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 animate-spin text-slate-400 mb-4" />
              <span className="text-slate-400 font-medium">Tarix yuklanmoqda...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistory.length === 0 ? (
                <div className="text-center text-slate-500 py-16">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <h3 className="text-xl font-semibold mb-2">
                    {searchQuery || filterType !== 'all' ? "Topilmadi" : historyTab === "today" ? "Bugun amallar yo'q" : "O'tgan kunlarda amallar yo'q"}
                  </h3>
                  <p className="text-slate-400">
                    {searchQuery || filterType !== 'all' ? "Qidiruv shartlariga mos yozuv topilmadi" : "Mahsulotlar bilan ishlashni boshlang"}
                  </p>
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 border rounded-xl transition-all hover:scale-[1.01] cursor-pointer ${getActionColor(item.type)}`}
                    onClick={() => setSelectedHistoryItem(item)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Action Icon */}
                      <div className="p-2 rounded-lg bg-slate-800/50 flex-shrink-0">
                        {getActionIcon(item.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-slate-200">{getActionText(item.type)}</span>
                          {item.source === 'excel' && (
                            <span className="px-2 py-0.5 text-xs bg-green-600/20 text-green-400 rounded-full font-medium flex items-center gap-1">
                              <FileSpreadsheet className="w-3 h-3" />
                              Excel
                            </span>
                          )}
                          <span className="text-slate-400 text-sm flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(item.timestamp).toLocaleString("uz-UZ")}
                          </span>
                        </div>

                        <div className="mb-2">
                          <div className="text-white font-medium">{item.productName}</div>
                          {item.variantName && (
                            <div className="text-purple-300 text-sm">Xil: {item.variantName}</div>
                          )}
                          <div className="text-slate-400 text-sm flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              SKU: {item.sku}
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              {item.stock} dona
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {formatNum(item.price)} {item.currency}
                            </span>
                          </div>
                        </div>

                        <div className="text-slate-300 text-sm">{item.message}</div>

                        {/* Changes */}
                        {item.changes && item.changes.length > 0 && (
                          <div className="mt-2 text-xs text-slate-400">
                            O'zgarishlar: {item.changes.map(c => c.field).join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {(user?.role === 'egasi' || user?.role === 'owner' || user?.role === 'admin') && (
                        <div className="flex-shrink-0">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteHistoryItem(item.id);
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>

      {/* History Detail Dialog */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-800/50">
                    {getActionIcon(selectedHistoryItem.type)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{getActionText(selectedHistoryItem.type)}</h3>
                    <p className="text-slate-400 text-sm">{selectedHistoryItem.productName}</p>
                  </div>
                </div>
                <Button
                  onClick={() => setSelectedHistoryItem(null)}
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-slate-300"
                >
                  ✕
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider">Mahsulot nomi</label>
                    <div className="text-white font-medium">{selectedHistoryItem.productName}</div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider">SKU</label>
                    <div className="text-white font-medium">{selectedHistoryItem.sku}</div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider">Sana</label>
                    <div className="text-white font-medium">{new Date(selectedHistoryItem.timestamp).toLocaleString("uz-UZ")}</div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider">Manba</label>
                    <div className="text-white font-medium flex items-center gap-2">
                      {selectedHistoryItem.source === 'excel' ? (
                        <>
                          <FileSpreadsheet className="w-4 h-4 text-green-400" />
                          Excel
                        </>
                      ) : (
                        <>
                          <User className="w-4 h-4 text-blue-400" />
                          Qo'lda
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Variant Info */}
                {selectedHistoryItem.variantName && (
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider">Xil nomi</label>
                    <div className="text-purple-300 font-medium">{selectedHistoryItem.variantName}</div>
                  </div>
                )}

                {/* Message */}
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Tavsif</label>
                  <div className="text-white">{selectedHistoryItem.message}</div>
                </div>

                {/* Changes */}
                {selectedHistoryItem.changes && selectedHistoryItem.changes.length > 0 && (
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider">O'zgarishlar</label>
                    <div className="space-y-2 mt-2">
                      {selectedHistoryItem.changes.map((change, index) => (
                        <div key={index} className="p-3 bg-slate-800/50 rounded-lg">
                          <div className="text-sm font-medium text-slate-300 mb-1">{change.field}</div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-red-400">Eski: {String(change.oldValue)}</span>
                            <span className="text-slate-500">→</span>
                            <span className="text-green-400">Yangi: {String(change.newValue)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Variants */}
                {selectedHistoryItem.variants && selectedHistoryItem.variants.length > 0 && (
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider">Xillar</label>
                    <div className="space-y-2 mt-2">
                      {selectedHistoryItem.variants.map((variant, index) => (
                        <div key={index} className="p-3 bg-slate-800/50 rounded-lg">
                          <div className="text-sm font-medium text-white">{variant.name}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            SKU: {variant.sku} • {variant.stock} dona • {formatNum(variant.price)} {variant.currency}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}