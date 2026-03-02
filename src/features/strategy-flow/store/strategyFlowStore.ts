/**
 * Strategy Flow Store - Zustand store for the ReactFlow-based strategy builder
 * 
 * PERFORMANCE NOTES:
 * - Use selectors to avoid unnecessary re-renders
 * - Import { useShallow } from 'zustand/react/shallow' for object destructuring
 * - Prefer individual selectors over destructuring multiple values
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
  NodeChange,
  EdgeChange,
  Viewport,
  MarkerType,
} from '@xyflow/react';
import {
  StrategyFlowNode,
  StrategyFlowEdge,
  StrategyNodeData,
  LeftSidebarTab,
  StrategyFlowNodeType,
  NodeCatalogItem,
} from '../types';
import { getHandleConfigs, repairEdges, getNodeSubType, validateEdgeHandles } from '../utils/handleUtils';

// =============================================================================
// EDGE COLOR MAPPING BY DATA TYPE
// =============================================================================

/**
 * Color palette for edge connections based on data type
 * These match the node handle colors for visual consistency
 */
export const EDGE_DATA_TYPE_COLORS: Record<string, string> = {
  number: '#8b5cf6',    // Purple mostly for Indicators/Values (matches SMA node)
  boolean: '#f59e0b',   // Amber for Boolean/Logic (matches Condition/Trigger)
  signal: '#06b6d4',    // Cyan for Execution Flow/Signals (matches Control flow)
  any: '#ec4899',       // Pink for Variables/Any
  default: '#64748b',   // Slate gray fallback
};

// Simple ID generator (no external dependency needed)
const generateId = () => Math.random().toString(36).substring(2, 8);

// =============================================================================
// CONNECTION VALIDATION
// =============================================================================

/**
 * Valid connection rules between node types
 * Key = source node type, Value = array of valid target node types
 */
const VALID_CONNECTIONS: Record<string, string[]> = {
  indicator: ['condition', 'action', 'variable', 'integration'],
  environment: ['condition', 'action', 'variable', 'integration'],
  condition: ['action', 'control', 'condition', 'integration'],
  action: ['action', 'control', 'integration'],
  control: ['action', 'control', 'condition', 'integration'],
  variable: ['condition', 'action', 'variable', 'control', 'integration'],
  math: ['condition', 'action', 'math', 'variable', 'integration'],
  risk: ['action', 'variable', 'integration'],
  tradeInfo: ['condition', 'action', 'math', 'integration'],
  llm: ['condition', 'action', 'variable', 'math', 'integration'],
  trigger: ['condition', 'action', 'control', 'integration', 'variable', 'llm'],
  integration: ['condition', 'action', 'control', 'integration', 'variable', 'llm'],
  pineScript: ['pineScript'],
};

/**
 * Validates if a connection between two nodes is allowed
 */
export const isValidConnection = (
  sourceNode: StrategyFlowNode | undefined,
  targetNode: StrategyFlowNode | undefined
): boolean => {
  if (!sourceNode || !targetNode) return false;
  if (sourceNode.id === targetNode.id) return false; // No self-connections

  const sourceType = sourceNode.type || '';
  const targetType = targetNode.type || '';

  const validTargets = VALID_CONNECTIONS[sourceType];
  if (!validTargets || !validTargets.includes(targetType)) return false;

  const sourceSubType = (sourceNode.data as Record<string, unknown>)?.indicatorType as string ||
    (sourceNode.data as Record<string, unknown>)?.conditionType as string ||
    (sourceNode.data as Record<string, unknown>)?.actionType as string ||
    (sourceNode.data as Record<string, unknown>)?.mathType as string ||
    (sourceNode.data as Record<string, unknown>)?.controlType as string ||
    (sourceNode.data as Record<string, unknown>)?.riskType as string ||
    (sourceNode.data as Record<string, unknown>)?.variableType as string ||
    (sourceNode.data as Record<string, unknown>)?.environmentType as string;

  const targetSubType = (targetNode.data as Record<string, unknown>)?.indicatorType as string ||
    (targetNode.data as Record<string, unknown>)?.conditionType as string ||
    (targetNode.data as Record<string, unknown>)?.actionType as string ||
    (targetNode.data as Record<string, unknown>)?.mathType as string ||
    (targetNode.data as Record<string, unknown>)?.controlType as string ||
    (targetNode.data as Record<string, unknown>)?.riskType as string ||
    (targetNode.data as Record<string, unknown>)?.variableType as string ||
    (targetNode.data as Record<string, unknown>)?.environmentType as string;

  const sourceHandles = getHandleConfigs(sourceType, sourceSubType);
  const targetHandles = getHandleConfigs(targetType, targetSubType);

  const sourceHandle = sourceHandles.find(h => h.type === 'source');
  const targetHandle = targetHandles.find(h => h.type === 'target');

  const sourceTypeData = sourceHandle?.dataType || 'any';
  const targetTypeData = targetHandle?.dataType || 'any';

  if (sourceTypeData === 'any' || targetTypeData === 'any') return true;
  if (sourceTypeData === targetTypeData) return true;
  if ((sourceTypeData === 'signal' && targetTypeData === 'boolean') ||
    (sourceTypeData === 'boolean' && targetTypeData === 'signal')) {
    return true;
  }
  return false;
};

/**
 * Validates the entire strategy for completeness
 */
export interface StrategyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const validateStrategy = (
  nodes: StrategyFlowNode[],
  edges: StrategyFlowEdge[]
): StrategyValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if there are any nodes
  if (nodes.length === 0) {
    errors.push('Strategy has no nodes. Add at least one indicator and one action.');
    return { isValid: false, errors, warnings };
  }

  // Check for required node types
  const hasIndicator = nodes.some(n => n.type === 'indicator' || n.type === 'environment');
  const hasAction = nodes.some(n => n.type === 'action');
  const hasCondition = nodes.some(n => n.type === 'condition');

  if (!hasIndicator) {
    errors.push('Strategy needs at least one indicator or environment node.');
  }

  if (!hasAction) {
    errors.push('Strategy needs at least one action node (e.g., Place Order).');
  }

  if (!hasCondition && nodes.length > 1) {
    warnings.push('Consider adding a condition node to define your entry/exit rules.');
  }

  // Check for disconnected nodes
  const connectedNodeIds = new Set<string>();
  edges.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  const disconnectedNodes = nodes.filter(n => !connectedNodeIds.has(n.id));
  if (disconnectedNodes.length > 0 && nodes.length > 1) {
    const labels = disconnectedNodes.map(n => n.data.label).join(', ');
    warnings.push(`Some nodes are not connected: ${labels}`);
  }

  // Check for action nodes without trigger
  const actionNodes = nodes.filter(n => n.type === 'action');
  actionNodes.forEach(action => {
    const hasIncomingEdge = edges.some(e => e.target === action.id);
    if (!hasIncomingEdge && nodes.length > 1) {
      warnings.push(`"${action.data.label}" action has no trigger connected to it.`);
    }
  });

  // Type checking
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return;

    const sourceSubType = (sourceNode.data as Record<string, unknown>)?.indicatorType as string ||
      (sourceNode.data as Record<string, unknown>)?.conditionType as string ||
      (sourceNode.data as Record<string, unknown>)?.actionType as string ||
      (sourceNode.data as Record<string, unknown>)?.mathType as string ||
      (sourceNode.data as Record<string, unknown>)?.controlType as string ||
      (sourceNode.data as Record<string, unknown>)?.riskType as string ||
      (sourceNode.data as Record<string, unknown>)?.variableType as string ||
      (sourceNode.data as Record<string, unknown>)?.environmentType as string;

    const targetSubType = (targetNode.data as Record<string, unknown>)?.indicatorType as string ||
      (targetNode.data as Record<string, unknown>)?.conditionType as string ||
      (targetNode.data as Record<string, unknown>)?.actionType as string ||
      (targetNode.data as Record<string, unknown>)?.mathType as string ||
      (targetNode.data as Record<string, unknown>)?.controlType as string ||
      (targetNode.data as Record<string, unknown>)?.riskType as string ||
      (targetNode.data as Record<string, unknown>)?.variableType as string ||
      (targetNode.data as Record<string, unknown>)?.environmentType as string;

    const sourceHandles = getHandleConfigs(sourceNode.type || '', sourceSubType);
    const targetHandles = getHandleConfigs(targetNode.type || '', targetSubType);
    const sourceHandle = sourceHandles.find(h => h.id === edge.sourceHandle) || sourceHandles.find(h => h.type === 'source');
    const targetHandle = targetHandles.find(h => h.id === edge.targetHandle) || targetHandles.find(h => h.type === 'target');

    const sourceType = sourceHandle?.dataType || 'any';
    const targetType = targetHandle?.dataType || 'any';

    const compatible = sourceType === 'any' || targetType === 'any' ||
      sourceType === targetType ||
      (sourceType === 'signal' && targetType === 'boolean') ||
      (sourceType === 'boolean' && targetType === 'signal');

    if (!compatible) {
      errors.push(`Type mismatch: ${sourceNode.data.label} (${sourceType}) → ${targetNode.data.label} (${targetType})`);
    }
  });

  // Cycle detection
  const adjacency = new Map<string, string[]>();
  nodes.forEach(n => adjacency.set(n.id, []));
  edges.forEach(e => {
    const list = adjacency.get(e.source) || [];
    list.push(e.target);
    adjacency.set(e.source, list);
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const hasCycle = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) || []) {
      if (hasCycle(next)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (hasCycle(node.id)) {
      errors.push('Cycle detected in strategy graph. Remove loops or enable allowCycles.');
      break;
    }
  }

  // Add edge handle validation warnings
  const handleWarnings = validateEdgeHandles(nodes, edges);
  warnings.push(...handleWarnings);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

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

  // Save Status
  lastSavedAt: number | null;
  isSaving: boolean;

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

  // Pine Script Mode
  pineScriptMode: boolean;
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

  // Direct setters for AI-generated nodes
  setNodes: (nodes: StrategyFlowNode[]) => void;
  setEdges: (edges: StrategyFlowEdge[]) => void;

  // Search
  setSearchQuery: (query: string) => void;

  // Pine Script Mode
  togglePineScriptMode: () => void;
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
  lastSavedAt: null,
  isSaving: false,
  isPanMode: false,
  showGrid: true,
  isLocked: false,
  history: [],
  historyIndex: -1,
  searchQuery: '',
  contextMenu: null,
  pineScriptMode: false,
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
          lastSavedAt: Date.now(),
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

        // Validate connection
        const sourceNode = get().nodes.find(n => n.id === connection.source);
        const targetNode = get().nodes.find(n => n.id === connection.target);

        if (!isValidConnection(sourceNode, targetNode)) {
          console.warn(`Invalid connection: ${sourceNode?.type} → ${targetNode?.type}`);
          return; // Silently reject invalid connections
        }

        // Validate handle type compatibility when possible
        if (sourceNode && targetNode) {
          const sourceSubType = (sourceNode.data as Record<string, unknown>)?.indicatorType as string ||
            (sourceNode.data as Record<string, unknown>)?.conditionType as string ||
            (sourceNode.data as Record<string, unknown>)?.actionType as string ||
            (sourceNode.data as Record<string, unknown>)?.mathType as string ||
            (sourceNode.data as Record<string, unknown>)?.controlType as string ||
            (sourceNode.data as Record<string, unknown>)?.riskType as string ||
            (sourceNode.data as Record<string, unknown>)?.variableType as string ||
            (sourceNode.data as Record<string, unknown>)?.environmentType as string;

          const targetSubType = (targetNode.data as Record<string, unknown>)?.indicatorType as string ||
            (targetNode.data as Record<string, unknown>)?.conditionType as string ||
            (targetNode.data as Record<string, unknown>)?.actionType as string ||
            (targetNode.data as Record<string, unknown>)?.mathType as string ||
            (targetNode.data as Record<string, unknown>)?.controlType as string ||
            (targetNode.data as Record<string, unknown>)?.riskType as string ||
            (targetNode.data as Record<string, unknown>)?.variableType as string ||
            (targetNode.data as Record<string, unknown>)?.environmentType as string;

          const sourceHandles = getHandleConfigs(sourceNode.type || '', sourceSubType);
          const targetHandles = getHandleConfigs(targetNode.type || '', targetSubType);
          const sourceHandle = sourceHandles.find(h => h.id === connection.sourceHandle) || sourceHandles.find(h => h.type === 'source');
          const targetHandle = targetHandles.find(h => h.id === connection.targetHandle) || targetHandles.find(h => h.type === 'target');

          const sourceType = sourceHandle?.dataType || 'any';
          const targetType = targetHandle?.dataType || 'any';
          const compatible = sourceType === 'any' || targetType === 'any' ||
            sourceType === targetType ||
            (sourceType === 'signal' && targetType === 'boolean') ||
            (sourceType === 'boolean' && targetType === 'signal');

          if (!compatible) {
            console.warn(`Type mismatch: ${sourceType} → ${targetType}`);
            return;
          }
        }

        // Determine edge color based on source handle's data type
        let edgeColor = '#ef4444'; // default to red to spot issues

        if (sourceNode) {
          const subType = (sourceNode.data as Record<string, unknown>)?.indicatorType as string ||
            (sourceNode.data as Record<string, unknown>)?.conditionType as string ||
            (sourceNode.data as Record<string, unknown>)?.actionType as string ||
            (sourceNode.data as Record<string, unknown>)?.mathType as string ||
            (sourceNode.data as Record<string, unknown>)?.controlType as string ||
            (sourceNode.data as Record<string, unknown>)?.riskType as string ||
            (sourceNode.data as Record<string, unknown>)?.variableType as string;

          const handleConfigs = getHandleConfigs(sourceNode.type || '', subType);
          const sourceHandle = handleConfigs.find(
            h => h.id === connection.sourceHandle || (h.type === 'source' && !connection.sourceHandle)
          );

          if (sourceHandle?.dataType) {
            edgeColor = EDGE_DATA_TYPE_COLORS[sourceHandle.dataType] || edgeColor;
          }
        }

        get().saveToHistory();

        // Auto-populate handles if not provided
        let finalSourceHandle = connection.sourceHandle ?? undefined;
        let finalTargetHandle = connection.targetHandle ?? undefined;

        // Auto-fill sourceHandle if missing
        if (!finalSourceHandle && sourceNode) {
          const sourceSubType = getNodeSubType(sourceNode);
          const handles = getHandleConfigs(sourceNode.type || '', sourceSubType);
          const sourceOutputs = handles.filter(h => h.type === 'source');
          if (sourceOutputs.length === 1) {
            finalSourceHandle = sourceOutputs[0].id;
          } else if (sourceOutputs.length > 1) {
            // Prefer 'output' or 'value' as default
            const defaultHandle = sourceOutputs.find(h => h.id === 'output' || h.id === 'value');
            finalSourceHandle = defaultHandle?.id || sourceOutputs[0].id;
          }
        }

        // Auto-fill targetHandle if missing
        if (!finalTargetHandle && targetNode) {
          const targetSubType = getNodeSubType(targetNode);
          const handles = getHandleConfigs(targetNode.type || '', targetSubType);
          const targetInputs = handles.filter(h => h.type === 'target');
          if (targetInputs.length === 1) {
            finalTargetHandle = targetInputs[0].id;
          } else if (targetInputs.length > 1) {
            // Check which handles are already used
            const existingEdges = get().edges.filter(e => e.target === connection.target);
            const usedHandles = existingEdges.map(e => e.targetHandle).filter(Boolean);
            const availableHandle = targetInputs.find(h => !usedHandles.includes(h.id));
            if (availableHandle) {
              finalTargetHandle = availableHandle.id;
            } else {
              // Fallback: use 'trigger' for actions, 'input-a' for conditions
              const triggerHandle = targetInputs.find(h => h.id === 'trigger');
              const inputAHandle = targetInputs.find(h => h.id === 'input-a');
              finalTargetHandle = triggerHandle?.id || inputAHandle?.id || targetInputs[0].id;
            }
          }
        }

        const newEdge: StrategyFlowEdge = {
          id: `edge-${generateId()}`,
          source: connection.source,
          target: connection.target,
          sourceHandle: finalSourceHandle,
          targetHandle: finalTargetHandle,
          type: 'bezier',
          animated: false,
          style: {
            stroke: edgeColor,
            strokeWidth: 2,
          },
        };

        set({
          edges: addEdge(newEdge, get().edges),
          isModified: true,
          lastSavedAt: Date.now(), // Auto-save to localStorage
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
          const nodes: StrategyFlowNode[] = data.nodes || [];
          // Repair edges to ensure all sourceHandle/targetHandle are populated
          const repairedEdges = repairEdges(nodes, data.edges || []);

          get().saveToHistory();
          set({
            nodes,
            edges: repairedEdges,
            strategyName: data.name || 'Imported Strategy',
            strategyDescription: data.description || '',
            isModified: true,
          });

          console.log(`Imported strategy with ${nodes.length} nodes and ${repairedEdges.length} edges (repaired)`);
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
      // DIRECT SETTERS FOR AI-GENERATED NODES
      // =========================================================================

      setNodes: (nodes) => {
        get().saveToHistory();
        set({
          nodes,
          isModified: true,
        });
      },

      setEdges: (edges) => {
        get().saveToHistory();
        // Repair edges to ensure all sourceHandle/targetHandle are populated
        const nodes = get().nodes;
        const repairedEdges = repairEdges(nodes, edges);
        set({
          edges: repairedEdges,
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

      // =========================================================================
      // PINE SCRIPT MODE
      // =========================================================================

      togglePineScriptMode: () => {
        const current = get().pineScriptMode;
        // Clear canvas when switching modes to avoid mixing node types
        if (!current) {
          // Switching TO Pine Script mode
          get().saveToHistory();
          set({
            pineScriptMode: true,
            nodes: [],
            edges: [],
            selectedNodeId: null,
            rightPanelOpen: false,
            isModified: true,
          });
        } else {
          // Switching back to normal mode
          get().saveToHistory();
          set({
            pineScriptMode: false,
            nodes: [],
            edges: [],
            selectedNodeId: null,
            rightPanelOpen: false,
            isModified: true,
          });
        }
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
        pineScriptMode: state.pineScriptMode,
      }),
    }
  )
);

// =============================================================================
// SELECTORS - Use these for performance optimization
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

// =============================================================================
// HOOKS WITH SHALLOW COMPARISON - For better performance
// =============================================================================

/**
 * Use this hook when you need multiple store values with shallow comparison
 * This prevents re-renders when other parts of the store change
 * 
 * Example:
 * const { nodes, edges } = useStrategyFlowStoreShallow(state => ({
 *   nodes: state.nodes,
 *   edges: state.edges
 * }));
 */
export const useStrategyFlowStoreShallow = <T>(selector: (state: StrategyFlowState & StrategyFlowActions) => T): T => {
  return useStrategyFlowStore(useShallow(selector));
};

// Individual action selectors (stable references)
export const selectAddNode = (state: StrategyFlowState & StrategyFlowActions) => state.addNode;
export const selectDeleteNode = (state: StrategyFlowState & StrategyFlowActions) => state.deleteNode;
export const selectDuplicateNode = (state: StrategyFlowState & StrategyFlowActions) => state.duplicateNode;
export const selectLockNode = (state: StrategyFlowState & StrategyFlowActions) => state.lockNode;
export const selectSelectNode = (state: StrategyFlowState & StrategyFlowActions) => state.selectNode;
export const selectUpdateNodeData = (state: StrategyFlowState & StrategyFlowActions) => state.updateNodeData;
export const selectOnNodesChange = (state: StrategyFlowState & StrategyFlowActions) => state.onNodesChange;
export const selectOnEdgesChange = (state: StrategyFlowState & StrategyFlowActions) => state.onEdgesChange;
export const selectOnConnect = (state: StrategyFlowState & StrategyFlowActions) => state.onConnect;
