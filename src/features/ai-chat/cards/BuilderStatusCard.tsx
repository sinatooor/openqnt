/**
 * BuilderStatusCard — live status panel for the n8n-inspired Builder agent.
 *
 * Fed by `useChatTransport.bucketBuilderEvent` which merges `builder_event`
 * sub-kinds (start / validate / verify / loop_guard / submit / complete) into
 * one stable card payload. Renders the latest snapshot of each: provider chip
 * up top, then a validate pill, a verify pill, an optional loop-guard warning,
 * and a final summary line when the run completes.
 */

import { memo } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, ShieldCheck, Loader2, AlertOctagon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BuilderStatusPayload {
  start?: { provider?: string; modelId?: string };
  latestValidate?: {
    valid?: boolean;
    errors?: string[];
    warnings?: string[];
    failureSignature?: string;
  };
  latestVerify?: { compiles?: boolean; errors?: string[]; warnings?: string[] };
  loopGuard?: { signature?: string; count?: number };
  submit?: { summary?: string };
  complete?: { summary?: string; validateCount?: number; blockedByLoopGuard?: boolean };
  latestMutate?: { op?: string; detail?: Record<string, unknown> };
}

export const BuilderStatusCard = memo(({ payload }: { payload: BuilderStatusPayload }) => {
  const { start, latestValidate, latestVerify, loopGuard, submit, complete } = payload;
  const inProgress = !complete && !submit;

  return (
    <div
      className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 text-xs space-y-2"
      data-testid="builder-status-card"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-purple-400" />
        <span className="font-medium text-purple-200">Builder agent</span>
        {start ? (
          <Badge variant="outline" className="h-4 px-1 text-[10px] uppercase tracking-wide text-purple-300 border-purple-500/40">
            {start.provider}/{start.modelId}
          </Badge>
        ) : null}
        {inProgress ? (
          <span className="inline-flex items-center gap-1 text-purple-300/80">
            <Loader2 className="h-3 w-3 animate-spin" />
            running
          </span>
        ) : null}
      </div>

      {latestValidate ? (
        <Pill
          ok={!!latestValidate.valid}
          label={latestValidate.valid ? 'Validation passed' : `Validation: ${(latestValidate.errors ?? []).length} issue(s)`}
          detail={
            latestValidate.valid
              ? latestValidate.warnings?.[0]
              : latestValidate.errors?.[0] ?? latestValidate.failureSignature
          }
        />
      ) : null}

      {latestVerify ? (
        <Pill
          ok={!!latestVerify.compiles}
          icon={latestVerify.compiles ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          label={latestVerify.compiles ? 'Compiles' : 'Compile failed'}
          detail={latestVerify.errors?.[0]}
        />
      ) : null}

      {loopGuard ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-amber-300">
          <AlertOctagon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div className="leading-snug">
            <div className="font-medium">Loop guard triggered</div>
            <div className="text-amber-300/80">
              Same failure seen {loopGuard.count ?? 2}× ({loopGuard.signature?.slice(0, 12) ?? 'unknown'}…). The agent will ask you next.
            </div>
          </div>
        </div>
      ) : null}

      {complete || submit ? (
        <div className="flex items-start gap-2 pt-1 text-foreground/90">
          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" />
          <div>
            {complete?.summary ?? submit?.summary}
            {complete?.validateCount != null ? (
              <span className="text-muted-foreground/80 ml-1.5">
                ({complete.validateCount} validate{complete.validateCount === 1 ? '' : 's'}
                {complete.blockedByLoopGuard ? ', loop-guarded' : ''})
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
});

BuilderStatusCard.displayName = 'BuilderStatusCard';

interface PillProps {
  ok: boolean;
  label: string;
  detail?: string;
  icon?: React.ReactNode;
}

const Pill = ({ ok, label, detail, icon }: PillProps) => (
  <div
    className={cn(
      'flex items-start gap-2 rounded-md border px-2 py-1.5',
      ok
        ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200'
        : 'border-rose-500/30 bg-rose-500/5 text-rose-200',
    )}
  >
    <span className="mt-0.5 shrink-0">
      {icon ?? (ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />)}
    </span>
    <div className="leading-snug">
      <div>{label}</div>
      {detail ? <div className="opacity-70 text-[11px]">{detail}</div> : null}
    </div>
  </div>
);
