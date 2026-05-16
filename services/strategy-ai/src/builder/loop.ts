/**
 * Builder loop — runs the Vercel AI SDK agent with our tools and applies the
 * failure-signature guard.
 *
 * Mirrors the budget/structure from
 * `n8n-reference/packages/@n8n/instance-ai/src/workflow-loop/workflow-loop-controller.ts`:
 *
 *   - MAX_VALIDATE_ATTEMPTS = 3   (n8n: MAX_PRE_SAVE_SUBMIT_FAILURES = 3)
 *   - Each unique `failureSignature` is allowed exactly one repair attempt
 *   - On second sighting of the same signature, the agent must escalate via
 *     `ask_user` rather than continuing to fight itself.
 */

import { generateText, type CoreMessage } from 'ai';
import type { LanguageModelV1 } from 'ai';
import {
  type StrategyDraft,
  EMPTY_DRAFT,
} from '../types/strategy-draft';
import { type BuilderEvent, type BuilderState, type CatalogIndex, buildCatalogIndex, createBuilderTools } from './tools';
import { BUILDER_AGENT_PROMPT } from './prompt';
import type { PythonBridge } from '../python-bridge';

export const MAX_VALIDATE_ATTEMPTS = 3;
// Each add_node / connect / lookup / validate / verify / submit counts as one
// step. A 12-node strategy with 15 edges already takes ~30 steps, so 24 was
// too tight — the agent ran out of budget before calling submit().
export const MAX_AGENT_STEPS = 50;

export interface BuilderRunInput {
  /** Natural-language user request. */
  message: string;
  /** The starting draft (e.g. the current canvas state). Defaults to empty. */
  initialDraft?: StrategyDraft;
  /** Optional prior conversation context (orchestrator-aware). */
  history?: CoreMessage[];
}

export interface BuilderRunResult {
  draft: StrategyDraft;
  /** Final user-visible message. Either the agent's `submit.summary` or its last text. */
  summary: string;
  validateCount: number;
  events: BuilderEvent[];
  /** True if a duplicate failure signature blocked the loop. */
  blockedByLoopGuard: boolean;
}

export interface BuilderDeps {
  bridge: PythonBridge;
  model: LanguageModelV1;
  /** Optional event sink for streaming. Defaults to in-memory collection. */
  onEvent?: (e: BuilderEvent) => void;
}

/**
 * Run the Builder agent against the user's message and return the final draft.
 */
export const runBuilder = async (
  input: BuilderRunInput,
  deps: BuilderDeps,
): Promise<BuilderRunResult> => {
  const collectedEvents: BuilderEvent[] = [];
  const onEvent = (e: BuilderEvent) => {
    collectedEvents.push(e);
    deps.onEvent?.(e);
  };

  // Fetch catalog once per run (cheap, but cache across runs is a future opt).
  const catalogResponse = await deps.bridge.getCatalog();
  const catalog: CatalogIndex = buildCatalogIndex(catalogResponse.catalog);

  const state: BuilderState = {
    draft: input.initialDraft ?? structuredClone(EMPTY_DRAFT),
    seenFailures: new Map(),
    validateCount: 0,
    onEvent,
  };

  const tools = createBuilderTools(state, catalog, deps.bridge);

  const userContext = buildUserMessage(input);

  const messages: CoreMessage[] = [
    ...(input.history ?? []),
    { role: 'user', content: userContext },
  ];

  let blockedByLoopGuard = false;
  let lastText = '';

  // We run via generateText so the SDK orchestrates the tool-call loop for us;
  // we still enforce our own budget on top.
  const { text } = await generateText({
    model: deps.model,
    system: BUILDER_AGENT_PROMPT,
    messages,
    tools,
    maxSteps: MAX_AGENT_STEPS,
    // Stop early when (a) the agent has called submit, or (b) it has burned
    // its validate budget and a duplicate failure-signature was detected.
    experimental_continueSteps: false,
  });

  lastText = text;

  // Post-run guard: if validate fired ≥3 times and any signature was seen twice,
  // mark the run as blocked by loop guard. The draft is still returned so the
  // caller can surface partial work to the user.
  if (state.validateCount >= MAX_VALIDATE_ATTEMPTS) {
    for (const [, count] of state.seenFailures) {
      if (count >= 2) {
        blockedByLoopGuard = true;
        break;
      }
    }
  }

  return {
    draft: state.draft,
    summary: state.submitted?.summary ?? lastText.trim() ?? 'Builder run finished without an explicit submit.',
    validateCount: state.validateCount,
    events: collectedEvents,
    blockedByLoopGuard,
  };
};

const buildUserMessage = (input: BuilderRunInput): string => {
  const draftSummary = describeDraft(input.initialDraft);
  return [
    `User request:`,
    input.message,
    ``,
    `Current draft (will be edited in place):`,
    draftSummary,
  ].join('\n');
};

const describeDraft = (draft?: StrategyDraft): string => {
  if (!draft || (draft.nodes.length === 0 && draft.edges.length === 0)) {
    return '(empty canvas — no nodes yet)';
  }
  const lines: string[] = [];
  lines.push(`nodes (${draft.nodes.length}):`);
  for (const n of draft.nodes) {
    const sub =
      (n.data as Record<string, unknown>).indicatorType ??
      (n.data as Record<string, unknown>).conditionType ??
      (n.data as Record<string, unknown>).actionType ??
      (n.data as Record<string, unknown>).controlType ??
      (n.data as Record<string, unknown>).triggerType ??
      n.type;
    lines.push(`  ${n.id} :: ${n.type}/${String(sub)}`);
  }
  lines.push(`edges (${draft.edges.length}):`);
  for (const e of draft.edges) {
    lines.push(`  ${e.id} :: ${e.source} -> ${e.target}`);
  }
  if (draft.settings.context) {
    const c = draft.settings.context;
    lines.push(`context: portfolio=${c.portfolio ?? '(none)'} tickers=${(c.tickers ?? []).join(',')} mode=${c.mode ?? 'paper'} capital=${c.capital ?? 0}`);
  }
  return lines.join('\n');
};
