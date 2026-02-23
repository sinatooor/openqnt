/**
 * Broker Gateway Registry Tests
 */

import { describe, it, expect } from 'vitest';
import { registerBroker, getBrokerClient, getAvailableBrokers } from '../../src/services/brokerGateway.js';
import { PaperClient } from '../../src/brokers/paper.js';

describe('BrokerGateway', () => {
    it('should register and retrieve a broker', () => {
        registerBroker('test-paper', () => new PaperClient());
        const client = getBrokerClient('test-paper');
        expect(client).toBeInstanceOf(PaperClient);
        expect(client.name).toBe('paper');
    });

    it('should list available brokers', () => {
        registerBroker('test-alpaca', () => new PaperClient());
        const brokers = getAvailableBrokers();
        expect(brokers).toContain('test-paper');
        expect(brokers).toContain('test-alpaca');
    });

    it('should throw for unknown broker', () => {
        expect(() => getBrokerClient('nonexistent')).toThrow('not registered');
    });
});
