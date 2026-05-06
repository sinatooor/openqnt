/**
 * ExplainTip — wraps any text with a tooltip that pulls from the glossary.
 *
 * Usage: <ExplainTip term="var_95">VaR (95%)</ExplainTip>
 *
 * Renders the wrapped text with a dotted underline so users can see it's
 * explainable. Hover/focus opens a tooltip with the glossary's `short` line.
 */
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { explain } from './glossary';

interface Props {
  term: string;
  children: React.ReactNode;
  /** Set to false to skip the dotted underline. */
  underline?: boolean;
}

export function ExplainTip({ term, children, underline = true }: Props) {
  const entry = explain(term);
  if (!entry) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`cursor-help ${
              underline ? 'underline decoration-dotted decoration-muted-foreground/40 underline-offset-2' : ''
            }`}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-[11px]">
          <div className="font-medium text-foreground mb-0.5">{entry.term}</div>
          <div className="text-muted-foreground">{entry.short}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ExplainTip;
