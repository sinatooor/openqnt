import * as Blockly from 'blockly';

/**
 * NautilusGenerator - Blockly to Python Code Generator for NautilusTrader
 * 
 * Generates Python code compatible with NautilusTrader's Strategy API.
 * Uses on_start/on_bar pattern instead of init/next.
 */
export const nautilusGenerator = new Blockly.Generator('NautilusTrader') as any;

// =============================================================================
// PYTHON OPERATOR PRECEDENCE (ORDER)
// =============================================================================
nautilusGenerator.ORDER_ATOMIC = 0;            // Literals, identifiers
nautilusGenerator.ORDER_EXPONENTIATION = 1;    // **
nautilusGenerator.ORDER_UNARY = 2;             // -x, not x
nautilusGenerator.ORDER_MULTIPLICATIVE = 3;    // *, /, //, %
nautilusGenerator.ORDER_ADDITIVE = 4;          // +, -
nautilusGenerator.ORDER_RELATIONAL = 5;        // <, <=, >, >=, in, not in, is, is not
nautilusGenerator.ORDER_EQUALITY = 6;          // ==, !=
nautilusGenerator.ORDER_BITWISE_AND = 7;       // &
nautilusGenerator.ORDER_BITWISE_XOR = 8;       // ^
nautilusGenerator.ORDER_BITWISE_OR = 9;        // |
nautilusGenerator.ORDER_LOGICAL_AND = 10;      // and
nautilusGenerator.ORDER_LOGICAL_OR = 11;       // or
nautilusGenerator.ORDER_CONDITIONAL = 12;      // x if y else z
nautilusGenerator.ORDER_NONE = 99;             // (...)

// =============================================================================
// LIFECYCLE METHODS
// =============================================================================

nautilusGenerator.workspaceToCode = function (workspace: Blockly.Workspace, leverage: number = 1) {
    nautilusGenerator.leverage_ = leverage;
    return Object.getPrototypeOf(this).workspaceToCode.call(this, workspace);
};

nautilusGenerator.init = function (workspace: Blockly.Workspace) {
    nautilusGenerator.definitions_ = {};
    nautilusGenerator.indicators_ = [];
    nautilusGenerator.indicatorCache_ = {};
    nautilusGenerator.imports_ = new Set([
        'from decimal import Decimal',
        'import numpy as np',
    ]);

    // Collect variables
    const variables = Blockly.Variables.allUsedVarModels(workspace);
    const varDefs: string[] = [];
    for (let i = 0; i < variables.length; i++) {
        const varName = nautilusGenerator.variableDB_.getName(variables[i].getId(), Blockly.Names.NameType.VARIABLE);
        varDefs.push(`self.${varName} = 0`);
    }
    nautilusGenerator.definitions_['variables'] = varDefs.join('\n        ');
};

nautilusGenerator.finish = function (code: string) {
    const hasCode = code && code.trim().length > 0;

    if (!hasCode) {
        return '# Add blocks to your workspace to generate NautilusTrader code';
    }

    // Build imports
    const imports = Array.from(nautilusGenerator.imports_ as Set<string>).join('\n');

    // Build indicator init code
    const indicatorInit = nautilusGenerator.indicators_.join('\n        ');

    // Build variable init
    const varInit = nautilusGenerator.definitions_['variables'] || '';

    return `${imports}

from nautilus_trader.core.data import Data
from nautilus_trader.core.message import Event
from nautilus_trader.trading.strategy import Strategy
from nautilus_trader.model.data import Bar, BarType
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.identifiers import InstrumentId, ClientOrderId
from nautilus_trader.model.instruments import Instrument
from nautilus_trader.model.orders import MarketOrder
from nautilus_trader.model.objects import Quantity, Price

# =============================================================================
# INDICATOR IMPORTS
# =============================================================================
from nautilus_trader.indicators import SimpleMovingAverage
from nautilus_trader.indicators import ExponentialMovingAverage
from nautilus_trader.indicators import RelativeStrengthIndex
from nautilus_trader.indicators import AverageTrueRange
from nautilus_trader.indicators import MovingAverageConvergenceDivergence
from nautilus_trader.indicators import BollingerBands
from nautilus_trader.indicators import Stochastics

# =============================================================================
# GENERATED STRATEGY
# =============================================================================

class GeneratedStrategy(Strategy):
    """
    Generated strategy for NautilusTrader.
    Converted from Blockly visual blocks.
    """
    
    def __init__(self, config):
        super().__init__(config)
        
        # Strategy parameters
        self.leverage = ${nautilusGenerator.leverage_ || 1}
        self.instrument_id: InstrumentId = None
        self.instrument: Instrument = None
        self.bar_type: BarType = None
        
        # Indicators (will be initialized in on_start)
        ${indicatorInit || '# No indicators used'}
        
        # User variables
        ${varInit || '# No variables used'}
        
        # State tracking
        self._position_open = False
        self._last_bar: Bar = None
        self._order_id_counter = 0
    
    def on_start(self):
        """Called when the strategy is started."""
        # Get instrument from cache
        instruments = self.cache.instruments()
        if instruments:
            self.instrument_id = instruments[0].id
            self.instrument = instruments[0]
        
        # Register indicators for updates
        for indicator in self._get_indicators():
            self.register_indicator_for_bars(self.bar_type, indicator)
        
        self.log.info(f"Strategy started for {self.instrument_id}")
    
    def _get_indicators(self):
        """Return list of indicators to register."""
        indicators = []
        for attr_name in dir(self):
            attr = getattr(self, attr_name)
            if hasattr(attr, 'handle_bar'):  # Check if it's an indicator
                indicators.append(attr)
        return indicators
    
    def _generate_order_id(self) -> ClientOrderId:
        """Generate unique order ID."""
        self._order_id_counter += 1
        return ClientOrderId(f"GEN-{self.id}-{self._order_id_counter}")
    
    def on_bar(self, bar: Bar):
        """Called on each new bar."""
        self._last_bar = bar
        
        # Check if we have an instrument
        if not self.instrument_id:
            return
        
        # Update position state
        self._position_open = self.portfolio.is_net_long(self.instrument_id) or \
                             self.portfolio.is_net_short(self.instrument_id)
        
        # Execute strategy logic
${nautilusGenerator.prefixLines(code, '        ')}
    
    def on_stop(self):
        """Called when the strategy is stopped."""
        self.close_all_positions(self.instrument_id)
        self.log.info("Strategy stopped")
    
    # ==========================================================================
    # HELPER METHODS
    # ==========================================================================
    
    def _buy(self, size: float = 1.0):
        """Execute a buy/long order."""
        if not self.instrument_id or self._position_open:
            return
        
        order = self.order_factory.market(
            instrument_id=self.instrument_id,
            order_side=OrderSide.BUY,
            quantity=Quantity.from_str(str(size)),
            time_in_force=TimeInForce.GTC,
        )
        self.submit_order(order)
        self._position_open = True
    
    def _sell(self, size: float = 1.0):
        """Execute a sell/short order."""
        if not self.instrument_id or self._position_open:
            return
        
        order = self.order_factory.market(
            instrument_id=self.instrument_id,
            order_side=OrderSide.SELL,
            quantity=Quantity.from_str(str(size)),
            time_in_force=TimeInForce.GTC,
        )
        self.submit_order(order)
        self._position_open = True
    
    def _close_position(self):
        """Close current position."""
        if self.instrument_id and self._position_open:
            self.close_all_positions(self.instrument_id)
            self._position_open = False
    
    @property
    def _current_price(self) -> float:
        """Get current close price."""
        if self._last_bar:
            return float(self._last_bar.close)
        return 0.0
    
    @property
    def _equity(self) -> float:
        """Get account equity."""
        return float(self.portfolio.net_exposures().get(self.instrument_id, 0))

# =============================================================================
# BACKTEST RUNNER HELPER
# =============================================================================

def create_strategy_config():
    """Create strategy configuration for backtesting."""
    from nautilus_trader.config import StrategyConfig
    
    class GeneratedStrategyConfig(StrategyConfig, frozen=True):
        pass
    
    return GeneratedStrategyConfig()
`;
};

nautilusGenerator.scrub_ = function (block: Blockly.Block, code: string, opt_thisOnly?: boolean) {
    const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
    const nextCode = opt_thisOnly ? '' : nautilusGenerator.blockToCode(nextBlock);
    return code + nextCode;
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getIndicatorParam = (block: Blockly.Block, paramName: string, defaultValue: any): any => {
    return (block as any).indicatorParams?.[paramName] ?? defaultValue;
};

// =============================================================================
// CONTROL BLOCKS
// =============================================================================

nautilusGenerator.forBlock['control_forever'] = function (block: Blockly.Block) {
    const doCode = nautilusGenerator.statementToCode(block, 'DO');
    return doCode;
};

nautilusGenerator.forBlock['control_if'] = function (block: Blockly.Block) {
    const condition = nautilusGenerator.valueToCode(block, 'CONDITION', nautilusGenerator.ORDER_NONE) || 'False';
    const doCode = nautilusGenerator.statementToCode(block, 'DO') || 'pass\n';
    return `if ${condition}:\n${doCode}`;
};

nautilusGenerator.forBlock['control_if_else'] = function (block: Blockly.Block) {
    const condition = nautilusGenerator.valueToCode(block, 'CONDITION', nautilusGenerator.ORDER_NONE) || 'False';
    const doCode = nautilusGenerator.statementToCode(block, 'DO') || '    pass\n';
    const elseCode = nautilusGenerator.statementToCode(block, 'ELSE') || '    pass\n';
    return `if ${condition}:\n${doCode}else:\n${elseCode}`;
};

nautilusGenerator.forBlock['controls_if'] = function (block: Blockly.Block) {
    let n = 0;
    let code = '';
    do {
        const conditionCode = nautilusGenerator.valueToCode(block, 'IF' + n, nautilusGenerator.ORDER_NONE) || 'False';
        const branchCode = nautilusGenerator.statementToCode(block, 'DO' + n) || '    pass\n';
        code += (n === 0 ? 'if ' : 'elif ') + conditionCode + ':\n' + branchCode;
        ++n;
    } while (block.getInput('IF' + n));

    if (block.getInput('ELSE')) {
        let branchCode = nautilusGenerator.statementToCode(block, 'ELSE') || '    pass\n';
        code += 'else:\n' + branchCode;
    }
    return code;
};

nautilusGenerator.forBlock['control_repeat'] = function (block: Blockly.Block) {
    const times = nautilusGenerator.valueToCode(block, 'TIMES', nautilusGenerator.ORDER_NONE) || '1';
    const doCode = nautilusGenerator.statementToCode(block, 'DO') || '    pass\n';
    return `for _i in range(${times}):\n${doCode}`;
};

nautilusGenerator.forBlock['control_stop'] = function () {
    return 'return\n';
};

// =============================================================================
// OPERATOR BLOCKS
// =============================================================================

nautilusGenerator.forBlock['operator_less'] = function (block: Blockly.Block) {
    const left = nautilusGenerator.valueToCode(block, 'LEFT', nautilusGenerator.ORDER_RELATIONAL) || '0';
    const right = nautilusGenerator.valueToCode(block, 'RIGHT', nautilusGenerator.ORDER_RELATIONAL) || '0';
    return [`${left} < ${right}`, nautilusGenerator.ORDER_RELATIONAL];
};

nautilusGenerator.forBlock['operator_greater'] = function (block: Blockly.Block) {
    const left = nautilusGenerator.valueToCode(block, 'LEFT', nautilusGenerator.ORDER_RELATIONAL) || '0';
    const right = nautilusGenerator.valueToCode(block, 'RIGHT', nautilusGenerator.ORDER_RELATIONAL) || '0';
    return [`${left} > ${right}`, nautilusGenerator.ORDER_RELATIONAL];
};

nautilusGenerator.forBlock['operator_equals'] = function (block: Blockly.Block) {
    const left = nautilusGenerator.valueToCode(block, 'LEFT', nautilusGenerator.ORDER_EQUALITY) || '0';
    const right = nautilusGenerator.valueToCode(block, 'RIGHT', nautilusGenerator.ORDER_EQUALITY) || '0';
    return [`${left} == ${right}`, nautilusGenerator.ORDER_EQUALITY];
};

nautilusGenerator.forBlock['operator_less_equals'] = function (block: Blockly.Block) {
    const left = nautilusGenerator.valueToCode(block, 'LEFT', nautilusGenerator.ORDER_RELATIONAL) || '0';
    const right = nautilusGenerator.valueToCode(block, 'RIGHT', nautilusGenerator.ORDER_RELATIONAL) || '0';
    return [`${left} <= ${right}`, nautilusGenerator.ORDER_RELATIONAL];
};

nautilusGenerator.forBlock['operator_greater_equals'] = function (block: Blockly.Block) {
    const left = nautilusGenerator.valueToCode(block, 'LEFT', nautilusGenerator.ORDER_RELATIONAL) || '0';
    const right = nautilusGenerator.valueToCode(block, 'RIGHT', nautilusGenerator.ORDER_RELATIONAL) || '0';
    return [`${left} >= ${right}`, nautilusGenerator.ORDER_RELATIONAL];
};

nautilusGenerator.forBlock['operator_not_equals'] = function (block: Blockly.Block) {
    const left = nautilusGenerator.valueToCode(block, 'LEFT', nautilusGenerator.ORDER_EQUALITY) || '0';
    const right = nautilusGenerator.valueToCode(block, 'RIGHT', nautilusGenerator.ORDER_EQUALITY) || '0';
    return [`${left} != ${right}`, nautilusGenerator.ORDER_EQUALITY];
};

nautilusGenerator.forBlock['operator_and'] = function (block: Blockly.Block) {
    const left = nautilusGenerator.valueToCode(block, 'LEFT', nautilusGenerator.ORDER_LOGICAL_AND) || 'False';
    const right = nautilusGenerator.valueToCode(block, 'RIGHT', nautilusGenerator.ORDER_LOGICAL_AND) || 'False';
    return [`${left} and ${right}`, nautilusGenerator.ORDER_LOGICAL_AND];
};

nautilusGenerator.forBlock['operator_or'] = function (block: Blockly.Block) {
    const left = nautilusGenerator.valueToCode(block, 'LEFT', nautilusGenerator.ORDER_LOGICAL_OR) || 'False';
    const right = nautilusGenerator.valueToCode(block, 'RIGHT', nautilusGenerator.ORDER_LOGICAL_OR) || 'False';
    return [`${left} or ${right}`, nautilusGenerator.ORDER_LOGICAL_OR];
};

nautilusGenerator.forBlock['operator_not'] = function (block: Blockly.Block) {
    const value = nautilusGenerator.valueToCode(block, 'VALUE', nautilusGenerator.ORDER_UNARY) || 'False';
    return [`not ${value}`, nautilusGenerator.ORDER_UNARY];
};

nautilusGenerator.forBlock['operator_add'] = function (block: Blockly.Block) {
    const left = nautilusGenerator.valueToCode(block, 'LEFT', nautilusGenerator.ORDER_ADDITIVE) || '0';
    const right = nautilusGenerator.valueToCode(block, 'RIGHT', nautilusGenerator.ORDER_ADDITIVE) || '0';
    return [`${left} + ${right}`, nautilusGenerator.ORDER_ADDITIVE];
};

nautilusGenerator.forBlock['operator_subtract'] = function (block: Blockly.Block) {
    const left = nautilusGenerator.valueToCode(block, 'LEFT', nautilusGenerator.ORDER_ADDITIVE) || '0';
    const right = nautilusGenerator.valueToCode(block, 'RIGHT', nautilusGenerator.ORDER_ADDITIVE) || '0';
    return [`${left} - ${right}`, nautilusGenerator.ORDER_ADDITIVE];
};

nautilusGenerator.forBlock['operator_multiply'] = function (block: Blockly.Block) {
    const left = nautilusGenerator.valueToCode(block, 'LEFT', nautilusGenerator.ORDER_MULTIPLICATIVE) || '0';
    const right = nautilusGenerator.valueToCode(block, 'RIGHT', nautilusGenerator.ORDER_MULTIPLICATIVE) || '0';
    return [`${left} * ${right}`, nautilusGenerator.ORDER_MULTIPLICATIVE];
};

nautilusGenerator.forBlock['operator_divide'] = function (block: Blockly.Block) {
    const left = nautilusGenerator.valueToCode(block, 'LEFT', nautilusGenerator.ORDER_MULTIPLICATIVE) || '0';
    const right = nautilusGenerator.valueToCode(block, 'RIGHT', nautilusGenerator.ORDER_MULTIPLICATIVE) || '1';
    return [`${left} / ${right}`, nautilusGenerator.ORDER_MULTIPLICATIVE];
};

nautilusGenerator.forBlock['operator_advanced_math'] = function (block: Blockly.Block) {
    const OP_MAP: { [key: string]: string } = {
        'ROOT': 'np.sqrt', 'ABS': 'np.abs', 'NEG': '-',
        'LN': 'np.log', 'LOG10': 'np.log10', 'EXP': 'np.exp', 'POW10': '10**'
    };
    const op = block.getFieldValue('OP');
    const val = nautilusGenerator.valueToCode(block, 'NUM', nautilusGenerator.ORDER_NONE) || '0';
    const func = OP_MAP[op];

    if (op === 'NEG') return [`-${val}`, nautilusGenerator.ORDER_UNARY];
    if (op === 'POW10') return [`10**${val}`, nautilusGenerator.ORDER_EXPONENTIATION];
    return [`${func}(${val})`, nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['logic_compare'] = function (block: Blockly.Block) {
    const OPERATORS: { [key: string]: string } = {
        'EQ': '==', 'NEQ': '!=', 'LT': '<', 'LTE': '<=', 'GT': '>', 'GTE': '>='
    };
    const op = OPERATORS[block.getFieldValue('OP')] || '==';
    const order = (op === '==' || op === '!=') ? nautilusGenerator.ORDER_EQUALITY : nautilusGenerator.ORDER_RELATIONAL;
    const left = nautilusGenerator.valueToCode(block, 'A', order) || '0';
    const right = nautilusGenerator.valueToCode(block, 'B', order) || '0';
    return [`${left} ${op} ${right}`, order];
};

nautilusGenerator.forBlock['logic_operation'] = function (block: Blockly.Block) {
    const op = block.getFieldValue('OP') === 'AND' ? 'and' : 'or';
    const order = op === 'and' ? nautilusGenerator.ORDER_LOGICAL_AND : nautilusGenerator.ORDER_LOGICAL_OR;
    const left = nautilusGenerator.valueToCode(block, 'A', order) || 'False';
    const right = nautilusGenerator.valueToCode(block, 'B', order) || 'False';
    return [`${left} ${op} ${right}`, order];
};

nautilusGenerator.forBlock['logic_boolean'] = function (block: Blockly.Block) {
    return [block.getFieldValue('BOOL') === 'TRUE' ? 'True' : 'False', nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['math_number'] = function (block: Blockly.Block) {
    const num = Number(block.getFieldValue('NUM'));
    return [String(num), num >= 0 ? nautilusGenerator.ORDER_ATOMIC : nautilusGenerator.ORDER_UNARY];
};

nautilusGenerator.forBlock['math_arithmetic'] = function (block: Blockly.Block) {
    const OPERATORS: { [key: string]: [string, number] } = {
        'ADD': [' + ', nautilusGenerator.ORDER_ADDITIVE],
        'MINUS': [' - ', nautilusGenerator.ORDER_ADDITIVE],
        'MULTIPLY': [' * ', nautilusGenerator.ORDER_MULTIPLICATIVE],
        'DIVIDE': [' / ', nautilusGenerator.ORDER_MULTIPLICATIVE],
        'POWER': [' ** ', nautilusGenerator.ORDER_EXPONENTIATION]
    };
    const tuple = OPERATORS[block.getFieldValue('OP')] || [' + ', nautilusGenerator.ORDER_ADDITIVE];
    const left = nautilusGenerator.valueToCode(block, 'A', tuple[1]) || '0';
    const right = nautilusGenerator.valueToCode(block, 'B', tuple[1]) || '0';
    return [`${left}${tuple[0]}${right}`, tuple[1]];
};

// =============================================================================
// VARIABLES
// =============================================================================

nautilusGenerator.forBlock['variables_get'] = function (block: Blockly.Block) {
    const varName = nautilusGenerator.variableDB_.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE);
    return [`self.${varName}`, nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['variables_set'] = function (block: Blockly.Block) {
    const value = nautilusGenerator.valueToCode(block, 'VALUE', nautilusGenerator.ORDER_NONE) || '0';
    const varName = nautilusGenerator.variableDB_.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE);
    return `self.${varName} = ${value}\n`;
};

// =============================================================================
// ENVIRONMENT BLOCKS (NautilusTrader specific)
// =============================================================================

nautilusGenerator.forBlock['environment_price'] = function () {
    return ['self._current_price', nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['environment_spread'] = function () {
    return ['(float(self._last_bar.high) - float(self._last_bar.low)) if self._last_bar else 0.0', nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['environment_prev_candle_open'] = function () {
    return ['float(self._last_bar.open) if self._last_bar else 0.0', nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['environment_prev_ticker_close'] = function () {
    return ['self._current_price', nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['environment_is_market_open'] = function () {
    return ['True', nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['environment_time'] = function () {
    return ['self._last_bar.ts_event if self._last_bar else 0', nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['environment_day_of_week'] = function () {
    return ['self.clock.utc_now().weekday()', nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['environment_new_candle_open'] = function () {
    return ['True', nautilusGenerator.ORDER_ATOMIC];
};

// =============================================================================
// INDICATOR BLOCKS (NautilusTrader Indicators)
// =============================================================================

nautilusGenerator.forBlock['ta_sma'] = function (block: Blockly.Block) {
    const period = getIndicatorParam(block, 'ma_period', 14);
    const cacheKey = `sma_${period}`;
    if (!nautilusGenerator.indicatorCache_[cacheKey]) {
        nautilusGenerator.indicatorCache_[cacheKey] = `self.sma_${period}`;
        nautilusGenerator.indicators_.push(`self.sma_${period} = SimpleMovingAverage(${period})`);
    }
    return [`self.sma_${period}.value if self.sma_${period}.initialized else 0.0`, nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['ta_ema'] = function (block: Blockly.Block) {
    const period = getIndicatorParam(block, 'ma_period', 14);
    const cacheKey = `ema_${period}`;
    if (!nautilusGenerator.indicatorCache_[cacheKey]) {
        nautilusGenerator.indicatorCache_[cacheKey] = `self.ema_${period}`;
        nautilusGenerator.indicators_.push(`self.ema_${period} = ExponentialMovingAverage(${period})`);
    }
    return [`self.ema_${period}.value if self.ema_${period}.initialized else 0.0`, nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['ta_rsi'] = function (block: Blockly.Block) {
    const period = getIndicatorParam(block, 'ma_period', 14);
    const cacheKey = `rsi_${period}`;
    if (!nautilusGenerator.indicatorCache_[cacheKey]) {
        nautilusGenerator.indicatorCache_[cacheKey] = `self.rsi_${period}`;
        nautilusGenerator.indicators_.push(`self.rsi_${period} = RelativeStrengthIndex(${period})`);
    }
    return [`self.rsi_${period}.value if self.rsi_${period}.initialized else 50.0`, nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['ta_atr'] = function (block: Blockly.Block) {
    const period = getIndicatorParam(block, 'ma_period', 14);
    const cacheKey = `atr_${period}`;
    if (!nautilusGenerator.indicatorCache_[cacheKey]) {
        nautilusGenerator.indicatorCache_[cacheKey] = `self.atr_${period}`;
        nautilusGenerator.indicators_.push(`self.atr_${period} = AverageTrueRange(${period})`);
    }
    return [`self.atr_${period}.value if self.atr_${period}.initialized else 0.0`, nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['ta_bb'] = function (block: Blockly.Block) {
    const period = getIndicatorParam(block, 'ma_period', 20);
    const deviation = getIndicatorParam(block, 'deviation', 2.0);
    const component = block.getFieldValue('COMPONENT') || 'middle';
    const cacheKey = `bb_${period}_${deviation}`;
    if (!nautilusGenerator.indicatorCache_[cacheKey]) {
        nautilusGenerator.indicatorCache_[cacheKey] = true;
        nautilusGenerator.indicators_.push(`self.bb_${period} = BollingerBands(${period}, ${deviation})`);
    }
    const compMap: { [key: string]: string } = {
        'upper': `self.bb_${period}.upper if self.bb_${period}.initialized else 0.0`,
        'middle': `self.bb_${period}.middle if self.bb_${period}.initialized else 0.0`,
        'lower': `self.bb_${period}.lower if self.bb_${period}.initialized else 0.0`
    };
    return [compMap[component] || compMap['middle'], nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['ta_stochastic'] = function (block: Blockly.Block) {
    const kPeriod = getIndicatorParam(block, 'kPeriod', 14);
    const dPeriod = getIndicatorParam(block, 'dPeriod', 3);
    const component = block.getFieldValue('COMPONENT') || 'k';
    const cacheKey = `stoch_${kPeriod}_${dPeriod}`;
    if (!nautilusGenerator.indicatorCache_[cacheKey]) {
        nautilusGenerator.indicatorCache_[cacheKey] = true;
        nautilusGenerator.indicators_.push(`self.stoch_${kPeriod} = Stochastics(${kPeriod}, ${dPeriod})`);
    }
    return [component === 'd'
        ? `self.stoch_${kPeriod}.value_d if self.stoch_${kPeriod}.initialized else 50.0`
        : `self.stoch_${kPeriod}.value_k if self.stoch_${kPeriod}.initialized else 50.0`,
    nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['macd_value'] = function (block: Blockly.Block) {
    const fast = getIndicatorParam(block, 'fastEMA', 12);
    const slow = getIndicatorParam(block, 'slowEMA', 26);
    const signal = getIndicatorParam(block, 'signalSMA', 9);
    const component = block.getFieldValue('COMPONENT') || 'line';
    const cacheKey = `macd_${fast}_${slow}_${signal}`;
    if (!nautilusGenerator.indicatorCache_[cacheKey]) {
        nautilusGenerator.indicatorCache_[cacheKey] = true;
        nautilusGenerator.indicators_.push(`self.macd = MovingAverageConvergenceDivergence(${fast}, ${slow}, ${signal})`);
    }
    const compMap: { [key: string]: string } = {
        'line': 'self.macd.value if self.macd.initialized else 0.0',
        'signal': 'self.macd.signal if self.macd.initialized else 0.0',
        'histogram': '(self.macd.value - self.macd.signal) if self.macd.initialized else 0.0'
    };
    return [compMap[component] || compMap['line'], nautilusGenerator.ORDER_ATOMIC];
};

// Extended indicators - Map to SMA as fallback
const EXTENDED_INDICATORS = [
    'ta_wma', 'ta_lwma', 'dema', 'tema', 'ama', 'ta_cci', 'ta_adx',
    'ta_williams_r', 'ta_mfi', 'trix', 'ta_dmi', 'ta_obv', 'momentum',
    'donchian', 'ta_smma', 'frama', 'vidya', 'force', 'bearsPower',
    'bullsPower', 'ta_sar'
];

EXTENDED_INDICATORS.forEach(type => {
    nautilusGenerator.forBlock[type] = function (block: Blockly.Block) {
        const period = getIndicatorParam(block, 'ma_period', 14);
        const cacheKey = `${type}_${period}`;
        if (!nautilusGenerator.indicatorCache_[cacheKey]) {
            nautilusGenerator.indicatorCache_[cacheKey] = `self.${type}_${period}`;
            // Use SMA as fallback for indicators not available in NautilusTrader
            nautilusGenerator.indicators_.push(`self.${type}_${period} = SimpleMovingAverage(${period})  # Fallback for ${type}`);
        }
        return [`self.${type}_${period}.value if self.${type}_${period}.initialized else 0.0`, nautilusGenerator.ORDER_ATOMIC];
    };
});

// =============================================================================
// TRADE BLOCKS (NautilusTrader Orders)
// =============================================================================

nautilusGenerator.forBlock['trade_order'] = function (block: Blockly.Block) {
    const direction = block.getFieldValue('DIRECTION') || 'long';
    const size = block.getFieldValue('SIZE') || '1.0';
    const sizeType = block.getFieldValue('SIZE_TYPE') || 'lots';

    let sizeCode = size;
    if (sizeType === 'percent') {
        sizeCode = `self._equity * ${parseFloat(size) / 100}`;
    } else if (sizeType === 'usd') {
        sizeCode = `${size} / self._current_price`;
    }

    if (direction === 'long') {
        return `self._buy(size=${sizeCode})\n`;
    } else {
        return `self._sell(size=${sizeCode})\n`;
    }
};

nautilusGenerator.forBlock['trade_close'] = function () {
    return 'self._close_position()\n';
};

nautilusGenerator.forBlock['trade_close_all'] = function () {
    return 'self._close_position()\n';
};

nautilusGenerator.forBlock['trade_take_profit'] = function (block: Blockly.Block) {
    const price = nautilusGenerator.valueToCode(block, 'PRICE', nautilusGenerator.ORDER_NONE) || 'self._current_price * 1.02';
    return `# Take profit at ${price} (managed by order management)\n`;
};

nautilusGenerator.forBlock['trade_stop_loss'] = function (block: Blockly.Block) {
    const price = nautilusGenerator.valueToCode(block, 'PRICE', nautilusGenerator.ORDER_NONE) || 'self._current_price * 0.98';
    return `# Stop loss at ${price} (managed by order management)\n`;
};

nautilusGenerator.forBlock['trade_entry_price'] = function () {
    return ['self._current_price', nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['trade_pnl_of'] = function () {
    return ['self._equity', nautilusGenerator.ORDER_ATOMIC];
};

nautilusGenerator.forBlock['trade_position_size'] = function () {
    return ['1.0 if self._position_open else 0.0', nautilusGenerator.ORDER_ATOMIC];
};

// =============================================================================
// RISK MANAGEMENT BLOCKS
// =============================================================================

nautilusGenerator.forBlock['risk_trailing_stop'] = function (block: Blockly.Block) {
    const percent = nautilusGenerator.valueToCode(block, 'PERCENT', nautilusGenerator.ORDER_NONE) || '2';
    return `# Trailing stop at ${percent}% (requires order management)\n`;
};

nautilusGenerator.forBlock['risk_position_percent'] = function (block: Blockly.Block) {
    const percent = nautilusGenerator.valueToCode(block, 'PERCENT', nautilusGenerator.ORDER_NONE) || '10';
    return [`self._equity * ${parseFloat(percent as string) / 100} / self._current_price`, nautilusGenerator.ORDER_MULTIPLICATIVE];
};

nautilusGenerator.forBlock['risk_max_drawdown'] = function (block: Blockly.Block) {
    const percent = nautilusGenerator.valueToCode(block, 'PERCENT', nautilusGenerator.ORDER_NONE) || '20';
    return `# Max drawdown limit: ${percent}%\n`;
};
