// Import all block definitions to register them with Blockly
import './environmentBlocks';
import './operatorBlocks';
import './controlBlocks';
import './tradeBlocks';
import './taBlocks';

// Export block configurations for toolbox
export const environmentBlocksToolbox = [
  { kind: 'block', type: 'environment_price' },
  { kind: 'block', type: 'environment_volume' },
  { kind: 'block', type: 'environment_time' },
  { kind: 'block', type: 'environment_spread' },
];

export const operatorBlocksToolbox = [
  { kind: 'block', type: 'operator_equals' },
  { kind: 'block', type: 'operator_greater' },
  { kind: 'block', type: 'operator_less' },
  { kind: 'block', type: 'operator_add' },
  { kind: 'block', type: 'operator_subtract' },
  { kind: 'block', type: 'operator_multiply' },
  { kind: 'block', type: 'operator_divide' },
  { kind: 'block', type: 'operator_and' },
  { kind: 'block', type: 'operator_or' },
];

export const controlBlocksToolbox = [
  { kind: 'block', type: 'control_if' },
  { kind: 'block', type: 'control_repeat' },
  { kind: 'block', type: 'control_wait' },
  { kind: 'block', type: 'control_forever' },
];

export const tradeBlocksToolbox = [
  { kind: 'block', type: 'trade_buy' },
  { kind: 'block', type: 'trade_sell' },
  { kind: 'block', type: 'trade_stop_loss' },
  { kind: 'block', type: 'trade_take_profit' },
];

export const taBlocksToolbox = [
  { kind: 'block', type: 'ta_sma' },
  { kind: 'block', type: 'ta_ema' },
  { kind: 'block', type: 'ta_rsi' },
  { kind: 'block', type: 'ta_macd' },
  { kind: 'block', type: 'ta_bb' },
];
