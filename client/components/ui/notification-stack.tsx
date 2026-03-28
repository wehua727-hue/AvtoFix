import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description?: string;
  duration?: number;
  timestamp: number;
}

interface NotificationStackProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
}

const notificationIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const notificationColors = {
  success: {
    bg: 'from-emerald-500/20 to-green-500/10',
    border: 'border-emerald-500/30',
    icon: 'text-emerald-400',
    accent: 'bg-emerald-500/20',
  },
  error: {
    bg: 'from-red-500/20 to-rose-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    accent: 'bg-red-500/20',
  },
  info: {
    bg: 'from-blue-500/20 to-cyan-500/10',
    border: 'border-blue-500/30',
    icon: 'text-blue-400',
    accent: 'bg-blue-500/20',
  },
  warning: {
    bg: 'from-amber-500/20 to-yellow-500/10',
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
    accent: 'bg-amber-500/20',
  },
};

export function NotificationStack({ notifications, onRemove }: NotificationStackProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [pausedNotifications, setPausedNotifications] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Auto-remove oldest notification after 5 seconds (только для самого старого)
  useEffect(() => {
    if (notifications.length === 0 || isHovered) return;

    // Устанавливаем таймер только для самого старого уведомления
    const oldest = notifications[0];
    if (!oldest || pausedNotifications.has(oldest.id) || timeoutsRef.current.has(oldest.id)) {
      return;
    }

    const duration = oldest.duration || 5000;
    const timeout = setTimeout(() => {
      if (!pausedNotifications.has(oldest.id)) {
        onRemove(oldest.id);
      }
    }, duration);

    timeoutsRef.current.set(oldest.id, timeout);

    return () => {
      if (timeoutsRef.current.has(oldest.id)) {
        clearTimeout(timeoutsRef.current.get(oldest.id)!);
        timeoutsRef.current.delete(oldest.id);
      }
    };
  }, [notifications, pausedNotifications, isHovered, onRemove]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    // Pause all notifications
    setPausedNotifications(new Set(notifications.map((n) => n.id)));
    // Clear all timeouts
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutsRef.current.clear();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Resume auto-removal
    setPausedNotifications(new Set());
  };

  if (notifications.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col-reverse gap-2 max-w-md w-full sm:max-w-sm"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <AnimatePresence mode="popLayout">
        {notifications.filter(n => n.type !== 'error').map((notification, index, filteredArray) => {
          const Icon = notificationIcons[notification.type];
          const colors = notificationColors[notification.type];
          const isTop = index === filteredArray.length - 1;
          const offset = isHovered ? index * 8 : 0;
          const scale = isHovered ? 1 : isTop ? 1 : 0.95 - index * 0.05;
          const opacity = isHovered ? 0.95 : isTop ? 0.95 : 0.7 - index * 0.15;

          return (
            <motion.div
              key={notification.id}
              initial={{ x: 400, opacity: 0 }}
              animate={{
                x: 0,
                opacity,
                scale,
              }}
              exit={{ x: 400, opacity: 0, transition: { duration: 0.2 } }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
              }}
              className={cn(
                'relative w-full rounded-xl border backdrop-blur-[10px]',
                'bg-card/95',
                colors.border,
                'shadow-[0_8px_32px_rgba(0,0,0,0.1)]',
                'overflow-hidden',
                'group',
                'opacity-95'
              )}
              style={{
                opacity,
                zIndex: filteredArray.length - index,
                transform: `translateY(${-offset}px) scale(${scale})`,
              }}
            >
              {/* Accent border with gradient */}
              <div 
                className={cn('absolute top-0 left-0 right-0 h-1', colors.accent)}
                style={{
                  background: notification.type === 'success' 
                    ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.8), rgba(5, 150, 105, 0.6))'
                    : notification.type === 'error'
                    ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 0.6))'
                    : notification.type === 'info'
                    ? 'linear-gradient(90deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.6))'
                    : 'linear-gradient(90deg, rgba(245, 158, 11, 0.8), rgba(217, 119, 6, 0.6))',
                }}
              />

              <div className="p-4 pr-10">
                <div className="flex items-start gap-3">
                  <div className={cn('flex-shrink-0 mt-0.5', colors.icon)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground mb-1">{notification.title}</h4>
                    {notification.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{notification.description}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={() => onRemove(notification.id)}
                className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white/10 hover:scale-110 text-muted-foreground hover:text-foreground active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

