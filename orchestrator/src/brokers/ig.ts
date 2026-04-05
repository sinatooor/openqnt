import { logger } from '../utils/logger.js';
import type { Bar } from '../engine/interpreter.js';
import type {
    BrokerClient,
    BrokerOrder,
    BrokerOrderResult,
    BrokerPosition,
    BrokerAccountInfo,
} from '../services/brokerGateway.js';

export class IGClient implements BrokerClient {
    name = 'ig';
    private connected = false;

    async connect(_apiKey: string, _apiSecret?: string): Promise<void> {
        // TODO: Implement IG Markets OAuth/API login
        this.connected = true;
        logger.info({ broker: this.name }, 'IG Markets connected (Stub)');
    }

    async disconnect(): Promise<void> {
        this.connected = false;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async getAccount(): Promise<BrokerAccountInfo> {
        return {
            accountId: 'IG_ACCOUNT_STUB',
            cash: 100000,
            equity: 100000,
            buyingPower: 100000,
            status: 'ACTIVE',
        };
    }

    async submitOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
        logger.info({ order, broker: this.name }, 'Submitting order to IG Markets (Stub)');
        return {
            orderId: `ig_${Date.now()}`,
            status: 'accepted',
            filledQuantity: order.quantity,
            filledPrice: order.limitPrice ?? 0,
        };
    }

    async cancelOrder(orderId: string): Promise<void> {
        logger.info({ orderId, broker: this.name }, 'Cancelling order in IG Markets (Stub)');
    }

    async getOpenOrders(): Promise<BrokerOrderResult[]> {
        return [];
    }

    async getPositions(): Promise<BrokerPosition[]> {
        return [];
    }

    async closePosition(symbol: string): Promise<BrokerOrderResult> {
        logger.info({ symbol, broker: this.name }, 'Closing position in IG Markets (Stub)');
        return {
            orderId: `ig_close_${Date.now()}`,
            status: 'accepted',
            filledQuantity: 0,
            filledPrice: 0,
        };
    }

    async closeAllPositions(): Promise<BrokerOrderResult[]> {
        return [];
    }

    async getBars(symbol: string, timeframe: string, limit: number): Promise<Bar[]> {
        // Fall back to the Python compute service (yfinance) for market data.
        const { fetchMarketBars } = await import('../services/computeClient.js');
        const result = await fetchMarketBars({ symbol, timeframe, limit });
        return result.data.bars;
    }
}
