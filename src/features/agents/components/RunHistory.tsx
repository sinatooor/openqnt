/**
 * RunHistory — past runs for the selected agent, newest first. Click a row
 * to replay its stream inline (the Live tab will switch to that run).
 */

import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  useAgentMonitorStore,
  selectAgentRuns,
} from '../store/agentMonitorStore';
import type { RunRecord } from '../types';

interface RunHistoryProps {
  agentId: string;
  /** Currently-viewed run (highlighted). */
  activeRunId?: string | null;
  /** Fired when the user clicks a run to inspect it. */
  onSelectRun: (runId: string) => void;
}

export const RunHistory = memo(({ agentId, activeRunId, onSelectRun }: RunHistoryProps) => {
  const runs = useAgentMonitorStore(useShallow(selectAgentRuns(agentId)));

  if (runs.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground text-[12px]">
        No runs yet. Hit <span className="text-foreground/70">Run</span> to kick off a task.
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5">
      {runs.map((r) => (
        <RunRow
          key={r.id}
          run={r}
          active={r.id === activeRunId}
          onSelect={onSelectRun}
        />
      ))}
    </div>
  );
});

RunHistory.displayName = 'RunHistory';

// ───────────────────────────────────────────────────────── Row ───────

const RunRow = memo(
  ({ run, active, onSelect }: { run: RunRecord; active: boolean; onSelect: (id: string) => void }) => {
    const dur = run.endedAt ? run.endedAt - run.startedAt : Date.now() - run.startedAt;
    return (
      <button
        onClick={() => onSelect(run.id)}
        className={cn(
          'w-full px-3 py-2.5 text-left transition-colors',
          active ? 'bg-muted/30' : 'hover:bg-muted/30'
        )}
      >
        <div className="flex items-center gap-2">
          <StatusDot status={run.status} />
          <p className="text-[12px] text-foreground truncate flex-1">{run.task}</p>
          {run.signal && <SignalPill signal={run.signal} />}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
          <span>{formatDistanceToNow(run.startedAt, { addSuffix: true })}</span>
          <span>·</span>
          <span>{formatDuration(dur)}</span>
          <span>·</span>
          <span>{run.toolCallCount} tool calls</span>
          {run.artifactCount > 0 && (
            <>
              <span>·</span>
              <span>{run.artifactCount} artifact{run.artifactCount === 1 ? '' : 's'}</span>
            </>
          )}
          {run.confidence !== undefined && (
            <>
              <span>·</span>
              <span>conf {Math.round(run.confidence * 100)}%</span>
            </>
          )}
        </div>
        {run.conclusion && (
          <p className="text-[11px] text-muted-foreground truncate mt-1">
            {run.conclusion.replace(/[*_#`]/g, '')}
          </p>
        )}
      </button>
    );
  }
);
RunRow.displayName = 'RunRow';

const StatusDot = ({ status }: { status: RunRecord['status'] }) => {
  const cls =
    status === 'running'
      ? 'bg-amber-400 animate-pulse'
      : status === 'success'
        ? 'bg-emerald-400'
        : status === 'cancelled'
          ? 'bg-muted'
          : 'bg-red-400';
  return <span className={cn('w-2 h-2 rounded-full shrink-0', cls)} />;
};

const SignalPill = ({ signal }: { signal: 'bullish' | 'bearish' | 'neutral' }) => (
  <span
    className={cn(
      'text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium shrink-0',
      signal === 'bullish' && 'bg-emerald-500/15 text-emerald-500',
      signal === 'bearish' && 'bg-red-500/15 text-red-500',
      signal === 'neutral' && 'bg-muted/60 text-foreground/70'
    )}
  >
    {signal}
  </span>
);

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}
