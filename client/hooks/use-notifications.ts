import React, { useState, useCallback, useRef } from 'react';
import type { Notification, NotificationType } from '@/components/ui/notification-stack';

let notificationIdCounter = 0;

function generateId() {
  notificationIdCounter += 1;
  return `notification-${notificationIdCounter}-${Date.now()}`;
}

const listeners = new Set<(notifications: Notification[]) => void>();
let notifications: Notification[] = [];
const MAX_NOTIFICATIONS = 5; // Ограничиваем количество уведомлений

function notifyListeners() {
  // Ограничиваем количество уведомлений для производительности
  const limitedNotifications = notifications.slice(-MAX_NOTIFICATIONS);
  listeners.forEach((listener) => listener([...limitedNotifications]));
}

export function useNotifications() {
  const [state, setState] = useState<Notification[]>(notifications);

  React.useEffect(() => {
    const listener = (newNotifications: Notification[]) => {
      setState(newNotifications);
    };
    listeners.add(listener);
    notifyListeners();

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const add = useCallback(
    (notification: Omit<Notification, 'id' | 'timestamp'>) => {
      const newNotification: Notification = {
        ...notification,
        id: generateId(),
        timestamp: Date.now(),
      };
      notifications = [...notifications, newNotification];
      // Удаляем старые уведомления если превышен лимит
      if (notifications.length > MAX_NOTIFICATIONS) {
        notifications = notifications.slice(-MAX_NOTIFICATIONS);
      }
      notifyListeners();
    },
    []
  );

  const remove = useCallback((id: string) => {
    notifications = notifications.filter((n) => n.id !== id);
    notifyListeners();
  }, []);

  const clear = useCallback(() => {
    notifications = [];
    notifyListeners();
  }, []);

  return {
    notifications: state,
    add,
    remove,
    clear,
  };
}

// Convenience functions
export const notification = {
  success: (title: string, description?: string, duration?: number) => {
    const id = generateId();
    const newNotification: Notification = {
      id,
      type: 'success',
      title,
      description,
      duration,
      timestamp: Date.now(),
    };
    notifications = [...notifications, newNotification];
    // Удаляем старые уведомления если превышен лимит
    if (notifications.length > MAX_NOTIFICATIONS) {
      notifications = notifications.slice(-MAX_NOTIFICATIONS);
    }
    notifyListeners();
    return id;
  },
  error: (title: string, description?: string, duration?: number) => {
    // Уведомления об ошибках отключены - только логирование в консоль
    console.error('[Notification] Error:', title, description);
    return '';
  },
  info: (title: string, description?: string, duration?: number) => {
    const id = generateId();
    const newNotification: Notification = {
      id,
      type: 'info',
      title,
      description,
      duration,
      timestamp: Date.now(),
    };
    notifications = [...notifications, newNotification];
    // Удаляем старые уведомления если превышен лимит
    if (notifications.length > MAX_NOTIFICATIONS) {
      notifications = notifications.slice(-MAX_NOTIFICATIONS);
    }
    notifyListeners();
    return id;
  },
  warning: (title: string, description?: string, duration?: number) => {
    const id = generateId();
    const newNotification: Notification = {
      id,
      type: 'warning',
      title,
      description,
      duration,
      timestamp: Date.now(),
    };
    notifications = [...notifications, newNotification];
    // Удаляем старые уведомления если превышен лимит
    if (notifications.length > MAX_NOTIFICATIONS) {
      notifications = notifications.slice(-MAX_NOTIFICATIONS);
    }
    notifyListeners();
    return id;
  },
};

