/**
 * StrategyFlowCanvas - Professional trading strategy builder
 * Layout: Icon rail + Left Panel | Canvas | Right Property Panel
 */

import { useCallback, useRef, useState, useEffect, useMemo, DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  SelectionMode,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
  useReactFlow,
  ReactFlowProvider,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from './nodes';
import { FloatingToolbar } from './FloatingToolbar';
import { LeftSidebar } from './LeftSidebar';
import { RightPropertyPanel } from './RightPropertyPanel';
import { ContextMenu } from './ContextMenu';
import { CodeViewPanel } from './CodeViewPanel';
import { AIChatPanel } from './AIChatPanel';
import { 
  BacktestModal, 
  SettingsModal, 
  TemplatesDialog, 
  SearchNodesDialog,
  ChartModal 
} from './modals';
import { useStrategyFlowStore } from '../store/strategyFlowStore';
import { NODE_CATALOG } from '../catalog/nodeCatalog';
import type { StrategyFlowNode, NodeCatalogItem } from '../types';

// Professional edge styling
const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: true,
  style: {
    stroke: 'hsl(var(--primary))',
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
    trigger: '#f59e0b',
    indicator: '#8b5cf6',
    condition: '#a855f7',
    action: '#10b981',
    risk: '#ef4444',
    utility: '#64748b',
  };
  return colors[node.type || ''] || '#6366f1';
};

// Inner component that uses ReactFlow hooks
const StrategyFlowCanvasInner = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  
  // Panel visibility states
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  
  // Modal states
  const [showBacktest, setShowBacktest] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showChart, setShowChart] = useState(false);
  
  const {
    nodes,
    edges,
    viewport,
    selectedNodeId,
    isPanMode,
    showGrid,
    isLocked,
    contextMenu,
    leftSidebarOpen,
    leftSidebarWidth,
    rightPanelOpen,
    rightPanelWidth,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    addNode,
    setViewport,
    hideContextMenu,
  } = useStrategyFlowStore();

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

    const nodeTypeData = event.dataTransfer.getData('application/reactflow');
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

  return (
    <div 
      ref={reactFlowWrapper}
      className="w-full h-full bg-gradient-to-br from-[#0f0f10] via-[#13131a] to-[#0f0f10]"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineStyle={connectionLineStyle}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange as OnEdgesChange}
        onConnect={onConnect as OnConnect}
        onSelectionChange={handleSelectionChange}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={handlePaneClick}
        onMoveEnd={(_, vp) => setViewport(vp)}
        defaultViewport={viewport}
        selectionMode={SelectionMode.Partial}
        panOnDrag={isPanMode ? true : [1, 2]}
        selectNodesOnDrag={!isPanMode}
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
        elementsSelectable={!isLocked}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={4}
        snapToGrid
        snapGrid={[16, 16]}
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
          style={{
            backgroundColor: 'rgba(15,15,16,0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
          }}
          className="!m-4"
        />

        {/* ========== FLOATING TOOLBAR ========== */}

        {/* Top Center: Floating Toolbar */}
        <Panel position="top-center" className="!m-0 !mt-4">
          <FloatingToolbar
            onOpenTemplates={() => setShowTemplates(true)}
            onOpenBacktest={() => setShowBacktest(true)}
            onOpenChart={() => setShowChart(true)}
            onOpenCode={() => setShowCodePanel(!showCodePanel)}
            onOpenAI={() => setShowAIPanel(!showAIPanel)}
            onOpenSettings={() => setShowSettings(true)}
            onZoomIn={() => zoomIn()}
            onZoomOut={() => zoomOut()}
            onFitView={() => fitView({ padding: 0.2 })}
            showCode={showCodePanel}
            showAI={showAIPanel}
          />
        </Panel>

        {/* Bottom Left: Keyboard hints */}
        <Panel position="bottom-left" className="!m-4">
          <div className="flex items-center gap-3 px-3 py-2 bg-card/80 backdrop-blur-sm border border-border/30 rounded-lg text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted/50 rounded font-mono">B</kbd>
              Sidebar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted/50 rounded font-mono">I</kbd>
              AI
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted/50 rounded font-mono">/</kbd>
              Search
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted/50 rounded font-mono">⌘D</kbd>
              Duplicate
            </span>
          </div>
        </Panel>
      </ReactFlow>

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

      {/* AI Chat Panel (floating right side) */}
      {showAIPanel && (
        <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-right-2 duration-200">
          <AIChatPanel open={showAIPanel} onOpenChange={setShowAIPanel} />
        </div>
      )}

      {/* Modals */}
      <BacktestModal open={showBacktest} onOpenChange={setShowBacktest} />
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
      <TemplatesDialog open={showTemplates} onOpenChange={setShowTemplates} />
      <SearchNodesDialog open={showSearch} onOpenChange={setShowSearch} />
      <ChartModal open={showChart} onOpenChange={setShowChart} />
    </div>
  );
};

// Main component wrapped with ReactFlowProvider
export const StrategyFlowCanvas = () => {
  return (
    <div className="relative h-screen w-screen bg-[#0a0a0b] overflow-hidden">
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
  );
};
