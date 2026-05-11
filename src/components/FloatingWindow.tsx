/**
 * FloatingWindow — non-modal, draggable, resizable, minimisable window that
 * sits above the app and persists across route changes.
 *
 * Driven by `useFloatingWindowsStore`. Don't render `<FloatingWindow>`
 * directly from feature code — call `useFloatingWindow(id).open(...)` and
 * the global `<FloatingWindowsRoot/>` (mounted in App.tsx) handles the rest.
 *
 * Visual aesthetic mirrors the shadcn Dialog (rounded card, border,
 * shadow), but with non-modal interaction so the user can keep working on
 * the page underneath. Good for "pop out this chart so I can keep it
 * visible while I switch tabs."
 */

import { useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Draggable, { type DraggableData, type DraggableEvent } from 'react-draggable';
import { Minus, Square, X, GripHorizontal } from 'lucide-react';
import {
  useFloatingWindowsStore,
  type FloatingWindowEntry,
} from '@/stores/floatingWindowsStore';
import { cn } from '@/lib/utils';

const MIN_WIDTH = 280;
const MIN_HEIGHT = 180;
const HEADER_HEIGHT = 36; // matches px-3 py-2 + 12px content

function FloatingWindow({ entry }: { entry: FloatingWindowEntry }) {
  const close = useFloatingWindowsStore((s) => s.close);
  const toggleMinimize = useFloatingWindowsStore((s) => s.toggleMinimize);
  const bringToFront = useFloatingWindowsStore((s) => s.bringToFront);
  const setPosition = useFloatingWindowsStore((s) => s.setPosition);
  const setSize = useFloatingWindowsStore((s) => s.setSize);

  const nodeRef = useRef<HTMLDivElement>(null);

  const handleDragStop = (_e: DraggableEvent, data: DraggableData) => {
    setPosition(entry.id, { x: data.x, y: data.y });
  };

  const startResize = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!nodeRef.current) return;
    const rect = nodeRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = rect.width;
    const startH = rect.height;
    const move = (ev: MouseEvent) => {
      setSize(entry.id, {
        width: Math.max(MIN_WIDTH, startW + (ev.clientX - startX)),
        height: Math.max(MIN_HEIGHT, startH + (ev.clientY - startY)),
      });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <Draggable
      handle=".floating-window-drag"
      position={entry.position}
      onStop={handleDragStop}
      nodeRef={nodeRef}
      bounds="parent"
    >
      <div
        ref={nodeRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: entry.size.width,
          height: entry.minimized ? HEADER_HEIGHT : entry.size.height,
          zIndex: entry.zIndex,
        }}
        className={cn(
          'bg-card border border-border/60 rounded-lg shadow-2xl shadow-black/40',
          'flex flex-col overflow-hidden',
        )}
        onMouseDown={() => bringToFront(entry.id)}
      >
        {/* Header (drag handle) */}
        <div
          className={cn(
            'floating-window-drag cursor-move shrink-0',
            'flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/30 select-none',
          )}
        >
          <GripHorizontal className="w-3 h-3 text-muted-foreground shrink-0" />
          <span
            className="text-xs font-medium text-foreground flex-1 truncate"
            title={entry.title}
          >
            {entry.title}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMinimize(entry.id);
            }}
            className="w-5 h-5 rounded hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title={entry.minimized ? 'Restore' : 'Minimise'}
          >
            {entry.minimized ? <Square className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              close(entry.id);
            }}
            className="w-5 h-5 rounded hover:bg-red-500/20 hover:text-red-300 flex items-center justify-center text-muted-foreground transition-colors"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Body */}
        {!entry.minimized && (
          <>
            <div className="flex-1 overflow-auto relative">{entry.content()}</div>
            {/* Resize handle — bottom-right corner */}
            <div
              role="separator"
              aria-orientation="vertical"
              onMouseDown={startResize}
              className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize"
              style={{
                background:
                  'linear-gradient(135deg, transparent 50%, hsl(var(--muted-foreground) / 0.4) 50%)',
              }}
            />
          </>
        )}
      </div>
    </Draggable>
  );
}

/**
 * Mount once at the app root (App.tsx GlobalOverlays). Portals every open
 * floating window into document.body so they escape any parent's overflow
 * or stacking context.
 */
export function FloatingWindowsRoot() {
  const windows = useFloatingWindowsStore((s) => s.windows);
  if (typeof document === 'undefined') return null;
  const list = Object.values(windows);
  if (list.length === 0) return null;
  return createPortal(
    <>
      {list.map((entry) => (
        <FloatingWindow key={entry.id} entry={entry} />
      ))}
    </>,
    document.body,
  );
}

/**
 * Inline icon button for "Pop out" actions on cards/panels. Caller is
 * responsible for memoising the content function if it captures props
 * that should stay fresh (or use a render fn that reads from a store).
 */
export interface PopOutButtonProps {
  id: string;
  title: string;
  content: () => React.ReactNode;
  defaultSize?: { width: number; height: number };
  className?: string;
  label?: string;
}

export function PopOutButton({
  id,
  title,
  content,
  defaultSize,
  className,
  label,
}: PopOutButtonProps) {
  const open = useFloatingWindowsStore((s) => s.open);
  const isOpen = useFloatingWindowsStore((s) => id in s.windows);
  return (
    <button
      type="button"
      onClick={() => open({ id, title, content, defaultSize })}
      className={cn(
        'inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border/60 bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground',
        className,
      )}
      title={isOpen ? 'Already open — bring to front' : 'Pop out to a floating window'}
    >
      <Square className="w-3 h-3" />
      {label ?? (isOpen ? 'Focus' : 'Pop out')}
    </button>
  );
}
