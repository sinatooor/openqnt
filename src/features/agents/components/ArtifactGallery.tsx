/**
 * ArtifactGallery — grid of everything the selected agent has produced:
 * plots, CSV tables, code snippets, files. Clickable to expand.
 */

import { memo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Image as ImageIcon,
  FileText,
  Download,
  X,
} from 'lucide-react';
import {
  useAgentMonitorStore,
  selectAgentArtifacts,
} from '../store/agentMonitorStore';
import type { Artifact } from '../types';

interface ArtifactGalleryProps {
  agentId: string;
}

export const ArtifactGallery = memo(({ agentId }: ArtifactGalleryProps) => {
  const artifacts = useAgentMonitorStore(useShallow(selectAgentArtifacts(agentId)));
  const [focused, setFocused] = useState<Artifact | null>(null);

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-[12px] gap-2">
        <ImageIcon className="w-6 h-6 opacity-30" />
        <p>No artifacts yet. Plots and files the agent saves will show up here.</p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="grid grid-cols-2 gap-3">
        {artifacts.map((a) => (
          <button
            key={a.id}
            onClick={() => setFocused(a)}
            className="group rounded-lg border border-border/60 bg-muted/60 overflow-hidden text-left hover:border-border transition-colors"
          >
            <div className="h-32 flex items-center justify-center bg-[#0a0a0f] overflow-hidden">
              {a.kind === 'plot' && a.dataUrl ? (
                <img src={a.dataUrl} alt={a.title} className="w-full h-full object-contain" />
              ) : (
                <FileText className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="px-2.5 py-1.5 border-t border-border/60">
              <p className="text-[11px] text-foreground truncate">{a.title}</p>
              <p className="text-[9.5px] text-muted-foreground mt-0.5">
                {new Date(a.createdAt).toLocaleString()}
              </p>
            </div>
          </button>
        ))}
      </div>

      {focused && (
        <div
          className="fixed inset-0 z-50 bg-foreground/10 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setFocused(null)}
        >
          <div
            className="max-w-4xl w-full max-h-[85vh] rounded-xl bg-[#0a0a0f] border border-border/60 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
              <div>
                <p className="text-[13px] text-foreground">{focused.title}</p>
                {focused.caption && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{focused.caption}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {focused.dataUrl && (
                  <a
                    href={focused.dataUrl}
                    download={`${focused.title.replace(/[^a-z0-9]+/gi, '_')}.svg`}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-md border border-border/60"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-md border border-border/60"
                  onClick={() => setFocused(null)}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {focused.kind === 'plot' && focused.dataUrl ? (
                <img
                  src={focused.dataUrl}
                  alt={focused.title}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <pre className="text-[12px] font-mono text-foreground whitespace-pre-wrap w-full">
                  {focused.text ?? '(empty)'}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ArtifactGallery.displayName = 'ArtifactGallery';
