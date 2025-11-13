// Import all block definitions to register them with Blockly
import './environmentBlocks';
import './operatorBlocks';
import './controlBlocks';
import './tradeBlocks';
import './taBlocks';
import './riskManagementBlocks';
import './multiTimeframeBlocks';
import './variableBlocks';

// Export block configurations for toolbox
export const environmentBlocksToolbox = [
  { kind: 'label', text: 'Price & Volume' },
  { kind: 'block', type: 'environment_price' },
  { kind: 'block', type: 'environment_spread' },
  { kind: 'block', type: 'environment_prev_candle_open' },
  { kind: 'block', type: 'environment_prev_ticker_close' },
  { kind: 'label', text: 'Time' },
  { kind: 'block', type: 'environment_time' },
  { kind: 'block', type: 'environment_day_of_week' },
  { kind: 'block', type: 'environment_new_candle_open' },
  { kind: 'block', type: 'environment_is_market_open' },
];

export const operatorBlocksToolbox = [
  { kind: 'label', text: 'Comparison' },
  { kind: 'block', type: 'operator_equals' },
  { kind: 'block', type: 'operator_not_equals' },
  { kind: 'block', type: 'operator_greater' },
  { kind: 'block', type: 'operator_greater_equals' },
  { kind: 'block', type: 'operator_less' },
  { kind: 'block', type: 'operator_less_equals' },
  { kind: 'label', text: 'Math' },
  { kind: 'block', type: 'operator_add' },
  { kind: 'block', type: 'operator_subtract' },
  { kind: 'block', type: 'operator_multiply' },
  { kind: 'block', type: 'operator_divide' },
  { kind: 'block', type: 'operator_advanced_math' },
  { kind: 'label', text: 'Logic' },
  { kind: 'block', type: 'operator_and' },
  { kind: 'block', type: 'operator_or' },
  { kind: 'block', type: 'operator_not' },
];

export const controlBlocksToolbox = [
  { kind: 'label', text: 'Loops' },
  { kind: 'block', type: 'control_repeat' },
  { kind: 'block', type: 'control_repeat_until' },
  { kind: 'block', type: 'control_forever' },
  { kind: 'label', text: 'Conditionals' },
  { kind: 'block', type: 'control_if' },
  { kind: 'block', type: 'control_if_else' },
  { kind: 'label', text: 'Timing' },
  { kind: 'block', type: 'control_wait' },
  { kind: 'block', type: 'control_wait_until' },
  { kind: 'label', text: 'Flow' },
  { kind: 'block', type: 'control_stop' },
];

export const tradeBlocksToolbox = [
  { kind: 'label', text: 'Orders' },
  { kind: 'block', type: 'trade_order' },
  { kind: 'label', text: 'Risk Management' },
  { kind: 'block', type: 'trade_stop_loss' },
  { kind: 'block', type: 'trade_take_profit' },
  { kind: 'block', type: 'trade_close' },
  { kind: 'label', text: 'Info' },
  { kind: 'block', type: 'trade_pnl_of' },
  { kind: 'block', type: 'trade_entry_price' },
  { kind: 'block', type: 'trade_position_size' },
];

// TA Tools toolbox will be dynamically generated in BlocklyWorkspace
export const taBlocksToolbox = [];

export const multiTimeframeBlocksToolbox = [
  { kind: 'block', type: 'mtf_condition' },
  { kind: 'block', type: 'mtf_price' },
  { kind: 'block', type: 'mtf_indicator' },
  { kind: 'block', type: 'mtf_trend_aligned' },
  { kind: 'block', type: 'mtf_higher_timeframe_bias' },
];

export const myBlocksToolbox = [
  { kind: 'label', text: 'Variables' },
  { kind: 'block', type: 'variables_set' },
  { kind: 'block', type: 'variables_get' },
  { kind: 'block', type: 'variables_change' },
  { kind: 'label', text: 'Functions' },
  { kind: 'block', type: 'function_define' },
  { kind: 'block', type: 'function_call' },
  { kind: 'block', type: 'function_return' },
];
