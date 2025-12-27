/**
 * Offline-capable product form
 * Saves products to IndexedDB when offline, syncs when online
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, DollarSign, FileText, Tag, Hash, Image } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { addOfflineProduct, addToSyncQueue } from '@/lib/db';
import { autoSync } from '@/lib/sync';
import { toast } from 'sonner';

interface ProductFormData {
  name: string;
  price: number;
  description: string;
  category: string;
  stock: number;
  imageUrl: string;
}

export function OfflineProductForm() {
  const { isOnline } = useNetworkStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    price: 0,
    description: '',
    category: '',
    stock: 0,
    imageUrl: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'price' || name === 'stock' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Mahsulot nomi kiritilishi shart');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isOnline) {
        // Try to save directly to backend
        const response = await fetch('/api/products/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          toast.success('Mahsulot muvaffaqiyatli qo\'shildi');
          resetForm();
        } else {
          throw new Error('Backend xatosi');
        }
      } else {
        // Save to IndexedDB for offline
        const product = await addOfflineProduct(formData);
        await addToSyncQueue('create', product);
        
        toast.success('Mahsulot offline saqlandi. Internet qaytganda sinxronlanadi.');
        resetForm();
      }
    } catch (error) {
      console.error('[ProductForm] Error:', error);
      
      // Fallback to offline storage
      try {
        const product = await addOfflineProduct(formData);
        await addToSyncQueue('create', product);
        
        toast.warning('Mahsulot offline saqlandi. Internet qaytganda sinxronlanadi.');
        resetForm();
      } catch (offlineError) {
        console.error('[ProductForm] Offline save error:', offlineError);
        toast.error('Mahsulot saqlanmadi');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: 0,
      description: '',
      category: '',
      stock: 0,
      imageUrl: '',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            Yangi mahsulot qo'shish
            {!isOnline && (
              <span className="text-xs text-orange-400 ml-2">
                (Offline rejim)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-300">
                Mahsulot nomi *
              </Label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Masalan: Avtomobil yog'i"
                  className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                  required
                />
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="price" className="text-gray-300">
                Narxi (UZS)
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="price"
                  name="price"
                  type="number"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0"
                  className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                  min="0"
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category" className="text-gray-300">
                Kategoriya
              </Label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="Masalan: Moy va suyuqliklar"
                  className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                />
              </div>
            </div>

            {/* Stock */}
            <div className="space-y-2">
              <Label htmlFor="stock" className="text-gray-300">
                Omborda
              </Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="stock"
                  name="stock"
                  type="number"
                  value={formData.stock}
                  onChange={handleChange}
                  placeholder="0"
                  className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                  min="0"
                />
              </div>
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <Label htmlFor="imageUrl" className="text-gray-300">
                Rasm URL
              </Label>
              <div className="relative">
                <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="imageUrl"
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/image.jpg"
                  className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-gray-300">
                Tavsif
              </Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Mahsulot haqida qisqacha ma'lumot..."
                  className="pl-10 bg-gray-900/50 border-gray-700 text-white min-h-[100px]"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? (
                'Saqlanmoqda...'
              ) : isOnline ? (
                'Mahsulot qo\'shish'
              ) : (
                'Offline saqlash'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
