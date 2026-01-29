import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  url?: string;
  userId?: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url,
    userId,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnect = true,
    reconnectInterval = 1000,
    maxReconnectAttempts = 10,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const clientIdRef = useRef<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const getWebSocketUrl = useCallback(() => {
    if (url) return url;
    
    // Auto-detect WebSocket URL
    if (typeof window === 'undefined') return null;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // For Electron (file:// protocol) - API server 5176 portda
    if (window.location.protocol === 'file:') {
      return 'ws://127.0.0.1:5176/ws';
    }
    
    // Development da Vite 5174, API 5176 - WebSocket API server bilan birga
    if (host.includes('5174')) {
      return 'ws://127.0.0.1:5176/ws';
    }
    
    return `${protocol}//${host}/ws`;
  }, [url]);

  const connect = useCallback(() => {
    const wsUrl = getWebSocketUrl();
    if (!wsUrl || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (isConnecting) return;
    setIsConnecting(true);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;
        onConnect?.();

        // Send auth if userId provided
        if (userId) {
          ws.send(JSON.stringify({
            type: 'auth',
            userId,
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Handle connection confirmation
          if (message.type === 'connected' && message.clientId) {
            clientIdRef.current = message.clientId;
            console.log('[WebSocket] Client ID:', message.clientId);
          }

          // Handle auth success
          if (message.type === 'auth-success') {
            console.log('[WebSocket] Authenticated as user:', message.userId);
          }

          // Handle pong
          if (message.type === 'pong') {
            // Server responded to ping
            return;
          }

          onMessage?.(message);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        
        // Kod 1006 - server mavjud emas yoki ulanish uzildi
        // Faqat birinchi marta log qilamiz
        if (event.code === 1006 && reconnectAttemptsRef.current === 0) {
          console.log('[WebSocket] Server mavjud emas, qayta ulanish o\'chirildi');
          reconnectAttemptsRef.current = maxReconnectAttempts; // Qayta ulanishni to'xtatish
          return;
        }
        
        // Normal yopilish - log qilmaymiz
        if (event.code === 1000 || event.code === 1001) {
          return;
        }
        
        onDisconnect?.();

        // Qayta ulanish - faqat server mavjud bo'lsa
        if (reconnect && reconnectAttemptsRef.current < maxReconnectAttempts && event.code !== 1006) {
          const delay = Math.min(
            reconnectInterval * Math.pow(2, reconnectAttemptsRef.current),
            30000
          );
          
          reconnectAttemptsRef.current += 1;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        // Xatolarni log qilmaymiz - onclose da boshqariladi
        setIsConnecting(false);
      };

      // Send ping every 25 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        } else {
          clearInterval(pingInterval);
        }
      }, 25000);

      ws.addEventListener('close', () => {
        clearInterval(pingInterval);
      });
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      setIsConnecting(false);
    }
  }, [getWebSocketUrl, userId, onMessage, onConnect, onDisconnect, onError, reconnect, reconnectInterval, maxReconnectAttempts, isConnecting]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('[WebSocket] Cannot send message: not connected');
    return false;
  }, []);

  useEffect(() => {
    // Не пытаемся подключиться если превышен лимит попыток
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      return;
    }
    
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect, maxReconnectAttempts]);

  return {
    isConnected,
    isConnecting,
    clientId: clientIdRef.current,
    send,
    connect,
    disconnect,
  };
}

