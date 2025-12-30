import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Award, X, Calendar, TrendingUp } from 'lucide-react';

// API base URL - работает для веб и Electron
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  if (window.location.protocol === 'file:') return 'http://127.0.0.1:5174';
  return import.meta.env.VITE_API_URL || '';
})();

interface VIPCustomer {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  totalOrders: number;
  needsBirthdate: boolean;
}

interface VIPCustomersAlertProps {
  onEditCustomer: (customerId: string) => void;
}

export default function VIPCustomersAlert({ onEditCustomer }: VIPCustomersAlertProps) {
  const [vipCustomers, setVipCustomers] = useState<VIPCustomer[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchVIPCustomers();
  }, []);

  const fetchVIPCustomers = async () => {
    try {
      // localStorage dan userId ni olish
      const userStr = localStorage.getItem('user');
      const userId = userStr ? JSON.parse(userStr).id : null;
      
      if (!userId) return;
      
      const res = await fetch(`${API_BASE}/api/orders/auto-promote?userId=${userId}`, {
        headers: {
          'x-user-id': userId,
        },
      });
      const data = await res.json();
      if (data.success && data.customers) {
        setVipCustomers(data.customers);
      }
    } catch (error) {
      console.error('Failed to fetch VIP customers:', error);
    }
  };

  const handleDismiss = (customerId: string) => {
    setDismissed(prev => new Set(prev).add(customerId));
  };

  const visibleCustomers = vipCustomers.filter(
    c => !dismissed.has(c._id)
  );

  if (visibleCustomers.length === 0) return null;

  return (
    <div className="mb-6">
      <AnimatePresence mode="popLayout">
        {visibleCustomers.map((customer) => (
          <motion.div
            key={customer._id}
            layout
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0.3 }}
            className="mb-3"
          >
            <Card className="border-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-3 rounded-full bg-yellow-500/20 border-2 border-yellow-500/50">
                      <Award className="w-6 h-6 text-yellow-400 animate-pulse" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white">
                          {customer.firstName} {customer.lastName}
                        </h3>
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                          🏆 VIP Mijoz
                        </Badge>
                      </div>

                      <p className="text-yellow-400 text-sm mb-2 font-medium">
                        <TrendingUp className="w-4 h-4 inline mr-1" />
                        {customer.totalOrders} ta buyurtma bergan!
                      </p>

                      <p className="text-gray-400 text-sm mb-3">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Tug'ilgan kunini kiriting va tabriklab qo'ying!
                      </p>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => onEditCustomer(customer._id)}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white"
                        >
                          Tug'ilgan Kun Qo'shish
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDismiss(customer._id)}
                    className="text-gray-400 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
