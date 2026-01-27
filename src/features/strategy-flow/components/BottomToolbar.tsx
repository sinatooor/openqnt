/**
 * BottomToolbar - Zoom controls, pan mode, undo/redo
 * Matches reference design with zoom percentage and controls
 */

import { memo, useCallback } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Hand,
  Mouse,
  Undo2,
  Redo2,
  Grid3X3,
  Lock,
  Unlock,
  Terminal,
} from 'lucide-react';
import { useStrategyFlowStore } from '../store/strategyFlowStore';

interface BottomToolbarProps {
  className?: string;
  onToggleDevLog?: () => void;
}

export const BottomToolbar = memo(({ className = '', onToggleDevLog }: BottomToolbarProps) => {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const { zoom } = useViewport();
  const { 
    undo, 
    redo, 
    canUndo, 
    canRedo,
    isPanMode,
    togglePanMode,
    showGrid,
    toggleGrid,
    isLocked,
    toggleLock,
  } = useStrategyFlowStore();

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 200 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 200 });
  }, [zoomOut]);

  const handleFitView = useCallback(() => {
    fitView({ duration: 300, padding: 0.2 });
  }, [fitView]);

  const handleResetZoom = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 });
  }, [setViewport]);

  const zoomPercentage = Math.round(zoom * 100);

  return (
    <div 
      className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 
        bg-[#252526] border border-white/10 rounded-lg px-2 py-1.5 shadow-xl ${className}`}
    >
      {/* Undo/Redo */}
      <div className="flex items-center gap-1 pr-2 border-r border-white/10">
        <button
          onClick={undo}
          disabled={!canUndo()}
          className="p-1.5 rounded hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4 text-white/70" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo()}
          className="p-1.5 rounded hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* Pan/Select Mode Toggle */}
      <div className="flex items-center gap-1 px-2 border-r border-white/10">
        <button
          onClick={togglePanMode}
          className={`p-1.5 rounded transition-colors ${
            !isPanMode ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/50'
          }`}
          title="Select Mode (V)"
        >
          <Mouse className="w-4 h-4" />
        </button>
        <button
          onClick={togglePanMode}
          className={`p-1.5 rounded transition-colors ${
            isPanMode ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/50'
          }`}
          title="Pan Mode (H)"
        >
          <Hand className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1 px-2 border-r border-white/10">
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut className="w-4 h-4 text-white/70" />
        </button>

        <button
          onClick={handleResetZoom}
          className="px-2 py-1 rounded hover:bg-white/10 transition-colors text-xs font-mono text-white/80 min-w-[48px]"
          title="Reset Zoom (Ctrl+0)"
        >
          {zoomPercentage}%
        </button>

        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn className="w-4 h-4 text-white/70" />
        </button>

        <button
          onClick={handleFitView}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="Fit View (Ctrl+1)"
        >
          <Maximize2 className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* Grid Toggle */}
      <div className="flex items-center gap-1 px-2 border-r border-white/10">
        <button
          onClick={toggleGrid}
          className={`p-1.5 rounded transition-colors ${
            showGrid ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/50'
          }`}
          title="Toggle Grid (G)"
        >
          <Grid3X3 className="w-4 h-4" />
        </button>
      </div>

      {/* Lock Toggle */}
      <div className="flex items-center gap-1 px-2 border-r border-white/10">
        <button
          onClick={toggleLock}
          className={`p-1.5 rounded transition-colors ${
            isLocked ? 'bg-red-500/30 text-red-400' : 'hover:bg-white/10 text-white/50'
          }`}
          title="Lock Canvas (L)"
        >
          {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>
      </div>

      {/* Dev Log Toggle */}
      <div className="flex items-center gap-1 pl-2">
        <button
          onClick={onToggleDevLog}
          className="p-1.5 rounded hover:bg-white/10 text-white/50 transition-colors"
          title="Toggle Dev Log"
        >
          <Terminal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

BottomToolbar.displayName = 'BottomToolbar';
