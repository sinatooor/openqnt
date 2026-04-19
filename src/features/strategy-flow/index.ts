/**
 * Strategy Flow Feature - Main exports
 * Complete ReactFlow-based strategy builder
 */

// Main Component
export { StrategyFlowCanvas } from './components/StrategyFlowCanvas';

// Sub-components
export { LeftSidebar } from './components/LeftSidebar';
export { RightPropertyPanel } from './components/RightPropertyPanel';
export { FloatingToolbar } from './components/FloatingToolbar';
export { BottomToolbar } from './components/BottomToolbar';
export { ContextMenu } from './components/ContextMenu';
export { CodeViewPanel } from './components/CodeViewPanel';
export { DevLogPanel, logStore } from './components/DevLogPanel';
export { AIChatPanel } from './components/AIChatPanel';

// Node Components
export { nodeTypes } from './components/nodes';
export { StrategyBaseNode } from './components/nodes/StrategyBaseNode';
export { IndicatorNode } from './components/nodes/IndicatorNode';
export { ConditionNode } from './components/nodes/ConditionNode';
export { ActionNode } from './components/nodes/ActionNode';
export { EnvironmentNode } from './components/nodes/EnvironmentNode';
export { ControlNode } from './components/nodes/ControlNode';
export { VariableNode } from './components/nodes/VariableNode';

// Modals
export { 
  BacktestModal, 
  SettingsModal, 
  TemplatesDialog, 
  SearchNodesDialog, 
  ChartModal,
  type BacktestConfig 
} from './components/modals';

// Code Generators
export {
  generatePythonCode,
  generateMQL5Code,
  generateNautilusCode,
  generateJSON,
} from './generators';

// Store
export { useStrategyFlowStore, selectSelectedNode, selectNodeById, selectNodesByType } from './store/strategyFlowStore';

// Catalog
export { 
  NODE_CATALOG,
  INDICATOR_NODES,
  CONDITION_NODES,
  ACTION_NODES,
  ENVIRONMENT_NODES,
  CONTROL_NODES,
  VARIABLE_NODES,
} from './catalog/nodeCatalog';

// Types
export type {
  StrategyFlowNode,
  StrategyFlowEdge,
  StrategyFlowNodeType,
  StrategyNodeData,
  IndicatorNodeData,
  ConditionNodeData,
  ActionNodeData,
  EnvironmentNodeData,
  ControlNodeData,
  VariableNodeData,
  HandleConfig,
  LeftSidebarTab,
} from './types';

