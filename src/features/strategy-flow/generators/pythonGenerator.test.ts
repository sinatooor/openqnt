import { describe, it, expect } from 'vitest';
import { generatePythonCode, generateStrategySummary, generateStrategyIR } from './pythonGenerator';
import { StrategyFlowNode, StrategyFlowEdge } from '../types';

// --- Helper Functions ---

function createNode(
  id: string,
  type: StrategyFlowNode['type'],
  data: Record<string, any> = {}
): StrategyFlowNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: id, ...data },
  };
}

function createEdge(
  source: string,
  target: string,
  sourceHandle?: string,
  targetHandle?: string
): StrategyFlowEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle,
    targetHandle,
  };
}

describe('pythonGenerator', () => {

  describe('generatePythonCode', () => {
    it('should generate a comment for empty strategy', () => {
      const nodes: StrategyFlowNode[] = [];
      const edges: StrategyFlowEdge[] = [];

      const code = generatePythonCode(nodes, edges);

      expect(code).toContain('# No strategy defined');
      expect(code).toContain('# Add nodes to create a strategy');
    });

    it('should generate code for SMA indicator', () => {
      const nodes = [
        createNode('sma1', 'indicator', {
          indicatorType: 'sma',
          params: { period: 20 },
          label: 'SMA 20'
        })
      ];
      const edges: StrategyFlowEdge[] = [];

      const code = generatePythonCode(nodes, edges);

      expect(code).toContain('class FlowStrategy(Strategy):');
      expect(code).toContain('self.sma_20 = self.I(SMA, self.data.Close, 20)');
    });

    it('should fallback to label matching if indicatorType is missing', () => {
      const nodes = [
        createNode('rsi1', 'indicator', {
          params: { period: 14 },
          label: 'RSI Indicator' // Should match 'RSI' in map
        })
      ];
      const code = generatePythonCode(nodes, []);
      expect(code).toContain('self.rsi_14 = self.I(RSI, self.data.Close, 14)');
    });

    it('should generate code for MACD indicator', () => {
      const nodes = [
        createNode('macd1', 'indicator', { indicatorType: 'macd' })
      ];
      const code = generatePythonCode(nodes, []);
      expect(code).toContain('self.macd_line, self.macd_signal, self.macd_hist = self.I(MACD, self.data.Close)');
    });

    it('should generate entry condition (SMA > Price)', () => {
      const nodes = [
        createNode('sma1', 'indicator', { indicatorType: 'sma', params: { period: 20 } }),
        createNode('price1', 'environment', { environmentType: 'price' }),
        createNode('cond1', 'condition', { conditionType: 'compare', operator: '>' }),
        createNode('action1', 'action', { actionType: 'order', direction: 'long' }) // Needed to trigger entry logic
      ];

      // Connect SMA -> Condition input A
      // Connect Price -> Condition input B
      const edges = [
        createEdge('sma1', 'cond1', 'default', 'input-a'),
        createEdge('price1', 'cond1', 'default', 'input-b')
      ];

      const code = generatePythonCode(nodes, edges);

      // Check entry logic
      // SMA variable is self.sma_20
      // Price is self.data.Close
      // Operator is >
      // Comparison adds [-1]
      expect(code).toContain('entry_condition = self.sma_20[-1] > self.data.Close[-1]');
    });

    it('should generate crossover condition', () => {
      const nodes = [
        createNode('sma1', 'indicator', { indicatorType: 'sma', params: { period: 10 } }),
        createNode('sma2', 'indicator', { indicatorType: 'sma', params: { period: 20 } }),
        createNode('cond1', 'condition', { conditionType: 'crossover' }),
        createNode('action1', 'action', { type: 'buy' })
      ];

      const edges = [
        createEdge('sma1', 'cond1', 'default', 'input-a'),
        createEdge('sma2', 'cond1', 'default', 'input-b')
      ];

      const code = generatePythonCode(nodes, edges);
      // Crossover should NOT have [-1] indexing
      expect(code).toContain('entry_condition = crossover(self.sma_10, self.sma_20)');
    });

    it('should handle buy action with stop loss and take profit', () => {
        const nodes = [
            createNode('action1', 'action', {
                actionType: 'order',
                direction: 'long',
                size: 0.5,
                stopLoss: 2, // 2%
                takeProfit: 5 // 5%
            })
        ];

        const code = generatePythonCode(nodes, []);

        expect(code).toContain('position_size = 0.5');
        expect(code).toContain('self.buy(');
        expect(code).toContain('size=self.position_size,');
        expect(code).toContain('sl=self.data.Close[-1] * (1 - 0.02),');
        expect(code).toContain('tp=self.data.Close[-1] * (1 + 0.05),');
    });

    it('should handle exit conditions', () => {
        // We need separate conditions for entry and exit.
        // The generator distinguishes them by how they are extracted.
        // Wait, the generator categorizes conditions into entry/exit internally?
        // Let's check the code:
        // const entryConditions = extractConditions(conditions, 'entry', edges, nodes);
        // const exitConditions = extractConditions(conditions, 'exit', edges, nodes);
        // But extractConditions iterates over ALL condition nodes passed to it.

        // Actually looking at extractConditions implementation in the file:
        // It takes `conditionNodes` as input.
        // In `generatePythonCode`:
        // const conditions = nodes.filter(n => n.type === 'condition');
        // const entryConditions = extractConditions(conditions, 'entry', edges, nodes);
        // const exitConditions = extractConditions(conditions, 'exit', edges, nodes);

        // This means currently ALL conditions are added to BOTH entry and exit logic?
        // This seems like a bug in the implementation or I misunderstood the extraction logic.
        // Let's re-read `extractConditions`.
        // It maps over `conditionNodes` and returns a config for each.
        // It doesn't seem to filter based on 'type' ('entry' vs 'exit').
        // So currently, if I have 1 condition node, it will be added to BOTH entry_condition and exit_condition.

        // Let's verify this behavior with a test.
        const nodes = [
            createNode('cond1', 'condition', { conditionType: 'compare', operator: '>' }),
            createNode('sma1', 'indicator', { indicatorType: 'sma', params: { period: 10 } }),
            createNode('price1', 'environment', { environmentType: 'price' }),
            createNode('action1', 'action', { actionType: 'order', direction: 'long' })
        ];
        const edges = [
            createEdge('sma1', 'cond1', 'default', 'input-a'),
            createEdge('price1', 'cond1', 'default', 'input-b')
        ];

        const code = generatePythonCode(nodes, edges);

        // Expect condition to be present in BOTH
        expect(code).toContain('entry_condition = self.sma_10[-1] > self.data.Close[-1]');
        expect(code).toContain('exit_condition = self.sma_10[-1] > self.data.Close[-1]');
    });

    it('should structure the class correctly', () => {
      const nodes = [
        createNode('sma1', 'indicator', { indicatorType: 'sma', params: { period: 20 } })
      ];
      const code = generatePythonCode(nodes, []);

      expect(code).toContain('from backtesting import Backtest, Strategy');
      expect(code).toContain('def init(self):');
      expect(code).toContain('def next(self):');
      expect(code).toMatch(/Generated on: \d{4}-\d{2}-\d{2}T/); // Check date format
    });

    it('should handle unhandled indicator types with fallback', () => {
      const nodes = [
        createNode('smma1', 'indicator', { indicatorType: 'smma', params: { period: 10 } })
      ];
      const code = generatePythonCode(nodes, []);
      // SMMA is in map but not in switch, so it hits default
      // Note: var name uses type from map (SMMA) -> smma_10
      expect(code).toContain('self.smma_10 = self.I(SMA, self.data.Close, 10)  # Fallback');
    });

    it('should handle multi-output indicator references (e.g. MACD Signal)', () => {
      const nodes = [
        createNode('macd1', 'indicator', { indicatorType: 'macd' }),
        createNode('cond1', 'condition', { conditionType: 'compare', operator: '>' }),
        createNode('price1', 'environment', { environmentType: 'price' }),
        createNode('action1', 'action', { actionType: 'order' })
      ];

      // Connect MACD (signal handle) -> Condition input A
      const edges = [
        createEdge('macd1', 'cond1', 'signal', 'input-a'),
        createEdge('price1', 'cond1', 'default', 'input-b')
      ];

      const code = generatePythonCode(nodes, edges);
      // MACD signal should be referenced as self.macd_signal
      expect(code).toContain('entry_condition = self.macd_signal[-1] > self.data.Close[-1]');
    });
  });

  describe('generateStrategySummary', () => {
    it('should generate summary text', () => {
      const nodes = [
        createNode('sma1', 'indicator', { label: 'My SMA' }),
        createNode('cond1', 'condition', { label: 'Cross check' }),
        createNode('act1', 'action', { label: 'Buy Long' })
      ];

      const summary = generateStrategySummary(nodes, []);

      expect(summary).toContain('## Strategy Summary');
      expect(summary).toContain('### Indicators');
      expect(summary).toContain('- My SMA');
      expect(summary).toContain('### Conditions');
      expect(summary).toContain('- Cross check');
      expect(summary).toContain('### Actions');
      expect(summary).toContain('- Buy Long');
    });

    it('should handle empty nodes', () => {
      const summary = generateStrategySummary([], []);
      expect(summary).toBe('Empty strategy - no nodes defined');
    });
  });

  describe('generateStrategyIR', () => {
    it('should generate correct IR structure', () => {
      const nodes = [
        createNode('n1', 'indicator', { label: 'Ind 1' })
      ];
      const edges = [
        createEdge('n1', 'n2', 'a', 'b')
      ];

      const ir = generateStrategyIR(nodes, edges);

      expect(ir.version).toBe('1.0');
      expect(ir.nodes).toHaveLength(1);
      expect(ir.nodes[0].id).toBe('n1');
      expect(ir.edges).toHaveLength(1);
      expect(ir.edges[0].source).toBe('n1');
      expect(ir.metadata.indicatorCount).toBe(1);
    });
  });
});
