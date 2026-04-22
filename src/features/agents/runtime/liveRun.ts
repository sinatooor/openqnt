/**
 * liveRun — drives a real backend agent run through the same Zustand store
 * the simulated runtime feeds.
 *
 * Flow:
 *   1. POST /api/agent-runtime/run  → returns { run_id, agent_id, task }
 *   2. Mirror the run into the local store with the backend's run_id so the
 *      timeline shows up immediately.
 *   3. Open a WebSocket to /api/agent-runtime/ws/runs/{run_id} which replays
 *      backlog then streams live events.
 *   4. For every event, dispatch into emitEvent / addArtifact / endRun so the
 *      Cursor-style stream UI behaves exactly like the simulated path.
 *
 * The contract here mirrors `simulateAgentRun({...}) -> runId`.
 */
import { useAgentMonitorStore } from '../store/agentMonitorStore';
import type { ArtifactKind, RunStatus, StreamEventKind } from '../types';

// ── config ────────────────────────────────────────────────────────────

const API_BASE = (import.meta as any).env?.VITE_BACKEND_URL?.replace(/\/$/, '')
  ?? 'http://localhost:8000';

function wsBaseFor(httpBase: string): string {
  return httpBase.replace(/^http/i, 'ws');
}

// ── types ─────────────────────────────────────────────────────────────

export interface LiveRunOptions {
  /** Local AgentInstance id (flow node id or legacy key). */
  agentId: string;
  /** Backend agent_id; defaults to the local agent's `agentType`. */
  backendAgentId?: string;
  task?: string;
  symbols?: string[];
  model?: string;
  /** Extra context forwarded to the backend agent. */
  context?: Record<string, unknown>;
}

interface BackendEvent {
  id: string;
  agentId?: string;
  runId: string;
  kind: StreamEventKind | 'heartbeat' | 'end';
  ts: number;
  text?: string;
  partial?: boolean;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  toolStatus?: 'pending' | 'success' | 'error';
  parentEventId?: string;
  artifactId?: string;
  artifactKind?: ArtifactKind;
  artifactPath?: string;
  caption?: string;
  runStatus?: RunStatus;
  signal?: 'bullish' | 'bearish' | 'neutral';
  confidence?: number;
}

// ── public entry point ────────────────────────────────────────────────

/**
 * Kick off a live (backend-driven) run for `agentId`. Returns a Promise
 * that resolves with the run_id once the backend has acknowledged the
 * POST. Events flow into the store asynchronously via the WS subscriber.
 */
export async function startLiveAgentRun(opts: LiveRunOptions): Promise<string> {
  const store = useAgentMonitorStore.getState();
  const agent = store.agents[opts.agentId];
  if (!agent) throw new Error(`Unknown agent ${opts.agentId}`);

  const backendAgentId = opts.backendAgentId ?? agent.agentType;
  const symbols = opts.symbols
    ?? (agent.meta?.symbols as string[] | undefined)
    ?? ['SPY'];
  const task = opts.task ?? `Live run for ${symbols.join(', ')}`;
  const model = opts.model ?? (agent.meta?.model as string | undefined);

  const res = await fetch(`${API_BASE}/api/agent-runtime/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_id: backendAgentId,
      task,
      symbols,
      model,
      context: opts.context,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Backend rejected run (${res.status}): ${txt.slice(0, 200)}`);
  }
  const body = (await res.json()) as { run_id: string; agent_id: string };
  const runId = body.run_id;

  // Mirror the run into the local store using the backend's run_id so events
  // dispatched by the WS subscriber land on the right timeline.
  store.startRun({
    agentId: opts.agentId,
    task,
    symbols,
    model,
    runId,
  });

  // Subscribe in the background.
  void subscribeToRun({
    localAgentId: opts.agentId,
    backendAgentId,
    runId,
  });

  return runId;
}

// ── WS subscriber ─────────────────────────────────────────────────────

interface SubscribeArgs {
  localAgentId: string;
  backendAgentId: string;
  runId: string;
}

function subscribeToRun({ localAgentId, backendAgentId, runId }: SubscribeArgs): void {
  const url = `${wsBaseFor(API_BASE)}/api/agent-runtime/ws/runs/${runId}?agent_id=${encodeURIComponent(backendAgentId)}`;
  let ws: WebSocket;
  try {
    ws = new WebSocket(url);
  } catch (e) {
    const s = useAgentMonitorStore.getState();
    s.emitEvent({
      agentId: localAgentId,
      runId,
      kind: 'error',
      text: `WebSocket open failed: ${(e as Error).message}`,
    });
    s.endRun(runId, { status: 'error', error: 'WebSocket open failed' });
    return;
  }

  ws.onmessage = (msg) => {
    let evt: BackendEvent;
    try {
      evt = JSON.parse(msg.data) as BackendEvent;
    } catch {
      return;
    }
    handleBackendEvent({ localAgentId, backendAgentId, runId, evt });
  };

  ws.onerror = () => {
    const s = useAgentMonitorStore.getState();
    s.emitEvent({
      agentId: localAgentId,
      runId,
      kind: 'error',
      text: 'WebSocket error',
    });
  };

  ws.onclose = () => {
    const s = useAgentMonitorStore.getState();
    const run = s.runs[runId];
    if (run && run.status === 'running') {
      // The backend usually sends `runStatus` first; if we got disconnected
      // before that, fall back to marking the run as cancelled so the UI
      // doesn't spin forever.
      s.endRun(runId, { status: 'cancelled', error: 'Stream disconnected' });
    }
  };
}

// ── event dispatcher ──────────────────────────────────────────────────

function handleBackendEvent({
  localAgentId,
  backendAgentId,
  runId,
  evt,
}: {
  localAgentId: string;
  backendAgentId: string;
  runId: string;
  evt: BackendEvent;
}): void {
  if (evt.kind === 'heartbeat' || evt.kind === 'end') return;

  const s = useAgentMonitorStore.getState();

  // Artifact events: register the artifact + emit a stream event linking to it.
  if (evt.kind === 'artifact' && evt.artifactPath) {
    const artifactUrl = artifactUrlFor(backendAgentId, runId, evt.artifactPath);
    const kind: ArtifactKind = (evt.artifactKind as ArtifactKind) ?? 'file';
    const aid = s.addArtifact({
      id: evt.artifactId,
      agentId: localAgentId,
      runId,
      kind,
      title: evt.text ?? evt.artifactId ?? 'artifact',
      dataUrl: kind === 'plot' ? artifactUrl : undefined,
      text: kind !== 'plot' ? artifactUrl : undefined,
      caption: evt.caption,
    });
    void aid;
    return;
  }

  // Terminal status from ctx.finish().
  if (evt.runStatus && (evt.runStatus === 'success' || evt.runStatus === 'error' || evt.runStatus === 'cancelled')) {
    s.emitEvent({
      id: evt.id,
      agentId: localAgentId,
      runId,
      kind: evt.kind as StreamEventKind,
      ts: evt.ts,
      text: evt.text,
    });
    s.endRun(runId, {
      status: evt.runStatus,
      conclusion: evt.text,
      signal: evt.signal,
      confidence: evt.confidence,
      error: evt.runStatus === 'error' ? evt.text : undefined,
    });
    return;
  }

  // Generic event passthrough.
  s.emitEvent({
    id: evt.id,
    agentId: localAgentId,
    runId,
    kind: evt.kind as StreamEventKind,
    ts: evt.ts,
    text: evt.text,
    partial: evt.partial,
    toolName: evt.toolName,
    toolInput: evt.toolInput,
    toolOutput: evt.toolOutput,
    toolStatus: evt.toolStatus,
    parentEventId: evt.parentEventId,
    artifactId: evt.artifactId,
  });
}

function artifactUrlFor(backendAgentId: string, runId: string, artifactPath: string): string {
  // artifactPath is "/plots/foo.png" or "/artifacts/bar.json"
  const trimmed = artifactPath.replace(/^\/+/, '');
  const [sub, ...rest] = trimmed.split('/');
  const name = rest.join('/');
  return `${API_BASE}/api/agent-runtime/runs/${runId}/artifact/${sub}/${encodeURIComponent(name)}?agent_id=${encodeURIComponent(backendAgentId)}`;
}

// ── memory hydration helper ───────────────────────────────────────────

/**
 * Fetch the persisted memory.md for a backend agent and overwrite the local
 * agent's memory. Useful when the user opens an agent for the first time.
 */
export async function hydrateAgentMemoryFromBackend(
  localAgentId: string,
  backendAgentId: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/agent-runtime/agents/${encodeURIComponent(backendAgentId)}/memory`,
  );
  if (!res.ok) return;
  const md = await res.text();
  if (md && md.trim()) {
    useAgentMonitorStore.getState().setMemory(localAgentId, md);
  }
}
