/**
 * Agent-tool contract shared across all Bloomberg-style terminal functions.
 *
 * Every terminal function (RMAP, SPLC, BMAP, HDS, …) should implement a
 * `TerminalTool` so quant agents in this app can discover, invoke, and ingest
 * its output without needing any knowledge of React or the UI.
 *
 * The contract is intentionally thin:
 *
 *   1. `inputSchema` — a JSON-Schema-like shape describing the call arguments
 *      (e.g. `{ ticker: "AAPL" }`).
 *   2. `fetch`       — pure function that returns strongly-typed structured
 *      data.  Today this is backed by deterministic mock generators; once real
 *      data feeds exist, swap the implementation and every agent / UI keeps
 *      working unchanged.
 *   3. `formatForAgent` — reduces the structured payload into a clean,
 *      token-efficient Markdown / plain-text summary suitable for direct
 *      injection into an LLM prompt.  This is the *agent-facing view*.
 *
 * The UI components are a separate concern: they consume `fetch()` directly.
 */

export type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

export interface JsonSchema {
  type: JsonSchemaType;
  description?: string;
  enum?: readonly (string | number)[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  default?: unknown;
  examples?: readonly unknown[];
}

export interface TerminalToolMeta {
  /** Bloomberg-style mnemonic, e.g. "HDS" */
  code: string;
  /** Human-friendly label */
  label: string;
  /** One-line description, used by the agent as the tool's prompt description */
  description: string;
  /** URL template for humans (the React page that renders this tool) */
  pagePath: (input: Record<string, unknown>) => string;
  /** Whether this tool needs a ticker/identifier to operate */
  requiresTicker: boolean;
}

export interface TerminalTool<TInput, TData> extends TerminalToolMeta {
  inputSchema: JsonSchema;
  /** Fetch (or synthesise) structured data.  Can be sync or async. */
  fetch: (input: TInput) => TData | Promise<TData>;
  /** Reduce structured data to clean text for LLM consumption. */
  formatForAgent: (data: TData) => string;
  /** Optional short (<=500 char) preview for agent tool lists */
  summarise?: (data: TData) => string;
}

/** Minimal runtime-callable view — convenient when iterating over the registry. */
export type AnyTerminalTool = TerminalTool<Record<string, unknown>, unknown>;
