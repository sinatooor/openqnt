/**
 * BossRunTree — live view of one Boss run.
 *
 * Shape of the live WS stream from /api/boss/ws/{run_id}:
 *   · `plan`         — boss emits the plan (carries rationale + subtasks)
 *   · `subtask`      — boss is about to dispatch a subtask (pending)
 *   · `subtask_result` — subtask finished (carries subRunId + status)
 *   · `synthesis`    — synthesis_agent output
 *   · `message`      — boss conclusion
 *   · any sub-run event is forwarded with `bossSubRunId` + `bossSubAgentId`
 *     set so we can route it to the right subtask node.
 *
 * The tree has three visual layers:
 *   Boss (root)
 *     ├─ Subtask (quant agent)   ← one per dispatched subtask
 *     │    └─ event timeline     ← live events from that sub-run
 *     └─ Synthesis               ← synthesised action plan
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
} from 'lucide-react';

// ── config ────────────────────────────────────────────────────────────

const API_BASE =
  (import.meta as any).env?.VITE_BACKEND_URL?.replace(/\/$/, '') ??
  'http://localhost:8000';

const wsBase = (http: string) => http.replace(/^http/i, 'ws');

// ── event types ───────────────────────────────────────────────────────

type Kind =
  | 'plan'
  | 'subtask'
  | 'subtask_result'
  | 'synthesis'
  | 'status'
  | 'thought'
  | 'tool_call'
  | 'tool_result'
  | 'message'
  | 'artifact'
  | 'error'
  | 'heartbeat'
  | 'end';

interface WireEvent {
  id?: string;
  runId?: string;
  agentId?: string;
  kind: Kind;
  ts?: number;
  text?: string;
  // plan
  plan?: {
    rationale?: string;
    subtasks?: Array<{
      agent: string;
      prompt: string;
      expected_output?: string;
      symbols?: string[];
    }>;
  };
  // subtask / subtask_result
  subAgentId?: string;
  subRunId?: string;
  subStatus?: 'pending' | 'success' | 'error';
  subPrompt?: string;
  subSummary?: string;
  subSignal?: string;
  subConfidence?: number;
  subError?: string;
  // synthesis
  synthesis?: {
    summary?: string;
    overall_signal?: string;
    overall_confidence?: number;
    recommendations?: Array<{
      action: string;
      symbol: string;
      reasoning?: string;
      confidence?: number;
    }>;
  };
  // tool events
  toolName?: string;
  toolStatus?: 'pending' | 'success' | 'error';
  toolOutput?: string;
  // sub-run routing
  bossSubRunId?: string;
  bossSubAgentId?: string;
  runStatus?: 'running' | 'success' | 'error' | 'cancelled';
}

interface SubtaskNode {
  agent: string;
  prompt: string;
  expected_output?: string;
  symbols?: string[];
  subRunId?: string;
  status: 'pending' | 'success' | 'error';
  summary?: string;
  signal?: string;
  confidence?: number;
  error?: string;
  events: WireEvent[];
}

interface TreeState {
  rationale?: string;
  subtasks: Map<string, SubtaskNode>;
  synthesis?: WireEvent['synthesis'];
  conclusion?: string;
  status: 'running' | 'success' | 'error' | 'cancelled';
}

const emptyState = (): TreeState => ({
  subtasks: new Map(),
  status: 'running',
});

function keyFor(evt: WireEvent): string {
  // Events that arrive BEFORE the sub-run has an id are keyed by (agent+prompt).
  // Events that arrive AFTER dispatch use the real subRunId.
  if (evt.subRunId) return `run:${evt.subRunId}`;
  if (evt.bossSubRunId) return `run:${evt.bossSubRunId}`;
  if (evt.subAgentId && evt.subPrompt !== undefined) return `pending:${evt.subAgentId}:${evt.subPrompt}`;
  return '';
}

function reducer(prev: TreeState, evt: WireEvent): TreeState {
  const next: TreeState = { ...prev, subtasks: new Map(prev.subtasks) };

  switch (evt.kind) {
    case 'plan': {
      next.rationale = evt.plan?.rationale ?? evt.text;
      for (const st of evt.plan?.subtasks ?? []) {
        const k = `pending:${st.agent}:${st.prompt}`;
        if (!next.subtasks.has(k)) {
          next.subtasks.set(k, {
            agent: st.agent,
            prompt: st.prompt,
            expected_output: st.expected_output,
            symbols: st.symbols,
            status: 'pending',
            events: [],
          });
        }
      }
      return next;
    }

    case 'subtask': {
      const k = `pending:${evt.subAgentId}:${evt.subPrompt ?? ''}`;
      const existing = next.subtasks.get(k);
      if (existing) {
        existing.status = 'pending';
      } else if (evt.subAgentId) {
        next.subtasks.set(k, {
          agent: evt.subAgentId,
          prompt: evt.subPrompt ?? '',
          status: 'pending',
          events: [],
        });
      }
      return next;
    }

    case 'subtask_result': {
      // Find the matching pending node by (agent+prompt), promote it to
      // a real sub-run keyed by subRunId.
      const pendingKey = `pending:${evt.subAgentId}:${evt.subPrompt ?? ''}`;
      const realKey = evt.subRunId ? `run:${evt.subRunId}` : pendingKey;

      let node = next.subtasks.get(realKey);
      if (!node) {
        // Try to find and re-key a pending node.
        for (const [k, v] of next.subtasks) {
          if (k.startsWith('pending:') && v.agent === evt.subAgentId) {
            node = v;
            next.subtasks.delete(k);
            break;
          }
        }
      }
      if (!node) {
        node = {
          agent: evt.subAgentId ?? 'unknown',
          prompt: evt.subPrompt ?? '',
          status: 'pending',
          events: [],
        };
      }
      node.subRunId = evt.subRunId;
      node.status = evt.subStatus ?? 'success';
      node.summary = evt.subSummary;
      node.signal = evt.subSignal;
      node.confidence = evt.subConfidence;
      node.error = evt.subError;
      next.subtasks.set(realKey, node);
      return next;
    }

    case 'synthesis': {
      next.synthesis = evt.synthesis;
      return next;
    }

    case 'message': {
      if (!evt.bossSubRunId) next.conclusion = evt.text;
      else routeToSubRun(next, evt);
      return next;
    }

    case 'end': {
      next.status = (evt.runStatus as TreeState['status']) ?? 'success';
      return next;
    }

    case 'heartbeat':
      return prev;

    default: {
      // Any remaining event either belongs to a sub-run (annotated by the
      // server with bossSubRunId) or to the boss root — route accordingly.
      if (evt.bossSubRunId) routeToSubRun(next, evt);
      if (evt.runStatus && !evt.bossSubRunId) {
        next.status = evt.runStatus;
      }
      return next;
    }
  }
}

function routeToSubRun(state: TreeState, evt: WireEvent) {
  if (!evt.bossSubRunId) return;
  const k = `run:${evt.bossSubRunId}`;
  let node = state.subtasks.get(k);
  if (!node) {
    node = {
      agent: evt.bossSubAgentId ?? 'unknown',
      prompt: '',
      status: 'pending',
      events: [],
      subRunId: evt.bossSubRunId,
    };
    state.subtasks.set(k, node);
  }
  node.events.push(evt);
}

// ── component ─────────────────────────────────────────────────────────

interface Props {
  runId: string;
}

export function BossRunTree({ runId }: Props) {
  const [state, setState] = useState<TreeState>(emptyState);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    setState(emptyState());
    setError(null);
    const url = `${wsBase(API_BASE)}/api/boss/ws/${encodeURIComponent(runId)}`;
    let alive = true;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (alive) setConnected(true);
    };
    ws.onclose = () => {
      if (alive) setConnected(false);
    };
    ws.onerror = () => {
      if (alive) setError('WebSocket error');
    };
    ws.onmessage = (msg) => {
      let evt: WireEvent;
      try {
        evt = JSON.parse(msg.data) as WireEvent;
      } catch {
        return;
      }
      if (alive) setState((prev) => reducer(prev, evt));
    };

    return () => {
      alive = false;
      try {
        ws.close();
      } catch {}
    };
  }, [runId]);

  const subtasks = useMemo(() => Array.from(state.subtasks.values()), [state]);

  return (
    <div className="flex flex-col gap-3 text-white/80 text-[13px]">
      {/* Boss root */}
      <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="font-medium text-white">Boss</span>
          <StatusPill status={state.status} connected={connected} />
          <span className="text-[11px] text-white/40 ml-auto font-mono">
            {runId}
          </span>
        </div>
        {state.rationale && (
          <div className="mt-2 text-[12px] text-white/60 leading-relaxed">
            <span className="text-white/40">Plan · </span>
            {state.rationale}
          </div>
        )}
        {error && (
          <div className="mt-2 text-[11px] text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {error}
          </div>
        )}
      </div>

      {/* Dispatched subtasks */}
      <div className="pl-4 border-l border-white/10 flex flex-col gap-2">
        {subtasks.length === 0 && (
          <div className="text-[12px] text-white/40 italic">
            {state.status === 'running'
              ? 'Waiting for plan…'
              : 'No subtasks were dispatched.'}
          </div>
        )}
        {subtasks.map((st, i) => (
          <SubtaskCard key={st.subRunId ?? `${st.agent}-${i}`} node={st} />
        ))}
      </div>

      {/* Synthesis */}
      {state.synthesis && (
        <div className="rounded-md border border-purple-400/20 bg-purple-400/[0.04] p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-300" />
            <span className="font-medium text-white">Synthesis</span>
            {state.synthesis.overall_signal && (
              <span className="text-[11px] text-white/60 ml-2">
                signal:{' '}
                <span className="text-white">
                  {state.synthesis.overall_signal}
                </span>
                {state.synthesis.overall_confidence !== undefined && (
                  <>
                    {' · conf: '}
                    <span className="text-white">
                      {(state.synthesis.overall_confidence * 100).toFixed(0)}%
                    </span>
                  </>
                )}
              </span>
            )}
          </div>
          <div className="text-[12.5px] text-white/75 leading-relaxed">
            {state.synthesis.summary}
          </div>
          {!!state.synthesis.recommendations?.length && (
            <ul className="mt-2 space-y-1">
              {state.synthesis.recommendations.map((r, i) => (
                <li
                  key={i}
                  className="text-[12px] text-white/70 flex items-baseline gap-2"
                >
                  <span className="text-[10px] uppercase tracking-wider text-purple-300 shrink-0">
                    {r.action}
                  </span>
                  <span className="text-white">{r.symbol}</span>
                  <span className="text-white/50 truncate">{r.reasoning}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Conclusion */}
      {state.conclusion && !state.synthesis && (
        <div className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-[12.5px] text-white/80">
          {state.conclusion}
        </div>
      )}
    </div>
  );
}

// ── pieces ────────────────────────────────────────────────────────────

function StatusPill({
  status,
  connected,
}: {
  status: TreeState['status'];
  connected: boolean;
}) {
  if (status === 'success')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
        <CheckCircle2 className="w-3 h-3" /> done
      </span>
    );
  if (status === 'error')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300">
        <AlertCircle className="w-3 h-3" /> error
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200">
      {connected ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Activity className="w-3 h-3" />
      )}
      {connected ? 'running' : 'connecting'}
    </span>
  );
}

function SubtaskCard({ node }: { node: SubtaskNode }) {
  const [open, setOpen] = useState(false);
  const pill =
    node.status === 'success'
      ? 'bg-emerald-500/15 text-emerald-300'
      : node.status === 'error'
      ? 'bg-red-500/15 text-red-300'
      : 'bg-amber-500/15 text-amber-200';

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-3 py-2 flex items-center gap-2"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-white/40" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-white/40" />
        )}
        <span className="font-mono text-[11.5px] text-white/80">
          {node.agent}
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${pill}`}
        >
          {node.status === 'pending' && <Loader2 className="w-3 h-3 animate-spin" />}
          {node.status}
        </span>
        {node.signal && (
          <span className="text-[10px] text-white/50">
            {node.signal}
            {node.confidence !== undefined
              ? ` · ${(node.confidence * 100).toFixed(0)}%`
              : ''}
          </span>
        )}
        <span className="text-[11.5px] text-white/50 truncate flex-1">
          {node.summary || node.prompt}
        </span>
        {node.subRunId && (
          <span className="text-[10px] text-white/30 font-mono shrink-0">
            {node.subRunId.slice(-6)}
          </span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-white/5 text-[12px] text-white/60 space-y-1">
          {node.prompt && (
            <div>
              <span className="text-white/40">Prompt: </span>
              {node.prompt}
            </div>
          )}
          {node.error && (
            <div className="text-red-300">
              <span className="text-white/40">Error: </span>
              {node.error}
            </div>
          )}
          {node.events.length === 0 && node.status === 'pending' && (
            <div className="italic text-white/30">Waiting for events…</div>
          )}
          {node.events.length > 0 && (
            <ul className="space-y-0.5 mt-1">
              {node.events.slice(-40).map((e, i) => (
                <li key={e.id ?? i} className="flex gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-white/30 w-20 shrink-0">
                    {e.kind}
                  </span>
                  <span className="truncate">
                    {e.toolName && <span className="text-white/70 mr-1">[{e.toolName}]</span>}
                    {e.text || e.toolOutput}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
