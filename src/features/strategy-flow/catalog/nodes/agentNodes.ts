/**
 * Agent Nodes — ADK Agent integration nodes for the strategy canvas.
 * Each node runs a specific ADK agent and outputs its analysis results.
 */
import { NodeCatalogItem } from '../../types';

export const AGENT_NODES: NodeCatalogItem[] = [
    // =========================================================================
    // Analysis Agents
    // =========================================================================
    {
        type: 'newsAgentNode',
        nodeType: 'agent',
        label: 'News Analyst',
        description: 'AI news impact analysis',
        tooltip: 'Analyzes recent news headlines against your portfolio holdings. Uses LLM to assess sentiment, relevance, and impact. Outputs actionable signals (bullish/bearish) with confidence scores.',
        inputs: ['Trigger', 'Symbols'],
        outputs: ['Signal', 'Confidence', 'Findings'],
        category: 'agents',
        subcategory: 'Analysis',
        icon: 'Newspaper',
        color: '#3b82f6',
        backtestEligible: false,
        defaultData: {
            agentNodeType: 'newsAgentNode',
            agentType: 'news_analyst',
            model: 'gemini-2.0-flash',
            symbols: [],
            confidenceThreshold: 0.5,
        },
    },
    {
        type: 'macroAgentNode',
        nodeType: 'agent',
        label: 'Macro Analyst',
        description: 'Macroeconomic analysis',
        tooltip: 'Analyzes macroeconomic indicators (CPI, GDP, rates, employment) and their impact on your portfolio. Classifies the current macro regime and identifies risk/opportunity flags.',
        inputs: ['Trigger', 'Symbols'],
        outputs: ['Signal', 'Confidence', 'Findings'],
        category: 'agents',
        subcategory: 'Analysis',
        icon: 'Globe',
        color: '#8b5cf6',
        backtestEligible: false,
        defaultData: {
            agentNodeType: 'macroAgentNode',
            agentType: 'macro_analyst',
            model: 'gemini-2.0-flash',
            symbols: [],
            confidenceThreshold: 0.5,
        },
    },
    {
        type: 'technicalAgentNode',
        nodeType: 'agent',
        label: 'Technical Analyst',
        description: 'AI technical analysis',
        tooltip: 'Runs comprehensive technical analysis using indicators, candlestick patterns, support/resistance levels, and market regime classification. Provides directional signals with confidence.',
        inputs: ['Trigger', 'Symbols'],
        outputs: ['Signal', 'Confidence', 'Findings'],
        category: 'agents',
        subcategory: 'Analysis',
        icon: 'LineChart',
        color: '#06b6d4',
        backtestEligible: false,
        defaultData: {
            agentNodeType: 'technicalAgentNode',
            agentType: 'technical_analyst',
            model: 'gemini-2.0-flash',
            symbols: [],
            confidenceThreshold: 0.5,
        },
    },
    {
        type: 'socialAgentNode',
        nodeType: 'agent',
        label: 'Social Monitor',
        description: 'Social media sentiment',
        tooltip: 'Monitors social media feeds (Twitter/X, Reddit) for sentiment shifts and trending discussions about your portfolio holdings. Detects viral posts and sentiment extremes.',
        inputs: ['Trigger', 'Symbols'],
        outputs: ['Signal', 'Confidence', 'Findings'],
        category: 'agents',
        subcategory: 'Analysis',
        icon: 'MessageCircle',
        color: '#ec4899',
        backtestEligible: false,
        defaultData: {
            agentNodeType: 'socialAgentNode',
            agentType: 'social_monitor',
            model: 'gemini-2.0-flash',
            symbols: [],
            confidenceThreshold: 0.5,
        },
    },
    // =========================================================================
    // Synthesis Agents
    // =========================================================================
    {
        type: 'synthesisAgentNode',
        nodeType: 'agent',
        label: 'Synthesis Agent',
        description: 'Multi-source synthesis',
        tooltip: 'Combines outputs from multiple analyst agents into a unified recommendation. Weighs conflicting signals, identifies consensus, and produces a final actionable view with confidence scoring.',
        inputs: ['Trigger', 'Symbols', 'Agent Data'],
        outputs: ['Signal', 'Confidence', 'Recommendation'],
        category: 'agents',
        subcategory: 'Synthesis',
        icon: 'Sparkles',
        color: '#f59e0b',
        backtestEligible: false,
        defaultData: {
            agentNodeType: 'synthesisAgentNode',
            agentType: 'synthesis',
            model: 'gemini-2.0-flash',
            symbols: [],
            confidenceThreshold: 0.6,
        },
    },
    {
        type: 'fundamentalsAgentNode',
        nodeType: 'agent',
        label: 'Fundamentals Agent',
        description: 'Financial health analysis',
        tooltip: 'Analyzes company fundamentals: financial ratios, growth metrics, profitability, and balance sheet health. Compares against peers and provides a financial health score.',
        inputs: ['Trigger', 'Symbols'],
        outputs: ['Signal', 'Confidence', 'Findings'],
        category: 'agents',
        subcategory: 'Analysis',
        icon: 'Building2',
        color: '#10b981',
        backtestEligible: false,
        defaultData: {
            agentNodeType: 'fundamentalsAgentNode',
            agentType: 'fundamentals_analyst',
            model: 'gemini-2.0-flash',
            symbols: [],
            confidenceThreshold: 0.5,
        },
    },
    {
        type: 'sentimentAgentNode',
        nodeType: 'agent',
        label: 'Sentiment Agent',
        description: 'Multi-source sentiment fusion',
        tooltip: 'Fuses sentiment from news, social media, and options flow into a composite sentiment score. Detects sentiment divergences and extreme readings that may signal turning points.',
        inputs: ['Trigger', 'Symbols'],
        outputs: ['Signal', 'Confidence', 'Score'],
        category: 'agents',
        subcategory: 'Analysis',
        icon: 'Heart',
        color: '#ef4444',
        backtestEligible: false,
        defaultData: {
            agentNodeType: 'sentimentAgentNode',
            agentType: 'sentiment_analyst',
            model: 'gemini-2.0-flash',
            symbols: [],
            confidenceThreshold: 0.5,
        },
    },
    // =========================================================================
    // Quant Agent — invokes terminal functions (HDS, DES, GIP, SPLC, WEI, …)
    // =========================================================================
    {
        type: 'quantAgentNode',
        nodeType: 'agent',
        label: 'Quant Agent',
        description: 'Terminal-function analyst',
        tooltip: 'Quantitative agent with read access to Bloomberg-style terminal functions (HDS holders, DES description, GIP intraday graph, SPLC supply chain, WEI world indices, …). Pick which functions it can call; the agent fetches each one, synthesizes the data, and emits a signal with confidence.',
        inputs: ['Trigger', 'Symbols'],
        outputs: ['Signal', 'Confidence', 'Findings'],
        category: 'agents',
        subcategory: 'Research',
        icon: 'Calculator',
        color: '#6366f1',
        backtestEligible: false,
        defaultData: {
            agentNodeType: 'quantAgentNode',
            agentType: 'quant_analyst',
            model: 'gemini-2.0-flash',
            symbols: [],
            confidenceThreshold: 0.5,
            // Default: give it access to every currently registered terminal tool.
            terminalTools: ['HDS', 'DES', 'GIP', 'SPLC', 'WEI'],
            terminalToolMaxCalls: 8,
        },
    },
    // =========================================================================
    // Research Agent
    // =========================================================================
    {
        type: 'researchAgentNode',
        nodeType: 'agent',
        label: 'Research Agent',
        description: 'Quantitative research & backtesting',
        tooltip: 'Runs quantitative research using the app\'s built-in tools: QuantStats analysis, Monte Carlo simulations, VaR/CVaR risk assessment, stress testing, and parameter optimization. Outputs data-driven insights to inform trading decisions.',
        inputs: ['Trigger', 'Symbols'],
        outputs: ['Signal', 'Confidence', 'Findings'],
        category: 'agents',
        subcategory: 'Research',
        icon: 'FlaskConical',
        color: '#14b8a6',
        backtestEligible: false,
        defaultData: {
            agentNodeType: 'researchAgentNode',
            agentType: 'research_analyst',
            model: 'gemini-2.0-flash',
            symbols: [],
            confidenceThreshold: 0.5,
            researchTools: ['quantstats', 'var', 'stress_test'],
            researchDepth: 'standard',
        },
    },
    // =========================================================================
    // Persisted-output query — reads the latest agent_runs row.
    // Unlike the inline analysis nodes above, this one does NOT call an LLM.
    // It returns the most recent persisted output for (agent_type, symbol)
    // from the cron scheduler or any prior ad-hoc run. Lets a strategy
    // consume yesterday's news_analyst output without re-running the agent.
    // =========================================================================
    {
        type: 'agentRunQuery',
        nodeType: 'agent',
        label: 'Agent Run (Latest)',
        description: 'Read the latest stored agent output',
        tooltip: 'Reads the most recent persisted output of any agent (news_analyst, technical_analyst, etc.) from `agent_runs`. Cheap (no LLM call). Pair with a scheduled cron run so this node always has fresh data.',
        inputs: ['Trigger'],
        outputs: ['Signal', 'Confidence', 'Summary'],
        category: 'agents',
        subcategory: 'Persisted',
        icon: 'History',
        color: '#64748b',
        backtestEligible: false,
        defaultData: {
            agentNodeType: 'agentRunQuery',
            agentType: 'news_analyst',
            symbol: '',
            maxAgeMinutes: 60,
        },
    },
    // Schedules a recurring agent run. The node itself does nothing at
    // execute-time — its purpose is to declare "this strategy assumes
    // news_analyst runs every 30 min" so the deploy step can register
    // the schedule with /compute/agents/schedule.
    {
        type: 'scheduledAgentRun',
        nodeType: 'agent',
        label: 'Schedule Agent (Cron)',
        description: 'Cron-fire an agent every N minutes',
        tooltip: 'Declarative cron: registers the agent + symbols + interval into `scheduled_agents`. The backend scheduler thread fires it on schedule; each run lands in `agent_runs` for downstream nodes to read.',
        inputs: [],
        outputs: ['Signal'],
        category: 'agents',
        subcategory: 'Persisted',
        icon: 'AlarmClock',
        color: '#0ea5e9',
        backtestEligible: false,
        defaultData: {
            agentNodeType: 'scheduledAgentRun',
            agentType: 'news_analyst',
            symbols: [],
            intervalMinutes: 30,
            enabled: true,
        },
    },
];
