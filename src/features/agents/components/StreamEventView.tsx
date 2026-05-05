/**
 * StreamEventView — renders one StreamEvent the way Cursor's chat renders
 * agent steps: thoughts as italic paragraphs, tool calls as collapsible
 * chips with args + output, artifacts as inline previews, final messages
 * as styled blocks.
 *
 * The component is intentionally presentational — timing / streaming logic
 * lives in `runtime/simulatedRun.ts`; it just re-renders whenever the store
 * updates the underlying event.
 */

import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Brain,
  Wrench,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageSquare,
  Image as ImageIcon,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentMonitorStore } from '../store/agentMonitorStore';
import type { StreamEvent } from '../types';

interface StreamEventViewProps {
  event: StreamEvent;
}

export const StreamEventView = memo(({ event }: StreamEventViewProps) => {
  switch (event.kind) {
    case 'status':
      return <StatusLine event={event} />;
    case 'thought':
      return <ThoughtBlock event={event} />;
    case 'tool_call':
      return <ToolCallCard event={event} />;
    case 'tool_result':
      // Rendered inline with its parent tool_call; emit nothing on its own.
      return null;
    case 'message':
      return <MessageCard event={event} />;
    case 'artifact':
      return <ArtifactCard event={event} />;
    case 'error':
      return <ErrorCard event={event} />;
    default:
      return null;
  }
});

StreamEventView.displayName = 'StreamEventView';

// ───────────────────────────────────────────────────── Sub-renderers ──

const StatusLine = ({ event }: { event: StreamEvent }) => (
  <div className="flex items-center gap-2 px-1 py-1 text-[11px] text-muted-foreground">
    <span className="w-1 h-1 rounded-full bg-muted" />
    <span>{event.text}</span>
  </div>
);

const ThoughtBlock = ({ event }: { event: StreamEvent }) => (
  <div className="flex items-start gap-2 py-1">
    <div className="mt-0.5 text-muted-foreground shrink-0">
      <Brain className="w-3.5 h-3.5" />
    </div>
    <div className="text-[12.5px] leading-relaxed text-foreground/70 italic">
      {event.text}
      {event.partial && (
        <span className="inline-block w-1.5 h-3 ml-0.5 align-middle bg-muted animate-pulse" />
      )}
    </div>
  </div>
);

const MessageCard = ({ event }: { event: StreamEvent }) => (
  <div className="mt-2 rounded-lg border border-primary/20 bg-primary/[0.06] p-3">
    <div className="flex items-center gap-1.5 mb-1.5 text-primary/80">
      <MessageSquare className="w-3.5 h-3.5" />
      <span className="text-[10px] uppercase tracking-wider font-medium">
        Conclusion
      </span>
    </div>
    <div className="text-[12.5px] text-foreground leading-relaxed prose-agent">
      <ReactMarkdown>{event.text ?? ''}</ReactMarkdown>
      {event.partial && (
        <span className="inline-block w-1.5 h-3 ml-0.5 align-middle bg-primary/80 animate-pulse" />
      )}
    </div>
  </div>
);

const ErrorCard = ({ event }: { event: StreamEvent }) => (
  <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-2.5 flex items-start gap-2">
    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
    <p className="text-[12px] text-red-500/90 whitespace-pre-wrap">
      {event.text ?? 'Unknown error'}
    </p>
  </div>
);

// ────────────────────────────────────────────── Tool call composite ──

const ToolCallCard = ({ event }: { event: StreamEvent }) => {
  const [open, setOpen] = useState(false);
  // Look up the matching tool_result (if any) so we can render status/output.
  const result = useAgentMonitorStore((s) => {
    const events = s.eventsByRun[event.runId] ?? [];
    return events.find(
      (e) => e.kind === 'tool_result' && e.parentEventId === event.id
    );
  });

  const status = result?.toolStatus ?? event.toolStatus ?? 'pending';
  const StatusIcon =
    status === 'success'
      ? CheckCircle2
      : status === 'error'
        ? XCircle
        : Loader2;
  const statusColor =
    status === 'success'
      ? 'text-emerald-500'
      : status === 'error'
        ? 'text-red-500'
        : 'text-amber-500';
  const statusAnim = status === 'pending' ? 'animate-spin' : '';

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-muted/30 text-left"
      >
        <Wrench className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-[12px] font-mono text-foreground truncate">
          {event.toolName ?? 'tool'}
          <span className="text-muted-foreground">(</span>
          <span className="text-foreground/70">
            {compactArgs(event.toolInput)}
          </span>
          <span className="text-muted-foreground">)</span>
        </span>
        <StatusIcon className={cn('w-3.5 h-3.5 ml-auto shrink-0', statusColor, statusAnim)} />
        {open ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-border/60 bg-muted/50">
          <div className="px-3 py-2 border-b border-border/60">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Input
            </p>
            <pre className="text-[11px] font-mono text-foreground/80 whitespace-pre-wrap break-all">
              {JSON.stringify(event.toolInput ?? {}, null, 2)}
            </pre>
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
              Output
              {status === 'pending' && (
                <span className="text-amber-500 normal-case tracking-normal">
                  · running…
                </span>
              )}
            </p>
            {result?.toolOutput ? (
              <pre className="text-[11.5px] font-mono text-foreground whitespace-pre-wrap leading-relaxed">
                {result.toolOutput}
              </pre>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">
                Awaiting response from {event.toolName}…
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────── Artifact card ──────────

const ArtifactCard = ({ event }: { event: StreamEvent }) => {
  const artifact = useAgentMonitorStore((s) =>
    event.artifactId ? s.artifacts[event.artifactId] : undefined
  );
  if (!artifact) return null;

  if (artifact.kind === 'plot' && artifact.dataUrl) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/60 overflow-hidden">
        <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border/60">
          <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] text-foreground/80 truncate flex-1">
            {artifact.title}
          </span>
          <a
            href={artifact.dataUrl}
            download={`${artifact.title.replace(/[^a-z0-9]+/gi, '_')}.svg`}
            className="p-1 text-muted-foreground hover:text-foreground"
            aria-label="Download plot"
          >
            <Download className="w-3 h-3" />
          </a>
        </div>
        <img
          src={artifact.dataUrl}
          alt={artifact.title}
          className="w-full max-h-60 object-contain bg-[#0a0a0f]"
        />
        {artifact.caption && (
          <p className="px-3 py-1.5 text-[10.5px] text-muted-foreground border-t border-border/60">
            {artifact.caption}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 flex items-start gap-2">
      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] text-foreground truncate">{artifact.title}</p>
        {artifact.text && (
          <pre className="text-[10.5px] font-mono text-foreground/70 whitespace-pre-wrap mt-1 max-h-40 overflow-auto">
            {artifact.text}
          </pre>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────── Utilities ────

function compactArgs(args?: Record<string, unknown>): string {
  if (!args) return '';
  const parts = Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      return `${k}=${s.length > 32 ? `${s.slice(0, 29)}…` : s}`;
    });
  return parts.join(', ');
}
