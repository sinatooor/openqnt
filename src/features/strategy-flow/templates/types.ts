/**
 * Strategy template type definitions
 */

import { StrategyFlowNode, StrategyFlowEdge } from '../types';

/**
 * Hint that lets a template route through the canonical backend backtest
 * engine (`POST /api/backtest/run`) instead of the legacy code-gen path.
 * When set, BacktestModal calls the canonical engine with this spec, so
 * the result lines up byte-for-byte with what an agent would compute for
 * the same inputs.
 */
export interface TemplateBacktestSpec {
  strategy: string;                // built-in name e.g. 'rsi_meanrev'
  params?: Record<string, unknown>;
  symbol?: string;
  start?: string;
  end?: string;
  interval?: string;
  initial_cash?: number;
  commission?: number;
}

export interface StrategyTemplate {
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
    | 'pinescript'
    | 'agentic';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  indicators: string[];
  nodes: StrategyFlowNode[];
  edges: StrategyFlowEdge[];
  featured?: boolean;
  backtestSpec?: TemplateBacktestSpec;
}
