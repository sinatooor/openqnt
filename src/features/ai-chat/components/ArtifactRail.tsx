/**
 * ArtifactRail — right-edge collapsible dock for pinned artifacts.
 *
 * z-[440] sits below the AI panel (z-[500]) and above the FAB (z-[450]).
 * When the panel is open, the rail tucks behind it.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, X, ChevronRight, ChevronLeft, Trash2 } from 'lucide-react';
import { useArtifactStore, type Artifact } from '../state/artifactStore';
import { useAiChatStore } from '../state/aiChatStore';
import { useNavigate } from 'react-router-dom';
import { cardRegistry } from '../cards';
import { Button } from '@/components/ui/button';

export function ArtifactRail() {
  const open = useArtifactStore((s) => s.open);
  const setOpen = useArtifactStore((s) => s.setOpen);
  const artifacts = useArtifactStore((s) => s.artifacts);

  // Compact pin trigger — always visible at the right edge when artifacts exist
  if (artifacts.length === 0) return null;

  return (
    <>
      {!open && (
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          onClick={() => setOpen(true)}
          className="fixed right-2 top-1/2 -translate-y-1/2 z-[440] flex flex-col items-center gap-1 px-2 py-3 rounded-l-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition-colors"
          title="Pinned artifacts"
        >
          <Pin className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium tabular-nums">{artifacts.length}</span>
          <ChevronLeft className="w-3 h-3 opacity-60" />
        </motion.button>
      )}

      <AnimatePresence>
        {open && <RailPanel onClose={() => setOpen(false)} artifacts={artifacts} />}
      </AnimatePresence>
    </>
  );
}

function RailPanel({
  onClose,
  artifacts,
}: {
  onClose: () => void;
  artifacts: Artifact[];
}) {
  const unpin = useArtifactStore((s) => s.unpin);
  const clear = useArtifactStore((s) => s.clear);

  return (
    <motion.aside
      initial={{ x: 360, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 360, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed right-0 top-0 bottom-0 z-[440] w-[340px] glass border-l border-amber-500/20 shadow-trading-lg flex flex-col"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06]">
        <Pin className="w-3.5 h-3.5 text-amber-300" />
        <h3 className="text-[12.5px] font-semibold text-foreground">Pinned</h3>
        <span className="text-[10.5px] text-white/40">{artifacts.length}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => clear()}
            title="Clear all"
            className="w-7 h-7 rounded-md hover:bg-white/[0.06] text-white/50 hover:text-red-300 flex items-center justify-center"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="w-7 h-7 rounded-md hover:bg-white/[0.06] text-white/60 hover:text-white flex items-center justify-center"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {artifacts.map((a) => (
          <ArtifactRow key={a.id} artifact={a} onUnpin={() => unpin(a.id)} />
        ))}
      </div>
    </motion.aside>
  );
}

function ArtifactRow({ artifact, onUnpin }: { artifact: Artifact; onUnpin: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const setActive = useAiChatStore((s) => s.setActiveSession);
  const navigate = useNavigate();
  const Cmp = cardRegistry[artifact.cardType];

  const reopen = () => {
    if (artifact.sourceSessionId) {
      setActive(artifact.sourceSessionId);
      navigate(`/ai-chat?session=${artifact.sourceSessionId}`);
    }
  };

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-wider text-amber-300/80 truncate">
            {artifact.cardType.replace(/_/g, ' ')}
          </span>
          {artifact.title && (
            <span className="text-[11px] text-white/70 truncate">— {artifact.title}</span>
          )}
        </div>
        <button
          onClick={onUnpin}
          title="Unpin"
          className="text-white/30 hover:text-red-300 ml-1"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {expanded ? (
        <div className="px-2 pb-2">
          {Cmp ? <Cmp payload={artifact.payload} /> : (
            <pre className="text-[10px] text-white/50 overflow-auto max-h-40">
              {JSON.stringify(artifact.payload, null, 2)}
            </pre>
          )}
        </div>
      ) : (
        <div className="px-2.5 pb-2 text-[10.5px] text-white/40 line-clamp-2">
          {previewText(artifact)}
        </div>
      )}
      <div className="flex items-center gap-1 px-2 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="h-6 px-2 text-[10.5px] text-white/60 hover:text-white"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </Button>
        {artifact.sourceSessionId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reopen}
            className="h-6 px-2 text-[10.5px] text-white/60 hover:text-white"
          >
            Open chat
          </Button>
        )}
      </div>
    </div>
  );
}

function previewText(a: Artifact): string {
  switch (a.cardType) {
    case 'code_block':
      return `${a.payload?.language?.toUpperCase() ?? 'code'} · ${a.payload?.code?.length ?? 0} chars`;
    case 'plot':
      return a.payload?.title ?? 'Chart';
    case 'table':
      return a.payload?.caption ?? `${a.payload?.rows?.length ?? 0} rows`;
    case 'strategy_nodes':
      return `${a.payload?.nodes?.length ?? 0} nodes`;
    case 'boss_subtree':
      return `Boss run · ${(a.payload?.runId ?? '').slice(0, 8)}`;
    default:
      return JSON.stringify(a.payload).slice(0, 80) + '…';
  }
}
