/**
 * FloatingToolbar - Professional centered toolbar
 * Inspired by award-winning trading platforms
 */

import { memo, useState } from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import {
  Play,
  Layers,
  LineChart,
  Code2,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Download,
  Upload,
  BookOpen,
  Search,
  Activity,
  FlaskConical,
  Trash2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useStrategyFlowStore } from '../store/strategyFlowStore';

interface FloatingToolbarProps {
  onOpenTemplates: () => void;
  onOpenBacktest: () => void;
  onOpenChart: () => void;
  onOpenResearch: () => void;
  onOpenCode: () => void;
  onOpenAI: () => void;
  onOpenJournal: () => void;
  onOpenScreener: () => void;
  onOpenLiveTrading: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  showCode?: boolean;
  showAI?: boolean;
}

export const FloatingToolbar = memo(({
  onOpenTemplates,
  onOpenBacktest,
  onOpenChart,
  onOpenResearch,
  onOpenCode,
  onOpenAI,
  onOpenJournal,
  onOpenScreener,
  onOpenLiveTrading,
  onZoomIn,
  onZoomOut,
  onFitView,
  showCode,
  showAI,
}: FloatingToolbarProps) => {
  const { strategyName, isRunning, exportStrategy, importStrategy, clearCanvas, nodes } = useStrategyFlowStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleExport = () => {
    const json = exportStrategy();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${strategyName.replace(/\s+/g, '_')}.strategy.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            importStrategy(ev.target?.result as string);
          } catch {
            console.error('Failed to import strategy');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Toolbar.Root className="flex items-center gap-1 px-3 py-2 glass border border-border/50 rounded-xl shadow-trading-lg">
        {/* Strategy Name */}
        <div className="px-3 py-1 text-sm font-medium text-foreground/90 border-r border-border/50 mr-1">
          {strategyName}
        </div>

        {/* AI Builder */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onOpenAI}
              className={`p-2.5 rounded-lg transition-all duration-200 ${showAI
                  ? 'bg-primary/20 text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 hover:scale-105'
                }`}
            >
              <Sparkles className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            AI Strategy Builder <kbd className="ml-1 px-1 py-0.5 bg-muted rounded text-[10px]">I</kbd>
          </TooltipContent>
        </Tooltip>

        <Toolbar.Separator className="w-px h-5 bg-border/50 mx-1" />

        {/* Templates */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onOpenTemplates}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-200 hover:scale-105"
            >
              <Layers className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Templates</TooltipContent>
        </Tooltip>

        {/* Chart */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onOpenChart}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-200 hover:scale-105"
            >
              <LineChart className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Price Chart</TooltipContent>
        </Tooltip>

        {/* Code View */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onOpenCode}
              className={`p-2.5 rounded-lg transition-all duration-200 ${showCode
                  ? 'bg-primary/20 text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 hover:scale-105'
                }`}
            >
              <Code2 className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">View Code</TooltipContent>
        </Tooltip>

        <Toolbar.Separator className="w-px h-5 bg-border/50 mx-1" />

        {/* Backtest */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onOpenBacktest}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-sm transition-all duration-200 ${isRunning
                  ? 'bg-loss/20 text-loss hover:bg-loss/30 hover:scale-105'
                  : 'bg-profit/20 text-profit hover:bg-profit/30 hover:scale-105'
                }`}
            >
              <Play className="w-3.5 h-3.5" />
              {isRunning ? 'Stop' : 'Backtest'}
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Run Backtest</TooltipContent>
        </Tooltip>

        {/* Research & Quant Tools */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onOpenResearch}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-sm bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-all duration-200 hover:scale-105"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Research
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Research & Quant Tools</TooltipContent>
        </Tooltip>

        {/* Live Trading */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onOpenLiveTrading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-sm bg-primary/20 text-primary hover:bg-primary/30 transition-all duration-200 hover:scale-105"
            >
              <Activity className="w-3.5 h-3.5" />
              Live
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Live Trading</TooltipContent>
        </Tooltip>

        <Toolbar.Separator className="w-px h-5 bg-border/50 mx-1" />

        {/* Screener */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onOpenScreener}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-200 hover:scale-105"
            >
              <Search className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Market Screener</TooltipContent>
        </Tooltip>

        {/* Journal */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onOpenJournal}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-200 hover:scale-105"
            >
              <BookOpen className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Trade Journal</TooltipContent>
        </Tooltip>

        <Toolbar.Separator className="w-px h-5 bg-border/50 mx-1" />

        {/* Zoom Controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onZoomOut}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-200 hover:scale-105"
            >
              <ZoomOut className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Zoom Out</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onZoomIn}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-200 hover:scale-105"
            >
              <ZoomIn className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Zoom In</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onFitView}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-200 hover:scale-105"
            >
              <Maximize2 className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Fit View</TooltipContent>
        </Tooltip>

        <Toolbar.Separator className="w-px h-5 bg-border/50 mx-1" />

        {/* File Operations */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={handleImport}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-200 hover:scale-105"
            >
              <Upload className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Import</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={handleExport}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-200 hover:scale-105"
            >
              <Download className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Export</TooltipContent>
        </Tooltip>

        <Toolbar.Separator className="w-px h-5 bg-border/50 mx-1" />

        {/* Clear All */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={() => setShowClearConfirm(true)}
              disabled={nodes.length === 0}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 hover:scale-105 disabled:opacity-30 disabled:pointer-events-none"
            >
              <Trash2 className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Clear All</TooltipContent>
        </Tooltip>
      </Toolbar.Root>

      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear entire canvas?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {nodes.length} nodes and their connections from the canvas. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearCanvas()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
});

FloatingToolbar.displayName = 'FloatingToolbar';
