/**
 * ConditionNode - Node for conditions (Compare, Crossover, AND, OR, etc.)
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { ConditionNodeData } from '../../types';
import { CONDITION_NODES } from '../../catalog/nodeCatalog';

const OPERATOR_LABELS: Record<string, string> = {
  '>': 'Greater than',
  '>=': 'Greater or equal',
  '<': 'Less than',
  '<=': 'Less or equal',
  '==': 'Equal',
  '!=': 'Not equal',
};

export const ConditionNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as ConditionNodeData;
  
  // Find the catalog item for this condition
  const catalogItem = CONDITION_NODES.find(n => n.type === nodeData.conditionType);
  const IconComponent = catalogItem ? (Icons as any)[catalogItem.icon] : Icons.GitBranch;
  const color = catalogItem?.color || '#f59e0b';

  const renderContent = () => {
    switch (nodeData.conditionType) {
      case 'compare':
      case 'threshold':
        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Operator</span>
              <span className="text-white/80 font-mono">{nodeData.operator || '>'}</span>
            </div>
            {nodeData.conditionType === 'threshold' && nodeData.value !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Value</span>
                <span className="text-white/80 font-mono">{nodeData.value}</span>
              </div>
            )}
          </div>
        );

      case 'range':
        return (
          <div className="text-xs text-white/60">
            Range: {nodeData.minValue} - {nodeData.maxValue}
          </div>
        );

      case 'crossover':
        return (
          <div className="text-xs text-white/60">
            A crosses above B
          </div>
        );

      case 'crossunder':
        return (
          <div className="text-xs text-white/60">
            A crosses below B
          </div>
        );

      case 'and':
      case 'or':
      case 'not':
        return (
          <div className="text-xs text-white/60 text-center font-mono">
            {nodeData.conditionType.toUpperCase()}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <StrategyBaseNode
      id={id}
      data={nodeData}
      selected={selected}
      nodeType="condition"
      subType={nodeData.conditionType}
      color={color}
      icon={<IconComponent className="w-4 h-4" />}
    >
      {renderContent()}
    </StrategyBaseNode>
  );
});

ConditionNode.displayName = 'ConditionNode';
