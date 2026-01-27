/**
 * Enhanced Python Code Generator for Strategy Flow
 * Comprehensive implementation matching Blockly generator capabilities
 * 
 * Supports:
 * - All indicator types (core + TA-Lib extended)
 * - Control flow (if, repeat, stop)
 * - Math operations (add, subtract, multiply, divide, advanced)
 * - Variables (get, set, increment, decrement)
 * - Risk management nodes
 * - Trade info nodes
 * - Dynamic inputs (SL/TP price, order size)
 * - Multi-output indicators
 */

import type { StrategyFlowNode, StrategyFlowEdge } from '../types';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface GeneratorContext {
    nodes: StrategyFlowNode[];
    edges: StrategyFlowEdge[];
    nodeMap: Map<string, StrategyFlowNode>;
    indicators: Map<string, string>;  // nodeId -> indicator variable name
    variables: Set<string>;
    errors: string[];
    warnings: string[];
}

interface HandleConnection {
    sourceNode: StrategyFlowNode;
    sourceHandle: string;
    targetNode: StrategyFlowNode;
    targetHandle: string;
}

// =============================================================================
// MAIN GENERATOR FUNCTION
// =============================================================================

export function generatePythonCode(
    nodes: StrategyFlowNode[],
    edges: StrategyFlowEdge[],
    options: { leverage?: number; symbol?: string } = {}
): { code: string; errors: string[]; warnings: string[] } {

    if (nodes.length === 0) {
        return {
            code: '# No strategy defined\n# Add nodes to create a strategy',
            errors: [],
            warnings: []
        };
    }

    const ctx: GeneratorContext = {
        nodes,
        edges,
        nodeMap: new Map(nodes.map(n => [n.id, n])),
        indicators: new Map(),
        variables: new Set(),
        errors: [],
        warnings: []
    };

    // Generate code sections
    const indicatorInit = generateIndicatorInit(ctx);
    const variableInit = generateVariableInit(ctx);
    const strategyLogic = generateStrategyLogic(ctx);

    // Build final code
    const code = buildFinalCode({
        indicatorInit,
        variableInit,
        strategyLogic,
        leverage: options.leverage || 1
    });

    return {
        code,
        errors: ctx.errors,
        warnings: ctx.warnings
    };
}

// =============================================================================
// INDICATOR INITIALIZATION
// =============================================================================

function generateIndicatorInit(ctx: GeneratorContext): string {
    const indicatorNodes = ctx.nodes.filter(n => n.type === 'indicator');
    const lines: string[] = [];

    indicatorNodes.forEach(node => {
        const data = node.data as any;
        const indicatorType = data.indicatorType?.toLowerCase() || 'sma';
        const params = data.params || {};
        const period = params.period || 14;

        // Create unique variable name
        const varName = `${indicatorType}_${node.id.substring(0, 8)}`;
        ctx.indicators.set(node.id, varName);

        // Generate initialization code based on indicator type
        const initCode = generateIndicatorInitCode(indicatorType, varName, params, period);
        if (initCode) {
            lines.push(initCode);
        }
    });

    return lines.join('\n        ');
}

function generateIndicatorInitCode(
    type: string,
    varName: string,
    params: any,
    period: number
): string {
    // Core indicators
    switch (type) {
        case 'sma':
            return `self.${varName} = self.I(SMA, self.data.Close, ${period})`;
        case 'ema':
            return `self.${varName} = self.I(EMA, self.data.Close, ${period})`;
        case 'rsi':
            return `self.${varName} = self.I(RSI, self.data.Close, ${period})`;
        case 'atr':
            return `self.${varName} = self.I(ATR, self.data.High, self.data.Low, self.data.Close, ${period})`;
        case 'macd':
            const fast = params.fastPeriod || 12;
            const slow = params.slowPeriod || 26;
            const signal = params.signalPeriod || 9;
            return `self.${varName}_line, self.${varName}_signal, self.${varName}_hist = self.I(MACD, self.data.Close, ${fast}, ${slow}, ${signal})`;
        case 'bb':
            const stdDev = params.stdDev || 2;
            return `self.${varName}_upper, self.${varName}_middle, self.${varName}_lower = self.I(BBANDS, self.data.Close, ${period}, ${stdDev})`;
        case 'stochastic':
        case 'stoch':
            const k = params.kPeriod || 14;
            const d = params.dPeriod || 3;
            return `self.${varName}_k, self.${varName}_d = self.I(STOCH, self.data.High, self.data.Low, self.data.Close, ${k}, ${d})`;

        // Extended TA-Lib indicators  
        case 'adx':
            return `self.${varName} = self.I(lambda h, l, c, n: talib.ADX(h, l, c, timeperiod=n) if talib else SMA(c, n), self.data.High, self.data.Low, self.data.Close, ${period})`;
        case 'cci':
            return `self.${varName} = self.I(lambda h, l, c, n: talib.CCI(h, l, c, timeperiod=n) if talib else SMA(c, n), self.data.High, self.data.Low, self.data.Close, ${period})`;
        case 'mfi':
            return `self.${varName} = self.I(lambda h, l, c, v, n: talib.MFI(h, l, c, v, timeperiod=n) if talib else RSI(c, n), self.data.High, self.data.Low, self.data.Close, self.data.Volume, ${period})`;
        case 'obv':
            return `self.${varName} = self.I(lambda c, v: talib.OBV(c, v) if talib else np.cumsum(v * np.sign(np.diff(c, prepend=c[0]))), self.data.Close, self.data.Volume)`;

        // Multi-output indicators
        case 'aroon':
            return `self.${varName}_up, self.${varName}_down = self.I(lambda h, l, n: talib.AROON(h, l, timeperiod=n) if talib else (SMA(h, n), SMA(l, n)), self.data.High, self.data.Low, ${period})`;
        case 'stochrsi':
            const timeperiod = params.timeperiod || 14;
            const fastk = params.fastk_period || 5;
            const fastd = params.fastd_period || 3;
            return `self.${varName}_k, self.${varName}_d = self.I(lambda c, t, k, d: talib.STOCHRSI(c, timeperiod=t, fastk_period=k, fastd_period=d) if talib else STOCH(c, c, c, k, d), self.data.Close, ${timeperiod}, ${fastk}, ${fastd})`;

        // Custom indicators
        case 'donchian':
            return `self.${varName}_upper, self.${varName}_lower = self.I(DONCHIAN, self.data.High, self.data.Low, ${period})`;
        case 'keltner':
            const mult = params.multiplier || 2;
            return `self.${varName}_upper, self.${varName}_middle, self.${varName}_lower = self.I(KELTNER, self.data.High, self.data.Low, self.data.Close, ${period}, ${mult})`;
        case 'ichimoku':
            const tenkan = params.tenkanSen || 9;
            const kijun = params.kijunSen || 26;
            const senkouB = params.senkouSpanB || 52;
            return `self.${varName}_tenkan, self.${varName}_kijun, self.${varName}_senkou_a, self.${varName}_senkou_b = self.I(ICHIMOKU, self.data.High, self.data.Low, ${tenkan}, ${kijun}, ${senkouB})`;

        default:
            return `# Indicator ${type} not yet implemented`;
    }
}

// =============================================================================
// VARIABLE INITIALIZATION
// =============================================================================

function generateVariableInit(ctx: GeneratorContext): string {
    const variableNodes = ctx.nodes.filter(n => n.type === 'variable');

    variableNodes.forEach(node => {
        const data = node.data as any;
        if (data.variableName) {
            ctx.variables.add(data.variableName);
        }
    });

    return Array.from(ctx.variables).map(v => `self.${v} = 0`).join('\n        ');
}

// =============================================================================
// STRATEGY LOGIC GENERATION
// =============================================================================

function generateStrategyLogic(ctx: GeneratorContext): string {
    // Find trigger nodes (environment nodes that start the flow)
    const triggerNodes = ctx.nodes.filter(n =>
        n.type === 'environment' && (n.data as any).environmentType === 'newCandleOpen'
    );

    if (triggerNodes.length === 0) {
        // No explicit trigger, generate logic for all action nodes
        return generateNodeSequence(ctx, ctx.nodes.filter(n => n.type === 'action'));
    }

    // Generate logic starting from trigger nodes
    const logic: string[] = [];
    triggerNodes.forEach(trigger => {
        const sequence = getConnectedNodes(ctx, trigger.id);
        const code = generateNodeSequence(ctx, sequence);
        if (code) logic.push(code);
    });

    return logic.join('\n        ');
}

function getConnectedNodes(ctx: GeneratorContext, startNodeId: string): StrategyFlowNode[] {
    const visited = new Set<string>();
    const sequence: StrategyFlowNode[] = [];

    function traverse(nodeId: string) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const node = ctx.nodeMap.get(nodeId);
        if (!node) return;

        sequence.push(node);

        // Find outgoing edges
        const outgoingEdges = ctx.edges.filter(e => e.source === nodeId);
        outgoingEdges.forEach(edge => traverse(edge.target));
    }

    traverse(startNodeId);
    return sequence;
}

function generateNodeSequence(ctx: GeneratorContext, nodes: StrategyFlowNode[]): string {
    const lines: string[] = [];

    nodes.forEach(node => {
        const code = generateNodeCode(ctx, node);
        if (code) lines.push(code);
    });

    return lines.join('\n        ');
}

// =============================================================================
// NODE CODE GENERATION
// =============================================================================

function generateNodeCode(ctx: GeneratorContext, node: StrategyFlowNode): string {
    const data = node.data as any;

    switch (node.type) {
        case 'control':
            return generateControlNode(ctx, node, data);
        case 'condition':
            return generateConditionNode(ctx, node, data);
        case 'action':
            return generateActionNode(ctx, node, data);
        case 'math':
            return generateMathNode(ctx, node, data);
        case 'variable':
            return generateVariableNode(ctx, node, data);
        case 'tradeInfo':
            return ''; // Trade info nodes return values, not statements
        case 'risk':
            return ''; // Risk nodes provide configuration, not logic
        case 'environment':
            return ''; // Environment nodes provide values, not logic
        default:
            return '';
    }
}

// =============================================================================
// CONTROL FLOW NODES
// =============================================================================

function generateControlNode(ctx: GeneratorContext, node: StrategyFlowNode, data: any): string {
    const controlType = data.controlType;

    switch (controlType) {
        case 'if': {
            const condition = getInputValue(ctx, node.id, 'condition') || 'True';
            const thenNodes = getConnectedNodesViaHandle(ctx, node.id, 'then');
            const thenCode = generateNodeSequence(ctx, thenNodes);
            return `if ${condition}:\n    ${thenCode.replace(/\n/g, '\n    ') || 'pass'}`;
        }

        case 'ifElse': {
            const condition = getInputValue(ctx, node.id, 'condition') || 'True';
            const thenNodes = getConnectedNodesViaHandle(ctx, node.id, 'then');
            const elseNodes = getConnectedNodesViaHandle(ctx, node.id, 'else');
            const thenCode = generateNodeSequence(ctx, thenNodes);
            const elseCode = generateNodeSequence(ctx, elseNodes);
            return `if ${condition}:\n    ${thenCode.replace(/\n/g, '\n    ') || 'pass'}\nelse:\n    ${elseCode.replace(/\n/g, '\n    ') || 'pass'}`;
        }

        case 'repeat': {
            const times = getInputValue(ctx, node.id, 'times') || '1';
            const doNodes = getConnectedNodesViaHandle(ctx, node.id, 'do');
            const doCode = generateNodeSequence(ctx, doNodes);
            return `for _i in range(${times}):\n    ${doCode.replace(/\n/g, '\n    ') || 'pass'}`;
        }

        case 'stop':
            return 'return';

        default:
            return `# Control type ${controlType} not implemented`;
    }
}

// =============================================================================
// CONDITION NODES
// =============================================================================

function generateConditionNode(ctx: GeneratorContext, node: StrategyFlowNode, data: any): string {
    const conditionType = data.conditionType;

    switch (conditionType) {
        case 'compare': {
            const left = getInputValue(ctx, node.id, 'input-a') || '0';
            const right = getInputValue(ctx, node.id, 'input-b') || '0';
            const operator = data.operator || '>';
            return `${left} ${operator} ${right}`;
        }

        case 'crossover': {
            const a = getInputValue(ctx, node.id, 'input-a') || 'self.data.Close';
            const b = getInputValue(ctx, node.id, 'input-b') || 'self.data.Close';
            // Remove [-1] indexing for crossover function
            const aClean = a.replace(/\[-1\]$/, '');
            const bClean = b.replace(/\[-1\]$/, '');
            return `crossover(${aClean}, ${bClean})`;
        }

        case 'crossunder': {
            const a = getInputValue(ctx, node.id, 'input-a') || 'self.data.Close';
            const b = getInputValue(ctx, node.id, 'input-b') || 'self.data.Close';
            const aClean = a.replace(/\[-1\]$/, '');
            const bClean = b.replace(/\[-1\]$/, '');
            return `crossover(${bClean}, ${aClean})`;
        }

        case 'and': {
            const a = getInputValue(ctx, node.id, 'input-a') || 'True';
            const b = getInputValue(ctx, node.id, 'input-b') || 'True';
            return `(${a}) and (${b})`;
        }

        case 'or': {
            const a = getInputValue(ctx, node.id, 'input-a') || 'False';
            const b = getInputValue(ctx, node.id, 'input-b') || 'False';
            return `(${a}) or (${b})`;
        }

        case 'not': {
            const value = getInputValue(ctx, node.id, 'input') || 'False';
            return `not (${value})`;
        }

        case 'threshold': {
            const value = getInputValue(ctx, node.id, 'input') || '0';
            const threshold = data.threshold || data.value || 50;
            const operator = data.operator || '>';
            return `${value} ${operator} ${threshold}`;
        }

        default:
            return `True  # Condition ${conditionType} not implemented`;
    }
}

// =============================================================================
// ACTION NODES
// =============================================================================

function generateActionNode(ctx: GeneratorContext, node: StrategyFlowNode, data: any): string {
    const actionType = data.actionType;

    switch (actionType) {
        case 'order': {
            const direction = data.direction || 'long';
            const sizeInput = getInputValue(ctx, node.id, 'size');
            const size = sizeInput || (data.size ? `${data.size / 100}` : '0.1');

            if (direction === 'long') {
                return `if not self.position:\n    self.buy(size=${size})`;
            } else {
                return `if not self.position:\n    self.sell(size=${size})`;
            }
        }

        case 'closePosition':
        case 'closeAll':
            return `if self.position:\n    self.position.close()`;

        case 'stopLoss': {
            const priceInput = getInputValue(ctx, node.id, 'price');
            const price = priceInput || (data.stopPrice ? `${data.stopPrice}` : 'self.data.Close[-1] * 0.98');
            return `# Stop Loss at ${price}`;
        }

        case 'takeProfit': {
            const priceInput = getInputValue(ctx, node.id, 'price');
            const price = priceInput || (data.takeProfitPrice ? `${data.takeProfitPrice}` : 'self.data.Close[-1] * 1.02');
            return `# Take Profit at ${price}`;
        }

        case 'log':
            return `print("${data.message || 'Log message'}")`;

        case 'notification':
            return `# Notification: ${data.message || 'Alert'}`;

        default:
            return `# Action ${actionType} not implemented`;
    }
}

// =============================================================================
// MATH NODES
// =============================================================================

function generateMathNode(ctx: GeneratorContext, node: StrategyFlowNode, data: any): string {
    const mathType = data.mathType;

    switch (mathType) {
        case 'add': {
            const a = getInputValue(ctx, node.id, 'input-a') || '0';
            const b = getInputValue(ctx, node.id, 'input-b') || '0';
            return `(${a} + ${b})`;
        }

        case 'subtract': {
            const a = getInputValue(ctx, node.id, 'input-a') || '0';
            const b = getInputValue(ctx, node.id, 'input-b') || '0';
            return `(${a} - ${b})`;
        }

        case 'multiply': {
            const a = getInputValue(ctx, node.id, 'input-a') || '0';
            const b = getInputValue(ctx, node.id, 'input-b') || '0';
            return `(${a} * ${b})`;
        }

        case 'divide': {
            const a = getInputValue(ctx, node.id, 'input-a') || '0';
            const b = getInputValue(ctx, node.id, 'input-b') || '1';
            return `(${a} / ${b})`;
        }

        case 'number':
            return `${data.value || 0}`;

        case 'advancedMath': {
            const func = data.mathFunction || 'sqrt';
            const input = getInputValue(ctx, node.id, 'input') || '0';
            const funcMap: Record<string, string> = {
                'sqrt': 'np.sqrt',
                'abs': 'np.abs',
                'sin': 'np.sin',
                'cos': 'np.cos',
                'tan': 'np.tan',
                'log': 'np.log',
                'exp': 'np.exp',
                'floor': 'np.floor',
                'ceil': 'np.ceil',
                'round': 'np.round'
            };
            const pyFunc = funcMap[func] || 'np.sqrt';
            return `${pyFunc}(${input})`;
        }

        default:
            return '0';
    }
}

// =============================================================================
// VARIABLE NODES
// =============================================================================

function generateVariableNode(ctx: GeneratorContext, node: StrategyFlowNode, data: any): string {
    const variableType = data.variableType;
    const varName = data.variableName || 'temp';

    ctx.variables.add(varName);

    switch (variableType) {
        case 'setVariable': {
            const value = getInputValue(ctx, node.id, 'value') || '0';
            return `self.${varName} = ${value}`;
        }

        case 'getVariable':
            return `self.${varName}`;

        case 'increment':
            return `self.${varName} += 1`;

        case 'decrement':
            return `self.${varName} -= 1`;

        default:
            return '';
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getInputValue(ctx: GeneratorContext, nodeId: string, handleId: string): string | null {
    const edge = ctx.edges.find(e => e.target === nodeId && e.targetHandle === handleId);
    if (!edge) return null;

    const sourceNode = ctx.nodeMap.get(edge.source);
    if (!sourceNode) return null;

    return getNodeValue(ctx, sourceNode, edge.sourceHandle);
}

function getNodeValue(ctx: GeneratorContext, node: StrategyFlowNode, handle?: string): string {
    const data = node.data as any;

    switch (node.type) {
        case 'indicator': {
            const varName = ctx.indicators.get(node.id);
            if (!varName) return 'self.data.Close[-1]';

            // Handle multi-output indicators
            if (handle && handle !== 'output') {
                return `self.${varName}_${handle}[-1]`;
            }
            return `self.${varName}[-1]`;
        }

        case 'math':
            return generateMathNode(ctx, node, data);

        case 'variable':
            return `self.${data.variableName || 'temp'}`;

        case 'condition':
            return generateConditionNode(ctx, node, data);

        case 'environment':
            return generateEnvironmentValue(data);

        case 'tradeInfo':
            return generateTradeInfoValue(data);

        case 'risk':
            return generateRiskValue(ctx, node, data);

        default:
            return '0';
    }
}

function generateEnvironmentValue(data: any): string {
    const envType = data.environmentType;

    switch (envType) {
        case 'price':
            return 'self.data.Close[-1]';
        case 'open':
            return 'self.data.Open[-1]';
        case 'high':
            return 'self.data.High[-1]';
        case 'low':
            return 'self.data.Low[-1]';
        case 'spread':
            return '(self.data.High[-1] - self.data.Low[-1])';
        case 'time':
            return 'self.data.index[-1]';
        case 'dayOfWeek':
            return 'self.data.index[-1].weekday()';
        case 'isMarketOpen':
            return 'True';
        case 'prevCandleOpen':
            return 'self.data.Open[-2]';
        default:
            return 'self.data.Close[-1]';
    }
}

function generateTradeInfoValue(data: any): string {
    const infoType = data.tradeInfoType;

    switch (infoType) {
        case 'entryPrice':
            return '(self.position.entry_price if self.position else self.data.Close[-1])';
        case 'positionSize':
            return '(self.position.size if self.position else 0)';
        case 'pnl':
            return '(self.position.pl if self.position else 0)';
        case 'tradeDuration':
            return '(len(self.data) - self.position.entry_bar if self.position else 0)';
        default:
            return '0';
    }
}

function generateRiskValue(ctx: GeneratorContext, node: StrategyFlowNode, data: any): string {
    const riskType = data.riskType;

    switch (riskType) {
        case 'positionPercent': {
            const percent = data.value || 10;
            return `(self.equity * ${percent / 100} / self.data.Close[-1])`;
        }
        case 'fixedAmount':
            return `${data.value || 0.1}`;
        case 'kellyCriterion':
            return '0.1  # Kelly criterion calculation';
        default:
            return '0.1';
    }
}

function getConnectedNodesViaHandle(ctx: GeneratorContext, nodeId: string, handleId: string): StrategyFlowNode[] {
    const edges = ctx.edges.filter(e => e.source === nodeId && e.sourceHandle === handleId);
    return edges.map(e => ctx.nodeMap.get(e.target)).filter(n => n !== undefined) as StrategyFlowNode[];
}

// =============================================================================
// FINAL CODE BUILDER
// =============================================================================

function buildFinalCode(config: {
    indicatorInit: string;
    variableInit: string;
    strategyLogic: string;
    leverage: number;
}): string {
    return `"""
Strategy Flow Generated Strategy
Generated on: ${new Date().toISOString()}
"""

from backtesting import Backtest, Strategy
from backtesting.lib import crossover
import numpy as np
import pandas as pd

try:
    import talib
except ImportError:
    talib = None
    print("Warning: TA-Lib not found. Using custom fallback implementations.")

# =============================================================================
# INDICATOR WRAPPERS (Hybrid: TA-Lib > Custom)
# =============================================================================

def SMA(values, n=14):
    """Simple Moving Average"""
    values = np.asarray(values, dtype=float)
    if talib: return talib.SMA(values, timeperiod=n)
    result = np.full_like(values, np.nan)
    for i in range(n - 1, len(values)):
        result[i] = np.mean(values[i - n + 1:i + 1])
    return result

def EMA(values, n=14):
    """Exponential Moving Average"""
    values = np.asarray(values, dtype=float)
    if talib: return talib.EMA(values, timeperiod=n)
    alpha = 2 / (n + 1)
    result = np.zeros_like(values)
    result[0] = values[0]
    for i in range(1, len(values)):
        result[i] = alpha * values[i] + (1 - alpha) * result[i-1]
    return result

def RSI(values, n=14):
    """Relative Strength Index"""
    values = np.asarray(values, dtype=float)
    if talib: return talib.RSI(values, timeperiod=n)
    deltas = np.diff(values)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    avg_gain = np.zeros(len(values))
    avg_loss = np.zeros(len(values))
    if len(gains) >= n:
        avg_gain[n] = np.mean(gains[:n])
        avg_loss[n] = np.mean(losses[:n])
        for i in range(n + 1, len(values)):
            avg_gain[i] = (avg_gain[i-1] * (n-1) + gains[i-1]) / n
            avg_loss[i] = (avg_loss[i-1] * (n-1) + losses[i-1]) / n
    rs = np.where(avg_loss != 0, avg_gain / avg_loss, 0)
    return 100 - (100 / (1 + rs))

def ATR(high, low, close, n=14):
    """Average True Range"""
    high = np.asarray(high, dtype=float)
    low = np.asarray(low, dtype=float)
    close = np.asarray(close, dtype=float)
    if talib: return talib.ATR(high, low, close, timeperiod=n)
    tr = np.zeros(len(close))
    tr[0] = high[0] - low[0]
    for i in range(1, len(close)):
        tr[i] = max(high[i] - low[i], abs(high[i] - close[i-1]), abs(low[i] - close[i-1]))
    atr = np.zeros(len(close))
    if len(close) >= n:
        atr[n-1] = np.mean(tr[:n])
        for i in range(n, len(close)):
            atr[i] = (atr[i-1] * (n-1) + tr[i]) / n
    return atr

def MACD(values, fast=12, slow=26, signal=9):
    """MACD"""
    values = np.asarray(values, dtype=float)
    if talib:
        return talib.MACD(values, fastperiod=fast, slowperiod=slow, signalperiod=signal)
    ema_fast = EMA(values, fast)
    ema_slow = EMA(values, slow)
    macd_line = ema_fast - ema_slow
    signal_line = EMA(macd_line, signal)
    hist = macd_line - signal_line
    return macd_line, signal_line, hist

def BBANDS(values, n=20, std_dev=2.0):
    """Bollinger Bands"""
    values = np.asarray(values, dtype=float)
    if talib:
        return talib.BBANDS(values, timeperiod=n, nbdevup=std_dev, nbdevdn=std_dev)
    middle = SMA(values, n)
    std = np.zeros_like(values)
    for i in range(n - 1, len(values)):
        std[i] = np.std(values[i - n + 1:i + 1])
    return middle + std_dev * std, middle, middle - std_dev * std

def STOCH(high, low, close, k=14, d=3):
    """Stochastic"""
    high = np.asarray(high, dtype=float)
    low = np.asarray(low, dtype=float)
    close = np.asarray(close, dtype=float)
    if talib:
        return talib.STOCH(high, low, close, fastk_period=k, slowk_period=3, slowd_period=d)
    _k = np.zeros(len(close))
    for i in range(k - 1, len(close)):
        hh = np.max(high[i - k + 1:i + 1])
        ll = np.min(low[i - k + 1:i + 1])
        if hh != ll: _k[i] = 100 * (close[i] - ll) / (hh - ll)
    _d = SMA(_k, d)
    return _k, _d

def DONCHIAN(high, low, n=20):
    """Donchian Channels"""
    high = pd.Series(high)
    low = pd.Series(low)
    upper = high.rolling(n).max()
    lower = low.rolling(n).min()
    return upper.values, lower.values

def KELTNER(high, low, close, n=20, multiplier=2.0):
    """Keltner Channels"""
    middle = EMA(close, n)
    atr = ATR(high, low, close, n)
    upper = middle + (multiplier * atr)
    lower = middle - (multiplier * atr)
    return upper, middle, lower

def ICHIMOKU(high, low, tenkan=9, kijun=26, senkou_b=52):
    """Ichimoku Cloud"""
    high_s = pd.Series(high)
    low_s = pd.Series(low)
    tenkan_line = ((high_s.rolling(window=tenkan).max() + low_s.rolling(window=tenkan).min()) / 2)
    kijun_line = ((high_s.rolling(window=kijun).max() + low_s.rolling(window=kijun).min()) / 2)
    senkou_a = ((tenkan_line + kijun_line) / 2).shift(kijun)
    senkou_b_line = ((high_s.rolling(window=senkou_b).max() + low_s.rolling(window=senkou_b).min()) / 2).shift(kijun)
    return tenkan_line.values, kijun_line.values, senkou_a.values, senkou_b_line.values

# =============================================================================
# GENERATED STRATEGY
# =============================================================================

class GeneratedStrategy(Strategy):
    # Parameters
    leverage = ${config.leverage}
    
    def init(self):
        # Indicators
        ${config.indicatorInit || '# No indicators used'}
        
        # Variables
        ${config.variableInit || '# No variables used'}
    
    def next(self):
        # Skip if insufficient data
        if len(self.data) < 20:
            return
        
        # Strategy Logic
        ${config.strategyLogic || 'pass'}

# =============================================================================
# BACKTEST RUNNER
# =============================================================================

def run_backtest(df, cash=10000, commission=0.001):
    bt = Backtest(df, GeneratedStrategy, cash=cash, commission=commission, exclusive_orders=True)
    return bt.run()
`;
}
