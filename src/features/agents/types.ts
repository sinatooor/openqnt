/**
 * Agent monitoring types — describe the "team" of AI agents the user has,
 * the work they're doing right now, and what they've done before.
 *
 * These types are the canonical shape for anything that wants to drive the
 * /agents page: the strategy-flow canvas (which auto-registers agent nodes),
 * the simulated runtime, and — in the future — the backend's real ADK event
 * stream.
 */

// ──────────────────────────────────────────────────────────────────────────
// Stream events — Cursor-style granular "what is the agent doing now"
// ──────────────────────────────────────────────────────────────────────────

export type StreamEventKind =
  | 'status'       // 'Agent started', 'Planning…', 'Waiting for tool'
  | 'thought'      // internal reasoning ("I should check HDS for AAPL first …")
  | 'tool_call'    // invoking a tool — includes name + args; status 'pending'
  | 'tool_result'  // completion of a tool call — success/error + output
  | 'message'      // user-facing message / final conclusion
  | 'artifact'     // agent saved something (plot, csv, code, etc.)
  | 'error';       // agent-level error

export type ToolStatus = 'pending' | 'success' | 'error';

export interface StreamEvent {
  id: string;
  agentId: string;
  runId: string;
  kind: StreamEventKind;
  ts: number;                 // unix ms

  /** For 'thought' / 'message' / 'status' / 'error' */
  text?: string;
  /** `true` while the text is still being streamed in chunks */
  partial?: boolean;

  /** For 'tool_call' / 'tool_result' */
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  toolStatus?: ToolStatus;
  /** Links tool_result back to its originating tool_call */
  parentEventId?: string;

  /** For 'artifact' — id into the store's `artifacts` map */
  artifactId?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Artifacts — plots, files, tables, code the agent produces
// ──────────────────────────────────────────────────────────────────────────

export type ArtifactKind = 'plot' | 'table' | 'file' | 'code';

export interface Artifact {
  id: string;
  agentId: string;
  runId: string;
  kind: ArtifactKind;
  title: string;
  createdAt: number;

  /** For plots — data URL (image/svg+xml, image/png, …) */
  dataUrl?: string;
  /** For code / table / file */
  text?: string;
  mime?: string;
  /** Short caption the agent wrote */
  caption?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Runs — one complete task from start to finish
// ──────────────────────────────────────────────────────────────────────────

export type RunStatus = 'running' | 'success' | 'error' | 'cancelled';

export interface RunRecord {
  id: string;
  agentId: string;
  task: string;              // what the user asked for / what triggered it
  symbols?: string[];
  model?: string;
  startedAt: number;
  endedAt?: number;
  status: RunStatus;

  /** Final free-text conclusion the agent wrote */
  conclusion?: string;
  /** Optional structured output */
  signal?: 'bullish' | 'bearish' | 'neutral';
  confidence?: number;       // 0..1
  error?: string;

  /** Denormalised counts for fast rendering of the history tab */
  toolCallCount: number;
  artifactCount: number;
  thoughtCount: number;
}

// ──────────────────────────────────────────────────────────────────────────
// Agent instances — the "employees" shown on the /agents page
// ──────────────────────────────────────────────────────────────────────────

export type AgentSource = 'flow' | 'legacy' | 'manual';

export interface AgentInstance {
  id: string;                // canonical id (flow node id OR legacy key)
  label: string;
  /** Maps to the backend / canonical agent type (e.g. 'quant_analyst') */
  agentType: string;
  /** The specific UI node subtype (e.g. 'quantAgentNode'), if flow-sourced */
  agentNodeType?: string;
  source: AgentSource;
  icon?: string;             // lucide icon name
  color?: string;            // accent hex
  createdAt: number;
  lastActive?: number;

  /** Freeform markdown the agent keeps as its "notebook" — memory.md */
  memory: string;

  /** Arbitrary per-agent config (e.g. enabled terminal tools, model) */
  meta?: Record<string, unknown>;
}
