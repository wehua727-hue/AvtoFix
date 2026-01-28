import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

interface Client {
  id: string;
  ws: WebSocket;
  userId?: string;
  lastPing: number;
  isAlive: boolean;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Client> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL = 30000; // 30 seconds
  private readonly PONG_TIMEOUT = 10000; // 10 seconds

  initialize(server: HTTPServer) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      perMessageDeflate: false,
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId();
      const client: Client = {
        id: clientId,
        ws,
        lastPing: Date.now(),
        isAlive: true,
      };

      this.clients.set(clientId, client);
      console.log(`[WebSocket] Client connected: ${clientId} (Total: ${this.clients.size})`);

      // Send welcome message with client ID
      this.sendToClient(clientId, {
        type: 'connected',
        clientId,
        timestamp: Date.now(),
      });

      // Handle messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error(`[WebSocket] Error parsing message from ${clientId}:`, error);
        }
      });

      // Handle pong
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.isAlive = true;
          client.lastPing = Date.now();
        }
      });

      // Handle close
      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`[WebSocket] Client disconnected: ${clientId} (Total: ${this.clients.size})`);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`[WebSocket] Error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });
    });

    // Start ping interval
    this.startPingInterval();

    console.log('[WebSocket] Server initialized');
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'auth':
        // Store userId for this client
        client.userId = message.userId;
        console.log(`[WebSocket] Client ${clientId} authenticated as user ${message.userId}`);
        this.sendToClient(clientId, {
          type: 'auth-success',
          clientId,
          userId: message.userId,
        });
        break;

      case 'ping':
        // Respond to ping
        this.sendToClient(clientId, {
          type: 'pong',
          timestamp: Date.now(),
        });
        break;

      default:
        console.log(`[WebSocket] Unknown message type from ${clientId}:`, message.type);
    }
  }

  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          // Client didn't respond to ping, terminate connection
          console.log(`[WebSocket] Client ${clientId} timed out, closing connection`);
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        // Mark as not alive and send ping
        client.isAlive = false;
        try {
          client.ws.ping();
        } catch (error) {
          console.error(`[WebSocket] Error pinging client ${clientId}:`, error);
          this.clients.delete(clientId);
        }
      });
    }, this.PING_INTERVAL);
  }

  sendToClient(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(data));
      } catch (error) {
        console.error(`[WebSocket] Error sending to client ${clientId}:`, error);
      }
    }
  }

  broadcast(data: any, excludeClientId?: string) {
    const message = JSON.stringify(data);
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
        } catch (error) {
          console.error(`[WebSocket] Error broadcasting to client ${clientId}:`, error);
        }
      }
    });
  }

  broadcastToUser(userId: string, data: any, excludeClientId?: string) {
    const message = JSON.stringify(data);
    this.clients.forEach((client, clientId) => {
      if (
        client.userId === userId &&
        clientId !== excludeClientId &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        try {
          client.ws.send(message);
        } catch (error) {
          console.error(`[WebSocket] Error broadcasting to user ${userId} (client ${clientId}):`, error);
        }
      }
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getClientCountForUser(userId: string): number {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.userId === userId) count++;
    });
    return count;
  }

  shutdown() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    this.clients.forEach((client) => {
      client.ws.close();
    });
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    console.log('[WebSocket] Server shut down');
  }
}

export const wsManager = new WebSocketManager();

