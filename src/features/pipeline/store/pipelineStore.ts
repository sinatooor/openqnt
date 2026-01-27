/**
 * Pipeline Store - Zustand state management for the workflow canvas
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  addEdge, 
  applyNodeChanges, 
  applyEdgeChanges,
  Connection,
  NodeChange,
  EdgeChange,
  Viewport
} from '@xyflow/react';
import { 
  PipelineNode, 
  PipelineEdge, 
  StrategyNodeData, 
  ExecutionNodeData, 
  PromptNodeData,
  BacktestNodeData,
  DataSourceNodeData,
  NotificationNodeData,
  NodeData,
} from '../types';

interface PipelineStore {
  // State
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  selectedNodeId: string | null;
  pipelineName: string;
  isRunning: boolean;
  viewport: Viewport;
  
  // Node/Edge Actions
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  
  // Add Node Actions
  addStrategyNode: (position: { x: number; y: number }) => string;
  addExecutionNode: (position: { x: number; y: number }) => string;
  addPromptNode: (position: { x: number; y: number }) => string;
  addBacktestNode: (position: { x: number; y: number }) => string;
  addDataSourceNode: (position: { x: number; y: number }) => string;
  addNotificationNode: (position: { x: number; y: number }) => string;
  
  // Node Management
  updateNodeData: <T extends NodeData>(nodeId: string, data: Partial<T>) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  setSelectedNode: (nodeId: string | null) => void;
  
  // Viewport
  setViewport: (viewport: Viewport) => void;
  
  // Pipeline Actions
  setPipelineName: (name: string) => void;
  setIsRunning: (running: boolean) => void;
  
  // Serialization
  exportPipeline: () => string;
  importPipeline: (json: string) => void;
  clearPipeline: () => void;
  
  // Get connected nodes
  getConnectedNodes: (nodeId: string, direction: 'input' | 'output') => PipelineNode[];
}

let nodeIdCounter = Date.now();
const getNodeId = () => `node_${nodeIdCounter++}`;

export const usePipelineStore = create<PipelineStore>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      pipelineName: 'Untitled Pipeline',
      isRunning: false,
      viewport: { x: 0, y: 0, zoom: 1 },

      onNodesChange: (changes) => {
        const updatedNodes = applyNodeChanges(changes, get().nodes as any);

        set({ nodes: updatedNodes as PipelineNode[] });
      },

      onEdgesChange: (changes) => {
        const updatedEdges = applyEdgeChanges(changes, get().edges as any);
        set({ edges: updatedEdges as PipelineEdge[] });
      },

      onConnect: (connection) => {
        const newEdge: PipelineEdge = {
          ...connection,
          id: `edge_${Date.now()}`,
          animated: true,
          style: { stroke: '#a855f7', strokeWidth: 2 },
        };
        set({ edges: addEdge(newEdge, get().edges as any) as PipelineEdge[] });
      },

      addStrategyNode: (position) => {
        const id = getNodeId();
        const newNode: PipelineNode = {
          id,
          type: 'strategy',
          position,
          data: {
            label: 'Strategy',
            strategyName: 'New Strategy',
            signalType: 'both',
            isActive: true,
          } as StrategyNodeData,
        };
        set({ nodes: [...get().nodes, newNode] });
        return id;
      },

      addExecutionNode: (position) => {
        const id = getNodeId();
        const newNode: PipelineNode = {
          id,
          type: 'execution',
          position,
          data: {
            label: 'Execute Trade',
            broker: 'paper',
            symbol: 'EURUSD',
            orderType: 'market',
            positionSize: 0.1,
            positionSizeType: 'fixed',
            leverage: 1,
            isLive: false,
          } as ExecutionNodeData,
        };
        set({ nodes: [...get().nodes, newNode] });
        return id;
      },

      addPromptNode: (position) => {
        const id = getNodeId();
        const newNode: PipelineNode = {
          id,
          type: 'prompt',
          position,
          data: {
            label: 'AI Prompt',
            promptTemplate: 'Analyze the market conditions for {symbol} and provide a trading recommendation...',
            model: 'gpt-4o',
            outputType: 'signal',
          } as PromptNodeData,
        };
        set({ nodes: [...get().nodes, newNode] });
        return id;
      },

      addBacktestNode: (position) => {
        const id = getNodeId();
        const newNode: PipelineNode = {
          id,
          type: 'backtest',
          position,
          data: {
            label: 'Backtest',
            symbol: 'EURUSD',
            timeframe: '1h',
            startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            initialCapital: 10000,
          } as BacktestNodeData,
        };
        set({ nodes: [...get().nodes, newNode] });
        return id;
      },

      addDataSourceNode: (position) => {
        const id = getNodeId();
        const newNode: PipelineNode = {
          id,
          type: 'dataSource',
          position,
          data: {
            label: 'Market Data',
            symbol: 'EURUSD',
            timeframe: '1h',
            source: 'yahoo',
            dataType: 'ohlcv',
            isConnected: false,
            isStreaming: false,
          } as DataSourceNodeData,
        };
        set({ nodes: [...get().nodes, newNode] });
        return id;
      },

      addNotificationNode: (position) => {
        const id = getNodeId();
        const newNode: PipelineNode = {
          id,
          type: 'notification',
          position,
          data: {
            label: 'Alert',
            channels: ['browser'],
            messageTemplate: 'Trade signal received: {{signal}}',
            isActive: true,
          } as NotificationNodeData,
        };
        set({ nodes: [...get().nodes, newNode] });
        return id;
      },

      updateNodeData: (nodeId, data) => {
        set({
          nodes: get().nodes.map((node) =>
            node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
          ),
        });
      },

      deleteNode: (nodeId) => {
        set({
          nodes: get().nodes.filter((node) => node.id !== nodeId),
          edges: get().edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
          selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
        });
      },

      duplicateNode: (nodeId) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        if (!node) return;
        
        const newNode: PipelineNode = {
          ...node,
          id: getNodeId(),
          position: { x: node.position.x + 50, y: node.position.y + 50 },
          data: { ...node.data, label: `${node.data.label} (copy)` },
        };
        set({ nodes: [...get().nodes, newNode] });
      },

      setSelectedNode: (nodeId) => {
        set({ selectedNodeId: nodeId });
      },

      setViewport: (viewport) => {
        set({ viewport });
      },

      setPipelineName: (name) => {
        set({ pipelineName: name });
      },

      setIsRunning: (running) => {
        set({ isRunning: running });
      },

      exportPipeline: () => {
        const { nodes, edges, pipelineName } = get();
        return JSON.stringify({ nodes, edges, pipelineName }, null, 2);
      },

      importPipeline: (json) => {
        try {
          const { nodes, edges, pipelineName } = JSON.parse(json);
          set({ nodes, edges, pipelineName: pipelineName || 'Imported Pipeline' });
        } catch (e) {
          console.error('Failed to import pipeline:', e);
        }
      },

      clearPipeline: () => {
        set({ nodes: [], edges: [], selectedNodeId: null, pipelineName: 'Untitled Pipeline' });
      },

      getConnectedNodes: (nodeId, direction) => {
        const { nodes, edges } = get();
        const connectedIds = edges
          .filter((e) => direction === 'input' ? e.target === nodeId : e.source === nodeId)
          .map((e) => direction === 'input' ? e.source : e.target);
        return nodes.filter((n) => connectedIds.includes(n.id));
      },
    }),
    {
      name: 'pipeline-storage',
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        pipelineName: state.pipelineName,
        viewport: state.viewport,
      }),
    }
  )
);
