/**
 * WorkflowTabBar - Chrome-style tab bar that lets the user open multiple
 * workflows side-by-side without closing any.
 *
 * Interaction model:
 *  • Click a tab  → switch canvas to that workflow
 *  • "+" button   → open the Workflow Library dialog or create a blank tab
 *  • "×" on tab  → close that tab (state is preserved in workflowManagerStore)
 *
 * When switching tabs this component syncs the current canvas into the
 * outgoing tab snapshot, then hydrates strategyFlowStore from the incoming tab.
 */

import { memo, useState, useRef, useEffect } from 'react';
import {
  Plus,
  X,
  ChevronDown,
  Folder,
  Save,
  FileText,
  Trash2,
  Radio,
  RadioTower,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowManagerStore } from '../store/workflowManagerStore';
import { useStrategyFlowStore } from '../store/strategyFlowStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Single tab pill
// ---------------------------------------------------------------------------

interface TabPillProps {
  id: string;
  name: string;
  isActive: boolean;
  isModified: boolean;
  isPublished: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
}

const TabPill = memo(({ id, name, isActive, isModified, isPublished, onSelect, onClose }: TabPillProps) => (
  <button
    key={id}
    onClick={onSelect}
    className={cn(
      'group relative flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t-md border-t border-l border-r transition-colors select-none min-w-0 max-w-[180px] shrink-0',
      isActive
        ? 'bg-[#1e1e1e] border-white/15 text-white'
        : 'bg-[#2a2a2a] border-white/8 text-white/50 hover:text-white/80 hover:bg-[#252525]',
    )}
    title={name}
  >
    {/* Published indicator dot */}
    {isPublished && (
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" title="Active / Published" />
    )}
    <span className="truncate font-medium">{name}</span>
    {isModified && (
      <span className="text-amber-400 shrink-0 leading-none">•</span>
    )}
    {/* Close button */}
    <span
      role="button"
      tabIndex={-1}
      onClick={onClose}
      className={cn(
        'shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-all',
        isActive && 'opacity-60 hover:opacity-100',
      )}
    >
      <X className="w-3 h-3" />
    </span>
  </button>
));
TabPill.displayName = 'TabPill';

// ---------------------------------------------------------------------------
// Workflow Library dialog (browse saved workflows)
// ---------------------------------------------------------------------------

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
                        <p className="text-[11px] text-white/40 truncate mt-0.5">{wf.description}</p>
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
                        onClick={() => { onLoad(wf.id); onOpenChange(false); }}
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const WorkflowTabBar = memo(() => {
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

  const {
    nodes,
    edges,
    viewport,
    strategyName,
    strategyDescription,
    hydrateCanvas,
  } = useStrategyFlowStore.getState();

  const [showLibrary, setShowLibrary] = useState(false);
  const syncPendingRef = useRef(false);
  const initialMountRef = useRef(true);

  // When active tab changes, hydrate canvas from new tab
  useEffect(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;

    // First-load migration: if the tab is empty but the canvas already has
    // nodes (from the old strategyFlowStore persistence), sync canvas → tab
    // so the user doesn't lose their existing work.
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
        return; // canvas already has the right state, no hydration needed
      }
    }

    hydrateCanvas({
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

  const handleSwitchTab = (tabId: string) => {
    if (tabId === activeTabId) return;

    // Flush current canvas state into the outgoing tab
    const currentState = useStrategyFlowStore.getState();
    syncFromCanvas(activeTabId, {
      nodes: currentState.nodes,
      edges: currentState.edges,
      viewport: currentState.viewport,
      name: currentState.strategyName,
      description: currentState.strategyDescription,
    });

    switchTab(tabId);
    // useEffect will handle the hydration
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.isModified) {
      if (!window.confirm(`"${tab.name}" has unsaved changes. Close anyway?`)) return;
    }
    closeTab(tabId);
  };

  const handleNewTab = () => {
    // Flush current first
    const currentState = useStrategyFlowStore.getState();
    syncFromCanvas(activeTabId, {
      nodes: currentState.nodes,
      edges: currentState.edges,
      viewport: currentState.viewport,
      name: currentState.strategyName,
      description: currentState.strategyDescription,
    });

    createNewTab();
    // useEffect hydrates the blank canvas
  };

  const handleLoadWorkflow = (workflowId: string) => {
    const currentState = useStrategyFlowStore.getState();
    syncFromCanvas(activeTabId, {
      nodes: currentState.nodes,
      edges: currentState.edges,
      viewport: currentState.viewport,
      name: currentState.strategyName,
      description: currentState.strategyDescription,
    });
    loadWorkflow(workflowId);
  };

  const handleSaveCurrentTab = () => {
    // Make sure we sync first
    const currentState = useStrategyFlowStore.getState();
    syncFromCanvas(activeTabId, {
      nodes: currentState.nodes,
      edges: currentState.edges,
      viewport: currentState.viewport,
      name: currentState.strategyName,
      description: currentState.strategyDescription,
    });
    saveWorkflow(activeTabId);
    toast.success('Workflow saved to library');
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <>
      <div className="flex items-end gap-0 px-2 pt-1 bg-[#1a1a1a] border-b border-white/10 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <TabPill
            key={tab.id}
            id={tab.id}
            name={tab.name}
            isActive={tab.id === activeTabId}
            isModified={tab.isModified}
            isPublished={tab.isActive}
            onSelect={() => handleSwitchTab(tab.id)}
            onClose={(e) => handleCloseTab(e, tab.id)}
          />
        ))}

        {/* Controls to the right of tabs */}
        <div className="flex items-center gap-1 ml-2 pb-1 shrink-0">
          {/* New/open tab */}
          <button
            onClick={handleNewTab}
            className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
            title="New workflow tab"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Open from library */}
          <button
            onClick={() => setShowLibrary(true)}
            className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
            title="Open from library"
          >
            <Folder className="w-4 h-4" />
          </button>

          {/* Save current tab to library */}
          <button
            onClick={handleSaveCurrentTab}
            className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
            title="Save workflow to library"
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>

      <WorkflowLibraryDialog
        open={showLibrary}
        onOpenChange={setShowLibrary}
        onLoad={handleLoadWorkflow}
        onDelete={(id) => {
          if (window.confirm('Delete this workflow from the library?')) {
            deleteWorkflow(id);
          }
        }}
      />
    </>
  );
});

WorkflowTabBar.displayName = 'WorkflowTabBar';
