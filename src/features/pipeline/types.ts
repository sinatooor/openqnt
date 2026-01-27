/**
 * Pipeline Types - Node and Edge definitions for the trading workflow canvas
 */

import { Node, Edge } from '@xyflow/react';

// Base node data with index signature for ReactFlow compatibility
interface BaseNodeData {
  [key: string]: unknown;
  label: string;
}

// Strategy Node - Contains Blockly blocks
export interface StrategyNodeData extends BaseNodeData {
  blocklyXml?: string;
  strategyName: string;
  signalType: 'buy' | 'sell' | 'both' | 'value';
  isActive: boolean;
  lastSignal?: {
    type: 'buy' | 'sell' | 'none';
    timestamp: string;
    price?: number;
  };
}

// Execution Node - Trade execution settings
export interface ExecutionNodeData extends BaseNodeData {
  broker: string;
  symbol: string;
  orderType: 'market' | 'limit' | 'stop';
  positionSize: number;
  positionSizeType: 'fixed' | 'percent' | 'risk';
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  isLive: boolean;
  lastExecution?: {
    orderId: string;
    timestamp: string;
    status: 'filled' | 'pending' | 'rejected';
  };
}

// Prompt Node - AI processing
export interface PromptNodeData extends BaseNodeData {
  promptTemplate: string;
  model: string;
  outputType: 'text' | 'number' | 'boolean' | 'json' | 'signal';
  temperature?: number;
  lastOutput?: unknown;
  status?: 'idle' | 'running' | 'success' | 'error';
  isProcessing?: boolean;
}

// Backtest Node - Run backtests on connected strategy
export interface BacktestNodeData extends BaseNodeData {
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  status?: 'idle' | 'running' | 'success' | 'error';
  results?: {
    totalReturn: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    sharpeRatio: number;
    totalTrades: number;
  };
  isRunning?: boolean;
}

// Data Source Node - Market data input
export interface DataSourceNodeData extends BaseNodeData {
  symbol: string;
  timeframe: string;
  source: string;
  dataType: string;
  isConnected: boolean;
  isStreaming: boolean;
  lastPrice?: number;
  lastUpdate?: string;
}

// Condition Node - Logic branching
export interface ConditionNodeData extends BaseNodeData {
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'and' | 'or';
  compareValue?: number;
}

// Notification Node - Alerts
export interface NotificationNodeData extends BaseNodeData {
  channels?: string[];
  messageTemplate: string;
  isActive: boolean;
  config?: {
    email?: string;
    telegramChatId?: string;
    webhookUrl?: string;
    discordWebhook?: string;
  };
  lastNotification?: {
    timestamp: string;
    message: string;
    channel: string;
  };
}

// Aggregate all node data types
export type NodeData = 
  | StrategyNodeData 
  | ExecutionNodeData 
  | PromptNodeData 
  | BacktestNodeData
  | DataSourceNodeData
  | ConditionNodeData
  | NotificationNodeData;

// Node type identifiers
export type PipelineNodeType = 
  | 'strategy' 
  | 'execution' 
  | 'prompt' 
  | 'backtest' 
  | 'dataSource' 
  | 'notification'
  | 'condition';

// Custom node type for ReactFlow - using BuiltInNode approach
export type PipelineNode = Node<NodeData, PipelineNodeType>;

// Custom edge type
export interface PipelineEdge extends Edge {
  animated?: boolean;
  data?: {
    label?: string;
    signalType?: 'trigger' | 'value' | 'data';
  };
}

// Pipeline configuration
export interface PipelineConfig {
  id: string;
  name: string;
  description?: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}
