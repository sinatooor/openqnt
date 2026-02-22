import { describe, it, expect } from 'vitest';
import { topologicalSort, validateFlowStrategy, compileFlowStrategy } from '../../src/engine/compiler.js';
import type { FlowNode, FlowEdge } from '../../src/engine/types.js';

// ─── Test Fixtures ───────────────────────────────────────────

const envNode: FlowNode = {
    id: 'env-1',
    type: 'environment',
    position: { x: 0, y: 0 },
    data: { label: 'Price', environmentType: 'price' },
};

const indicatorNode: FlowNode = {
    id: 'ind-1',
    type: 'indicator',
    position: { x: 200, y: 0 },
    data: { label: 'RSI', indicatorType: 'rsi', params: { period: 14 } },
};

const macdNode: FlowNode = {
    id: 'ind-macd',
    type: 'indicator',
    position: { x: 200, y: 100 },
    data: { label: 'MACD', indicatorType: 'macd', params: { fast: 12, slow: 26, signal: 9 } },
};

const conditionNode: FlowNode = {
    id: 'cond-1',
    type: 'condition',
    position: { x: 400, y: 0 },
    data: { label: 'RSI < 30', conditionType: 'compare', operator: 'lt', value: 30 },
};

const actionNode: FlowNode = {
    id: 'action-1',
    type: 'action',
    position: { x: 600, y: 0 },
    data: { label: 'Buy $500', actionType: 'order', direction: 'buy', size: 500 },
};

const mathNode: FlowNode = {
    id: 'math-1',
    type: 'math',
    position: { x: 300, y: 100 },
    data: { label: '42', mathType: 'number', value: 42 },
};

const controlNode: FlowNode = {
    id: 'ctrl-1',
    type: 'control',
    position: { x: 500, y: 100 },
    data: { label: 'If', controlType: 'if' },
};

const llmNode: FlowNode = {
    id: 'llm-1',
    type: 'llm',
    position: { x: 400, y: 200 },
    data: { label: 'Analyze', prompt: 'Analyze the market' },
};

const basicEdges: FlowEdge[] = [
    { id: 'e1', source: 'env-1', target: 'ind-1' },
    { id: 'e2', source: 'ind-1', target: 'cond-1' },
    { id: 'e3', source: 'cond-1', target: 'action-1' },
];

// ─── Topological Sort ────────────────────────────────────────

describe('topologicalSort', () => {
    it('sorts a linear graph correctly', () => {
        const nodes = [envNode, indicatorNode, conditionNode, actionNode];
        const { order, hasCycle } = topologicalSort(nodes, basicEdges);
        expect(hasCycle).toBe(false);
        expect(order.indexOf('env-1')).toBeLessThan(order.indexOf('ind-1'));
        expect(order.indexOf('ind-1')).toBeLessThan(order.indexOf('cond-1'));
        expect(order.indexOf('cond-1')).toBeLessThan(order.indexOf('action-1'));
    });

    it('detects a cycle', () => {
        const nodes = [envNode, indicatorNode];
        const cycleEdges: FlowEdge[] = [
            { id: 'e1', source: 'env-1', target: 'ind-1' },
            { id: 'e2', source: 'ind-1', target: 'env-1' },
        ];
        const { hasCycle } = topologicalSort(nodes, cycleEdges);
        expect(hasCycle).toBe(true);
    });

    it('handles disconnected nodes', () => {
        const nodes = [envNode, mathNode];
        const { order, hasCycle } = topologicalSort(nodes, []);
        expect(hasCycle).toBe(false);
        expect(order).toHaveLength(2);
        expect(order).toContain('env-1');
        expect(order).toContain('math-1');
    });

    it('returns all nodes even with cycle', () => {
        const nodes = [envNode, indicatorNode, conditionNode];
        const cycleEdges: FlowEdge[] = [
            { id: 'e1', source: 'env-1', target: 'ind-1' },
            { id: 'e2', source: 'ind-1', target: 'cond-1' },
            { id: 'e3', source: 'cond-1', target: 'ind-1' },
        ];
        const { order } = topologicalSort(nodes, cycleEdges);
        expect(order).toHaveLength(3);
    });
});

// ─── Validation ──────────────────────────────────────────────

describe('validateFlowStrategy', () => {
    it('validates a valid strategy', () => {
        const nodes = [envNode, indicatorNode, conditionNode, actionNode];
        const result = validateFlowStrategy(nodes, basicEdges);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('rejects empty strategy', () => {
        const result = validateFlowStrategy([], []);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('no nodes');
    });

    it('requires an action node', () => {
        const nodes = [envNode, indicatorNode, conditionNode];
        const edges: FlowEdge[] = [
            { id: 'e1', source: 'env-1', target: 'ind-1' },
            { id: 'e2', source: 'ind-1', target: 'cond-1' },
        ];
        const result = validateFlowStrategy(nodes, edges);
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes('action'))).toBe(true);
    });

    it('requires a data source node', () => {
        const nodes = [conditionNode, actionNode];
        const edges: FlowEdge[] = [
            { id: 'e1', source: 'cond-1', target: 'action-1' },
        ];
        const result = validateFlowStrategy(nodes, edges);
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes('indicator or environment'))).toBe(true);
    });

    it('warns when no condition/control nodes', () => {
        const nodes = [envNode, actionNode];
        const edges: FlowEdge[] = [
            { id: 'e1', source: 'env-1', target: 'action-1' },
        ];
        const result = validateFlowStrategy(nodes, edges);
        expect(result.warnings.some((w) => w.includes('No condition/control'))).toBe(true);
    });

    it('detects type mismatch', () => {
        // Connect a number output to a boolean-only input (and gate)
        const andNode: FlowNode = {
            id: 'and-1',
            type: 'condition',
            position: { x: 300, y: 0 },
            data: { conditionType: 'and' },
        };
        const nodes = [envNode, andNode, actionNode];
        // Env price outputs number, and gate expects boolean
        const edges: FlowEdge[] = [
            { id: 'e1', source: 'env-1', target: 'and-1', sourceHandle: null, targetHandle: 'input-a' },
            { id: 'e2', source: 'and-1', target: 'action-1' },
        ];
        const result = validateFlowStrategy(nodes, edges);
        expect(result.errors.some((e) => e.includes('Type mismatch'))).toBe(true);
    });

    it('detects cycle and reports error', () => {
        const nodes = [envNode, indicatorNode, conditionNode, actionNode];
        const cycleEdges: FlowEdge[] = [
            ...basicEdges,
            { id: 'e4', source: 'action-1', target: 'env-1' },
        ];
        const result = validateFlowStrategy(nodes, cycleEdges);
        expect(result.errors.some((e) => e.includes('Cycle'))).toBe(true);
    });

    it('allows cycles when setting is enabled', () => {
        const nodes = [envNode, indicatorNode, conditionNode, actionNode];
        const cycleEdges: FlowEdge[] = [
            ...basicEdges,
            { id: 'e4', source: 'action-1', target: 'env-1' },
        ];
        const result = validateFlowStrategy(nodes, cycleEdges, { allowCycles: true });
        expect(result.errors.filter((e) => e.includes('Cycle'))).toHaveLength(0);
    });

    it('warns about missing LLM prompt', () => {
        const noPromptLlm: FlowNode = {
            id: 'llm-x',
            type: 'llm',
            position: { x: 0, y: 0 },
            data: {},
        };
        const nodes = [envNode, noPromptLlm, actionNode];
        const edges: FlowEdge[] = [
            { id: 'e1', source: 'env-1', target: 'llm-x' },
            { id: 'e2', source: 'llm-x', target: 'action-1' },
        ];
        const result = validateFlowStrategy(nodes, edges);
        expect(result.warnings.some((w) => w.includes('missing a prompt'))).toBe(true);
    });
});

// ─── Compiler ────────────────────────────────────────────────

describe('compileFlowStrategy', () => {
    it('compiles a valid strategy', () => {
        const nodes = [envNode, indicatorNode, conditionNode, actionNode];
        const result = compileFlowStrategy(nodes, basicEdges, { name: 'Test Strategy' });

        expect(result.compiled.version).toBe('2.0.0');
        expect(result.compiled.name).toBe('Test Strategy');
        expect(result.compiled.nodes).toHaveLength(4);
        expect(result.compiled.edges).toHaveLength(3);
        expect(result.compiled.nodeOrder).toHaveLength(4);
        expect(result.validation.isValid).toBe(true);
    });

    it('builds correct inputs map', () => {
        const nodes = [envNode, indicatorNode, conditionNode, actionNode];
        const result = compileFlowStrategy(nodes, basicEdges);

        // ind-1 should have env-1 as input
        expect(result.compiled.inputs['ind-1']).toBeDefined();
        // cond-1 should have ind-1 as input
        expect(result.compiled.inputs['cond-1']).toBeDefined();
        // env-1 should have no inputs
        expect(Object.keys(result.compiled.inputs['env-1'])).toHaveLength(0);
    });

    it('collects indicator definitions', () => {
        const nodes = [envNode, indicatorNode, macdNode, conditionNode, actionNode];
        const edges: FlowEdge[] = [
            ...basicEdges,
            { id: 'e4', source: 'ind-macd', target: 'cond-1', sourceHandle: 'line' },
        ];
        const result = compileFlowStrategy(nodes, edges);

        expect(result.compiled.indicatorDefs).toHaveLength(2);
        expect(result.compiled.indicatorDefs[0].indicatorType).toBe('rsi');
        expect(result.compiled.indicatorDefs[1].indicatorType).toBe('macd');
    });

    it('compiles even with validation errors', () => {
        // No action node → invalid, but still compiles
        const nodes = [envNode, indicatorNode];
        const edges: FlowEdge[] = [{ id: 'e1', source: 'env-1', target: 'ind-1' }];
        const result = compileFlowStrategy(nodes, edges);

        expect(result.validation.isValid).toBe(false);
        expect(result.compiled.nodes).toHaveLength(2);
        expect(result.compiled.nodeOrder).toHaveLength(2);
    });

    it('preserves node order in topological sequence', () => {
        const nodes = [envNode, indicatorNode, conditionNode, actionNode];
        const result = compileFlowStrategy(nodes, basicEdges);
        const order = result.compiled.nodeOrder;
        expect(order.indexOf('env-1')).toBeLessThan(order.indexOf('ind-1'));
        expect(order.indexOf('ind-1')).toBeLessThan(order.indexOf('cond-1'));
        expect(order.indexOf('cond-1')).toBeLessThan(order.indexOf('action-1'));
    });

    it('uses default name when settings not provided', () => {
        const nodes = [envNode, indicatorNode, conditionNode, actionNode];
        const result = compileFlowStrategy(nodes, basicEdges);
        expect(result.compiled.name).toBe('FlowStrategy');
    });
});
