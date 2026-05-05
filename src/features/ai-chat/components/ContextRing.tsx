/**
 * ContextRing — circular SVG indicator showing how full the conversation
 * context window is, like Claude's chat UI.
 */

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MAX_CONTEXT_TOKENS, getContextStatus } from '../state/contextWindow';

interface Props {
  tokens: number;
  size?: number;
  className?: string;
}

const COLORS = {
  green: '#34d399',
  amber: '#fbbf24',
  red: '#f87171',
};

export function ContextRing({ tokens, size = 22, className }: Props) {
  const ratio = Math.min(1, tokens / MAX_CONTEXT_TOKENS);
  const status = getContextStatus(tokens);
  const stroke = COLORS[status];

  const radius = size / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * ratio;

  const formatted = `${tokens.toLocaleString()} / ${MAX_CONTEXT_TOKENS.toLocaleString()} tokens (${(ratio * 100).toFixed(1)}%)`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <svg
          width={size}
          height={size}
          className={`transform -rotate-90 ${className ?? ''}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={2}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 200ms ease, stroke 200ms ease' }}
          />
        </svg>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[11px]">
        {formatted}
      </TooltipContent>
    </Tooltip>
  );
}
