/**
 * Agentic Strategy Templates — AI-powered autonomous trading strategies
 * that combine multiple AI agents, technical analysis, research tools,
 * and user notification for comprehensive market monitoring.
 *
 * These templates replicate what a full wealth management team does:
 *   - Analysts scanning news, filings, social media 24/7
 *   - Technical traders running chart analysis
 *   - Risk managers monitoring drawdowns and exposure
 *   - Research desk running quantitative models
 *   - Portfolio managers synthesizing all views and executing
 *   - Client relations calling you when something matters
 */

import { StrategyTemplate } from './types';

export const AGENTIC_STRATEGY_TEMPLATES: StrategyTemplate[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE 1: AI Agent Strategy (Single Stock — AAPL default)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'ai-agent-apple-monitor',
    name: 'AI Agent Strategy (AAPL)',
    description:
      'Autonomous AI agent strategy for Apple stock. News, Social (Trump/political), Fundamentals, Technical, and Research agents feed a Synthesis engine. RSI/MACD/EMA algo confirmation, risk management, phone/telegram alerts. Change symbol in each agent\'s settings.',
    category: 'agentic',
    difficulty: 'advanced',
    indicators: ['News Agent', 'Social Monitor', 'Fundamentals', 'Technical Agent', 'Research', 'RSI', 'MACD', 'EMA'],
    featured: true,
    nodes: [
      // ── Trigger ───────────────────────────────────────────────────────
      {
        id: 'start',
        type: 'trigger',
        position: { x: 0, y: 400 },
        data: {
          label: 'Every 30 min + Market Open/Close',
          triggerType: 'heartbeatTrigger',
          intervalMinutes: 30,
          atMarketOpen: true,
          atMarketClose: true,
          specificTime: null,
        },
      },

      // ── Data Collection Agents ────────────────────────────────────────
      {
        id: 'news',
        type: 'agent',
        position: { x: 300, y: 0 },
        data: {
          label: 'News Analyst',
          agentNodeType: 'newsAgentNode',
          agentType: 'news_analyst',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.4,
          newsSources: ['newsapi', 'sec', 'finnhub'],
          newsKeywords: ['Apple', 'iPhone', 'Tim Cook', 'supply chain'],
          newsMaxAge: 12,
        },
      },
      {
        id: 'social',
        type: 'agent',
        position: { x: 300, y: 160 },
        data: {
          label: 'Social & Political',
          agentNodeType: 'socialAgentNode',
          agentType: 'social_monitor',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.5,
          socialPlatforms: ['twitter', 'truthsocial', 'reddit'],
          socialAccounts: ['@realDonaldTrump', '@POTUS', '@elonmusk'],
          socialKeywords: ['Apple', 'tariff', 'China trade', '$AAPL'],
        },
      },
      {
        id: 'fundamentals',
        type: 'agent',
        position: { x: 300, y: 320 },
        data: {
          label: 'Fundamentals & Earnings',
          agentNodeType: 'fundamentalsAgentNode',
          agentType: 'fundamentals_analyst',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.5,
          reportTypes: ['10-K', '10-Q', 'earnings', 'guidance'],
          analystSources: ['wallstreet', 'institutional', 'insider'],
          lookbackQuarters: 4,
        },
      },
      {
        id: 'techagent',
        type: 'agent',
        position: { x: 300, y: 480 },
        data: {
          label: 'AI Technical Analyst',
          agentNodeType: 'technicalAgentNode',
          agentType: 'technical_analyst',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.5,
          technicalTimeframes: ['1H', '4H', '1D'],
          technicalIndicators: ['rsi', 'macd', 'bollinger', 'volume', 'support_resistance'],
        },
      },
      {
        id: 'research',
        type: 'agent',
        position: { x: 300, y: 640 },
        data: {
          label: 'Research & Risk',
          agentNodeType: 'researchAgentNode',
          agentType: 'research_analyst',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.5,
          researchTools: ['quantstats', 'var', 'stress_test', 'montecarlo'],
          researchDepth: 'standard',
        },
      },

      // ── Sentiment + Synthesis ─────────────────────────────────────────
      {
        id: 'sentiment',
        type: 'agent',
        position: { x: 650, y: 80 },
        data: {
          label: 'Sentiment Fusion',
          agentNodeType: 'sentimentAgentNode',
          agentType: 'sentiment_analyst',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.5,
        },
      },
      {
        id: 'synthesis',
        type: 'agent',
        position: { x: 650, y: 350 },
        data: {
          label: 'Master Synthesis',
          agentNodeType: 'synthesisAgentNode',
          agentType: 'synthesis',
          model: 'gemini-2.5-pro',
          symbols: ['AAPL'],
          confidenceThreshold: 0.6,
        },
      },

      // ── Algo indicators ───────────────────────────────────────────────
      {
        id: 'rsi',
        type: 'indicator',
        position: { x: 650, y: 560 },
        data: { label: 'RSI (14)', indicatorType: 'rsi', timeframe: '60', params: { period: 14 } },
      },
      {
        id: 'macd',
        type: 'indicator',
        position: { x: 650, y: 680 },
        data: { label: 'MACD', indicatorType: 'macd', timeframe: '60', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
      },
      {
        id: 'ema50',
        type: 'indicator',
        position: { x: 650, y: 800 },
        data: { label: 'EMA (50)', indicatorType: 'ema', timeframe: '1D', params: { period: 50 } },
      },
      {
        id: 'price',
        type: 'environment',
        position: { x: 650, y: 900 },
        data: { label: 'Close Price', environmentType: 'price', priceType: 'close' },
      },

      // ── Thresholds ────────────────────────────────────────────────────
      { id: 'c06', type: 'math', position: { x: 950, y: 200 }, data: { label: '0.6', mathType: 'number', value: 0.6 } },
      { id: 'c30', type: 'math', position: { x: 950, y: 560 }, data: { label: '30', mathType: 'number', value: 30 } },
      { id: 'c70', type: 'math', position: { x: 950, y: 640 }, data: { label: '70', mathType: 'number', value: 70 } },

      // ── Conditions ────────────────────────────────────────────────────
      { id: 'synth-bull', type: 'condition', position: { x: 1050, y: 300 }, data: { label: 'Confidence > 0.6', conditionType: 'compare', operator: '>' } },
      { id: 'rsi-os', type: 'condition', position: { x: 1050, y: 560 }, data: { label: 'RSI < 30', conditionType: 'compare', operator: '<' } },
      { id: 'rsi-ob', type: 'condition', position: { x: 1050, y: 640 }, data: { label: 'RSI > 70', conditionType: 'compare', operator: '>' } },
      { id: 'macd-x', type: 'condition', position: { x: 1050, y: 740 }, data: { label: 'MACD Cross Up', conditionType: 'crossover' } },
      { id: 'trend', type: 'condition', position: { x: 1050, y: 850 }, data: { label: 'Price > EMA50', conditionType: 'compare', operator: '>' } },

      // ── Logic gates ───────────────────────────────────────────────────
      { id: 'algo-or', type: 'condition', position: { x: 1300, y: 650 }, data: { label: 'Oversold OR MACD Cross', conditionType: 'or' } },
      { id: 'confluence', type: 'condition', position: { x: 1300, y: 420 }, data: { label: 'Agent + Algo', conditionType: 'and' } },
      { id: 'final-buy', type: 'condition', position: { x: 1500, y: 500 }, data: { label: 'BUY Signal', conditionType: 'and' } },
      { id: 'risk-or', type: 'condition', position: { x: 1300, y: 180 }, data: { label: 'Risk Alert', conditionType: 'or' } },

      // ── Risk management ───────────────────────────────────────────────
      { id: 'maxdd', type: 'risk', position: { x: 1500, y: 700 }, data: { label: 'Max DD 15%', riskType: 'maxDrawdown', maxDrawdownPercent: 15 } },
      { id: 'possize', type: 'risk', position: { x: 1500, y: 800 }, data: { label: 'Size 5%', riskType: 'positionPercent', maxPositionPercent: 5 } },

      // ── Actions ───────────────────────────────────────────────────────
      { id: 'buy', type: 'action', position: { x: 1750, y: 500 }, data: { label: 'Buy AAPL', actionType: 'order', direction: 'long', size: 5, sizeType: 'percent' } },
      { id: 'sl', type: 'action', position: { x: 2000, y: 450 }, data: { label: 'Stop Loss -3%', actionType: 'stopLoss', stopPrice: 0 } },
      { id: 'tp', type: 'action', position: { x: 2000, y: 570 }, data: { label: 'Take Profit +8%', actionType: 'takeProfit', takeProfitPrice: 0 } },
      { id: 'notify', type: 'action', position: { x: 1750, y: 370 }, data: { label: 'Telegram: Opportunity', actionType: 'notification', message: 'AAPL BUY: Agent + algo confluence confirmed.', channel: 'telegram' } },
      { id: 'call', type: 'action', position: { x: 1750, y: 80 }, data: { label: 'CALL: Risk Alert', actionType: 'phoneCall', message: 'Urgent AAPL risk. Bearish agent signals + overbought. Review positions.', phoneNumber: '', urgencyLevel: 'high' } },
      { id: 'close', type: 'action', position: { x: 1750, y: 200 }, data: { label: 'Close Position', actionType: 'closePosition' } },
    ],
    edges: [
      // Trigger → agents
      { id: 'e1', source: 'start', sourceHandle: 'output', target: 'news', targetHandle: 'trigger' },
      { id: 'e2', source: 'start', sourceHandle: 'output', target: 'social', targetHandle: 'trigger' },
      { id: 'e3', source: 'start', sourceHandle: 'output', target: 'fundamentals', targetHandle: 'trigger' },
      { id: 'e4', source: 'start', sourceHandle: 'output', target: 'techagent', targetHandle: 'trigger' },
      { id: 'e5', source: 'start', sourceHandle: 'output', target: 'research', targetHandle: 'trigger' },
      // Agents → sentiment
      { id: 'e6', source: 'news', sourceHandle: 'signal', target: 'sentiment', targetHandle: 'trigger' },
      { id: 'e7', source: 'social', sourceHandle: 'signal', target: 'sentiment', targetHandle: 'trigger' },
      // All → synthesis (agents feed data to synthesizer)
      { id: 'e8', source: 'news', sourceHandle: 'findings', target: 'synthesis', targetHandle: 'agentData' },
      { id: 'e9', source: 'social', sourceHandle: 'findings', target: 'synthesis', targetHandle: 'agentData' },
      { id: 'e10', source: 'fundamentals', sourceHandle: 'findings', target: 'synthesis', targetHandle: 'agentData' },
      { id: 'e11', source: 'techagent', sourceHandle: 'findings', target: 'synthesis', targetHandle: 'agentData' },
      { id: 'e12', source: 'research', sourceHandle: 'findings', target: 'synthesis', targetHandle: 'agentData' },
      { id: 'e13', source: 'sentiment', sourceHandle: 'score', target: 'synthesis', targetHandle: 'agentData' },
      // Synthesis confidence → compare
      { id: 'e14', source: 'synthesis', sourceHandle: 'confidence', target: 'synth-bull', targetHandle: 'input-a' },
      { id: 'e15', source: 'c06', sourceHandle: 'output', target: 'synth-bull', targetHandle: 'input-b' },
      // RSI conditions
      { id: 'e16', source: 'rsi', sourceHandle: 'value', target: 'rsi-os', targetHandle: 'input-a' },
      { id: 'e17', source: 'c30', sourceHandle: 'output', target: 'rsi-os', targetHandle: 'input-b' },
      { id: 'e18', source: 'rsi', sourceHandle: 'value', target: 'rsi-ob', targetHandle: 'input-a' },
      { id: 'e19', source: 'c70', sourceHandle: 'output', target: 'rsi-ob', targetHandle: 'input-b' },
      // MACD crossover
      { id: 'e20', source: 'macd', sourceHandle: 'line', target: 'macd-x', targetHandle: 'input-a' },
      { id: 'e21', source: 'macd', sourceHandle: 'signal', target: 'macd-x', targetHandle: 'input-b' },
      // Trend filter
      { id: 'e22', source: 'price', sourceHandle: 'value', target: 'trend', targetHandle: 'input-a' },
      { id: 'e23', source: 'ema50', sourceHandle: 'value', target: 'trend', targetHandle: 'input-b' },
      // Logic gates
      { id: 'e24', source: 'rsi-os', sourceHandle: 'output', target: 'algo-or', targetHandle: 'input-a' },
      { id: 'e25', source: 'macd-x', sourceHandle: 'output', target: 'algo-or', targetHandle: 'input-b' },
      { id: 'e26', source: 'synth-bull', sourceHandle: 'output', target: 'confluence', targetHandle: 'input-a' },
      { id: 'e27', source: 'algo-or', sourceHandle: 'output', target: 'confluence', targetHandle: 'input-b' },
      { id: 'e28', source: 'confluence', sourceHandle: 'output', target: 'final-buy', targetHandle: 'input-a' },
      { id: 'e29', source: 'trend', sourceHandle: 'output', target: 'final-buy', targetHandle: 'input-b' },
      // Risk path
      { id: 'e30', source: 'rsi-ob', sourceHandle: 'output', target: 'risk-or', targetHandle: 'input-a' },
      { id: 'e31', source: 'synth-bull', sourceHandle: 'output', target: 'risk-or', targetHandle: 'input-b' },
      // Actions
      { id: 'e32', source: 'final-buy', sourceHandle: 'output', target: 'notify', targetHandle: 'trigger' },
      { id: 'e33', source: 'final-buy', sourceHandle: 'output', target: 'buy', targetHandle: 'trigger' },
      { id: 'e34', source: 'buy', sourceHandle: 'next', target: 'sl', targetHandle: 'trigger' },
      { id: 'e35', source: 'buy', sourceHandle: 'next', target: 'tp', targetHandle: 'trigger' },
      { id: 'e36', source: 'risk-or', sourceHandle: 'output', target: 'call', targetHandle: 'trigger' },
      { id: 'e37', source: 'risk-or', sourceHandle: 'output', target: 'close', targetHandle: 'trigger' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE 2: Wealth Manager Team — Multi-Asset Portfolio
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Replicates a full wealth management desk:
  //   Chief Investment Officer (Synthesis) receives reports from:
  //   - Equity Analyst (fundamentals + news on each holding)
  //   - Macro Strategist (rates, GDP, geopolitics)
  //   - Technical Trader (chart patterns, momentum)
  //   - Risk Manager (VaR, stress tests, drawdown)
  //   - Sentiment Desk (social + news sentiment fusion)
  //
  //   The CIO's recommendation feeds into:
  //   - If-Else decision gate (opportunity vs risk)
  //   - Opportunity path: algo confirmation → buy with trailing stop
  //   - Risk path: close positions + alert client
  //   - Research agent validates before large trades (HITL-style)
  //
  {
    id: 'wealth-manager-team',
    name: 'Wealth Manager Team',
    description:
      'A full wealth management team as agents. CIO (Synthesis) receives reports from Equity Analyst, Macro Strategist, Technical Trader, Risk Manager, and Sentiment Desk. Includes algo confirmation (EMA crossover + RSI filter), trailing stop risk management, human approval for large trades, and multi-channel alerts. Works like a private bank investment committee.',
    category: 'agentic',
    difficulty: 'advanced',
    indicators: ['Fundamentals', 'Macro', 'Technical', 'Research', 'Sentiment', 'EMA', 'RSI', 'ATR'],
    featured: true,
    nodes: [
      // ── Trigger: runs every 15 min during market hours ────────────────
      {
        id: 'hb',
        type: 'trigger',
        position: { x: 0, y: 450 },
        data: {
          label: 'Market Hours (15 min)',
          triggerType: 'heartbeatTrigger',
          intervalMinutes: 15,
          atMarketOpen: true,
          atMarketClose: true,
          specificTime: null,
        },
      },

      // ── The Team (5 analyst agents) ───────────────────────────────────
      {
        id: 'equity-analyst',
        type: 'agent',
        position: { x: 280, y: 0 },
        data: {
          label: 'Equity Analyst',
          agentNodeType: 'fundamentalsAgentNode',
          agentType: 'fundamentals_analyst',
          model: 'gemini-2.5-pro',
          symbols: ['AAPL'],
          confidenceThreshold: 0.5,
          reportTypes: ['10-K', '10-Q', 'earnings', 'guidance', '8-K'],
          analystSources: ['wallstreet', 'institutional', 'insider', 'shortinterest'],
          lookbackQuarters: 8,
        },
      },
      {
        id: 'macro-strategist',
        type: 'agent',
        position: { x: 280, y: 170 },
        data: {
          label: 'Macro Strategist',
          agentNodeType: 'macroAgentNode',
          agentType: 'macro_analyst',
          model: 'gemini-2.5-pro',
          symbols: ['AAPL'],
          confidenceThreshold: 0.4,
        },
      },
      {
        id: 'tech-trader',
        type: 'agent',
        position: { x: 280, y: 340 },
        data: {
          label: 'Technical Trader',
          agentNodeType: 'technicalAgentNode',
          agentType: 'technical_analyst',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.5,
          technicalTimeframes: ['15m', '1H', '4H', '1D'],
          technicalIndicators: ['rsi', 'macd', 'bollinger', 'ema', 'volume', 'fibonacci', 'support_resistance'],
        },
      },
      {
        id: 'risk-mgr',
        type: 'agent',
        position: { x: 280, y: 510 },
        data: {
          label: 'Risk Manager',
          agentNodeType: 'researchAgentNode',
          agentType: 'research_analyst',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.5,
          researchTools: ['var', 'stress_test', 'montecarlo', 'quantstats'],
          researchDepth: 'standard',
        },
      },
      {
        id: 'sentiment-desk',
        type: 'agent',
        position: { x: 280, y: 680 },
        data: {
          label: 'Sentiment Desk',
          agentNodeType: 'sentimentAgentNode',
          agentType: 'sentiment_analyst',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.4,
        },
      },
      {
        id: 'news-desk',
        type: 'agent',
        position: { x: 280, y: 850 },
        data: {
          label: 'News Desk',
          agentNodeType: 'newsAgentNode',
          agentType: 'news_analyst',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.4,
          newsSources: ['newsapi', 'sec', 'bloomberg', 'reuters', 'finnhub'],
          newsKeywords: ['Apple', 'earnings', 'Fed', 'tariff', 'regulation'],
          newsMaxAge: 8,
        },
      },

      // ── CIO: Chief Investment Officer (Synthesis) ─────────────────────
      {
        id: 'cio',
        type: 'agent',
        position: { x: 650, y: 380 },
        data: {
          label: 'CIO (Investment Committee)',
          agentNodeType: 'synthesisAgentNode',
          agentType: 'synthesis',
          model: 'gemini-2.5-pro',
          symbols: ['AAPL'],
          confidenceThreshold: 0.65,
        },
      },

      // ── Algo confirmation layer ───────────────────────────────────────
      {
        id: 'ema-fast',
        type: 'indicator',
        position: { x: 650, y: 620 },
        data: { label: 'EMA (20)', indicatorType: 'ema', timeframe: '60', params: { period: 20 } },
      },
      {
        id: 'ema-slow',
        type: 'indicator',
        position: { x: 650, y: 720 },
        data: { label: 'EMA (50)', indicatorType: 'ema', timeframe: '60', params: { period: 50 } },
      },
      {
        id: 'rsi2',
        type: 'indicator',
        position: { x: 650, y: 820 },
        data: { label: 'RSI (14)', indicatorType: 'rsi', timeframe: '60', params: { period: 14 } },
      },
      {
        id: 'atr2',
        type: 'indicator',
        position: { x: 650, y: 920 },
        data: { label: 'ATR (14)', indicatorType: 'atr', timeframe: '60', params: { period: 14 } },
      },

      // ── Decision logic ────────────────────────────────────────────────
      { id: 'c065', type: 'math', position: { x: 950, y: 300 }, data: { label: '0.65', mathType: 'number', value: 0.65 } },
      { id: 'c04', type: 'math', position: { x: 950, y: 200 }, data: { label: '0.4', mathType: 'number', value: 0.4 } },
      { id: 'c40', type: 'math', position: { x: 950, y: 820 }, data: { label: '40', mathType: 'number', value: 40 } },

      // CIO says bullish (high confidence)?
      { id: 'cio-bull', type: 'condition', position: { x: 1050, y: 320 }, data: { label: 'CIO Bullish (>0.65)', conditionType: 'compare', operator: '>' } },
      // CIO says bearish (low confidence)?
      { id: 'cio-bear', type: 'condition', position: { x: 1050, y: 200 }, data: { label: 'CIO Bearish (<0.4)', conditionType: 'compare', operator: '<' } },
      // EMA crossover for algo confirmation
      { id: 'ema-cross', type: 'condition', position: { x: 1050, y: 650 }, data: { label: 'EMA 20 > 50', conditionType: 'crossover' } },
      // RSI not overbought
      { id: 'rsi-ok', type: 'condition', position: { x: 1050, y: 820 }, data: { label: 'RSI < 40 (not OB)', conditionType: 'compare', operator: '<' } },

      // Confluence: CIO bullish AND EMA cross
      { id: 'buy-gate', type: 'condition', position: { x: 1300, y: 450 }, data: { label: 'CIO + EMA Confluence', conditionType: 'and' } },

      // ── If-Else: Opportunity vs Hold ──────────────────────────────────
      { id: 'decision', type: 'control', position: { x: 1500, y: 450 }, data: { label: 'Opportunity?', controlType: 'ifElse' } },

      // ── Actions: Opportunity path ─────────────────────────────────────
      { id: 'log-opp', type: 'action', position: { x: 1750, y: 350 }, data: { label: 'Log: Opportunity', actionType: 'log', message: 'Buy opportunity confirmed by CIO + algo' } },
      { id: 'notify-opp', type: 'action', position: { x: 1750, y: 450 }, data: { label: 'Telegram: Buy Signal', actionType: 'notification', message: 'BUY signal confirmed by investment committee. Agent + algo confluence.', channel: 'telegram' } },
      { id: 'buy2', type: 'action', position: { x: 1750, y: 560 }, data: { label: 'Buy (5%)', actionType: 'order', direction: 'long', size: 5, sizeType: 'percent' } },
      { id: 'trail2', type: 'action', position: { x: 2000, y: 560 }, data: { label: 'Trailing Stop 3%', actionType: 'trailingStop', trailingDistance: 3 } },

      // ── Actions: Risk path ────────────────────────────────────────────
      { id: 'call-risk', type: 'action', position: { x: 1750, y: 100 }, data: { label: 'CALL: Portfolio Risk', actionType: 'phoneCall', message: 'Portfolio risk alert. CIO flagged bearish. Reviewing positions.', phoneNumber: '', urgencyLevel: 'high' } },
      { id: 'close-risk', type: 'action', position: { x: 1750, y: 200 }, data: { label: 'Close All', actionType: 'closeAll' } },
    ],
    edges: [
      // Trigger → all analysts
      { id: 'w1', source: 'hb', sourceHandle: 'output', target: 'equity-analyst', targetHandle: 'trigger' },
      { id: 'w2', source: 'hb', sourceHandle: 'output', target: 'macro-strategist', targetHandle: 'trigger' },
      { id: 'w3', source: 'hb', sourceHandle: 'output', target: 'tech-trader', targetHandle: 'trigger' },
      { id: 'w4', source: 'hb', sourceHandle: 'output', target: 'risk-mgr', targetHandle: 'trigger' },
      { id: 'w5', source: 'hb', sourceHandle: 'output', target: 'sentiment-desk', targetHandle: 'trigger' },
      { id: 'w6', source: 'hb', sourceHandle: 'output', target: 'news-desk', targetHandle: 'trigger' },
      // Analysts → CIO (synthesis)
      { id: 'w7', source: 'equity-analyst', sourceHandle: 'findings', target: 'cio', targetHandle: 'agentData' },
      { id: 'w8', source: 'macro-strategist', sourceHandle: 'findings', target: 'cio', targetHandle: 'agentData' },
      { id: 'w9', source: 'tech-trader', sourceHandle: 'findings', target: 'cio', targetHandle: 'agentData' },
      { id: 'w10', source: 'risk-mgr', sourceHandle: 'findings', target: 'cio', targetHandle: 'agentData' },
      { id: 'w11', source: 'sentiment-desk', sourceHandle: 'score', target: 'cio', targetHandle: 'agentData' },
      { id: 'w12', source: 'news-desk', sourceHandle: 'findings', target: 'cio', targetHandle: 'agentData' },
      // CIO confidence → conditions
      { id: 'w13', source: 'cio', sourceHandle: 'confidence', target: 'cio-bull', targetHandle: 'input-a' },
      { id: 'w14', source: 'c065', sourceHandle: 'output', target: 'cio-bull', targetHandle: 'input-b' },
      { id: 'w15', source: 'cio', sourceHandle: 'confidence', target: 'cio-bear', targetHandle: 'input-a' },
      { id: 'w16', source: 'c04', sourceHandle: 'output', target: 'cio-bear', targetHandle: 'input-b' },
      // EMA cross
      { id: 'w17', source: 'ema-fast', sourceHandle: 'value', target: 'ema-cross', targetHandle: 'input-a' },
      { id: 'w18', source: 'ema-slow', sourceHandle: 'value', target: 'ema-cross', targetHandle: 'input-b' },
      // RSI filter
      { id: 'w19', source: 'rsi2', sourceHandle: 'value', target: 'rsi-ok', targetHandle: 'input-a' },
      { id: 'w20', source: 'c40', sourceHandle: 'output', target: 'rsi-ok', targetHandle: 'input-b' },
      // Confluence: CIO bull AND EMA cross
      { id: 'w21', source: 'cio-bull', sourceHandle: 'output', target: 'buy-gate', targetHandle: 'input-a' },
      { id: 'w22', source: 'ema-cross', sourceHandle: 'output', target: 'buy-gate', targetHandle: 'input-b' },
      // Buy gate → If-Else
      { id: 'w23', source: 'buy-gate', sourceHandle: 'output', target: 'decision', targetHandle: 'condition' },
      // Then → opportunity actions
      { id: 'w24', source: 'decision', sourceHandle: 'then', target: 'log-opp', targetHandle: 'trigger' },
      { id: 'w25', source: 'decision', sourceHandle: 'then', target: 'notify-opp', targetHandle: 'trigger' },
      { id: 'w26', source: 'decision', sourceHandle: 'then', target: 'buy2', targetHandle: 'trigger' },
      { id: 'w27', source: 'buy2', sourceHandle: 'next', target: 'trail2', targetHandle: 'trigger' },
      // Bear → risk actions
      { id: 'w28', source: 'cio-bear', sourceHandle: 'output', target: 'call-risk', targetHandle: 'trigger' },
      { id: 'w29', source: 'cio-bear', sourceHandle: 'output', target: 'close-risk', targetHandle: 'trigger' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE 3: 24/7 Market Scanner & Alert System
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Agents scan continuously for:
  //   - Breaking news that moves markets
  //   - Political/Trump posts affecting sectors
  //   - Earnings surprises (pre/post market)
  //   - Technical breakouts (price crossing key levels)
  //   - Unusual options/volume activity
  //
  // Doesn't auto-trade — it ALERTS you with priority levels:
  //   - Low: Log + Telegram
  //   - Medium: Email digest
  //   - High: Phone call
  //
  {
    id: 'market-scanner-247',
    name: '24/7 Market Scanner & Alerts',
    description:
      'Always-on market scanner. Agents watch for breaking news, political posts (Trump, POTUS), earnings surprises, technical breakouts, and sentiment shifts. Doesn\'t trade — it alerts YOU via Telegram, email, or phone call depending on urgency. Perfect as a first agent strategy before enabling auto-trading.',
    category: 'agentic',
    difficulty: 'intermediate',
    indicators: ['News Agent', 'Social Monitor', 'Sentiment', 'Technical Agent', 'RSI', 'Bollinger Bands'],
    featured: true,
    nodes: [
      // ── Dual triggers: fast + slow scan ───────────────────────────────
      {
        id: 'fast-scan',
        type: 'trigger',
        position: { x: 0, y: 200 },
        data: {
          label: 'Fast Scan (5 min)',
          triggerType: 'heartbeatTrigger',
          intervalMinutes: 5,
          atMarketOpen: true,
          atMarketClose: false,
          specificTime: null,
        },
      },
      {
        id: 'slow-scan',
        type: 'trigger',
        position: { x: 0, y: 600 },
        data: {
          label: 'Deep Scan (1 hour)',
          triggerType: 'heartbeatTrigger',
          intervalMinutes: 60,
          atMarketOpen: false,
          atMarketClose: true,
          specificTime: null,
        },
      },

      // ── Fast-scan agents (lightweight, frequent) ──────────────────────
      {
        id: 'news-scan',
        type: 'agent',
        position: { x: 300, y: 50 },
        data: {
          label: 'Breaking News Scanner',
          agentNodeType: 'newsAgentNode',
          agentType: 'news_analyst',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.6,
          newsSources: ['newsapi', 'finnhub', 'sec'],
          newsKeywords: ['breaking', 'urgent', 'FDA', 'acquisition', 'guidance', 'layoff'],
          newsMaxAge: 1,
        },
      },
      {
        id: 'trump-scan',
        type: 'agent',
        position: { x: 300, y: 220 },
        data: {
          label: 'Political Post Monitor',
          agentNodeType: 'socialAgentNode',
          agentType: 'social_monitor',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.5,
          socialPlatforms: ['twitter', 'truthsocial'],
          socialAccounts: ['@realDonaldTrump', '@POTUS', '@WhiteHouse'],
          socialKeywords: ['tariff', 'China', 'trade war', 'tech', 'Apple', 'regulation', 'antitrust'],
        },
      },
      {
        id: 'sentiment-scan',
        type: 'agent',
        position: { x: 300, y: 390 },
        data: {
          label: 'Sentiment Spike Detector',
          agentNodeType: 'sentimentAgentNode',
          agentType: 'sentiment_analyst',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.7,
        },
      },

      // ── Slow-scan agents (deeper analysis) ────────────────────────────
      {
        id: 'tech-scan',
        type: 'agent',
        position: { x: 300, y: 560 },
        data: {
          label: 'Technical Breakout Scanner',
          agentNodeType: 'technicalAgentNode',
          agentType: 'technical_analyst',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.6,
          technicalTimeframes: ['1H', '4H', '1D'],
          technicalIndicators: ['bollinger', 'volume', 'support_resistance', 'rsi', 'macd'],
        },
      },
      {
        id: 'research-scan',
        type: 'agent',
        position: { x: 300, y: 730 },
        data: {
          label: 'Quant Risk Scanner',
          agentNodeType: 'researchAgentNode',
          agentType: 'research_analyst',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.5,
          researchTools: ['var', 'stress_test', 'hmm_regime'],
          researchDepth: 'quick',
        },
      },

      // ── Algo breakout detection ───────────────────────────────────────
      {
        id: 'bb3',
        type: 'indicator',
        position: { x: 300, y: 900 },
        data: { label: 'Bollinger Bands', indicatorType: 'bb', timeframe: '60', params: { period: 20, stdDev: 2 } },
      },
      {
        id: 'price3',
        type: 'environment',
        position: { x: 300, y: 1020 },
        data: { label: 'Price', environmentType: 'price', priceType: 'close' },
      },
      {
        id: 'rsi3',
        type: 'indicator',
        position: { x: 300, y: 1120 },
        data: { label: 'RSI (14)', indicatorType: 'rsi', timeframe: '60', params: { period: 14 } },
      },

      // ── Conditions ────────────────────────────────────────────────────
      { id: 'c75', type: 'math', position: { x: 600, y: 900 }, data: { label: '75', mathType: 'number', value: 75 } },
      { id: 'c25', type: 'math', position: { x: 600, y: 1120 }, data: { label: '25', mathType: 'number', value: 25 } },

      // Price > upper BB = breakout
      { id: 'bb-break', type: 'condition', position: { x: 700, y: 950 }, data: { label: 'Price > Upper BB', conditionType: 'compare', operator: '>' } },
      // RSI extreme
      { id: 'rsi-extreme', type: 'condition', position: { x: 700, y: 1070 }, data: { label: 'RSI > 75 or < 25', conditionType: 'compare', operator: '>' } },

      // ── Synthesis: combine all scanner outputs ────────────────────────
      {
        id: 'alert-synth',
        type: 'agent',
        position: { x: 700, y: 400 },
        data: {
          label: 'Alert Prioritizer',
          agentNodeType: 'synthesisAgentNode',
          agentType: 'synthesis',
          model: 'gemini-2.5-pro',
          symbols: ['AAPL'],
          confidenceThreshold: 0.5,
        },
      },

      // ── Alert priority decision ───────────────────────────────────────
      { id: 'c08', type: 'math', position: { x: 1000, y: 300 }, data: { label: '0.8', mathType: 'number', value: 0.8 } },
      { id: 'c05', type: 'math', position: { x: 1000, y: 500 }, data: { label: '0.5', mathType: 'number', value: 0.5 } },

      { id: 'is-urgent', type: 'condition', position: { x: 1100, y: 350 }, data: { label: 'Urgent (>0.8)', conditionType: 'compare', operator: '>' } },
      { id: 'is-notable', type: 'condition', position: { x: 1100, y: 500 }, data: { label: 'Notable (>0.5)', conditionType: 'compare', operator: '>' } },

      // ── Alert actions ─────────────────────────────────────────────────
      { id: 'call-urgent', type: 'action', position: { x: 1400, y: 250 }, data: { label: 'CALL: Urgent Alert', actionType: 'phoneCall', message: 'Urgent market alert for your portfolio. High-confidence signal detected. Check immediately.', phoneNumber: '', urgencyLevel: 'high' } },
      { id: 'tg-urgent', type: 'action', position: { x: 1400, y: 370 }, data: { label: 'Telegram: Details', actionType: 'notification', message: 'URGENT: Market signal detected. Review dashboard.', channel: 'telegram' } },
      { id: 'tg-notable', type: 'action', position: { x: 1400, y: 500 }, data: { label: 'Telegram: FYI', actionType: 'notification', message: 'Notable market activity detected. Worth reviewing.', channel: 'telegram' } },
      { id: 'log-scan', type: 'action', position: { x: 1400, y: 620 }, data: { label: 'Log All Scans', actionType: 'log', message: 'Scan completed. Results logged.' } },
      // BB breakout alert
      { id: 'tg-breakout', type: 'action', position: { x: 1100, y: 950 }, data: { label: 'Telegram: Breakout!', actionType: 'notification', message: 'BREAKOUT: Price crossed Bollinger Band. Check charts.', channel: 'telegram' } },
    ],
    edges: [
      // Fast scan triggers
      { id: 's1', source: 'fast-scan', sourceHandle: 'output', target: 'news-scan', targetHandle: 'trigger' },
      { id: 's2', source: 'fast-scan', sourceHandle: 'output', target: 'trump-scan', targetHandle: 'trigger' },
      { id: 's3', source: 'fast-scan', sourceHandle: 'output', target: 'sentiment-scan', targetHandle: 'trigger' },
      // Slow scan triggers
      { id: 's4', source: 'slow-scan', sourceHandle: 'output', target: 'tech-scan', targetHandle: 'trigger' },
      { id: 's5', source: 'slow-scan', sourceHandle: 'output', target: 'research-scan', targetHandle: 'trigger' },
      // All scanners → alert synthesizer
      { id: 's6', source: 'news-scan', sourceHandle: 'findings', target: 'alert-synth', targetHandle: 'agentData' },
      { id: 's7', source: 'trump-scan', sourceHandle: 'findings', target: 'alert-synth', targetHandle: 'agentData' },
      { id: 's8', source: 'sentiment-scan', sourceHandle: 'score', target: 'alert-synth', targetHandle: 'agentData' },
      { id: 's9', source: 'tech-scan', sourceHandle: 'findings', target: 'alert-synth', targetHandle: 'agentData' },
      { id: 's10', source: 'research-scan', sourceHandle: 'findings', target: 'alert-synth', targetHandle: 'agentData' },
      // Synthesizer confidence → priority
      { id: 's11', source: 'alert-synth', sourceHandle: 'confidence', target: 'is-urgent', targetHandle: 'input-a' },
      { id: 's12', source: 'c08', sourceHandle: 'output', target: 'is-urgent', targetHandle: 'input-b' },
      { id: 's13', source: 'alert-synth', sourceHandle: 'confidence', target: 'is-notable', targetHandle: 'input-a' },
      { id: 's14', source: 'c05', sourceHandle: 'output', target: 'is-notable', targetHandle: 'input-b' },
      // Priority → actions
      { id: 's15', source: 'is-urgent', sourceHandle: 'output', target: 'call-urgent', targetHandle: 'trigger' },
      { id: 's16', source: 'is-urgent', sourceHandle: 'output', target: 'tg-urgent', targetHandle: 'trigger' },
      { id: 's17', source: 'is-notable', sourceHandle: 'output', target: 'tg-notable', targetHandle: 'trigger' },
      { id: 's18', source: 'alert-synth', sourceHandle: 'signal', target: 'log-scan', targetHandle: 'trigger' },
      // BB breakout
      { id: 's19', source: 'price3', sourceHandle: 'value', target: 'bb-break', targetHandle: 'input-a' },
      { id: 's20', source: 'bb3', sourceHandle: 'upper', target: 'bb-break', targetHandle: 'input-b' },
      { id: 's21', source: 'rsi3', sourceHandle: 'value', target: 'rsi-extreme', targetHandle: 'input-a' },
      { id: 's22', source: 'c75', sourceHandle: 'output', target: 'rsi-extreme', targetHandle: 'input-b' },
      { id: 's23', source: 'bb-break', sourceHandle: 'output', target: 'tg-breakout', targetHandle: 'trigger' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE 4: Macro-Driven Allocation Strategy
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // How institutional funds actually work:
  //   1. Macro analyst reads the economy (CPI, rates, GDP, employment)
  //   2. News desk watches Fed announcements, geopolitics, trade policy
  //   3. Social monitor tracks political decisions affecting markets
  //   4. Research desk runs regime detection + stress tests
  //   5. Based on macro regime → allocate between risk-on and risk-off
  //   6. Technical confirmation before execution
  //
  {
    id: 'macro-allocation',
    name: 'Macro-Driven Allocation',
    description:
      'Institutional-style macro strategy. Macro Analyst reads economic indicators, News Desk watches Fed/geopolitics, Social Monitor tracks political decisions, Research runs regime detection. Allocates between risk-on (equity) and risk-off (bonds/gold) based on macro regime. Technical confirmation via MACD before rebalancing. Weekly deep review cycle.',
    category: 'agentic',
    difficulty: 'advanced',
    indicators: ['Macro Agent', 'News Agent', 'Social Monitor', 'Research', 'MACD', 'EMA 200'],
    nodes: [
      // ── Triggers ──────────────────────────────────────────────────────
      {
        id: 'daily-hb',
        type: 'trigger',
        position: { x: 0, y: 300 },
        data: {
          label: 'Daily 9:30 AM',
          triggerType: 'cronTrigger',
          cronExpression: '30 9 * * 1-5',
          timezone: 'America/New_York',
        },
      },
      {
        id: 'weekly-hb',
        type: 'trigger',
        position: { x: 0, y: 700 },
        data: {
          label: 'Weekly Review (Friday)',
          triggerType: 'cronTrigger',
          cronExpression: '0 16 * * 5',
          timezone: 'America/New_York',
        },
      },

      // ── Daily agents ──────────────────────────────────────────────────
      {
        id: 'macro4',
        type: 'agent',
        position: { x: 300, y: 100 },
        data: {
          label: 'Macro Economist',
          agentNodeType: 'macroAgentNode',
          agentType: 'macro_analyst',
          model: 'gemini-2.5-pro',
          symbols: ['AAPL'],
          confidenceThreshold: 0.5,
        },
      },
      {
        id: 'news4',
        type: 'agent',
        position: { x: 300, y: 280 },
        data: {
          label: 'Fed & Policy Desk',
          agentNodeType: 'newsAgentNode',
          agentType: 'news_analyst',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.4,
          newsSources: ['newsapi', 'reuters', 'bloomberg'],
          newsKeywords: ['Fed', 'FOMC', 'rate decision', 'CPI', 'inflation', 'GDP', 'employment', 'tariff'],
          newsMaxAge: 24,
        },
      },
      {
        id: 'political4',
        type: 'agent',
        position: { x: 300, y: 460 },
        data: {
          label: 'Geopolitical Monitor',
          agentNodeType: 'socialAgentNode',
          agentType: 'social_monitor',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.5,
          socialPlatforms: ['twitter', 'truthsocial'],
          socialAccounts: ['@realDonaldTrump', '@POTUS', '@federalreserve'],
          socialKeywords: ['tariff', 'sanctions', 'trade deal', 'executive order', 'interest rate'],
        },
      },

      // ── Weekly deep research ──────────────────────────────────────────
      {
        id: 'research4',
        type: 'agent',
        position: { x: 300, y: 640 },
        data: {
          label: 'Regime & Stress Research',
          agentNodeType: 'researchAgentNode',
          agentType: 'research_analyst',
          model: 'gemini-2.0-flash',
          symbols: ['AAPL'],
          confidenceThreshold: 0.5,
          researchTools: ['hmm_regime', 'stress_test', 'var', 'walk_forward'],
          researchDepth: 'deep',
        },
      },
      {
        id: 'fund4',
        type: 'agent',
        position: { x: 300, y: 820 },
        data: {
          label: 'Fundamentals Review',
          agentNodeType: 'fundamentalsAgentNode',
          agentType: 'fundamentals_analyst',
          model: 'gemini-2.5-pro',
          symbols: ['AAPL'],
          confidenceThreshold: 0.5,
          reportTypes: ['10-K', '10-Q', 'earnings', 'guidance'],
          analystSources: ['wallstreet', 'institutional'],
          lookbackQuarters: 8,
        },
      },

      // ── CIO Synthesis ─────────────────────────────────────────────────
      {
        id: 'cio4',
        type: 'agent',
        position: { x: 680, y: 400 },
        data: {
          label: 'CIO Macro View',
          agentNodeType: 'synthesisAgentNode',
          agentType: 'synthesis',
          model: 'gemini-2.5-pro',
          symbols: ['AAPL'],
          confidenceThreshold: 0.6,
        },
      },

      // ── Algo: MACD + EMA200 trend ─────────────────────────────────────
      {
        id: 'macd4',
        type: 'indicator',
        position: { x: 680, y: 650 },
        data: { label: 'MACD Weekly', indicatorType: 'macd', timeframe: '1D', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
      },
      {
        id: 'ema200',
        type: 'indicator',
        position: { x: 680, y: 770 },
        data: { label: 'EMA (200)', indicatorType: 'ema', timeframe: '1D', params: { period: 200 } },
      },
      {
        id: 'price4',
        type: 'environment',
        position: { x: 680, y: 880 },
        data: { label: 'Price', environmentType: 'price', priceType: 'close' },
      },

      // ── Decision logic ────────────────────────────────────────────────
      { id: 'c06b', type: 'math', position: { x: 1000, y: 350 }, data: { label: '0.6', mathType: 'number', value: 0.6 } },
      { id: 'c035', type: 'math', position: { x: 1000, y: 250 }, data: { label: '0.35', mathType: 'number', value: 0.35 } },

      { id: 'risk-on', type: 'condition', position: { x: 1100, y: 380 }, data: { label: 'Risk-On (CIO > 0.6)', conditionType: 'compare', operator: '>' } },
      { id: 'risk-off', type: 'condition', position: { x: 1100, y: 250 }, data: { label: 'Risk-Off (CIO < 0.35)', conditionType: 'compare', operator: '<' } },
      { id: 'macd-bull', type: 'condition', position: { x: 1100, y: 650 }, data: { label: 'MACD Bullish', conditionType: 'crossover' } },
      { id: 'above-200', type: 'condition', position: { x: 1100, y: 800 }, data: { label: 'Price > EMA200', conditionType: 'compare', operator: '>' } },

      // Confirmation: risk-on AND MACD bullish AND above EMA200
      { id: 'trend-ok', type: 'condition', position: { x: 1350, y: 700 }, data: { label: 'Trend Confirmed', conditionType: 'and' } },
      { id: 'go-long', type: 'condition', position: { x: 1350, y: 450 }, data: { label: 'Risk-On + Trend', conditionType: 'and' } },

      // ── Actions ───────────────────────────────────────────────────────
      { id: 'buy4', type: 'action', position: { x: 1600, y: 450 }, data: { label: 'Buy Equity (10%)', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' } },
      { id: 'sl4', type: 'action', position: { x: 1850, y: 400 }, data: { label: 'Stop Loss -5%', actionType: 'stopLoss', stopPrice: 0 } },
      { id: 'tp4', type: 'action', position: { x: 1850, y: 520 }, data: { label: 'Take Profit +15%', actionType: 'takeProfit', takeProfitPrice: 0 } },
      { id: 'close4', type: 'action', position: { x: 1600, y: 180 }, data: { label: 'De-Risk: Close Equity', actionType: 'closeAll' } },
      { id: 'notify4', type: 'action', position: { x: 1600, y: 300 }, data: { label: 'Email: Allocation Change', actionType: 'notification', message: 'Portfolio allocation changed based on macro regime shift.', channel: 'email' } },
      { id: 'call4', type: 'action', position: { x: 1600, y: 80 }, data: { label: 'CALL: Regime Shift', actionType: 'phoneCall', message: 'Macro regime shift detected. Portfolio being de-risked. Review allocation.', phoneNumber: '', urgencyLevel: 'medium' } },
    ],
    edges: [
      // Daily trigger → daily agents
      { id: 'm1', source: 'daily-hb', sourceHandle: 'output', target: 'macro4', targetHandle: 'trigger' },
      { id: 'm2', source: 'daily-hb', sourceHandle: 'output', target: 'news4', targetHandle: 'trigger' },
      { id: 'm3', source: 'daily-hb', sourceHandle: 'output', target: 'political4', targetHandle: 'trigger' },
      // Weekly trigger → deep research
      { id: 'm4', source: 'weekly-hb', sourceHandle: 'output', target: 'research4', targetHandle: 'trigger' },
      { id: 'm5', source: 'weekly-hb', sourceHandle: 'output', target: 'fund4', targetHandle: 'trigger' },
      // All → CIO
      { id: 'm6', source: 'macro4', sourceHandle: 'findings', target: 'cio4', targetHandle: 'agentData' },
      { id: 'm7', source: 'news4', sourceHandle: 'findings', target: 'cio4', targetHandle: 'agentData' },
      { id: 'm8', source: 'political4', sourceHandle: 'findings', target: 'cio4', targetHandle: 'agentData' },
      { id: 'm9', source: 'research4', sourceHandle: 'findings', target: 'cio4', targetHandle: 'agentData' },
      { id: 'm10', source: 'fund4', sourceHandle: 'findings', target: 'cio4', targetHandle: 'agentData' },
      // CIO → decision
      { id: 'm11', source: 'cio4', sourceHandle: 'confidence', target: 'risk-on', targetHandle: 'input-a' },
      { id: 'm12', source: 'c06b', sourceHandle: 'output', target: 'risk-on', targetHandle: 'input-b' },
      { id: 'm13', source: 'cio4', sourceHandle: 'confidence', target: 'risk-off', targetHandle: 'input-a' },
      { id: 'm14', source: 'c035', sourceHandle: 'output', target: 'risk-off', targetHandle: 'input-b' },
      // MACD + EMA200
      { id: 'm15', source: 'macd4', sourceHandle: 'line', target: 'macd-bull', targetHandle: 'input-a' },
      { id: 'm16', source: 'macd4', sourceHandle: 'signal', target: 'macd-bull', targetHandle: 'input-b' },
      { id: 'm17', source: 'price4', sourceHandle: 'value', target: 'above-200', targetHandle: 'input-a' },
      { id: 'm18', source: 'ema200', sourceHandle: 'value', target: 'above-200', targetHandle: 'input-b' },
      // Trend confirmation
      { id: 'm19', source: 'macd-bull', sourceHandle: 'output', target: 'trend-ok', targetHandle: 'input-a' },
      { id: 'm20', source: 'above-200', sourceHandle: 'output', target: 'trend-ok', targetHandle: 'input-b' },
      { id: 'm21', source: 'risk-on', sourceHandle: 'output', target: 'go-long', targetHandle: 'input-a' },
      { id: 'm22', source: 'trend-ok', sourceHandle: 'output', target: 'go-long', targetHandle: 'input-b' },
      // Actions
      { id: 'm23', source: 'go-long', sourceHandle: 'output', target: 'buy4', targetHandle: 'trigger' },
      { id: 'm24', source: 'buy4', sourceHandle: 'next', target: 'sl4', targetHandle: 'trigger' },
      { id: 'm25', source: 'buy4', sourceHandle: 'next', target: 'tp4', targetHandle: 'trigger' },
      // Risk-off actions
      { id: 'm26', source: 'risk-off', sourceHandle: 'output', target: 'call4', targetHandle: 'trigger' },
      { id: 'm27', source: 'risk-off', sourceHandle: 'output', target: 'notify4', targetHandle: 'trigger' },
      { id: 'm28', source: 'risk-off', sourceHandle: 'output', target: 'close4', targetHandle: 'trigger' },
    ],
  },
];
