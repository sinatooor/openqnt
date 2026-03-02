/**
 * Handle configuration utilities for strategy nodes
 */

import { HandleConfig, StrategyFlowNode, StrategyFlowEdge, StrategyNodeData } from '../types';

/**
 * Extract the subType from a node's data based on its type
 */
export const getNodeSubType = (node: StrategyFlowNode): string | undefined => {
  const data = node.data as Record<string, unknown>;
  return (
    data?.indicatorType as string ||
    data?.conditionType as string ||
    data?.actionType as string ||
    data?.mathType as string ||
    data?.controlType as string ||
    data?.riskType as string ||
    data?.variableType as string ||
    data?.environmentType as string ||
    data?.tradeInfoType as string ||
    data?.llmType as string ||
    data?.triggerType as string ||
    data?.integrationType as string ||
    data?.pineType as string
  );
};

/**
 * Normalize legacy handle IDs to current format
 */
const normalizeHandleId = (handleId: string | undefined | null): string | undefined => {
  if (!handleId) return undefined;
  
  // Map legacy handle IDs to current format
  const legacyMap: Record<string, string> = {
    'inputA': 'input-a',
    'inputB': 'input-b',
    'input_a': 'input-a',
    'input_b': 'input-b',
    // 'output' is acceptable as an alias for 'value' in some contexts
  };
  
  return legacyMap[handleId] || handleId;
};

/**
 * Repair edges by filling in missing sourceHandle/targetHandle
 * This ensures data flows correctly between nodes
 */
export const repairEdges = (
  nodes: StrategyFlowNode[],
  edges: StrategyFlowEdge[]
): StrategyFlowEdge[] => {
  return edges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) return edge;

    const sourceSubType = getNodeSubType(sourceNode);
    const targetSubType = getNodeSubType(targetNode);

    const sourceHandles = getHandleConfigs(sourceNode.type || '', sourceSubType);
    const targetHandles = getHandleConfigs(targetNode.type || '', targetSubType);

    // Get source handles (outputs)
    const sourceOutputs = sourceHandles.filter(h => h.type === 'source');
    // Get target handles (inputs)
    const targetInputs = targetHandles.filter(h => h.type === 'target');

    // Normalize any legacy handle IDs first
    let repairedSourceHandle = normalizeHandleId(edge.sourceHandle);
    let repairedTargetHandle = normalizeHandleId(edge.targetHandle);

    // Validate sourceHandle: if it doesn't match any actual source handle on the node, fix it
    if (repairedSourceHandle && sourceOutputs.length > 0) {
      const matchesActualHandle = sourceOutputs.some(h => h.id === repairedSourceHandle);
      if (!matchesActualHandle) {
        // Handle doesn't exist on this node — auto-fill with the correct one
        if (sourceOutputs.length === 1) {
          repairedSourceHandle = sourceOutputs[0].id;
        } else {
          // Try common aliases: 'output' <-> 'value', 'next' <-> 'output'
          const aliasMap: Record<string, string[]> = {
            'output': ['value', 'next'],
            'value': ['output'],
            'next': ['output'],
          };
          const aliases = aliasMap[repairedSourceHandle] || [];
          const aliasMatch = sourceOutputs.find(h => aliases.includes(h.id));
          repairedSourceHandle = aliasMatch?.id || sourceOutputs[0].id;
        }
      }
    }

    // Validate targetHandle: if it doesn't match any actual target handle on the node, fix it
    if (repairedTargetHandle && targetInputs.length > 0) {
      const matchesActualHandle = targetInputs.some(h => h.id === repairedTargetHandle);
      if (!matchesActualHandle) {
        // Handle doesn't exist on this node — auto-fill with the correct one
        if (targetInputs.length === 1) {
          repairedTargetHandle = targetInputs[0].id;
        } else {
          // Try common aliases
          const aliasMap: Record<string, string[]> = {
            'input': ['input-a', 'trigger', 'condition'],
            'input-a': ['trigger'],
            'trigger': ['input-a', 'condition'],
          };
          const aliases = aliasMap[repairedTargetHandle] || [];
          const aliasMatch = targetInputs.find(h => aliases.includes(h.id));
          if (aliasMatch) {
            repairedTargetHandle = aliasMatch.id;
          } else {
            // Check which handles are already used
            const existingEdgesToTarget = edges.filter(e => e.target === edge.target && e.id !== edge.id);
            const usedHandles = existingEdgesToTarget.map(e => normalizeHandleId(e.targetHandle)).filter(Boolean);
            const availableHandle = targetInputs.find(h => !usedHandles.includes(h.id));
            repairedTargetHandle = availableHandle?.id || targetInputs[0].id;
          }
        }
      }
    }

    // Auto-fill sourceHandle if missing and node has outputs
    if (!repairedSourceHandle && sourceOutputs.length > 0) {
      // If single output, use it directly
      if (sourceOutputs.length === 1) {
        repairedSourceHandle = sourceOutputs[0].id;
      } else {
        // For multi-output nodes, try to find 'output' or 'value' as default
        const defaultHandle = sourceOutputs.find(h => h.id === 'output' || h.id === 'value');
        if (defaultHandle) {
          repairedSourceHandle = defaultHandle.id;
        } else {
          // Use the first source handle
          repairedSourceHandle = sourceOutputs[0].id;
        }
      }
    }

    // Auto-fill targetHandle if missing and node has inputs
    if (!repairedTargetHandle && targetInputs.length > 0) {
      // If single input, use it directly
      if (targetInputs.length === 1) {
        repairedTargetHandle = targetInputs[0].id;
      } else {
        // For multi-input nodes (like conditions with input-a, input-b),
        // try to infer based on existing edges
        const existingEdgesToTarget = edges.filter(e => e.target === edge.target && e.id !== edge.id);
        const usedHandles = existingEdgesToTarget.map(e => e.targetHandle).filter(Boolean);

        // Find first unused input handle
        const availableHandle = targetInputs.find(h => !usedHandles.includes(h.id));
        if (availableHandle) {
          repairedTargetHandle = availableHandle.id;
        } else {
          // Fallback: use 'trigger' for actions, 'input-a' for conditions
          const triggerHandle = targetInputs.find(h => h.id === 'trigger');
          const inputAHandle = targetInputs.find(h => h.id === 'input-a');
          repairedTargetHandle = triggerHandle?.id || inputAHandle?.id || targetInputs[0].id;
        }
      }
    }

    // Return repaired edge if anything changed
    if (repairedSourceHandle !== edge.sourceHandle || repairedTargetHandle !== edge.targetHandle) {
      return {
        ...edge,
        sourceHandle: repairedSourceHandle,
        targetHandle: repairedTargetHandle,
      };
    }

    return edge;
  });
};

/**
 * Validate edges and return warnings for ambiguous connections
 */
export const validateEdgeHandles = (
  nodes: StrategyFlowNode[],
  edges: StrategyFlowEdge[]
): string[] => {
  const warnings: string[] = [];

  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) return;

    const sourceSubType = getNodeSubType(sourceNode);
    const targetSubType = getNodeSubType(targetNode);

    const sourceHandles = getHandleConfigs(sourceNode.type || '', sourceSubType);
    const targetHandles = getHandleConfigs(targetNode.type || '', targetSubType);

    const sourceOutputs = sourceHandles.filter(h => h.type === 'source');
    const targetInputs = targetHandles.filter(h => h.type === 'target');

    // Warn if multi-output node doesn't have explicit sourceHandle
    if (sourceOutputs.length > 1 && !edge.sourceHandle) {
      warnings.push(
        `Edge from "${(sourceNode.data as StrategyNodeData).label}" has multiple outputs but no specific handle selected.`
      );
    }

    // Warn if multi-input node doesn't have explicit targetHandle
    if (targetInputs.length > 1 && !edge.targetHandle) {
      warnings.push(
        `Edge to "${(targetNode.data as StrategyNodeData).label}" has multiple inputs but no specific handle selected.`
      );
    }
  });

  return warnings;
};

export const getHandleConfigs = (nodeType: string, subType?: string): HandleConfig[] => {
    switch (nodeType) {
        case 'indicator':
            // Multi-output indicators based on BLOCK_CATALOG.xml
            // Bands & Channels with upper/middle/lower
            if (subType === 'bb' || subType === 'keltner' || subType === 'donchian') {
                return [
                    { id: 'upper', type: 'source', position: 'right', label: 'Upper', dataType: 'number' },
                    { id: 'middle', type: 'source', position: 'right', label: 'Middle', dataType: 'number' },
                    { id: 'lower', type: 'source', position: 'right', label: 'Lower', dataType: 'number' },
                ];
            }
            // Envelopes with upper/lower only
            if (subType === 'envelopes') {
                return [
                    { id: 'upper', type: 'source', position: 'right', label: 'Upper', dataType: 'number' },
                    { id: 'lower', type: 'source', position: 'right', label: 'Lower', dataType: 'number' },
                ];
            }
            // MACD with line/signal/histogram
            if (subType === 'macd') {
                return [
                    { id: 'line', type: 'source', position: 'right', label: 'MACD', dataType: 'number' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'number' },
                    { id: 'histogram', type: 'source', position: 'right', label: 'Histogram', dataType: 'number' },
                ];
            }
            // Stochastic with main/signal
            if (subType === 'stochastic') {
                return [
                    { id: 'main', type: 'source', position: 'right', label: '%K', dataType: 'number' },
                    { id: 'signal', type: 'source', position: 'right', label: '%D', dataType: 'number' },
                ];
            }
            // Ichimoku with 5 lines
            if (subType === 'ichimoku') {
                return [
                    { id: 'tenkan', type: 'source', position: 'right', label: 'Tenkan', dataType: 'number' },
                    { id: 'kijun', type: 'source', position: 'right', label: 'Kijun', dataType: 'number' },
                    { id: 'senkou_a', type: 'source', position: 'right', label: 'Senkou A', dataType: 'number' },
                    { id: 'senkou_b', type: 'source', position: 'right', label: 'Senkou B', dataType: 'number' },
                    { id: 'chikou', type: 'source', position: 'right', label: 'Chikou', dataType: 'number' },
                ];
            }
            // Alligator with jaw/teeth/lips
            if (subType === 'alligator') {
                return [
                    { id: 'jaw', type: 'source', position: 'right', label: 'Jaw', dataType: 'number' },
                    { id: 'teeth', type: 'source', position: 'right', label: 'Teeth', dataType: 'number' },
                    { id: 'lips', type: 'source', position: 'right', label: 'Lips', dataType: 'number' },
                ];
            }
            // Gator with upper/lower
            if (subType === 'gator') {
                return [
                    { id: 'upper', type: 'source', position: 'right', label: 'Upper', dataType: 'number' },
                    { id: 'lower', type: 'source', position: 'right', label: 'Lower', dataType: 'number' },
                ];
            }
            // DMI with +DI/-DI/ADX
            if (subType === 'dmi') {
                return [
                    { id: 'plus_di', type: 'source', position: 'right', label: '+DI', dataType: 'number' },
                    { id: 'minus_di', type: 'source', position: 'right', label: '-DI', dataType: 'number' },
                    { id: 'adx', type: 'source', position: 'right', label: 'ADX', dataType: 'number' },
                ];
            }
            // RVI with main/signal
            if (subType === 'rvi') {
                return [
                    { id: 'main', type: 'source', position: 'right', label: 'Main', dataType: 'number' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'number' },
                ];
            }
            // OsMA with main/signal
            if (subType === 'osma') {
                return [
                    { id: 'main', type: 'source', position: 'right', label: 'Main', dataType: 'number' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'number' },
                ];
            }
            // Fractals with upper/lower
            if (subType === 'fractals') {
                return [
                    { id: 'upper', type: 'source', position: 'right', label: 'Upper', dataType: 'number' },
                    { id: 'lower', type: 'source', position: 'right', label: 'Lower', dataType: 'number' },
                ];
            }
            // Aroon with Up/Down
            if (subType === 'aroon') {
                return [
                    { id: 'aroonup', type: 'source', position: 'right', label: 'Up', dataType: 'number' },
                    { id: 'aroondown', type: 'source', position: 'right', label: 'Down', dataType: 'number' },
                ];
            }
            // Hilbert Transform Phasor
            if (subType === 'ht_phasor') {
                return [
                    { id: 'inphase', type: 'source', position: 'right', label: 'InPhase', dataType: 'number' },
                    { id: 'quadrature', type: 'source', position: 'right', label: 'Quad', dataType: 'number' },
                ];
            }
            // Hilbert Transform Sine
            if (subType === 'ht_sine') {
                return [
                    { id: 'sine', type: 'source', position: 'right', label: 'Sine', dataType: 'number' },
                    { id: 'leadsine', type: 'source', position: 'right', label: 'Lead', dataType: 'number' },
                ];
            }
            // Stochastic RSI
            if (subType === 'stochrsi') {
                return [
                    { id: 'k', type: 'source', position: 'right', label: '%K', dataType: 'number' },
                    { id: 'd', type: 'source', position: 'right', label: '%D', dataType: 'number' },
                ];
            }
            // Default: single output for simple indicators
            return [
                { id: 'value', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
            ];

        case 'condition':
            if (subType === 'and' || subType === 'or') {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'boolean' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'boolean' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
                ];
            }
            if (subType === 'not') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Input', dataType: 'boolean' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
                ];
            }
            return [
                { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'number' },
                { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'number' },
                { id: 'output', type: 'source', position: 'right', label: 'Signal', dataType: 'boolean' },
            ];

        case 'action':
            if (subType === 'stopLoss' || subType === 'takeProfit') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'price', type: 'target', position: 'left', label: 'Price', dataType: 'number' },
                    { id: 'next', type: 'source', position: 'right', label: 'Next', dataType: 'signal' },
                ];
            }
            if (subType === 'order') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'size', type: 'target', position: 'left', label: 'Size', dataType: 'number' }, // Optional dynamic size
                    { id: 'next', type: 'source', position: 'right', label: 'Next', dataType: 'signal' },
                ];
            }
            return [
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'next', type: 'source', position: 'right', label: 'Next', dataType: 'signal' },
            ];

        case 'environment':
            return [
                { id: 'value', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
            ];

        case 'control':
            if (subType === 'if' || subType === 'ifElse') {
                return [
                    { id: 'condition', type: 'target', position: 'left', label: 'Condition', dataType: 'boolean' },
                    { id: 'then', type: 'source', position: 'right', label: 'Then', dataType: 'signal' },
                    ...(subType === 'ifElse' ? [{ id: 'else', type: 'source', position: 'right', label: 'Else', dataType: 'signal' } as HandleConfig] : []),
                ];
            }
            return [
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'output', type: 'source', position: 'right', label: 'Output', dataType: 'signal' },
            ];

        case 'variable':
            if (subType === 'getVariable') {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'any' },
                ];
            }
            return [
                { id: 'input', type: 'target', position: 'left', label: 'Input', dataType: 'any' },
                { id: 'output', type: 'source', position: 'right', label: 'Output', dataType: 'signal' },
            ];

        case 'math':
            // Number node: output only
            if (subType === 'number') {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
                ];
            }
            // Advanced math: single input, single output
            if (subType === 'advancedMath') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Input', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'number' },
                ];
            }
            // Binary operators: two inputs, one output
            return [
                { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'number' },
                { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'number' },
                { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'number' },
            ];

        case 'risk':
            // Risk params usually output a number (size, distance) or act as a rule (target?)
            // For now, treat them as sources of configuration values or rules
            if (['positionPercent', 'kellyCriterion', 'fixedAmount'].includes(subType || '')) {
                return [
                    { id: 'size', type: 'source', position: 'right', label: 'Size', dataType: 'number' },
                ];
            }
            if (['trailingStop'].includes(subType || '')) {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Rule', dataType: 'any' },
                ];
            }
            // Global limits might not need handles, or could be outputs to Strategy Settings?
            // Let's provide an output just in case they are used as inputs to Trade nodes
            return [
                { id: 'output', type: 'source', position: 'right', label: 'Config', dataType: 'any' },
            ];

        case 'tradeInfo':
            // Trade info nodes source values
            return [
                { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
            ];

        case 'llm':
            // Different handle configs based on LLM node subtype
            if (subType === 'sentimentAnalysis') {
                return [
                    { id: 'text', type: 'target', position: 'left', label: 'Text', dataType: 'any' },
                    { id: 'score', type: 'source', position: 'right', label: 'Score', dataType: 'number' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'boolean' },
                ];
            }
            if (subType === 'regimeDetection' || subType === 'marketRegimeClassification') {
                return [
                    { id: 'data', type: 'target', position: 'left', label: 'Data', dataType: 'any' },
                    { id: 'indicators', type: 'target', position: 'left', label: 'Indicators', dataType: 'any' },
                    { id: 'regime', type: 'source', position: 'right', label: 'Regime', dataType: 'any' },
                    { id: 'confidence', type: 'source', position: 'right', label: 'Confidence', dataType: 'number' },
                ];
            }
            if (subType === 'nlStrategyRules') {
                return [
                    { id: 'context', type: 'target', position: 'left', label: 'Context', dataType: 'any' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'any' },
                    { id: 'reasoning', type: 'source', position: 'right', label: 'Reasoning', dataType: 'any' },
                ];
            }
            if (subType === 'parameterTuning') {
                return [
                    { id: 'performance', type: 'target', position: 'left', label: 'Performance', dataType: 'any' },
                    { id: 'params', type: 'target', position: 'left', label: 'Params', dataType: 'any' },
                    { id: 'suggested', type: 'source', position: 'right', label: 'Suggested', dataType: 'any' },
                ];
            }
            if (subType === 'newsSentimentSignal') {
                return [
                    { id: 'symbol', type: 'target', position: 'left', label: 'Symbol', dataType: 'any' },
                    { id: 'news', type: 'target', position: 'left', label: 'News', dataType: 'any' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'any' },
                    { id: 'strength', type: 'source', position: 'right', label: 'Strength', dataType: 'number' },
                ];
            }
            if (subType === 'customCode') {
                return [
                    { id: 'data', type: 'target', position: 'left', label: 'Data', dataType: 'any' },
                    { id: 'context', type: 'target', position: 'left', label: 'Context', dataType: 'any' },
                    { id: 'result', type: 'source', position: 'right', label: 'Result', dataType: 'any' },
                ];
            }
            // Default LLM decision node
            return [
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'output', type: 'source', position: 'right', label: 'JSON', dataType: 'any' },
            ];

        case 'trigger':
            if (subType === 'webhookTrigger' || subType === 'newsTrigger' || subType === 'brokerEventTrigger') {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Signal', dataType: 'signal' },
                    { id: 'data', type: 'source', position: 'right', label: 'Data', dataType: 'any' },
                ];
            }
            if (subType === 'priceAlertTrigger') {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Signal', dataType: 'signal' },
                    { id: 'price', type: 'source', position: 'right', label: 'Price', dataType: 'number' },
                ];
            }
            return [
                { id: 'output', type: 'source', position: 'right', label: 'Signal', dataType: 'signal' },
            ];

        case 'integration':
            if (subType === 'mergeNode') {
                return [
                    { id: 'data-a', type: 'target', position: 'left', label: 'A', dataType: 'any' },
                    { id: 'data-b', type: 'target', position: 'left', label: 'B', dataType: 'any' },
                    { id: 'output', type: 'source', position: 'right', label: 'Merged', dataType: 'any' },
                ];
            }
            if (subType === 'splitNode') {
                return [
                    { id: 'data', type: 'target', position: 'left', label: 'Data', dataType: 'any' },
                    { id: 'item', type: 'source', position: 'right', label: 'Item', dataType: 'any' },
                    { id: 'output', type: 'source', position: 'right', label: 'Done', dataType: 'signal' },
                ];
            }
            if (subType === 'filterNode') {
                return [
                    { id: 'data', type: 'target', position: 'left', label: 'Data', dataType: 'any' },
                    { id: 'passed', type: 'source', position: 'right', label: 'Passed', dataType: 'any' },
                    { id: 'rejected', type: 'source', position: 'right', label: 'Rejected', dataType: 'any' },
                ];
            }
            if (subType === 'hitlNode') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'data', type: 'target', position: 'left', label: 'Data', dataType: 'any' },
                    { id: 'approved', type: 'source', position: 'right', label: 'Approved', dataType: 'signal' },
                    { id: 'rejected', type: 'source', position: 'right', label: 'Rejected', dataType: 'signal' },
                ];
            }
            if (subType === 'aggregateNode' || subType === 'setNode') {
                return [
                    { id: 'data', type: 'target', position: 'left', label: 'Data', dataType: 'any' },
                    { id: 'output', type: 'source', position: 'right', label: 'Data', dataType: 'any' },
                ];
            }
            // Default integration: trigger + data in, data + signal out
            return [
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'data', type: 'target', position: 'left', label: 'Data', dataType: 'any' },
                { id: 'output', type: 'source', position: 'right', label: 'Data', dataType: 'any' },
                { id: 'signal', type: 'source', position: 'right', label: 'Done', dataType: 'signal' },
            ];

        // =====================================================================
        // PINE SCRIPT NODES
        // =====================================================================
        case 'pineScript':
            // Script Setup — declaration nodes, output-only
            if (subType === 'pine_strategy' || subType === 'pine_indicator' || subType === 'pine_version') {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Script', dataType: 'any' },
                ];
            }
            // Input nodes — output-only (user-configurable params)
            if (subType?.startsWith('pine_input_')) {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: subType === 'pine_input_bool' ? 'boolean' : 'number' },
                ];
            }
            // Data series — output-only (close, open, high, low, volume, etc.)
            if (['pine_close', 'pine_open', 'pine_high', 'pine_low', 'pine_volume',
                 'pine_time', 'pine_bar_index'].includes(subType || '')) {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
                ];
            }
            // MACD — 1 input, 3 outputs
            if (subType === 'pine_ta_macd') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Source', dataType: 'number' },
                    { id: 'macd', type: 'source', position: 'right', label: 'MACD', dataType: 'number' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'number' },
                    { id: 'histogram', type: 'source', position: 'right', label: 'Histogram', dataType: 'number' },
                ];
            }
            // Bollinger Bands — 2 inputs, 3 outputs
            if (subType === 'pine_ta_bb') {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'Source', dataType: 'number' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'Length', dataType: 'number' },
                    { id: 'basis', type: 'source', position: 'right', label: 'Basis', dataType: 'number' },
                    { id: 'upper', type: 'source', position: 'right', label: 'Upper', dataType: 'number' },
                    { id: 'lower', type: 'source', position: 'right', label: 'Lower', dataType: 'number' },
                ];
            }
            // Indicators with Series+Number inputs, Series output (SMA, EMA, RSI, Stoch)
            if (['pine_ta_sma', 'pine_ta_ema', 'pine_ta_rsi', 'pine_ta_stoch'].includes(subType || '')) {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'Source', dataType: 'number' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'Length', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
                ];
            }
            // ATR — Number input, Series output
            if (subType === 'pine_ta_atr') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Length', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
                ];
            }
            // VWAP — optional Series input, Series output
            if (subType === 'pine_ta_vwap') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Source', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
                ];
            }
            // Crossover / Crossunder — 2 Series inputs, Boolean output
            if (subType === 'pine_ta_crossover' || subType === 'pine_ta_crossunder') {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'number' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Signal', dataType: 'boolean' },
                ];
            }
            // Compare — 2 inputs, Boolean output
            if (subType === 'pine_compare') {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'number' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
                ];
            }
            // AND / OR — 2 Boolean inputs, Boolean output
            if (subType === 'pine_and' || subType === 'pine_or') {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'boolean' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'boolean' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
                ];
            }
            // NOT — 1 Boolean input, Boolean output
            if (subType === 'pine_not') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Input', dataType: 'boolean' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
                ];
            }
            // Ternary — 3 inputs, 1 output
            if (subType === 'pine_ternary') {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'Cond', dataType: 'boolean' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'Then', dataType: 'any' },
                    { id: 'input-c', type: 'target', position: 'left', label: 'Else', dataType: 'any' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'any' },
                ];
            }
            // Strategy actions — Boolean input + optional Signal output
            if (['pine_strategy_entry', 'pine_strategy_close', 'pine_strategy_exit', 'pine_strategy_order'].includes(subType || '')) {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Condition', dataType: 'boolean' },
                    { id: 'output', type: 'source', position: 'right', label: 'Signal', dataType: 'signal' },
                ];
            }
            // Plot — Series input, no output
            if (subType === 'pine_plot') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Series', dataType: 'number' },
                ];
            }
            // Plotshape, bgcolor, barcolor — Boolean input, no output
            if (['pine_plotshape', 'pine_bgcolor', 'pine_barcolor', 'pine_plotchar'].includes(subType || '')) {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Condition', dataType: 'boolean' },
                ];
            }
            // Hline — Number input, no output
            if (subType === 'pine_hline') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Level', dataType: 'number' },
                ];
            }
            // Fill — 2 inputs (plot references), no output
            if (subType === 'pine_fill') {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'Plot 1', dataType: 'any' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'Plot 2', dataType: 'any' },
                ];
            }
            // Alert nodes — Boolean input, no output
            if (subType === 'pine_alertcondition' || subType === 'pine_alert') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Condition', dataType: 'boolean' },
                ];
            }
            // Fallback for unknown Pine Script subtypes: single input + single output
            return [
                { id: 'input', type: 'target', position: 'left', label: 'Input', dataType: 'any' },
                { id: 'output', type: 'source', position: 'right', label: 'Output', dataType: 'any' },
            ];

        default:
            return [];
    }
};
