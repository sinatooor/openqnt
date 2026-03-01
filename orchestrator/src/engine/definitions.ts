/**
 * Node and port definitions for Flow strategies.
 * TypeScript port of backend/flow/definitions.py
 */

import type { PortDef, NodeDefinition, DataType } from './types.js';

// ─── Helpers ─────────────────────────────────────────────────

function port(name: string, dataType: DataType, required = true): PortDef {
    return { name, dataType, required };
}

function indicatorOutputs(indicatorType: string): PortDef[] {
    if (indicatorType === 'macd') {
        return [port('line', 'number'), port('signal', 'number'), port('histogram', 'number')];
    }
    if (['bb', 'keltner', 'donchian'].includes(indicatorType)) {
        return [port('upper', 'number'), port('middle', 'number'), port('lower', 'number')];
    }
    return [port('output', 'number')];
}

function environmentOutput(envType: string): PortDef {
    if (['newCandleOpen', 'isMarketOpen'].includes(envType)) {
        return port('output', 'boolean');
    }
    if (envType === 'time') {
        return port('output', 'time');
    }
    return port('output', 'number');
}

// ─── Main Definition Resolver ────────────────────────────────

export function getNodeDefinition(nodeType: string, nodeData: Record<string, any>): NodeDefinition {
    const subtype: string =
        nodeData.indicatorType ??
        nodeData.conditionType ??
        nodeData.actionType ??
        nodeData.mathType ??
        nodeData.controlType ??
        nodeData.riskType ??
        nodeData.variableType ??
        nodeData.environmentType ??
        nodeData.tradeInfoType ??
        '';

    if (nodeType === 'indicator') {
        return { inputs: [], outputs: indicatorOutputs(subtype) };
    }

    if (nodeType === 'environment') {
        return { inputs: [], outputs: [environmentOutput(subtype)] };
    }

    if (nodeType === 'condition') {
        if (['and', 'or'].includes(subtype)) {
            return {
                inputs: [port('input-a', 'boolean'), port('input-b', 'boolean')],
                outputs: [port('output', 'boolean')],
            };
        }
        if (subtype === 'not') {
            return {
                inputs: [port('input', 'boolean')],
                outputs: [port('output', 'boolean')],
            };
        }
        if (subtype === 'threshold') {
            return {
                inputs: [port('input-a', 'number')],
                outputs: [port('output', 'boolean')],
            };
        }
        return {
            inputs: [port('input-a', 'number'), port('input-b', 'number')],
            outputs: [port('output', 'boolean')],
        };
    }

    if (nodeType === 'math') {
        if (subtype === 'number') {
            return { inputs: [], outputs: [port('output', 'number')] };
        }
        if (subtype === 'advancedMath') {
            return {
                inputs: [port('input', 'number')],
                outputs: [port('output', 'number')],
            };
        }
        return {
            inputs: [port('input-a', 'number'), port('input-b', 'number')],
            outputs: [port('output', 'number')],
        };
    }

    if (nodeType === 'variable') {
        if (subtype === 'getVariable') {
            return { inputs: [], outputs: [port('output', 'any')] };
        }
        return {
            inputs: [port('input', 'any')],
            outputs: [port('output', 'signal')],
        };
    }

    if (nodeType === 'risk') {
        return { inputs: [], outputs: [port('output', 'any')] };
    }

    if (nodeType === 'tradeInfo') {
        return { inputs: [], outputs: [port('output', 'number')] };
    }

    if (nodeType === 'control') {
        if (['if', 'ifElse'].includes(subtype)) {
            return {
                inputs: [port('condition', 'boolean')],
                outputs: [port('output', 'signal')],
            };
        }
        return {
            inputs: [port('trigger', 'signal')],
            outputs: [port('output', 'signal')],
        };
    }

    if (nodeType === 'action') {
        if (['stopLoss', 'takeProfit'].includes(subtype)) {
            return {
                inputs: [port('trigger', 'signal'), port('price', 'number')],
                outputs: [port('output', 'signal')],
            };
        }
        if (subtype === 'order') {
            return {
                inputs: [port('trigger', 'signal'), port('size', 'number', false)],
                outputs: [port('output', 'signal')],
            };
        }
        return {
            inputs: [port('trigger', 'signal')],
            outputs: [port('output', 'signal')],
        };
    }

    if (nodeType === 'llm') {
        return {
            inputs: [port('trigger', 'signal', false)],
            outputs: [port('output', 'any')],
        };
    }

    // ── Trigger Nodes ──
    if (nodeType === 'trigger') {
        const triggerType = nodeData.triggerType ?? '';
        if (['webhookTrigger', 'newsTrigger', 'brokerEventTrigger'].includes(triggerType)) {
            return { inputs: [], outputs: [port('output', 'signal'), port('data', 'any')] };
        }
        if (triggerType === 'priceAlertTrigger') {
            return { inputs: [], outputs: [port('output', 'signal'), port('price', 'number')] };
        }
        return { inputs: [], outputs: [port('output', 'signal')] };
    }

    // ── Integration Nodes ──
    if (nodeType === 'integration') {
        const intType = nodeData.integrationType ?? '';

        if (intType === 'mergeNode') {
            return {
                inputs: [port('data-a', 'any'), port('data-b', 'any')],
                outputs: [port('output', 'any')],
            };
        }
        if (intType === 'splitNode') {
            return {
                inputs: [port('data', 'any')],
                outputs: [port('item', 'any'), port('output', 'signal')],
            };
        }
        if (intType === 'filterNode') {
            return {
                inputs: [port('data', 'any')],
                outputs: [port('passed', 'any'), port('rejected', 'any')],
            };
        }
        if (intType === 'aggregateNode' || intType === 'setNode') {
            return {
                inputs: [port('data', 'any')],
                outputs: [port('output', 'any')],
            };
        }
        if (intType === 'hitlNode') {
            return {
                inputs: [port('trigger', 'signal'), port('data', 'any', false)],
                outputs: [port('approved', 'signal'), port('rejected', 'signal')],
            };
        }
        // Communication + Code + HTTP + DB + AI
        return {
            inputs: [port('trigger', 'signal', false), port('data', 'any', false)],
            outputs: [port('output', 'any'), port('signal', 'signal')],
        };
    }

    return { inputs: [], outputs: [] };
}
