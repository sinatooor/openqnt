/**
 * ToolUseCard — pairs a tool_call with its tool_result + any artifacts
 * produced during the call. Collapsible. Shows status, duration, input
 * args, output preview, and inline plot/table previews.
 *
 * Used by both StreamEventView (live) and ObservationView (post-run).
 */

import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Wrench,
  Image as ImageIcon,
  Code,
  Table as TableIcon,
  FileText,
  Download,
} from 'lucide-react';
import type { Artifact, StreamEvent } from '../types';

interface ToolUseCardProps {
  call: StreamEvent;
  result: StreamEvent | null;
  artifacts: Artifact[];
  durationMs: number | null;
  defaultOpen?: boolean;
}

export function ToolUseCard({ call, result, artifacts, durationMs, defaultOpen }: ToolUseCardProps) {
  const [open, setOpen] = useState(!!defaultOpen);
  const status = result?.toolStatus ?? (result == null ? 'pending' : 'success');
  const statusIcon =
    status === 'success' ? (
      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
    ) : status === 'error' ? (
      <XCircle className="h-3 w-3 text-red-400" />
    ) : (
      <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
    );

  const borderColor =
    status === 'success'
      ? 'border-emerald-500/20'
      : status === 'error'
      ? 'border-red-500/30'
      : 'border-amber-500/30';

  const toolName = call.toolName ?? '(unknown tool)';
  const args = call.toolInput ?? {};
  const output = result?.toolOutput ?? '';

  return (
    <div className={`rounded-md border ${borderColor} bg-white/[0.02] overflow-hidden`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-white/[0.03]"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-white/40" />
        ) : (
          <ChevronRight className="h-3 w-3 text-white/40" />
        )}
        <Wrench className="h-3 w-3 text-white/50" />
        <span className="font-mono text-[11px] text-white/85">{toolName}</span>
        <span className="text-[10px] text-white/40 truncate min-w-0 flex-1">
          {oneLineArgs(args)}
        </span>
        {durationMs != null && (
          <span className="font-mono text-[9px] text-white/40">
            {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}
          </span>
        )}
        {artifacts.length > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-sm bg-white/5 px-1 text-[9px] text-white/60">
            <ImageIcon className="h-2.5 w-2.5" />
            {artifacts.length}
          </span>
        )}
        {statusIcon}
      </button>

      {open && (
        <div className="border-t border-white/5 bg-black/20 p-2 space-y-2">
          {Object.keys(args).length > 0 && (
            <Section label="Input">
              <pre className="m-0 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-white/75">
                {safeStringify(args)}
              </pre>
            </Section>
          )}

          {output && (
            <Section label="Output">
              <pre className="m-0 max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-white/75">
                {output}
              </pre>
            </Section>
          )}

          {artifacts.length > 0 && (
            <Section label="Artifacts">
              <div className="space-y-2">
                {artifacts.map((a) => (
                  <ArtifactPreview key={a.id} artifact={a} />
                ))}
              </div>
            </Section>
          )}

          {status === 'error' && output && (
            <p className="text-[10px] italic text-red-300/80">Tool returned an error — see Output above.</p>
          )}
          {status === 'pending' && (
            <p className="text-[10px] italic text-amber-300/80">Awaiting result…</p>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-[9px] uppercase tracking-wide text-white/35">{label}</div>
      {children}
    </div>
  );
}

function ArtifactPreview({ artifact }: { artifact: Artifact }) {
  const Icon = artifact.kind === 'plot'
    ? ImageIcon
    : artifact.kind === 'code'
    ? Code
    : artifact.kind === 'table'
    ? TableIcon
    : FileText;
  return (
    <div className="rounded-md border border-white/5 bg-black/30 p-2">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-white/60" />
        <span className="text-[10px] font-medium text-white/80">{artifact.title}</span>
        <span className="ml-auto text-[9px] uppercase text-white/40">{artifact.kind}</span>
        {artifact.dataUrl && (
          <a
            href={artifact.dataUrl}
            download={`${artifact.title}.${guessExt(artifact)}`}
            className="text-white/50 hover:text-white"
            title="Download"
          >
            <Download className="h-3 w-3" />
          </a>
        )}
      </div>
      {artifact.kind === 'plot' && artifact.dataUrl && (
        <img
          src={artifact.dataUrl}
          alt={artifact.title}
          className="max-h-72 w-full rounded-sm border border-white/5 object-contain bg-white/5"
        />
      )}
      {artifact.kind === 'table' && artifact.text && (
        <pre className="m-0 max-h-60 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-white/75">
          {artifact.text}
        </pre>
      )}
      {artifact.kind === 'code' && artifact.text && (
        <pre className="m-0 max-h-60 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-emerald-200/90">
          {artifact.text}
        </pre>
      )}
      {artifact.kind === 'file' && (
        <p className="text-[10px] italic text-white/50">{artifact.caption ?? 'File saved.'}</p>
      )}
      {artifact.caption && artifact.kind !== 'file' && (
        <p className="mt-1 text-[10px] italic text-white/50">{artifact.caption}</p>
      )}
    </div>
  );
}

function guessExt(a: Artifact): string {
  if (a.kind === 'plot') {
    if (a.dataUrl?.startsWith('data:image/svg')) return 'svg';
    if (a.dataUrl?.startsWith('data:image/jpeg')) return 'jpg';
    return 'png';
  }
  if (a.kind === 'code') return 'txt';
  if (a.kind === 'table') return 'csv';
  return 'bin';
}

function oneLineArgs(args: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    if (parts.length >= 4) break;
    let s = '';
    if (v == null) s = 'null';
    else if (typeof v === 'string') s = v.length > 24 ? `${v.slice(0, 24)}…` : v;
    else if (typeof v === 'number' || typeof v === 'boolean') s = String(v);
    else s = '…';
    parts.push(`${k}=${s}`);
  }
  return parts.join(' · ');
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export default ToolUseCard;
