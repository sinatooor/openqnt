/**
 * Flow strategy compiler and validator.
 * TypeScript port of backend/flow/compiler.py
 */

import { getNodeDefinition } from './definitions.js';
import type {
    FlowNode,
    FlowEdge,
    ValidationResult,
    CompilationResult,
    CompiledStrategy,
    InputsMap,
    InputSource,
    IndicatorDef,
} from './types.js';

// ─── Internal Helpers ────────────────────────────────────────

function nodeMap(nodes: FlowNode[]): Map<string, FlowNode> {
    return new Map(nodes.map((n) => [n.id, n]));
}

function edgeAdjacency(edges: FlowEdge[]): Map<string, string[]> {
    const adj = new Map<string, string[]>();
    for (const edge of edges) {
        const neighbors = adj.get(edge.source) ?? [];
        neighbors.push(edge.target);
        adj.set(edge.source, neighbors);
    }
    return adj;
}

// ─── Topological Sort (Kahn's Algorithm) ─────────────────────

export function topologicalSort(nodes: FlowNode[], edges: FlowEdge[]): { order: string[]; hasCycle: boolean } {
    const inDegree = new Map<string, number>();
    for (const node of nodes) {
        inDegree.set(node.id, 0);
    }

    const adj = edgeAdjacency(edges);

    for (const edge of edges) {
        inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
        if (degree === 0) {
            queue.push(nodeId);
        }
    }

    const order: string[] = [];
    while (queue.length > 0) {
        const nodeId = queue.shift()!;
        order.push(nodeId);
        for (const neighbor of adj.get(nodeId) ?? []) {
            const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
            inDegree.set(neighbor, newDegree);
            if (newDegree === 0) {
                queue.push(neighbor);
            }
        }
    }

    const hasCycle = order.length !== nodes.length;
    if (hasCycle) {
        // Append remaining nodes deterministically
        const remaining = nodes.filter((n) => !order.includes(n.id)).map((n) => n.id);
        order.push(...remaining);
    }

    return { order, hasCycle };
}

// ─── Port Type Resolution ────────────────────────────────────

function resolvePortType(node: FlowNode, handle: string | null | undefined, isOutput: boolean): string {
    const definition = getNodeDefinition(node.type, node.data);
    const ports = isOutput ? definition.outputs : definition.inputs;

    if (ports.length === 0) return 'any';

    if (handle) {
        const found = ports.find((p) => p.name === handle);
        if (found) return found.dataType;
    }

    return ports[0].dataType;
}

function isTypeCompatible(sourceType: string, targetType: string): boolean {
    if (sourceType === 'any' || targetType === 'any') return true;
    if (sourceType === targetType) return true;
    if (sourceType === 'signal' && targetType === 'boolean') return true;
    if (sourceType === 'boolean' && targetType === 'signal') return true;
    return false;
}

// ─── Validator ───────────────────────────────────────────────

export function validateFlowStrategy(
    rawNodes: Record<string, any>[],
    rawEdges: Record<string, any>[],
    settings?: Record<string, any>
): ValidationResult {
    const nodes: FlowNode[] = rawNodes.map((n) => n as FlowNode);
    const edges: FlowEdge[] = rawEdges.map((e) => e as FlowEdge);
    const nMap = nodeMap(nodes);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (nodes.length === 0) {
        errors.push('Strategy has no nodes.');
        return { isValid: false, errors, warnings };
    }

    // Required node types
    const hasAction = nodes.some((n) => n.type === 'action');
    const hasSignal = nodes.some((n) => n.type === 'condition' || n.type === 'control');
    const hasData = nodes.some((n) => n.type === 'indicator' || n.type === 'environment');

    if (!hasAction) {
        errors.push('Strategy must include at least one action node.');
    }
    if (!hasData) {
        errors.push('Strategy must include at least one indicator or environment node.');
    }
    if (!hasSignal && nodes.length > 1) {
        warnings.push('No condition/control nodes found; strategy may always execute.');
    }

    // Type checking and missing inputs
    const incomingByTarget = new Map<string, FlowEdge[]>();
    for (const edge of edges) {
        const list = incomingByTarget.get(edge.target) ?? [];
        list.push(edge);
        incomingByTarget.set(edge.target, list);

        const source = nMap.get(edge.source);
        const target = nMap.get(edge.target);
        if (!source || !target) {
            errors.push(`Edge ${edge.id} references missing nodes.`);
            continue;
        }

        const sourceType = resolvePortType(source, edge.sourceHandle, true);
        const targetType = resolvePortType(target, edge.targetHandle, false);
        if (!isTypeCompatible(sourceType, targetType)) {
            errors.push(`Type mismatch: ${source.id}(${sourceType}) -> ${target.id}(${targetType})`);
        }
    }

    for (const node of nodes) {
        const definition = getNodeDefinition(node.type, node.data);
        const requiredInputs = definition.inputs.filter((p) => p.required);

        for (const port of requiredInputs) {
            const edgesForNode = incomingByTarget.get(node.id) ?? [];
            const hasPort = edgesForNode.some(
                (e) => e.targetHandle === port.name || e.targetHandle == null
            );
            if (!hasPort) {
                warnings.push(`Node ${node.id} missing required input: ${port.name}`);
            }
        }

        if (node.type === 'llm' && !node.data.prompt) {
            warnings.push(`LLM node ${node.id} is missing a prompt.`);
        }
    }

    // Cycle detection
    const allowCycles = Boolean(settings?.allowCycles);
    const { hasCycle } = topologicalSort(nodes, edges);
    if (hasCycle && !allowCycles) {
        errors.push('Cycle detected in strategy graph. Enable allowCycles to permit loops.');
    }

    return { isValid: errors.length === 0, errors, warnings };
}

// ─── Input Map Builder ───────────────────────────────────────

function buildInputsMap(nodes: FlowNode[], edges: FlowEdge[]): InputsMap {
    const inputs: InputsMap = {};
    for (const node of nodes) {
        inputs[node.id] = {};
    }
    for (const edge of edges) {
        if (!inputs[edge.target]) {
            inputs[edge.target] = {};
        }
        const handle = edge.targetHandle ?? 'input';
        if (!inputs[edge.target][handle]) {
            inputs[edge.target][handle] = [];
        }
        inputs[edge.target][handle].push({
            nodeId: edge.source,
            sourceHandle: edge.sourceHandle ?? null,
        });
    }
    return inputs;
}

// ─── Indicator Definitions Collector ─────────────────────────

function collectIndicatorDefs(nodes: FlowNode[]): IndicatorDef[] {
    return nodes
        .filter((n) => n.type === 'indicator')
        .map((node) => ({
            nodeId: node.id,
            indicatorType: node.data.indicatorType,
            params: node.data.params ?? {},
        }));
}

// ─── Compiler ────────────────────────────────────────────────

export function compileFlowStrategy(
    rawNodes: Record<string, any>[],
    rawEdges: Record<string, any>[],
    settings?: Record<string, any>
): CompilationResult {
    const nodes: FlowNode[] = rawNodes.map((n) => n as FlowNode);
    const edges: FlowEdge[] = rawEdges.map((e) => e as FlowEdge);

    const validation = validateFlowStrategy(rawNodes, rawEdges, settings);
    const { order } = topologicalSort(nodes, edges);
    const inputsMap = buildInputsMap(nodes, edges);

    const compiled: CompiledStrategy = {
        version: '2.0.0',
        settings: settings ?? {},
        name: settings?.name ?? 'FlowStrategy',
        description: settings?.description ?? '',
        nodes,
        edges,
        nodeOrder: order,
        inputs: inputsMap,
        indicatorDefs: collectIndicatorDefs(nodes),
    };

    return { compiled, validation };
}
