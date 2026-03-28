import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Cake, X, Phone, Gift, PartyPopper } from 'lucide-react';
import type { IBirthdayNotification } from '@shared/customer-types';

// API base URL - работает для веб и Electron
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  if (window.location.protocol === 'file:') return 'http://127.0.0.1:5174';
  return import.meta.env.VITE_API_URL || '';
})();

export default function BirthdayNotifications() {
  const [notifications, setNotifications] = useState<IBirthdayNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchNotifications();
    // Har 1 soatda yangilash
    const interval = setInterval(fetchNotifications, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      // localStorage dan userId ni olish
      const userStr = localStorage.getItem('user');
      const userId = userStr ? JSON.parse(userStr).id : null;
      
      if (!userId) return;
      
      const res = await fetch(`${API_BASE}/api/customers/birthdays/notifications?userId=${userId}`, {
        headers: {
          'x-user-id': userId,
        },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error('Failed to fetch birthday notifications:', error);
    }
  };

  const handleDismiss = (customerId: string) => {
    setDismissed(prev => new Set(prev).add(customerId));
  };

  const visibleNotifications = notifications.filter(
    n => !dismissed.has(n.customer._id)
  );

  if (visibleNotifications.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      <AnimatePresence mode="popLayout">
        {visibleNotifications.map((notification) => (
          <motion.div
            key={notification.customer._id}
            layout
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0.3 }}
          >
            <Card
              className={`border-2 ${
                notification.isToday
                  ? 'bg-gradient-to-r from-pink-500/20 to-rose-500/20 border-pink-500/50'
                  : 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={`p-3 rounded-full ${
                        notification.isToday
                          ? 'bg-pink-500/20 border-2 border-pink-500/50'
                          : 'bg-blue-500/20 border-2 border-blue-500/30'
                      }`}
                    >
                      {notification.isToday ? (
                        <Cake className="w-6 h-6 text-pink-400 animate-bounce" />
                      ) : (
                        <Gift className="w-6 h-6 text-blue-400" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white">
                          {notification.customer.firstName} {notification.customer.lastName}
                        </h3>
                        {notification.isToday ? (
                          <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30 flex items-center gap-1">
                            <PartyPopper className="w-3 h-3" />
                            <span>Bugun!</span>
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                            {notification.daysUntil} kun qoldi
                          </Badge>
                        )}
                      </div>

                      <p className="text-gray-400 text-sm mb-2">
                        {notification.isToday ? (
                          <span className="text-pink-400 font-medium">
                            🎂 Bugun tug'ilgan kuni! Tabriklab qo'ying!
                          </span>
                        ) : (
                          `Tug'ilgan kuni ${notification.daysUntil} kundan keyin`
                        )}
                      </p>

                      {notification.customer.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Phone className="w-4 h-4" />
                          {notification.customer.phone}
                        </div>
                      )}

                      {notification.customer.totalOrders && notification.customer.totalOrders > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          {notification.customer.totalOrders} ta buyurtma • 
                          {notification.customer.totalSpent && ` ${notification.customer.totalSpent.toLocaleString()} so'm`}
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDismiss(notification.customer._id)}
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
