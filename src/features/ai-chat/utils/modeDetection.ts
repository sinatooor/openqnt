/**
 * Auto-mode detection for the ⌘J command palette.
 *
 * Cheap keyword heuristic — picks a likely mode based on what the user typed.
 * Returns null when the input doesn't strongly suggest any specific mode
 * (defaults to 'ask').
 */

import type { ChatMode } from '../types';

const KEYWORDS: Array<{ mode: ChatMode; words: RegExp }> = [
  {
    mode: 'strategy',
    words:
      /\b(build|generate|create|design)\s+(a\s+)?(strategy|node|flow|setup|crossover|signal|indicator)\b|\b(rsi|sma|ema|macd|bollinger|stochastic)\s+(buy|sell|crossover|strategy)\b/i,
  },
  {
    mode: 'code',
    words:
      /\b(pine\s*script|pinescript|python|mql5|mq5|nautilus|ea\b|expert\s+advisor)\b|\b(generate|write|export)\s+(code|script)\b/i,
  },
  {
    mode: 'boss',
    words:
      /\b(research|investigate|orchestrate|deep\s+dive|multi[- ]?agent|fan[- ]?out|delegate)\b/i,
  },
];

export function detectMode(input: string): ChatMode {
  const trimmed = input.trim();
  if (!trimmed) return 'ask';
  for (const { mode, words } of KEYWORDS) {
    if (words.test(trimmed)) return mode;
  }
  return 'ask';
}

// Quick predicate: does this look like a ticker-only entry?
export function looksLikeTicker(input: string): boolean {
  return /^[A-Z]{1,5}(\.[A-Z])?$/.test(input.trim());
}
