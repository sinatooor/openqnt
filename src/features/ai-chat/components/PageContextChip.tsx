/**
 * PageContextChip — shows what page context the AI sees, in the panel header.
 *
 * Lets the user know AI is grounded. Click → expand to show snapshot details.
 * Click X → clear context for a vanilla session.
 */

import { useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { usePageContextStore } from '../state/pageContextStore';

export function PageContextChip() {
  const ctx = usePageContextStore((s) => s.context);
  const clear = usePageContextStore((s) => s.clear);
  const [expanded, setExpanded] = useState(false);

  if (!ctx) return null;

  const label = ctx.primaryEntity?.label ?? ctx.primaryEntity?.id ?? '';
  const pageLabel = ctx.page.replace(/^terminal\//, '').replace(/-/g, ' ');

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10.5px] text-white/60 hover:bg-white/[0.06] transition-colors">
      <MapPin className="w-3 h-3 text-purple-400/80" />
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 truncate max-w-[160px]"
        title="What the AI sees on this page"
      >
        <span className="capitalize">{pageLabel}</span>
        {label && <span className="text-white/40">·</span>}
        {label && <span className="text-white/80 truncate">{label}</span>}
      </button>
      <button
        onClick={clear}
        className="text-white/30 hover:text-white/70 ml-0.5"
        title="Clear page context"
      >
        <X className="w-3 h-3" />
      </button>
      {expanded && (
        <div className="absolute mt-8 right-3 z-[510] w-72 p-2 rounded-md bg-[#15151b] border border-white/10 shadow-xl text-[10.5px]">
          <div className="text-white/40 mb-1">Page context attached to this session:</div>
          <pre className="text-white/70 whitespace-pre-wrap break-all max-h-40 overflow-auto">
            {JSON.stringify(ctx, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
