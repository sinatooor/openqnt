/**
 * AgentDetail — the right-hand column on /agents. Shows the selected agent's
 * header (who they are, what they're configured to do) and four tabs:
 *
 *   · Live     — current run's streaming timeline (Cursor-style)
 *   · Memory   — `memory.md` — the agent's evolving notebook
 *   · Artifacts — grid of saved plots / files
 *   · History  — every past run with conclusion + signal
 *
 * A deep-linkable route (`/agents/:id`) uses this same component, just with
 * the selected id sourced from the URL.
 */

import { memo, useState } from 'react';
import {
  Activity,
  BookText,
  Image as ImageIcon,
  History as HistoryIcon,
  Microscope,
  Trash2,
  Play,
  Settings2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAgentMonitorStore } from '../store/agentMonitorStore';
import { simulateAgentRun } from '../runtime/simulatedRun';
import { resolveIcon } from './iconResolver';
import { StreamPanel } from './StreamPanel';
import { MemoryView } from './MemoryView';
import { ArtifactGallery } from './ArtifactGallery';
import { RunHistory } from './RunHistory';
import { ObservationView } from './ObservationView';

interface AgentDetailProps {
  agentId: string;
}

export const AgentDetail = memo(({ agentId }: AgentDetailProps) => {
  const agent = useAgentMonitorStore((s) => s.agents[agentId]);
  const activeRun = useAgentMonitorStore((s) => {
    const rid = s.activeRunIdByAgent[agentId];
    return rid ? s.runs[rid] : undefined;
  });
  const clearHistory = useAgentMonitorStore((s) => s.clearAgentHistory);
  const removeAgent = useAgentMonitorStore((s) => s.removeAgent);

  const [viewingRunId, setViewingRunId] = useState<string | null>(null);
  const [tab, setTab] = useState<'live' | 'observation' | 'memory' | 'artifacts' | 'history'>('live');

  if (!agent) {
    return (
      <div className="h-full flex items-center justify-center text-white/30 text-[13px]">
        Select an agent on the left.
      </div>
    );
  }

  const Icon = resolveIcon(agent.icon);
  const isRunning = activeRun?.status === 'running';

  return (
    <div className="h-full flex flex-col">
      {/* ── Header: who is this agent? ──────────────────────── */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: `${agent.color ?? '#7c3aed'}22`,
              color: agent.color ?? '#c4b5fd',
            }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] text-white/95 font-medium truncate">
                {agent.label}
              </h2>
              {isRunning && (
                <Badge className="bg-amber-500/15 text-amber-300 border-none text-[9px] uppercase tracking-wider">
                  Active
                </Badge>
              )}
              <Badge className="bg-white/5 text-white/50 border-none text-[9px] font-mono">
                {agent.agentType}
              </Badge>
              <Badge className="bg-white/5 text-white/40 border-none text-[9px] capitalize">
                {agent.source}
              </Badge>
            </div>
            <p className="text-[11px] text-white/40 mt-1">
              Hired {new Date(agent.createdAt).toLocaleString()}
              {agent.lastActive && (
                <> · last active {new Date(agent.lastActive).toLocaleString()}</>
              )}
            </p>
            <MetaChips agent={agent} />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              disabled={isRunning}
              className="h-7 px-2 text-[11px] gap-1"
              onClick={() => {
                simulateAgentRun({ agentId });
                setViewingRunId(null); // jump to the new run
                setTab('live');
              }}
            >
              <Play className="w-3 h-3" />
              Run
            </Button>
            {agent.source === 'flow' && (
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-white px-2 py-1.5 border border-white/10 rounded-md"
              >
                <Settings2 className="w-3 h-3" />
                Configure
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="mx-3 mt-2 bg-white/[0.03] border border-white/5 p-0.5 h-auto self-start">
          <TabsTrigger value="live" className="text-[11px] gap-1.5 px-3 py-1">
            <Activity className="w-3 h-3" />
            Live
            {isRunning && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger value="observation" className="text-[11px] gap-1.5 px-3 py-1">
            <Microscope className="w-3 h-3" />
            Observation
          </TabsTrigger>
          <TabsTrigger value="memory" className="text-[11px] gap-1.5 px-3 py-1">
            <BookText className="w-3 h-3" />
            Memory
          </TabsTrigger>
          <TabsTrigger value="artifacts" className="text-[11px] gap-1.5 px-3 py-1">
            <ImageIcon className="w-3 h-3" />
            Artifacts
          </TabsTrigger>
          <TabsTrigger value="history" className="text-[11px] gap-1.5 px-3 py-1">
            <HistoryIcon className="w-3 h-3" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="flex-1 mt-2 overflow-hidden data-[state=inactive]:hidden">
          <StreamPanel agentId={agentId} runId={viewingRunId} />
        </TabsContent>

        <TabsContent value="observation" className="flex-1 mt-2 overflow-hidden data-[state=inactive]:hidden">
          <ObservationView agentId={agentId} runId={viewingRunId ?? activeRun?.id ?? null} />
        </TabsContent>

        <TabsContent value="memory" className="flex-1 mt-2 overflow-hidden data-[state=inactive]:hidden">
          <MemoryView agentId={agentId} />
        </TabsContent>

        <TabsContent value="artifacts" className="flex-1 mt-2 overflow-auto data-[state=inactive]:hidden">
          <ArtifactGallery agentId={agentId} />
        </TabsContent>

        <TabsContent value="history" className="flex-1 mt-2 overflow-auto data-[state=inactive]:hidden">
          <div className="flex items-center justify-between px-3 py-1.5 text-[10px] text-white/30">
            <span>Click any run to replay its stream on the Live tab.</span>
            <button
              className="inline-flex items-center gap-1 hover:text-red-300"
              onClick={() => {
                if (confirm(`Clear all run history for ${agent.label}?`)) {
                  clearHistory(agentId);
                }
              }}
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </div>
          <RunHistory
            agentId={agentId}
            activeRunId={viewingRunId ?? activeRun?.id ?? null}
            onSelectRun={(id) => {
              setViewingRunId(id);
              setTab('live');
            }}
          />
        </TabsContent>
      </Tabs>

      {/* ── Danger zone: remove agent from monitor (flow/canvas stays) ── */}
      {agent.source !== 'flow' && (
        <div className="px-3 py-2 border-t border-white/5 flex items-center justify-end">
          <button
            onClick={() => {
              if (confirm(`Retire ${agent.label} from the monitor? Their memory.md will be lost.`)) {
                removeAgent(agentId);
              }
            }}
            className="text-[10px] text-white/30 hover:text-red-300 inline-flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Retire agent
          </button>
        </div>
      )}
    </div>
  );
});

AgentDetail.displayName = 'AgentDetail';

// ────────────────────────────────────────────────── Sub-bits ────────

const MetaChips = ({ agent }: { agent: ReturnType<typeof useAgentMonitorStore.getState>['agents'][string] }) => {
  const meta = agent.meta;
  if (!meta) return null;
  const chips: Array<{ label: string; value: string }> = [];
  if (meta.model) chips.push({ label: 'model', value: String(meta.model) });
  if (Array.isArray(meta.symbols) && meta.symbols.length)
    chips.push({ label: 'symbols', value: (meta.symbols as string[]).join(', ') });
  if (Array.isArray(meta.terminalTools) && meta.terminalTools.length)
    chips.push({
      label: 'terminal',
      value: (meta.terminalTools as string[]).join(', '),
    });
  if (Array.isArray(meta.researchTools) && meta.researchTools.length)
    chips.push({
      label: 'research',
      value: (meta.researchTools as string[]).join(', '),
    });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {chips.map((c) => (
        <span
          key={c.label}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/5 text-[10px] text-white/60"
        >
          <span className="text-white/35">{c.label}</span>
          <span className="font-mono truncate max-w-[220px]">{c.value}</span>
        </span>
      ))}
    </div>
  );
};
