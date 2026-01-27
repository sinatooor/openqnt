/**
 * PipelineToolbar - Top control bar for pipeline actions
 * Uses Radix UI Toolbar for proper accessibility and styling
 */

import { memo } from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import { 
  Play,
  Square,
  Upload,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePipelineStore } from '../store/pipelineStore';

interface PipelineToolbarProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
}

export const PipelineToolbar = memo(({ onZoomIn, onZoomOut, onFitView }: PipelineToolbarProps) => {
  const { 
    nodes,
    edges,
    exportPipeline,
    importPipeline,
    clearPipeline,
    isRunning,
    setIsRunning,
  } = usePipelineStore();

  const handleExport = () => {
    const data = exportPipeline();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result as string;
        try {
          importPipeline(data);
        } catch (err) {
          console.error('Failed to import pipeline:', err);
          alert('Invalid pipeline file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleRun = () => {
    setIsRunning(!isRunning);
  };

  const handleClear = () => {
    if (nodes.length === 0) return;
    if (confirm('Clear all nodes and connections?')) {
      clearPipeline();
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Toolbar.Root 
        className="flex items-center gap-0.5 px-2 py-1 bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg"
        aria-label="Pipeline controls"
      >
        {/* Pipeline Execution */}
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button 
                className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isRunning ? 'bg-emerald-500/20' : 'hover:bg-accent/80'
                }`}
                onClick={handleRun}
                aria-label={isRunning ? 'Stop pipeline' : 'Run pipeline'}
              >
                {isRunning ? (
                  <Square className="w-3.5 h-3.5 text-rose-500" />
                ) : (
                  <Play className="w-4 h-4 text-emerald-500" />
                )}
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent>{isRunning ? 'Stop Pipeline' : 'Run Pipeline'}</TooltipContent>
          </Tooltip>
        </div>

        <Toolbar.Separator className="w-px h-5 bg-border/50 mx-1.5" />

        {/* Zoom Controls */}
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button 
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={onZoomIn}
                aria-label="Zoom in"
              >
                <ZoomIn className="w-4 h-4 text-foreground/70" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button 
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={onZoomOut}
                aria-label="Zoom out"
              >
                <ZoomOut className="w-4 h-4 text-foreground/70" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button 
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={onFitView}
                aria-label="Fit view"
              >
                <Maximize2 className="w-4 h-4 text-foreground/70" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent>Fit View</TooltipContent>
          </Tooltip>
        </div>

        <Toolbar.Separator className="w-px h-5 bg-border/50 mx-1.5" />

        {/* File Operations */}
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button 
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={handleExport}
                aria-label="Export pipeline"
              >
                <Download className="w-4 h-4 text-foreground/70" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent>Export Pipeline</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button 
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={handleImport}
                aria-label="Import pipeline"
              >
                <Upload className="w-4 h-4 text-foreground/70" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent>Import Pipeline</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button 
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                onClick={handleClear}
                disabled={nodes.length === 0}
                aria-label="Clear pipeline"
              >
                <RotateCcw className="w-4 h-4 text-foreground/70" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent>Clear Pipeline</TooltipContent>
          </Tooltip>
        </div>

        <Toolbar.Separator className="w-px h-5 bg-border/50 mx-1.5" />

        {/* Status Badge */}
        <div className="flex items-center gap-2 px-2 py-0.5 bg-muted/50 rounded-md text-[10px] font-medium tabular-nums">
          <span className="text-muted-foreground">{nodes.length} nodes</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground">{edges.length} edges</span>
        </div>
      </Toolbar.Root>
    </TooltipProvider>
  );
});

PipelineToolbar.displayName = 'PipelineToolbar';
