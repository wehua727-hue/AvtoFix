/**
 * Bola mahsulot tanlash komponenti
 * Ota mahsulot tugaganda avtomatik ko'rinadigan bola mahsulotlarni tanlash uchun
 */

import { useState, useEffect } from 'react';
import { Search, Plus, X, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth-context';

// API base URL
const API_BASE_URL = (() => {
  if (typeof window === 'undefined') return '';
  if (window.location.protocol === 'file:') return 'http://127.0.0.1:5175';
  const envApiUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envApiUrl && !envApiUrl.includes('YOUR_PUBLIC_IP')) {
    return envApiUrl.replace(/\/$/, '');
  }
  return '';
})();

export interface ChildProduct {
  productId: string;
  name: string;
  autoActivate: boolean;
}

interface Product {
  id: string;
  _id?: string;
  name: string;
  sku?: string;
  price?: number;
  stock?: number;
  imageUrl?: string;
  isHidden?: boolean;
  parentProductId?: string;
}

interface ChildProductSelectorProps {
  parentProductId: string;
  parentProductName: string;
  childProducts: ChildProduct[];
  onChange: (children: ChildProduct[]) => void;
  disabled?: boolean;
}

export function ChildProductSelector({
  parentProductId,
  parentProductName,
  childProducts,
  onChange,
  disabled = false,
}: ChildProductSelectorProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Barcha mahsulotlarni yuklash
  useEffect(() => {
    const loadProducts = async () => {
      if (!user?.id) return;
      
      try {
        const params = new URLSearchParams({
          userId: user.id,
          includeHidden: 'true', // Yashirin mahsulotlarni ham ko'rsatish
        });
        if (user.phone) params.append('userPhone', user.phone);
        
        const res = await fetch(`${API_BASE_URL}/api/products?${params}`);
        if (res.ok) {
          const data = await res.json();
          const products = Array.isArray(data) ? data : data.products || [];
          // O'zini va allaqachon bog'langan mahsulotlarni chiqarib tashlash
          const filtered = products.filter((p: Product) => {
            const id = p.id || p._id;
            return id !== parentProductId;
          });
          setAllProducts(filtered);
        }
      } catch (err) {
        console.error('Failed to load products:', err);
      }
    };
    
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen, user?.id, user?.phone, parentProductId]);

  // Qidiruv
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(allProducts.slice(0, 20));
      return;
    }
    
    setIsSearching(true);
    const query = searchQuery.toLowerCase();
    const results = allProducts.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.sku?.toLowerCase().includes(query)
    ).slice(0, 20);
    setSearchResults(results);
    setIsSearching(false);
  }, [searchQuery, allProducts]);

  // Bola mahsulot qo'shish
  const addChild = (product: Product) => {
    const id = product.id || product._id;
    if (!id) return;
    
    // Allaqachon qo'shilganmi tekshirish
    if (childProducts.some(c => c.productId === id)) return;
    
    const newChild: ChildProduct = {
      productId: id,
      name: product.name,
      autoActivate: true,
    };
    
    onChange([...childProducts, newChild]);
  };

  // Bola mahsulotni o'chirish
  const removeChild = (productId: string) => {
    onChange(childProducts.filter(c => c.productId !== productId));
  };

  // Auto-activate ni o'zgartirish
  const toggleAutoActivate = (productId: string) => {
    onChange(childProducts.map(c => 
      c.productId === productId 
        ? { ...c, autoActivate: !c.autoActivate }
        : c
    ));
  };

  return (
    <div className="space-y-4">
      {/* Mavjud bola mahsulotlar ro'yxati */}
      {childProducts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Bog'langan bola mahsulotlar ({childProducts.length})
          </p>
          <div className="space-y-2">
            {childProducts.map((child) => (
              <div
                key={child.productId}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card/50"
              >
                <div className="flex items-center gap-3">
                  <Link2 className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="font-medium text-sm">{child.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {child.autoActivate 
                        ? "Ota tugaganda avtomatik ko'rinadi" 
                        : "Qo'lda faollashtirish kerak"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={child.autoActivate}
                    onCheckedChange={() => toggleAutoActivate(child.productId)}
                    disabled={disabled}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeChild(child.productId)}
                    disabled={disabled}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bola mahsulot qo'shish tugmasi */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full border-dashed"
            disabled={disabled}
          >
            <Plus className="w-4 h-4 mr-2" />
            Bola mahsulot qo'shish
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bola mahsulot tanlash</DialogTitle>
            <p className="text-sm text-muted-foreground">
              "{parentProductName}" tugaganda ko'rinadigan mahsulotni tanlang
            </p>
          </DialogHeader>
          
          {/* Qidiruv */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Mahsulot nomi yoki kodi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Natijalar */}
          <div className="max-h-80 overflow-y-auto space-y-2">
            {isSearching ? (
              <div className="text-center py-8 text-muted-foreground">
                Qidirilmoqda...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Mahsulot topilmadi
              </div>
            ) : (
              searchResults.map((product) => {
                const id = product.id || product._id;
                const isAlreadyAdded = childProducts.some(c => c.productId === id);
                const isHidden = product.isHidden;
                const hasParent = product.parentProductId;
                
                return (
                  <div
                    key={id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-all ${
                      isAlreadyAdded 
                        ? 'border-blue-500/50 bg-blue-500/10' 
                        : 'border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer'
                    }`}
                    onClick={() => !isAlreadyAdded && addChild(product)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        {isHidden && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                            Yashirin
                          </span>
                        )}
                        {hasParent && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                            Bola
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {product.sku && <span>Kod: {product.sku}</span>}
                        {product.stock !== undefined && (
                          <span>Ombor: {product.stock}</span>
                        )}
                      </div>
                    </div>
                    {isAlreadyAdded ? (
                      <span className="text-xs text-blue-400">Qo'shilgan</span>
                    ) : (
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tushuntirish */}
      {childProducts.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Bola mahsulot qo'shsangiz, ushbu mahsulot tugaganda bola mahsulot avtomatik ko'rinadi
        </p>
      )}
    </div>
  );
}
