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
export { MathNode } from './MathNode';
export { RiskNode } from './RiskNode';
export { TradeInfoNode } from './TradeInfoNode';
export { LLMNode } from './LLMNode';
export { TriggerNode } from './TriggerNode';
export { IntegrationNode } from './IntegrationNode';

import { IndicatorNode } from './IndicatorNode';
import { ConditionNode } from './ConditionNode';
import { ActionNode } from './ActionNode';
import { EnvironmentNode } from './EnvironmentNode';
import { ControlNode } from './ControlNode';
import { VariableNode } from './VariableNode';
import { MathNode } from './MathNode';
import { RiskNode } from './RiskNode';
import { TradeInfoNode } from './TradeInfoNode';
import { LLMNode } from './LLMNode';
import { TriggerNode } from './TriggerNode';
import { IntegrationNode } from './IntegrationNode';

// Node type registry for ReactFlow
export const nodeTypes = {
  indicator: IndicatorNode,
  condition: ConditionNode,
  action: ActionNode,
  environment: EnvironmentNode,
  control: ControlNode,
  variable: VariableNode,
  math: MathNode,
  risk: RiskNode,
  tradeInfo: TradeInfoNode,
  llm: LLMNode,
  trigger: TriggerNode,
  integration: IntegrationNode,
};
