/**
 * Agents — "agent HQ" page.
 *
 *   Left  · every agent the user has (auto-registered from the strategy
 *            canvas + legacy ADK pipeline). Click to open.
 *   Right · the selected agent's Live stream, memory.md, artifacts, and
 *            full run history.
 *
 * Also exposes the existing Python-backed pipeline controls (unchanged) as
 * a small top bar, so power users keep one-click access to run everything.
 *
 * Route:
 *   /agents       → list + auto-selects the first agent
 *   /agents/:id   → deep-link to a specific agent
 */

import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bot,
  RefreshCw,
  Zap,
  Loader2,
  ExternalLink,
  Play,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { useAgentMonitorStore, selectAgents } from '@/features/agents/store/agentMonitorStore';
import { useFlowAgentSync } from '@/features/agents/hooks/useFlowAgentSync';
import { simulateAgentRun } from '@/features/agents/runtime/simulatedRun';
import { AgentList } from '@/features/agents/components/AgentList';
import { AgentDetail } from '@/features/agents/components/AgentDetail';

const PYTHON_BASE =
  import.meta.env.VITE_PYTHON_BACKEND_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  'http://localhost:8000';

const Agents = () => {
  // Keep canvas ↔ monitor in sync.
  useFlowAgentSync();

  const navigate = useNavigate();
  const { id: urlId } = useParams<{ id: string }>();

  const agents = useAgentMonitorStore(useShallow(selectAgents));
  const selectedAgentId = useAgentMonitorStore((s) => s.selectedAgentId);
  const selectAgent = useAgentMonitorStore((s) => s.selectAgent);

  // Resolve the agent to show: URL param > sticky selection > first agent.
  const resolvedId = useMemo(() => {
    if (urlId && agents.some((a) => a.id === urlId)) return urlId;
    if (selectedAgentId && agents.some((a) => a.id === selectedAgentId))
      return selectedAgentId;
    return agents[0]?.id ?? null;
  }, [urlId, selectedAgentId, agents]);

  useEffect(() => {
    if (resolvedId && resolvedId !== selectedAgentId) selectAgent(resolvedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedId]);

  const onSelect = (id: string) => {
    selectAgent(id);
    // Deep-link the URL so refresh / share-url works.
    navigate(`/agents/${encodeURIComponent(id)}`, { replace: true });
  };

  // ── Pipeline running state (top-bar "Run everyone") ──────────
  const runningCount = useAgentMonitorStore(
    (s) =>
      Object.values(s.runs).filter((r) => r.status === 'running').length
  );

  const runAllIdle = () => {
    // Fire the simulated runtime for every agent that's not already busy.
    const st = useAgentMonitorStore.getState();
    for (const a of Object.values(st.agents)) {
      const activeId = st.activeRunIdByAgent[a.id];
      if (activeId && st.runs[activeId]?.status === 'running') continue;
      simulateAgentRun({ agentId: a.id });
    }
  };

  // Optional: quick ping to detect backend presence (for the ADK launch link)
  useEffect(() => {
    void fetch(`${PYTHON_BASE}/health`, { signal: AbortSignal.timeout(3000) }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground pt-14 pb-0">
      <div className="w-full max-w-none px-4 md:px-6 flex flex-col h-[calc(100vh-3.5rem)]">
        {/* ─── Header bar ─────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="w-5 h-5 text-primary" />
            <h1 className="text-white font-medium text-sm tracking-tight">Agents</h1>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-white/40 text-xs truncate">
              Your AI team · memory · live work · past runs
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <motion.div
              className="flex items-center gap-3 text-[11px] text-white/60 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <span className="inline-flex items-center gap-1">
                <Activity className="w-3 h-3 text-white/40" /> {agents.length} agents
              </span>
              <span className="inline-flex items-center gap-1">
                {runningCount > 0 ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    <span className="text-amber-300">{runningCount} working</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300">idle</span>
                  </>
                )}
              </span>
            </motion.div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] gap-1.5 border-white/10 text-white/70 hover:text-white"
              onClick={runAllIdle}
            >
              <Zap className="w-3 h-3" />
              Run everyone
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] gap-1.5 border-white/10 text-white/60 hover:text-white"
              onClick={() => window.location.reload()}
              aria-label="Refresh"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </header>

        {/* ─── Main content (two-pane) ─────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-3 pb-4 overflow-hidden">
          {/* Left — agent roster */}
          <Card className="bg-card/60 backdrop-blur-sm border-white/5 overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/40">
                Agents
              </span>
              <span className="text-[10px] text-white/30">{agents.length}</span>
            </div>
            <div className="flex-1 min-h-0">
              <AgentList selectedId={resolvedId} onSelect={onSelect} />
            </div>
          </Card>

          {/* Right — selected agent detail */}
          <Card className="bg-card/60 backdrop-blur-sm border-white/5 overflow-hidden flex flex-col">
            {resolvedId ? (
              <AgentDetail agentId={resolvedId} />
            ) : (
              <NoAgentsCTA />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────── No-agents CTA ────────

const NoAgentsCTA = () => (
  <CardContent className="h-full flex flex-col items-center justify-center text-center py-16 px-6">
    <Bot className="w-10 h-10 text-white/20 mb-3" />
    <p className="text-[14px] text-white/70 mb-1">No agents on staff yet</p>
    <p className="text-[12px] text-white/40 max-w-sm mb-4">
      Drop an agent node (News, Quant, Research, …) into a strategy on the
      canvas. As soon as you do, they'll show up here with their own log and
      notebook.
    </p>
    <a
      href="/"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-[11.5px] hover:opacity-90"
    >
      <Play className="w-3 h-3" />
      Open the canvas
      <ExternalLink className="w-3 h-3" />
    </a>
  </CardContent>
);

export default Agents;
