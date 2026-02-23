/**
 * Shared types for the StrategyFlow engine.
 * These types are used by both the compiler and interpreter,
 * and match the frontend ReactFlow node/edge structures.
 */

// ─── Data Types ──────────────────────────────────────────────

export const DATA_TYPES = new Set(['number', 'boolean', 'signal', 'any', 'time']);

export type DataType = 'number' | 'boolean' | 'signal' | 'any' | 'time';

// ─── Port Definitions ────────────────────────────────────────

export interface PortDef {
    name: string;
    dataType: DataType;
    required: boolean;
}

export interface NodeDefinition {
    inputs: PortDef[];
    outputs: PortDef[];
}

// ─── Flow Graph Structures ───────────────────────────────────

export interface FlowNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, any>;
}

export interface FlowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
}

// ─── Validation ──────────────────────────────────────────────

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

// ─── Compilation ─────────────────────────────────────────────

export interface InputSource {
    nodeId: string;
    sourceHandle: string | null;
}

export interface InputsMap {
    [nodeId: string]: {
        [handleName: string]: InputSource[];
    };
}

export interface IndicatorDef {
    nodeId: string;
    indicatorType: string | undefined;
    params: Record<string, any>;
}

export interface CompiledStrategy {
    version: string;
    settings: Record<string, any>;
    name: string;
    description: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    nodeOrder: string[];
    inputs: InputsMap;
    indicatorDefs: IndicatorDef[];
}

export interface CompilationResult {
    compiled: CompiledStrategy;
    validation: ValidationResult;
}
