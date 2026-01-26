import * as Blockly from 'blockly';

/**
 * PyGenerator - Blockly to Python Code Generator for backtesting.py
 * 
 * Mirrors mqlGenerator architecture but outputs Python compatible with backtesting.py
 */
export const pyGenerator = new Blockly.Generator('PythonTrading') as any;

// =============================================================================
// PYTHON OPERATOR PRECEDENCE (ORDER)
// =============================================================================
pyGenerator.ORDER_ATOMIC = 0;            // Literals, identifiers
pyGenerator.ORDER_EXPONENTIATION = 1;    // **
pyGenerator.ORDER_UNARY = 2;             // -x, not x
pyGenerator.ORDER_MULTIPLICATIVE = 3;    // *, /, //, %
pyGenerator.ORDER_ADDITIVE = 4;          // +, -
pyGenerator.ORDER_RELATIONAL = 5;        // <, <=, >, >=, in, not in, is, is not
pyGenerator.ORDER_EQUALITY = 6;          // ==, !=
pyGenerator.ORDER_BITWISE_AND = 7;       // &
pyGenerator.ORDER_BITWISE_XOR = 8;       // ^
pyGenerator.ORDER_BITWISE_OR = 9;        // |
pyGenerator.ORDER_LOGICAL_AND = 10;      // and
pyGenerator.ORDER_LOGICAL_OR = 11;       // or
pyGenerator.ORDER_CONDITIONAL = 12;      // x if y else z
pyGenerator.ORDER_NONE = 99;             // (...)

// =============================================================================
// LIFECYCLE METHODS
// =============================================================================

pyGenerator.workspaceToCode = function (workspace: Blockly.Workspace, leverage: number = 1) {
    pyGenerator.leverage_ = leverage;
    return Object.getPrototypeOf(this).workspaceToCode.call(this, workspace);
};

pyGenerator.init = function (workspace: Blockly.Workspace) {
    pyGenerator.definitions_ = {};
    pyGenerator.indicators_ = [];
    pyGenerator.indicatorCache_ = {};
    pyGenerator.imports_ = new Set([
        'from backtesting import Backtest, Strategy',
        'from backtesting.lib import crossover',
        'import numpy as np',
        'import pandas as pd',
    ]);

    // Collect variables
    const variables = Blockly.Variables.allUsedVarModels(workspace);
    const varDefs: string[] = [];
    for (let i = 0; i < variables.length; i++) {
        const varName = pyGenerator.variableDB_.getName(variables[i].getId(), Blockly.Names.NameType.VARIABLE);
        varDefs.push(`self.${varName} = 0`);
    }
    pyGenerator.definitions_['variables'] = varDefs.join('\n        ');
};

pyGenerator.finish = function (code: string) {
    const hasCode = code && code.trim().length > 0;

    if (!hasCode) {
        return '# Add blocks to your workspace to generate Python code';
    }

    // Build imports
    const imports = Array.from(pyGenerator.imports_ as Set<string>).join('\n');

    // Build indicator init code
    const indicatorInit = pyGenerator.indicators_.join('\n        ');

    // Build variable init
    const varInit = pyGenerator.definitions_['variables'] || '';

    return `${imports}
try:
    import talib
except ImportError:
    talib = None
    print("Warning: TA-Lib not found. Using custom fallback implementations where available.")

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
    ema = np.zeros_like(values)
    ema[0] = values[0]
    for i in range(1, len(values)):
        ema[i] = alpha * values[i] + (1 - alpha) * ema[i-1]
    return ema

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
    if talib: return talib.MACD(values, fastperiod=fast, slowperiod=slow, signalperiod=signal)
    
    ema_fast = EMA(values, fast)
    ema_slow = EMA(values, slow)
    macd_line = ema_fast - ema_slow
    signal_line = EMA(macd_line, signal)
    hist = macd_line - signal_line
    return macd_line, signal_line, hist

def BBANDS(values, n=20, std_dev=2.0):
    """Bollinger Bands"""
    values = np.asarray(values, dtype=float)
    if talib: return talib.BBANDS(values, timeperiod=n, nbdevup=std_dev, nbdevdn=std_dev)
    
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
    if talib: return talib.STOCH(high, low, close, fastk_period=k, slowk_period=3, slowd_period=d)
    
    # Simple fallback (Fast%K, SMA%D)
    _k = np.zeros(len(close))
    for i in range(k - 1, len(close)):
        hh = np.max(high[i - k + 1:i + 1])
        ll = np.min(low[i - k + 1:i + 1])
        if hh != ll: _k[i] = 100 * (close[i] - ll) / (hh - ll)
    _d = SMA(_k, d)
    return _k, _d

def DONCHIAN(high, low, n=20):
    """Donchian Channels"""
    # No standard TA-Lib func, use custom
    high = pd.Series(high)
    low = pd.Series(low)
    upper = high.rolling(n).max()
    lower = low.rolling(n).min()
    return upper.values, lower.values

def KELTNER(high, low, close, n=20, multiplier=2.0):
    """Keltner Channels"""
    # EMA for middle line
    middle = EMA(close, n)
    # ATR for band width
    atr = ATR(high, low, close, n)
    upper = middle + (multiplier * atr)
    lower = middle - (multiplier * atr)
    return upper, middle, lower

def ICHIMOKU(high, low, tenkan=9, kijun=26, senkou_b=52):
    """Ichimoku Cloud"""
    # Tenkan-sen (Conversion Line)
    # (Highest High + Lowest Low) / 2 for last 9 periods
    high_s = pd.Series(high)
    low_s = pd.Series(low)
    
    tenkan_high = high_s.rolling(window=tenkan).max()
    tenkan_low = low_s.rolling(window=tenkan).min()
    tenkan_line = (tenkan_high + tenkan_low) / 2

    # Kijun-sen (Base Line)
    # (Highest High + Lowest Low) / 2 for last 26 periods
    kijun_high = high_s.rolling(window=kijun).max()
    kijun_low = low_s.rolling(window=kijun).min()
    kijun_line = (kijun_high + kijun_low) / 2

    # Senkou Span A (Leading Span A)
    # (Conversion Line + Base Line) / 2, shifted forward by 26 periods
    senkou_a = ((tenkan_line + kijun_line) / 2).shift(kijun)

    # Senkou Span B (Leading Span B)
    # (Highest High + Lowest Low) / 2 for last 52 periods, shifted forward by 26 periods
    senkou_b_high = high_s.rolling(window=senkou_b).max()
    senkou_b_low = low_s.rolling(window=senkou_b).min()
    senkou_b_line = ((senkou_b_high + senkou_b_low) / 2).shift(kijun)
    
    # Chikou Span (Lagging Span) is just Close shifted back, but we return arrays aligned to current time
    # This is usually handled by looking at Future data in backtesting or Past data in live.
    # We will return 0s for now or just not use it for simple logic.
    
    return tenkan_line.values, kijun_line.values, senkou_a.values, senkou_b_line.values

def GET_SUPPORT(low, n=20):
    """Local Minima Support"""
    return pd.Series(low).rolling(window=n).min().values

def GET_RESISTANCE(high, n=20):
    """Local Maxima Resistance"""
    return pd.Series(high).rolling(window=n).max().values

# =============================================================================
# GENERATED STRATEGY
# =============================================================================

class GeneratedStrategy(Strategy):
    # Parameters
    leverage = ${pyGenerator.leverage_ || 1}
    
    def init(self):
        # Indicators
        ${indicatorInit || '# No indicators used'}
        
        # Variables
        ${varInit || '# No variables used'}
    
    def next(self):
${pyGenerator.prefixLines(code, '        ')}

# =============================================================================
# BACKTEST RUNNER
# =============================================================================

def run_backtest(df, cash=10000, commission=0.001):
    bt = Backtest(df, GeneratedStrategy, cash=cash, commission=commission, exclusive_orders=True)
    return bt.run()
`;
};

pyGenerator.scrub_ = function (block: Blockly.Block, code: string, opt_thisOnly?: boolean) {
    const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
    const nextCode = opt_thisOnly ? '' : pyGenerator.blockToCode(nextBlock);
    return code + nextCode;
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getIndicatorPeriod = (block: Blockly.Block): number => {
    const val = block.getFieldValue('PERIOD');
    if (val !== null && val !== undefined) return parseInt(val);
    return (block as any).indicatorParams?.['period'] ?? 14;
};

const getIndicatorParam = (block: Blockly.Block, paramName: string, defaultValue: any): any => {
    return (block as any).indicatorParams?.[paramName] ?? defaultValue;
};

// =============================================================================
// CONTROL BLOCKS
// =============================================================================

pyGenerator.forBlock['control_forever'] = function (block: Blockly.Block) {
    const doCode = pyGenerator.statementToCode(block, 'DO');
    return doCode;
};

pyGenerator.forBlock['control_if'] = function (block: Blockly.Block) {
    const condition = pyGenerator.valueToCode(block, 'CONDITION', pyGenerator.ORDER_NONE) || 'False';
    const doCode = pyGenerator.statementToCode(block, 'DO') || 'pass\n';
    return `if ${condition}:\n${doCode}`;
};

pyGenerator.forBlock['control_if_else'] = function (block: Blockly.Block) {
    const condition = pyGenerator.valueToCode(block, 'CONDITION', pyGenerator.ORDER_NONE) || 'False';
    const doCode = pyGenerator.statementToCode(block, 'DO') || '    pass\n';
    const elseCode = pyGenerator.statementToCode(block, 'ELSE') || '    pass\n';
    return `if ${condition}:\n${doCode}else:\n${elseCode}`;
};

pyGenerator.forBlock['controls_if'] = function (block: Blockly.Block) {
    let n = 0;
    let code = '';
    do {
        const conditionCode = pyGenerator.valueToCode(block, 'IF' + n, pyGenerator.ORDER_NONE) || 'False';
        const branchCode = pyGenerator.statementToCode(block, 'DO' + n) || '    pass\n';
        code += (n === 0 ? 'if ' : 'elif ') + conditionCode + ':\n' + branchCode;
        ++n;
    } while (block.getInput('IF' + n));

    if (block.getInput('ELSE')) {
        let branchCode = pyGenerator.statementToCode(block, 'ELSE') || '    pass\n';
        code += 'else:\n' + branchCode;
    }
    return code;
};

pyGenerator.forBlock['control_repeat'] = function (block: Blockly.Block) {
    const times = pyGenerator.valueToCode(block, 'TIMES', pyGenerator.ORDER_NONE) || '1';
    const doCode = pyGenerator.statementToCode(block, 'DO') || '    pass\n';
    return `for _i in range(${times}):\n${doCode}`;
};

pyGenerator.forBlock['control_stop'] = function () {
    return 'return\n';
};

// =============================================================================
// OPERATOR BLOCKS
// =============================================================================

pyGenerator.forBlock['operator_less'] = function (block: Blockly.Block) {
    const left = pyGenerator.valueToCode(block, 'LEFT', pyGenerator.ORDER_RELATIONAL) || '0';
    const right = pyGenerator.valueToCode(block, 'RIGHT', pyGenerator.ORDER_RELATIONAL) || '0';
    return [`${left} < ${right}`, pyGenerator.ORDER_RELATIONAL];
};

pyGenerator.forBlock['operator_greater'] = function (block: Blockly.Block) {
    const left = pyGenerator.valueToCode(block, 'LEFT', pyGenerator.ORDER_RELATIONAL) || '0';
    const right = pyGenerator.valueToCode(block, 'RIGHT', pyGenerator.ORDER_RELATIONAL) || '0';
    return [`${left} > ${right}`, pyGenerator.ORDER_RELATIONAL];
};

pyGenerator.forBlock['operator_equals'] = function (block: Blockly.Block) {
    const left = pyGenerator.valueToCode(block, 'LEFT', pyGenerator.ORDER_EQUALITY) || '0';
    const right = pyGenerator.valueToCode(block, 'RIGHT', pyGenerator.ORDER_EQUALITY) || '0';
    return [`${left} == ${right}`, pyGenerator.ORDER_EQUALITY];
};

pyGenerator.forBlock['operator_less_equals'] = function (block: Blockly.Block) {
    const left = pyGenerator.valueToCode(block, 'LEFT', pyGenerator.ORDER_RELATIONAL) || '0';
    const right = pyGenerator.valueToCode(block, 'RIGHT', pyGenerator.ORDER_RELATIONAL) || '0';
    return [`${left} <= ${right}`, pyGenerator.ORDER_RELATIONAL];
};

pyGenerator.forBlock['operator_greater_equals'] = function (block: Blockly.Block) {
    const left = pyGenerator.valueToCode(block, 'LEFT', pyGenerator.ORDER_RELATIONAL) || '0';
    const right = pyGenerator.valueToCode(block, 'RIGHT', pyGenerator.ORDER_RELATIONAL) || '0';
    return [`${left} >= ${right}`, pyGenerator.ORDER_RELATIONAL];
};

pyGenerator.forBlock['operator_not_equals'] = function (block: Blockly.Block) {
    const left = pyGenerator.valueToCode(block, 'LEFT', pyGenerator.ORDER_EQUALITY) || '0';
    const right = pyGenerator.valueToCode(block, 'RIGHT', pyGenerator.ORDER_EQUALITY) || '0';
    return [`${left} != ${right}`, pyGenerator.ORDER_EQUALITY];
};

pyGenerator.forBlock['operator_and'] = function (block: Blockly.Block) {
    const left = pyGenerator.valueToCode(block, 'LEFT', pyGenerator.ORDER_LOGICAL_AND) || 'False';
    const right = pyGenerator.valueToCode(block, 'RIGHT', pyGenerator.ORDER_LOGICAL_AND) || 'False';
    return [`${left} and ${right}`, pyGenerator.ORDER_LOGICAL_AND];
};

pyGenerator.forBlock['operator_or'] = function (block: Blockly.Block) {
    const left = pyGenerator.valueToCode(block, 'LEFT', pyGenerator.ORDER_LOGICAL_OR) || 'False';
    const right = pyGenerator.valueToCode(block, 'RIGHT', pyGenerator.ORDER_LOGICAL_OR) || 'False';
    return [`${left} or ${right}`, pyGenerator.ORDER_LOGICAL_OR];
};

pyGenerator.forBlock['operator_not'] = function (block: Blockly.Block) {
    const value = pyGenerator.valueToCode(block, 'VALUE', pyGenerator.ORDER_UNARY) || 'False';
    return [`not ${value}`, pyGenerator.ORDER_UNARY];
};

pyGenerator.forBlock['operator_add'] = function (block: Blockly.Block) {
    const left = pyGenerator.valueToCode(block, 'LEFT', pyGenerator.ORDER_ADDITIVE) || '0';
    const right = pyGenerator.valueToCode(block, 'RIGHT', pyGenerator.ORDER_ADDITIVE) || '0';
    return [`${left} + ${right}`, pyGenerator.ORDER_ADDITIVE];
};

pyGenerator.forBlock['operator_subtract'] = function (block: Blockly.Block) {
    const left = pyGenerator.valueToCode(block, 'LEFT', pyGenerator.ORDER_ADDITIVE) || '0';
    const right = pyGenerator.valueToCode(block, 'RIGHT', pyGenerator.ORDER_ADDITIVE) || '0';
    return [`${left} - ${right}`, pyGenerator.ORDER_ADDITIVE];
};

pyGenerator.forBlock['operator_multiply'] = function (block: Blockly.Block) {
    const left = pyGenerator.valueToCode(block, 'LEFT', pyGenerator.ORDER_MULTIPLICATIVE) || '0';
    const right = pyGenerator.valueToCode(block, 'RIGHT', pyGenerator.ORDER_MULTIPLICATIVE) || '0';
    return [`${left} * ${right}`, pyGenerator.ORDER_MULTIPLICATIVE];
};

pyGenerator.forBlock['operator_divide'] = function (block: Blockly.Block) {
    const left = pyGenerator.valueToCode(block, 'LEFT', pyGenerator.ORDER_MULTIPLICATIVE) || '0';
    const right = pyGenerator.valueToCode(block, 'RIGHT', pyGenerator.ORDER_MULTIPLICATIVE) || '1';
    return [`${left} / ${right}`, pyGenerator.ORDER_MULTIPLICATIVE];
};

pyGenerator.forBlock['operator_advanced_math'] = function (block: Blockly.Block) {
    const OP_MAP: { [key: string]: string } = {
        'ROOT': 'np.sqrt', 'ABS': 'np.abs', 'NEG': '-',
        'LN': 'np.log', 'LOG10': 'np.log10', 'EXP': 'np.exp', 'POW10': '10**'
    };
    const op = block.getFieldValue('OP');
    const val = pyGenerator.valueToCode(block, 'NUM', pyGenerator.ORDER_NONE) || '0';
    const func = OP_MAP[op];

    if (op === 'NEG') return [`-${val}`, pyGenerator.ORDER_UNARY];
    if (op === 'POW10') return [`10**${val}`, pyGenerator.ORDER_EXPONENTIATION];
    return [`${func}(${val})`, pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['logic_compare'] = function (block: Blockly.Block) {
    const OPERATORS: { [key: string]: string } = {
        'EQ': '==', 'NEQ': '!=', 'LT': '<', 'LTE': '<=', 'GT': '>', 'GTE': '>='
    };
    const op = OPERATORS[block.getFieldValue('OP')] || '==';
    const order = (op === '==' || op === '!=') ? pyGenerator.ORDER_EQUALITY : pyGenerator.ORDER_RELATIONAL;
    const left = pyGenerator.valueToCode(block, 'A', order) || '0';
    const right = pyGenerator.valueToCode(block, 'B', order) || '0';
    return [`${left} ${op} ${right}`, order];
};

pyGenerator.forBlock['logic_operation'] = function (block: Blockly.Block) {
    const op = block.getFieldValue('OP') === 'AND' ? 'and' : 'or';
    const order = op === 'and' ? pyGenerator.ORDER_LOGICAL_AND : pyGenerator.ORDER_LOGICAL_OR;
    const left = pyGenerator.valueToCode(block, 'A', order) || 'False';
    const right = pyGenerator.valueToCode(block, 'B', order) || 'False';
    return [`${left} ${op} ${right}`, order];
};

pyGenerator.forBlock['logic_boolean'] = function (block: Blockly.Block) {
    return [block.getFieldValue('BOOL') === 'TRUE' ? 'True' : 'False', pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['math_number'] = function (block: Blockly.Block) {
    const num = Number(block.getFieldValue('NUM'));
    return [String(num), num >= 0 ? pyGenerator.ORDER_ATOMIC : pyGenerator.ORDER_UNARY];
};

pyGenerator.forBlock['math_arithmetic'] = function (block: Blockly.Block) {
    const OPERATORS: { [key: string]: [string, number] } = {
        'ADD': [' + ', pyGenerator.ORDER_ADDITIVE],
        'MINUS': [' - ', pyGenerator.ORDER_ADDITIVE],
        'MULTIPLY': [' * ', pyGenerator.ORDER_MULTIPLICATIVE],
        'DIVIDE': [' / ', pyGenerator.ORDER_MULTIPLICATIVE],
        'POWER': [' ** ', pyGenerator.ORDER_EXPONENTIATION]
    };
    const tuple = OPERATORS[block.getFieldValue('OP')] || [' + ', pyGenerator.ORDER_ADDITIVE];
    const left = pyGenerator.valueToCode(block, 'A', tuple[1]) || '0';
    const right = pyGenerator.valueToCode(block, 'B', tuple[1]) || '0';
    return [`${left}${tuple[0]}${right}`, tuple[1]];
};

// =============================================================================
// VARIABLES
// =============================================================================

pyGenerator.forBlock['variables_get'] = function (block: Blockly.Block) {
    const varName = pyGenerator.variableDB_.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE);
    return [`self.${varName}`, pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['variables_set'] = function (block: Blockly.Block) {
    const value = pyGenerator.valueToCode(block, 'VALUE', pyGenerator.ORDER_NONE) || '0';
    const varName = pyGenerator.variableDB_.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE);
    return `self.${varName} = ${value}\n`;
};

// =============================================================================
// ENVIRONMENT BLOCKS
// =============================================================================

pyGenerator.forBlock['environment_price'] = function () {
    return ['self.data.Close[-1]', pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['environment_spread'] = function () {
    return ['(self.data.High[-1] - self.data.Low[-1])', pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['environment_prev_candle_open'] = function () {
    return ['self.data.Open[-2]', pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['environment_prev_ticker_close'] = function () {
    return ['self.data.Close[-2]', pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['environment_is_market_open'] = function () {
    return ['True', pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['environment_time'] = function () {
    return ['self.data.index[-1]', pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['environment_day_of_week'] = function () {
    return ['self.data.index[-1].weekday()', pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['environment_new_candle_open'] = function () {
    return ['True', pyGenerator.ORDER_ATOMIC];
};

// =============================================================================
// INDICATOR BLOCKS (CORE: Wrapper Supported)
// =============================================================================

pyGenerator.forBlock['ta_sma'] = function (block: Blockly.Block) {
    const period = getIndicatorParam(block, 'ma_period', 14);
    const cacheKey = `sma_${period}`;
    if (!pyGenerator.indicatorCache_[cacheKey]) {
        pyGenerator.indicatorCache_[cacheKey] = `self.sma_${period}`;
        pyGenerator.indicators_.push(`self.sma_${period} = self.I(SMA, self.data.Close, n=${period})`);
    }
    return [`self.sma_${period}[-1]`, pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['ta_ema'] = function (block: Blockly.Block) {
    const period = getIndicatorParam(block, 'ma_period', 14);
    const cacheKey = `ema_${period}`;
    if (!pyGenerator.indicatorCache_[cacheKey]) {
        pyGenerator.indicatorCache_[cacheKey] = `self.ema_${period}`;
        pyGenerator.indicators_.push(`self.ema_${period} = self.I(EMA, self.data.Close, n=${period})`);
    }
    return [`self.ema_${period}[-1]`, pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['ta_rsi'] = function (block: Blockly.Block) {
    const period = getIndicatorParam(block, 'ma_period', 14);
    const cacheKey = `rsi_${period}`;
    if (!pyGenerator.indicatorCache_[cacheKey]) {
        pyGenerator.indicatorCache_[cacheKey] = `self.rsi_${period}`;
        pyGenerator.indicators_.push(`self.rsi_${period} = self.I(RSI, self.data.Close, n=${period})`);
    }
    return [`self.rsi_${period}[-1]`, pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['ta_atr'] = function (block: Blockly.Block) {
    const period = getIndicatorParam(block, 'ma_period', 14);
    const cacheKey = `atr_${period}`;
    if (!pyGenerator.indicatorCache_[cacheKey]) {
        pyGenerator.indicatorCache_[cacheKey] = `self.atr_${period}`;
        pyGenerator.indicators_.push(`self.atr_${period} = self.I(ATR, self.data.High, self.data.Low, self.data.Close, n=${period})`);
    }
    return [`self.atr_${period}[-1]`, pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['ta_bb'] = function (block: Blockly.Block) {
    const period = getIndicatorParam(block, 'ma_period', 20);
    const deviation = getIndicatorParam(block, 'deviation', 2.0);
    const component = block.getFieldValue('COMPONENT') || 'middle';
    const cacheKey = `bb_${period}_${deviation}`;
    if (!pyGenerator.indicatorCache_[cacheKey]) {
        pyGenerator.indicatorCache_[cacheKey] = true;
        pyGenerator.indicators_.push(`self.bb_upper_${period}, self.bb_middle_${period}, self.bb_lower_${period} = self.I(BBANDS, self.data.Close, n=${period}, std_dev=${deviation})`);
    }
    const compMap: { [key: string]: string } = {
        'upper': `self.bb_upper_${period}[-1]`,
        'middle': `self.bb_middle_${period}[-1]`,
        'lower': `self.bb_lower_${period}[-1]`
    };
    return [compMap[component] || compMap['middle'], pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['ta_stochastic'] = function (block: Blockly.Block) {
    const kPeriod = getIndicatorParam(block, 'kPeriod', 14);
    const dPeriod = getIndicatorParam(block, 'dPeriod', 3);
    const component = block.getFieldValue('COMPONENT') || 'k';
    const cacheKey = `stoch_${kPeriod}_${dPeriod}`;
    if (!pyGenerator.indicatorCache_[cacheKey]) {
        pyGenerator.indicatorCache_[cacheKey] = true;
        pyGenerator.indicators_.push(`self.stoch_k_${kPeriod}, self.stoch_d_${kPeriod} = self.I(STOCH, self.data.High, self.data.Low, self.data.Close, k=${kPeriod}, d=${dPeriod})`);
    }
    return [component === 'd' ? `self.stoch_d_${kPeriod}[-1]` : `self.stoch_k_${kPeriod}[-1]`, pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['macd_value'] = function (block: Blockly.Block) {
    const fast = getIndicatorParam(block, 'fastEMA', 12);
    const slow = getIndicatorParam(block, 'slowEMA', 26);
    const signal = getIndicatorParam(block, 'signalSMA', 9);
    const component = block.getFieldValue('COMPONENT') || 'line';
    const cacheKey = `macd_${fast}_${slow}_${signal}`;
    if (!pyGenerator.indicatorCache_[cacheKey]) {
        pyGenerator.indicatorCache_[cacheKey] = true;
        pyGenerator.indicators_.push(`self.macd_line, self.macd_signal, self.macd_hist = self.I(MACD, self.data.Close, fast=${fast}, slow=${slow}, signal=${signal})`);
    }
    const compMap: { [key: string]: string } = {
        'line': 'self.macd_line[-1]',
        'signal': 'self.macd_signal[-1]',
        'histogram': 'self.macd_hist[-1]'
    };
    return [compMap[component] || compMap['line'], pyGenerator.ORDER_ATOMIC];
};


// =============================================================================
// INDICATOR BLOCKS (EXTENDED: Require TA-Lib)
// =============================================================================

// Direct TA-Lib Mapping for Extended Set
const TALIB_MAPPING: { [key: string]: { func: string, args: string, periodArg: string } } = {
    'ta_wma': { func: 'talib.WMA', args: 'self.data.Close', periodArg: 'timeperiod' },
    'ta_lwma': { func: 'talib.WMA', args: 'self.data.Close', periodArg: 'timeperiod' },
    'dema': { func: 'talib.DEMA', args: 'self.data.Close', periodArg: 'timeperiod' },
    'tema': { func: 'talib.TEMA', args: 'self.data.Close', periodArg: 'timeperiod' },
    'ama': { func: 'talib.KAMA', args: 'self.data.Close', periodArg: 'timeperiod' },
    'ta_cci': { func: 'talib.CCI', args: 'self.data.High, self.data.Low, self.data.Close', periodArg: 'timeperiod' },
    'ta_adx': { func: 'talib.ADX', args: 'self.data.High, self.data.Low, self.data.Close', periodArg: 'timeperiod' },
    'ta_williams_r': { func: 'talib.WILLR', args: 'self.data.High, self.data.Low, self.data.Close', periodArg: 'timeperiod' },
    'ta_mfi': { func: 'talib.MFI', args: 'self.data.High, self.data.Low, self.data.Close, self.data.Volume', periodArg: 'timeperiod' },
    'trix': { func: 'talib.TRIX', args: 'self.data.Close', periodArg: 'timeperiod' },
    'ta_dmi': { func: 'talib.DX', args: 'self.data.High, self.data.Low, self.data.Close', periodArg: 'timeperiod' },
    'ta_obv': { func: 'talib.OBV', args: 'self.data.Close, self.data.Volume', periodArg: '' }, // No period
    'momentum': { func: 'talib.MOM', args: 'self.data.Close', periodArg: 'timeperiod' },
};

Object.keys(TALIB_MAPPING).forEach(type => {
    pyGenerator.forBlock[type] = function (block: Blockly.Block) {
        const period = getIndicatorParam(block, 'ma_period', 14);
        const cacheKey = `${type}_${period}`;
        const mapping = TALIB_MAPPING[type];

        if (!pyGenerator.indicatorCache_[cacheKey]) {
            pyGenerator.indicatorCache_[cacheKey] = `self.${type}_${period}`;
            let callArgs = mapping.args;
            if (mapping.periodArg) {
                callArgs += `, ${mapping.periodArg}=${period}`;
            }
            // Add check for talib in generated code? No, simple execution logic
            pyGenerator.indicators_.push(`self.${type}_${period} = self.I(${mapping.func}, ${callArgs})`);
        }
        return [`self.${type}_${period}[-1]`, pyGenerator.ORDER_ATOMIC];
    };
});

// Others (Placeholder or Custom)
pyGenerator.forBlock['donchian'] = function (block: Blockly.Block) {
    const period = getIndicatorParam(block, 'period', 20);
    const component = block.getFieldValue('COMPONENT') || 'upper';
    const cacheKey = `donchian_${period}`;
    if (!pyGenerator.indicatorCache_[cacheKey]) {
        pyGenerator.indicatorCache_[cacheKey] = true;
        pyGenerator.indicators_.push(`self.donchian_upper_${period}, self.donchian_lower_${period} = self.I(DONCHIAN, self.data.High, self.data.Low, n=${period})`);
    }
    return [component === 'upper' ? `self.donchian_upper_${period}[-1]` : `self.donchian_lower_${period}[-1]`, pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['ta_keltner'] = function (block: Blockly.Block) {
    const period = getIndicatorParam(block, 'ma_period', 20);
    const multiplier = getIndicatorParam(block, 'deviation', 2.0);
    const component = block.getFieldValue('COMPONENT') || 'middle';

    // Cache key needs both params
    const cacheKey = `keltner_${period}_${multiplier}`;

    if (!pyGenerator.indicatorCache_[cacheKey]) {
        pyGenerator.indicatorCache_[cacheKey] = true;
        // self.I(KELTNER, ...) returns upper, middle, lower
        pyGenerator.indicators_.push(`self.kelt_upper_${period}, self.kelt_middle_${period}, self.kelt_lower_${period} = self.I(KELTNER, self.data.High, self.data.Low, self.data.Close, n=${period}, multiplier=${multiplier})`);
    }

    const compMap: { [key: string]: string } = {
        'upper': `self.kelt_upper_${period}[-1]`,
        'middle': `self.kelt_middle_${period}[-1]`,
        'lower': `self.kelt_lower_${period}[-1]`
    };
    return [compMap[component] || compMap['middle'], pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['ichimoku'] = function (block: Blockly.Block) {
    const tenkan = getIndicatorParam(block, 'tenkanSen', 9);
    const kijun = getIndicatorParam(block, 'kijunSen', 26);
    const senkouB = getIndicatorParam(block, 'senkouSpanB', 52);
    const component = block.getFieldValue('COMPONENT') || 'tenkan';

    const cacheKey = `ichimoku_${tenkan}_${kijun}_${senkouB}`;

    if (!pyGenerator.indicatorCache_[cacheKey]) {
        pyGenerator.indicatorCache_[cacheKey] = true;
        pyGenerator.indicators_.push(`self.ichi_tenkan_${tenkan}, self.ichi_kijun_${kijun}, self.ichi_sqa_${tenkan}, self.ichi_sqb_${tenkan} = self.I(ICHIMOKU, self.data.High, self.data.Low, tenkan=${tenkan}, kijun=${kijun}, senkou_b=${senkouB})`);
    }

    const compMap: { [key: string]: string } = {
        'tenkan': `self.ichi_tenkan_${tenkan}[-1]`,
        'kijun': `self.ichi_kijun_${kijun}[-1]`,
        'senkouA': `self.ichi_sqa_${tenkan}[-1]`,
        'senkouB': `self.ichi_sqb_${tenkan}[-1]`
    };
    // Chickou span is often not used in basic strategies, omitting for now

    return [compMap[component] || compMap['tenkan'], pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['ta_support'] = function (block: Blockly.Block) {
    const period = getIndicatorParam(block, 'lookback', 20);
    const cacheKey = `support_${period}`;
    if (!pyGenerator.indicatorCache_[cacheKey]) {
        pyGenerator.indicatorCache_[cacheKey] = true;
        pyGenerator.indicators_.push(`self.support_${period} = self.I(GET_SUPPORT, self.data.Low, n=${period})`);
    }
    return [`self.support_${period}[-1]`, pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['ta_resistance'] = function (block: Blockly.Block) {
    const period = getIndicatorParam(block, 'lookback', 20);
    const cacheKey = `resistance_${period}`;
    if (!pyGenerator.indicatorCache_[cacheKey]) {
        pyGenerator.indicatorCache_[cacheKey] = true;
        pyGenerator.indicators_.push(`self.resistance_${period} = self.I(GET_RESISTANCE, self.data.High, n=${period})`);
    }
    return [`self.resistance_${period}[-1]`, pyGenerator.ORDER_ATOMIC];
};

// Fallback for remaining (use Simple MA as placeholder to avoid crash if not critical)
const PLACEHOLDERS = ['ta_smma', 'frama', 'vidya', 'force', 'bearsPower', 'bullsPower', 'ta_sar'];
PLACEHOLDERS.forEach(type => {
    pyGenerator.forBlock[type] = pyGenerator.forBlock['ta_sma'];
});

// =============================================================================
// TRADE BLOCKS
// =============================================================================

pyGenerator.forBlock['trade_order'] = function (block: Blockly.Block) {
    const direction = block.getFieldValue('DIRECTION') || 'long';
    const size = block.getFieldValue('SIZE') || '0.1';
    const sizeType = block.getFieldValue('SIZE_TYPE') || 'lots';

    let sizeCode = size;
    if (sizeType === 'percent') {
        sizeCode = `self.equity * ${parseFloat(size) / 100}`;
    } else if (sizeType === 'usd') {
        sizeCode = `${size} / self.data.Close[-1]`;
    }

    if (direction === 'long') {
        return `if not self.position:\n    self.buy(size=${sizeCode})\n`;
    } else {
        return `if not self.position:\n    self.sell(size=${sizeCode})\n`;
    }
};

pyGenerator.forBlock['trade_close'] = function (block: Blockly.Block) {
    return 'if self.position:\n    self.position.close()\n';
};

pyGenerator.forBlock['trade_close_all'] = function () {
    return 'if self.position:\n    self.position.close()\n';
};

pyGenerator.forBlock['trade_take_profit'] = function (block: Blockly.Block) {
    const price = pyGenerator.valueToCode(block, 'PRICE', pyGenerator.ORDER_NONE) || 'self.data.Close[-1] * 1.02';
    return `# TP set to ${price}\n`;
};

pyGenerator.forBlock['trade_stop_loss'] = function (block: Blockly.Block) {
    const price = pyGenerator.valueToCode(block, 'PRICE', pyGenerator.ORDER_NONE) || 'self.data.Close[-1] * 0.98';
    return `# SL set to ${price}\n`;
};

pyGenerator.forBlock['trade_entry_price'] = function () {
    return ['self.position.entry_price if self.position else self.data.Close[-1]', pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['trade_pnl_of'] = function () {
    return ['self.position.pl if self.position else 0', pyGenerator.ORDER_ATOMIC];
};

pyGenerator.forBlock['trade_position_size'] = function () {
    return ['self.position.size if self.position else 0', pyGenerator.ORDER_ATOMIC];
};

// =============================================================================
// RISK MANAGEMENT BLOCKS
// =============================================================================

pyGenerator.forBlock['risk_trailing_stop'] = function (block: Blockly.Block) {
    const percent = pyGenerator.valueToCode(block, 'PERCENT', pyGenerator.ORDER_NONE) || '2';
    return `# Trailing stop at ${percent}%\n`;
};

pyGenerator.forBlock['risk_position_percent'] = function (block: Blockly.Block) {
    const percent = pyGenerator.valueToCode(block, 'PERCENT', pyGenerator.ORDER_NONE) || '10';
    return [`self.equity * ${parseFloat(percent as string) / 100} / self.data.Close[-1]`, pyGenerator.ORDER_MULTIPLICATIVE];
};

pyGenerator.forBlock['risk_max_drawdown'] = function (block: Blockly.Block) {
    const percent = pyGenerator.valueToCode(block, 'PERCENT', pyGenerator.ORDER_NONE) || '20';
    return `# Max drawdown limit: ${percent}%\n`;
};
