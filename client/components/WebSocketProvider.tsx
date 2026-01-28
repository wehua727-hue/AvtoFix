import React, { createContext, useContext, ReactNode } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useAuth } from '@/lib/auth-context';
import { notification } from '@/hooks/use-notifications';

interface WebSocketContextType {
  isConnected: boolean;
  isConnecting: boolean;
  clientId: string | null;
  send: (message: any) => boolean;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
}

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { user } = useAuth();

  const { isConnected, isConnecting, clientId, send } = useWebSocket({
    userId: user?.id,
    onMessage: (message) => {
      // Handle different message types
      switch (message.type) {
        case 'product-updated':
          notification.info('Mahsulot yangilandi', message.productName);
          // Kassa va boshqa sahifalarda cache yangilash uchun event dispatch
          window.dispatchEvent(new CustomEvent('product-updated', { 
            detail: { productId: message.productId, productName: message.productName } 
          }));
          break;
        case 'product-created':
          notification.success('Yangi mahsulot qo\'shildi', message.productName);
          break;
        case 'product-deleted':
          notification.warning('Mahsulot o\'chirildi', message.productName);
          break;
        case 'debt-updated':
          notification.info('Qarz yangilandi', message.creditor);
          break;
        case 'order-created':
          notification.success('Yangi buyurtma', `Jami: ${message.total} so'm`);
          break;
        case 'sync-complete':
          notification.success('Sinxronlash yakunlandi', message.message);
          break;
        case 'error':
          // Уведомления об ошибках отключены
          console.error('[WebSocket] Error:', message.message);
          break;
        default:
          // Unknown message type, log for debugging
          console.log('[WebSocket] Received message:', message);
      }
    },
    onConnect: () => {
      // Уведомление о подключении отключено для уменьшения шума
      // notification.success('Ulanish muvaffaqiyatli', 'Real-time yangilanishlar yoqildi');
    },
    onDisconnect: () => {
      // Уведомление о разрыве отключено - WebSocket будет пытаться переподключиться автоматически
      // notification.warning('Ulanish uzildi', 'Qayta ulanilmoqda...');
    },
    onError: () => {
      // Уведомления об ошибках отключены
      console.error('[WebSocket] Connection error');
    },
    reconnect: true,
    reconnectInterval: 1000,
    maxReconnectAttempts: 10,
  });

  return (
    <WebSocketContext.Provider value={{ isConnected, isConnecting, clientId, send }}>
      {children}
    </WebSocketContext.Provider>
  );
}

