/**
 * StreamPanel — the "Cursor-style" live timeline for a single run.
 *
 * Renders every event in chronological order, auto-scrolls to the bottom
 * while a run is in progress, and shows a compact header with task/status/
 * controls (Stop, Replay latest).
 */

import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Loader2,
  Play,
  Square,
  History as HistoryIcon,
  CheckCircle2,
  XCircle,
  Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useAgentMonitorStore,
  selectRunEvents,
} from '../store/agentMonitorStore';
import { simulateAgentRun } from '../runtime/simulatedRun';
import { StreamEventView } from './StreamEventView';

interface StreamPanelProps {
  agentId: string;
  /** If set, show this run; otherwise show the active run (or most recent). */
  runId?: string | null;
}

export const StreamPanel = memo(({ agentId, runId }: StreamPanelProps) => {
  const agent = useAgentMonitorStore((s) => s.agents[agentId]);
  const activeRunId = useAgentMonitorStore((s) => s.activeRunIdByAgent[agentId]);
  const latestRunId = useAgentMonitorStore((s) => {
    const all = Object.values(s.runs)
      .filter((r) => r.agentId === agentId)
      .sort((a, b) => b.startedAt - a.startedAt);
    return all[0]?.id;
  });

  const targetRunId = runId ?? activeRunId ?? latestRunId ?? null;
  const run = useAgentMonitorStore((s) =>
    targetRunId ? s.runs[targetRunId] : undefined
  );
  const events = useAgentMonitorStore(
    selectRunEvents(targetRunId ?? '__none__')
  );
  const cancelRun = useAgentMonitorStore((s) => s.cancelRun);

  const isLive = run?.status === 'running';

  // Auto-scroll to bottom while the run is live.
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!isLive) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events.length, isLive]);

  // When the run changes, snap to top to replay from the start.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [targetRunId]);

  if (!agent) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Header ── task + status + controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {run ? <RunStatusPill status={run.status} /> : (
              <span className="text-[10px] uppercase tracking-wider text-white/30">
                Idle
              </span>
            )}
            <p className="text-[12px] text-white/80 truncate">
              {run?.task ?? 'No run yet — press Run to kick off a task.'}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/30">
            {run?.symbols && <span>{run.symbols.join(', ')}</span>}
            {run?.model && <span className="font-mono">{run.model}</span>}
            <span>{events.length} events</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isLive ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] gap-1 border-red-500/30 text-red-300 hover:text-red-200"
              onClick={() => targetRunId && cancelRun(targetRunId)}
            >
              <Square className="w-3 h-3" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 px-2 text-[11px] gap-1"
              onClick={() => simulateAgentRun({ agentId })}
            >
              <Play className="w-3 h-3" />
              Run
            </Button>
          )}
        </div>
      </div>

      {/* Body ── chronological event stream */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {!run ? (
          <EmptyState agentLabel={agent.label} />
        ) : (
          <div className="p-3 space-y-2">
            {events.map((e) => (
              <StreamEventView key={e.id} event={e} />
            ))}
            {isLive && (
              <div className="flex items-center gap-2 text-[11px] text-white/35 pl-1 pt-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Working…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer ── conclusion recap when run is done */}
      {run && run.status !== 'running' && run.conclusion && (
        <div className="border-t border-white/5 px-3 py-2 bg-white/[0.02]">
          <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1 flex items-center gap-1">
            <HistoryIcon className="w-3 h-3" /> Final
          </p>
          <p className="text-[12px] text-white/75 line-clamp-3">
            {run.conclusion.replace(/[*_#`]/g, '')}
          </p>
        </div>
      )}
    </div>
  );
});

StreamPanel.displayName = 'StreamPanel';

// ─────────────────────────────────────────────── Small helpers ─────

const RunStatusPill = ({ status }: { status: 'running' | 'success' | 'error' | 'cancelled' }) => {
  if (status === 'running')
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider bg-amber-500/15 text-amber-300">
        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Live
      </span>
    );
  if (status === 'success')
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider bg-emerald-500/15 text-emerald-300">
        <CheckCircle2 className="w-2.5 h-2.5" /> Done
      </span>
    );
  if (status === 'cancelled')
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider bg-white/10 text-white/60">
        <Ban className="w-2.5 h-2.5" /> Cancelled
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider bg-red-500/15 text-red-300">
      <XCircle className="w-2.5 h-2.5" /> Error
    </span>
  );
};

const EmptyState = ({ agentLabel }: { agentLabel: string }) => (
  <div className="h-full flex items-center justify-center p-8 text-center">
    <div>
      <p className="text-[13px] text-white/70 mb-1">{agentLabel} is idle</p>
      <p className="text-[11px] text-white/35 max-w-xs mx-auto">
        Press Run to assign it a task. You'll see its thoughts, tool calls,
        and saved plots stream in here — just like Cursor.
      </p>
    </div>
  </div>
);