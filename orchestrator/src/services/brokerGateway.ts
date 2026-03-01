/**
 * Broker Gateway — abstract interface for all broker integrations.
 * Each broker implements this interface. The gateway routes orders
 * to the correct broker based on the portfolio's broker configuration.
 */

import { logger } from '../utils/logger.js';
import type { Bar } from '../engine/interpreter.js';
import { AlpacaClient } from '../brokers/alpaca.js';
import { PaperClient } from '../brokers/paper.js';
import { IGClient } from '../brokers/ig.js';
import { IbkrClient } from '../brokers/ibkr.js';
import { NordnetClient } from '../brokers/nordnet.js';

// ─── Broker Interface ────────────────────────────────────────

export interface BrokerOrder {
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    quantity: number;
    limitPrice?: number;
    stopPrice?: number;
    timeInForce?: 'day' | 'gtc' | 'ioc' | 'fok';
    clientOrderId?: string;
}

export interface BrokerOrderResult {
    orderId: string;
    status: 'accepted' | 'rejected' | 'pending';
    filledQuantity: number;
    filledPrice: number;
    message?: string;
    rawResponse?: Record<string, any>;
}

export interface BrokerPosition {
    symbol: string;
    side: 'long' | 'short';
    quantity: number;
    avgEntryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    marketValue: number;
}

export interface BrokerAccountInfo {
    accountId: string;
    cash: number;
    equity: number;
    buyingPower: number;
    dayTradesRemaining?: number;
    status: string;
}

export interface BrokerClient {
    name: string;

    // Authentication
    connect(apiKey: string, apiSecret?: string): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;

    // Account
    getAccount(): Promise<BrokerAccountInfo>;

    // Orders
    submitOrder(order: BrokerOrder): Promise<BrokerOrderResult>;
    cancelOrder(orderId: string): Promise<void>;
    getOpenOrders(): Promise<BrokerOrderResult[]>;

    // Positions
    getPositions(): Promise<BrokerPosition[]>;
    closePosition(symbol: string): Promise<BrokerOrderResult>;
    closeAllPositions(): Promise<BrokerOrderResult[]>;

    // Market Data
    getBars(symbol: string, timeframe: string, limit: number): Promise<Bar[]>;
}

// ─── Broker Registry ─────────────────────────────────────────

const brokerRegistry = new Map<string, () => BrokerClient>();

export function registerBroker(name: string, factory: () => BrokerClient): void {
    brokerRegistry.set(name, factory);
    logger.info({ broker: name }, 'Broker registered');
}

export function getBrokerClient(name: string): BrokerClient {
    const factory = brokerRegistry.get(name);
    if (!factory) {
        throw new Error(`Broker "${name}" not registered. Available: ${[...brokerRegistry.keys()].join(', ')}`);
    }
    return factory();
}

export function getAvailableBrokers(): string[] {
    return [...brokerRegistry.keys()];
}

// ─── Initialize Registry ─────────────────────────────────────
registerBroker('alpaca', () => new AlpacaClient());
registerBroker('paper', () => new PaperClient());
registerBroker('ig', () => new IGClient());
registerBroker('ibkr', () => new IbkrClient());
registerBroker('nordnet', () => new NordnetClient());
