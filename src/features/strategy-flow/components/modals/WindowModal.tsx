/**
 * WindowModal - A resizable and draggable window-like modal component
 * Features: Drag by title bar, resize from edges/corners, minimize to taskbar
 * Uses React Portal to render at document body level for proper z-index stacking
 */

import { memo, useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Minus, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WindowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
  initialPosition?: { x: number; y: number };
}

export const WindowModal = memo(({
  open,
  onOpenChange,
  title,
  icon,
  children,
  defaultWidth = 600,
  defaultHeight = 500,
  minWidth = 300,
  minHeight = 200,
  maxWidth,
  maxHeight,
  className,
  initialPosition,
}: WindowModalProps) => {
  const windowRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() => {
    if (initialPosition) return initialPosition;
    // Center the window
    const x = typeof window !== 'undefined' ? (window.innerWidth - defaultWidth) / 2 : 100;
    const y = typeof window !== 'undefined' ? (window.innerHeight - defaultHeight) / 2 : 100;
    return { x: Math.max(0, x), y: Math.max(0, y) };
  });
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [preMaximizeState, setPreMaximizeState] = useState({ position: { x: 0, y: 0 }, size: { width: 0, height: 0 } });

  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });

  // Reset position when reopening
  useEffect(() => {
    if (open) {
      const x = typeof window !== 'undefined' ? (window.innerWidth - defaultWidth) / 2 : 100;
      const y = typeof window !== 'undefined' ? (window.innerHeight - defaultHeight) / 2 : 100;
      setPosition({ x: Math.max(0, x), y: Math.max(50, y) });
      setSize({ width: defaultWidth, height: defaultHeight });
      setIsMaximized(false);
    }
  }, [open, defaultWidth, defaultHeight]);

  // Handle dragging
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position, isMaximized]);

  const handleDrag = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const newX = Math.max(0, Math.min(e.clientX - dragStart.current.x, window.innerWidth - 100));
    const newY = Math.max(0, Math.min(e.clientY - dragStart.current.y, window.innerHeight - 50));
    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle resizing
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y,
    };
  }, [size, position, isMaximized]);

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeDirection) return;

    const deltaX = e.clientX - resizeStart.current.x;
    const deltaY = e.clientY - resizeStart.current.y;

    let newWidth = resizeStart.current.width;
    let newHeight = resizeStart.current.height;
    let newX = resizeStart.current.posX;
    let newY = resizeStart.current.posY;

    if (resizeDirection.includes('e')) {
      newWidth = Math.max(minWidth, resizeStart.current.width + deltaX);
      if (maxWidth) newWidth = Math.min(maxWidth, newWidth);
    }
    if (resizeDirection.includes('w')) {
      const widthDelta = resizeStart.current.width - deltaX;
      if (widthDelta >= minWidth && (!maxWidth || widthDelta <= maxWidth)) {
        newWidth = widthDelta;
        newX = resizeStart.current.posX + deltaX;
      }
    }
    if (resizeDirection.includes('s')) {
      newHeight = Math.max(minHeight, resizeStart.current.height + deltaY);
      if (maxHeight) newHeight = Math.min(maxHeight, newHeight);
    }
    if (resizeDirection.includes('n')) {
      const heightDelta = resizeStart.current.height - deltaY;
      if (heightDelta >= minHeight && (!maxHeight || heightDelta <= maxHeight)) {
        newHeight = heightDelta;
        newY = resizeStart.current.posY + deltaY;
      }
    }

    setSize({ width: newWidth, height: newHeight });
    setPosition({ x: newX, y: newY });
  }, [isResizing, resizeDirection, minWidth, minHeight, maxWidth, maxHeight]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeDirection(null);
  }, []);

  // Mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDrag);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDrag, handleDragEnd]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResize);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResize, handleResizeEnd]);

  // Handle maximize/restore
  const handleMaximize = useCallback(() => {
    if (isMaximized) {
      setPosition(preMaximizeState.position);
      setSize(preMaximizeState.size);
      setIsMaximized(false);
    } else {
      setPreMaximizeState({ position, size });
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight });
      setIsMaximized(true);
    }
  }, [isMaximized, position, size, preMaximizeState]);

  // Handle close
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // ESC key to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  if (!open) return null;

  const resizeHandleClass = "absolute z-50";
  const resizeHandleSize = "8px";

  const modalContent = (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Backdrop - optional, click to close */}
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={handleClose}
      />

      {/* Window */}
      <div
        ref={windowRef}
        className={cn(
          "absolute pointer-events-auto bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl flex flex-col overflow-hidden",
          isDragging && "cursor-grabbing select-none",
          isResizing && "select-none",
          className
        )}
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          zIndex: 10000,
          transition: isDragging || isResizing ? 'none' : 'box-shadow 0.2s',
        }}
      >
        {/* Title Bar - Draggable */}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-3 bg-secondary/50 border-b border-border/50 cursor-grab select-none",
            isDragging && "cursor-grabbing"
          )}
          onMouseDown={handleDragStart}
          onDoubleClick={handleMaximize}
        >
          <div className="flex items-center gap-2">
            {icon && <span className="text-primary">{icon}</span>}
            <span className="font-semibold text-sm text-foreground">{title}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); handleMaximize(); }}
              className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleClose(); }}
              className="p-1.5 rounded-md hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>

        {/* Resize Handles */}
        {!isMaximized && (
          <>
            {/* Edges */}
            <div
              className={cn(resizeHandleClass, "top-0 left-2 right-2 cursor-n-resize")}
              style={{ height: resizeHandleSize }}
              onMouseDown={(e) => handleResizeStart(e, 'n')}
            />
            <div
              className={cn(resizeHandleClass, "bottom-0 left-2 right-2 cursor-s-resize")}
              style={{ height: resizeHandleSize }}
              onMouseDown={(e) => handleResizeStart(e, 's')}
            />
            <div
              className={cn(resizeHandleClass, "left-0 top-2 bottom-2 cursor-w-resize")}
              style={{ width: resizeHandleSize }}
              onMouseDown={(e) => handleResizeStart(e, 'w')}
            />
            <div
              className={cn(resizeHandleClass, "right-0 top-2 bottom-2 cursor-e-resize")}
              style={{ width: resizeHandleSize }}
              onMouseDown={(e) => handleResizeStart(e, 'e')}
            />
            {/* Corners */}
            <div
              className={cn(resizeHandleClass, "top-0 left-0 cursor-nw-resize")}
              style={{ width: resizeHandleSize, height: resizeHandleSize }}
              onMouseDown={(e) => handleResizeStart(e, 'nw')}
            />
            <div
              className={cn(resizeHandleClass, "top-0 right-0 cursor-ne-resize")}
              style={{ width: resizeHandleSize, height: resizeHandleSize }}
              onMouseDown={(e) => handleResizeStart(e, 'ne')}
            />
            <div
              className={cn(resizeHandleClass, "bottom-0 left-0 cursor-sw-resize")}
              style={{ width: resizeHandleSize, height: resizeHandleSize }}
              onMouseDown={(e) => handleResizeStart(e, 'sw')}
            />
            <div
              className={cn(resizeHandleClass, "bottom-0 right-0 cursor-se-resize")}
              style={{ width: resizeHandleSize, height: resizeHandleSize }}
              onMouseDown={(e) => handleResizeStart(e, 'se')}
            />
          </>
        )}
      </div>
    </div>
  );

  // Use portal to render at document body level for proper z-index stacking
  return createPortal(modalContent, document.body);
});

WindowModal.displayName = 'WindowModal';
