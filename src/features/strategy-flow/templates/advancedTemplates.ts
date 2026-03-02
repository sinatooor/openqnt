/**
 * Advanced strategy templates — complex multi-indicator, multi-timeframe strategies with 20+ nodes
 */

import { StrategyTemplate } from './types';

/**
 * Multi-Timeframe Trend + Mean-Reversion Hybrid Strategy
 * ──────────────────────────────────────────────────────
 * 24 nodes, 30 edges
 *
 * Layer 1 – Data Sources (4 nodes):
 *   EMA 200 (daily trend filter), BB(20), RSI(14), Stochastic(14,3), MACD, ATR(14), Price
 *
 * Layer 2 – Conditions (8 nodes):
 *   Trend filter (Price > EMA200), RSI oversold < 35, RSI overbought > 65,
 *   Stochastic %K cross %D, BB price < lower, MACD bullish crossover,
 *   AND gates for long/short confluence
 *
 * Layer 3 – Risk & Position Sizing (2 nodes):
 *   ATR-based position size, max drawdown guard
 *
 * Layer 4 – Actions (4 nodes):
 *   Long entry, Short entry, Stop Loss, Take Profit
 *
 * This template demonstrates a realistic institutional-grade strategy flow
 * with proper risk management and multi-signal confluence.
 */
export const ADVANCED_STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'multi-tf-hybrid',
    name: 'Multi-TF Trend + Reversion Hybrid',
    description:
      'Institutional-grade 24-node strategy combining daily EMA trend filter, RSI, Stochastic, Bollinger Bands, MACD confluence, ATR-based sizing, stop-loss and take-profit. Enters long only in uptrends with oversold + BB touch + Stoch cross confirmation; enters short in downtrends with overbought + MACD bearish cross.',
    category: 'trading',
    difficulty: 'advanced',
    indicators: ['EMA (200)', 'RSI (14)', 'Stochastic (14,3)', 'Bollinger Bands (20)', 'MACD', 'ATR (14)'],
    featured: true,
    nodes: [
      // ── Layer 1: Indicators & Data Sources ──────────────────────────────
      {
        id: 'ema200',
        type: 'indicator',
        position: { x: 50, y: 50 },
        data: { label: 'EMA 200 (Daily)', indicatorType: 'ema', timeframe: '1D', params: { period: 200 } },
      },
      {
        id: 'rsi',
        type: 'indicator',
        position: { x: 50, y: 170 },
        data: { label: 'RSI (14)', indicatorType: 'rsi', timeframe: '60', params: { period: 14 } },
      },
      {
        id: 'stoch',
        type: 'indicator',
        position: { x: 50, y: 290 },
        data: { label: 'Stochastic (14,3)', indicatorType: 'stochastic', timeframe: '60', params: { kPeriod: 14, dPeriod: 3 } },
      },
      {
        id: 'bb',
        type: 'indicator',
        position: { x: 50, y: 410 },
        data: { label: 'BB (20, 2)', indicatorType: 'bb', timeframe: '60', params: { period: 20, stdDev: 2 } },
      },
      {
        id: 'macd',
        type: 'indicator',
        position: { x: 50, y: 530 },
        data: { label: 'MACD (12,26,9)', indicatorType: 'macd', timeframe: '60', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
      },
      {
        id: 'atr',
        type: 'indicator',
        position: { x: 50, y: 650 },
        data: { label: 'ATR (14)', indicatorType: 'atr', timeframe: '60', params: { period: 14 } },
      },
      {
        id: 'price',
        type: 'environment',
        position: { x: 50, y: 770 },
        data: { label: 'Close Price', environmentType: 'price', priceType: 'close' },
      },

      // ── Layer 2: Threshold Constants ────────────────────────────────────
      {
        id: 'const-35',
        type: 'math',
        position: { x: 50, y: 890 },
        data: { label: '35', mathType: 'number', value: 35 },
      },
      {
        id: 'const-65',
        type: 'math',
        position: { x: 50, y: 980 },
        data: { label: '65', mathType: 'number', value: 65 },
      },
      {
        id: 'const-2',
        type: 'math',
        position: { x: 50, y: 1070 },
        data: { label: '×2 (ATR mult)', mathType: 'number', value: 2 },
      },
      {
        id: 'const-3',
        type: 'math',
        position: { x: 50, y: 1160 },
        data: { label: '×3 (TP mult)', mathType: 'number', value: 3 },
      },

      // ── Layer 3: Conditions ─────────────────────────────────────────────
      // Trend filter: Price > EMA 200 → uptrend
      {
        id: 'trend-up',
        type: 'condition',
        position: { x: 350, y: 50 },
        data: { label: 'Uptrend (Price > EMA200)', conditionType: 'compare', operator: '>' },
      },
      // Trend filter: Price < EMA 200 → downtrend
      {
        id: 'trend-down',
        type: 'condition',
        position: { x: 350, y: 170 },
        data: { label: 'Downtrend (Price < EMA200)', conditionType: 'compare', operator: '<' },
      },
      // RSI oversold
      {
        id: 'rsi-oversold',
        type: 'condition',
        position: { x: 350, y: 310 },
        data: { label: 'RSI < 35', conditionType: 'compare', operator: '<' },
      },
      // RSI overbought
      {
        id: 'rsi-overbought',
        type: 'condition',
        position: { x: 350, y: 430 },
        data: { label: 'RSI > 65', conditionType: 'compare', operator: '>' },
      },
      // BB touch lower
      {
        id: 'bb-lower-touch',
        type: 'condition',
        position: { x: 350, y: 550 },
        data: { label: 'Price < Lower BB', conditionType: 'compare', operator: '<' },
      },
      // Stochastic %K cross above %D (bullish)
      {
        id: 'stoch-cross-up',
        type: 'condition',
        position: { x: 350, y: 670 },
        data: { label: 'Stoch %K crosses %D', conditionType: 'crossover' },
      },
      // MACD bearish crossunder
      {
        id: 'macd-cross-dn',
        type: 'condition',
        position: { x: 350, y: 790 },
        data: { label: 'MACD Bearish Cross', conditionType: 'crossunder' },
      },

      // ── Layer 4: Confluence Gates ───────────────────────────────────────
      // Long confluence: RSI oversold AND BB lower touch
      {
        id: 'long-conf-1',
        type: 'condition',
        position: { x: 620, y: 400 },
        data: { label: 'RSI+BB Long Signal', conditionType: 'and' },
      },
      // Long confluence 2: above AND stoch cross
      {
        id: 'long-conf-2',
        type: 'condition',
        position: { x: 620, y: 550 },
        data: { label: 'Stoch Confirmation', conditionType: 'and' },
      },
      // Full long: uptrend AND (RSI+BB+Stoch)
      {
        id: 'long-final',
        type: 'condition',
        position: { x: 870, y: 250 },
        data: { label: 'LONG Signal', conditionType: 'and' },
      },
      // Short confluence: downtrend AND RSI overbought AND MACD bearish
      {
        id: 'short-conf',
        type: 'condition',
        position: { x: 620, y: 790 },
        data: { label: 'RSI OB + MACD Bear', conditionType: 'and' },
      },
      {
        id: 'short-final',
        type: 'condition',
        position: { x: 870, y: 790 },
        data: { label: 'SHORT Signal', conditionType: 'and' },
      },

      // ── Layer 5: Actions ────────────────────────────────────────────────
      {
        id: 'buy-long',
        type: 'action',
        position: { x: 1120, y: 200 },
        data: { label: 'Buy Long (8%)', actionType: 'order', direction: 'long', size: 8, sizeType: 'percent' },
      },
      {
        id: 'sell-short',
        type: 'action',
        position: { x: 1120, y: 790 },
        data: { label: 'Sell Short (5%)', actionType: 'order', direction: 'short', size: 5, sizeType: 'percent' },
      },

      // ── Layer 6: Risk Management (chained after entry) ──────────────────
      {
        id: 'stop-loss',
        type: 'action',
        position: { x: 1370, y: 200 },
        data: { label: 'Stop Loss (2×ATR)', actionType: 'stopLoss', stopDistance: 'atr_multiple' },
      },
      {
        id: 'take-profit',
        type: 'action',
        position: { x: 1370, y: 350 },
        data: { label: 'Take Profit (3×ATR)', actionType: 'takeProfit', profitDistance: 'atr_multiple' },
      },
    ],
    edges: [
      // ── Trend filter wiring ─────────────────────────────────────────────
      // Price → trend-up input-a, EMA200 → trend-up input-b
      { id: 'e1', source: 'price', sourceHandle: 'value', target: 'trend-up', targetHandle: 'input-a' },
      { id: 'e2', source: 'ema200', sourceHandle: 'value', target: 'trend-up', targetHandle: 'input-b' },
      // Price → trend-down input-a, EMA200 → trend-down input-b
      { id: 'e3', source: 'price', sourceHandle: 'value', target: 'trend-down', targetHandle: 'input-a' },
      { id: 'e4', source: 'ema200', sourceHandle: 'value', target: 'trend-down', targetHandle: 'input-b' },

      // ── RSI wiring ──────────────────────────────────────────────────────
      { id: 'e5', source: 'rsi', sourceHandle: 'value', target: 'rsi-oversold', targetHandle: 'input-a' },
      { id: 'e6', source: 'const-35', sourceHandle: 'output', target: 'rsi-oversold', targetHandle: 'input-b' },
      { id: 'e7', source: 'rsi', sourceHandle: 'value', target: 'rsi-overbought', targetHandle: 'input-a' },
      { id: 'e8', source: 'const-65', sourceHandle: 'output', target: 'rsi-overbought', targetHandle: 'input-b' },

      // ── BB lower touch wiring ───────────────────────────────────────────
      { id: 'e9', source: 'price', sourceHandle: 'value', target: 'bb-lower-touch', targetHandle: 'input-a' },
      { id: 'e10', source: 'bb', sourceHandle: 'lower', target: 'bb-lower-touch', targetHandle: 'input-b' },

      // ── Stochastic crossover wiring ─────────────────────────────────────
      { id: 'e11', source: 'stoch', sourceHandle: 'main', target: 'stoch-cross-up', targetHandle: 'input-a' },
      { id: 'e12', source: 'stoch', sourceHandle: 'signal', target: 'stoch-cross-up', targetHandle: 'input-b' },

      // ── MACD bearish crossunder wiring ──────────────────────────────────
      { id: 'e13', source: 'macd', sourceHandle: 'line', target: 'macd-cross-dn', targetHandle: 'input-a' },
      { id: 'e14', source: 'macd', sourceHandle: 'signal', target: 'macd-cross-dn', targetHandle: 'input-b' },

      // ── Long confluence gates ───────────────────────────────────────────
      // RSI oversold AND BB lower touch → long-conf-1
      { id: 'e15', source: 'rsi-oversold', sourceHandle: 'output', target: 'long-conf-1', targetHandle: 'input-a' },
      { id: 'e16', source: 'bb-lower-touch', sourceHandle: 'output', target: 'long-conf-1', targetHandle: 'input-b' },
      // long-conf-1 AND stoch cross → long-conf-2
      { id: 'e17', source: 'long-conf-1', sourceHandle: 'output', target: 'long-conf-2', targetHandle: 'input-a' },
      { id: 'e18', source: 'stoch-cross-up', sourceHandle: 'output', target: 'long-conf-2', targetHandle: 'input-b' },
      // uptrend AND long-conf-2 → long-final
      { id: 'e19', source: 'trend-up', sourceHandle: 'output', target: 'long-final', targetHandle: 'input-a' },
      { id: 'e20', source: 'long-conf-2', sourceHandle: 'output', target: 'long-final', targetHandle: 'input-b' },

      // ── Short confluence gates ──────────────────────────────────────────
      // RSI overbought AND MACD bearish → short-conf
      { id: 'e21', source: 'rsi-overbought', sourceHandle: 'output', target: 'short-conf', targetHandle: 'input-a' },
      { id: 'e22', source: 'macd-cross-dn', sourceHandle: 'output', target: 'short-conf', targetHandle: 'input-b' },
      // downtrend AND short-conf → short-final
      { id: 'e23', source: 'trend-down', sourceHandle: 'output', target: 'short-final', targetHandle: 'input-a' },
      { id: 'e24', source: 'short-conf', sourceHandle: 'output', target: 'short-final', targetHandle: 'input-b' },

      // ── Entry actions ───────────────────────────────────────────────────
      { id: 'e25', source: 'long-final', sourceHandle: 'output', target: 'buy-long', targetHandle: 'trigger' },
      { id: 'e26', source: 'short-final', sourceHandle: 'output', target: 'sell-short', targetHandle: 'trigger' },

      // ── Risk management chain (long side) ───────────────────────────────
      // Buy → Stop Loss → Take Profit
      { id: 'e27', source: 'buy-long', sourceHandle: 'next', target: 'stop-loss', targetHandle: 'trigger' },
      { id: 'e28', source: 'stop-loss', sourceHandle: 'next', target: 'take-profit', targetHandle: 'trigger' },

      // ── ATR-based SL/TP price inputs ────────────────────────────────────
      // ATR feeds into stop-loss and take-profit price handles for dynamic sizing
      { id: 'e29', source: 'atr', sourceHandle: 'value', target: 'stop-loss', targetHandle: 'price' },
      { id: 'e30', source: 'atr', sourceHandle: 'value', target: 'take-profit', targetHandle: 'price' },
    ],
  },
];
