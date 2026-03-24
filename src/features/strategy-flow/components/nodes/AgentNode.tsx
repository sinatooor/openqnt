/**
 * AgentNode — Nodes for running AI Agents in the strategy flow.
 * Renders an AI agent node on the canvas.
 */
import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { AGENT_NODES } from '../../catalog/nodes/agentNodes';

import { AgentNodeData } from '../../types';

export const AgentNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as AgentNodeData;
  const catalogItem = AGENT_NODES.find(
    (n) => n.type === nodeData.agentNodeType
  ) || AGENT_NODES.find((n) => n.defaultData.agentType === nodeData.agentType);

  const IconComponent = catalogItem ? (Icons as any)[catalogItem.icon] : Icons.Bot;
  const color = catalogItem?.color || '#3b82f6';

  const getDetails = () => {
    return nodeData.symbols && nodeData.symbols.length > 0 
      ? `Targets: ${nodeData.symbols.join(', ')}`
      : 'All Portfolio Targets';
  };

  return (
    <StrategyBaseNode
      id={id}
      data={nodeData}
      selected={selected}
      nodeType="agent"
      subType={nodeData.agentType}
      color={color}
      icon={<IconComponent className="w-4 h-4" />}
    >
      <div className="text-[10px] text-white/50 mb-1">
        Model: <span className="font-mono text-white/80">{nodeData.model || 'gemini-2.0-flash'}</span>
      </div>
      <div className="text-xs text-white/70 truncate">{getDetails()}</div>
      <div className="text-[10px] text-white/50 mt-1">
        Threshold: {nodeData.confidenceThreshold ?? 0.5}
      </div>
    </StrategyBaseNode>
  );
});

AgentNode.displayName = 'AgentNode';
