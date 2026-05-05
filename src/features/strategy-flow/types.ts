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
  | 'llm'
  | 'triggers'
  | 'integrations'
  | 'pineScript'
  | 'portfolio'
  | 'agents'
  | 'dataSources';

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
  | 'ichimoku' | 'alligator' | 'gator' | 'dmi' | 'adx' | 'adxWilder' | 'aroon' | 'stochRSI'
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
  | 'options_order'  // Options trading order
  | 'portfolio_rebalance' // Rebalance portfolio
  | 'phoneCall'      // Outbound phone call (e.g. urgent risk alert)
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
  detachedInputs?: string[]; // Tracks which inputs are using edge connections instead of manual values
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
  inputA?: number | string;
  inputB?: number | string;
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
  // Options specific
  optionType?: 'call' | 'put';
  strike?: string;
  // Portfolio rebalance specific
  rebalanceThresholdPercent?: number;
  // Notification specific
  message?: string;
  channel?: 'email' | 'sms' | 'telegram' | 'discord';
  // Phone-call specific (Twilio Voice action)
  phoneNumber?: string;
  voiceType?: 'alice' | 'man' | 'woman' | 'Polly.Joanna';
  urgencyLevel?: 'low' | 'medium' | 'high';
  // Stop/TP distance modes
  stopDistance?: 'percent' | 'atr_multiple';
  stopPercent?: number;
  profitDistance?: 'percent' | 'atr_multiple';
  profitPercent?: number;
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
  inputA?: number; // Manual fallback for math operations
  inputB?: number; // Manual fallback for math operations
  input?: number;  // Manual fallback for advancedMath
}

// =============================================================================
// LLM NODE TYPES
// =============================================================================

export type LLMNodeType =
  | 'llmDecision'              // Generic LLM decision
  | 'sentimentAnalysis'        // Analyze market sentiment from text/news
  | 'regimeDetection'          // Detect market regime (trending/ranging/volatile)
  | 'nlStrategyRules'          // Natural language strategy rules
  | 'parameterTuning'          // LLM-suggested parameter optimization
  | 'marketRegimeClassification' // Classify market conditions
  | 'newsSentimentSignal'      // Convert news sentiment to trading signal
  | 'customCode';              // Custom Python/JS code with Monaco editor

export type LLMModelProvider = 'openai' | 'anthropic' | 'google';

export type LLMModel =
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'claude-3-haiku'
  | 'gemini-pro'
  | 'gemini-pro-1.5';

export const LLM_MODELS: { id: LLMModel; label: string; provider: LLMModelProvider }[] = [
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'openai' },
  { id: 'claude-3-opus', label: 'Claude 3 Opus', provider: 'anthropic' },
  { id: 'claude-3-sonnet', label: 'Claude 3 Sonnet', provider: 'anthropic' },
  { id: 'claude-3-haiku', label: 'Claude 3 Haiku', provider: 'anthropic' },
  { id: 'gemini-pro', label: 'Gemini Pro', provider: 'google' },
  { id: 'gemini-pro-1.5', label: 'Gemini 1.5 Pro', provider: 'google' },
];

// LLM Node Data
export interface LLMNodeData extends BaseNodeData {
  llmType: LLMNodeType;
  prompt: string;
  model?: LLMModel;
  temperature?: number;
  maxTokens?: number;
  schema?: Record<string, unknown>;
  fallback?: Record<string, unknown>;
  // Sentiment Analysis specific
  sentimentThreshold?: number;      // -1 to 1, signal when crosses
  sentimentSource?: 'news' | 'social' | 'custom';
  // Regime Detection specific
  regimeTypes?: string[];           // e.g., ['trending', 'ranging', 'volatile']
  lookbackPeriod?: number;          // bars to analyze
  // Parameter Tuning specific
  parametersToTune?: string[];      // which params to optimize
  optimizationGoal?: 'sharpe' | 'returns' | 'drawdown';
  // Custom Code specific
  code?: string;
  language?: 'python' | 'javascript';
  customInputs?: { id: string; label: string; dataType: string }[];
  customOutputs?: { id: string; label: string; dataType: string }[];
}

// =============================================================================
// TRIGGER NODE TYPES (PRD §9.1)
// =============================================================================

export type TriggerType =
  | 'heartbeatTrigger'   // Schedule-based (BullMQ repeatable job)
  | 'webhookTrigger'     // HTTP POST (n8n-style)
  | 'priceAlertTrigger'  // Price crosses threshold
  | 'newsTrigger'        // Keyword/topic detection in news
  | 'brokerEventTrigger' // Order filled, margin call, etc.
  | 'manualTrigger'      // Explicit "Run now" (n8n Manual Trigger)
  | 'cronTrigger';       // Cron expression schedule (n8n Schedule Trigger)

export interface TriggerNodeData extends BaseNodeData {
  triggerType: TriggerType;
  // Heartbeat specific
  intervalMinutes?: number;
  atMarketOpen?: boolean;
  atMarketClose?: boolean;
  specificTime?: string | null;
  // Webhook specific
  webhookPath?: string;
  hmacSecret?: string;
  expectedFields?: string[];
  // Price alert specific
  symbol?: string;
  condition?: 'crosses_above' | 'crosses_below' | 'equals';
  priceLevel?: number;
  // News specific
  keywords?: string[];
  sources?: string[];
  symbols?: string[];
  minRelevanceScore?: number;
  // Broker event specific
  eventTypes?: string[];
  credentialAlias?: string;
  // Cron specific
  cronExpression?: string;
  timezone?: string;
}

// =============================================================================
// INTEGRATION NODE TYPES (PRD §9.2)
// =============================================================================

export type IntegrationType =
  | 'telegramNode'       // Send/receive Telegram messages
  | 'slackNode'          // Post to Slack channel
  | 'emailNode'          // Send email via SendGrid/SMTP
  | 'smsNode'            // Send SMS via Twilio
  | 'httpRequestNode'    // Generic HTTP request (n8n-style)
  | 'databaseQueryNode'  // SQL query
  | 'codePythonNode'     // Custom Python execution
  | 'codeJavascriptNode' // Custom JavaScript execution
  | 'aiAnalysisNode'     // Python ADK agent analysis
  | 'mergeNode'          // Combine outputs from multiple branches (n8n Merge)
  | 'splitNode'          // Split one output to multiple branches (n8n Split Out)
  | 'setNode'            // Set/transform fields on the payload (n8n Set)
  | 'filterNode'         // Pass through only items matching condition (n8n Filter)
  | 'aggregateNode'      // Aggregate data — sum, avg, count (n8n Aggregate)
  | 'hitlNode';          // Human-in-the-Loop approval node

export interface IntegrationNodeData extends BaseNodeData {
  integrationType: IntegrationType;
  // Communication shared
  message?: string;
  credentialAlias?: string;
  // Telegram specific
  action?: 'sendMessage' | 'waitForReply';
  chatId?: string;
  // Slack specific
  channel?: string;
  // Email specific
  to?: string;
  subject?: string;
  body?: string;
  // SMS specific
  // HTTP Request specific
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url?: string;
  headers?: Record<string, string>;
  requestBody?: any;
  authentication?: 'none' | 'basic' | 'bearer' | 'credential';
  // Database specific
  query?: string;
  parameterized?: boolean;
  // Code specific
  code?: string;
  language?: 'python' | 'javascript';
  // AI specific
  analysisType?: 'general' | 'sentiment' | 'regime' | 'recommendation';
  prompt?: string;
  context?: Record<string, unknown>;
  model?: string;
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

// =============================================================================
// PINE SCRIPT NODE TYPES
// =============================================================================

export type PineScriptNodeSubType =
  // Script Setup
  | 'pine_strategy' | 'pine_indicator' | 'pine_version'
  // Inputs
  | 'pine_input_int' | 'pine_input_float' | 'pine_input_bool' | 'pine_input_string'
  | 'pine_input_source' | 'pine_input_timeframe'
  // Data
  | 'pine_close' | 'pine_open' | 'pine_high' | 'pine_low' | 'pine_volume'
  | 'pine_time' | 'pine_bar_index'
  // Indicators
  | 'pine_ta_sma' | 'pine_ta_ema' | 'pine_ta_rsi' | 'pine_ta_macd'
  | 'pine_ta_bb' | 'pine_ta_atr' | 'pine_ta_crossover' | 'pine_ta_crossunder'
  | 'pine_ta_stoch' | 'pine_ta_vwap'
  // Conditions
  | 'pine_compare' | 'pine_and' | 'pine_or' | 'pine_not' | 'pine_ternary'
  // Strategy
  | 'pine_strategy_entry' | 'pine_strategy_close' | 'pine_strategy_exit' | 'pine_strategy_order'
  // Plotting
  | 'pine_plot' | 'pine_plotshape' | 'pine_plotchar' | 'pine_hline'
  | 'pine_bgcolor' | 'pine_barcolor' | 'pine_fill'
  // Alerts
  | 'pine_alertcondition' | 'pine_alert';

export interface PineScriptNodeData extends BaseNodeData {
  pineType?: PineScriptNodeSubType;
  // Strategy/Indicator setup
  scriptTitle?: string;
  overlay?: boolean;
  // Input params
  inputName?: string;
  inputDefault?: string | number | boolean;
  inputMinVal?: number;
  inputMaxVal?: number;
  // Indicator params
  period?: number;
  source?: string;
  // Comparison
  operator?: ComparisonOperator;
  // Strategy entry/exit
  entryId?: string;
  direction?: 'long' | 'short';
  qty?: number;
  // Plotting
  plotColor?: string;
  plotTitle?: string;
  plotLineWidth?: number;
  // Alert
  alertMessage?: string;
}

// =============================================================================
// PORTFOLIO NODE TYPES
// =============================================================================

export type PortfolioAction =
  | 'readHoldings'
  | 'totalValue'
  | 'assetWeight'
  | 'assetPnl'
  | 'dayChange'
  | 'concentrationCheck'
  | 'diversificationScore'
  | 'correlationCheck'
  | 'drawdownCheck'
  | 'rebalanceSignal'
  | 'setTargetWeight'
  | 'optimizePortfolio'
  | 'sectorExposure';

export interface PortfolioNodeData extends BaseNodeData {
  portfolioAction: PortfolioAction;
  symbol?: string;
  threshold?: number;
  driftThreshold?: number;
  targetPct?: number;
  optimizationGoal?: 'sharpe' | 'risk' | 'return';
}

// =============================================================================
// AGENT NODE TYPES
// =============================================================================

export type AgentNodeType =
  | 'newsAgentNode'
  | 'macroAgentNode'
  | 'technicalAgentNode'
  | 'sentimentAgentNode'
  | 'socialAgentNode'
  | 'fundamentalsAgentNode'
  | 'synthesisAgentNode'
  | 'researchAgentNode'
  | 'quantAgentNode';

export interface AgentNodeData extends BaseNodeData {
  agentNodeType: AgentNodeType;
  agentType: string;            // maps to backend agent_type (e.g. 'news_analyst')
  model?: string;               // LLM model override (default: gemini-2.0-flash)
  symbols?: string[];           // target symbols to analyze
  confidenceThreshold?: number; // min confidence (0-1) to emit signal output (default: 0.5)

  // News Agent settings
  newsSources?: string[];       // e.g. ['newsapi', 'sec', 'bloomberg', 'reuters']
  newsKeywords?: string[];      // additional keywords to filter news
  newsMaxAge?: number;          // max age in hours for news articles

  // Social Monitor settings
  socialPlatforms?: string[];   // e.g. ['twitter', 'reddit', 'truthsocial']
  socialAccounts?: string[];    // specific accounts to track (e.g. '@realDonaldTrump')
  socialKeywords?: string[];    // keywords/hashtags to track

  // Fundamentals Agent settings
  reportTypes?: string[];       // e.g. ['10-K', '10-Q', 'earnings', 'guidance']
  analystSources?: string[];    // e.g. ['wallstreet', 'institutional', 'insider']
  lookbackQuarters?: number;    // how many quarters of data to analyze

  // Technical Agent settings
  technicalTimeframes?: string[];  // e.g. ['1H', '4H', '1D']
  technicalIndicators?: string[];  // which indicators to focus on

  // Research Agent settings
  researchTools?: string[];     // e.g. ['quantstats', 'montecarlo', 'var', 'stress_test']
  researchDepth?: 'quick' | 'standard' | 'deep';

  // Quant Agent settings — lets the agent call into Bloomberg-style terminal
  // functions (HDS, DES, GIP, SPLC, WEI, …). Values are tool codes from
  // `src/features/terminal/agentTools/registry.ts`.
  terminalTools?: string[];
  terminalToolMaxCalls?: number;   // Safety cap on how many tool calls per run
  terminalToolTicker?: string;     // Override ticker passed to ticker-scoped tools
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
  | LLMNodeData
  | TriggerNodeData
  | IntegrationNodeData
  | PineScriptNodeData
  | PortfolioNodeData
  | AgentNodeData;

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
  | 'trigger'
  | 'integration'
  | 'pineScript'
  | 'portfolio'
  | 'agent'
  | 'dataSource'
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
  /** Whether this node supports deterministic backtesting.
   *  Nodes that depend on live data, LLMs, or external services are not backtestable.
   *  Default: true for indicators/conditions/math/etc, false for LLM/AI/webhook/news. */
  backtestEligible?: boolean;
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
