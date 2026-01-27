/**
 * PipelineCanvas - Main ReactFlow canvas with all node types
 * Handles drag-drop, connections, and pipeline visualization
 */

import { useCallback, useRef, DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  Connection,
  NodeTypes,
  ReactFlowProvider,
  Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { usePipelineStore } from '../store/pipelineStore';
import { PipelineNodeType } from '../types';
import { PipelineToolbar } from './PipelineToolbar';
import { PipelineNodePalette } from './PipelineNodePalette';

// Import all node components
import { StrategyNode } from './nodes/StrategyNode';
import { ExecutionNode } from './nodes/ExecutionNode';
import { PromptNode } from './nodes/PromptNode';
import { BacktestNode } from './nodes/BacktestNode';
import { DataSourceNode } from './nodes/DataSourceNode';
import { NotificationNode } from './nodes/NotificationNode';

// Register node types
const nodeTypes: NodeTypes = {
  strategy: StrategyNode,
  execution: ExecutionNode,
  prompt: PromptNode,
  backtest: BacktestNode,
  dataSource: DataSourceNode,
  notification: NotificationNode,
};

// Custom edge styles
const defaultEdgeOptions = {
  style: { strokeWidth: 2, stroke: '#6366f1' },
  type: 'smoothstep',
  animated: true,
};

function PipelineCanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, zoomIn, zoomOut, fitView, setViewport: setReactFlowViewport } = useReactFlow();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addStrategyNode,
    addExecutionNode,
    addPromptNode,
    addBacktestNode,
    addDataSourceNode,
    addNotificationNode,
    viewport,
    setViewport,
  } = usePipelineStore();

  // Handle viewport changes and persist them
  const handleViewportChange = useCallback((newViewport: Viewport) => {
    setViewport(newViewport);
  }, [setViewport]);

  // Handle drag over for node drop
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle node drop from toolbar
  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as PipelineNodeType;
      if (!type) return;

      // Get drop position in flow coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Add the appropriate node type
      switch (type) {
        case 'strategy':
          addStrategyNode(position);
          break;
        case 'execution':
          addExecutionNode(position);
          break;
        case 'prompt':
          addPromptNode(position);
          break;
        case 'backtest':
          addBacktestNode(position);
          break;
        case 'dataSource':
          addDataSourceNode(position);
          break;
        case 'notification':
          addNotificationNode(position);
          break;
      }
    },
    [screenToFlowPosition, addStrategyNode, addExecutionNode, addPromptNode, addBacktestNode, addDataSourceNode, addNotificationNode]
  );

  // Validate connections
  const isValidConnection = useCallback((connection: Connection) => {
    // Can't connect to self
    if (connection.source === connection.target) return false;
    
    // Could add more validation here:
    // - Prevent cycles
    // - Validate compatible handle types
    // - Limit connections per handle
    
    return true;
  }, []);

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        isValidConnection={isValidConnection}
        defaultViewport={viewport}
        onViewportChange={handleViewportChange}
        snapToGrid
        snapGrid={[15, 15]}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={['Shift', 'Meta']}
        panOnScroll
        zoomOnScroll
        className="pipeline-canvas"
      >
        {/* Background Grid */}
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1} 
          color="hsl(var(--muted-foreground) / 0.2)"
        />

        {/* Minimap */}
        <MiniMap
          nodeStrokeColor={(n) => {
            switch (n.type) {
              case 'strategy': return '#8b5cf6';
              case 'execution': return '#10b981';
              case 'prompt': return '#f59e0b';
              case 'backtest': return '#06b6d4';
              case 'dataSource': return '#6366f1';
              case 'notification': return '#ec4899';
              default: return '#64748b';
            }
          }}
          nodeColor={(n) => {
            switch (n.type) {
              case 'strategy': return '#8b5cf620';
              case 'execution': return '#10b98120';
              case 'prompt': return '#f59e0b20';
              case 'backtest': return '#06b6d420';
              case 'dataSource': return '#6366f120';
              case 'notification': return '#ec489920';
              default: return '#64748b20';
            }
          }}
          className="bg-card/80 border rounded-lg"
          maskColor="hsl(var(--background) / 0.8)"
        />

        {/* Controls */}
        <Controls 
          showZoom={false}
          showFitView={false}
          showInteractive={false}
          className="bg-card border rounded-lg"
        />

        {/* Toolbar Panel - Top Center */}
        <Panel position="top-center" className="m-2">
          <PipelineToolbar
            onZoomIn={() => zoomIn()}
            onZoomOut={() => zoomOut()}
            onFitView={() => fitView({ padding: 0.2 })}
          />
        </Panel>

        {/* Node Palette - Left Side */}
        <Panel position="top-left" className="mt-14 ml-2">
          <PipelineNodePalette />
        </Panel>

        {/* Help Panel */}
        <Panel position="bottom-left" className="m-2">
          <div className="px-3 py-2 bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg text-[10px] text-muted-foreground space-y-0.5">
            <div><kbd className="px-1.5 py-0.5 bg-muted/80 rounded text-[9px] font-mono">Drag</kbd> nodes from toolbar</div>
            <div><kbd className="px-1.5 py-0.5 bg-muted/80 rounded text-[9px] font-mono">Connect</kbd> handles to create edges</div>
            <div><kbd className="px-1.5 py-0.5 bg-muted/80 rounded text-[9px] font-mono">Del</kbd> to remove selected</div>
            <div><kbd className="px-1.5 py-0.5 bg-muted/80 rounded text-[9px] font-mono">Scroll</kbd> to zoom</div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

// Wrap with ReactFlowProvider
export function PipelineCanvas() {
  return (
    <ReactFlowProvider>
      <PipelineCanvasInner />
    </ReactFlowProvider>
  );
}
