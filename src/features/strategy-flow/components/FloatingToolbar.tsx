/**
 * FloatingToolbar — Single consolidated toolbar for the strategy flow canvas.
 *
 * Contains all functionality that previously lived in TopToolbar and
 * WorkflowTabBar. Less frequently-used actions are tucked away in the
 * "..." overflow menu and a dedicated "tabs" menu.
 */

import { memo, useState, useRef, useEffect } from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import {
  Play,
  Square,
  RotateCcw,
  Layers,
  LineChart,
  Code2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Upload,
  BookOpen,
  Search,
  Activity,
  FlaskConical,
  Trash2,
  Save,
  MoreHorizontal,
  Radio,
  RadioTower,
  History,
  Settings,
  Edit2,
  Check,
  X,
  Plus,
  Folder,
  FileText,
  SortAsc,
  ChevronDown,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useStrategyFlowStore } from '../store/strategyFlowStore';
import { useWorkflowManagerStore } from '../store/workflowManagerStore';
import { useUserProfile } from '@/hooks/useUserProfile';

interface FloatingToolbarProps {
  onOpenTemplates: () => void;
  onOpenBacktest: () => void;
  onOpenChart: () => void;
  onOpenCode: () => void;
  onOpenJournal: () => void;
  onOpenScreener: () => void;
  onOpenLiveTrading: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  showCode?: boolean;
  onStartExecution?: () => void;
  onStopExecution?: () => void;
  onResetExecution?: () => void;
  executionPhase?: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Workflow Library Dialog
// ────────────────────────────────────────────────────────────────────────────

interface WorkflowLibraryDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

const WorkflowLibraryDialog = memo(
  ({ open, onOpenChange, onLoad, onDelete }: WorkflowLibraryDialogProps) => {
    const savedWorkflows = useWorkflowManagerStore((s) => s.savedWorkflows);

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg bg-[#1a1a1a] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-white/90 flex items-center gap-2">
              <Folder className="w-4 h-4 text-blue-400" />
              Workflow Library
            </DialogTitle>
          </DialogHeader>

          {savedWorkflows.length === 0 ? (
            <div className="py-8 text-center text-white/40 text-sm">
              No saved workflows yet. Save your current strategy to add it here.
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-2 pr-2">
                {savedWorkflows.map((wf) => (
                  <div
                    key={wf.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/8 hover:border-white/15 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white/90 truncate">
                          {wf.name}
                        </span>
                        {wf.isActive && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                            <RadioTower className="w-2.5 h-2.5" />
                            Active
                          </span>
                        )}
                      </div>
                      {wf.description && (
                        <p className="text-[11px] text-white/40 truncate mt-0.5">
                          {wf.description}
                        </p>
                      )}
                      <p className="text-[10px] text-white/25 mt-1">
                        {wf.nodes.length} nodes · Saved{' '}
                        {new Date(wf.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-white/70 hover:text-white"
                        onClick={() => {
                          onLoad(wf.id);
                          onOpenChange(false);
                        }}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => onDelete(wf.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    );
  },
);
WorkflowLibraryDialog.displayName = 'WorkflowLibraryDialog';

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

export const FloatingToolbar = memo(
  ({
    onOpenTemplates,
    onOpenBacktest,
    onOpenChart,
    onOpenCode,
    onOpenJournal,
    onOpenScreener,
    onOpenLiveTrading,
    onZoomIn,
    onZoomOut,
    onFitView,
    showCode,
    onStartExecution,
    onStopExecution,
    onResetExecution,
    executionPhase = 'idle',
    onOpenHistory,
    onOpenSettings,
  }: FloatingToolbarProps) => {
    const {
      strategyName,
      setStrategyName,
      isModified,
      isActive,
      toggleActive,
      executionOrder,
      setExecutionOrder,
      exportStrategy,
      importStrategy,
      clearCanvas,
      nodes,
      edges,
    } = useStrategyFlowStore();

    const tabs = useWorkflowManagerStore((s) => s.tabs);
    const activeTabId = useWorkflowManagerStore((s) => s.activeTabId);
    const {
      createNewTab,
      closeTab,
      switchTab,
      syncFromCanvas,
      saveWorkflow,
      loadWorkflow,
      deleteWorkflow,
    } = useWorkflowManagerStore.getState();

    const { isLoggedIn, saveStrategy } = useUserProfile();

    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showLibrary, setShowLibrary] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(strategyName);
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (isEditingName && nameInputRef.current) {
        nameInputRef.current.focus();
        nameInputRef.current.select();
      }
    }, [isEditingName]);

    useEffect(() => {
      setEditedName(strategyName);
    }, [strategyName]);

    // ── Tab sync/hydrate on tab switch ───────────────────────────────────────
    const initialMountRef = useRef(true);
    useEffect(() => {
      const tab = tabs.find((t) => t.id === activeTabId);
      if (!tab) return;

      // First-load migration
      if (initialMountRef.current) {
        initialMountRef.current = false;
        const currentCanvas = useStrategyFlowStore.getState();
        if (tab.nodes.length === 0 && currentCanvas.nodes.length > 0) {
          syncFromCanvas(activeTabId, {
            nodes: currentCanvas.nodes,
            edges: currentCanvas.edges,
            viewport: currentCanvas.viewport,
            name: currentCanvas.strategyName,
            description: currentCanvas.strategyDescription,
          });
          return;
        }
      }

      useStrategyFlowStore.getState().hydrateCanvas({
        nodes: tab.nodes,
        edges: tab.edges,
        viewport: tab.viewport,
        strategyName: tab.name,
        strategyDescription: tab.description,
        isActive: tab.isActive,
        executionOrder: tab.executionOrder,
        workflowId: tab.workflowId,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTabId]);

    // ── Strategy name edit ────────────────────────────────────────────────────
    const handleSaveName = () => {
      const name = editedName.trim();
      if (name) setStrategyName(name);
      setIsEditingName(false);
    };

    const handleCancelNameEdit = () => {
      setEditedName(strategyName);
      setIsEditingName(false);
    };

    const handleNameKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSaveName();
      else if (e.key === 'Escape') handleCancelNameEdit();
    };

    // ── Import / export ──────────────────────────────────────────────────────
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
      input.accept = '.json,.strategy.json';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            importStrategy(ev.target?.result as string);
            toast.success('Strategy imported');
          } catch {
            toast.error('Failed to import strategy file');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    };

    // ── Save (workflow library + server) ─────────────────────────────────────
    const flushCanvasToActiveTab = () => {
      const current = useStrategyFlowStore.getState();
      syncFromCanvas(activeTabId, {
        nodes: current.nodes,
        edges: current.edges,
        viewport: current.viewport,
        name: current.strategyName,
        description: current.strategyDescription,
      });
    };

    const handleSave = async () => {
      try {
        flushCanvasToActiveTab();
        saveWorkflow(activeTabId);
        toast.success('Workflow saved to library');

        if (isLoggedIn) {
          await saveStrategy(strategyName, nodes, edges);
          toast.success('Strategy also saved to your account');
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to save strategy';
        toast.error(msg);
      }
    };

    // ── Tab operations ───────────────────────────────────────────────────────
    const handleNewTab = () => {
      flushCanvasToActiveTab();
      createNewTab();
    };

    const handleSwitchTab = (tabId: string) => {
      if (tabId === activeTabId) return;
      flushCanvasToActiveTab();
      switchTab(tabId);
    };

    const handleCloseTab = (tabId: string, tabName: string, wasModified: boolean) => {
      if (wasModified && !window.confirm(`"${tabName}" has unsaved changes. Close anyway?`)) {
        return;
      }
      closeTab(tabId);
    };

    const handleLoadFromLibrary = (workflowId: string) => {
      flushCanvasToActiveTab();
      loadWorkflow(workflowId);
    };

    const handleDeleteFromLibrary = (workflowId: string) => {
      if (window.confirm('Delete this workflow from the library?')) {
        deleteWorkflow(workflowId);
        toast.success('Workflow deleted');
      }
    };

    // ── Shared classes ───────────────────────────────────────────────────────
    const iconButtonClass =
      'p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-200 hover:scale-105';
    const activeIconButtonClass =
      'p-2 rounded-lg bg-primary/20 text-primary shadow-sm transition-all duration-200 hover:scale-105';

    return (
      <TooltipProvider delayDuration={0}>
        <Toolbar.Root className="flex items-center gap-0.5 px-2 py-1.5 glass border border-border/50 rounded-xl shadow-trading-lg max-w-[98vw] overflow-x-auto no-scrollbar">
          {/* ── Strategy name (editable) ─────────────────────────────────── */}
          <div className="flex items-center gap-1 px-2 border-r border-border/50 mr-1 shrink-0">
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  className="w-36 bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-primary"
                />
                <Toolbar.Button
                  onClick={handleSaveName}
                  className="p-1 rounded hover:bg-green-500/20 text-green-400"
                >
                  <Check className="w-3.5 h-3.5" />
                </Toolbar.Button>
                <Toolbar.Button
                  onClick={handleCancelNameEdit}
                  className="p-1 rounded hover:bg-red-500/20 text-red-400"
                >
                  <X className="w-3.5 h-3.5" />
                </Toolbar.Button>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Toolbar.Button
                    onClick={() => {
                      setEditedName(strategyName);
                      setIsEditingName(true);
                    }}
                    className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-accent/40 group max-w-[180px]"
                  >
                    <span className="text-sm font-medium text-foreground/90 truncate">
                      {strategyName}
                    </span>
                    {isModified && <span className="text-amber-400 leading-none">•</span>}
                    <Edit2 className="w-3 h-3 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Toolbar.Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Click to rename strategy
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* ── Workflow tabs dropdown ──────────────────────────────────── */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Toolbar.Button
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all',
                      'shrink-0',
                    )}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="tabular-nums">{tabs.length}</span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </Toolbar.Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Workflow tabs
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" side="top" className="w-72">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Open Workflows</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {tabs.length} open
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-64 overflow-y-auto">
                {tabs.map((tab) => (
                  <DropdownMenuItem
                    key={tab.id}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleSwitchTab(tab.id);
                    }}
                    className={cn(
                      'flex items-center gap-2 group',
                      tab.id === activeTabId && 'bg-accent/60',
                    )}
                  >
                    {tab.isActive && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"
                        title="Active/Published"
                      />
                    )}
                    <span className="flex-1 truncate text-xs">{tab.name}</span>
                    {tab.isModified && (
                      <span className="text-amber-400 text-[10px] leading-none">•</span>
                    )}
                    {tabs.length > 1 && (
                      <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseTab(tab.id, tab.name, tab.isModified);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/20 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleNewTab}>
                <Plus className="w-3.5 h-3.5 mr-2" />
                New Workflow Tab
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShowLibrary(true)}>
                <Folder className="w-3.5 h-3.5 mr-2" />
                Open from Library…
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  flushCanvasToActiveTab();
                  saveWorkflow(activeTabId);
                  toast.success('Workflow saved to library');
                }}
              >
                <Save className="w-3.5 h-3.5 mr-2" />
                Save Current to Library
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* ── Active/Inactive toggle ──────────────────────────────────── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button
                onClick={toggleActive}
                className={cn(
                  'flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all border shrink-0',
                  isActive
                    ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30'
                    : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/60',
                )}
              >
                {isActive ? (
                  <>
                    <RadioTower className="w-3 h-3" />
                    Active
                  </>
                ) : (
                  <>
                    <Radio className="w-3 h-3" />
                    Inactive
                  </>
                )}
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {isActive
                ? 'Workflow is Active — click to deactivate'
                : 'Workflow is Inactive — click to activate/publish'}
            </TooltipContent>
          </Tooltip>

          <Toolbar.Separator className="w-px h-5 bg-border/50 mx-1" />

          {/* ── Templates ──────────────────────────────────────────────── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button onClick={onOpenTemplates} className={iconButtonClass}>
                <Layers className="w-4 h-4" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Templates
            </TooltipContent>
          </Tooltip>

          {/* ── Chart ──────────────────────────────────────────────────── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button onClick={onOpenChart} className={iconButtonClass}>
                <LineChart className="w-4 h-4" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Price Chart
            </TooltipContent>
          </Tooltip>

          {/* ── Code View ──────────────────────────────────────────────── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button
                onClick={onOpenCode}
                className={showCode ? activeIconButtonClass : iconButtonClass}
              >
                <Code2 className="w-4 h-4" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              View Code (Python/MQL)
            </TooltipContent>
          </Tooltip>

          <Toolbar.Separator className="w-px h-5 bg-border/50 mx-1" />

          {/* ── Run / Stop execution ───────────────────────────────────── */}
          {executionPhase === 'running' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Toolbar.Button
                  onClick={onStopExecution}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs bg-loss/20 text-loss hover:bg-loss/30 transition-all duration-200 hover:scale-105 shrink-0"
                >
                  <Square className="w-3.5 h-3.5" />
                  Stop
                </Toolbar.Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Stop Execution
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Toolbar.Button
                  onClick={onStartExecution}
                  disabled={nodes.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs bg-profit/20 text-profit hover:bg-profit/30 transition-all duration-200 hover:scale-105 disabled:opacity-30 disabled:pointer-events-none shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  Run
                </Toolbar.Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Run Strategy Execution
              </TooltipContent>
            </Tooltip>
          )}

          {/* Reset execution results */}
          {(executionPhase === 'completed' || executionPhase === 'error') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Toolbar.Button onClick={onResetExecution} className={iconButtonClass}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </Toolbar.Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Clear Results
              </TooltipContent>
            </Tooltip>
          )}

          {/* ── Backtest ───────────────────────────────────────────────── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button onClick={onOpenBacktest} className={iconButtonClass}>
                <FlaskConical className="w-4 h-4" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Backtest
            </TooltipContent>
          </Tooltip>

          {/* ── Live Trading ───────────────────────────────────────────── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button
                onClick={onOpenLiveTrading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold text-xs bg-primary/20 text-primary hover:bg-primary/30 transition-all duration-200 hover:scale-105 shrink-0"
              >
                <Activity className="w-3.5 h-3.5" />
                Live
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Live Trading
            </TooltipContent>
          </Tooltip>

          <Toolbar.Separator className="w-px h-5 bg-border/50 mx-1" />

          {/* ── Screener ───────────────────────────────────────────────── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button onClick={onOpenScreener} className={iconButtonClass}>
                <Search className="w-4 h-4" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Market Screener
            </TooltipContent>
          </Tooltip>

          {/* ── Journal ────────────────────────────────────────────────── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button onClick={onOpenJournal} className={iconButtonClass}>
                <BookOpen className="w-4 h-4" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Trade Journal
            </TooltipContent>
          </Tooltip>

          <Toolbar.Separator className="w-px h-5 bg-border/50 mx-1" />

          {/* ── Zoom controls ──────────────────────────────────────────── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button onClick={onZoomOut} className={iconButtonClass}>
                <ZoomOut className="w-4 h-4" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Zoom Out
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button onClick={onZoomIn} className={iconButtonClass}>
                <ZoomIn className="w-4 h-4" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Zoom In
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button onClick={onFitView} className={iconButtonClass}>
                <Maximize2 className="w-4 h-4" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Fit View
            </TooltipContent>
          </Tooltip>

          <Toolbar.Separator className="w-px h-5 bg-border/50 mx-1" />

          {/* ── Save (cloud) ───────────────────────────────────────────── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toolbar.Button onClick={handleSave} className={iconButtonClass}>
                <Save className="w-4 h-4" />
              </Toolbar.Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Save <kbd className="ml-1 px-1 py-0.5 bg-muted rounded text-[10px]">⌘S</kbd>
            </TooltipContent>
          </Tooltip>

          {/* ── Overflow "..." menu ────────────────────────────────────── */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Toolbar.Button className={iconButtonClass}>
                    <MoreHorizontal className="w-4 h-4" />
                  </Toolbar.Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                More actions
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" side="top" className="w-60">
              {onOpenHistory && (
                <DropdownMenuItem onSelect={onOpenHistory}>
                  <History className="w-3.5 h-3.5 mr-2" />
                  Execution History
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onSelect={() =>
                  setExecutionOrder(executionOrder === 'v1' ? 'v0' : 'v1')
                }
              >
                <SortAsc className="w-3.5 h-3.5 mr-2" />
                Execution Order: {executionOrder}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {executionOrder === 'v1' ? 'branch-first' : 'legacy'}
                </span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onSelect={handleImport}>
                <Upload className="w-3.5 h-3.5 mr-2" />
                Import Strategy (JSON)
              </DropdownMenuItem>

              <DropdownMenuItem onSelect={handleExport}>
                <Download className="w-3.5 h-3.5 mr-2" />
                Export Strategy (JSON)
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {onOpenSettings && (
                <DropdownMenuItem onSelect={onOpenSettings}>
                  <Settings className="w-3.5 h-3.5 mr-2" />
                  Settings
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onSelect={() => setShowClearConfirm(true)}
                disabled={nodes.length === 0}
                className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Clear Canvas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Toolbar.Root>

        {/* ── Clear confirmation dialog ───────────────────────────────── */}
        <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear entire canvas?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all {nodes.length} nodes and their connections from the
                canvas. This action cannot be undone.
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

        {/* ── Workflow Library dialog ─────────────────────────────────── */}
        <WorkflowLibraryDialog
          open={showLibrary}
          onOpenChange={setShowLibrary}
          onLoad={handleLoadFromLibrary}
          onDelete={handleDeleteFromLibrary}
        />
      </TooltipProvider>
    );
  },
);

FloatingToolbar.displayName = 'FloatingToolbar';
