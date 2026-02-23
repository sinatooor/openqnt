/**
 * Alpaca Markets broker client.
 * Paper trading + live trading via REST API.
 */

import { logger } from '../utils/logger.js';
import type {
    BrokerClient,
    BrokerOrder,
    BrokerOrderResult,
    BrokerPosition,
    BrokerAccountInfo,
} from '../services/brokerGateway.js';

const PAPER_URL = 'https://paper-api.alpaca.markets';
const LIVE_URL = 'https://api.alpaca.markets';

export class AlpacaClient implements BrokerClient {
    name = 'alpaca';
    private baseUrl = PAPER_URL;
    private headers: Record<string, string> = {};
    private connected = false;

    async connect(apiKey: string, apiSecret?: string): Promise<void> {
        this.headers = {
            'APCA-API-KEY-ID': apiKey,
            'APCA-API-SECRET-KEY': apiSecret ?? '',
            'Content-Type': 'application/json',
        };
        // Determine paper vs live based on key prefix
        if (apiKey.startsWith('PK')) {
            this.baseUrl = PAPER_URL;
        } else {
            this.baseUrl = LIVE_URL;
        }
        // Verify connection
        try {
            await this.getAccount();
            this.connected = true;
            logger.info({ broker: this.name, baseUrl: this.baseUrl }, 'Alpaca connected');
        } catch (error: any) {
            throw new Error(`Alpaca connection failed: ${error.message}`);
        }
    }

    async disconnect(): Promise<void> {
        this.headers = {};
        this.connected = false;
    }

    isConnected(): boolean {
        return this.connected;
    }

    private async request<T>(method: string, path: string, body?: any): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const response = await fetch(url, {
            method,
            headers: this.headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Alpaca ${method} ${path}: ${response.status} — ${error}`);
        }
        return response.json() as Promise<T>;
    }

    async getAccount(): Promise<BrokerAccountInfo> {
        const data = await this.request<any>('GET', '/v2/account');
        return {
            accountId: data.account_number,
            cash: parseFloat(data.cash),
            equity: parseFloat(data.equity),
            buyingPower: parseFloat(data.buying_power),
            dayTradesRemaining: data.daytrade_count != null ? 3 - data.daytrade_count : undefined,
            status: data.status,
        };
    }

    async submitOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
        const payload = {
            symbol: order.symbol,
            qty: order.quantity.toString(),
            side: order.side,
            type: order.type,
            time_in_force: order.timeInForce ?? 'day',
            ...(order.limitPrice ? { limit_price: order.limitPrice.toString() } : {}),
            ...(order.stopPrice ? { stop_price: order.stopPrice.toString() } : {}),
            ...(order.clientOrderId ? { client_order_id: order.clientOrderId } : {}),
        };

        const data = await this.request<any>('POST', '/v2/orders', payload);

        logger.info(
            { orderId: data.id, symbol: order.symbol, side: order.side, qty: order.quantity },
            'Alpaca order submitted'
        );

        return {
            orderId: data.id,
            status: data.status === 'accepted' || data.status === 'new' ? 'accepted' : 'pending',
            filledQuantity: parseFloat(data.filled_qty || '0'),
            filledPrice: parseFloat(data.filled_avg_price || '0'),
            rawResponse: data,
        };
    }

    async cancelOrder(orderId: string): Promise<void> {
        await this.request('DELETE', `/v2/orders/${orderId}`);
        logger.info({ orderId }, 'Alpaca order cancelled');
    }

    async getOpenOrders(): Promise<BrokerOrderResult[]> {
        const data = await this.request<any[]>('GET', '/v2/orders?status=open');
        return data.map((o) => ({
            orderId: o.id,
            status: o.status === 'new' ? 'accepted' as const : 'pending' as const,
            filledQuantity: parseFloat(o.filled_qty || '0'),
            filledPrice: parseFloat(o.filled_avg_price || '0'),
            rawResponse: o,
        }));
    }

    async getPositions(): Promise<BrokerPosition[]> {
        const data = await this.request<any[]>('GET', '/v2/positions');
        return data.map((p) => ({
            symbol: p.symbol,
            side: p.side === 'long' ? 'long' as const : 'short' as const,
            quantity: parseFloat(p.qty),
            avgEntryPrice: parseFloat(p.avg_entry_price),
            currentPrice: parseFloat(p.current_price),
            unrealizedPnl: parseFloat(p.unrealized_pl),
            marketValue: parseFloat(p.market_value),
        }));
    }

    async closePosition(symbol: string): Promise<BrokerOrderResult> {
        const data = await this.request<any>('DELETE', `/v2/positions/${symbol}`);
        logger.info({ symbol }, 'Alpaca position closed');
        return {
            orderId: data.id ?? 'close',
            status: 'accepted',
            filledQuantity: 0,
            filledPrice: 0,
            rawResponse: data,
        };
    }

    async closeAllPositions(): Promise<BrokerOrderResult[]> {
        await this.request('DELETE', '/v2/positions');
        logger.warn('All Alpaca positions closed');
        return [];
    }
}
