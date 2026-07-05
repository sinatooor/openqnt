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
  BrainCircuit,
  RefreshCw,
  Zap,
  Loader2,
  ExternalLink,
  Play,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { useAgentMonitorStore, selectAgents } from '@/features/agents/store/agentMonitorStore';
import { useFlowAgentSync } from '@/features/agents/hooks/useFlowAgentSync';
import { simulateAgentRun } from '@/features/agents/runtime/simulatedRun';
import { AgentList } from '@/features/agents/components/AgentList';
import { AgentDetail } from '@/features/agents/components/AgentDetail';
import { BrainPanel } from '@/features/agents/components/BrainPanel';

import { apiBase } from '@/lib/runtimeConfig';
const PYTHON_BASE = apiBase();

/** URL id for the shared copilot brain — not a real agent, so it never
 *  collides with agent ids from the canvas/registry. */
const BRAIN_ID = 'brain';

const Agents = () => {
  // Keep canvas ↔ monitor in sync.
  useFlowAgentSync();

  const navigate = useNavigate();
  const { id: urlId } = useParams<{ id: string }>();

  const agents = useAgentMonitorStore(useShallow(selectAgents));
  const selectedAgentId = useAgentMonitorStore((s) => s.selectedAgentId);
  const selectAgent = useAgentMonitorStore((s) => s.selectAgent);

  // The copilot brain is a pinned pseudo-entry, deep-linked at /agents/brain.
  // Agent ids come verbatim from canvas/imported strategy JSON, so one could
  // legitimately be named "brain" — in that collision the real agent wins
  // (user data stays reachable) and we surface the conflict in the console.
  const brainShadowed = useMemo(() => agents.some((a) => a.id === BRAIN_ID), [agents]);
  useEffect(() => {
    if (brainShadowed)
      console.warn(
        `[Agents] An agent with id "${BRAIN_ID}" shadows the Copilot Brain route — rename that node id to make the brain reachable at /agents/${BRAIN_ID}.`
      );
  }, [brainShadowed]);
  const brainSelected = urlId === BRAIN_ID && !brainShadowed;

  // Resolve the agent to show: URL param > sticky selection > first agent.
  const resolvedId = useMemo(() => {
    if (urlId && agents.some((a) => a.id === urlId)) return urlId;
    if (selectedAgentId && agents.some((a) => a.id === selectedAgentId))
      return selectedAgentId;
    return agents[0]?.id ?? null;
  }, [urlId, selectedAgentId, agents]);

  useEffect(() => {
    if (!brainSelected && resolvedId && resolvedId !== selectedAgentId)
      selectAgent(resolvedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedId, brainSelected]);

  const onSelect = (id: string) => {
    selectAgent(id);
    // Deep-link the URL so refresh / share-url works.
    navigate(`/agents/${encodeURIComponent(id)}`, { replace: true });
  };

  const onSelectBrain = () => {
    navigate(`/agents/${BRAIN_ID}`, { replace: true });
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
            <h1 className="text-foreground font-medium text-sm tracking-tight">Agents</h1>
            <div className="h-4 w-px bg-muted/60" />
            <span className="text-muted-foreground text-xs truncate">
              Your AI team · memory · live work · past runs
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <motion.div
              className="flex items-center gap-3 text-[11px] text-foreground/70 px-3 py-1.5 rounded-full bg-muted/30 border border-border/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <span className="inline-flex items-center gap-1">
                <Activity className="w-3 h-3 text-muted-foreground" /> {agents.length} agents
              </span>
              <span className="inline-flex items-center gap-1">
                {runningCount > 0 ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                    <span className="text-amber-500">{runningCount} working</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-500">idle</span>
                  </>
                )}
              </span>
            </motion.div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] gap-1.5 border-border/60 text-foreground/80 hover:text-foreground"
              onClick={runAllIdle}
            >
              <Zap className="w-3 h-3" />
              Run everyone
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] gap-1.5 border-border/60 text-foreground/70 hover:text-foreground"
              onClick={() => window.location.reload()}
              aria-label="Refresh"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </header>

        {/* ─── Main content (two-pane) ─────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-3 pb-4 overflow-hidden">
          {/* Left — copilot brain + agent roster */}
          <Card className="bg-card/60 backdrop-blur-sm border-border/60 overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Agents
              </span>
              <span className="text-[10px] text-muted-foreground">{agents.length}</span>
            </div>
            {/* Pinned — the shared brain every run & chat learns into */}
            <div className="p-2 border-b border-border/60">
              <div
                role="button"
                tabIndex={0}
                onClick={onSelectBrain}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectBrain();
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors border cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20',
                  brainSelected
                    ? 'bg-muted/30 border-border/60'
                    : 'bg-transparent border-transparent hover:bg-muted/30 hover:border-border/60'
                )}
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-primary/15 text-primary">
                  <BrainCircuit className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-xs text-foreground truncate">Copilot Brain</span>
                  <p className="text-[10px] text-muted-foreground truncate font-mono">
                    soul · user · portfolio · assets
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <AgentList selectedId={brainSelected ? null : resolvedId} onSelect={onSelect} />
            </div>
          </Card>

          {/* Right — brain browser or selected agent detail */}
          <Card className="bg-card/60 backdrop-blur-sm border-border/60 overflow-hidden flex flex-col">
            {brainSelected ? (
              <BrainPanel />
            ) : resolvedId ? (
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
    <Bot className="w-10 h-10 text-muted-foreground mb-3" />
    <p className="text-[14px] text-foreground/80 mb-1">No agents on staff yet</p>
    <p className="text-[12px] text-muted-foreground max-w-sm mb-4">
      Drop an agent node (News, Quant, Research, …) into a strategy on the
      canvas. As soon as you do, they'll show up here with their own log and
      notebook.
    </p>
    <a
      href="/"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-foreground text-[11.5px] hover:opacity-90"
    >
      <Play className="w-3 h-3" />
      Open the canvas
      <ExternalLink className="w-3 h-3" />
    </a>
  </CardContent>
);

export default Agents;
