/**
 * ObservationView — post-run analysis.
 *
 * Pivots the raw stream events into a structured "observation" view:
 *   - Tool-use cards: every tool_call grouped with its parent tool_result
 *     and any artifacts produced while the tool was running.
 *   - Artifact gallery: plots / tables / code, sortable by tool.
 *   - Reasoning trail: thoughts in order.
 *   - Run summary: timing, success rate, signal/confidence.
 *
 * Designed so the same view works for an in-progress run (live) and a
 * historical run (replay). Refreshes from the store whenever events
 * arrive.
 */

import { useMemo } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  Wrench,
  BarChart3,
  Sparkles,
  Quote,
} from 'lucide-react';
import { useAgentMonitorStore } from '../store/agentMonitorStore';
import type { Artifact, StreamEvent } from '../types';
import { ToolUseCard } from './ToolUseCard';

interface Props {
  agentId: string;
  runId: string | null;
}

interface ObservationGroup {
  call: StreamEvent;
  result: StreamEvent | null;
  artifacts: Artifact[];
  durationMs: number | null;
}

export function ObservationView({ agentId, runId }: Props) {
  const events = useAgentMonitorStore((s) => (runId ? s.eventsByRun[runId] ?? [] : []));
  const artifacts = useAgentMonitorStore((s) => s.artifacts);
  const run = useAgentMonitorStore((s) => (runId ? s.runs[runId] : undefined));

  const { groups, thoughts, message, errors, totals } = useMemo(() => {
    const groups: ObservationGroup[] = [];
    const callsById = new Map<string, ObservationGroup>();
    const thoughts: StreamEvent[] = [];
    const errors: StreamEvent[] = [];
    let message: StreamEvent | null = null;

    for (const ev of events) {
      if (ev.kind === 'tool_call') {
        const grp: ObservationGroup = { call: ev, result: null, artifacts: [], durationMs: null };
        callsById.set(ev.id, grp);
        groups.push(grp);
      } else if (ev.kind === 'tool_result') {
        const parent = ev.parentEventId ? callsById.get(ev.parentEventId) : undefined;
        if (parent) {
          parent.result = ev;
          parent.durationMs = ev.ts - parent.call.ts;
        } else {
          // Orphan result: surface as its own pseudo-group
          groups.push({ call: ev, result: ev, artifacts: [], durationMs: null });
        }
      } else if (ev.kind === 'artifact' && ev.artifactId) {
        const a = artifacts[ev.artifactId];
        if (!a) continue;
        // Attach to the most recent in-flight tool call, if any
        const lastOpen = [...groups].reverse().find((g) => g.result == null);
        if (lastOpen) lastOpen.artifacts.push(a);
        else groups.push({ call: ev, result: null, artifacts: [a], durationMs: null });
      } else if (ev.kind === 'thought') {
        thoughts.push(ev);
      } else if (ev.kind === 'error') {
        errors.push(ev);
      } else if (ev.kind === 'message') {
        message = ev;
      }
    }

    const succeeded = groups.filter((g) => g.result?.toolStatus === 'success').length;
    const failed = groups.filter((g) => g.result?.toolStatus === 'error').length;
    const pending = groups.filter((g) => g.result == null).length;
    const totalArtifacts = Object.values(artifacts).filter((a) => runId && a.runId === runId).length;
    const totalThoughts = thoughts.length;

    const totalDurationMs = run?.endedAt && run?.startedAt ? run.endedAt - run.startedAt : null;
    return {
      groups,
      thoughts,
      message,
      errors,
      totals: {
        toolCalls: groups.length,
        succeeded,
        failed,
        pending,
        artifacts: totalArtifacts,
        thoughts: totalThoughts,
        totalDurationMs,
      },
    };
  }, [events, artifacts, run, runId]);

  if (!runId) {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-white/30">
        Pick a run from History to inspect its observations.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto px-3 pb-6">
      {/* Summary strip */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5 mt-1">
        <Stat icon={Wrench} label="Tools" value={String(totals.toolCalls)} />
        <Stat
          icon={CheckCircle2}
          label="Success"
          value={String(totals.succeeded)}
          tone="success"
        />
        <Stat icon={XCircle} label="Failed" value={String(totals.failed)} tone={totals.failed ? 'error' : undefined} />
        <Stat icon={BarChart3} label="Artifacts" value={String(totals.artifacts)} />
        <Stat
          icon={Activity}
          label="Duration"
          value={
            totals.totalDurationMs == null
              ? '—'
              : totals.totalDurationMs < 1000
              ? `${totals.totalDurationMs}ms`
              : `${(totals.totalDurationMs / 1000).toFixed(1)}s`
          }
        />
      </div>

      {/* Conclusion */}
      {message && (
        <section className="mb-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-emerald-300">
            <Sparkles className="h-3 w-3" />
            Conclusion
          </div>
          <div className="text-[12px] leading-relaxed text-white/90 whitespace-pre-wrap">
            {message.text ?? '(empty)'}
          </div>
          {run?.signal && (
            <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wide">
              <span className="rounded-sm bg-white/5 px-1.5 py-0.5 text-white/70">
                {run.signal}
              </span>
              {run.confidence != null && (
                <span className="text-white/50">
                  confidence {Math.round(run.confidence * 100)}%
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <section className="mb-3 rounded-md border border-red-500/30 bg-red-500/5 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-red-300">
            <XCircle className="h-3 w-3" />
            Errors ({errors.length})
          </div>
          <div className="space-y-1">
            {errors.map((e) => (
              <p key={e.id} className="text-[11px] leading-relaxed text-red-200/90 whitespace-pre-wrap">
                {e.text}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Tool-use cards */}
      <section className="mb-4">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40">
          <Wrench className="h-3 w-3" />
          Tool Use ({totals.toolCalls})
        </div>
        {groups.length === 0 && (
          <div className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-4 text-center text-[11px] text-white/30">
            No tool calls yet.
            {totals.pending > 0 && (
              <Loader2 className="ml-2 inline-block h-3 w-3 animate-spin" />
            )}
          </div>
        )}
        <div className="space-y-2">
          {groups.map((g) => (
            <ToolUseCard
              key={g.call.id}
              call={g.call}
              result={g.result}
              artifacts={g.artifacts}
              durationMs={g.durationMs}
            />
          ))}
        </div>
      </section>

      {/* Reasoning */}
      {thoughts.length > 0 && (
        <section className="mb-4">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40">
            <Quote className="h-3 w-3" />
            Reasoning ({thoughts.length})
          </div>
          <div className="space-y-1.5 rounded-md border border-white/5 bg-white/[0.02] p-2">
            {thoughts.map((t) => (
              <div
                key={t.id}
                className="border-l-2 border-white/10 pl-2 text-[11px] italic leading-relaxed text-white/70"
              >
                {t.text}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'success' | 'error';
}) {
  const color =
    tone === 'success' ? 'text-emerald-400' : tone === 'error' ? 'text-red-400' : 'text-white/80';
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-2 py-1.5">
      <Icon className={`h-3 w-3 ${color}`} />
      <div className="min-w-0">
        <div className="truncate text-[9px] uppercase tracking-wide text-white/40">{label}</div>
        <div className={`font-mono text-[12px] leading-none ${color}`}>{value}</div>
      </div>
    </div>
  );
}

export default ObservationView;
