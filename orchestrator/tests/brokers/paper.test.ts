/**
 * Broker Gateway + Paper Client Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PaperClient } from '../../src/brokers/paper.js';

describe('PaperClient', () => {
    let client: PaperClient;

    beforeEach(async () => {
        client = new PaperClient();
        await client.connect('test-key');
    });

    it('should connect and report as connected', () => {
        expect(client.isConnected()).toBe(true);
        expect(client.name).toBe('paper');
    });

    it('should return initial account with $100k cash', async () => {
        const account = await client.getAccount();
        expect(account.accountId).toBe('paper-account');
        expect(account.cash).toBe(100000);
        expect(account.equity).toBe(100000);
        expect(account.status).toBe('active');
    });

    it('should execute a buy order and update positions', async () => {
        const result = await client.submitOrder({
            symbol: 'AAPL',
            side: 'buy',
            type: 'limit',
            quantity: 10,
            limitPrice: 150,
        });

        expect(result.status).toBe('accepted');
        expect(result.filledQuantity).toBe(10);
        expect(result.filledPrice).toBe(150);

        const positions = await client.getPositions();
        expect(positions).toHaveLength(1);
        expect(positions[0].symbol).toBe('AAPL');
        expect(positions[0].quantity).toBe(10);

        const account = await client.getAccount();
        expect(account.cash).toBe(100000 - 150 * 10);
    });

    it('should reject buy order with insufficient funds', async () => {
        const result = await client.submitOrder({
            symbol: 'EXPENSIVE',
            side: 'buy',
            type: 'limit',
            quantity: 1000,
            limitPrice: 200,
        });
        expect(result.status).toBe('rejected');
        expect(result.message).toContain('Insufficient');
    });

    it('should execute a sell order and reduce position', async () => {
        await client.submitOrder({ symbol: 'TSLA', side: 'buy', type: 'limit', quantity: 20, limitPrice: 200 });
        const sellResult = await client.submitOrder({ symbol: 'TSLA', side: 'sell', type: 'limit', quantity: 5, limitPrice: 220 });

        expect(sellResult.status).toBe('accepted');
        const positions = await client.getPositions();
        expect(positions[0].quantity).toBe(15);
    });

    it('should close a position', async () => {
        await client.submitOrder({ symbol: 'MSFT', side: 'buy', type: 'limit', quantity: 10, limitPrice: 300 });
        await client.closePosition('MSFT');
        const positions = await client.getPositions();
        expect(positions.find(p => p.symbol === 'MSFT')).toBeUndefined();
    });

    it('should close all positions', async () => {
        await client.submitOrder({ symbol: 'AAPL', side: 'buy', type: 'limit', quantity: 5, limitPrice: 150 });
        await client.submitOrder({ symbol: 'GOOGL', side: 'buy', type: 'limit', quantity: 3, limitPrice: 100 });
        await client.closeAllPositions();
        const positions = await client.getPositions();
        expect(positions).toHaveLength(0);
    });

    it('should disconnect', async () => {
        await client.disconnect();
        expect(client.isConnected()).toBe(false);
    });

    it('should return empty open orders (paper fills instantly)', async () => {
        const orders = await client.getOpenOrders();
        expect(orders).toHaveLength(0);
    });
});
