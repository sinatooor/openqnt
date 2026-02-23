import { logger } from '../utils/logger.js';
import type {
    BrokerClient,
    BrokerOrder,
    BrokerOrderResult,
    BrokerPosition,
    BrokerAccountInfo,
} from '../services/brokerGateway.js';

export class NordnetClient implements BrokerClient {
    name = 'nordnet';
    private connected = false;

    async connect(_apiKey: string, _apiSecret?: string): Promise<void> {
        // TODO: Implement Nordnet nextAPI connect
        this.connected = true;
        logger.info({ broker: this.name }, 'Nordnet connected (Stub)');
    }

    async disconnect(): Promise<void> {
        this.connected = false;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async getAccount(): Promise<BrokerAccountInfo> {
        return {
            accountId: 'NORDNET_ACCOUNT_STUB',
            cash: 100000,
            equity: 100000,
            buyingPower: 100000,
            status: 'ACTIVE',
        };
    }

    async submitOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
        logger.info({ order, broker: this.name }, 'Submitting order to Nordnet (Stub)');
        return {
            orderId: `nordnet_${Date.now()}`,
            status: 'accepted',
            filledQuantity: order.quantity,
            filledPrice: order.limitPrice ?? 0,
        };
    }

    async cancelOrder(orderId: string): Promise<void> {
        logger.info({ orderId, broker: this.name }, 'Cancelling order in Nordnet (Stub)');
    }

    async getOpenOrders(): Promise<BrokerOrderResult[]> {
        return [];
    }

    async getPositions(): Promise<BrokerPosition[]> {
        return [];
    }

    async closePosition(symbol: string): Promise<BrokerOrderResult> {
        logger.info({ symbol, broker: this.name }, 'Closing position in Nordnet (Stub)');
        return {
            orderId: `nordnet_close_${Date.now()}`,
            status: 'accepted',
            filledQuantity: 0,
            filledPrice: 0,
        };
    }

    async closeAllPositions(): Promise<BrokerOrderResult[]> {
        return [];
    }
}
