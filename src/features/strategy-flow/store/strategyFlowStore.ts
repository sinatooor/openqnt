/**
 * Strategy Flow Store - Zustand store for the ReactFlow-based strategy builder
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
  NodeChange,
  EdgeChange,
  Viewport,
} from '@xyflow/react';
import {
  StrategyFlowNode,
  StrategyFlowEdge,
  StrategyNodeData,
  LeftSidebarTab,
  StrategyFlowNodeType,
  NodeCatalogItem,
} from '../types';
import { NODE_CATALOG } from '../catalog/nodeCatalog';

// Simple ID generator (no external dependency needed)
const generateId = () => Math.random().toString(36).substring(2, 8);

// =============================================================================
// STORE STATE INTERFACE
// =============================================================================

interface StrategyFlowState {
  // Canvas State
  nodes: StrategyFlowNode[];
  edges: StrategyFlowEdge[];
  viewport: Viewport;
  
  // Selection
  selectedNodeId: string | null;
  editingNodeId: string | null;
  
  // Sidebar State
  leftSidebarOpen: boolean;
  leftSidebarTab: LeftSidebarTab;
  leftSidebarWidth: number;
  rightPanelOpen: boolean;
  rightPanelWidth: number;
  
  // Strategy Metadata
  strategyName: string;
  strategyDescription: string;
  isModified: boolean;
  
  // Execution State
  isRunning: boolean;
  
  // Canvas Controls
  isPanMode: boolean;
  showGrid: boolean;
  isLocked: boolean;
  
  // History (for undo/redo)
  history: Array<{ nodes: StrategyFlowNode[]; edges: StrategyFlowEdge[] }>;
  historyIndex: number;
  
  // Search
  searchQuery: string;
  
  // Context Menu
  contextMenu: { x: number; y: number; nodeId: string } | null;
}

// =============================================================================
// STORE ACTIONS INTERFACE
// =============================================================================

interface StrategyFlowActions {
  // Node Operations
  onNodesChange: (changes: NodeChange<StrategyFlowNode>[]) => void;
  addNode: (catalogItem: NodeCatalogItem, position: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: Partial<StrategyNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  lockNode: (nodeId: string, locked: boolean) => void;
  
  // Edge Operations
  onEdgesChange: (changes: EdgeChange<StrategyFlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  deleteEdge: (edgeId: string) => void;
  
  // Selection
  selectNode: (nodeId: string | null) => void;
  
  // Viewport
  setViewport: (viewport: Viewport) => void;
  
  // Sidebar
  setLeftSidebarOpen: (open: boolean) => void;
  setLeftSidebarTab: (tab: LeftSidebarTab) => void;
  setLeftSidebarWidth: (width: number) => void;
  setRightPanelOpen: (open: boolean) => void;
  setRightPanelWidth: (width: number) => void;
  
  // Strategy Metadata
  setStrategyName: (name: string) => void;
  setStrategyDescription: (description: string) => void;
  
  // Execution
  setIsRunning: (running: boolean) => void;
  
  // Canvas Controls
  togglePanMode: () => void;
  toggleGrid: () => void;
  toggleLock: () => void;
  
  // Node Editing
  setEditingNodeId: (nodeId: string | null) => void;
  
  // Context Menu
  showContextMenu: (x: number, y: number, nodeId: string) => void;
  hideContextMenu: () => void;
  
  // History
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  // Import/Export
  exportStrategy: () => string;
  importStrategy: (json: string) => void;
  clearCanvas: () => void;
  
  // Search
  setSearchQuery: (query: string) => void;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: StrategyFlowState = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeId: null,
  editingNodeId: null,
  leftSidebarOpen: true,
  leftSidebarTab: 'nodes',
  leftSidebarWidth: 280,
  rightPanelOpen: false,
  rightPanelWidth: 320,
  strategyName: 'Untitled Strategy',
  strategyDescription: '',
  isModified: false,
  isRunning: false,
  isPanMode: false,
  showGrid: true,
  isLocked: false,
  history: [],
  historyIndex: -1,
  searchQuery: '',
  contextMenu: null,
};

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

export const useStrategyFlowStore = create<StrategyFlowState & StrategyFlowActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // =========================================================================
      // NODE OPERATIONS
      // =========================================================================

      onNodesChange: (changes) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes),
          isModified: true,
        });
      },

      addNode: (catalogItem, position) => {
        const newNode: StrategyFlowNode = {
          id: `${catalogItem.type}-${generateId()}`,
          type: catalogItem.nodeType,
          position,
          data: {
            label: catalogItem.label,
            description: catalogItem.description,
            ...catalogItem.defaultData,
          } as StrategyNodeData,
        };

        get().saveToHistory();
        set({
          nodes: [...get().nodes, newNode],
          isModified: true,
        });
      },

      updateNodeData: (nodeId, data) => {
        set({
          nodes: get().nodes.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, ...data } as StrategyNodeData }
              : node
          ) as StrategyFlowNode[],
          isModified: true,
        });
      },

      deleteNode: (nodeId) => {
        get().saveToHistory();
        set({
          nodes: get().nodes.filter((node) => node.id !== nodeId),
          edges: get().edges.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId
          ),
          selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
          rightPanelOpen: get().selectedNodeId === nodeId ? false : get().rightPanelOpen,
          isModified: true,
        });
      },

      duplicateNode: (nodeId) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        if (!node) return;

        get().saveToHistory();
        const newNode: StrategyFlowNode = {
          ...node,
          id: `${node.type}-${generateId()}`,
          position: {
            x: node.position.x + 50,
            y: node.position.y + 50,
          },
          data: { ...node.data },
        };

        set({
          nodes: [...get().nodes, newNode],
          isModified: true,
        });
      },

      lockNode: (nodeId, locked) => {
        set({
          nodes: get().nodes.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, locked } }
              : node
          ),
        });
      },

      // =========================================================================
      // EDGE OPERATIONS
      // =========================================================================

      onEdgesChange: (changes) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
          isModified: true,
        });
      },

      onConnect: (connection) => {
        if (!connection.source || !connection.target) return;
        
        get().saveToHistory();
        const newEdge: StrategyFlowEdge = {
          id: `edge-${generateId()}`,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
          type: 'smoothstep',
          animated: true,
        };

        set({
          edges: addEdge(newEdge, get().edges),
          isModified: true,
        });
      },

      deleteEdge: (edgeId) => {
        get().saveToHistory();
        set({
          edges: get().edges.filter((edge) => edge.id !== edgeId),
          isModified: true,
        });
      },

      // =========================================================================
      // SELECTION
      // =========================================================================

      selectNode: (nodeId) => {
        set({
          selectedNodeId: nodeId,
          rightPanelOpen: nodeId !== null,
        });
      },

      // =========================================================================
      // VIEWPORT
      // =========================================================================

      setViewport: (viewport) => {
        set({ viewport });
      },

      // =========================================================================
      // SIDEBAR
      // =========================================================================

      setLeftSidebarOpen: (open) => {
        set({ leftSidebarOpen: open });
      },

      setLeftSidebarTab: (tab) => {
        set({ leftSidebarTab: tab });
      },

      setLeftSidebarWidth: (width) => {
        set({ leftSidebarWidth: width });
      },

      setRightPanelOpen: (open) => {
        set({ 
          rightPanelOpen: open,
          selectedNodeId: open ? get().selectedNodeId : null,
        });
      },

      setRightPanelWidth: (width) => {
        set({ rightPanelWidth: width });
      },

      // =========================================================================
      // STRATEGY METADATA
      // =========================================================================

      setStrategyName: (name) => {
        set({ strategyName: name, isModified: true });
      },

      setStrategyDescription: (description) => {
        set({ strategyDescription: description, isModified: true });
      },

      // =========================================================================
      // EXECUTION
      // =========================================================================

      setIsRunning: (running) => {
        set({ isRunning: running });
      },

      // =========================================================================
      // HISTORY (UNDO/REDO)
      // =========================================================================

      saveToHistory: () => {
        const { nodes, edges, history, historyIndex } = get();
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ nodes: [...nodes], edges: [...edges] });
        
        // Limit history to 50 entries
        if (newHistory.length > 50) {
          newHistory.shift();
        }

        set({
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },

      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex <= 0) return;

        const prevState = history[historyIndex - 1];
        set({
          nodes: prevState.nodes,
          edges: prevState.edges,
          historyIndex: historyIndex - 1,
          isModified: true,
        });
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;

        const nextState = history[historyIndex + 1];
        set({
          nodes: nextState.nodes,
          edges: nextState.edges,
          historyIndex: historyIndex + 1,
          isModified: true,
        });
      },

      canUndo: () => {
        return get().historyIndex > 0;
      },

      canRedo: () => {
        const { history, historyIndex } = get();
        return historyIndex < history.length - 1;
      },

      // =========================================================================
      // IMPORT/EXPORT
      // =========================================================================

      exportStrategy: () => {
        const { nodes, edges, strategyName, strategyDescription } = get();
        return JSON.stringify({
          version: '1.0',
          name: strategyName,
          description: strategyDescription,
          nodes,
          edges,
          exportedAt: new Date().toISOString(),
        }, null, 2);
      },

      importStrategy: (json) => {
        try {
          const data = JSON.parse(json);
          get().saveToHistory();
          set({
            nodes: data.nodes || [],
            edges: data.edges || [],
            strategyName: data.name || 'Imported Strategy',
            strategyDescription: data.description || '',
            isModified: true,
          });
        } catch (error) {
          console.error('Failed to import strategy:', error);
          throw new Error('Invalid strategy file');
        }
      },

      clearCanvas: () => {
        get().saveToHistory();
        set({
          nodes: [],
          edges: [],
          selectedNodeId: null,
          rightPanelOpen: false,
          isModified: true,
        });
      },

      // =========================================================================
      // SEARCH
      // =========================================================================

      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      // =========================================================================
      // CANVAS CONTROLS
      // =========================================================================

      togglePanMode: () => {
        set({ isPanMode: !get().isPanMode });
      },

      toggleGrid: () => {
        set({ showGrid: !get().showGrid });
      },

      toggleLock: () => {
        set({ isLocked: !get().isLocked });
      },

      // =========================================================================
      // NODE EDITING
      // =========================================================================

      setEditingNodeId: (nodeId) => {
        set({ editingNodeId: nodeId });
      },

      // =========================================================================
      // CONTEXT MENU
      // =========================================================================

      showContextMenu: (x, y, nodeId) => {
        set({ contextMenu: { x, y, nodeId } });
      },

      hideContextMenu: () => {
        set({ contextMenu: null });
      },
    }),
    {
      name: 'strategy-flow-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        viewport: state.viewport,
        strategyName: state.strategyName,
        strategyDescription: state.strategyDescription,
        leftSidebarWidth: state.leftSidebarWidth,
        rightPanelWidth: state.rightPanelWidth,
      }),
    }
  )
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectSelectedNode = (state: StrategyFlowState & StrategyFlowActions) => {
  return state.nodes.find((node) => node.id === state.selectedNodeId);
};

export const selectNodeById = (nodeId: string) => (state: StrategyFlowState & StrategyFlowActions) => {
  return state.nodes.find((node) => node.id === nodeId);
};

export const selectNodesByType = (nodeType: StrategyFlowNodeType) => (state: StrategyFlowState & StrategyFlowActions) => {
  return state.nodes.filter((node) => node.type === nodeType);
};
