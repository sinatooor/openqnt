import { describe, it, expect } from 'vitest';
import { FlowInterpreter, type EvaluationContext, type Bar } from '../../src/engine/interpreter.js';
import { compileFlowStrategy } from '../../src/engine/compiler.js';
import type { FlowNode, FlowEdge } from '../../src/engine/types.js';

// ─── Test Fixtures ───────────────────────────────────────────

const testBar: Bar = {
    timestamp: '2024-01-15T14:30:00Z',
    open: 150.0,
    high: 155.0,
    low: 148.0,
    close: 152.5,
    volume: 10000,
    symbol: 'AAPL',
};

function createContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
    return {
        bar: testBar,
        history: [testBar],
        index: 0,
        portfolio: { cash: 10000, equity: 15000, positions: {} },
        variables: {},
        indicatorCache: {},
        riskConfig: {},
        ...overrides,
    };
}

const envNode: FlowNode = {
    id: 'env-1', type: 'environment', position: { x: 0, y: 0 },
    data: { environmentType: 'price' },
};

const mathConst: FlowNode = {
    id: 'math-const', type: 'math', position: { x: 0, y: 100 },
    data: { mathType: 'number', value: 30 },
};

const condNode: FlowNode = {
    id: 'cond-1', type: 'condition', position: { x: 200, y: 0 },
    data: { conditionType: 'compare', operator: '>' },
};

const actionNode: FlowNode = {
    id: 'action-1', type: 'action', position: { x: 400, y: 0 },
    data: { actionType: 'order', direction: 'long', size: 10 },
};

// ─── Interpreter Tests ───────────────────────────────────────

describe('FlowInterpreter', () => {
    it('evaluates a simple price > threshold → buy strategy', async () => {
        const nodes: FlowNode[] = [envNode, mathConst, condNode, actionNode];
        const edges: FlowEdge[] = [
            { id: 'e1', source: 'env-1', target: 'cond-1', targetHandle: 'input-a' },
            { id: 'e2', source: 'math-const', target: 'cond-1', targetHandle: 'input-b' },
            { id: 'e3', source: 'cond-1', target: 'action-1', targetHandle: 'trigger' },
        ];
        const compiled = compileFlowStrategy(nodes, edges, { symbol: 'AAPL' });
        const interpreter = new FlowInterpreter(compiled.compiled);

        const result = await interpreter.evaluate(createContext());

        expect(result.orderIntents).toHaveLength(1);
        expect(result.orderIntents[0].side).toBe('BUY');
        expect(result.orderIntents[0].size).toBe(10);
        expect(result.orderIntents[0].symbol).toBe('AAPL');
        expect(result.nodesExecuted).toBe(4);
        expect(result.nodesErrored).toBe(0);
    });

    it('skips action when condition is false', async () => {
        // Price is 152.5, threshold 200 → should NOT trigger
        const highThreshold: FlowNode = {
            ...mathConst,
            id: 'math-high',
            data: { mathType: 'number', value: 200 },
        };
        const nodes: FlowNode[] = [envNode, highThreshold, condNode, actionNode];
        const edges: FlowEdge[] = [
            { id: 'e1', source: 'env-1', target: 'cond-1', targetHandle: 'input-a' },
            { id: 'e2', source: 'math-high', target: 'cond-1', targetHandle: 'input-b' },
            { id: 'e3', source: 'cond-1', target: 'action-1', targetHandle: 'trigger' },
        ];
        const compiled = compileFlowStrategy(nodes, edges);
        const interpreter = new FlowInterpreter(compiled.compiled);

        const result = await interpreter.evaluate(createContext());

        expect(result.orderIntents).toHaveLength(0);
        expect(result.nodesSkipped).toBeGreaterThan(0);
    });

    it('handles math operations correctly', async () => {
        const mathAdd: FlowNode = {
            id: 'math-add', type: 'math', position: { x: 200, y: 0 },
            data: { mathType: 'add' },
        };
        const const10: FlowNode = {
            id: 'const-10', type: 'math', position: { x: 0, y: 0 },
            data: { mathType: 'number', value: 10 },
        };
        const const20: FlowNode = {
            id: 'const-20', type: 'math', position: { x: 0, y: 100 },
            data: { mathType: 'number', value: 20 },
        };

        const nodes: FlowNode[] = [const10, const20, mathAdd, actionNode];
        const edges: FlowEdge[] = [
            { id: 'e1', source: 'const-10', target: 'math-add', targetHandle: 'input-a' },
            { id: 'e2', source: 'const-20', target: 'math-add', targetHandle: 'input-b' },
        ];
        const compiled = compileFlowStrategy(nodes, edges);
        const interpreter = new FlowInterpreter(compiled.compiled);

        const result = await interpreter.evaluate(createContext());
        const mathOutput = result.outputs['math-add'];
        expect(mathOutput.output).toBe(30);
    });

    it('handles variable set/get', async () => {
        const setVar: FlowNode = {
            id: 'set-var', type: 'variable', position: { x: 0, y: 0 },
            data: { variableType: 'setVariable', variableName: 'counter', value: 42 },
        };
        const getVar: FlowNode = {
            id: 'get-var', type: 'variable', position: { x: 200, y: 0 },
            data: { variableType: 'getVariable', variableName: 'counter' },
        };

        const nodes: FlowNode[] = [setVar, getVar, actionNode];
        const edges: FlowEdge[] = [
            { id: 'e1', source: 'set-var', target: 'get-var' },
        ];
        const compiled = compileFlowStrategy(nodes, edges);
        const interpreter = new FlowInterpreter(compiled.compiled);

        const result = await interpreter.evaluate(createContext());
        expect(result.outputs['get-var'].output).toBe(42);
    });

    it('evaluates environment nodes correctly', async () => {
        const timeNode: FlowNode = {
            id: 'env-time', type: 'environment', position: { x: 0, y: 0 },
            data: { environmentType: 'time' },
        };
        const priceNode: FlowNode = {
            id: 'env-price', type: 'environment', position: { x: 0, y: 100 },
            data: { environmentType: 'price' },
        };

        const nodes: FlowNode[] = [timeNode, priceNode, actionNode];
        const compiled = compileFlowStrategy(nodes, []);
        const interpreter = new FlowInterpreter(compiled.compiled);

        const result = await interpreter.evaluate(createContext());
        expect(result.outputs['env-time'].output).toBe(testBar.timestamp);
        expect(result.outputs['env-price'].output).toBe(152.5);
    });

    it('generates node logs for every node', async () => {
        const nodes: FlowNode[] = [envNode, mathConst, condNode, actionNode];
        const edges: FlowEdge[] = [
            { id: 'e1', source: 'env-1', target: 'cond-1', targetHandle: 'input-a' },
            { id: 'e2', source: 'math-const', target: 'cond-1', targetHandle: 'input-b' },
            { id: 'e3', source: 'cond-1', target: 'action-1', targetHandle: 'trigger' },
        ];
        const compiled = compileFlowStrategy(nodes, edges);
        const interpreter = new FlowInterpreter(compiled.compiled);

        const result = await interpreter.evaluate(createContext());

        expect(result.nodeLogs).toHaveLength(4);
        expect(result.nodeLogs.every((l) => l.durationMs >= 0)).toBe(true);
        expect(result.nodeLogs.every((l) => l.status === 'success')).toBe(true);
    });

    it('handles AND condition correctly', async () => {
        const trueConst: FlowNode = {
            id: 'c-true', type: 'environment', position: { x: 0, y: 0 },
            data: { environmentType: 'isMarketOpen' },
        };
        const falseCondition: FlowNode = {
            id: 'cond-false', type: 'condition', position: { x: 100, y: 100 },
            data: { conditionType: 'compare', operator: '<', value: 100 },
        };
        const andNode: FlowNode = {
            id: 'and-1', type: 'condition', position: { x: 200, y: 0 },
            data: { conditionType: 'and' },
        };

        const nodes: FlowNode[] = [envNode, trueConst, falseCondition, andNode, actionNode];
        const edges: FlowEdge[] = [
            { id: 'e0', source: 'env-1', target: 'cond-false', targetHandle: 'input-a' },
            { id: 'e1', source: 'c-true', target: 'and-1', targetHandle: 'input-a' },
            { id: 'e2', source: 'cond-false', target: 'and-1', targetHandle: 'input-b' },
            { id: 'e3', source: 'and-1', target: 'action-1', targetHandle: 'trigger' },
        ];
        const compiled = compileFlowStrategy(nodes, edges);
        const interpreter = new FlowInterpreter(compiled.compiled);

        const result = await interpreter.evaluate(createContext());
        // Price 152.5 is NOT < 100, so falseCondition is false
        // true AND false = false → no order
        expect(result.orderIntents).toHaveLength(0);
    });

    it('handles sell direction', async () => {
        const sellAction: FlowNode = {
            ...actionNode,
            id: 'action-sell',
            data: { actionType: 'order', direction: 'short', size: 5 },
        };
        const nodes: FlowNode[] = [envNode, sellAction];
        const edges: FlowEdge[] = [];
        const compiled = compileFlowStrategy(nodes, edges);
        const interpreter = new FlowInterpreter(compiled.compiled);

        const result = await interpreter.evaluate(createContext());
        expect(result.orderIntents).toHaveLength(1);
        expect(result.orderIntents[0].side).toBe('SELL');
        expect(result.orderIntents[0].size).toBe(5);
    });
});
