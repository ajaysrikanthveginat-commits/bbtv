import { SignalingMessage } from '../types/signaling';

type MessageHandler = (message: SignalingMessage) => void;
type ConnectionHandler = (connected: boolean) => void;

export class SignalingService {
  private socket: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private reconnectHandlers: Set<() => void> = new Set();
  private isExplicitlyClosed = false;
  private hasInitiallyConnected = false;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private txCount = 0;
  private rxCount = 0;

  constructor() {
    this.connect();
  }

  public getTxCount(): number {
    return this.txCount;
  }

  public getRxCount(): number {
    return this.rxCount;
  }

  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.notifyConnectionState(true);
        this.startHeartbeat();
        if (this.hasInitiallyConnected) {
          console.log('[SignalingService] WebSocket RECONNECTED, notifying handlers');
          this.reconnectHandlers.forEach((handler) => {
            try {
              handler();
            } catch (err) {
              console.error('[SignalingService] Error in reconnect handler:', err);
            }
          });
        }
        this.hasInitiallyConnected = true;
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          const message: SignalingMessage = JSON.parse(event.data);
          this.rxCount++;
          if ((message as any).type !== 'PONG') {
            console.log(`[WS RX] type=${message.type} room=${message.roomId || ''} sender=${message.senderId || ''}`);
          }
          this.notifyMessage(message);
        } catch (err) {
          console.error('[SignalingService] Failed to parse message:', err, event.data);
        }
      };

      this.socket.onerror = (error) => {
        console.warn('[SignalingService] WebSocket error:', error);
      };

      this.socket.onclose = () => {
        this.notifyConnectionState(false);
        this.stopHeartbeat();
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('[SignalingService] Failed to establish WebSocket connection:', err);
      this.notifyConnectionState(false);
      this.scheduleReconnect();
    }
  }

  public send(message: SignalingMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[SignalingService] Cannot send message, socket not open:', message.type);
      return false;
    }

    try {
      this.txCount++;
      if ((message as any).type !== 'PING') {
        console.log(`[WS TX] type=${message.type} room=${message.roomId || ''} sender=${message.senderId || ''}`);
      }
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error('[SignalingService] Failed to send message:', err);
      return false;
    }
  }

  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  public onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    // Emit immediate current state
    handler(this.isConnected());
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  public onReconnected(handler: () => void): () => void {
    this.reconnectHandlers.add(handler);
    return () => {
      this.reconnectHandlers.delete(handler);
    };
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.notifyConnectionState(false);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isExplicitlyClosed) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[SignalingService] Attempting to reconnect...');
      this.connect();
    }, 2000);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        // Send a lightweight ping packet
        try {
          this.socket.send(JSON.stringify({ type: 'PING' }));
        } catch {
          // ignore
        }
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private notifyMessage(message: SignalingMessage): void {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (err) {
        console.error('[SignalingService] Error in message handler:', err);
      }
    });
  }

  private notifyConnectionState(connected: boolean): void {
    this.connectionHandlers.forEach((handler) => {
      try {
        handler(connected);
      } catch (err) {
        console.error('[SignalingService] Error in connection handler:', err);
      }
    });
  }
}
