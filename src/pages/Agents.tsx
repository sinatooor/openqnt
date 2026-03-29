/**
 * Agents Page — Monitor, run, and inspect AI analysis agents.
 *
 * Shows live agent status, run history with logs, per-agent stats,
 * pipeline runner, and ADK web UI launcher.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Play,
  Square,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  ScrollText,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const PYTHON_BASE = import.meta.env.VITE_PYTHON_BACKEND_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

/* ─── Agent catalogue (matches agent_runner.py AGENT_REGISTRY) ─── */
const AGENTS = [
  { key: 'news_analyst', label: 'News Analyst', icon: <Newspaper className="w-4 h-4" />, color: 'blue', description: 'Scans financial news, extracts sentiment signals, scores impact per symbol.' },
  { key: 'macro_analyst', label: 'Macro Analyst', icon: <Globe className="w-4 h-4" />, color: 'amber', description: 'Evaluates macro-economic events — CPI, rate decisions, GDP — and market regime.' },
  { key: 'social_monitor', label: 'Social Monitor', icon: <Users className="w-4 h-4" />, color: 'purple', description: 'Monitors social media for market-moving posts from key figures.' },
  { key: 'technical_analyst', label: 'Technical Analyst', icon: <TrendingUp className="w-4 h-4" />, color: 'green', description: 'Computes RSI, SMA, MACD, Bollinger Bands. Detects chart patterns.' },
  { key: 'synthesis', label: 'Synthesis Agent', icon: <Layers className="w-4 h-4" />, color: 'rose', description: 'Combines all specialist outputs into a unified buy/sell/hold action plan.' },
] as const;

type AgentKey = typeof AGENTS[number]['key'];

const COLOR: Record<string, { bg: string; border: string; text: string; badge: string; dot: string }> = {
  blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   text: 'text-blue-400',   badge: 'bg-blue-500/15 text-blue-300',   dot: 'bg-blue-400' },
  amber:  { bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  text: 'text-amber-400',  badge: 'bg-amber-500/15 text-amber-300',  dot: 'bg-amber-400' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', badge: 'bg-purple-500/15 text-purple-300', dot: 'bg-purple-400' },
  green:  { bg: 'bg-green-500/10',  border: 'border-green-500/20',  text: 'text-green-400',  badge: 'bg-green-500/15 text-green-300',  dot: 'bg-green-400' },
  rose:   { bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   text: 'text-rose-400',   badge: 'bg-rose-500/15 text-rose-300',   dot: 'bg-rose-400' },
};

/* ─── Types ───────────────────────────────────────────────── */
interface LogEntry {
  id: string;
  agent_type: string;
  status: 'running' | 'success' | 'error';
  duration_ms: number;
  output_summary: {
    overall_signal: string | null;
    overall_confidence: number | null;
    summary: string;
    findings_count: number;
    recommendations_count: number;
    tokens_used: number;
  } | null;
  error: string | null;
  context_summary: { symbols: string[]; model: string | null } | null;
  timestamp: string;
}

interface AgentStats {
  total: number;
  success: number;
  error: number;
  running: number;
  avg_duration_ms: number;
}

interface AdkWebState {
  launching: boolean;
  running: boolean;
  url: string | null;
  port: number | null;
  error: string | null;
}

/* ─── Component ───────────────────────────────────────────── */
const Agents = () => {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Record<string, AgentStats>>({});
  const [totalRuns, setTotalRuns] = useState(0);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Pipeline runner
  const [symbols, setSymbols] = useState('AAPL, SPY');
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Per-agent quick run
  const [agentRunning, setAgentRunning] = useState<Record<string, boolean>>({});

  // ADK web
  const [adkWeb, setAdkWeb] = useState<AdkWebState>({ launching: false, running: false, url: null, port: null, error: null });

  const pollRef = useRef<ReturnType<typeof setInterval>>();

  /* ── Fetch helpers ─────────────────────────────────────────── */
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${PYTHON_BASE}/health`, { signal: AbortSignal.timeout(4000) });
      setBackendOnline(res.ok);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${PYTHON_BASE}/compute/agents/logs?limit=100`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
      }
    } catch { /* offline */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${PYTHON_BASE}/compute/agents/logs/stats`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        setStats(data.by_agent ?? {});
        setTotalRuns(data.total_runs ?? 0);
      }
    } catch { /* offline */ }
  }, []);

  const syncAdkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${PYTHON_BASE}/adk/status`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        setAdkWeb(prev => ({ ...prev, running: data.running, url: data.url, port: data.port }));
      }
    } catch { /* offline */ }
  }, []);

  useEffect(() => {
    checkHealth();
    fetchLogs();
    fetchStats();
    syncAdkStatus();
    pollRef.current = setInterval(() => {
      checkHealth();
      fetchLogs();
      fetchStats();
    }, 8_000);
    return () => clearInterval(pollRef.current);
  }, [checkHealth, fetchLogs, fetchStats, syncAdkStatus]);

  /* ── Run full pipeline ─────────────────────────────────────── */
  const runPipeline = async () => {
    const syms = symbols.split(',').map(s => s.trim()).filter(Boolean);
    setPipelineStatus('running');
    setPipelineError(null);
    try {
      const res = await fetch(`${PYTHON_BASE}/compute/agents/pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: syms,
          news_events: [{ headline: 'Pipeline run from Agents UI', sentiment: 'neutral' }],
          technical_data: { symbols: syms },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || data.detail || 'Pipeline failed');
      setPipelineStatus('success');
      fetchLogs();
      fetchStats();
    } catch (err: unknown) {
      setPipelineStatus('error');
      setPipelineError(err instanceof Error ? err.message : 'Pipeline failed');
    }
  };

  /* ── Run single agent ──────────────────────────────────────── */
  const runAgent = async (agentType: string) => {
    const syms = symbols.split(',').map(s => s.trim()).filter(Boolean);
    setAgentRunning(prev => ({ ...prev, [agentType]: true }));
    try {
      await fetch(`${PYTHON_BASE}/compute/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_type: agentType,
          context: {
            symbols: syms,
            news_events: agentType === 'news_analyst' ? [{ headline: 'Manual trigger', sentiment: 'neutral' }] : undefined,
            macro_events: agentType === 'macro_analyst' ? [{ headline: 'Manual trigger', body: 'Manual macro analysis' }] : undefined,
            social_events: agentType === 'social_monitor' ? [{ headline: 'Manual trigger', metadata: { platform: 'manual' } }] : undefined,
            technical_data: agentType === 'technical_analyst' ? { symbols: syms } : undefined,
          },
        }),
      });
      fetchLogs();
      fetchStats();
    } catch { /* silent */ }
    setAgentRunning(prev => ({ ...prev, [agentType]: false }));
  };

  /* ── ADK Web launcher ──────────────────────────────────────── */
  const launchAdkWeb = async () => {
    setAdkWeb(prev => ({ ...prev, launching: true, error: null }));
    try {
      const res = await fetch(`${PYTHON_BASE}/adk/start`, { method: 'POST', signal: AbortSignal.timeout(30_000) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to start');
      setAdkWeb({ launching: false, running: true, url: data.url, port: data.port, error: null });
      window.open(data.url, '_blank');
    } catch (err: unknown) {
      setAdkWeb(prev => ({ ...prev, launching: false, error: err instanceof Error ? err.message : 'Launch failed' }));
    }
  };

  const stopAdkWeb = async () => {
    try { await fetch(`${PYTHON_BASE}/adk/stop`, { method: 'POST' }); } catch { /* */ }
    setAdkWeb({ launching: false, running: false, url: null, port: null, error: null });
  };

  /* ── Derived data ──────────────────────────────────────────── */
  const runningLogs = logs.filter(l => l.status === 'running');
  const successRate = totalRuns > 0
    ? Math.round((logs.filter(l => l.status === 'success').length / Math.max(logs.length, 1)) * 100)
    : 0;

  const agentFor = (key: string) => AGENTS.find(a => a.key === key);

  return (
    <div className="min-h-screen bg-background text-foreground pt-16 pb-10">
      <div className="w-full max-w-none px-4 md:px-6 space-y-5">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h1 className="text-white font-medium text-sm tracking-tight">Agents</h1>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-white/40 text-xs">AI Analysis Pipeline · Monitor & Run</span>
          </div>
          <div className="flex items-center gap-2">
            <HealthPill online={backendOnline} />
            <Button size="sm" variant="outline" className="gap-1.5 border-white/10 text-white/60 hover:text-white text-xs h-7"
              onClick={() => { fetchLogs(); fetchStats(); checkHealth(); }}>
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Total Runs" value={totalRuns} icon={<Activity className="w-4 h-4" />} color="blue" />
          <MiniStat label="Active Now" value={runningLogs.length} icon={<Loader2 className="w-4 h-4" />} color="amber" />
          <MiniStat label="Success Rate" value={`${successRate}%`} icon={<CheckCircle2 className="w-4 h-4" />} color="green" />
          <MiniStat label="Agents" value={AGENTS.length} icon={<Bot className="w-4 h-4" />} color="purple" />
        </div>

        {/* ── Main grid: Agents + Run history ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left column: Agent cards + Pipeline ─────────── */}
          <div className="lg:col-span-1 space-y-4">

            {/* Pipeline control */}
            <Card className="bg-card/60 backdrop-blur-sm border-white/5">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-xs flex items-center gap-2 uppercase tracking-wider text-white/50">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  Run Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-3">
                <div>
                  <label htmlFor="agent-symbols" className="block text-[10px] text-white/30 mb-1 uppercase tracking-wider">Symbols</label>
                  <input id="agent-symbols"
                    className="w-full h-8 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    value={symbols} onChange={e => setSymbols(e.target.value)} placeholder="AAPL, SPY, TSLA" />
                </div>
                <Button onClick={runPipeline} disabled={pipelineStatus === 'running' || !backendOnline}
                  className="w-full gap-2 text-xs h-8" size="sm">
                  {pipelineStatus === 'running'
                    ? <><Loader2 className="w-3 h-3 animate-spin" />Running all agents…</>
                    : <><Play className="w-3 h-3" />Run Full Pipeline</>}
                </Button>
                {pipelineStatus === 'error' && pipelineError && (
                  <p className="text-[11px] text-red-400 bg-red-500/10 rounded-lg px-2.5 py-1.5">{pipelineError}</p>
                )}
                {pipelineStatus === 'success' && (
                  <p className="text-[11px] text-green-400 bg-green-500/10 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3" /> Pipeline completed — check logs
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Agent cards */}
            {AGENTS.map((agent, i) => {
              const c = COLOR[agent.color];
              const agentStats = stats[agent.key];
              const isRunning = agentRunning[agent.key];
              return (
                <motion.div key={agent.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card className={`bg-card/60 backdrop-blur-sm border ${c.border}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-md ${c.bg} ${c.text}`}>{agent.icon}</div>
                          <div>
                            <p className="text-xs font-medium text-white">{agent.label}</p>
                            <p className="text-[10px] text-white/40 leading-tight mt-0.5">{agent.description}</p>
                          </div>
                        </div>
                      </div>
                      {/* Stats bar */}
                      {agentStats && (
                        <div className="flex items-center gap-3 text-[10px] text-white/40 mb-2">
                          <span>{agentStats.total} runs</span>
                          <span className="text-green-400">{agentStats.success} ok</span>
                          {agentStats.error > 0 && <span className="text-red-400">{agentStats.error} err</span>}
                          <span>~{agentStats.avg_duration_ms}ms</span>
                        </div>
                      )}
                      <button onClick={() => runAgent(agent.key)}
                        disabled={isRunning || !backendOnline}
                        className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${c.border} ${c.bg} ${c.text} hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed`}>
                        {isRunning ? <><Loader2 className="w-3 h-3 animate-spin" />Running…</> : <><Play className="w-3 h-3" />Run</>}
                      </button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}

            {/* ADK Web UI */}
            <Card className={`bg-card/60 backdrop-blur-sm border ${adkWeb.running ? 'border-green-500/30' : 'border-purple-500/20'}`}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className={`w-4 h-4 ${adkWeb.running ? 'text-green-400' : 'text-purple-400'}`} />
                    <p className="text-xs font-medium text-white">ADK Web Debugger</p>
                    {adkWeb.running && (
                      <span className="text-[9px] text-green-400 bg-green-500/15 border border-green-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                        :{adkWeb.port}
                      </span>
                    )}
                  </div>
                  {adkWeb.running ? (
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" className="h-6 px-2 text-[10px] gap-1 bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/25"
                        onClick={() => adkWeb.url && window.open(adkWeb.url, '_blank')}>
                        <ExternalLink className="w-2.5 h-2.5" />Open
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1 border-red-500/20 text-red-400/70 hover:text-red-400"
                        onClick={stopAdkWeb}>
                        <Square className="w-2.5 h-2.5" />Stop
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" className="h-6 px-2 text-[10px] gap-1 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/25"
                      onClick={launchAdkWeb} disabled={adkWeb.launching || !backendOnline}>
                      {adkWeb.launching ? <><Loader2 className="w-2.5 h-2.5 animate-spin" />Starting…</> : <><Play className="w-2.5 h-2.5" />Launch</>}
                    </Button>
                  )}
                </div>
                {adkWeb.error && <p className="text-[10px] text-red-400/80 bg-red-500/10 rounded px-2 py-1">{adkWeb.error}</p>}
              </CardContent>
            </Card>
          </div>

          {/* Right column: Run history / logs ─────────────── */}
          <div className="lg:col-span-2">
            <Card className="bg-card/60 backdrop-blur-sm border-white/5 h-full">
              <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between">
                <CardTitle className="text-xs flex items-center gap-2 uppercase tracking-wider text-white/50">
                  <ScrollText className="w-3.5 h-3.5" />
                  Agent Run Log
                </CardTitle>
                <span className="text-[10px] text-white/30">{logs.length} entries · auto-refreshing</span>
              </CardHeader>
              <CardContent className="p-0">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-2">
                    <ScrollText className="w-8 h-8 opacity-30" />
                    <p className="text-xs">No agent runs yet. Run the pipeline or an individual agent to see logs here.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[calc(100vh-260px)] min-h-[400px]">
                    <div className="divide-y divide-white/5">
                      {logs.map((entry) => {
                        const def = agentFor(entry.agent_type);
                        const c = COLOR[def?.color ?? 'blue'];
                        const isExpanded = expandedLog === entry.id;
                        return (
                          <div key={`${entry.id}-${entry.status}`} className="hover:bg-white/[0.02] transition-colors">
                            <button className="w-full flex items-center gap-3 px-4 py-3 text-left"
                              onClick={() => setExpandedLog(isExpanded ? null : entry.id)}>
                              {/* Status icon */}
                              <StatusDot status={entry.status} />
                              {/* Agent icon */}
                              <div className={`p-1 rounded ${c.bg} ${c.text} shrink-0`}>
                                {def?.icon ?? <Bot className="w-3.5 h-3.5" />}
                              </div>
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-white">{def?.label ?? entry.agent_type}</span>
                                  {entry.output_summary?.overall_signal && (
                                    <SignalBadge signal={entry.output_summary.overall_signal} />
                                  )}
                                  {entry.error && <Badge className="text-[9px] bg-red-500/15 text-red-300 border-none">error</Badge>}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/30">
                                  {entry.context_summary?.symbols && entry.context_summary.symbols.length > 0 && (
                                    <span>{entry.context_summary.symbols.join(', ')}</span>
                                  )}
                                  {entry.duration_ms > 0 && <span>{entry.duration_ms}ms</span>}
                                  {entry.output_summary?.tokens_used ? <span>{entry.output_summary.tokens_used} tokens</span> : null}
                                </div>
                              </div>
                              {/* Time + expand */}
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] text-white/25 font-mono">
                                  {formatTime(entry.timestamp)}
                                </span>
                                {isExpanded ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
                              </div>
                            </button>

                            {/* Expanded details */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                  <div className="px-4 pb-3 space-y-2">
                                    {entry.error && (
                                      <div className="flex items-start gap-2 text-xs text-red-400 p-2.5 rounded-lg bg-red-500/10 border border-red-500/15">
                                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                        <pre className="whitespace-pre-wrap text-[11px] leading-relaxed">{entry.error}</pre>
                                      </div>
                                    )}
                                    {entry.output_summary && (
                                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1.5">
                                        {entry.output_summary.summary && (
                                          <p className="text-[11px] text-white/60 leading-relaxed">{entry.output_summary.summary}</p>
                                        )}
                                        <div className="flex items-center gap-4 text-[10px] text-white/40">
                                          <span>Signal: <span className={`font-medium ${signalColor(entry.output_summary.overall_signal)}`}>{entry.output_summary.overall_signal ?? '—'}</span></span>
                                          {entry.output_summary.overall_confidence !== null && (
                                            <span>Confidence: <span className="text-white/60 font-mono">{Math.round((entry.output_summary.overall_confidence ?? 0) * 100)}%</span></span>
                                          )}
                                          <span>{entry.output_summary.findings_count} findings</span>
                                          <span>{entry.output_summary.recommendations_count} recommendations</span>
                                        </div>
                                      </div>
                                    )}
                                    {entry.context_summary && (
                                      <div className="text-[10px] text-white/25">
                                        Model: {entry.context_summary.model ?? 'default'} · Symbols: {entry.context_summary.symbols?.join(', ') ?? '—'}
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Backend offline notice ─────────────────────────── */}
        <AnimatePresence>
          {backendOnline === false && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-4 rounded-xl border border-amber-500/25 bg-amber-500/5 text-xs text-amber-400/80">
              <strong className="text-amber-300">Python backend is offline.</strong>
              {' '}Start it with:{' '}
              <code className="bg-black/30 px-2 py-0.5 rounded font-mono">
                conda activate fyer &amp;&amp; cd backend &amp;&amp; uvicorn main:app --reload --port 8000
              </code>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ─── Sub-components ──────────────────────────────────────── */

const HealthPill = ({ online }: { online: boolean | null }) => {
  if (online === null) return <Pill className="border-white/10 text-white/40"><Dot className="bg-white/30" />Checking…</Pill>;
  if (online) return <Pill className="border-green-500/30 text-green-400 bg-green-500/10"><Dot className="bg-green-400 animate-pulse" />Backend Online</Pill>;
  return <Pill className="border-red-500/30 text-red-400 bg-red-500/10"><Dot className="bg-red-400" />Backend Offline</Pill>;
};

const Pill = ({ className, children }: { className: string; children: React.ReactNode }) => (
  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${className}`}>{children}</div>
);

const Dot = ({ className }: { className: string }) => (
  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${className}`} />
);

const MiniStat = ({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) => {
  const c = COLOR[color] ?? COLOR.blue;
  return (
    <Card className={`bg-card/60 backdrop-blur-sm border ${c.border}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`p-1.5 rounded-lg ${c.bg} ${c.text}`}>{icon}</div>
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
          <p className={`text-lg font-bold ${c.text} leading-tight`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const StatusDot = ({ status }: { status: string }) => {
  if (status === 'running') return <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />;
  if (status === 'success') return <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />;
  return <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />;
};

const SignalBadge = ({ signal }: { signal: string }) => (
  <Badge className="text-[9px] border-none capitalize" style={signalBadgeStyle(signal)}>{signal}</Badge>
);

function signalBadgeStyle(signal: string | null): React.CSSProperties {
  if (signal === 'bullish' || signal === 'buy') return { background: 'rgba(34,197,94,0.15)', color: '#4ade80' };
  if (signal === 'bearish' || signal === 'sell') return { background: 'rgba(239,68,68,0.15)', color: '#f87171' };
  return { background: 'rgba(148,163,184,0.1)', color: '#94a3b8' };
}

function signalColor(signal: string | null): string {
  if (signal === 'bullish' || signal === 'buy') return 'text-green-400';
  if (signal === 'bearish' || signal === 'sell') return 'text-red-400';
  return 'text-white/50';
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

export default Agents;
