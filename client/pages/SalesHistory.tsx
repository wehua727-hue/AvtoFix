import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  History,
  Printer,
  Banknote,
  Smartphone,
  Wallet,
  Trash2,
  RotateCcw,
  CloudOff,
  ArrowLeft,
  CreditCard,
  Truck,
  ShoppingCart,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Sidebar from "@/components/Layout/Sidebar";
import Navbar from "@/components/Layout/Navbar";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { offlineDB, generateUUID } from "@/db/offlineDB";
import { printReceipt, ReceiptData } from "@/lib/pos-print";

// Safe number formatting
const formatNum = (n: number | undefined | null): string => {
  if (n === undefined || n === null || isNaN(n)) return "0";
  return n.toLocaleString();
};

interface SaleHistoryItem {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  price: number;
  quantity: number;
  discount: number;
}

interface SaleHistory {
  id: string;
  items: SaleHistoryItem[];
  total: number;
  date: Date;
  paymentType?: string;
  type?: "sale" | "refund";
  synced?: boolean;
}

export default function SalesHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id || "";

  // State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [salesHistory, setSalesHistory] = useState<SaleHistory[]>([]);
  const [selectedSale, setSelectedSale] = useState<SaleHistory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"today" | "past">("today");
  const [clearHistoryConfirmOpen, setClearHistoryConfirmOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Do'kon ma'lumotlari (chek uchun)
  const storeInfo = {
    storeName: user?.role === 'admin'
      ? `${user?.name || 'Admin'} do'koni`
      : user?.name
        ? `AVTOFIX - ${user.name}`
        : "AVTOFIX - Avto ehtiyot qismlari do'koni",
    storeAddress: user?.address || "",
    storePhone: user?.phone || "",
  };

  // Load sales history
  useEffect(() => {
    if (!userId) return;

    const loadLocalData = async () => {
      setIsLoading(true);
      try {
        // 1. AVVAL serverdan tarixni olish (MongoDB)
        try {
          const apiBase = window.location.protocol === 'file:'
            ? 'http://127.0.0.1:5174'
            : (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '');

          const response = await fetch(`${apiBase}/api/sales/offline?userId=${encodeURIComponent(userId)}&limit=1000`);

          if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.sales)) {
              // Server dan kelgan tarixni formatlash
              const serverHistory = data.sales.map((s: any) => ({
                id: s._id || s.offlineId || s.id,
                items: (s.items || []).map((item: any) => ({
                  id: generateUUID(),
                  productId: item.productId,
                  name: item.name,
                  sku: item.sku,
                  quantity: item.quantity,
                  price: item.price,
                  discount: item.discount || 0,
                })),
                total: s.total,
                date: new Date(s.offlineCreatedAt || s.createdAt),
                paymentType: s.paymentType,
                type: s.saleType || 'sale',
                synced: true, // Server dan kelgan - sinxronlangan
              }));

              // 2. IndexedDB dan sinxronlanmagan savdolarni qo'shish
              const localSales = await offlineDB.offlineSales
                .where("userId").equals(userId)
                .filter(s => s.synced === false)
                .reverse()
                .sortBy("createdAt");

              const localHistory = localSales.map((s) => ({
                id: s.id,
                items: s.items.map((item) => ({
                  id: generateUUID(),
                  productId: item.productId,
                  name: item.name,
                  sku: item.sku,
                  quantity: item.quantity,
                  price: item.price,
                  discount: item.discount,
                })),
                total: s.total,
                date: new Date(s.createdAt),
                paymentType: s.paymentType,
                type: s.saleType,
                synced: false, // Hali sinxronlanmagan
              }));

              // Birlashtirilgan tarix (local + server)
              const combinedHistory = [...localHistory, ...serverHistory];

              // Sanasi bo'yicha tartiblash (eng yangi birinchi)
              combinedHistory.sort((a, b) => b.date.getTime() - a.date.getTime());

              setSalesHistory(combinedHistory.slice(0, 1000));
              setIsLoading(false);
              return;
            }
          }
        } catch (serverError) {
          console.error('Server error:', serverError);
        }

        // 3. Server xato bersa, faqat IndexedDB dan olish (fallback)
        const sales = await offlineDB.offlineSales.where("userId").equals(userId).reverse().sortBy("createdAt");
        setSalesHistory(
          sales.slice(0, 1000).map((s) => ({
            id: s.id,
            items: s.items.map((item) => ({
              id: generateUUID(),
              productId: item.productId,
              name: item.name,
              sku: item.sku,
              quantity: item.quantity,
              price: item.price,
              discount: item.discount,
            })),
            total: s.total,
            date: new Date(s.createdAt),
            paymentType: s.paymentType,
            type: s.saleType,
            synced: s.synced,
          }))
        );
      } catch (err) {
        console.error('Failed to load sales history:', err);
        toast.error('Tarixni yuklashda xatolik');
      } finally {
        setIsLoading(false);
      }
    };
    loadLocalData();
  }, [userId]);

  // Clear history function - only for owner role
  const clearHistory = useCallback(
    async () => {
      try {
        // Clear local state immediately
        setSalesHistory([]);
        setClearHistoryConfirmOpen(false);

        // Show success toast
        toast.success("Tarix tozalandi");

        // Clear IndexedDB in background (fire and forget)
        offlineDB.offlineSales
          .where("userId")
          .equals(userId)
          .delete()
          .then(() => console.log("IndexedDB cleared successfully"))
          .catch(err => console.error("Failed to clear IndexedDB:", err));

        // Try to clear server-side history (fire and forget)
        try {
          const apiBase = window.location.protocol === 'file:'
            ? 'http://127.0.0.1:5174'
            : (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '');

          fetch(`${apiBase}/api/sales/clear-history?userId=${encodeURIComponent(userId)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
          })
            .then(res => console.log("Server response:", res.status))
            .catch(err => console.error("Failed to clear server history:", err));
        } catch (serverError) {
          console.error("Server error:", serverError);
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Tarix tozalashda xatolik yuz berdi");
      }
    },
    [userId]
  );

  // Sana qidiruv filtri
  const matchesSearchDate = (saleDate: Date, searchText: string) => {
    if (!searchText.trim()) return true;

    const year = saleDate.getFullYear();
    const month = String(saleDate.getMonth() + 1).padStart(2, '0');
    const day = String(saleDate.getDate()).padStart(2, '0');
    const saleDateStr = `${year}-${month}-${day}`;

    const searchTrimmed = searchText.trim();
    return saleDateStr.startsWith(searchTrimmed);
  };

  // Filtrlangan tarix
  const filteredHistory = salesHistory.filter((sale) => {
    const saleDate = new Date(sale.date);
    saleDate.setHours(0, 0, 0, 0);

    // Sana qidiruv filtri
    if (searchQuery && !matchesSearchDate(saleDate, searchQuery)) {
      return false;
    }

    // Agar qidiruv bo'lsa, bugun/o'tgan filtrini e'tiborsiz qoldirish
    if (searchQuery) {
      return true;
    }

    if (historyFilter === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return saleDate.getTime() === today.getTime();
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return saleDate.getTime() < today.getTime();
    }
  });

  const pendingSalesCount = salesHistory.filter(s => !s.synced).length;

  return (
    <div className="min-h-screen bg-gray-900/80 dark:bg-gray-900/80 text-foreground">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onCollapsedChange={setSidebarCollapsed} />
      <Navbar
        onMenuClick={() => setSidebarOpen(true)}
        sidebarCollapsed={sidebarCollapsed}
        rightSlot={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate('/kassa')}
              variant="outline"
              className="flex items-center gap-2 bg-slate-800/80 border-slate-700/50 text-slate-300 hover:bg-slate-700/80"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Kassaga qaytish</span>
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
                <div className="p-3 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30">
                  <History className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Sotuvlar tarixi</h1>
                  <p className="text-slate-400">
                    {salesHistory.length} ta yozuv
                    {pendingSalesCount > 0 && (
                      <span className="ml-2 text-amber-400">• {pendingSalesCount} ta sinxronlanmagan</span>
                    )}
                  </p>
                </div>
              </div>
              {user?.role === 'egasi' && (
                <Button
                  onClick={() => setClearHistoryConfirmOpen(true)}
                  variant="outline"
                  className="flex items-center gap-2 border-red-500/30 text-red-400 hover:bg-red-600/20"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Tozalash</span>
                </Button>
              )}
            </div>

            {/* Search Input */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Sana bo'yicha qidirish (yyyy-mm-dd)..."
                  className="pl-12 pr-4 py-3 bg-slate-800/50 border-slate-600/50 text-slate-200 placeholder-slate-400 rounded-xl focus:border-emerald-500/50 focus:ring-emerald-500/20"
                  value={searchQuery}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9-]/g, '');
                    setSearchQuery(value);
                  }}
                  maxLength={10}
                />
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => setHistoryFilter("today")}
                className={`flex-1 py-3 rounded-xl text-base font-bold transition-all ${historyFilter === "today"
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
              >
                Bugun
              </Button>
              <Button
                onClick={() => setHistoryFilter("past")}
                className={`flex-1 py-3 rounded-xl text-base font-bold transition-all ${historyFilter === "past"
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
            <div className="space-y-6">
              {(() => {
                if (filteredHistory.length === 0) {
                  return (
                    <div className="text-center text-slate-500 py-16">
                      <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <h3 className="text-xl font-semibold mb-2">
                        {searchQuery ? "Topilmadi" : historyFilter === "today" ? "Bugun sotuvlar yo'q" : "O'tgan kunlarda sotuvlar yo'q"}
                      </h3>
                      <p className="text-slate-400">
                        {searchQuery ? `"${searchQuery}" sanasida sotuvlar topilmadi` : historyFilter === "today" ? "Birinchi sotuvni amalga oshiring" : "Boshqa sanani tanlang"}
                      </p>
                    </div>
                  );
                }

                // Sanalar bo'yicha guruhlash
                const grouped: Record<string, SaleHistory[]> = {};
                filteredHistory.forEach((sale) => {
                  const saleDate = new Date(sale.date);
                  const year = saleDate.getFullYear();
                  const month = String(saleDate.getMonth() + 1).padStart(2, '0');
                  const day = String(saleDate.getDate()).padStart(2, '0');
                  const dateKey = `${year}-${month}-${day}`;

                  if (!grouped[dateKey]) grouped[dateKey] = [];
                  grouped[dateKey].push(sale);
                });

                return Object.entries(grouped).map(([dateKey, sales]) => (
                  <div key={dateKey} className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="text-2xl font-bold text-slate-200">{dateKey}</div>
                      <div className="flex-1 h-px bg-gradient-to-r from-slate-600/50 to-transparent" />
                      <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-medium">
                        {sales.length} ta sotuv
                      </div>
                    </div>
                    <div className="space-y-3">
                      {sales.map((sale, idx) => {
                        const PaymentIcon = sale.paymentType === "Naqd" ? Banknote : sale.paymentType === "Karta" ? CreditCard : sale.paymentType === "O'tkazma" ? Smartphone : Wallet;
                        const isRefund = sale.type === "refund";
                        const productNames = sale.items.map(item => item.name);
                        const displayNames = productNames.slice(0, 2).join(", ");
                        const moreCount = productNames.length > 2 ? productNames.length - 2 : 0;

                        return (
                          <div
                            key={sale.id}
                            className={`p-4 border rounded-xl cursor-pointer transition-all hover:scale-[1.02] ${isRefund
                                ? "border-red-500/40 bg-red-900/20 hover:bg-red-800/30 hover:border-red-400/60"
                                : "border-slate-600/50 bg-slate-700/30 hover:bg-slate-600/50 hover:border-slate-500/60"
                              }`}
                            onClick={() => setSelectedSale(sale)}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-xl flex-shrink-0 ${isRefund ? "bg-red-500/20" : "bg-emerald-500/20"}`}>
                                <Truck className={`w-6 h-6 ${isRefund ? "text-red-400" : "text-emerald-400"}`} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {isRefund && <RotateCcw className="w-4 h-4 text-red-400" />}
                                  <span className={`font-bold ${isRefund ? "text-red-400" : "text-slate-200"}`}>
                                    #{idx + 1}
                                  </span>
                                  <span className="text-slate-400 text-sm">
                                    {new Date(sale.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                  <PaymentIcon className={`w-4 h-4 ${isRefund ? "text-red-400" : "text-slate-400"}`} />
                                  {!sale.synced && <CloudOff className="w-4 h-4 text-amber-500" title="Sinxronlanmagan" />}
                                </div>

                                <div className={`text-sm font-medium truncate ${isRefund ? "text-red-300" : "text-slate-300"}`}>
                                  {displayNames}
                                  {moreCount > 0 && <span className="text-slate-500 ml-1">+{moreCount} ta</span>}
                                </div>
                              </div>

                              <div className="flex-shrink-0">
                                <span className={`text-xl font-black ${isRefund ? "text-red-500" : "text-emerald-500"}`}>
                                  {isRefund ? "-" : ""}{formatNum(sale.total)}
                                  <span className="text-sm ml-1 opacity-70">so'm</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </main>
      </div>

      {/* Sale Detail Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 bg-slate-900 border-slate-700 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-8 py-6 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-xl ${selectedSale?.type === "refund" ? "bg-red-500/10 border-2 border-red-500/30" : "bg-green-500/10 border-2 border-green-500/30"}`}>
                  {selectedSale?.type === "refund" ? (
                    <RotateCcw className="w-8 h-8 text-red-400" />
                  ) : (
                    <ShoppingCart className="w-8 h-8 text-green-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {selectedSale?.type === "refund" ? "Qaytarish Cheki" : "Sotuv Cheki"}
                  </h2>
                  <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                    <span>{selectedSale && new Date(selectedSale.date).toLocaleDateString("uz-UZ")}</span>
                    <span>•</span>
                    <span>{selectedSale && new Date(selectedSale.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                    {selectedSale && !selectedSale.synced && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-amber-400">
                          <CloudOff className="w-3 h-3" />
                          Offline
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {selectedSale && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-8">
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                  <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
                    <div className="grid grid-cols-[3fr_1fr_1.5fr_1.5fr] gap-4 text-xs font-semibold text-slate-400 uppercase">
                      <div>Mahsulot</div>
                      <div className="text-center">Soni</div>
                      <div className="text-right">Narxi</div>
                      <div className="text-right">Summa</div>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-700/50">
                    {selectedSale.items.map((item, i) => {
                      const itemTotal = (item.quantity || 0) * (item.price || 0);
                      return (
                        <div key={i} className="px-6 py-4 hover:bg-slate-700/30 transition-colors">
                          <div className="grid grid-cols-[3fr_1fr_1.5fr_1.5fr] gap-4 items-center">
                            <div>
                              <div className="text-white font-medium">{item.name}</div>
                              {item.sku && <div className="text-xs text-slate-500 mt-1">SKU: {item.sku}</div>}
                            </div>
                            <div className="text-center">
                              <span className="inline-block px-3 py-1 bg-slate-700 rounded-lg text-white font-semibold">
                                {item.quantity}
                              </span>
                            </div>
                            <div className="text-right text-slate-300 font-medium">
                              {formatNum(item.price || 0)}
                            </div>
                            <div className="text-right text-white font-semibold">
                              {formatNum(itemTotal)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-slate-800 px-6 py-5 border-t-2 border-slate-700">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-slate-300">JAMI:</span>
                      <span className={`text-3xl font-bold ${selectedSale.type === "refund" ? "text-red-400" : "text-green-400"}`}>
                        {selectedSale.type === "refund" ? "-" : ""}${formatNum(selectedSale.total)}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      To'lov turi: <span className="text-white font-medium">{selectedSale.paymentType || "Naqd"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="px-8 py-6 bg-slate-800 border-t border-slate-700 flex-shrink-0">
            <Button
              className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-semibold text-lg rounded-xl flex items-center justify-center gap-3 transition-all"
              onClick={async () => {
                setIsPrinting(true);
                try {
                  const receiptData: ReceiptData = {
                    type: selectedSale!.type || "sale",
                    items: selectedSale!.items.map((item: any) => ({
                      name: item.name,
                      sku: item.sku,
                      quantity: item.quantity,
                      price: item.price,
                      discount: item.discount
                    })),
                    total: selectedSale!.total,
                    paymentType: selectedSale!.paymentType || "Naqd",
                    cashier: user?.name,
                    date: new Date(selectedSale!.date),
                    receiptNumber: selectedSale!.id,
                    storeName: storeInfo.storeName,
                    storeAddress: storeInfo.storeAddress,
                    storePhone: storeInfo.storePhone,
                    userRole: user?.role as 'admin' | 'xodim' | 'ega',
                  };
                  await printReceipt(null, receiptData);
                } catch (e) {
                  console.error('Print error:', e);
                } finally {
                  setIsPrinting(false);
                }
              }}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Chop etilmoqda...
                </>
              ) : (
                <>
                  <Printer className="w-6 h-6" />
                  Chekni chop etish
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear History Confirmation Dialog */}
      <AlertDialog open={clearHistoryConfirmOpen} onOpenChange={setClearHistoryConfirmOpen}>
        <AlertDialogContent className="bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border-slate-700/50 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Tarixni tozalash
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300 text-base">
              Tarixni butunlay tozalashni xohlaysizmi? Bu amalni qaytarib bo'lmaydi va barcha sotuvlar tarixini o'chirib yuboradi!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700">
              Bekor qilish
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={clearHistory}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Ha, tozalash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}