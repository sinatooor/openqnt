/**
 * ADK Agents Page — Monitor and run Google ADK multi-agent pipeline.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Activity,
  Zap,
  Globe,
  TrendingUp,
  Newspaper,
  Users,
  Layers,
  Code2,
  Network,
  Play,
  Square,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Loader2,
  FlaskConical,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const PYTHON_BASE = import.meta.env.VITE_PYTHON_BACKEND_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

/* ─── Agent catalogue ─────────────────────────────────────── */
const AGENTS = [
  {
    key: 'news_analyst',
    label: 'News Analyst',
    icon: <Newspaper className="w-5 h-5" />,
    color: 'blue',
    description: 'Scans financial news feeds, extracts sentiment signals, and scores impact per symbol.',
    tools: ['search_market_news', 'search_economic_calendar', 'news_tools'],
    pipeline: true,
  },
  {
    key: 'macro_analyst',
    label: 'Macro Analyst',
    icon: <Globe className="w-5 h-5" />,
    color: 'amber',
    description: 'Evaluates macro-economic events — CPI, rate decisions, GDP — and assesses market regime.',
    tools: ['market_regime_tools', 'search_economic_calendar', 'market_data_tools'],
    pipeline: true,
  },
  {
    key: 'social_monitor',
    label: 'Social Monitor',
    icon: <Users className="w-5 h-5" />,
    color: 'purple',
    description: 'Monitors social media and community sentiment for retail trader positioning signals.',
    tools: ['web_scraper_tools', 'search_tools', 'screener_tools'],
    pipeline: true,
  },
  {
    key: 'technical_analyst',
    label: 'Technical Analyst',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'green',
    description: 'Computes technical indicators (RSI, SMA, EMA, MACD, Bollinger Bands) and detects chart patterns.',
    tools: ['technical_analysis_tools', 'pattern_recognition_tools', 'market_data_tools'],
    pipeline: true,
  },
  {
    key: 'synthesis',
    label: 'Synthesis Agent',
    icon: <Layers className="w-5 h-5" />,
    color: 'rose',
    description: 'Aggregates all specialist agent outputs into a unified buy/sell/hold action plan with confidence scores.',
    tools: ['risk_tools', 'portfolio_tools', 'planning_tools'],
    pipeline: true,
  },
  {
    key: 'trading_agent',
    label: 'Trading Agent',
    icon: <Zap className="w-5 h-5" />,
    color: 'cyan',
    description: 'Executes live trades, manages positions, and interacts with broker APIs. Not in the pipeline endpoint.',
    tools: ['broker_tools', 'broker_discovery', 'connector_tools', 'rag_tools'],
    pipeline: false,
  },
  {
    key: 'exploratory_agent',
    label: 'Exploratory Agent',
    icon: <FlaskConical className="w-5 h-5" />,
    color: 'indigo',
    description: 'Researches new strategy ideas, searches the codebase for improvement opportunities.',
    tools: ['exploration_tools', 'file_tools', 'notebook_tools'],
    pipeline: false,
  },
  {
    key: 'developer_agent',
    label: 'Developer Agent',
    icon: <Code2 className="w-5 h-5" />,
    color: 'orange',
    description: 'Implements code changes discovered by the exploratory agent during the self-improvement loop.',
    tools: ['file_tools', 'strategy_control_tools'],
    pipeline: false,
  },
  {
    key: 'agent_orchestrator',
    label: 'Agent Orchestrator',
    icon: <Network className="w-5 h-5" />,
    color: 'pink',
    description: 'Coordinates the full multi-agent lifecycle: exploratory → developer → validate → deploy.',
    tools: ['all sub-agents'],
    pipeline: false,
  },
] as const;

type AgentKey = typeof AGENTS[number]['key'];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   text: 'text-blue-400',   badge: 'bg-blue-500/15 text-blue-300' },
  amber:  { bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  text: 'text-amber-400',  badge: 'bg-amber-500/15 text-amber-300' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', badge: 'bg-purple-500/15 text-purple-300' },
  green:  { bg: 'bg-green-500/10',  border: 'border-green-500/20',  text: 'text-green-400',  badge: 'bg-green-500/15 text-green-300' },
  rose:   { bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   text: 'text-rose-400',   badge: 'bg-rose-500/15 text-rose-300' },
  cyan:   { bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   text: 'text-cyan-400',   badge: 'bg-cyan-500/15 text-cyan-300' },
  indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400', badge: 'bg-indigo-500/15 text-indigo-300' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', badge: 'bg-orange-500/15 text-orange-300' },
  pink:   { bg: 'bg-pink-500/10',   border: 'border-pink-500/20',   text: 'text-pink-400',   badge: 'bg-pink-500/15 text-pink-300' },
};

/* ─── Pipeline runner state ───────────────────────────────── */
type RunStatus = 'idle' | 'running' | 'success' | 'error';

interface PipelineState {
  status: RunStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  expandedAgents: Set<AgentKey>;
}

/* ─── Quick-run individual agent state ───────────────────── */
type AgentRunState = Record<string, { status: RunStatus; result: any; error: string | null }>;

const DEFAULT_SYMBOLS = ['AAPL', 'SPY'];

const AdkAgents = () => {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [agentTypes, setAgentTypes] = useState<{ type: string; description: string }[]>([]);
  const [pipeline, setPipeline] = useState<PipelineState>({
    status: 'idle',
    result: null,
    error: null,
    expandedAgents: new Set(),
  });
  const [agentRuns, setAgentRuns] = useState<AgentRunState>({});
  const [symbols, setSymbols] = useState(DEFAULT_SYMBOLS.join(', '));

  // ADK Web UI process state
  const [adkWeb, setAdkWeb] = useState<{
    launching: boolean;
    running: boolean;
    url: string | null;
    port: number | null;
    error: string | null;
  }>({ launching: false, running: false, url: null, port: null, error: null });

  /* ── Check backend health ────────────────────────────────── */
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${PYTHON_BASE}/health`, { signal: AbortSignal.timeout(4000) });
      setBackendOnline(res.ok);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  /* ── Fetch available agent types from backend ────────────── */
  const fetchAgentTypes = useCallback(async () => {
    try {
      const res = await fetch(`${PYTHON_BASE}/compute/agents/types`);
      if (res.ok) {
        const data = await res.json();
        setAgentTypes(data.agents ?? []);
      }
    } catch { /* offline */ }
  }, []);

  useEffect(() => {
    checkHealth();
    fetchAgentTypes();
    // Also poll adk web status
    const syncAdkStatus = async () => {
      try {
        const res = await fetch(`${PYTHON_BASE}/adk/status`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          setAdkWeb(prev => ({
            ...prev,
            running: data.running,
            url: data.url,
            port: data.port,
          }));
        }
      } catch { /* backend offline */ }
    };
    syncAdkStatus();
    const id = setInterval(() => { checkHealth(); syncAdkStatus(); }, 15_000);
    return () => clearInterval(id);
  }, [checkHealth, fetchAgentTypes]);

  /* ── Launch ADK Web UI ───────────────────────────────────── */
  const launchAdkWeb = async () => {
    setAdkWeb(prev => ({ ...prev, launching: true, error: null }));
    try {
      const res = await fetch(`${PYTHON_BASE}/adk/start`, {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to start ADK Web UI');
      setAdkWeb({ launching: false, running: true, url: data.url, port: data.port, error: null });
      window.open(data.url, '_blank');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to launch ADK Web UI';
      setAdkWeb(prev => ({ ...prev, launching: false, error: msg }));
    }
  };

  /* ── Stop ADK Web UI ─────────────────────────────────────── */
  const stopAdkWeb = async () => {
    try {
      await fetch(`${PYTHON_BASE}/adk/stop`, { method: 'POST' });
      setAdkWeb({ launching: false, running: false, url: null, port: null, error: null });
    } catch { /* silent */ }
  };

  /* ── Run full pipeline ───────────────────────────────────── */
  const runPipeline = async () => {
    const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
    setPipeline(prev => ({ ...prev, status: 'running', result: null, error: null }));
    try {
      const res = await fetch(`${PYTHON_BASE}/compute/agents/pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: symbolList,
          news_events: [{ headline: 'Scheduled pipeline test', sentiment: 'neutral' }],
          technical_data: { symbols: symbolList },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Pipeline failed');
      setPipeline(prev => ({ ...prev, status: 'success', result: data }));
    } catch (err: any) {
      setPipeline(prev => ({ ...prev, status: 'error', error: err.message }));
    }
  };

  /* ── Run single agent ────────────────────────────────────── */
  const runAgent = async (agentType: string) => {
    const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
    setAgentRuns(prev => ({
      ...prev,
      [agentType]: { status: 'running', result: null, error: null },
    }));
    try {
      const res = await fetch(`${PYTHON_BASE}/compute/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_type: agentType,
          context: {
            symbols: symbolList,
            news_events: agentType === 'news_analyst' ? [{ headline: 'Test run', sentiment: 'neutral' }] : undefined,
            technical_data: agentType === 'technical_analyst' ? { symbols: symbolList } : undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Agent run failed');
      setAgentRuns(prev => ({ ...prev, [agentType]: { status: data.success ? 'success' : 'error', result: data, error: data.error ?? null } }));
    } catch (err: any) {
      setAgentRuns(prev => ({ ...prev, [agentType]: { status: 'error', result: null, error: err.message } }));
    }
  };

  const toggleExpand = (key: AgentKey) => {
    setPipeline(prev => {
      const next = new Set(prev.expandedAgents);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...prev, expandedAgents: next };
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground pt-16 pb-10">
      <div className="w-full max-w-none px-4 md:px-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h1 className="text-white font-medium text-sm tracking-tight">ADK Agents</h1>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-white/40 text-xs">Google AI Development Kit · Multi-Agent Pipeline</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Backend health pill */}
            <HealthPill online={backendOnline} />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-white/10 text-white/60 hover:text-white hover:border-white/20 text-xs h-7"
              onClick={checkHealth}
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20 text-xs h-7"
              onClick={() => window.open(`${PYTHON_BASE}/docs`, '_blank')}
            >
              <ExternalLink className="w-3 h-3" />
              Open API Docs
            </Button>
          </div>
        </div>

        {/* ── ADK Web UI banner ──────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
            adkWeb.running
              ? 'border-green-500/30 bg-green-500/5'
              : 'border-purple-500/20 bg-purple-500/5'
          }`}
        >
          <div className={`p-2.5 rounded-lg ${adkWeb.running ? 'bg-green-500/15' : 'bg-purple-500/15'}`}>
            <Bot className={`w-5 h-5 ${adkWeb.running ? 'text-green-400' : 'text-purple-400'}`} />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white">Google ADK Web UI</p>
              {adkWeb.running && (
                <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/15 border border-green-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Running on port {adkWeb.port}
                </span>
              )}
            </div>
            {adkWeb.running && adkWeb.url ? (
              <p className="text-xs text-white/50">
                Available at{' '}
                <button
                  onClick={() => adkWeb.url && window.open(adkWeb.url, '_blank')}
                  className="text-green-400 hover:text-green-300 underline underline-offset-2 transition-colors"
                >
                  {adkWeb.url}
                </button>
              </p>
            ) : (
              <p className="text-xs text-white/50">
                Click <span className="text-purple-300 font-medium">Launch ADK UI</span> — the backend will run{' '}
                <code className="bg-white/10 px-1 rounded text-purple-300">adk web</code>, find a free port, and open it automatically.
              </p>
            )}
            {adkWeb.error && (
              <p className="text-xs text-red-400/80 bg-red-500/10 rounded px-2 py-1">{adkWeb.error}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {adkWeb.running ? (
              <>
                <Button
                  size="sm"
                  className="gap-1.5 bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/25 text-xs h-8"
                  onClick={() => adkWeb.url && window.open(adkWeb.url, '_blank')}
                >
                  <ExternalLink className="w-3 h-3" />
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 text-xs h-8"
                  onClick={stopAdkWeb}
                >
                  <Square className="w-3 h-3" />
                  Stop
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="gap-1.5 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/25 text-xs h-8"
                onClick={launchAdkWeb}
                disabled={adkWeb.launching || !backendOnline}
              >
                {adkWeb.launching ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />Launching…</>
                ) : (
                  <><Play className="w-3 h-3" />Launch ADK UI</>
                )}
              </Button>
            )}
          </div>
        </motion.div>

        {/* ── Symbol input + pipeline trigger ───────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="bg-card/60 backdrop-blur-sm border-white/5">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Full Pipeline Run
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor="adk-symbols" className="block text-[11px] text-white/40 mb-1.5 uppercase tracking-wider">Symbols (comma-separated)</label>
                  <input
                    id="adk-symbols"
                    className="w-full h-9 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    value={symbols}
                    onChange={e => setSymbols(e.target.value)}
                    placeholder="AAPL, SPY, TSLA"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Button
                    onClick={runPipeline}
                    disabled={pipeline.status === 'running' || !backendOnline}
                    className="gap-2 bg-primary hover:bg-primary/90 text-white text-xs h-9"
                  >
                    {pipeline.status === 'running' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {pipeline.status === 'running' ? 'Running…' : 'Run Pipeline'}
                  </Button>
                </div>
              </div>

              {/* Pipeline status */}
              <AnimatePresence>
                {pipeline.status !== 'idle' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    {pipeline.status === 'running' && (
                      <div className="flex items-center gap-2 text-xs text-blue-400 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Running all agents in parallel…
                      </div>
                    )}
                    {pipeline.status === 'error' && (
                      <div className="flex items-start gap-2 text-xs text-red-400 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{pipeline.error}</span>
                      </div>
                    )}
                    {pipeline.status === 'success' && pipeline.result && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-green-400 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Pipeline completed — {Object.keys(pipeline.result.agent_outputs ?? {}).length} agents ran
                        </div>
                        {/* Synthesis summary */}
                        {pipeline.result.synthesis && (
                          <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5 space-y-2">
                            <p className="text-[11px] text-white/40 uppercase tracking-wider">Synthesis Decision</p>
                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge
                                className="capitalize text-xs"
                                style={signalBadgeStyle(pipeline.result.synthesis.overall_signal)}
                              >
                                {pipeline.result.synthesis.overall_signal ?? 'neutral'}
                              </Badge>
                              <span className="text-xs text-white/50">
                                Confidence: <span className="text-white/80 font-mono">
                                  {((pipeline.result.synthesis.overall_confidence ?? 0) * 100).toFixed(0)}%
                                </span>
                              </span>
                            </div>
                            {pipeline.result.synthesis.summary && (
                              <p className="text-xs text-white/60 leading-relaxed">{pipeline.result.synthesis.summary}</p>
                            )}
                          </div>
                        )}
                        {/* Per-agent outputs */}
                        {Object.entries(pipeline.result.agent_outputs ?? {}).map(([key, output]: [string, any]) => {
                          const agentDef = AGENTS.find(a => a.key === key);
                          const c = COLOR_MAP[agentDef?.color ?? 'blue'];
                          const isExpanded = pipeline.expandedAgents.has(key as AgentKey);
                          return (
                            <div key={key} className={`rounded-lg border ${c.border} ${c.bg} overflow-hidden`}>
                              <button
                                onClick={() => toggleExpand(key as AgentKey)}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${c.text}`}>{agentDef?.label ?? key}</span>
                                  <Badge className={`text-[10px] ${c.badge} border-none`}>
                                    {output.overall_signal ?? output.signal ?? 'done'}
                                  </Badge>
                                  {output.error && <Badge className="text-[10px] bg-red-500/15 text-red-300 border-none">error</Badge>}
                                </div>
                                {isExpanded ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
                              </button>
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <ScrollArea className="max-h-48">
                                      <pre className="px-3 pb-3 text-[11px] text-white/50 whitespace-pre-wrap leading-relaxed">
                                        {JSON.stringify(output, null, 2)}
                                      </pre>
                                    </ScrollArea>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Agent cards grid ───────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {AGENTS.map((agent, i) => {
            const c = COLOR_MAP[agent.color];
            const run = agentRuns[agent.key];
            const registeredInBackend = agentTypes.some(a => a.type === agent.key);

            return (
              <motion.div
                key={agent.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className={`bg-card/60 backdrop-blur-sm border ${c.border} h-full flex flex-col`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${c.bg} ${c.text}`}>
                          {agent.icon}
                        </div>
                        <div>
                          <CardTitle className="text-sm text-white">{agent.label}</CardTitle>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {agent.pipeline && (
                              <Badge className="text-[10px] bg-primary/15 text-primary border-none">pipeline</Badge>
                            )}
                            {registeredInBackend ? (
                              <Badge className="text-[10px] bg-green-500/15 text-green-400 border-none">registered</Badge>
                            ) : (
                              <Badge className="text-[10px] bg-white/10 text-white/40 border-none">local only</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Per-agent run status */}
                      {run?.status === 'running' && <Loader2 className="w-4 h-4 text-white/40 animate-spin shrink-0" />}
                      {run?.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />}
                      {run?.status === 'error' && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-3 pt-0">
                    <p className="text-xs text-white/50 leading-relaxed">{agent.description}</p>

                    {/* Tools list */}
                    <div className="flex flex-wrap gap-1">
                      {agent.tools.map(tool => (
                        <span key={tool} className={`text-[10px] px-2 py-0.5 rounded-full ${c.badge}`}>
                          {tool}
                        </span>
                      ))}
                    </div>

                    {/* Error from single run */}
                    {run?.status === 'error' && (
                      <p className="text-[11px] text-red-400/80 bg-red-500/10 rounded-lg px-2.5 py-1.5 leading-relaxed">
                        {run.error}
                      </p>
                    )}

                    {/* Success output preview */}
                    {run?.status === 'success' && run.result && (
                      <div className="text-[11px] text-white/50 bg-white/[0.03] rounded-lg px-2.5 py-1.5 leading-relaxed">
                        <span className="text-white/30">signal: </span>
                        <span className={`font-medium ${c.text}`}>
                          {run.result?.output?.overall_signal ?? run.result?.output?.signal ?? 'done'}
                        </span>
                        {run.result?.output?.overall_confidence !== undefined && (
                          <span className="text-white/30 ml-2">
                            confidence: <span className="text-white/60 font-mono">
                              {((run.result.output.overall_confidence) * 100).toFixed(0)}%
                            </span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Run button — only for pipeline agents */}
                    {agent.pipeline && (
                      <button
                        onClick={() => runAgent(agent.key)}
                        disabled={run?.status === 'running' || !backendOnline}
                        className={`mt-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${c.border} ${c.bg} ${c.text} hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        {run?.status === 'running' ? (
                          <><Loader2 className="w-3 h-3 animate-spin" />Running…</>
                        ) : (
                          <><Play className="w-3 h-3" />Run Agent</>
                        )}
                      </button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* ── Backend not available notice ───────────────────── */}
        <AnimatePresence>
          {backendOnline === false && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 rounded-xl border border-amber-500/25 bg-amber-500/5 text-xs text-amber-400/80"
            >
              <strong className="text-amber-300">Python backend is offline.</strong>
              {' '}Start it with:{' '}
              <code className="ml-2 bg-black/30 px-2 py-0.5 rounded font-mono">
                conda activate fyer &amp;&amp; cd backend &amp;&amp; uvicorn main:app --reload --port 8000
              </code>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

/* ─── Helpers ─────────────────────────────────────────────── */

function signalBadgeStyle(signal: string): React.CSSProperties {
  if (signal === 'buy') return { background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: 'none' };
  if (signal === 'sell') return { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'none' };
  return { background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: 'none' };
}

const HealthPill = ({ online }: { online: boolean | null }) => {
  if (online === null) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-white/10 text-white/40">
        <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
        Checking…
      </div>
    );
  }
  if (online) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-green-500/30 text-green-400 bg-green-500/10">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Python API Online
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-red-500/30 text-red-400 bg-red-500/10">
      <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
      Python API Offline
    </div>
  );
};

export default AdkAgents;
