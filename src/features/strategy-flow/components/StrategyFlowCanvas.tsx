/**
 * StrategyFlowCanvas - Professional trading strategy builder
 * Layout: Icon rail + Left Panel | Canvas | Right Property Panel
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Debounced validation to avoid expensive recalculations
 * - Memoized nodeTypes to prevent re-registration
 * - Optimized selection change handlers
 * - Reduced MiniMap update frequency
 */

import { useCallback, useRef, useState, useEffect, useMemo, DragEvent, memo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  SelectionMode,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
  useReactFlow,
  ReactFlowProvider,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Sparkles, Boxes, Play, AlertCircle, CheckCircle2, Cloud, CloudOff } from 'lucide-react';

import { nodeTypes } from './nodes';
import { FloatingToolbar } from './FloatingToolbar';
import { LeftSidebar } from './LeftSidebar';
import { RightPropertyPanel } from './RightPropertyPanel';
import { ContextMenu } from './ContextMenu';
import { CodeViewPanel } from './CodeViewPanel';
import { AIChatPanel } from './AIChatPanel';
import {
  BacktestModal,
  TemplatesDialog,
  SearchNodesDialog,
  ChartModal,
  JournalModal,
  ScreenerModal,
  LiveTradingPanel,
  ResearchModal,
} from './modals';
import { useStrategyFlowStore, isValidConnection, validateStrategy } from '../store/strategyFlowStore';
import type { StrategyFlowNode, NodeCatalogItem } from '../types';
import { Component, ReactNode } from 'react';

// Local ErrorBoundary since the legacy @/components/ErrorBoundary was removed
class ErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// Memoized node types - CRITICAL: must be stable reference
const memoizedNodeTypes = nodeTypes;

// Professional edge styling (defaults for new edges - actual color is set per-edge in store)
const defaultEdgeOptions = {
  type: 'bezier',
  animated: false,
  style: {
    strokeWidth: 2,
  },
};

const connectionLineStyle = {
  stroke: 'hsl(var(--primary))',
  strokeWidth: 2,
  strokeDasharray: '5,5',
};

// MiniMap node colors
const nodeColor = (node: { type?: string }) => {
  const colors: Record<string, string> = {
    indicator: '#8b5cf6',
    condition: '#a855f7',
    action: '#10b981',
    risk: '#ef4444',
    environment: '#6366f1',
    control: '#64748b',
    variable: '#ec4899',
    math: '#14b8a6',
    tradeInfo: '#06b6d4',
    llm: '#a855f7',
  };
  return colors[node.type || ''] || '#6366f1';
};

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

const EmptyState = ({
  onOpenSidebar,
  onOpenAI,
  onOpenBacktest,
  onOpenTemplates
}: {
  onOpenSidebar: () => void;
  onOpenAI: () => void;
  onOpenBacktest: () => void;
  onOpenTemplates: () => void;
}) => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
    <div className="text-center max-w-lg pointer-events-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <div className="w-24 h-24 mx-auto bg-primary/10 rounded-3xl flex items-center justify-center shadow-trading-lg hover-lift">
          <Boxes className="w-12 h-12 text-primary" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-3 tracking-tight">Start Building Your Strategy</h2>
      <p className="text-muted-foreground text-sm mb-8 leading-relaxed max-w-md mx-auto">
        Drag nodes from the sidebar to create your trading strategy, or use AI to generate one automatically.
      </p>
      <div className="grid grid-cols-2 gap-4 text-left">
        <div
          onClick={onOpenSidebar}
          className="p-4 glass rounded-xl border border-border/50 hover-lift group cursor-pointer hover:bg-card/50 transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Boxes className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">Drag & Drop</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">Drag nodes from the left sidebar onto the canvas</p>
        </div>
        <div
          onClick={onOpenAI}
          className="p-4 glass rounded-xl border border-border/50 hover-lift group cursor-pointer hover:bg-card/50 transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-sm font-semibold text-foreground">AI Generate</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono border border-border">I</kbd> to describe your strategy</p>
        </div>
        <div
          onClick={onOpenBacktest}
          className="p-4 glass rounded-xl border border-border/50 hover-lift group cursor-pointer hover:bg-card/50 transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-profit/20 group-hover:bg-profit/30 transition-colors">
              <Play className="w-4 h-4 text-profit" />
            </div>
            <span className="text-sm font-semibold text-foreground">Backtest</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">Test your strategy on historical data</p>
        </div>
        <div
          onClick={onOpenTemplates}
          className="p-4 glass rounded-xl border border-border/50 hover-lift group cursor-pointer hover:bg-card/50 transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-sm font-semibold text-foreground">Quick Start</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">Load a template from the toolbar</p>
        </div>
      </div>
    </div>
  </div>
);

// =============================================================================
// SAVE STATUS INDICATOR
// =============================================================================

const SaveStatusIndicator = ({ lastSavedAt, isModified }: { lastSavedAt: number | null; isModified: boolean }) => {
  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return 'Saved';
  };

  if (!lastSavedAt) {
    return (
      <div className="flex items-center gap-1.5 text-white/40 text-xs">
        <CloudOff className="w-3.5 h-3.5" />
        <span>Not saved</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-white/60 text-xs">
      <Cloud className="w-3.5 h-3.5 text-green-400" />
      <span>Saved {getTimeAgo(lastSavedAt)}</span>
      {isModified && <span className="text-amber-400">•</span>}
    </div>
  );
};

// =============================================================================
// STRATEGY VALIDATION BADGE - Debounced for performance
// =============================================================================

const StrategyValidationBadge = memo(({ nodes, edges }: { nodes: StrategyFlowNode[]; edges: any[] }) => {
  // Debounce validation to avoid expensive recalculations on every change
  const [debouncedValidation, setDebouncedValidation] = useState(() =>
    nodes.length > 0 ? validateStrategy(nodes, edges) : null
  );

  useEffect(() => {
    if (nodes.length === 0) {
      setDebouncedValidation(null);
      return;
    }

    // Debounce validation by 300ms
    const timer = setTimeout(() => {
      setDebouncedValidation(validateStrategy(nodes, edges));
    }, 300);

    return () => clearTimeout(timer);
  }, [nodes, edges]);

  if (!debouncedValidation || nodes.length === 0) return null;

  const validation = debouncedValidation;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${validation.isValid
      ? 'bg-green-500/20 text-green-400'
      : validation.errors.length > 0
        ? 'bg-red-500/20 text-red-400'
        : 'bg-amber-500/20 text-amber-400'
      }`}>
      {validation.isValid ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Valid Strategy</span>
        </>
      ) : validation.errors.length > 0 ? (
        <>
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{validation.errors.length} issue{validation.errors.length > 1 ? 's' : ''}</span>
        </>
      ) : (
        <>
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{validation.warnings.length} warning{validation.warnings.length > 1 ? 's' : ''}</span>
        </>
      )}
    </div>
  );
});

StrategyValidationBadge.displayName = 'StrategyValidationBadge';

// Inner component that uses ReactFlow hooks
const StrategyFlowCanvasInner = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();

  // Panel visibility states
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(() => useStrategyFlowStore.getState().viewport.zoom);
  const hasRestoredViewport = useRef(false);

  // Modal states
  const [showBacktest, setShowBacktest] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showScreener, setShowScreener] = useState(false);
  const [showLiveTrading, setShowLiveTrading] = useState(false);
  const [showResearch, setShowResearch] = useState(false);

  // Use shallow comparison for store values to prevent unnecessary re-renders
  const {
    nodes,
    edges,
    viewport,
    selectedNodeId,
    isPanMode,
    showGrid,
    isLocked,
    contextMenu,
    lastSavedAt,
    isModified,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    addNode,
    setViewport,
    hideContextMenu,
  } = useStrategyFlowStore();

  // Update zoom level on move
  const handleMoveEnd = useCallback((_: any, vp: any) => {
    setViewport(vp);
    setZoomLevel(vp.zoom);
  }, [setViewport]);

  // Only fitView on first mount when there's no meaningful saved viewport
  useEffect(() => {
    if (hasRestoredViewport.current) return;
    hasRestoredViewport.current = true;
    const savedViewport = useStrategyFlowStore.getState().viewport;
    // If the viewport is at default (0,0, zoom 1) and there are nodes, do a fitView
    // Otherwise the persisted viewport (defaultViewport prop) is used
    if (savedViewport.x === 0 && savedViewport.y === 0 && savedViewport.zoom === 1 && nodes.length > 0) {
      fitView({ padding: 0.2, duration: 0 });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Get selected node object
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find(n => n.id === selectedNodeId) as StrategyFlowNode | undefined ?? null;
  }, [nodes, selectedNodeId]);

  // Handle node selection
  const handleSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: { id: string }[] }) => {
    if (selectedNodes.length === 1) {
      selectNode(selectedNodes[0].id);
    } else if (selectedNodes.length === 0) {
      selectNode(null);
    }
  }, [selectNode]);

  // Handle node right-click
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: { id: string }) => {
    event.preventDefault();
    useStrategyFlowStore.getState().showContextMenu(event.clientX, event.clientY, node.id);
  }, []);

  // Handle drag over for drop zone
  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop from palette
  const handleDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    if (isLocked) return;

    const nodeTypeData = event.dataTransfer.getData('application/strategyflow');
    if (!nodeTypeData) return;

    try {
      const catalogItem: NodeCatalogItem = JSON.parse(nodeTypeData);

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(catalogItem, position);
    } catch (e) {
      console.error('Failed to parse dropped node data:', e);
    }
  }, [isLocked, screenToFlowPosition, addNode]);

  // Handle pane click to deselect
  const handlePaneClick = useCallback(() => {
    selectNode(null);
    hideContextMenu();
  }, [selectNode, hideContextMenu]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const { selectedNodeId, duplicateNode, deleteNode, undo, redo, togglePanMode, toggleGrid } =
        useStrategyFlowStore.getState();

      // Delete
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        e.preventDefault();
        deleteNode(selectedNodeId);
      }

      // Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedNodeId) {
        e.preventDefault();
        duplicateNode(selectedNodeId);
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }

      // Toggle modes
      if (e.key === 'h' || e.key === 'H') togglePanMode();
      if (e.key === 'g' || e.key === 'G') toggleGrid();

      // Search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true); }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setShowSearch(true); }

      // AI Panel
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setShowAIPanel(prev => !prev);
      }

      // Toggle sidebar
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        useStrategyFlowStore.getState().setLeftSidebarOpen(!useStrategyFlowStore.getState().leftSidebarOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Memoize isValidConnection callback to prevent re-renders
  const checkIsValidConnection = useCallback((connection: any) => {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    return isValidConnection(sourceNode, targetNode);
  }, [nodes]);

  return (
    <div
      ref={reactFlowWrapper}
      className="w-full h-full bg-background pt-14"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={memoizedNodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineStyle={connectionLineStyle}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange as OnEdgesChange}
        onConnect={onConnect as OnConnect}
        onSelectionChange={handleSelectionChange}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={handlePaneClick}
        onMoveEnd={handleMoveEnd}
        defaultViewport={viewport}
        isValidConnection={checkIsValidConnection}
        selectionMode={SelectionMode.Partial}
        panOnDrag={true}
        selectNodesOnDrag={!isPanMode}
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
        elementsSelectable={!isLocked}
        minZoom={0.1}
        maxZoom={4}
        snapToGrid={false}
        proOptions={{ hideAttribution: true }}
      >
        {/* Grid Background */}
        {showGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="rgba(255,255,255,0.03)"
          />
        )}

        {/* MiniMap in bottom right */}
        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeWidth={3}
          zoomable
          pannable
          position="bottom-right"
          maskColor="hsla(var(--background), 0.8)"
          style={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 12,
          }}
          className="!m-4 pointer-events-auto"
        />



        {/* ========== FLOATING TOOLBAR ========== */}

        {/* Bottom Center: Floating Toolbar (moved from top to avoid overlap with app header) */}
        <Panel position="bottom-center" className="!m-0 !mb-4">
          <FloatingToolbar
            onOpenTemplates={() => setShowTemplates(true)}
            onOpenBacktest={() => setShowBacktest(true)}
            onOpenChart={() => setShowChart(true)}
            onOpenResearch={() => setShowResearch(true)}
            onOpenCode={() => setShowCodePanel(!showCodePanel)}
            onOpenAI={() => setShowAIPanel(!showAIPanel)}
            onOpenJournal={() => setShowJournal(true)}
            onOpenScreener={() => setShowScreener(true)}
            onOpenLiveTrading={() => setShowLiveTrading(true)}
            onZoomIn={() => zoomIn()}
            onZoomOut={() => zoomOut()}
            onFitView={() => fitView({ padding: 0.2 })}
            showCode={showCodePanel}
            showAI={showAIPanel}
          />
        </Panel>

        {/* Top Right: Status indicators (below app header) */}
        <Panel position="top-right" className="!mt-2 !mr-4 !mb-0">
          <div className="flex items-center gap-3 px-3 py-2 bg-card/80 backdrop-blur-sm border border-border/30 rounded-lg">
            <SaveStatusIndicator lastSavedAt={lastSavedAt} isModified={isModified} />
            <div className="w-px h-4 bg-border/50" />
            <StrategyValidationBadge nodes={nodes} edges={edges} />
            <div className="w-px h-4 bg-border/50" />
            <span className="text-xs text-white/50 tabular-nums">
              {Math.round(zoomLevel * 100)}%
            </span>
          </div>
        </Panel>
      </ReactFlow>

      {/* Empty State (shown when no nodes) */}
      {nodes.length === 0 && (
        <EmptyState
          onOpenSidebar={() => useStrategyFlowStore.getState().setLeftSidebarOpen(true)}
          onOpenAI={() => setShowAIPanel(true)}
          onOpenBacktest={() => setShowBacktest(true)}
          onOpenTemplates={() => setShowTemplates(true)}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onClose={hideContextMenu}
        />
      )}

      {/* Code View Panel (floating right side) */}
      {showCodePanel && (
        <div className="fixed top-20 right-4 z-40 animate-in slide-in-from-right-2 duration-200">
          <CodeViewPanel open={showCodePanel} onOpenChange={setShowCodePanel} />
        </div>
      )}

      {/* AI Chat Panel (full-height slider panel) */}
      {showAIPanel && (
        <AIChatPanel open={showAIPanel} onOpenChange={setShowAIPanel} />
      )}

      {/* Modals */}
      <BacktestModal open={showBacktest} onOpenChange={setShowBacktest} />
      <TemplatesDialog open={showTemplates} onOpenChange={setShowTemplates} />
      <SearchNodesDialog open={showSearch} onOpenChange={setShowSearch} />
      <ChartModal open={showChart} onOpenChange={setShowChart} />
      <ResearchModal open={showResearch} onOpenChange={setShowResearch} />
      <JournalModal open={showJournal} onOpenChange={setShowJournal} />
      <ScreenerModal open={showScreener} onOpenChange={setShowScreener} />
      <LiveTradingPanel open={showLiveTrading} onOpenChange={setShowLiveTrading} />
    </div>
  );
};

// Strategy Flow Error Fallback
const StrategyFlowErrorFallback = () => (
  <div className="h-screen w-screen bg-[#0a0a0b] flex items-center justify-center">
    <div className="text-center max-w-md p-6">
      <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Strategy Builder Error</h2>
      <p className="text-white/60 text-sm mb-4">
        Something went wrong with the strategy builder. Your work has been saved locally.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
      >
        Reload Page
      </button>
    </div>
  </div>
);

// Main component wrapped with ReactFlowProvider and ErrorBoundary
export const StrategyFlowCanvas = () => {
  return (
    <ErrorBoundary fallback={<StrategyFlowErrorFallback />}>
      <div className="relative h-screen w-screen bg-background overflow-hidden">
        {/* Canvas fills entire background */}
        <div className="absolute inset-0">
          <ReactFlowProvider>
            <StrategyFlowCanvasInner />
          </ReactFlowProvider>
        </div>

        {/* Left Sidebar overlays canvas */}
        <div className="absolute left-0 top-0 h-full z-20">
          <LeftSidebar />
        </div>

        {/* Right Property Panel overlays canvas */}
        <div className="absolute right-0 top-0 h-full z-20">
          <RightPropertyPanel />
        </div>
      </div>
    </ErrorBoundary>
  );
};
