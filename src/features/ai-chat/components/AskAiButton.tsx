/**
 * AskAi — drop-in per-element AI handle.
 *
 * Renders a small ✨ button. Click → opens the panel pre-loaded with the
 * target as context plus a contextual starter prompt.
 *
 * Examples:
 *   <AskAi target={{ type: 'symbol', id: 'TSLA' }} />
 *   <AskAi target={{ type: 'symbol', id: 'AAPL', label: 'Apple' }} prompt="Why did this move today?" />
 *   <AskAi target={{ type: 'strategy', id: 'sma-cross' }} prompt="Analyze this strategy">
 *     Analyze
 *   </AskAi>
 */

import { Sparkles } from 'lucide-react';
import { usePanelStore } from '../state/panelStore';
import { usePageContextStore } from '../state/pageContextStore';

export interface AskAiTarget {
  type: 'symbol' | 'strategy' | 'execution' | 'portfolio';
  id: string;
  label?: string;
}

interface Props {
  target: AskAiTarget;
  prompt?: string;
  className?: string;
  size?: 'xs' | 'sm';
  variant?: 'icon' | 'pill';
  children?: React.ReactNode;
  /** Stop click propagation so it doesn't trigger row-click handlers. */
  stopPropagation?: boolean;
}

const DEFAULT_PROMPTS: Record<AskAiTarget['type'], (label: string) => string> = {
  symbol: (l) => `Tell me about ${l}: recent price action, news, fundamentals.`,
  strategy: (l) => `Analyze the "${l}" strategy: edge, risks, what to improve.`,
  execution: (l) => `Review this execution: ${l}. Was the entry/exit reasonable?`,
  portfolio: (l) => `Review my portfolio "${l}": exposure, concentration, risks.`,
};

export function AskAi({
  target,
  prompt,
  className,
  size = 'xs',
  variant = 'icon',
  children,
  stopPropagation = true,
}: Props) {
  const openWithMessage = usePanelStore((s) => s.openWithMessage);
  const setPageContext = usePageContextStore((s) => s.setContext);
  const currentContext = usePageContextStore((s) => s.context);

  const handle = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    // Override page context's primaryEntity so the AI sees this specific target
    // (without losing the current page's other grounding).
    setPageContext({
      page: currentContext?.page ?? 'unknown',
      primaryEntity: target,
      visibleData: currentContext?.visibleData,
    });
    const label = target.label ?? target.id;
    const finalPrompt = prompt ?? DEFAULT_PROMPTS[target.type](label);
    openWithMessage(finalPrompt);
  };

  if (variant === 'pill' || children) {
    return (
      <button
        onClick={handle}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-[10.5px] text-purple-300 transition-colors ${className ?? ''}`}
        title={`Ask AI about ${target.label ?? target.id}`}
      >
        <Sparkles className="w-3 h-3" />
        {children ?? <span>Ask AI</span>}
      </button>
    );
  }

  const px = size === 'xs' ? 'p-1' : 'p-1.5';
  const ic = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <button
      onClick={handle}
      className={`${px} rounded-md bg-white/[0.03] hover:bg-purple-500/15 text-white/40 hover:text-purple-300 transition-colors ${className ?? ''}`}
      title={`Ask AI about ${target.label ?? target.id}`}
    >
      <Sparkles className={ic} />
    </button>
  );
}
