import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeStrategy } from '../src/services/executionService.js';
import { prisma } from '../src/config/database.js';
import * as brokerGateway from '../src/services/brokerGateway.js';
import * as computeClient from '../src/services/computeClient.js';
import type { Bar } from '../src/engine/interpreter.js';

// Mock dependencies
vi.mock('../src/config/database.js', () => ({
  prisma: {
    strategy: { findUnique: vi.fn() },
    agentConfig: { findUnique: vi.fn() },
    executionRun: { create: vi.fn(), update: vi.fn() },
    executionNodeLog: { createMany: vi.fn() },
    portfolio: { findFirst: vi.fn() },
  },
}));

vi.mock('../src/services/brokerGateway.js', () => ({
  getBrokerClient: vi.fn(),
}));

vi.mock('../src/services/computeClient.js', () => ({
  computeIndicators: vi.fn(),
}));

vi.mock('../src/services/notificationService.js', () => ({
  notificationQueue: { add: vi.fn() },
}));

vi.mock('../src/engine/preChecks.js', () => ({
  runPreChecks: vi.fn().mockReturnValue({ passed: true, failedChecks: [] }),
}));

// Mock logger to avoid clutter
vi.mock('../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Strategy Execution Flow', () => {
  const mockStrategyId = 'strat-123';
  const mockUserId = 'user-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch market data and compute indicators when execution starts', async () => {
    // Setup mocks
    const mockStrategy = {
      id: mockStrategyId,
      name: 'Test Strategy',
      nodes: [
        { id: '1', type: 'indicator', data: { indicatorType: 'rsi', period: 14 } },
        { id: '2', type: 'action', data: { actionType: 'order', symbol: 'SPY', size: 1 } },
      ],
      edges: [{ id: 'e1', source: '1', target: '2' }],
      settings: { symbol: 'SPY', timeframe: '60' },
    };

    const mockAgentConfig = {
      userId: mockUserId,
      operationalMode: 'autonomous',
      user: { preferences: {} },
    };

    const mockPortfolio = {
      userId: mockUserId,
      brokerName: 'alpaca',
      credentialAlias: 'alpaca-cred',
    };

    const mockBars: Bar[] = Array(200).fill(null).map((_, i) => ({
      timestamp: new Date().toISOString(),
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 102 + i,
      volume: 1000,
      symbol: 'SPY',
    }));

    (prisma.strategy.findUnique as any).mockResolvedValue(mockStrategy);
    (prisma.agentConfig.findUnique as any).mockResolvedValue(mockAgentConfig);
    (prisma.portfolio.findFirst as any).mockResolvedValue(mockPortfolio);
    (prisma.executionRun.create as any).mockResolvedValue({ id: 'run-789' });
    (prisma.executionRun.update as any).mockResolvedValue({});

    const mockBroker = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn(),
      getBars: vi.fn().mockResolvedValue(mockBars),
      submitOrder: vi.fn().mockResolvedValue({ status: 'accepted' }),
    };

    (brokerGateway.getBrokerClient as any).mockReturnValue(mockBroker);

    (computeClient.computeIndicators as any).mockResolvedValue({
      data: { values: { output: Array(200).fill(50) } }
    });

    // Execute
    await executeStrategy({
      strategyId: mockStrategyId,
      userId: mockUserId,
      triggerType: 'heartbeat',
    });

    // Verify Data Fetching
    expect(prisma.portfolio.findFirst).toHaveBeenCalledWith({ where: { userId: mockUserId } });
    expect(brokerGateway.getBrokerClient).toHaveBeenCalledWith('alpaca');
    expect(mockBroker.getBars).toHaveBeenCalledWith('SPY', '60', 200);

    // Verify Indicator Computation
    expect(computeClient.computeIndicators).toHaveBeenCalledWith(expect.objectContaining({
      indicatorType: 'rsi',
      params: { indicatorType: 'rsi', period: 14 },
      priceData: expect.any(Object),
    }));

    // Verify Execution Run Creation and Update
    expect(prisma.executionRun.create).toHaveBeenCalled();
    expect(prisma.executionRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
            where: { id: 'run-789' },
            data: expect.objectContaining({ status: 'success' })
        })
    );
  });
});
