/**
 * Strategy template type definitions
 */

import { StrategyFlowNode, StrategyFlowEdge } from '../types';

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
    | 'pinescript';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  indicators: string[];
  nodes: StrategyFlowNode[];
  edges: StrategyFlowEdge[];
  featured?: boolean;
}
