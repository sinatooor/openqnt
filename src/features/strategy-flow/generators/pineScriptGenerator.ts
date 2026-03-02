/**
 * Pine Script Code Generator
 * Converts a node graph into TradingView Pine Script v5 code
 */

import { StrategyFlowNode, StrategyFlowEdge, PineScriptNodeData } from '../types';

export interface PineScriptGeneratorOutput {
    code: string;
    errors: string[];
    warnings: string[];
}

/**
 * Topologically sorts nodes so dependencies come first
 */
function topologicalSort(nodes: StrategyFlowNode[], edges: StrategyFlowEdge[]): StrategyFlowNode[] {
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    nodes.forEach(n => {
        adjacency.set(n.id, []);
        inDegree.set(n.id, 0);
    });

    edges.forEach(e => {
        const list = adjacency.get(e.source) || [];
        list.push(e.target);
        adjacency.set(e.source, list);
        inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    });

    const queue: string[] = [];
    inDegree.forEach((deg, id) => {
        if (deg === 0) queue.push(id);
    });

    const sorted: StrategyFlowNode[] = [];
    while (queue.length > 0) {
        const id = queue.shift()!;
        const node = nodes.find(n => n.id === id);
        if (node) sorted.push(node);
        for (const next of adjacency.get(id) || []) {
            const newDeg = (inDegree.get(next) || 1) - 1;
            inDegree.set(next, newDeg);
            if (newDeg === 0) queue.push(next);
        }
    }

    // Add any remaining nodes not in the sorted output (disconnected)
    nodes.forEach(n => {
        if (!sorted.find(s => s.id === n.id)) sorted.push(n);
    });

    return sorted;
}

/**
 * Gets a variable name for a node (used for referencing its output)
 */
function getVarName(node: StrategyFlowNode): string {
    const data = node.data as unknown as PineScriptNodeData;
    const pineType = data.pineType;

    // Use input name for input nodes
    if (pineType?.startsWith('pine_input_') && data.inputName) {
        return data.inputName.replace(/\s+/g, '_').toLowerCase();
    }

    // Use a sanitized node id
    return `_${node.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Generates Pine Script code from a node/edge graph
 */
export function generatePineScriptCode(
    nodes: StrategyFlowNode[],
    edges: StrategyFlowEdge[],
    name: string = 'My Strategy',
    description: string = ''
): PineScriptGeneratorOutput {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (nodes.length === 0) {
        return { code: '// Empty strategy — add some nodes to generate code', errors: ['No nodes in the graph'], warnings };
    }

    // Filter to only Pine Script nodes
    const pineNodes = nodes.filter(n => n.type === 'pineScript');
    if (pineNodes.length === 0) {
        return { code: '', errors: ['No Pine Script nodes found'], warnings };
    }

    const sorted = topologicalSort(pineNodes, edges);

    // Build a lookup: nodeId → variable name
    const varMap = new Map<string, string>();
    sorted.forEach(n => varMap.set(n.id, getVarName(n)));

    // Build a lookup: nodeId → list of source node IDs for inputs
    const inputsMap = new Map<string, string[]>();
    sorted.forEach(n => inputsMap.set(n.id, []));
    edges.forEach(e => {
        const list = inputsMap.get(e.target);
        if (list) list.push(e.source);
    });

    // Code sections
    const lines: string[] = [];
    let hasStrategyDecl = false;
    let hasIndicatorDecl = false;

    // Find declaration node
    const strategyNode = sorted.find(n => (n.data as unknown as PineScriptNodeData).pineType === 'pine_strategy');
    const indicatorNode = sorted.find(n => (n.data as unknown as PineScriptNodeData).pineType === 'pine_indicator');

    // Version header
    lines.push('//@version=5');

    if (strategyNode) {
        const d = strategyNode.data as unknown as PineScriptNodeData;
        const title = d.scriptTitle || name;
        lines.push(`strategy("${title}", overlay=${d.overlay !== false ? 'true' : 'false'})`);
        hasStrategyDecl = true;
    } else if (indicatorNode) {
        const d = indicatorNode.data as unknown as PineScriptNodeData;
        const title = d.scriptTitle || name;
        lines.push(`indicator("${title}", overlay=${d.overlay !== false ? 'true' : 'false'})`);
        hasIndicatorDecl = true;
    } else {
        // Auto-add strategy declaration
        lines.push(`strategy("${name}", overlay=true)`);
        warnings.push('No strategy() or indicator() node found — auto-added strategy() declaration.');
    }

    lines.push('');

    // Process each node in order
    for (const node of sorted) {
        const data = node.data as unknown as PineScriptNodeData;
        const varName = varMap.get(node.id)!;
        const inputNodeIds = inputsMap.get(node.id) || [];
        const inputVars = inputNodeIds.map(id => varMap.get(id) || 'close');

        switch (data.pineType) {
            case 'pine_strategy':
            case 'pine_indicator':
                // Already handled above
                break;

            // INPUTS
            case 'pine_input_int':
                lines.push(`${varName} = input.int(${data.inputDefault ?? 14}, title="${data.inputName || 'Length'}"${data.inputMinVal !== undefined ? `, minval=${data.inputMinVal}` : ''}${data.inputMaxVal !== undefined ? `, maxval=${data.inputMaxVal}` : ''})`);
                break;
            case 'pine_input_float':
                lines.push(`${varName} = input.float(${data.inputDefault ?? 2.0}, title="${data.inputName || 'Value'}")`);
                break;
            case 'pine_input_bool':
                lines.push(`${varName} = input.bool(${data.inputDefault === true ? 'true' : 'false'}, title="${data.inputName || 'Enabled'}")`);
                break;
            case 'pine_input_source':
                lines.push(`${varName} = input.source(${data.inputDefault || 'close'}, title="${data.inputName || 'Source'}")`);
                break;

            // DATA
            case 'pine_close':
            case 'pine_open':
            case 'pine_high':
            case 'pine_low':
            case 'pine_volume':
            case 'pine_bar_index':
            case 'pine_time':
                // These are built-in, just set variable alias
                lines.push(`${varName} = ${data.pineType.replace('pine_', '')}`);
                break;

            // INDICATORS
            case 'pine_ta_sma': {
                const src = inputVars[0] || data.source || 'close';
                const len = inputVars[1] || data.period || 14;
                lines.push(`${varName} = ta.sma(${src}, ${len})`);
                break;
            }
            case 'pine_ta_ema': {
                const src = inputVars[0] || data.source || 'close';
                const len = inputVars[1] || data.period || 14;
                lines.push(`${varName} = ta.ema(${src}, ${len})`);
                break;
            }
            case 'pine_ta_rsi': {
                const src = inputVars[0] || data.source || 'close';
                const len = inputVars[1] || data.period || 14;
                lines.push(`${varName} = ta.rsi(${src}, ${len})`);
                break;
            }
            case 'pine_ta_macd': {
                const src = inputVars[0] || data.source || 'close';
                lines.push(`[${varName}_macd, ${varName}_signal, ${varName}_hist] = ta.macd(${src}, 12, 26, 9)`);
                break;
            }
            case 'pine_ta_bb': {
                const src = inputVars[0] || data.source || 'close';
                const len = inputVars[1] || data.period || 20;
                lines.push(`[${varName}_basis, ${varName}_upper, ${varName}_lower] = ta.bb(${src}, ${len}, 2.0)`);
                break;
            }
            case 'pine_ta_atr': {
                const len = inputVars[0] || data.period || 14;
                lines.push(`${varName} = ta.atr(${len})`);
                break;
            }
            case 'pine_ta_stoch': {
                const len = inputVars[0] || data.period || 14;
                lines.push(`${varName} = ta.stoch(close, high, low, ${len})`);
                break;
            }
            case 'pine_ta_vwap': {
                lines.push(`${varName} = ta.vwap`);
                break;
            }
            case 'pine_ta_crossover': {
                const a = inputVars[0] || 'close';
                const b = inputVars[1] || 'close';
                lines.push(`${varName} = ta.crossover(${a}, ${b})`);
                break;
            }
            case 'pine_ta_crossunder': {
                const a = inputVars[0] || 'close';
                const b = inputVars[1] || 'close';
                lines.push(`${varName} = ta.crossunder(${a}, ${b})`);
                break;
            }

            // CONDITIONS
            case 'pine_compare': {
                const a = inputVars[0] || 'close';
                const b = inputVars[1] || '0';
                const op = data.operator || '>';
                lines.push(`${varName} = ${a} ${op} ${b}`);
                break;
            }
            case 'pine_and': {
                const a = inputVars[0] || 'true';
                const b = inputVars[1] || 'true';
                lines.push(`${varName} = ${a} and ${b}`);
                break;
            }
            case 'pine_or': {
                const a = inputVars[0] || 'true';
                const b = inputVars[1] || 'true';
                lines.push(`${varName} = ${a} or ${b}`);
                break;
            }
            case 'pine_not': {
                const a = inputVars[0] || 'true';
                lines.push(`${varName} = not ${a}`);
                break;
            }

            // STRATEGY ACTIONS
            case 'pine_strategy_entry': {
                const cond = inputVars[0] || 'true';
                const dir = data.direction === 'short' ? 'strategy.short' : 'strategy.long';
                const id = data.entryId || 'Trade';
                const qtyPart = data.qty ? `, qty=${data.qty}` : '';
                lines.push(`if ${cond}`);
                lines.push(`    strategy.entry("${id}", ${dir}${qtyPart})`);
                break;
            }
            case 'pine_strategy_close': {
                const cond = inputVars[0] || 'true';
                const id = data.entryId || 'Trade';
                lines.push(`if ${cond}`);
                lines.push(`    strategy.close("${id}")`);
                break;
            }
            case 'pine_strategy_exit': {
                const cond = inputVars[0] || 'true';
                const id = data.entryId || 'Trade';
                lines.push(`if ${cond}`);
                lines.push(`    strategy.exit("Exit ${id}", "${id}")`);
                break;
            }

            // PLOTTING
            case 'pine_plot': {
                const src = inputVars[0] || 'close';
                const title = data.plotTitle || 'Plot';
                const color = data.plotColor || '#2962FF';
                const lw = data.plotLineWidth || 2;
                lines.push(`plot(${src}, title="${title}", color=color.new(${colorToRGB(color)}), linewidth=${lw})`);
                break;
            }
            case 'pine_plotshape': {
                const cond = inputVars[0] || 'true';
                const color = data.plotColor || '#4CAF50';
                lines.push(`plotshape(${cond}, style=shape.triangleup, color=color.new(${colorToRGB(color)}))`);
                break;
            }
            case 'pine_hline': {
                const val = inputVars[0] || '0';
                const color = data.plotColor || '#787B86';
                lines.push(`hline(${val}, color=color.new(${colorToRGB(color)}))`);
                break;
            }
            case 'pine_bgcolor': {
                const cond = inputVars[0] || 'true';
                const color = data.plotColor || '#2962FF';
                lines.push(`bgcolor(${cond} ? color.new(${colorToRGB(color)}, 85) : na)`);
                break;
            }

            // ALERTS
            case 'pine_alertcondition': {
                const cond = inputVars[0] || 'true';
                const msg = data.alertMessage || 'Alert!';
                lines.push(`alertcondition(${cond}, title="Alert", message="${msg}")`);
                break;
            }
            case 'pine_alert': {
                const cond = inputVars[0] || 'true';
                const msg = data.alertMessage || 'Alert!';
                lines.push(`if ${cond}`);
                lines.push(`    alert("${msg}")`);
                break;
            }

            default:
                warnings.push(`Unknown Pine Script node type: ${data.pineType}`);
                lines.push(`// Unknown node: ${data.pineType}`);
        }
    }

    return {
        code: lines.join('\n'),
        errors,
        warnings,
    };
}

/**
 * Convert hex color to Pine Script color.rgb() format
 */
function colorToRGB(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `color.rgb(${r}, ${g}, ${b})`;
}
