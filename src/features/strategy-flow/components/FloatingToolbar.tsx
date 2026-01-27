/**
 * FloatingToolbar - Professional centered toolbar
 * Inspired by award-winning trading platforms
 */

import { memo } from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import {
  Play,
  Layers,
  LineChart,
  Code2,
  Sparkles,
  Settings,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Download,
  Upload,
  User,
  BookOpen,
  Search,
  Activity,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useStrategyFlowStore } from '../store/strategyFlowStore';

interface FloatingToolbarProps {
  onOpenTemplates: () => void;
  onOpenBacktest: () => void;
  onOpenChart: () => void;
  onOpenCode: () => void;
  onOpenAI: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
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
  onOpenCode,
  onOpenAI,
  onOpenSettings,
  onOpenProfile,
  onOpenJournal,
  onOpenScreener,
  onOpenLiveTrading,
  onZoomIn,
  onZoomOut,
  onFitView,
  showCode,
  showAI,
}: FloatingToolbarProps) => {
  const { strategyName, isRunning, exportStrategy, importStrategy } = useStrategyFlowStore();

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
      <Toolbar.Root className="flex items-center gap-1 px-2 py-1.5 bg-card/95 backdrop-blur-md border border-border/50 rounded-xl shadow-2xl">
        {/* Strategy Name */}
        <div className="px-3 py-1 text-sm font-medium text-foreground/90 border-r border-border/50 mr-1">
          {strategyName}
        </div>

        {/* AI Builder */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onOpenAI}
              className={`p-2 rounded-lg transition-all ${
                showAI 
                  ? 'bg-purple-500/20 text-purple-400' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
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
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
              className={`p-2 rounded-lg transition-all ${
                showCode 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-sm transition-all ${
                isRunning
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              {isRunning ? 'Stop' : 'Backtest'}
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Run Backtest</TooltipContent>
        </Tooltip>

        {/* Live Trading */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onOpenLiveTrading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-sm bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-all"
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
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <BookOpen className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Trade Journal</TooltipContent>
        </Tooltip>

        {/* Profile */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onOpenProfile}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <User className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Profile & Settings</TooltipContent>
        </Tooltip>

        <Toolbar.Separator className="w-px h-5 bg-border/50 mx-1" />

        {/* Zoom Controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onZoomOut}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Download className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Export</TooltipContent>
        </Tooltip>

        {/* Settings */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toolbar.Button
              onClick={onOpenSettings}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Settings className="w-4 h-4" />
            </Toolbar.Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Settings</TooltipContent>
        </Tooltip>
      </Toolbar.Root>
    </TooltipProvider>
  );
});

FloatingToolbar.displayName = 'FloatingToolbar';
