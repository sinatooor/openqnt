import { wsBase } from '@/lib/runtimeConfig';
/**
 * WebSocket Connection Manager
 * 
 * Manages WebSocket connections for real-time updates.
 * Handles reconnection, heartbeat, and message routing.
 */

type MessageHandler = (data: any) => void;

interface WebSocketConfig {
    url: string;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    heartbeatInterval?: number;
}

class WebSocketManager {
    private ws: WebSocket | null = null;
    private url: string;
    private reconnectInterval: number;
    private maxReconnectAttempts: number;
    private heartbeatInterval: number;

    private reconnectAttempts = 0;
    private heartbeatTimer: number | null = null;
    private handlers: Map<string, Set<MessageHandler>> = new Map();
    private isIntentionalClose = false;

    constructor(config: WebSocketConfig) {
        this.url = config.url;
        this.reconnectInterval = config.reconnectInterval || 3000;
        this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
        this.heartbeatInterval = config.heartbeatInterval || 30000;
    }

    connect(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return;
        }

        this.isIntentionalClose = false;

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('[WS] Connected');
                this.reconnectAttempts = 0;
                this.startHeartbeat();
                this.emit('connection', { status: 'connected' });
            };

            this.ws.onclose = (event) => {
                console.log('[WS] Disconnected', event.code);
                this.stopHeartbeat();
                this.emit('connection', { status: 'disconnected' });

                if (!this.isIntentionalClose) {
                    this.attemptReconnect();
                }
            };

            this.ws.onerror = (error) => {
                console.error('[WS] Error', error);
                this.emit('error', error);
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    const type = message.type || 'message';
                    this.emit(type, message.data || message);
                } catch {
                    this.emit('message', event.data);
                }
            };
        } catch (error) {
            console.error('[WS] Connection error', error);
            this.attemptReconnect();
        }
    }

    disconnect(): void {
        this.isIntentionalClose = true;
        this.stopHeartbeat();

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    send(type: string, data: any): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, data }));
        } else {
            console.warn('[WS] Cannot send - not connected');
        }
    }

    on(event: string, handler: MessageHandler): () => void {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event)!.add(handler);

        // Return unsubscribe function
        return () => {
            this.handlers.get(event)?.delete(handler);
        };
    }

    off(event: string, handler: MessageHandler): void {
        this.handlers.get(event)?.delete(handler);
    }

    private emit(event: string, data: any): void {
        this.handlers.get(event)?.forEach((handler) => {
            try {
                handler(data);
            } catch (error) {
                console.error(`[WS] Handler error for ${event}`, error);
            }
        });
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[WS] Max reconnect attempts reached');
            this.emit('reconnect_failed', {});
            return;
        }

        this.reconnectAttempts++;
        console.log(`[WS] Reconnecting... (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            this.connect();
        }, this.reconnectInterval * this.reconnectAttempts);
    }

    private startHeartbeat(): void {
        this.heartbeatTimer = window.setInterval(() => {
            this.send('ping', { timestamp: Date.now() });
        }, this.heartbeatInterval);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

// Create instance for strategy updates
// Points to the Node.js orchestrator Socket.io server (not the Python backend)
const WS_URL = wsBase();

export const strategyWS = new WebSocketManager({
    url: `${WS_URL}/strategy`,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000,
});

// Create instance for market data
export const marketDataWS = new WebSocketManager({
    url: `${WS_URL}/market`,
    reconnectInterval: 2000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 15000,
});

export { WebSocketManager };
export default strategyWS;
