/**
 * Paper trading broker client.
 * Simulates order execution locally for testing strategies.
 */

import { logger } from '../utils/logger.js';
import { v4 as uuid } from 'uuid';
import type { Bar } from '../engine/interpreter.js';
import type {
    BrokerClient,
    BrokerOrder,
    BrokerOrderResult,
    BrokerPosition,
    BrokerAccountInfo,
} from '../services/brokerGateway.js';

export class PaperClient implements BrokerClient {
    name = 'paper';
    private connected = false;
    private cash = 100000;
    private positions = new Map<string, BrokerPosition>();
    private orders: BrokerOrderResult[] = [];

    async connect(_apiKey: string): Promise<void> {
        this.connected = true;
        logger.info({ broker: this.name, cash: this.cash }, 'Paper trading connected');
    }

    async disconnect(): Promise<void> {
        this.connected = false;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async getAccount(): Promise<BrokerAccountInfo> {
        const posValue = [...this.positions.values()].reduce(
            (sum, p) => sum + p.quantity * p.currentPrice,
            0
        );
        return {
            accountId: 'paper-account',
            cash: this.cash,
            equity: this.cash + posValue,
            buyingPower: this.cash,
            status: 'active',
        };
    }

    async submitOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
        const orderId = uuid();
        const fillPrice = order.limitPrice ?? 100; // Simulated fill price
        const cost = fillPrice * order.quantity;

        if (order.side === 'buy') {
            if (cost > this.cash) {
                return { orderId, status: 'rejected', filledQuantity: 0, filledPrice: 0, message: 'Insufficient funds' };
            }
            this.cash -= cost;
            const existing = this.positions.get(order.symbol);
            if (existing) {
                existing.quantity += order.quantity;
                existing.avgEntryPrice = (existing.avgEntryPrice + fillPrice) / 2;
            } else {
                this.positions.set(order.symbol, {
                    symbol: order.symbol,
                    side: 'long',
                    quantity: order.quantity,
                    avgEntryPrice: fillPrice,
                    currentPrice: fillPrice,
                    unrealizedPnl: 0,
                    marketValue: cost,
                });
            }
        } else {
            const existing = this.positions.get(order.symbol);
            if (existing) {
                this.cash += fillPrice * Math.min(order.quantity, existing.quantity);
                existing.quantity -= order.quantity;
                if (existing.quantity <= 0) {
                    this.positions.delete(order.symbol);
                }
            }
        }

        const result: BrokerOrderResult = {
            orderId,
            status: 'accepted',
            filledQuantity: order.quantity,
            filledPrice: fillPrice,
        };
        this.orders.push(result);

        logger.info(
            { orderId, symbol: order.symbol, side: order.side, qty: order.quantity, price: fillPrice },
            'Paper order filled'
        );

        return result;
    }

    async cancelOrder(orderId: string): Promise<void> {
        logger.info({ orderId }, 'Paper order cancelled (no-op)');
    }

    async getOpenOrders(): Promise<BrokerOrderResult[]> {
        return []; // Paper trading fills instantly
    }

    async getPositions(): Promise<BrokerPosition[]> {
        return [...this.positions.values()];
    }

    async closePosition(symbol: string): Promise<BrokerOrderResult> {
        const position = this.positions.get(symbol);
        if (position) {
            this.cash += position.currentPrice * position.quantity;
            this.positions.delete(symbol);
        }
        return { orderId: uuid(), status: 'accepted', filledQuantity: position?.quantity ?? 0, filledPrice: position?.currentPrice ?? 0 };
    }

    async closeAllPositions(): Promise<BrokerOrderResult[]> {
        const results: BrokerOrderResult[] = [];
        for (const symbol of this.positions.keys()) {
            results.push(await this.closePosition(symbol));
        }
        return results;
    }

    async getBars(_symbol: string, _timeframe: string, _limit: number): Promise<Bar[]> {
        throw new Error('Paper trading market data not implemented (use real broker for data)');
    }
}
