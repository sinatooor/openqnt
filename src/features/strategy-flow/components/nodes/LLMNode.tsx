/**
 * LLMNode - Node for prompt-based JSON decisions
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { LLMNodeData } from '../../types';

export const LLMNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as LLMNodeData;
  const IconComponent = Icons.Sparkles;
  const color = '#a855f7';

  return (
    <StrategyBaseNode
      id={id}
      data={nodeData}
      selected={selected}
      nodeType="llm"
      color={color}
      icon={<IconComponent className="w-4 h-4" />}
    >
      <div className="space-y-1">
        <div className="text-xs text-white/60 line-clamp-2">
          {nodeData.prompt || 'LLM decision prompt'}
        </div>
        {nodeData.schema && (
          <div className="text-[10px] text-white/40">
            Schema keys: {Object.keys(nodeData.schema).slice(0, 3).join(', ')}
          </div>
        )}
      </div>
    </StrategyBaseNode>
  );
});

LLMNode.displayName = 'LLMNode';
