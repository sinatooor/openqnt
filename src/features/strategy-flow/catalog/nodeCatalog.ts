/**
 * Node Catalog Index - Re-exports all node categories
 */

export { INDICATOR_NODES } from './nodes/indicatorNodes';
export { CONDITION_NODES } from './nodes/conditionNodes';
export { ACTION_NODES } from './nodes/actionNodes';
export { ENVIRONMENT_NODES } from './nodes/environmentNodes';
export { CONTROL_NODES } from './nodes/controlNodes';
export { VARIABLE_NODES } from './nodes/variableNodes';
export { MATH_NODES } from './nodes/mathNodes';
export { RISK_NODES } from './nodes/riskNodes';
export { TRADE_INFO_NODES } from './nodes/tradeInfoNodes';
export { LLM_NODES } from './nodes/llmNodes';
export { TRIGGER_NODES } from './nodes/triggerNodes';
export { INTEGRATION_NODES } from './nodes/integrationNodes';
export { PINE_SCRIPT_NODES } from './nodes/pineScriptNodes';
export { PORTFOLIO_NODES } from './nodes/portfolioNodes';
export { AGENT_NODES } from './nodes/agentNodes';

import { INDICATOR_NODES } from './nodes/indicatorNodes';
import { CONDITION_NODES } from './nodes/conditionNodes';
import { ACTION_NODES } from './nodes/actionNodes';
import { ENVIRONMENT_NODES } from './nodes/environmentNodes';
import { CONTROL_NODES } from './nodes/controlNodes';
import { VARIABLE_NODES } from './nodes/variableNodes';
import { MATH_NODES } from './nodes/mathNodes';
import { RISK_NODES } from './nodes/riskNodes';
import { TRADE_INFO_NODES } from './nodes/tradeInfoNodes';
import { LLM_NODES } from './nodes/llmNodes';
import { TRIGGER_NODES } from './nodes/triggerNodes';
import { INTEGRATION_NODES } from './nodes/integrationNodes';
import { PINE_SCRIPT_NODES } from './nodes/pineScriptNodes';
import { PORTFOLIO_NODES } from './nodes/portfolioNodes';
import { AGENT_NODES } from './nodes/agentNodes';
import { NodeCatalogItem } from '../types';

// Complete catalog of all nodes (15 categories)
export const NODE_CATALOG: NodeCatalogItem[] = [
  ...TRIGGER_NODES,
  ...INTEGRATION_NODES,
  ...INDICATOR_NODES,
  ...CONDITION_NODES,
  ...ACTION_NODES,
  ...ENVIRONMENT_NODES,
  ...CONTROL_NODES,
  ...VARIABLE_NODES,
  ...MATH_NODES,
  ...RISK_NODES,
  ...TRADE_INFO_NODES,
  ...LLM_NODES,
  ...PINE_SCRIPT_NODES,
  ...PORTFOLIO_NODES,
  ...AGENT_NODES,
];

// Helper to get nodes by category
export const getNodesByCategory = (category: string): NodeCatalogItem[] => {
  return NODE_CATALOG.filter(node => node.category === category);
};

// Helper to get nodes by subcategory
export const getNodesBySubcategory = (category: string, subcategory: string): NodeCatalogItem[] => {
  return NODE_CATALOG.filter(node => node.category === category && node.subcategory === subcategory);
};

// Get all unique subcategories for a category
export const getSubcategories = (category: string): string[] => {
  const nodes = getNodesByCategory(category);
  const subcategories = new Set<string>();
  nodes.forEach(node => {
    if (node.subcategory) {
      subcategories.add(node.subcategory);
    }
  });
  return Array.from(subcategories);
};
