/**
 * Provider selection for the Builder agent.
 *
 * Defaults to Anthropic Claude — the rest of the strategy AI pipeline migrated
 * off Gemini after free-tier quota limits made the iterate-on-tool-calls loop
 * unworkable. Google remains selectable via `STRATEGY_AI_PROVIDER=google` for
 * fallback / experimentation but is no longer the default.
 */

import type { LanguageModelV1 } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';

export type ProviderName = 'google' | 'anthropic';

export interface ResolvedModel {
  model: LanguageModelV1;
  provider: ProviderName;
  modelId: string;
}

const anthropicKey = (): string | undefined => process.env.ANTHROPIC_API_KEY;

// Accept the backend's env-var spelling (`GEMINI_API_KEY`) as an alias for
// `GOOGLE_GENERATIVE_AI_API_KEY` so the sidecar inherits the same key when
// Google is selected.
const googleKey = (): string | undefined =>
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;

export const resolveModel = (override?: ProviderName): ResolvedModel => {
  const preferred = override ?? (process.env.STRATEGY_AI_PROVIDER as ProviderName | undefined);
  const haveAnthropic = !!anthropicKey();
  const haveGoogle = !!googleKey();

  // Default to Anthropic. Only fall back to Google when explicitly requested,
  // or when Anthropic is absent and Google is present.
  const useGoogle =
    preferred === 'google' || (!preferred && !haveAnthropic && haveGoogle);

  if (useGoogle) {
    const id = process.env.STRATEGY_AI_MODEL ?? 'gemini-2.5-flash';
    const provider = createGoogleGenerativeAI({ apiKey: googleKey() });
    return { model: provider(id), provider: 'google', modelId: id };
  }
  // Default to Sonnet 4.6 here (not Opus 4.7) because @ai-sdk/anthropic@1.x
  // sets a default `temperature` on every request, and Opus 4.7 rejects
  // sampling parameters (400 `temperature is deprecated for this model`).
  // Sonnet 4.6 still accepts temperature, so the SDK works untouched — and
  // it's a strong fit for this builder agent (fast, tool-call heavy).
  // The Python orchestrator in `backend/routers/ai_assistant.py` uses the
  // official anthropic SDK directly and runs on Opus 4.7 without this issue.
  // To opt into Opus 4.7 here, upgrade @ai-sdk/anthropic to v3+ and set
  // STRATEGY_AI_MODEL=claude-opus-4-7.
  const id = process.env.STRATEGY_AI_MODEL ?? 'claude-sonnet-4-6';
  const provider = createAnthropic({ apiKey: anthropicKey() });
  return { model: provider(id), provider: 'anthropic', modelId: id };
};
