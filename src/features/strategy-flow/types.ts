/**
 * StrategyFlow Types - Complete type definitions for the ReactFlow-based strategy builder
 */

import { Node, Edge, Viewport } from '@xyflow/react';

// =============================================================================
// NODE CATEGORIES
// =============================================================================

export type NodeCategory =
  | 'indicators'
  | 'conditions'
  | 'actions'
  | 'environment'
  | 'variables'
  | 'control'
  | 'math'
  | 'risk'
  | 'tradeInfo'
  | 'llm';

// =============================================================================
// INDICATOR NODE TYPES
// =============================================================================

export type IndicatorType =
  // Moving Averages
  | 'sma' | 'ema' | 'smma' | 'lwma' | 'dema' | 'tema' | 'frama' | 'vidya' | 'ama'
  // Oscillators
  | 'rsi' | 'cci' | 'williamsR' | 'mfi' | 'momentum' | 'osma' | 'rvi' | 'stochastic' | 'trix'
  | 'ac' | 'ao' | 'chaikin' | 'demarker' | 'force'
  // MACD
  | 'macd'
  // Bands & Channels
  | 'bb' | 'envelopes' | 'donchian' | 'keltner'
  // Complex
  | 'ichimoku' | 'alligator' | 'gator' | 'dmi' | 'adx' | 'adxWilder'
  // Volatility
  | 'atr' | 'stddev'
  // Trend
  | 'sar' | 'supertrend'
  // Volume
  | 'obv' | 'volumes' | 'bwmfi' | 'ad' | 'vwap'
  // Power
  | 'bearsPower' | 'bullsPower'
  // Other
  | 'fractals' | 'highest' | 'lowest' | 'support' | 'resistance';

// =============================================================================
// CONDITION NODE TYPES
// =============================================================================

export type ConditionType =
  | 'compare'        // A > B, A < B, A == B, etc.
  | 'crossover'      // A crosses above B
  | 'crossunder'     // A crosses below B
  | 'threshold'      // A is above/below threshold
  | 'range'          // A is within range
  | 'and'            // Logical AND
  | 'or'             // Logical OR
  | 'not';           // Logical NOT

export type ComparisonOperator = '==' | '!=' | '>' | '>=' | '<' | '<=';

// =============================================================================
// ACTION NODE TYPES
// =============================================================================

export type ActionType =
  | 'order'          // Place market/limit order
  | 'closePosition'  // Close specific position
  | 'closeAll'       // Close all positions
  | 'stopLoss'       // Set stop loss
  | 'takeProfit'     // Set take profit
  | 'trailingStop'   // Trailing stop
  | 'notification'   // Send alert
  | 'log';           // Log to console

export type OrderDirection = 'long' | 'short';
export type OrderType = 'market' | 'limit' | 'stop';
export type SizeType = 'lots' | 'usd' | 'percent';

// =============================================================================
// ENVIRONMENT NODE TYPES
// =============================================================================

export type EnvironmentType =
  | 'price'          // Current price (bid/ask/mid)
  | 'spread'         // Current spread
  | 'prevCandleOpen' // Previous candle open
  | 'prevCandleClose'// Previous candle close
  | 'time'           // Current time
  | 'dayOfWeek'      // Day of week
  | 'newCandleOpen'  // New candle opened
  | 'isMarketOpen';  // Is market open

// =============================================================================
// CONTROL NODE TYPES
// =============================================================================

export type ControlType =
  | 'if'             // If condition
  | 'ifElse'         // If-else
  | 'repeat'         // Repeat N times
  | 'repeatUntil'    // Repeat until condition
  | 'wait'           // Wait N seconds
  | 'waitUntil'      // Wait until condition
  | 'stop';          // Stop execution

// =============================================================================
// VARIABLE NODE TYPES
// =============================================================================

export type VariableType =
  | 'setVariable'    // Set variable value
  | 'getVariable'    // Get variable value
  | 'changeVariable' // Change variable by amount
  | 'defineFunction' // Define a function
  | 'callFunction'   // Call a function
  | 'return';        // Return from function

// =============================================================================
// MATH NODE TYPES
// =============================================================================

export type MathType =
  | 'add'            // A + B
  | 'subtract'       // A - B
  | 'multiply'       // A * B
  | 'divide'         // A / B
  | 'number'         // Literal number
  | 'advancedMath';  // sqrt, abs, sin, cos, etc.

export type AdvancedMathFunction =
  | 'sqrt' | 'abs' | 'sin' | 'cos' | 'tan' | 'log' | 'exp' | 'floor' | 'ceil' | 'round';

// =============================================================================
// NODE DATA INTERFACES
// =============================================================================

export interface BaseNodeData {
  label: string;
  description?: string;
  locked?: boolean;
  [key: string]: unknown; // Index signature for ReactFlow compatibility
}

// Indicator Node Data
export interface IndicatorNodeData extends BaseNodeData {
  indicatorType: IndicatorType;
  timeframe: string;
  params: Record<string, number | string>;
}

// Condition Node Data
export interface ConditionNodeData extends BaseNodeData {
  conditionType: ConditionType;
  operator?: ComparisonOperator;
  value?: number;
  minValue?: number;
  maxValue?: number;
}

// Action Node Data
export interface ActionNodeData extends BaseNodeData {
  actionType: ActionType;
  // Order specific
  direction?: OrderDirection;
  orderType?: OrderType;
  size?: number;
  sizeType?: SizeType;
  limitPrice?: number;
  // Stop/TP specific
  stopPrice?: number;
  takeProfitPrice?: number;
  trailingDistance?: number;
  // Notification specific
  message?: string;
  channel?: 'email' | 'sms' | 'telegram' | 'discord';
}

// Environment Node Data
export interface EnvironmentNodeData extends BaseNodeData {
  environmentType: EnvironmentType;
  priceType?: 'bid' | 'ask' | 'mid';
  shift?: number;
}

// Control Node Data
export interface ControlNodeData extends BaseNodeData {
  controlType: ControlType;
  repeatCount?: number;
  waitSeconds?: number;
}

// Variable Node Data
export interface VariableNodeData extends BaseNodeData {
  variableType: VariableType;
  variableName?: string;
  value?: number | string;
  functionName?: string;
}

// Math Node Data
export interface MathNodeData extends BaseNodeData {
  mathType: MathType;
  value?: number;                    // For 'number' type
  mathFunction?: AdvancedMathFunction; // For 'advancedMath' type
}

// LLM Node Data
export interface LLMNodeData extends BaseNodeData {
  prompt: string;
  schema?: Record<string, unknown>;
  fallback?: Record<string, unknown>;
}

// =============================================================================
// RISK NODE TYPES
// =============================================================================

export type RiskType =
  | 'maxDrawdown'
  | 'dailyLossLimit'
  | 'positionPercent'
  | 'kellyCriterion'
  | 'fixedAmount'
  | 'trailingStop'
  | 'scaleIn'
  | 'scaleOut';

export interface RiskNodeData extends BaseNodeData {
  riskType: RiskType;
  value?: number;
  percentage?: number;
}

// =============================================================================
// TRADE INFO NODE TYPES
// =============================================================================

export type TradeInfoType =
  | 'entryPrice'
  | 'positionSize'
  | 'pnl'
  | 'tradeDuration';

export interface TradeInfoNodeData extends BaseNodeData {
  tradeInfoType: TradeInfoType;
  tradeId?: string;
}

// Union type for all node data
export type StrategyNodeData =
  | IndicatorNodeData
  | ConditionNodeData
  | ActionNodeData
  | EnvironmentNodeData
  | ControlNodeData
  | VariableNodeData
  | MathNodeData
  | RiskNodeData
  | TradeInfoNodeData
  | LLMNodeData;

// =============================================================================
// STRATEGY FLOW NODE TYPES
// =============================================================================

export type StrategyFlowNodeType =
  | 'indicator'
  | 'condition'
  | 'action'
  | 'environment'
  | 'control'
  | 'variable'
  | 'math'
  | 'risk'
  | 'tradeInfo'
  | 'llm'
  | 'comment';

// ReactFlow Node with our data
export type StrategyFlowNode = Node<StrategyNodeData, StrategyFlowNodeType>;
export type StrategyFlowEdge = Edge;

// =============================================================================
// SIDEBAR TYPES
// =============================================================================

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  tooltip: string;
}

export type LeftSidebarTab =
  | 'nodes'      // Node palette
  | 'search'     // Search blocks
  | 'templates'  // Strategy templates
  | 'history'    // Undo/redo history
  | 'settings';  // Workspace settings

// =============================================================================
// PROPERTY PANEL TYPES
// =============================================================================

export interface PropertyPanelState {
  isOpen: boolean;
  selectedNodeId: string | null;
  selectedNodeType: StrategyFlowNodeType | null;
}

// =============================================================================
// STORE STATE
// =============================================================================

export interface StrategyFlowState {
  // Canvas State
  nodes: StrategyFlowNode[];
  edges: StrategyFlowEdge[];
  viewport: Viewport;

  // Selection
  selectedNodeId: string | null;

  // Sidebar State
  leftSidebarOpen: boolean;
  leftSidebarTab: LeftSidebarTab;
  rightPanelOpen: boolean;

  // Strategy Metadata
  strategyName: string;
  strategyDescription: string;
  isModified: boolean;

  // Execution State
  isRunning: boolean;

  // History
  canUndo: boolean;
  canRedo: boolean;
}

// =============================================================================
// NODE CATALOG (for the palette)
// =============================================================================

export interface NodeCatalogItem {
  type: string;
  nodeType: StrategyFlowNodeType;
  label: string;
  description: string;
  category: NodeCategory;
  subcategory?: string;
  icon: string;
  color: string;
  defaultData: Partial<StrategyNodeData>;
  // New fields for enhanced tooltips and From/To badges
  inputs?: string[];   // What the node accepts (e.g., ['Price', 'Number'])
  outputs?: string[];  // What the node produces (e.g., ['Number', 'Signal'])
  tooltip?: string;    // Extended trading explanation
}

// =============================================================================
// TIMEFRAME OPTIONS
// =============================================================================

export const TIMEFRAME_OPTIONS = [
  { value: '1', label: '1 Minute' },
  { value: '5', label: '5 Minutes' },
  { value: '15', label: '15 Minutes' },
  { value: '30', label: '30 Minutes' },
  { value: '60', label: '1 Hour' },
  { value: '240', label: '4 Hours' },
  { value: '1440', label: '1 Day' },
  { value: '10080', label: '1 Week' },
  { value: '43200', label: '1 Month' },
] as const;

// =============================================================================
// HANDLE TYPES
// =============================================================================

export type HandleType = 'source' | 'target';
export type HandlePosition = 'top' | 'right' | 'bottom' | 'left';

export interface HandleConfig {
  id: string;
  type: HandleType;
  position: HandlePosition;
  label?: string;
  dataType?: 'number' | 'boolean' | 'signal' | 'any';
}
