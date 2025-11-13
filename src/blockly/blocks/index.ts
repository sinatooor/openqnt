// Import all block definitions to register them with Blockly
import './environmentBlocks';
import './operatorBlocks';
import './controlBlocks';
import './tradeBlocks';
import './taBlocks';
import './riskManagementBlocks';
import './multiTimeframeBlocks';

// Export block configurations for toolbox
export const environmentBlocksToolbox = [
  { kind: 'block', type: 'environment_price' },
  { kind: 'block', type: 'environment_spread' },
  { kind: 'block', type: 'environment_prev_candle_open' },
  { kind: 'block', type: 'environment_prev_ticker_close' },
  { kind: 'block', type: 'environment_is_market_open' },
  { kind: 'block', type: 'environment_time' },
  { kind: 'block', type: 'environment_day_of_week' },
  { kind: 'block', type: 'environment_new_candle_open' },
];

export const operatorBlocksToolbox = [
  { kind: 'block', type: 'operator_equals' },
  { kind: 'block', type: 'operator_not_equals' },
  { kind: 'block', type: 'operator_greater' },
  { kind: 'block', type: 'operator_greater_equals' },
  { kind: 'block', type: 'operator_less' },
  { kind: 'block', type: 'operator_less_equals' },
  { kind: 'block', type: 'operator_add' },
  { kind: 'block', type: 'operator_subtract' },
  { kind: 'block', type: 'operator_multiply' },
  { kind: 'block', type: 'operator_divide' },
  { kind: 'block', type: 'operator_advanced_math' },
  { kind: 'block', type: 'operator_and' },
  { kind: 'block', type: 'operator_or' },
  { kind: 'block', type: 'operator_not' },
];

export const controlBlocksToolbox = [
  { kind: 'block', type: 'control_repeat' },
  { kind: 'block', type: 'control_repeat_until' },
  { kind: 'block', type: 'control_forever' },
  { kind: 'block', type: 'control_if' },
  { kind: 'block', type: 'control_if_else' },
  { kind: 'block', type: 'control_wait' },
  { kind: 'block', type: 'control_wait_until' },
  { kind: 'block', type: 'control_stop' },
];

export const tradeBlocksToolbox = [
  { kind: 'block', type: 'trade_order' },
  { kind: 'block', type: 'trade_stop_loss' },
  { kind: 'block', type: 'trade_take_profit' },
  { kind: 'block', type: 'trade_close' },
  { kind: 'block', type: 'trade_pnl_of' },
  { kind: 'block', type: 'trade_entry_price' },
  { kind: 'block', type: 'trade_position_size' },
];

export const taBlocksToolbox = [
  { kind: 'block', type: 'ta_sma' },
  { kind: 'block', type: 'ta_ema' },
  { kind: 'block', type: 'ta_rsi' },
  { kind: 'block', type: 'ta_macd' },
  { kind: 'block', type: 'ta_bb' },
  { kind: 'block', type: 'ta_vwap' },
  { kind: 'block', type: 'ta_atr' },
  { kind: 'block', type: 'ta_stochastic' },
  { kind: 'block', type: 'ta_adx' },
  { kind: 'block', type: 'ta_cci' },
  { kind: 'block', type: 'ta_williams_r' },
  { kind: 'block', type: 'ta_obv' },
  { kind: 'block', type: 'ta_mfi' },
  { kind: 'block', type: 'ta_sar' },
  { kind: 'block', type: 'ta_ichimoku' },
  { kind: 'block', type: 'ta_vp' },
  { kind: 'block', type: 'ta_keltner' },
  { kind: 'block', type: 'ta_dmi' },
  { kind: 'block', type: 'ta_supertrend' },
  { kind: 'block', type: 'ta_pivot' },
];

export const riskManagementBlocksToolbox = [
  { kind: 'block', type: 'risk_position_percent' },
  { kind: 'block', type: 'risk_kelly_criterion' },
  { kind: 'block', type: 'risk_fixed_amount' },
  { kind: 'block', type: 'risk_trailing_stop' },
  { kind: 'block', type: 'risk_scale_in' },
  { kind: 'block', type: 'risk_scale_out' },
  { kind: 'block', type: 'risk_max_drawdown' },
  { kind: 'block', type: 'risk_daily_loss_limit' },
];

export const multiTimeframeBlocksToolbox = [
  { kind: 'block', type: 'mtf_condition' },
  { kind: 'block', type: 'mtf_price' },
  { kind: 'block', type: 'mtf_indicator' },
  { kind: 'block', type: 'mtf_trend_aligned' },
  { kind: 'block', type: 'mtf_higher_timeframe_bias' },
];
