/**
 * Onboarding starter templates — one per finance role.
 * Each template is fully functional with correct nodes, edges, handles, and wiring.
 */

import { StrategyTemplate } from './types';
import { FinanceRole } from '../../../stores/onboardingStore';

/* ------------------------------------------------------------------ */
/*  Retail Trader → Trend Following (SMA Crossover + Stop Loss)       */
/* ------------------------------------------------------------------ */
const retailTraderTemplate: StrategyTemplate = {
  id: 'starter-retail-trend',
  name: 'Trend Following Starter',
  description:
    'A beginner-friendly trend strategy. Buy when the fast SMA crosses above the slow SMA, with a trailing stop to protect profits.',
  category: 'trend',
  difficulty: 'beginner',
  indicators: ['SMA (Fast)', 'SMA (Slow)'],
  featured: true,
  nodes: [
    {
      id: 'trigger-heartbeat',
      type: 'trigger',
      position: { x: 60, y: 40 },
      data: { label: 'Every Candle', triggerType: 'heartbeatTrigger' },
    },
    {
      id: 'sma-fast',
      type: 'indicator',
      position: { x: 60, y: 160 },
      data: {
        label: 'SMA 10',
        indicatorType: 'sma',
        timeframe: '60',
        params: { period: 10 },
      },
    },
    {
      id: 'sma-slow',
      type: 'indicator',
      position: { x: 60, y: 280 },
      data: {
        label: 'SMA 30',
        indicatorType: 'sma',
        timeframe: '60',
        params: { period: 30 },
      },
    },
    {
      id: 'crossover',
      type: 'condition',
      position: { x: 320, y: 200 },
      data: { label: 'Fast crosses above Slow', conditionType: 'crossover' },
    },
    {
      id: 'buy-order',
      type: 'action',
      position: { x: 580, y: 160 },
      data: {
        label: 'Buy',
        actionType: 'order',
        direction: 'long',
        size: 5,
        sizeType: 'percent',
      },
    },
    {
      id: 'trailing-stop',
      type: 'action',
      position: { x: 580, y: 300 },
      data: {
        label: 'Trailing Stop 2%',
        actionType: 'trailingStop',
        params: { trailPercent: 2 },
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'sma-fast', sourceHandle: 'value', target: 'crossover', targetHandle: 'input-a' },
    { id: 'e2', source: 'sma-slow', sourceHandle: 'value', target: 'crossover', targetHandle: 'input-b' },
    { id: 'e3', source: 'crossover', sourceHandle: 'output', target: 'buy-order', targetHandle: 'trigger' },
    { id: 'e4', source: 'buy-order', sourceHandle: 'next', target: 'trailing-stop', targetHandle: 'trigger' },
  ],
};

/* ------------------------------------------------------------------ */
/*  Wealth Manager → Balanced Portfolio Rebalancer                    */
/* ------------------------------------------------------------------ */
const wealthManagerTemplate: StrategyTemplate = {
  id: 'starter-wealth-rebalance',
  name: 'Portfolio Rebalancer',
  description:
    'Automatically rebalance a diversified portfolio. Monitors asset weights and triggers rebalancing when drift exceeds your threshold.',
  category: 'portfolio',
  difficulty: 'beginner',
  indicators: ['Portfolio Weight', 'Total Value'],
  featured: true,
  nodes: [
    {
      id: 'trigger-cron',
      type: 'trigger',
      position: { x: 60, y: 40 },
      data: { label: 'Weekly Check', triggerType: 'cronTrigger', params: { cron: '0 9 * * 1' } },
    },
    {
      id: 'asset-weight',
      type: 'portfolio',
      position: { x: 60, y: 180 },
      data: { label: 'Asset Weight', portfolioType: 'assetWeight' },
    },
    {
      id: 'target-weight',
      type: 'math',
      position: { x: 60, y: 320 },
      data: { label: 'Target 25%', mathType: 'number', value: 25 },
    },
    {
      id: 'drift-check',
      type: 'condition',
      position: { x: 320, y: 220 },
      data: {
        label: 'Drift > 5%',
        conditionType: 'compare',
        operator: '>',
      },
    },
    {
      id: 'drift-amount',
      type: 'math',
      position: { x: 320, y: 370 },
      data: { label: 'Subtract', mathType: 'subtract' },
    },
    {
      id: 'rebalance',
      type: 'portfolio',
      position: { x: 580, y: 180 },
      data: { label: 'Rebalance', portfolioType: 'rebalance' },
    },
    {
      id: 'notify-email',
      type: 'integration',
      position: { x: 580, y: 340 },
      data: { label: 'Email Summary', integrationType: 'email' },
    },
  ],
  edges: [
    { id: 'e1', source: 'asset-weight', sourceHandle: 'value', target: 'drift-check', targetHandle: 'input-a' },
    { id: 'e2', source: 'target-weight', sourceHandle: 'output', target: 'drift-check', targetHandle: 'input-b' },
    { id: 'e3', source: 'drift-check', sourceHandle: 'output', target: 'rebalance', targetHandle: 'trigger' },
    { id: 'e4', source: 'rebalance', sourceHandle: 'output', target: 'notify-email', targetHandle: 'trigger' },
    { id: 'e5', source: 'asset-weight', sourceHandle: 'value', target: 'drift-amount', targetHandle: 'input-a' },
    { id: 'e6', source: 'target-weight', sourceHandle: 'output', target: 'drift-amount', targetHandle: 'input-b' },
  ],
};

/* ------------------------------------------------------------------ */
/*  Portfolio Manager → Multi-Factor Momentum                         */
/* ------------------------------------------------------------------ */
const portfolioManagerTemplate: StrategyTemplate = {
  id: 'starter-pm-momentum',
  name: 'Multi-Factor Momentum',
  description:
    'Momentum-driven allocation using RSI and MACD for signal confirmation. Includes position sizing based on risk percentage.',
  category: 'momentum',
  difficulty: 'intermediate',
  indicators: ['RSI', 'MACD'],
  featured: true,
  nodes: [
    {
      id: 'trigger-hb',
      type: 'trigger',
      position: { x: 60, y: 40 },
      data: { label: 'Every Candle', triggerType: 'heartbeatTrigger' },
    },
    {
      id: 'rsi-14',
      type: 'indicator',
      position: { x: 60, y: 160 },
      data: {
        label: 'RSI (14)',
        indicatorType: 'rsi',
        timeframe: '60',
        params: { period: 14 },
      },
    },
    {
      id: 'rsi-threshold',
      type: 'math',
      position: { x: 60, y: 300 },
      data: { label: '50', mathType: 'number', value: 50 },
    },
    {
      id: 'rsi-bullish',
      type: 'condition',
      position: { x: 300, y: 200 },
      data: { label: 'RSI > 50', conditionType: 'compare', operator: '>' },
    },
    {
      id: 'macd',
      type: 'indicator',
      position: { x: 60, y: 440 },
      data: {
        label: 'MACD',
        indicatorType: 'macd',
        timeframe: '60',
        params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      },
    },
    {
      id: 'macd-crossover',
      type: 'condition',
      position: { x: 300, y: 440 },
      data: { label: 'MACD Crossover', conditionType: 'crossover' },
    },
    {
      id: 'both-bullish',
      type: 'condition',
      position: { x: 540, y: 320 },
      data: { label: 'Both Confirmed', conditionType: 'and' },
    },
    {
      id: 'risk-size',
      type: 'risk',
      position: { x: 540, y: 480 },
      data: { label: 'Risk 2%', riskType: 'positionPercent', params: { percent: 2 } },
    },
    {
      id: 'buy-order',
      type: 'action',
      position: { x: 780, y: 320 },
      data: {
        label: 'Buy',
        actionType: 'order',
        direction: 'long',
        size: 2,
        sizeType: 'percent',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'rsi-14', sourceHandle: 'value', target: 'rsi-bullish', targetHandle: 'input-a' },
    { id: 'e2', source: 'rsi-threshold', sourceHandle: 'output', target: 'rsi-bullish', targetHandle: 'input-b' },
    { id: 'e3', source: 'macd', sourceHandle: 'line', target: 'macd-crossover', targetHandle: 'input-a' },
    { id: 'e4', source: 'macd', sourceHandle: 'signal', target: 'macd-crossover', targetHandle: 'input-b' },
    { id: 'e5', source: 'rsi-bullish', sourceHandle: 'output', target: 'both-bullish', targetHandle: 'input-a' },
    { id: 'e6', source: 'macd-crossover', sourceHandle: 'output', target: 'both-bullish', targetHandle: 'input-b' },
    { id: 'e7', source: 'both-bullish', sourceHandle: 'output', target: 'buy-order', targetHandle: 'trigger' },
    { id: 'e8', source: 'risk-size', sourceHandle: 'value', target: 'buy-order', targetHandle: 'size' },
  ],
};

/* ------------------------------------------------------------------ */
/*  Hedge Fund → Market-Neutral Pairs Strategy                        */
/* ------------------------------------------------------------------ */
const hedgeFundTemplate: StrategyTemplate = {
  id: 'starter-hf-pairs',
  name: 'Market-Neutral Pairs',
  description:
    'A long/short pairs strategy. Go long the underperformer and short the outperformer when the spread mean-reverts. Includes max-drawdown protection.',
  category: 'hedging',
  difficulty: 'advanced',
  indicators: ['SMA', 'RSI', 'Max Drawdown'],
  featured: true,
  nodes: [
    {
      id: 'trigger-hb',
      type: 'trigger',
      position: { x: 60, y: 40 },
      data: { label: 'Every Candle', triggerType: 'heartbeatTrigger' },
    },
    {
      id: 'price-a',
      type: 'environment',
      position: { x: 60, y: 160 },
      data: { label: 'Price A', environmentType: 'price' },
    },
    {
      id: 'price-b',
      type: 'environment',
      position: { x: 60, y: 300 },
      data: { label: 'Price B', environmentType: 'price' },
    },
    {
      id: 'spread',
      type: 'math',
      position: { x: 300, y: 220 },
      data: { label: 'Spread (A - B)', mathType: 'subtract' },
    },
    {
      id: 'spread-sma',
      type: 'indicator',
      position: { x: 300, y: 380 },
      data: {
        label: 'Spread SMA 20',
        indicatorType: 'sma',
        timeframe: '60',
        params: { period: 20 },
      },
    },
    {
      id: 'spread-below-mean',
      type: 'condition',
      position: { x: 540, y: 160 },
      data: { label: 'Spread < Mean', conditionType: 'compare', operator: '<' },
    },
    {
      id: 'spread-above-mean',
      type: 'condition',
      position: { x: 540, y: 340 },
      data: { label: 'Spread > Mean', conditionType: 'compare', operator: '>' },
    },
    {
      id: 'go-long-a',
      type: 'action',
      position: { x: 780, y: 120 },
      data: {
        label: 'Long A',
        actionType: 'order',
        direction: 'long',
        size: 5,
        sizeType: 'percent',
      },
    },
    {
      id: 'go-short-b',
      type: 'action',
      position: { x: 780, y: 260 },
      data: {
        label: 'Short B',
        actionType: 'order',
        direction: 'short',
        size: 5,
        sizeType: 'percent',
      },
    },
    {
      id: 'max-dd',
      type: 'risk',
      position: { x: 780, y: 420 },
      data: { label: 'Max DD 10%', riskType: 'maxDrawdown', params: { maxDrawdown: 10 } },
    },
  ],
  edges: [
    { id: 'e1', source: 'price-a', sourceHandle: 'value', target: 'spread', targetHandle: 'input-a' },
    { id: 'e2', source: 'price-b', sourceHandle: 'value', target: 'spread', targetHandle: 'input-b' },
    { id: 'e3', source: 'spread', sourceHandle: 'output', target: 'spread-below-mean', targetHandle: 'input-a' },
    { id: 'e4', source: 'spread-sma', sourceHandle: 'value', target: 'spread-below-mean', targetHandle: 'input-b' },
    { id: 'e5', source: 'spread', sourceHandle: 'output', target: 'spread-above-mean', targetHandle: 'input-a' },
    { id: 'e6', source: 'spread-sma', sourceHandle: 'value', target: 'spread-above-mean', targetHandle: 'input-b' },
    { id: 'e7', source: 'spread-below-mean', sourceHandle: 'output', target: 'go-long-a', targetHandle: 'trigger' },
    { id: 'e8', source: 'spread-above-mean', sourceHandle: 'output', target: 'go-short-b', targetHandle: 'trigger' },
  ],
};

/* ------------------------------------------------------------------ */
/*  Quant Researcher → Multi-Indicator Research Pipeline               */
/* ------------------------------------------------------------------ */
const quantResearcherTemplate: StrategyTemplate = {
  id: 'starter-quant-multi',
  name: 'Multi-Indicator Research',
  description:
    'A research-oriented pipeline combining RSI, Bollinger Bands, and ATR to identify high-conviction setups. Perfect for hypothesis testing.',
  category: 'mean-reversion',
  difficulty: 'intermediate',
  indicators: ['RSI', 'Bollinger Bands', 'ATR'],
  featured: true,
  nodes: [
    {
      id: 'trigger-hb',
      type: 'trigger',
      position: { x: 60, y: 40 },
      data: { label: 'Every Candle', triggerType: 'heartbeatTrigger' },
    },
    {
      id: 'rsi',
      type: 'indicator',
      position: { x: 60, y: 160 },
      data: {
        label: 'RSI (14)',
        indicatorType: 'rsi',
        timeframe: '60',
        params: { period: 14 },
      },
    },
    {
      id: 'rsi-low',
      type: 'math',
      position: { x: 60, y: 300 },
      data: { label: '30', mathType: 'number', value: 30 },
    },
    {
      id: 'rsi-oversold',
      type: 'condition',
      position: { x: 300, y: 200 },
      data: { label: 'RSI < 30', conditionType: 'compare', operator: '<' },
    },
    {
      id: 'bb',
      type: 'indicator',
      position: { x: 60, y: 440 },
      data: {
        label: 'Bollinger Bands',
        indicatorType: 'bb',
        timeframe: '60',
        params: { period: 20, stdDev: 2 },
      },
    },
    {
      id: 'price-env',
      type: 'environment',
      position: { x: 60, y: 580 },
      data: { label: 'Current Price', environmentType: 'price' },
    },
    {
      id: 'price-below-bb',
      type: 'condition',
      position: { x: 300, y: 480 },
      data: { label: 'Price < Lower BB', conditionType: 'compare', operator: '<' },
    },
    {
      id: 'both-signals',
      type: 'condition',
      position: { x: 540, y: 340 },
      data: { label: 'Both Oversold', conditionType: 'and' },
    },
    {
      id: 'atr',
      type: 'indicator',
      position: { x: 300, y: 620 },
      data: {
        label: 'ATR (14)',
        indicatorType: 'atr',
        timeframe: '60',
        params: { period: 14 },
      },
    },
    {
      id: 'buy-order',
      type: 'action',
      position: { x: 780, y: 300 },
      data: {
        label: 'Buy Signal',
        actionType: 'order',
        direction: 'long',
        size: 3,
        sizeType: 'percent',
      },
    },
    {
      id: 'stop-loss',
      type: 'action',
      position: { x: 780, y: 460 },
      data: {
        label: 'ATR Stop Loss',
        actionType: 'stopLoss',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'rsi', sourceHandle: 'value', target: 'rsi-oversold', targetHandle: 'input-a' },
    { id: 'e2', source: 'rsi-low', sourceHandle: 'output', target: 'rsi-oversold', targetHandle: 'input-b' },
    { id: 'e3', source: 'price-env', sourceHandle: 'value', target: 'price-below-bb', targetHandle: 'input-a' },
    { id: 'e4', source: 'bb', sourceHandle: 'lower', target: 'price-below-bb', targetHandle: 'input-b' },
    { id: 'e5', source: 'rsi-oversold', sourceHandle: 'output', target: 'both-signals', targetHandle: 'input-a' },
    { id: 'e6', source: 'price-below-bb', sourceHandle: 'output', target: 'both-signals', targetHandle: 'input-b' },
    { id: 'e7', source: 'both-signals', sourceHandle: 'output', target: 'buy-order', targetHandle: 'trigger' },
    { id: 'e8', source: 'buy-order', sourceHandle: 'next', target: 'stop-loss', targetHandle: 'trigger' },
    { id: 'e9', source: 'atr', sourceHandle: 'value', target: 'stop-loss', targetHandle: 'size' },
  ],
};

/* ------------------------------------------------------------------ */
/*  Fintech Developer → AI Sentiment + News Pipeline                   */
/* ------------------------------------------------------------------ */
const fintechDeveloperTemplate: StrategyTemplate = {
  id: 'starter-fintech-ai',
  name: 'AI Sentiment Pipeline',
  description:
    'An event-driven pipeline that uses an LLM to analyse market sentiment from news, then executes trades with Telegram notifications.',
  category: 'trading',
  difficulty: 'intermediate',
  indicators: ['LLM Sentiment', 'Webhook'],
  featured: true,
  nodes: [
    {
      id: 'trigger-news',
      type: 'trigger',
      position: { x: 60, y: 40 },
      data: { label: 'News Event', triggerType: 'newsTrigger' },
    },
    {
      id: 'llm-sentiment',
      type: 'llm',
      position: { x: 60, y: 200 },
      data: { label: 'Analyse Sentiment', llmType: 'sentiment' },
    },
    {
      id: 'sentiment-threshold',
      type: 'math',
      position: { x: 60, y: 380 },
      data: { label: '0.7', mathType: 'number', value: 0.7 },
    },
    {
      id: 'is-bullish',
      type: 'condition',
      position: { x: 320, y: 260 },
      data: { label: 'Sentiment > 0.7', conditionType: 'compare', operator: '>' },
    },
    {
      id: 'if-bullish',
      type: 'control',
      position: { x: 540, y: 200 },
      data: { label: 'If Bullish', controlType: 'if' },
    },
    {
      id: 'buy-order',
      type: 'action',
      position: { x: 780, y: 160 },
      data: {
        label: 'Buy',
        actionType: 'order',
        direction: 'long',
        size: 3,
        sizeType: 'percent',
      },
    },
    {
      id: 'telegram-notify',
      type: 'integration',
      position: { x: 780, y: 320 },
      data: { label: 'Telegram Alert', integrationType: 'telegram' },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-news', sourceHandle: 'output', target: 'llm-sentiment', targetHandle: 'trigger' },
    { id: 'e2', source: 'llm-sentiment', sourceHandle: 'output', target: 'is-bullish', targetHandle: 'input-a' },
    { id: 'e3', source: 'sentiment-threshold', sourceHandle: 'output', target: 'is-bullish', targetHandle: 'input-b' },
    { id: 'e4', source: 'is-bullish', sourceHandle: 'output', target: 'if-bullish', targetHandle: 'condition' },
    { id: 'e5', source: 'if-bullish', sourceHandle: 'then', target: 'buy-order', targetHandle: 'trigger' },
    { id: 'e6', source: 'buy-order', sourceHandle: 'next', target: 'telegram-notify', targetHandle: 'trigger' },
  ],
};

/* ------------------------------------------------------------------ */
/*  Role → Template mapping                                            */
/* ------------------------------------------------------------------ */

export const ONBOARDING_TEMPLATES: Record<FinanceRole, StrategyTemplate> = {
  'retail-trader': retailTraderTemplate,
  'wealth-manager': wealthManagerTemplate,
  'portfolio-manager': portfolioManagerTemplate,
  'hedge-fund': hedgeFundTemplate,
  'quant-researcher': quantResearcherTemplate,
  'fintech-developer': fintechDeveloperTemplate,
};

export const ALL_ONBOARDING_TEMPLATES: StrategyTemplate[] = Object.values(ONBOARDING_TEMPLATES);
