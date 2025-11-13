import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

// Environment blocks
javascriptGenerator.forBlock['environment_price'] = function() {
  const code = 'getPrice()';
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['environment_volume'] = function() {
  const code = 'getVolume()';
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['environment_time'] = function() {
  const code = 'getTime()';
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['environment_spread'] = function() {
  const code = 'getSpread()';
  return [code, Order.ATOMIC];
};

// Operator blocks - Comparison
javascriptGenerator.forBlock['operator_equals'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.EQUALITY) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.EQUALITY) || '0';
  const code = `${left} === ${right}`;
  return [code, Order.EQUALITY];
};

javascriptGenerator.forBlock['operator_greater'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.RELATIONAL) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.RELATIONAL) || '0';
  const code = `${left} > ${right}`;
  return [code, Order.RELATIONAL];
};

javascriptGenerator.forBlock['operator_less'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.RELATIONAL) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.RELATIONAL) || '0';
  const code = `${left} < ${right}`;
  return [code, Order.RELATIONAL];
};

javascriptGenerator.forBlock['operator_greater_equals'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.RELATIONAL) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.RELATIONAL) || '0';
  const code = `${left} >= ${right}`;
  return [code, Order.RELATIONAL];
};

javascriptGenerator.forBlock['operator_less_equals'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.RELATIONAL) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.RELATIONAL) || '0';
  const code = `${left} <= ${right}`;
  return [code, Order.RELATIONAL];
};

// Operator blocks - Math
javascriptGenerator.forBlock['operator_add'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.ADDITION) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.ADDITION) || '0';
  const code = `${left} + ${right}`;
  return [code, Order.ADDITION];
};

javascriptGenerator.forBlock['operator_subtract'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.SUBTRACTION) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.SUBTRACTION) || '0';
  const code = `${left} - ${right}`;
  return [code, Order.SUBTRACTION];
};

javascriptGenerator.forBlock['operator_multiply'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.MULTIPLICATION) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.MULTIPLICATION) || '0';
  const code = `${left} * ${right}`;
  return [code, Order.MULTIPLICATION];
};

javascriptGenerator.forBlock['operator_divide'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.DIVISION) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.DIVISION) || '1';
  const code = `${left} / ${right}`;
  return [code, Order.DIVISION];
};

// Operator blocks - Logic
javascriptGenerator.forBlock['operator_and'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.LOGICAL_AND) || 'false';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.LOGICAL_AND) || 'false';
  const code = `${left} && ${right}`;
  return [code, Order.LOGICAL_AND];
};

javascriptGenerator.forBlock['operator_or'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.LOGICAL_OR) || 'false';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.LOGICAL_OR) || 'false';
  const code = `${left} || ${right}`;
  return [code, Order.LOGICAL_OR];
};

javascriptGenerator.forBlock['operator_not'] = function(block: Blockly.Block) {
  const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.LOGICAL_NOT) || 'false';
  const code = `!${value}`;
  return [code, Order.LOGICAL_NOT];
};

javascriptGenerator.forBlock['operator_not_equals'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.EQUALITY) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.EQUALITY) || '0';
  const code = `${left} !== ${right}`;
  return [code, Order.EQUALITY];
};

javascriptGenerator.forBlock['operator_advanced_math'] = function(block: Blockly.Block) {
  const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.NONE) || '0';
  const func = block.getFieldValue('FUNCTION');
  let code = '';
  
  switch(func) {
    case 'abs':
    case 'sqrt':
    case 'sin':
    case 'cos':
    case 'tan':
    case 'exp':
    case 'round':
    case 'floor':
    case 'ceil':
      code = `Math.${func}(${value})`;
      break;
    case 'log':
      code = `Math.log10(${value})`;
      break;
    case 'ln':
      code = `Math.log(${value})`;
      break;
    default:
      code = value;
  }
  
  return [code, Order.FUNCTION_CALL];
};

// Control blocks
javascriptGenerator.forBlock['control_if'] = function(block: Blockly.Block) {
  const condition = javascriptGenerator.valueToCode(block, 'CONDITION', Order.NONE) || 'false';
  const doCode = javascriptGenerator.statementToCode(block, 'DO');
  const code = `if (${condition}) {\n${doCode}}\n`;
  return code;
};

javascriptGenerator.forBlock['control_repeat'] = function(block: Blockly.Block) {
  const times = javascriptGenerator.valueToCode(block, 'TIMES', Order.NONE) || '1';
  const doCode = javascriptGenerator.statementToCode(block, 'DO');
  const code = `for (let i = 0; i < ${times}; i++) {\n${doCode}}\n`;
  return code;
};

javascriptGenerator.forBlock['control_wait'] = function(block: Blockly.Block) {
  const seconds = javascriptGenerator.valueToCode(block, 'SECONDS', Order.NONE) || '1';
  const code = `await wait(${seconds});\n`;
  return code;
};

javascriptGenerator.forBlock['control_forever'] = function(block: Blockly.Block) {
  const doCode = javascriptGenerator.statementToCode(block, 'DO');
  const code = `while (true) {\n${doCode}}\n`;
  return code;
};

javascriptGenerator.forBlock['control_repeat_until'] = function(block: Blockly.Block) {
  const condition = javascriptGenerator.valueToCode(block, 'CONDITION', Order.NONE) || 'false';
  const doCode = javascriptGenerator.statementToCode(block, 'DO');
  const code = `while (!(${condition})) {\n${doCode}}\n`;
  return code;
};

javascriptGenerator.forBlock['control_if_else'] = function(block: Blockly.Block) {
  const condition = javascriptGenerator.valueToCode(block, 'CONDITION', Order.NONE) || 'false';
  const doCode = javascriptGenerator.statementToCode(block, 'DO');
  const elseCode = javascriptGenerator.statementToCode(block, 'ELSE');
  const code = `if (${condition}) {\n${doCode}} else {\n${elseCode}}\n`;
  return code;
};

javascriptGenerator.forBlock['control_wait_until'] = function(block: Blockly.Block) {
  const condition = javascriptGenerator.valueToCode(block, 'CONDITION', Order.NONE) || 'false';
  const code = `while (!(${condition})) { await wait(0.1); }\n`;
  return code;
};

javascriptGenerator.forBlock['control_stop'] = function() {
  const code = `return;\n`;
  return code;
};

// Trade blocks
javascriptGenerator.forBlock['trade_order'] = function(block: Blockly.Block) {
  const direction = block.getFieldValue('DIRECTION');
  const tradeId = javascriptGenerator.valueToCode(block, 'TRADE_ID', Order.NONE) || '"trade1"';
  const size = javascriptGenerator.valueToCode(block, 'SIZE', Order.NONE) || '0';
  const sizeType = block.getFieldValue('SIZE_TYPE');
  const leverage = javascriptGenerator.valueToCode(block, 'LEVERAGE', Order.NONE) || '1';
  const orderType = block.getFieldValue('ORDER_TYPE');
  const code = `placeOrder(${tradeId}, "${direction}", ${size}, "${sizeType}", ${leverage}, "${orderType}");\n`;
  return code;
};

javascriptGenerator.forBlock['trade_stop_loss'] = function(block: Blockly.Block) {
  const price = javascriptGenerator.valueToCode(block, 'PRICE', Order.NONE) || '0';
  const tradeId = javascriptGenerator.valueToCode(block, 'TRADE_ID', Order.NONE) || '"trade1"';
  const code = `setStopLoss(${tradeId}, ${price});\n`;
  return code;
};

javascriptGenerator.forBlock['trade_take_profit'] = function(block: Blockly.Block) {
  const price = javascriptGenerator.valueToCode(block, 'PRICE', Order.NONE) || '0';
  const tradeId = javascriptGenerator.valueToCode(block, 'TRADE_ID', Order.NONE) || '"trade1"';
  const code = `setTakeProfit(${tradeId}, ${price});\n`;
  return code;
};

javascriptGenerator.forBlock['trade_close'] = function(block: Blockly.Block) {
  const percent = block.getFieldValue('PERCENT');
  const tradeId = javascriptGenerator.valueToCode(block, 'TRADE_ID', Order.NONE) || '"trade1"';
  const code = `closeTrade(${tradeId}, ${percent});\n`;
  return code;
};

javascriptGenerator.forBlock['trade_pnl_of'] = function(block: Blockly.Block) {
  const tradeId = javascriptGenerator.valueToCode(block, 'TRADE_ID', Order.NONE) || '"trade1"';
  const code = `getPnL(${tradeId})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['trade_entry_price'] = function(block: Blockly.Block) {
  const tradeId = javascriptGenerator.valueToCode(block, 'TRADE_ID', Order.NONE) || '"trade1"';
  const code = `getEntryPrice(${tradeId})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['trade_position_size'] = function(block: Blockly.Block) {
  const tradeId = javascriptGenerator.valueToCode(block, 'TRADE_ID', Order.NONE) || '"trade1"';
  const code = `getPositionSize(${tradeId})`;
  return [code, Order.ATOMIC];
};

// TA blocks
javascriptGenerator.forBlock['ta_sma'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '20';
  const code = `sma(${period})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_ema'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '20';
  const code = `ema(${period})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_rsi'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '14';
  const code = `rsi(${period})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_macd'] = function() {
  const code = 'macd()';
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_bb'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '20';
  const code = `bollingerBands(${period})`;
  return [code, Order.ATOMIC];
};

// Additional TA indicators
javascriptGenerator.forBlock['ta_vwap'] = function() {
  const code = 'vwap()';
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_atr'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '14';
  const code = `atr(${period})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_stochastic'] = function(block: Blockly.Block) {
  const kPeriod = javascriptGenerator.valueToCode(block, 'K_PERIOD', Order.NONE) || '14';
  const dPeriod = javascriptGenerator.valueToCode(block, 'D_PERIOD', Order.NONE) || '3';
  const code = `stochastic(${kPeriod}, ${dPeriod})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_adx'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '14';
  const code = `adx(${period})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_cci'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '20';
  const code = `cci(${period})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_williams_r'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '14';
  const code = `williamsR(${period})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_obv'] = function() {
  const code = 'obv()';
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_mfi'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '14';
  const code = `mfi(${period})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_sar'] = function(block: Blockly.Block) {
  const acceleration = javascriptGenerator.valueToCode(block, 'ACCELERATION', Order.NONE) || '0.02';
  const max = javascriptGenerator.valueToCode(block, 'MAX', Order.NONE) || '0.2';
  const code = `parabolicSAR(${acceleration}, ${max})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_ichimoku'] = function() {
  const code = 'ichimoku()';
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_vp'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '100';
  const code = `volumeProfile(${period})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_keltner'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '20';
  const code = `keltner(${period})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_dmi'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '14';
  const code = `dmi(${period})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_supertrend'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '10';
  const multiplier = javascriptGenerator.valueToCode(block, 'MULTIPLIER', Order.NONE) || '3';
  const code = `supertrend(${period}, ${multiplier})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_pivot'] = function() {
  const code = 'pivotPoints()';
  return [code, Order.ATOMIC];
};

// Risk Management blocks
javascriptGenerator.forBlock['risk_position_percent'] = function(block: Blockly.Block) {
  const percent = javascriptGenerator.valueToCode(block, 'PERCENT', Order.NONE) || '2';
  const code = `positionSize(${percent})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['risk_kelly_criterion'] = function(block: Blockly.Block) {
  const winRate = javascriptGenerator.valueToCode(block, 'WIN_RATE', Order.NONE) || '0.6';
  const winLossRatio = javascriptGenerator.valueToCode(block, 'WIN_LOSS_RATIO', Order.NONE) || '1.5';
  const code = `kellyCriterion(${winRate}, ${winLossRatio})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['risk_fixed_amount'] = function(block: Blockly.Block) {
  const amount = javascriptGenerator.valueToCode(block, 'AMOUNT', Order.NONE) || '100';
  const code = `${amount}`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['risk_trailing_stop'] = function(block: Blockly.Block) {
  const percent = javascriptGenerator.valueToCode(block, 'PERCENT', Order.NONE) || '2';
  const code = `setTrailingStop(${percent});\n`;
  return code;
};

javascriptGenerator.forBlock['risk_scale_in'] = function(block: Blockly.Block) {
  const amount = javascriptGenerator.valueToCode(block, 'AMOUNT', Order.NONE) || '100';
  const intervals = javascriptGenerator.valueToCode(block, 'INTERVALS', Order.NONE) || '3';
  const code = `scaleIn(${amount}, ${intervals});\n`;
  return code;
};

javascriptGenerator.forBlock['risk_scale_out'] = function(block: Blockly.Block) {
  const amount = javascriptGenerator.valueToCode(block, 'AMOUNT', Order.NONE) || '100';
  const intervals = javascriptGenerator.valueToCode(block, 'INTERVALS', Order.NONE) || '3';
  const code = `scaleOut(${amount}, ${intervals});\n`;
  return code;
};

javascriptGenerator.forBlock['risk_max_drawdown'] = function(block: Blockly.Block) {
  const percent = javascriptGenerator.valueToCode(block, 'PERCENT', Order.NONE) || '10';
  const code = `setMaxDrawdown(${percent});\n`;
  return code;
};

javascriptGenerator.forBlock['risk_daily_loss_limit'] = function(block: Blockly.Block) {
  const amount = javascriptGenerator.valueToCode(block, 'AMOUNT', Order.NONE) || '500';
  const code = `setDailyLossLimit(${amount});\n`;
  return code;
};

// Multi-Timeframe blocks
javascriptGenerator.forBlock['mtf_condition'] = function(block: Blockly.Block) {
  const timeframe = block.getFieldValue('TIMEFRAME');
  const condition = javascriptGenerator.valueToCode(block, 'CONDITION', Order.NONE) || 'false';
  const code = `checkTimeframe('${timeframe}', ${condition})`;
  return [code, Order.FUNCTION_CALL];
};

javascriptGenerator.forBlock['mtf_price'] = function(block: Blockly.Block) {
  const timeframe = block.getFieldValue('TIMEFRAME');
  const code = `getPrice('${timeframe}')`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['mtf_indicator'] = function(block: Blockly.Block) {
  const indicator = block.getFieldValue('INDICATOR');
  const timeframe = block.getFieldValue('TIMEFRAME');
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '14';
  const code = `${indicator}(${period}, '${timeframe}')`;
  return [code, Order.FUNCTION_CALL];
};

javascriptGenerator.forBlock['mtf_trend_aligned'] = function(block: Blockly.Block) {
  const direction = block.getFieldValue('DIRECTION');
  const timeframes = block.getFieldValue('TIMEFRAMES');
  const code = `isTrendAligned('${direction}', '${timeframes}')`;
  return [code, Order.FUNCTION_CALL];
};

javascriptGenerator.forBlock['mtf_higher_timeframe_bias'] = function(block: Blockly.Block) {
  const timeframe = block.getFieldValue('TIMEFRAME');
  const code = `getHigherTimeframeBias('${timeframe}')`;
  return [code, Order.ATOMIC];
};

// Export function to generate code from workspace
export function generateCode(workspace: Blockly.WorkspaceSvg): string {
  return javascriptGenerator.workspaceToCode(workspace);
}
