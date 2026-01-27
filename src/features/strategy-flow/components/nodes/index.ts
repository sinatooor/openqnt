/**
 * Node component exports
 */

export { StrategyBaseNode } from './StrategyBaseNode';
export { IndicatorNode } from './IndicatorNode';
export { ConditionNode } from './ConditionNode';
export { ActionNode } from './ActionNode';
export { EnvironmentNode } from './EnvironmentNode';
export { ControlNode } from './ControlNode';
export { VariableNode } from './VariableNode';

import { IndicatorNode } from './IndicatorNode';
import { ConditionNode } from './ConditionNode';
import { ActionNode } from './ActionNode';
import { EnvironmentNode } from './EnvironmentNode';
import { ControlNode } from './ControlNode';
import { VariableNode } from './VariableNode';

// Node type registry for ReactFlow
export const nodeTypes = {
  indicator: IndicatorNode,
  condition: ConditionNode,
  action: ActionNode,
  environment: EnvironmentNode,
  control: ControlNode,
  variable: VariableNode,
};
