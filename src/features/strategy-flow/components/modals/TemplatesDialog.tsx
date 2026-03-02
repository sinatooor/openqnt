/**
 * TemplatesDialog - Browse and load strategy templates
 * Equivalent to Blockly's StrategyTemplatesDialog
 */

import { memo, useState, useMemo } from 'react';
import { WindowModal } from './WindowModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  TrendingUp,
  Zap,
  Shield,
  Clock,
  Star,
  Download,
  Layers,
  ShieldAlert,
  PieChart,
  LineChart,
} from 'lucide-react';
import { useStrategyFlowStore, EDGE_DATA_TYPE_COLORS } from '../../store/strategyFlowStore';
import {
  INDICATOR_NODES,
  CONDITION_NODES,
  ACTION_NODES,
} from '../../catalog/nodeCatalog';
import { StrategyFlowNode, StrategyFlowEdge } from '../../types';
import { getHandleConfigs } from '../../utils/handleUtils';

interface TemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  category:
  | 'trend'
  | 'momentum'
  | 'mean-reversion'
  | 'breakout'
  | 'scalping'
  | 'trading'
  | 'hedging'
  | 'portfolio'
  | 'risk-management'
  | 'pinescript';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  indicators: string[];
  nodes: StrategyFlowNode[];
  edges: StrategyFlowEdge[];
  featured?: boolean;
}

// Pre-built strategy templates
const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'sma-crossover',
    name: 'SMA Crossover',
    description: 'Classic moving average crossover strategy. Buy when fast MA crosses above slow MA.',
    category: 'trend',
    difficulty: 'beginner',
    indicators: ['SMA (Fast)', 'SMA (Slow)'],
    featured: true,
    nodes: [
      {
        id: 'sma-fast',
        type: 'indicator',
        position: { x: 100, y: 100 },
        data: { label: 'SMA (Fast)', indicatorType: 'sma', timeframe: '60', params: { period: 10 } },
      },
      {
        id: 'sma-slow',
        type: 'indicator',
        position: { x: 100, y: 220 },
        data: { label: 'SMA (Slow)', indicatorType: 'sma', timeframe: '60', params: { period: 20 } },
      },
      {
        id: 'crossover',
        type: 'condition',
        position: { x: 350, y: 160 },
        data: { label: 'Crossover', conditionType: 'crossover' },
      },
      {
        id: 'buy',
        type: 'action',
        position: { x: 600, y: 160 },
        data: { label: 'Buy', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' },
      },
    ],
    edges: [
      { id: 'e1', source: 'sma-fast', sourceHandle: 'output', target: 'crossover', targetHandle: 'input-a' },
      { id: 'e2', source: 'sma-slow', sourceHandle: 'output', target: 'crossover', targetHandle: 'input-b' },
      { id: 'e3', source: 'crossover', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'rsi-oversold',
    name: 'RSI Oversold',
    description: 'Mean reversion strategy. Buy when RSI drops below 30 (oversold).',
    category: 'mean-reversion',
    difficulty: 'beginner',
    indicators: ['RSI'],
    nodes: [
      {
        id: 'rsi',
        type: 'indicator',
        position: { x: 100, y: 150 },
        data: { label: 'RSI', indicatorType: 'rsi', timeframe: '60', params: { period: 14 } },
      },
      {
        id: 'constant-30',
        type: 'math',
        position: { x: 100, y: 280 },
        data: { label: '30', mathType: 'number', value: 30 },
      },
      {
        id: 'threshold',
        type: 'condition',
        position: { x: 350, y: 180 },
        data: { label: 'RSI < 30', conditionType: 'compare', operator: '<' },
      },
      {
        id: 'buy',
        type: 'action',
        position: { x: 600, y: 180 },
        data: { label: 'Buy', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' },
      },
    ],
    edges: [
      { id: 'e1', source: 'rsi', sourceHandle: 'output', target: 'threshold', targetHandle: 'input-a' },
      { id: 'e2', source: 'constant-30', sourceHandle: 'output', target: 'threshold', targetHandle: 'input-b' },
      { id: 'e3', source: 'threshold', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'macd-signal',
    name: 'MACD Signal Cross',
    description: 'Momentum strategy using MACD line crossing signal line.',
    category: 'momentum',
    difficulty: 'intermediate',
    indicators: ['MACD'],
    featured: true,
    nodes: [
      {
        id: 'macd',
        type: 'indicator',
        position: { x: 100, y: 150 },
        data: { label: 'MACD', indicatorType: 'macd', timeframe: '60', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
      },
      {
        id: 'crossover',
        type: 'condition',
        position: { x: 350, y: 150 },
        data: { label: 'MACD Crossover', conditionType: 'crossover' },
      },
      {
        id: 'buy',
        type: 'action',
        position: { x: 600, y: 150 },
        data: { label: 'Buy', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' },
      },
    ],
    edges: [
      { id: 'e1', source: 'macd', sourceHandle: 'line', target: 'crossover', targetHandle: 'input-a' },
      { id: 'e2', source: 'macd', sourceHandle: 'signal', target: 'crossover', targetHandle: 'input-b' },
      { id: 'e3', source: 'crossover', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'bb-breakout',
    name: 'Bollinger Band Breakout',
    description: 'Breakout strategy. Buy when price breaks above upper Bollinger Band.',
    category: 'breakout',
    difficulty: 'intermediate',
    indicators: ['Bollinger Bands'],
    nodes: [
      {
        id: 'bb',
        type: 'indicator',
        position: { x: 100, y: 150 },
        data: { label: 'Bollinger Bands', indicatorType: 'bb', timeframe: '60', params: { period: 20, stdDev: 2 } },
      },
      {
        id: 'price',
        type: 'environment',
        position: { x: 100, y: 280 },
        data: { label: 'Price', environmentType: 'price', priceType: 'mid' },
      },
      {
        id: 'compare',
        type: 'condition',
        position: { x: 350, y: 200 },
        data: { label: 'Price > Upper', conditionType: 'compare', operator: '>' },
      },
      {
        id: 'buy',
        type: 'action',
        position: { x: 600, y: 200 },
        data: { label: 'Buy', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' },
      },
    ],
    edges: [
      { id: 'e1', source: 'price', sourceHandle: 'output', target: 'compare', targetHandle: 'input-a' },
      { id: 'e2', source: 'bb', sourceHandle: 'upper', target: 'compare', targetHandle: 'input-b' },
      { id: 'e3', source: 'compare', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'triple-ema',
    name: 'Triple EMA',
    description: 'Advanced trend following with 3 EMAs for confirmation.',
    category: 'trend',
    difficulty: 'advanced',
    indicators: ['EMA (Fast)', 'EMA (Medium)', 'EMA (Slow)'],
    nodes: [
      {
        id: 'ema-fast',
        type: 'indicator',
        position: { x: 100, y: 80 },
        data: { label: 'EMA 9', indicatorType: 'ema', timeframe: '60', params: { period: 9 } },
      },
      {
        id: 'ema-medium',
        type: 'indicator',
        position: { x: 100, y: 200 },
        data: { label: 'EMA 21', indicatorType: 'ema', timeframe: '60', params: { period: 21 } },
      },
      {
        id: 'ema-slow',
        type: 'indicator',
        position: { x: 100, y: 320 },
        data: { label: 'EMA 55', indicatorType: 'ema', timeframe: '60', params: { period: 55 } },
      },
      {
        id: 'cross1',
        type: 'condition',
        position: { x: 350, y: 140 },
        data: { label: 'Fast > Medium', conditionType: 'compare', operator: '>' },
      },
      {
        id: 'cross2',
        type: 'condition',
        position: { x: 350, y: 260 },
        data: { label: 'Medium > Slow', conditionType: 'compare', operator: '>' },
      },
      {
        id: 'and',
        type: 'condition',
        position: { x: 550, y: 200 },
        data: { label: 'AND', conditionType: 'and' },
      },
      {
        id: 'buy',
        type: 'action',
        position: { x: 750, y: 200 },
        data: { label: 'Buy', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' },
      },
    ],
    edges: [
      { id: 'e1', source: 'ema-fast', sourceHandle: 'output', target: 'cross1', targetHandle: 'input-a' },
      { id: 'e2', source: 'ema-medium', sourceHandle: 'output', target: 'cross1', targetHandle: 'input-b' },
      { id: 'e3', source: 'ema-medium', sourceHandle: 'output', target: 'cross2', targetHandle: 'input-a' },
      { id: 'e4', source: 'ema-slow', sourceHandle: 'output', target: 'cross2', targetHandle: 'input-b' },
      { id: 'e5', source: 'cross1', sourceHandle: 'output', target: 'and', targetHandle: 'input-a' },
      { id: 'e6', source: 'cross2', sourceHandle: 'output', target: 'and', targetHandle: 'input-b' },
      { id: 'e7', source: 'and', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'statistical-arbitrage',
    name: 'Statistical Arbitrage',
    description: 'Pairs trading strategy. Exploit deviations in price relationships between correlated assets.',
    category: 'trading',
    difficulty: 'advanced',
    indicators: ['Asset Spread'],
    nodes: [
      {
        id: 'spread-ind',
        type: 'indicator',
        position: { x: 100, y: 150 },
        data: { label: 'Asset Spread', indicatorType: 'spread', timeframe: '60', params: { calculationType: 'ratio' } },
      },
      {
        id: 'constant-1_05',
        type: 'math',
        position: { x: 100, y: 280 },
        data: { label: '1.05', mathType: 'number', value: 1.05 },
      },
      {
        id: 'constant-0_95',
        type: 'math',
        position: { x: 100, y: 410 },
        data: { label: '0.95', mathType: 'number', value: 0.95 },
      },
      {
        id: 'compare-high',
        type: 'condition',
        position: { x: 350, y: 180 },
        data: { label: 'Spread > 1.05', conditionType: 'compare', operator: '>' },
      },
      {
        id: 'compare-low',
        type: 'condition',
        position: { x: 350, y: 310 },
        data: { label: 'Spread < 0.95', conditionType: 'compare', operator: '<' },
      },
      {
        id: 'short-pair',
        type: 'action',
        position: { x: 600, y: 180 },
        data: { label: 'Short Pair', actionType: 'order', direction: 'short', size: 10, sizeType: 'percent' },
      },
      {
        id: 'long-pair',
        type: 'action',
        position: { x: 600, y: 310 },
        data: { label: 'Long Pair', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' },
      },
    ],
    edges: [
      { id: 'e1', source: 'spread-ind', sourceHandle: 'output', target: 'compare-high', targetHandle: 'input-a' },
      { id: 'e2', source: 'constant-1_05', sourceHandle: 'output', target: 'compare-high', targetHandle: 'input-b' },
      { id: 'e3', source: 'spread-ind', sourceHandle: 'output', target: 'compare-low', targetHandle: 'input-a' },
      { id: 'e4', source: 'constant-0_95', sourceHandle: 'output', target: 'compare-low', targetHandle: 'input-b' },
      { id: 'e5', source: 'compare-high', sourceHandle: 'output', target: 'short-pair', targetHandle: 'trigger' },
      { id: 'e6', source: 'compare-low', sourceHandle: 'output', target: 'long-pair', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'hmm-regime-switching',
    name: 'HMM Regime-Switching',
    description: 'Detects market regimes using Hidden Markov Models and adapts strategy accordingly. Alternate between trending and mean-reversion.',
    category: 'trading',
    difficulty: 'advanced',
    indicators: ['HMM Regime'],
    nodes: [
      {
        id: 'hmm',
        type: 'indicator',
        position: { x: 100, y: 150 },
        data: { label: 'HMM Regime', indicatorType: 'hmm_regime', timeframe: '1D', params: { n_states: 2, feature: 'returns' } },
      },
      {
        id: 'constant-0',
        type: 'math',
        position: { x: 100, y: 280 },
        data: { label: '0 (Bull)', mathType: 'number', value: 0 },
      },
      {
        id: 'constant-1',
        type: 'math',
        position: { x: 100, y: 410 },
        data: { label: '1 (Bear)', mathType: 'number', value: 1 },
      },
      {
        id: 'is-bull',
        type: 'condition',
        position: { x: 350, y: 180 },
        data: { label: 'Is Bull Regime', conditionType: 'compare', operator: '==' },
      },
      {
        id: 'is-bear',
        type: 'condition',
        position: { x: 350, y: 310 },
        data: { label: 'Is Bear Regime', conditionType: 'compare', operator: '==' },
      },
      {
        id: 'buy',
        type: 'action',
        position: { x: 600, y: 180 },
        data: { label: 'Buy Asset', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' },
      },
      {
        id: 'sell',
        type: 'action',
        position: { x: 600, y: 310 },
        data: { label: 'Sell Asset', actionType: 'order', direction: 'short', size: 10, sizeType: 'percent' },
      },
    ],
    edges: [
      { id: 'e1', source: 'hmm', sourceHandle: 'output', target: 'is-bull', targetHandle: 'input-a' },
      { id: 'e2', source: 'constant-0', sourceHandle: 'output', target: 'is-bull', targetHandle: 'input-b' },
      { id: 'e3', source: 'hmm', sourceHandle: 'output', target: 'is-bear', targetHandle: 'input-a' },
      { id: 'e4', source: 'constant-1', sourceHandle: 'output', target: 'is-bear', targetHandle: 'input-b' },
      { id: 'e5', source: 'is-bull', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
      { id: 'e6', source: 'is-bear', sourceHandle: 'output', target: 'sell', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'diversification-allocation',
    name: 'Diversification & Allocation',
    description: 'Spread investments across asset classes and regions to reduce risk.',
    category: 'portfolio',
    difficulty: 'intermediate',
    indicators: [],
    nodes: [
      {
        id: 'heartbeat',
        type: 'trigger',
        position: { x: 100, y: 150 },
        data: { label: 'Monthly Run', triggerType: 'cronTrigger', cronExpression: '0 0 1 * *' },
      },
      {
        id: 'alloc-1',
        type: 'risk',
        position: { x: 350, y: 50 },
        data: { label: 'Stocks (60%)', riskType: 'portfolioAllocation', targetPercentage: 60 },
      },
      {
        id: 'alloc-2',
        type: 'risk',
        position: { x: 350, y: 150 },
        data: { label: 'Bonds (30%)', riskType: 'portfolioAllocation', targetPercentage: 30 },
      },
      {
        id: 'alloc-3',
        type: 'risk',
        position: { x: 350, y: 250 },
        data: { label: 'Gold (10%)', riskType: 'portfolioAllocation', targetPercentage: 10 },
      },
      {
        id: 'rebalance',
        type: 'action',
        position: { x: 600, y: 150 },
        data: { label: 'Rebalance Portfolio', actionType: 'portfolio_rebalance', rebalanceThresholdPercent: 5 },
      },
    ],
    edges: [
      { id: 'e1', source: 'heartbeat', sourceHandle: 'output', target: 'rebalance', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'portfolio-rebalancing',
    name: 'Portfolio Rebalancing',
    description: 'Restore original asset-allocation weights when performance divergence occurs.',
    category: 'portfolio',
    difficulty: 'beginner',
    indicators: [],
    nodes: [
      {
        id: 'heartbeat',
        type: 'trigger',
        position: { x: 100, y: 150 },
        data: { label: 'Weekly Check', triggerType: 'cronTrigger', cronExpression: '0 0 * * 5' },
      },
      {
        id: 'rebalance',
        type: 'action',
        position: { x: 350, y: 150 },
        data: { label: 'Rebalance (Threshold: 5%)', actionType: 'portfolio_rebalance', rebalanceThresholdPercent: 5 },
      },
    ],
    edges: [
      { id: 'e1', source: 'heartbeat', sourceHandle: 'output', target: 'rebalance', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'protective-put',
    name: 'Protective Put',
    description: 'Buy put options to cap downside in anticipated volatility or major events.',
    category: 'hedging',
    difficulty: 'intermediate',
    indicators: ['ATR'],
    nodes: [
      {
        id: 'atr',
        type: 'indicator',
        position: { x: 100, y: 150 },
        data: { label: 'ATR', indicatorType: 'atr', timeframe: '1D', params: { period: 14 } },
      },
      {
        id: 'constant',
        type: 'math',
        position: { x: 100, y: 280 },
        data: { label: 'High Volatility Threshold', mathType: 'number', value: 5.0 },
      },
      {
        id: 'compare',
        type: 'condition',
        position: { x: 350, y: 180 },
        data: { label: 'ATR > Threshold', conditionType: 'compare', operator: '>' },
      },
      {
        id: 'buy-put',
        type: 'action',
        position: { x: 600, y: 180 },
        data: { label: 'Buy Put', actionType: 'options_order', optionType: 'put', direction: 'buy', strike: 'OTM', size: 1 },
      },
    ],
    edges: [
      { id: 'e1', source: 'atr', sourceHandle: 'output', target: 'compare', targetHandle: 'input-a' },
      { id: 'e2', source: 'constant', sourceHandle: 'output', target: 'compare', targetHandle: 'input-b' },
      { id: 'e3', source: 'compare', sourceHandle: 'output', target: 'buy-put', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'options-collar',
    name: 'Options Collar',
    description: 'Combine long stock, long put and short call to reduce hedge cost. Caps upside but provides low-cost downside protection.',
    category: 'hedging',
    difficulty: 'advanced',
    indicators: [],
    nodes: [
      {
        id: 'heartbeat',
        type: 'trigger',
        position: { x: 100, y: 150 },
        data: { label: 'Monthly Rollover', triggerType: 'cronTrigger', cronExpression: '0 0 1 * *' },
      },
      {
        id: 'buy-put',
        type: 'action',
        position: { x: 350, y: 80 },
        data: { label: 'Buy Protective Put', actionType: 'options_order', optionType: 'put', direction: 'buy', strike: 'OTM', size: 1 },
      },
      {
        id: 'sell-call',
        type: 'action',
        position: { x: 350, y: 220 },
        data: { label: 'Sell Covered Call', actionType: 'options_order', optionType: 'call', direction: 'sell', strike: 'OTM', size: 1 },
      },
    ],
    edges: [
      { id: 'e1', source: 'heartbeat', sourceHandle: 'output', target: 'buy-put', targetHandle: 'trigger' },
      { id: 'e2', source: 'heartbeat', sourceHandle: 'output', target: 'sell-call', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'trailing-stop-loss',
    name: 'Trailing Stop Loss',
    description: 'Automatic orders to cut losses or lock in gains. Suitable for all traders for simple risk management.',
    category: 'risk-management',
    difficulty: 'beginner',
    indicators: ['SMA (Fast)', 'SMA (Slow)'],
    nodes: [
      {
        id: 'sma-fast',
        type: 'indicator',
        position: { x: 100, y: 100 },
        data: { label: 'SMA (Fast)', indicatorType: 'sma', timeframe: '60', params: { period: 10 } },
      },
      {
        id: 'sma-slow',
        type: 'indicator',
        position: { x: 100, y: 220 },
        data: { label: 'SMA (Slow)', indicatorType: 'sma', timeframe: '60', params: { period: 20 } },
      },
      {
        id: 'crossover',
        type: 'condition',
        position: { x: 350, y: 160 },
        data: { label: 'Crossover', conditionType: 'crossover' },
      },
      {
        id: 'buy',
        type: 'action',
        position: { x: 600, y: 160 },
        data: { label: 'Buy', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' },
      },
      {
        id: 'trailing-stop',
        type: 'action',
        position: { x: 800, y: 160 },
        data: { label: 'Set Trailing Stop', actionType: 'trailingStop', trailingDistance: 5 },
      }
    ],
    edges: [
      { id: 'e1', source: 'sma-fast', sourceHandle: 'output', target: 'crossover', targetHandle: 'input-a' },
      { id: 'e2', source: 'sma-slow', sourceHandle: 'output', target: 'crossover', targetHandle: 'input-b' },
      { id: 'e3', source: 'crossover', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
      { id: 'e4', source: 'buy', sourceHandle: 'output', target: 'trailing-stop', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'inverse-etf-hedging',
    name: 'Inverse ETF Hedging',
    description: 'Profit when underlying declines. Used to hedge broad market exposure.',
    category: 'hedging',
    difficulty: 'intermediate',
    indicators: ['SMA'],
    nodes: [
      {
        id: 'sma',
        type: 'indicator',
        position: { x: 100, y: 150 },
        data: { label: 'SMA (200)', indicatorType: 'sma', timeframe: '1D', params: { period: 200 } },
      },
      {
        id: 'price',
        type: 'environment',
        position: { x: 100, y: 280 },
        data: { label: 'Price', environmentType: 'price', priceType: 'close' },
      },
      {
        id: 'compare',
        type: 'condition',
        position: { x: 350, y: 200 },
        data: { label: 'Price < SMA', conditionType: 'compare', operator: '<' },
      },
      {
        id: 'buy-inverse',
        type: 'action',
        position: { x: 600, y: 200 },
        data: { label: 'Buy Inverse ETF', actionType: 'order', direction: 'long', size: 15, sizeType: 'percent' },
      },
    ],
    edges: [
      { id: 'e1', source: 'price', sourceHandle: 'output', target: 'compare', targetHandle: 'input-a' },
      { id: 'e2', source: 'sma', sourceHandle: 'output', target: 'compare', targetHandle: 'input-b' },
      { id: 'e3', source: 'compare', sourceHandle: 'output', target: 'buy-inverse', targetHandle: 'trigger' },
    ],
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// PINE SCRIPT TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

const PINE_SCRIPT_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'pine-sma-crossover',
    name: 'SMA Crossover Script',
    description: 'Classic dual SMA crossover strategy in Pine Script. Generates buy/sell signals and plots both moving averages.',
    category: 'pinescript',
    difficulty: 'beginner',
    indicators: ['ta.sma'],
    featured: true,
    nodes: [
      { id: 'ps-setup', type: 'pineScript', position: { x: 100, y: 50 }, data: { label: 'strategy()', pineType: 'pine_strategy', scriptTitle: 'SMA Crossover', overlay: true } },
      { id: 'ps-len-fast', type: 'pineScript', position: { x: 100, y: 150 }, data: { label: 'input.int', pineType: 'pine_input_int', inputName: 'Fast Length', inputDefault: 10 } },
      { id: 'ps-len-slow', type: 'pineScript', position: { x: 100, y: 250 }, data: { label: 'input.int', pineType: 'pine_input_int', inputName: 'Slow Length', inputDefault: 20 } },
      { id: 'ps-close', type: 'pineScript', position: { x: 100, y: 350 }, data: { label: 'close', pineType: 'pine_close' } },
      { id: 'ps-sma-fast', type: 'pineScript', position: { x: 380, y: 150 }, data: { label: 'ta.sma', pineType: 'pine_ta_sma', source: 'close' } },
      { id: 'ps-sma-slow', type: 'pineScript', position: { x: 380, y: 280 }, data: { label: 'ta.sma', pineType: 'pine_ta_sma', source: 'close' } },
      { id: 'ps-cross-up', type: 'pineScript', position: { x: 630, y: 180 }, data: { label: 'ta.crossover', pineType: 'pine_ta_crossover' } },
      { id: 'ps-cross-dn', type: 'pineScript', position: { x: 630, y: 320 }, data: { label: 'ta.crossunder', pineType: 'pine_ta_crossunder' } },
      { id: 'ps-entry', type: 'pineScript', position: { x: 880, y: 180 }, data: { label: 'strategy.entry', pineType: 'pine_strategy_entry', entryId: 'Long', direction: 'long' } },
      { id: 'ps-close-pos', type: 'pineScript', position: { x: 880, y: 320 }, data: { label: 'strategy.close', pineType: 'pine_strategy_close', entryId: 'Long' } },
      { id: 'ps-plot-fast', type: 'pineScript', position: { x: 630, y: 60 }, data: { label: 'plot', pineType: 'pine_plot', plotTitle: 'Fast SMA', plotColor: '#2962FF', plotLineWidth: 2 } },
      { id: 'ps-plot-slow', type: 'pineScript', position: { x: 630, y: 440 }, data: { label: 'plot', pineType: 'pine_plot', plotTitle: 'Slow SMA', plotColor: '#FF6D00', plotLineWidth: 2 } },
    ],
    edges: [
      { id: 'pe1', source: 'ps-close', target: 'ps-sma-fast' },
      { id: 'pe2', source: 'ps-len-fast', target: 'ps-sma-fast' },
      { id: 'pe3', source: 'ps-close', target: 'ps-sma-slow' },
      { id: 'pe4', source: 'ps-len-slow', target: 'ps-sma-slow' },
      { id: 'pe5', source: 'ps-sma-fast', target: 'ps-cross-up' },
      { id: 'pe6', source: 'ps-sma-slow', target: 'ps-cross-up' },
      { id: 'pe7', source: 'ps-sma-fast', target: 'ps-cross-dn' },
      { id: 'pe8', source: 'ps-sma-slow', target: 'ps-cross-dn' },
      { id: 'pe9', source: 'ps-cross-up', target: 'ps-entry' },
      { id: 'pe10', source: 'ps-cross-dn', target: 'ps-close-pos' },
      { id: 'pe11', source: 'ps-sma-fast', target: 'ps-plot-fast' },
      { id: 'pe12', source: 'ps-sma-slow', target: 'ps-plot-slow' },
    ],
  },
  {
    id: 'pine-rsi-strategy',
    name: 'RSI Overbought/Oversold',
    description: 'Buy when RSI drops below 30, sell when it rises above 70. Includes horizontal reference lines and background coloring.',
    category: 'pinescript',
    difficulty: 'beginner',
    indicators: ['ta.rsi'],
    featured: true,
    nodes: [
      { id: 'ps-setup', type: 'pineScript', position: { x: 100, y: 50 }, data: { label: 'strategy()', pineType: 'pine_strategy', scriptTitle: 'RSI Strategy', overlay: true } },
      { id: 'ps-len', type: 'pineScript', position: { x: 100, y: 150 }, data: { label: 'input.int', pineType: 'pine_input_int', inputName: 'RSI Length', inputDefault: 14 } },
      { id: 'ps-close', type: 'pineScript', position: { x: 100, y: 260 }, data: { label: 'close', pineType: 'pine_close' } },
      { id: 'ps-rsi', type: 'pineScript', position: { x: 380, y: 180 }, data: { label: 'ta.rsi', pineType: 'pine_ta_rsi', source: 'close' } },
      { id: 'ps-cmp-low', type: 'pineScript', position: { x: 630, y: 130 }, data: { label: 'Compare', pineType: 'pine_compare', operator: '<' } },
      { id: 'ps-cmp-high', type: 'pineScript', position: { x: 630, y: 280 }, data: { label: 'Compare', pineType: 'pine_compare', operator: '>' } },
      { id: 'ps-entry', type: 'pineScript', position: { x: 880, y: 130 }, data: { label: 'strategy.entry', pineType: 'pine_strategy_entry', entryId: 'Long', direction: 'long' } },
      { id: 'ps-close-pos', type: 'pineScript', position: { x: 880, y: 280 }, data: { label: 'strategy.close', pineType: 'pine_strategy_close', entryId: 'Long' } },
      { id: 'ps-plot', type: 'pineScript', position: { x: 380, y: 340 }, data: { label: 'plot', pineType: 'pine_plot', plotTitle: 'RSI', plotColor: '#7C4DFF', plotLineWidth: 2 } },
    ],
    edges: [
      { id: 'pe1', source: 'ps-close', target: 'ps-rsi' },
      { id: 'pe2', source: 'ps-len', target: 'ps-rsi' },
      { id: 'pe3', source: 'ps-rsi', target: 'ps-cmp-low' },
      { id: 'pe4', source: 'ps-rsi', target: 'ps-cmp-high' },
      { id: 'pe5', source: 'ps-cmp-low', target: 'ps-entry' },
      { id: 'pe6', source: 'ps-cmp-high', target: 'ps-close-pos' },
      { id: 'pe7', source: 'ps-rsi', target: 'ps-plot' },
    ],
  },
  {
    id: 'pine-macd-strategy',
    name: 'MACD Strategy',
    description: 'MACD line / signal line crossover strategy with histogram plotting. Classic momentum approach.',
    category: 'pinescript',
    difficulty: 'intermediate',
    indicators: ['ta.macd'],
    nodes: [
      { id: 'ps-setup', type: 'pineScript', position: { x: 100, y: 50 }, data: { label: 'strategy()', pineType: 'pine_strategy', scriptTitle: 'MACD Strategy', overlay: false } },
      { id: 'ps-close', type: 'pineScript', position: { x: 100, y: 180 }, data: { label: 'close', pineType: 'pine_close' } },
      { id: 'ps-macd', type: 'pineScript', position: { x: 380, y: 180 }, data: { label: 'ta.macd', pineType: 'pine_ta_macd', source: 'close' } },
      { id: 'ps-cross-up', type: 'pineScript', position: { x: 630, y: 130 }, data: { label: 'ta.crossover', pineType: 'pine_ta_crossover' } },
      { id: 'ps-cross-dn', type: 'pineScript', position: { x: 630, y: 280 }, data: { label: 'ta.crossunder', pineType: 'pine_ta_crossunder' } },
      { id: 'ps-entry', type: 'pineScript', position: { x: 880, y: 130 }, data: { label: 'strategy.entry', pineType: 'pine_strategy_entry', entryId: 'Long', direction: 'long' } },
      { id: 'ps-close-pos', type: 'pineScript', position: { x: 880, y: 280 }, data: { label: 'strategy.close', pineType: 'pine_strategy_close', entryId: 'Long' } },
    ],
    edges: [
      { id: 'pe1', source: 'ps-close', target: 'ps-macd' },
      { id: 'pe3', source: 'ps-macd', target: 'ps-cross-up' },
      { id: 'pe4', source: 'ps-macd', target: 'ps-cross-dn' },
      { id: 'pe5', source: 'ps-cross-up', target: 'ps-entry' },
      { id: 'pe6', source: 'ps-cross-dn', target: 'ps-close-pos' },
    ],
  },
  {
    id: 'pine-bb-squeeze',
    name: 'Bollinger Bands Squeeze',
    description: 'Detects low-volatility squeezes using Bollinger Bands and ATR, enters on breakout above upper band.',
    category: 'pinescript',
    difficulty: 'intermediate',
    indicators: ['ta.bb', 'ta.atr'],
    nodes: [
      { id: 'ps-setup', type: 'pineScript', position: { x: 100, y: 50 }, data: { label: 'strategy()', pineType: 'pine_strategy', scriptTitle: 'BB Squeeze', overlay: true } },
      { id: 'ps-len', type: 'pineScript', position: { x: 100, y: 150 }, data: { label: 'input.int', pineType: 'pine_input_int', inputName: 'BB Length', inputDefault: 20 } },
      { id: 'ps-close', type: 'pineScript', position: { x: 100, y: 260 }, data: { label: 'close', pineType: 'pine_close' } },
      { id: 'ps-bb', type: 'pineScript', position: { x: 380, y: 180 }, data: { label: 'ta.bb', pineType: 'pine_ta_bb', period: 20, source: 'close' } },
      { id: 'ps-cmp', type: 'pineScript', position: { x: 630, y: 180 }, data: { label: 'Compare', pineType: 'pine_compare', operator: '>' } },
      { id: 'ps-entry', type: 'pineScript', position: { x: 880, y: 180 }, data: { label: 'strategy.entry', pineType: 'pine_strategy_entry', entryId: 'Long', direction: 'long' } },
    ],
    edges: [
      { id: 'pe1', source: 'ps-close', target: 'ps-bb' },
      { id: 'pe2', source: 'ps-len', target: 'ps-bb' },
      { id: 'pe3', source: 'ps-close', target: 'ps-cmp' },
      { id: 'pe4', source: 'ps-bb', target: 'ps-cmp' },
      { id: 'pe5', source: 'ps-cmp', target: 'ps-entry' },
    ],
  },
  {
    id: 'pine-multi-indicator',
    name: 'Multi-Indicator Confluence',
    description: 'Combines EMA trend filter + RSI oversold + VWAP support for high-probability entries.',
    category: 'pinescript',
    difficulty: 'advanced',
    indicators: ['ta.ema', 'ta.rsi', 'ta.vwap'],
    featured: true,
    nodes: [
      { id: 'ps-setup', type: 'pineScript', position: { x: 100, y: 50 }, data: { label: 'strategy()', pineType: 'pine_strategy', scriptTitle: 'Multi-Indicator', overlay: true } },
      { id: 'ps-close', type: 'pineScript', position: { x: 100, y: 180 }, data: { label: 'close', pineType: 'pine_close' } },
      { id: 'ps-ema', type: 'pineScript', position: { x: 350, y: 100 }, data: { label: 'ta.ema', pineType: 'pine_ta_ema', period: 50, source: 'close' } },
      { id: 'ps-rsi', type: 'pineScript', position: { x: 350, y: 230 }, data: { label: 'ta.rsi', pineType: 'pine_ta_rsi', period: 14, source: 'close' } },
      { id: 'ps-vwap', type: 'pineScript', position: { x: 350, y: 360 }, data: { label: 'ta.vwap', pineType: 'pine_ta_vwap', source: 'close' } },
      { id: 'ps-cmp-ema', type: 'pineScript', position: { x: 600, y: 100 }, data: { label: 'Compare', pineType: 'pine_compare', operator: '>' } },
      { id: 'ps-cmp-rsi', type: 'pineScript', position: { x: 600, y: 230 }, data: { label: 'Compare', pineType: 'pine_compare', operator: '<' } },
      { id: 'ps-cmp-vwap', type: 'pineScript', position: { x: 600, y: 360 }, data: { label: 'Compare', pineType: 'pine_compare', operator: '>' } },
      { id: 'ps-and-1', type: 'pineScript', position: { x: 830, y: 160 }, data: { label: 'and', pineType: 'pine_and' } },
      { id: 'ps-and-2', type: 'pineScript', position: { x: 1000, y: 250 }, data: { label: 'and', pineType: 'pine_and' } },
      { id: 'ps-entry', type: 'pineScript', position: { x: 1200, y: 250 }, data: { label: 'strategy.entry', pineType: 'pine_strategy_entry', entryId: 'Long', direction: 'long' } },
    ],
    edges: [
      { id: 'pe1', source: 'ps-close', target: 'ps-ema' },
      { id: 'pe2', source: 'ps-close', target: 'ps-rsi' },
      { id: 'pe3', source: 'ps-close', target: 'ps-cmp-ema' },
      { id: 'pe4', source: 'ps-ema', target: 'ps-cmp-ema' },
      { id: 'pe5', source: 'ps-rsi', target: 'ps-cmp-rsi' },
      { id: 'pe6', source: 'ps-close', target: 'ps-cmp-vwap' },
      { id: 'pe7', source: 'ps-vwap', target: 'ps-cmp-vwap' },
      { id: 'pe8', source: 'ps-cmp-ema', target: 'ps-and-1' },
      { id: 'pe9', source: 'ps-cmp-rsi', target: 'ps-and-1' },
      { id: 'pe10', source: 'ps-and-1', target: 'ps-and-2' },
      { id: 'pe11', source: 'ps-cmp-vwap', target: 'ps-and-2' },
      { id: 'pe12', source: 'ps-and-2', target: 'ps-entry' },
    ],
  },
  {
    id: 'pine-alert-system',
    name: 'Alert System Script',
    description: 'RSI-based alert indicator with plotshape markers and alertcondition for TradingView notifications.',
    category: 'pinescript',
    difficulty: 'beginner',
    indicators: ['ta.rsi'],
    nodes: [
      { id: 'ps-setup', type: 'pineScript', position: { x: 100, y: 50 }, data: { label: 'indicator()', pineType: 'pine_indicator', scriptTitle: 'RSI Alerts', overlay: true } },
      { id: 'ps-close', type: 'pineScript', position: { x: 100, y: 180 }, data: { label: 'close', pineType: 'pine_close' } },
      { id: 'ps-rsi', type: 'pineScript', position: { x: 350, y: 180 }, data: { label: 'ta.rsi', pineType: 'pine_ta_rsi', period: 14, source: 'close' } },
      { id: 'ps-cmp', type: 'pineScript', position: { x: 600, y: 180 }, data: { label: 'Compare', pineType: 'pine_compare', operator: '<' } },
      { id: 'ps-shape', type: 'pineScript', position: { x: 850, y: 130 }, data: { label: 'plotshape', pineType: 'pine_plotshape', plotColor: '#4CAF50' } },
      { id: 'ps-alert', type: 'pineScript', position: { x: 850, y: 260 }, data: { label: 'alertcondition', pineType: 'pine_alertcondition', alertMessage: 'RSI oversold — potential buy signal!' } },
      { id: 'ps-bgcolor', type: 'pineScript', position: { x: 850, y: 380 }, data: { label: 'bgcolor', pineType: 'pine_bgcolor', plotColor: '#4CAF50' } },
    ],
    edges: [
      { id: 'pe1', source: 'ps-close', target: 'ps-rsi' },
      { id: 'pe2', source: 'ps-rsi', target: 'ps-cmp' },
      { id: 'pe3', source: 'ps-cmp', target: 'ps-shape' },
      { id: 'pe4', source: 'ps-cmp', target: 'ps-alert' },
      { id: 'pe5', source: 'ps-cmp', target: 'ps-bgcolor' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ADDITIONAL STRATEGY TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

const ADDITIONAL_STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'vwap-intraday',
    name: 'VWAP Intraday',
    description: 'Buy when price crosses above VWAP, sell when it drops below. A favorite of institutional day traders.',
    category: 'scalping',
    difficulty: 'intermediate',
    indicators: ['VWAP'],
    featured: true,
    nodes: [
      { id: 'vwap', type: 'indicator', position: { x: 100, y: 150 }, data: { label: 'VWAP', indicatorType: 'vwap', timeframe: '5' } },
      { id: 'price', type: 'environment', position: { x: 100, y: 280 }, data: { label: 'Price', environmentType: 'price', priceType: 'close' } },
      { id: 'cross-above', type: 'condition', position: { x: 350, y: 130 }, data: { label: 'Price Crosses Above VWAP', conditionType: 'crossover' } },
      { id: 'cross-below', type: 'condition', position: { x: 350, y: 280 }, data: { label: 'Price Crosses Below VWAP', conditionType: 'crossunder' } },
      { id: 'buy', type: 'action', position: { x: 600, y: 130 }, data: { label: 'Buy', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' } },
      { id: 'sell', type: 'action', position: { x: 600, y: 280 }, data: { label: 'Sell', actionType: 'order', direction: 'short', size: 10, sizeType: 'percent' } },
    ],
    edges: [
      { id: 'e1', source: 'price', sourceHandle: 'output', target: 'cross-above', targetHandle: 'input-a' },
      { id: 'e2', source: 'vwap', sourceHandle: 'output', target: 'cross-above', targetHandle: 'input-b' },
      { id: 'e3', source: 'price', sourceHandle: 'output', target: 'cross-below', targetHandle: 'input-a' },
      { id: 'e4', source: 'vwap', sourceHandle: 'output', target: 'cross-below', targetHandle: 'input-b' },
      { id: 'e5', source: 'cross-above', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
      { id: 'e6', source: 'cross-below', sourceHandle: 'output', target: 'sell', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'scalping-momentum',
    name: 'Scalping Momentum',
    description: 'Fast EMA crossover with RSI filter for quick momentum trades on short timeframes.',
    category: 'scalping',
    difficulty: 'advanced',
    indicators: ['EMA (5)', 'EMA (13)', 'RSI'],
    nodes: [
      { id: 'ema-5', type: 'indicator', position: { x: 100, y: 80 }, data: { label: 'EMA 5', indicatorType: 'ema', timeframe: '1', params: { period: 5 } } },
      { id: 'ema-13', type: 'indicator', position: { x: 100, y: 200 }, data: { label: 'EMA 13', indicatorType: 'ema', timeframe: '1', params: { period: 13 } } },
      { id: 'rsi', type: 'indicator', position: { x: 100, y: 320 }, data: { label: 'RSI (7)', indicatorType: 'rsi', timeframe: '1', params: { period: 7 } } },
      { id: 'const-50', type: 'math', position: { x: 100, y: 440 }, data: { label: '50', mathType: 'number', value: 50 } },
      { id: 'crossover', type: 'condition', position: { x: 350, y: 140 }, data: { label: 'EMA 5 > EMA 13', conditionType: 'crossover' } },
      { id: 'rsi-filter', type: 'condition', position: { x: 350, y: 370 }, data: { label: 'RSI > 50', conditionType: 'compare', operator: '>' } },
      { id: 'and', type: 'condition', position: { x: 560, y: 250 }, data: { label: 'AND', conditionType: 'and' } },
      { id: 'buy', type: 'action', position: { x: 760, y: 250 }, data: { label: 'Buy', actionType: 'order', direction: 'long', size: 5, sizeType: 'percent' } },
    ],
    edges: [
      { id: 'e1', source: 'ema-5', sourceHandle: 'output', target: 'crossover', targetHandle: 'input-a' },
      { id: 'e2', source: 'ema-13', sourceHandle: 'output', target: 'crossover', targetHandle: 'input-b' },
      { id: 'e3', source: 'rsi', sourceHandle: 'output', target: 'rsi-filter', targetHandle: 'input-a' },
      { id: 'e4', source: 'const-50', sourceHandle: 'output', target: 'rsi-filter', targetHandle: 'input-b' },
      { id: 'e5', source: 'crossover', sourceHandle: 'output', target: 'and', targetHandle: 'input-a' },
      { id: 'e6', source: 'rsi-filter', sourceHandle: 'output', target: 'and', targetHandle: 'input-b' },
      { id: 'e7', source: 'and', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'ichimoku-cloud',
    name: 'Ichimoku Cloud',
    description: 'Full Ichimoku system — buy when price is above the cloud and Tenkan crosses above Kijun.',
    category: 'trend',
    difficulty: 'advanced',
    indicators: ['Ichimoku'],
    nodes: [
      { id: 'ichi', type: 'indicator', position: { x: 100, y: 150 }, data: { label: 'Ichimoku', indicatorType: 'ichimoku', timeframe: '1D', params: { tenkan: 9, kijun: 26, senkou: 52 } } },
      { id: 'price', type: 'environment', position: { x: 100, y: 300 }, data: { label: 'Price', environmentType: 'price', priceType: 'close' } },
      { id: 'above-cloud', type: 'condition', position: { x: 380, y: 180 }, data: { label: 'Price > Cloud', conditionType: 'compare', operator: '>' } },
      { id: 'tenkan-cross', type: 'condition', position: { x: 380, y: 320 }, data: { label: 'TK Cross', conditionType: 'crossover' } },
      { id: 'and', type: 'condition', position: { x: 600, y: 250 }, data: { label: 'AND', conditionType: 'and' } },
      { id: 'buy', type: 'action', position: { x: 800, y: 250 }, data: { label: 'Buy', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' } },
    ],
    edges: [
      { id: 'e1', source: 'price', sourceHandle: 'output', target: 'above-cloud', targetHandle: 'input-a' },
      { id: 'e2', source: 'ichi', sourceHandle: 'output', target: 'above-cloud', targetHandle: 'input-b' },
      { id: 'e3', source: 'ichi', sourceHandle: 'output', target: 'tenkan-cross', targetHandle: 'input-a' },
      { id: 'e4', source: 'above-cloud', sourceHandle: 'output', target: 'and', targetHandle: 'input-a' },
      { id: 'e5', source: 'tenkan-cross', sourceHandle: 'output', target: 'and', targetHandle: 'input-b' },
      { id: 'e6', source: 'and', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'dca-bot',
    name: 'DCA Bot',
    description: 'Dollar-Cost Averaging strategy. Buys a fixed amount on a regular schedule regardless of price.',
    category: 'portfolio',
    difficulty: 'beginner',
    indicators: [],
    featured: true,
    nodes: [
      { id: 'schedule', type: 'trigger', position: { x: 100, y: 150 }, data: { label: 'Weekly Buy', triggerType: 'cronTrigger', cronExpression: '0 0 * * 1' } },
      { id: 'buy', type: 'action', position: { x: 380, y: 150 }, data: { label: 'Buy $100', actionType: 'order', direction: 'long', size: 100, sizeType: 'fixed' } },
    ],
    edges: [
      { id: 'e1', source: 'schedule', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'grid-trading',
    name: 'Grid Trading',
    description: 'Places buy and sell orders at predefined price levels, profiting from range-bound markets.',
    category: 'trading',
    difficulty: 'advanced',
    indicators: ['ATR'],
    nodes: [
      { id: 'atr', type: 'indicator', position: { x: 100, y: 150 }, data: { label: 'ATR (14)', indicatorType: 'atr', timeframe: '60', params: { period: 14 } } },
      { id: 'price', type: 'environment', position: { x: 100, y: 280 }, data: { label: 'Price', environmentType: 'price', priceType: 'mid' } },
      { id: 'grid-low', type: 'math', position: { x: 350, y: 100 }, data: { label: 'Grid Low', mathType: 'subtract' } },
      { id: 'grid-high', type: 'math', position: { x: 350, y: 250 }, data: { label: 'Grid High', mathType: 'add' } },
      { id: 'hit-low', type: 'condition', position: { x: 560, y: 100 }, data: { label: 'Hit Low Grid', conditionType: 'compare', operator: '<' } },
      { id: 'hit-high', type: 'condition', position: { x: 560, y: 250 }, data: { label: 'Hit High Grid', conditionType: 'compare', operator: '>' } },
      { id: 'buy', type: 'action', position: { x: 780, y: 100 }, data: { label: 'Grid Buy', actionType: 'order', direction: 'long', size: 5, sizeType: 'percent' } },
      { id: 'sell', type: 'action', position: { x: 780, y: 250 }, data: { label: 'Grid Sell', actionType: 'order', direction: 'short', size: 5, sizeType: 'percent' } },
    ],
    edges: [
      { id: 'e1', source: 'price', sourceHandle: 'output', target: 'grid-low', targetHandle: 'input-a' },
      { id: 'e2', source: 'atr', sourceHandle: 'output', target: 'grid-low', targetHandle: 'input-b' },
      { id: 'e3', source: 'price', sourceHandle: 'output', target: 'grid-high', targetHandle: 'input-a' },
      { id: 'e4', source: 'atr', sourceHandle: 'output', target: 'grid-high', targetHandle: 'input-b' },
      { id: 'e5', source: 'price', sourceHandle: 'output', target: 'hit-low', targetHandle: 'input-a' },
      { id: 'e6', source: 'grid-low', sourceHandle: 'output', target: 'hit-low', targetHandle: 'input-b' },
      { id: 'e7', source: 'price', sourceHandle: 'output', target: 'hit-high', targetHandle: 'input-a' },
      { id: 'e8', source: 'grid-high', sourceHandle: 'output', target: 'hit-high', targetHandle: 'input-b' },
      { id: 'e9', source: 'hit-low', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
      { id: 'e10', source: 'hit-high', sourceHandle: 'output', target: 'sell', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'rsi-bb-confluence',
    name: 'RSI + Bollinger Confluence',
    description: 'Mean reversion using RSI oversold + price touching lower Bollinger Band for high-confidence entries.',
    category: 'mean-reversion',
    difficulty: 'intermediate',
    indicators: ['RSI', 'Bollinger Bands'],
    nodes: [
      { id: 'rsi', type: 'indicator', position: { x: 100, y: 80 }, data: { label: 'RSI (14)', indicatorType: 'rsi', timeframe: '60', params: { period: 14 } } },
      { id: 'bb', type: 'indicator', position: { x: 100, y: 200 }, data: { label: 'BB (20)', indicatorType: 'bb', timeframe: '60', params: { period: 20, stdDev: 2 } } },
      { id: 'price', type: 'environment', position: { x: 100, y: 340 }, data: { label: 'Price', environmentType: 'price', priceType: 'close' } },
      { id: 'const-30', type: 'math', position: { x: 100, y: 450 }, data: { label: '30', mathType: 'number', value: 30 } },
      { id: 'rsi-low', type: 'condition', position: { x: 370, y: 100 }, data: { label: 'RSI < 30', conditionType: 'compare', operator: '<' } },
      { id: 'bb-touch', type: 'condition', position: { x: 370, y: 270 }, data: { label: 'Price < Lower BB', conditionType: 'compare', operator: '<' } },
      { id: 'and', type: 'condition', position: { x: 600, y: 180 }, data: { label: 'AND', conditionType: 'and' } },
      { id: 'buy', type: 'action', position: { x: 800, y: 180 }, data: { label: 'Buy', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' } },
    ],
    edges: [
      { id: 'e1', source: 'rsi', sourceHandle: 'output', target: 'rsi-low', targetHandle: 'input-a' },
      { id: 'e2', source: 'const-30', sourceHandle: 'output', target: 'rsi-low', targetHandle: 'input-b' },
      { id: 'e3', source: 'price', sourceHandle: 'output', target: 'bb-touch', targetHandle: 'input-a' },
      { id: 'e4', source: 'bb', sourceHandle: 'lower', target: 'bb-touch', targetHandle: 'input-b' },
      { id: 'e5', source: 'rsi-low', sourceHandle: 'output', target: 'and', targetHandle: 'input-a' },
      { id: 'e6', source: 'bb-touch', sourceHandle: 'output', target: 'and', targetHandle: 'input-b' },
      { id: 'e7', source: 'and', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'stochastic-divergence',
    name: 'Stochastic Divergence',
    description: 'Spot potential reversals when price makes new lows but Stochastic makes higher lows.',
    category: 'momentum',
    difficulty: 'intermediate',
    indicators: ['Stochastic'],
    nodes: [
      { id: 'stoch', type: 'indicator', position: { x: 100, y: 150 }, data: { label: 'Stochastic', indicatorType: 'stochastic', timeframe: '60', params: { kPeriod: 14, dPeriod: 3 } } },
      { id: 'const-20', type: 'math', position: { x: 100, y: 280 }, data: { label: '20', mathType: 'number', value: 20 } },
      { id: 'oversold', type: 'condition', position: { x: 370, y: 180 }, data: { label: 'Stoch < 20', conditionType: 'compare', operator: '<' } },
      { id: 'crossover', type: 'condition', position: { x: 370, y: 310 }, data: { label: 'K crosses D', conditionType: 'crossover' } },
      { id: 'and', type: 'condition', position: { x: 580, y: 240 }, data: { label: 'AND', conditionType: 'and' } },
      { id: 'buy', type: 'action', position: { x: 780, y: 240 }, data: { label: 'Buy', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' } },
    ],
    edges: [
      { id: 'e1', source: 'stoch', sourceHandle: 'output', target: 'oversold', targetHandle: 'input-a' },
      { id: 'e2', source: 'const-20', sourceHandle: 'output', target: 'oversold', targetHandle: 'input-b' },
      { id: 'e3', source: 'stoch', sourceHandle: 'output', target: 'crossover', targetHandle: 'input-a' },
      { id: 'e4', source: 'oversold', sourceHandle: 'output', target: 'and', targetHandle: 'input-a' },
      { id: 'e5', source: 'crossover', sourceHandle: 'output', target: 'and', targetHandle: 'input-b' },
      { id: 'e6', source: 'and', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
    ],
  },
  {
    id: 'atr-volatility-breakout',
    name: 'ATR Volatility Breakout',
    description: 'Enter trades when price moves more than 2× ATR from the open, indicating a strong directional move.',
    category: 'breakout',
    difficulty: 'intermediate',
    indicators: ['ATR'],
    nodes: [
      { id: 'atr', type: 'indicator', position: { x: 100, y: 130 }, data: { label: 'ATR (14)', indicatorType: 'atr', timeframe: '60', params: { period: 14 } } },
      { id: 'mult', type: 'math', position: { x: 100, y: 260 }, data: { label: '×2', mathType: 'multiply', value: 2 } },
      { id: 'price', type: 'environment', position: { x: 100, y: 380 }, data: { label: 'Price Change', environmentType: 'price', priceType: 'close' } },
      { id: 'range', type: 'math', position: { x: 350, y: 190 }, data: { label: 'ATR × 2', mathType: 'multiply' } },
      { id: 'compare', type: 'condition', position: { x: 570, y: 260 }, data: { label: 'Move > 2×ATR', conditionType: 'compare', operator: '>' } },
      { id: 'buy', type: 'action', position: { x: 790, y: 260 }, data: { label: 'Buy Breakout', actionType: 'order', direction: 'long', size: 8, sizeType: 'percent' } },
    ],
    edges: [
      { id: 'e1', source: 'atr', sourceHandle: 'output', target: 'range', targetHandle: 'input-a' },
      { id: 'e2', source: 'mult', sourceHandle: 'output', target: 'range', targetHandle: 'input-b' },
      { id: 'e3', source: 'price', sourceHandle: 'output', target: 'compare', targetHandle: 'input-a' },
      { id: 'e4', source: 'range', sourceHandle: 'output', target: 'compare', targetHandle: 'input-b' },
      { id: 'e5', source: 'compare', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
    ],
  },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  trend: <TrendingUp className="w-4 h-4" />,
  momentum: <Zap className="w-4 h-4" />,
  'mean-reversion': <Shield className="w-4 h-4" />,
  breakout: <TrendingUp className="w-4 h-4" />,
  scalping: <Clock className="w-4 h-4" />,
  trading: <TrendingUp className="w-4 h-4" />,
  hedging: <Shield className="w-4 h-4" />,
  portfolio: <PieChart className="w-4 h-4" />,
  'risk-management': <ShieldAlert className="w-4 h-4" />,
  pinescript: <LineChart className="w-4 h-4" />,
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-500/20 text-green-400',
  intermediate: 'bg-yellow-500/20 text-yellow-400',
  advanced: 'bg-red-500/20 text-red-400',
};

export const TemplatesDialog = memo(({ open, onOpenChange }: TemplatesDialogProps) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { clearCanvas, pineScriptMode } = useStrategyFlowStore();

  // Combine all templates, filter by mode
  const allTemplates = useMemo(() => {
    if (pineScriptMode) {
      return PINE_SCRIPT_TEMPLATES;
    }
    return [...STRATEGY_TEMPLATES, ...ADDITIONAL_STRATEGY_TEMPLATES];
  }, [pineScriptMode]);

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter(t => {
      const matchesSearch = !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !selectedCategory || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory, allTemplates]);

  const handleLoadTemplate = (template: StrategyTemplate) => {
    const store = useStrategyFlowStore.getState();

    // Clear current canvas
    store.clearCanvas();

    // Create a mapping from template node IDs to new node IDs
    const nodeIdMap: Record<string, string> = {};
    const newNodes: StrategyFlowNode[] = [];

    // Create nodes with new IDs
    template.nodes.forEach(node => {
      const newId = `${node.type}-${Math.random().toString(36).substring(2, 8)}`;
      nodeIdMap[node.id] = newId;

      newNodes.push({
        ...node,
        id: newId,
      });
    });

    // Create edges with proper colors and remapped IDs
    const newEdges: StrategyFlowEdge[] = template.edges.map(edge => {
      const newSourceId = nodeIdMap[edge.source];
      const newTargetId = nodeIdMap[edge.target];

      // Find source node to determine edge color
      const sourceTemplateNode = template.nodes.find(n => n.id === edge.source);
      let edgeColor = EDGE_DATA_TYPE_COLORS.default;

      if (sourceTemplateNode) {
        const nodeType = sourceTemplateNode.type || '';
        const subType = (sourceTemplateNode.data as any)?.indicatorType ||
          (sourceTemplateNode.data as any)?.conditionType ||
          (sourceTemplateNode.data as any)?.actionType ||
          (sourceTemplateNode.data as any)?.environmentType ||
          (sourceTemplateNode.data as any)?.mathType;

        const handleConfigs = getHandleConfigs(nodeType, subType);

        // Find the specific source handle if specified, otherwise use first source handle
        const sourceHandleConfig = edge.sourceHandle
          ? handleConfigs.find(h => h.id === edge.sourceHandle && h.type === 'source')
          : handleConfigs.find(h => h.type === 'source');

        if (sourceHandleConfig?.dataType) {
          edgeColor = EDGE_DATA_TYPE_COLORS[sourceHandleConfig.dataType] || edgeColor;
        }
      }

      return {
        ...edge,
        id: `edge-${Math.random().toString(36).substring(2, 8)}`,
        source: newSourceId,
        target: newTargetId,
        type: 'bezier',
        animated: false,
        style: {
          stroke: edgeColor,
          strokeWidth: 2,
        },
      };
    });

    // Set nodes and edges directly via onNodesChange and onEdgesChange
    store.onNodesChange(newNodes.map(n => ({ type: 'add' as const, item: n })));
    store.onEdgesChange(newEdges.map(e => ({ type: 'add' as const, item: e })));

    store.setStrategyName(template.name);
    onOpenChange(false);
  };

  return (
    <WindowModal
      open={open}
      onOpenChange={onOpenChange}
      title={pineScriptMode ? 'Pine Script Templates' : 'Strategy Templates'}
      icon={pineScriptMode ? <LineChart className="w-5 h-5 text-[#2962FF]" /> : <Layers className="w-5 h-5 text-yellow-400" />}
      defaultWidth={900}
      defaultHeight={700}
      minWidth={600}
      minHeight={400}
    >
      <div className="p-4">
        <p className="text-sm text-muted-foreground mb-4">
          {pineScriptMode
            ? 'Choose a Pine Script template to start building TradingView scripts.'
            : 'Choose a pre-built strategy template to get started quickly.'}
        </p>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary border-border"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === null ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className="border-border"
          >
            All
          </Button>
          {(pineScriptMode
            ? ['pinescript']
            : [
              'trend',
              'momentum',
              'mean-reversion',
              'breakout',
              'scalping',
              'trading',
              'hedging',
              'portfolio',
              'risk-management',
            ]
          ).map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className="border-border capitalize"
            >
              {CATEGORY_ICONS[cat]}
              <span className="ml-1">{cat.replace('-', ' ')}</span>
            </Button>
          ))}
        </div>

        {/* Templates Grid */}
        <ScrollArea className="h-[400px] mt-4">
          <div className="grid grid-cols-1 gap-3 pr-4">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                className="p-4 bg-secondary rounded-lg border border-border hover:border-purple-500/50 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground">{template.name}</h3>
                      {template.featured && (
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={DIFFICULTY_COLORS[template.difficulty]}>
                        {template.difficulty}
                      </Badge>
                      <Badge variant="outline" className="border-border text-muted-foreground">
                        {template.indicators.length} indicators
                      </Badge>
                      <Badge variant="outline" className="border-border text-muted-foreground capitalize">
                        {template.category}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleLoadTemplate(template)}
                    className={pineScriptMode
                      ? 'bg-[#2962FF] hover:bg-[#2962FF]/80 opacity-0 group-hover:opacity-100 transition-opacity'
                      : 'bg-purple-600 hover:bg-purple-700 opacity-0 group-hover:opacity-100 transition-opacity'
                    }
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Load
                  </Button>
                </div>
              </div>
            ))}

            {filteredTemplates.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No templates match your search.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </WindowModal>
  );
});

TemplatesDialog.displayName = 'TemplatesDialog';
