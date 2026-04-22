/**
 * Agent monitor store — single source of truth for the /agents page.
 *
 *  - `agents`    — every agent the user has "hired" (canvas nodes +
 *                  legacy catalogue). `memory` is persisted so each agent
 *                  keeps an evolving notebook across sessions.
 *  - `runs`      — full history of every task, with conclusions & signals.
 *  - `events`    — per-run timeline (thoughts, tool calls, artifacts, …).
 *                  Not persisted; replays from backend on reload.
 *  - `artifacts` — plots / tables / files produced by an agent, keyed by id.
 *
 *  All mutations flow through `useAgentMonitorStore.getState()` so they can
 *  be called from anywhere (UI components, simulated runtime, future SSE
 *  bridge to the Python backend).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AgentInstance,
  Artifact,
  RunRecord,
  RunStatus,
  StreamEvent,
} from '../types';

// ───────────────────────────────────────────────────── Helpers ──────────
const uid = (prefix: string = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const MAX_EVENTS_PER_RUN = 500;
const MAX_RUNS_PER_AGENT = 50;

// ───────────────────────────────────────────── Store shape ──────────────

interface AgentMonitorState {
  agents: Record<string, AgentInstance>;
  runs: Record<string, RunRecord>;
  /** eventsByRun[runId] = events[] (ordered by ts ascending) */
  eventsByRun: Record<string, StreamEvent[]>;
  artifacts: Record<string, Artifact>;

  /** UI state */
  selectedAgentId: string | null;
  activeRunIdByAgent: Record<string, string | undefined>;
}

interface AgentMonitorActions {
  // ── Agent registry ────────────────────────────────────────────
  registerAgent: (agent: Omit<AgentInstance, 'createdAt' | 'memory'> & {
    memory?: string;
    createdAt?: number;
  }) => void;
  updateAgent: (id: string, patch: Partial<AgentInstance>) => void;
  removeAgent: (id: string) => void;
  selectAgent: (id: string | null) => void;

  // ── Memory.md ─────────────────────────────────────────────────
  setMemory: (agentId: string, markdown: string) => void;
  appendMemory: (agentId: string, markdown: string) => void;

  // ── Runs ──────────────────────────────────────────────────────
  startRun: (input: {
    agentId: string;
    task: string;
    symbols?: string[];
    model?: string;
    runId?: string;
  }) => string;
  endRun: (runId: string, patch: {
    status: RunStatus;
    conclusion?: string;
    signal?: RunRecord['signal'];
    confidence?: number;
    error?: string;
  }) => void;
  cancelRun: (runId: string) => void;

  // ── Stream events ─────────────────────────────────────────────
  emitEvent: (
    event: Omit<StreamEvent, 'id' | 'ts'> & { id?: string; ts?: number }
  ) => string;
  patchEvent: (eventId: string, patch: Partial<StreamEvent>) => void;

  // ── Artifacts ─────────────────────────────────────────────────
  addArtifact: (artifact: Omit<Artifact, 'id' | 'createdAt'> & {
    id?: string;
    createdAt?: number;
  }) => string;

  // ── Bulk utilities ────────────────────────────────────────────
  clearAgentHistory: (agentId: string) => void;
}

type Store = AgentMonitorState & AgentMonitorActions;

// ───────────────────────────────────────────── Implementation ───────────

export const useAgentMonitorStore = create<Store>()(
  persist(
    (set, get) => ({
      agents: {},
      runs: {},
      eventsByRun: {},
      artifacts: {},
      selectedAgentId: null,
      activeRunIdByAgent: {},

      // ── Agent registry ──────────────────────────────────────────
      registerAgent: ({ id, memory, createdAt, ...rest }) => {
        const existing = get().agents[id];
        if (existing) {
          // Don't clobber memory. Update mutable fields only.
          set((s) => ({
            agents: {
              ...s.agents,
              [id]: {
                ...existing,
                label: rest.label ?? existing.label,
                agentType: rest.agentType ?? existing.agentType,
                agentNodeType: rest.agentNodeType ?? existing.agentNodeType,
                source: rest.source ?? existing.source,
                icon: rest.icon ?? existing.icon,
                color: rest.color ?? existing.color,
                meta: { ...(existing.meta ?? {}), ...(rest.meta ?? {}) },
              },
            },
          }));
          return;
        }
        const agent: AgentInstance = {
          id,
          label: rest.label,
          agentType: rest.agentType,
          agentNodeType: rest.agentNodeType,
          source: rest.source,
          icon: rest.icon,
          color: rest.color,
          meta: rest.meta,
          createdAt: createdAt ?? Date.now(),
          memory: memory ?? defaultMemory(rest.label, rest.agentType),
        };
        set((s) => ({ agents: { ...s.agents, [id]: agent } }));
      },

      updateAgent: (id, patch) =>
        set((s) =>
          s.agents[id]
            ? { agents: { ...s.agents, [id]: { ...s.agents[id], ...patch } } }
            : s
        ),

      removeAgent: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.agents;
          return {
            agents: rest,
            selectedAgentId: s.selectedAgentId === id ? null : s.selectedAgentId,
          };
        }),

      selectAgent: (id) => set({ selectedAgentId: id }),

      // ── Memory.md ───────────────────────────────────────────────
      setMemory: (agentId, markdown) =>
        set((s) =>
          s.agents[agentId]
            ? {
                agents: {
                  ...s.agents,
                  [agentId]: { ...s.agents[agentId], memory: markdown },
                },
              }
            : s
        ),

      appendMemory: (agentId, markdown) => {
        const agent = get().agents[agentId];
        if (!agent) return;
        const sep = agent.memory.endsWith('\n') ? '' : '\n';
        get().setMemory(agentId, `${agent.memory}${sep}${markdown}`);
      },

      // ── Runs ────────────────────────────────────────────────────
      startRun: ({ agentId, task, symbols, model, runId: explicitRunId }) => {
        const runId = explicitRunId ?? uid('run');
        const now = Date.now();
        const run: RunRecord = {
          id: runId,
          agentId,
          task,
          symbols,
          model,
          startedAt: now,
          status: 'running',
          toolCallCount: 0,
          artifactCount: 0,
          thoughtCount: 0,
        };
        set((s) => {
          // Trim oldest runs for this agent to keep localStorage happy.
          const agentRuns = Object.values(s.runs)
            .filter((r) => r.agentId === agentId)
            .sort((a, b) => b.startedAt - a.startedAt);
          const keep = agentRuns.slice(0, MAX_RUNS_PER_AGENT - 1).map((r) => r.id);
          const filteredRuns: Record<string, RunRecord> = {};
          for (const [rid, r] of Object.entries(s.runs)) {
            if (r.agentId !== agentId || keep.includes(rid)) filteredRuns[rid] = r;
          }
          return {
            runs: { ...filteredRuns, [runId]: run },
            activeRunIdByAgent: { ...s.activeRunIdByAgent, [agentId]: runId },
            agents: {
              ...s.agents,
              [agentId]: s.agents[agentId]
                ? { ...s.agents[agentId], lastActive: now }
                : s.agents[agentId],
            },
          };
        });
        // Seed with a status event so the timeline never appears empty.
        get().emitEvent({
          agentId,
          runId,
          kind: 'status',
          text: `Started task: ${task}`,
        });
        return runId;
      },

      endRun: (runId, patch) =>
        set((s) => {
          const run = s.runs[runId];
          if (!run) return s;
          const nextRuns = {
            ...s.runs,
            [runId]: {
              ...run,
              status: patch.status,
              conclusion: patch.conclusion ?? run.conclusion,
              signal: patch.signal ?? run.signal,
              confidence: patch.confidence ?? run.confidence,
              error: patch.error ?? run.error,
              endedAt: Date.now(),
            },
          };
          const activeForAgent = s.activeRunIdByAgent[run.agentId];
          const nextActive =
            activeForAgent === runId
              ? { ...s.activeRunIdByAgent, [run.agentId]: undefined }
              : s.activeRunIdByAgent;
          return { runs: nextRuns, activeRunIdByAgent: nextActive };
        }),

      cancelRun: (runId) => {
        const run = get().runs[runId];
        if (!run || run.status !== 'running') return;
        get().emitEvent({
          agentId: run.agentId,
          runId,
          kind: 'status',
          text: 'Run cancelled by user.',
        });
        get().endRun(runId, { status: 'cancelled' });
      },

      // ── Stream events ───────────────────────────────────────────
      emitEvent: ({ id, ts, ...rest }) => {
        const eventId = id ?? uid('evt');
        const ev: StreamEvent = {
          id: eventId,
          ts: ts ?? Date.now(),
          ...rest,
        };
        set((s) => {
          const existing = s.eventsByRun[ev.runId] ?? [];
          const next = [...existing, ev];
          // Trim if too long.
          const trimmed = next.length > MAX_EVENTS_PER_RUN
            ? next.slice(next.length - MAX_EVENTS_PER_RUN)
            : next;
          const run = s.runs[ev.runId];
          const updatedRun = run
            ? {
                ...run,
                toolCallCount:
                  run.toolCallCount + (ev.kind === 'tool_call' ? 1 : 0),
                artifactCount:
                  run.artifactCount + (ev.kind === 'artifact' ? 1 : 0),
                thoughtCount:
                  run.thoughtCount + (ev.kind === 'thought' ? 1 : 0),
              }
            : run;
          return {
            eventsByRun: { ...s.eventsByRun, [ev.runId]: trimmed },
            runs: updatedRun ? { ...s.runs, [ev.runId]: updatedRun } : s.runs,
            agents: s.agents[ev.agentId]
              ? {
                  ...s.agents,
                  [ev.agentId]: {
                    ...s.agents[ev.agentId],
                    lastActive: ev.ts,
                  },
                }
              : s.agents,
          };
        });
        return eventId;
      },

      patchEvent: (eventId, patch) =>
        set((s) => {
          // We don't know which runId owns it, so search. Small data, cheap.
          let changedRunId: string | undefined;
          const nextEvents: Record<string, StreamEvent[]> = {};
          for (const [runId, evs] of Object.entries(s.eventsByRun)) {
            let changed = false;
            const updated = evs.map((e) => {
              if (e.id !== eventId) return e;
              changed = true;
              return { ...e, ...patch };
            });
            if (changed) changedRunId = runId;
            nextEvents[runId] = changed ? updated : evs;
          }
          return changedRunId ? { eventsByRun: nextEvents } : s;
        }),

      // ── Artifacts ───────────────────────────────────────────────
      addArtifact: ({ id, createdAt, ...rest }) => {
        const aid = id ?? uid('art');
        const artifact: Artifact = {
          id: aid,
          createdAt: createdAt ?? Date.now(),
          ...rest,
        };
        set((s) => ({ artifacts: { ...s.artifacts, [aid]: artifact } }));
        // Also emit an event so it shows up inline in the stream.
        get().emitEvent({
          agentId: artifact.agentId,
          runId: artifact.runId,
          kind: 'artifact',
          artifactId: aid,
          text: artifact.title,
        });
        return aid;
      },

      // ── Bulk utilities ──────────────────────────────────────────
      clearAgentHistory: (agentId) =>
        set((s) => {
          const keptRuns: Record<string, RunRecord> = {};
          const keptEvents: Record<string, StreamEvent[]> = {};
          for (const [rid, r] of Object.entries(s.runs)) {
            if (r.agentId !== agentId) {
              keptRuns[rid] = r;
              if (s.eventsByRun[rid]) keptEvents[rid] = s.eventsByRun[rid];
            }
          }
          const keptArtifacts: Record<string, Artifact> = {};
          for (const [aid, a] of Object.entries(s.artifacts)) {
            if (a.agentId !== agentId) keptArtifacts[aid] = a;
          }
          return {
            runs: keptRuns,
            eventsByRun: keptEvents,
            artifacts: keptArtifacts,
            activeRunIdByAgent: {
              ...s.activeRunIdByAgent,
              [agentId]: undefined,
            },
          };
        }),
    }),
    {
      name: 'agent-monitor-v1',
      storage: createJSONStorage(() => localStorage),
      // Persist only the "slow-moving" bits. Events are replayed on reconnect;
      // keeping only the latest N keeps localStorage size bounded.
      partialize: (s) => ({
        agents: s.agents,
        runs: s.runs,
        artifacts: s.artifacts,
      }),
    }
  )
);

// ─────────────────────────────────────────── Selectors / helpers ────────

export const selectAgents = (s: Store) =>
  Object.values(s.agents).sort((a, b) => a.createdAt - b.createdAt);

export const selectAgentRuns = (agentId: string) => (s: Store) =>
  Object.values(s.runs)
    .filter((r) => r.agentId === agentId)
    .sort((a, b) => b.startedAt - a.startedAt);

export const selectRunEvents = (runId: string) => (s: Store) =>
  s.eventsByRun[runId] ?? [];

export const selectAgentArtifacts = (agentId: string) => (s: Store) =>
  Object.values(s.artifacts)
    .filter((a) => a.agentId === agentId)
    .sort((a, b) => b.createdAt - a.createdAt);

export const selectActiveRunFor = (agentId: string) => (s: Store) => {
  const rid = s.activeRunIdByAgent[agentId];
  return rid ? s.runs[rid] : undefined;
};

// ───────────────────────────────────────── Default memory.md ────────────

function defaultMemory(label: string, agentType: string): string {
  return `# ${label}

> **Role:** ${agentType}
> **Hired:** ${new Date().toLocaleString()}

## Mandate
_Describe what this agent is responsible for._

## Beliefs & priors
- _Hypotheses the agent holds about the market or about assets it covers._

## Observations
- _Short log of what the agent has learned over time. Append-only._

## Open questions
- _Things this agent wants to investigate next._
`;
}
