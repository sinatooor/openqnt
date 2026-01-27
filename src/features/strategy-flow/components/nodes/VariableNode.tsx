/**
 * VariableNode - Node for variables and functions
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { VariableNodeData } from '../../types';
import { VARIABLE_NODES } from '../../catalog/nodeCatalog';

export const VariableNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as VariableNodeData;
  
  // Find the catalog item for this variable node
  const catalogItem = VARIABLE_NODES.find(n => n.type === nodeData.variableType);
  const IconComponent = catalogItem ? (Icons as any)[catalogItem.icon] : Icons.Variable;
  const color = catalogItem?.color || '#ec4899';

  const renderContent = () => {
    switch (nodeData.variableType) {
      case 'setVariable':
        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Name</span>
              <span className="text-white/80 font-mono">{nodeData.variableName || 'var'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Value</span>
              <span className="text-white/80 font-mono">{nodeData.value ?? 0}</span>
            </div>
          </div>
        );

      case 'getVariable':
        return (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Name</span>
            <span className="text-white/80 font-mono">{nodeData.variableName || 'var'}</span>
          </div>
        );

      case 'changeVariable':
        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Name</span>
              <span className="text-white/80 font-mono">{nodeData.variableName || 'var'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Change by</span>
              <span className="text-white/80 font-mono">{nodeData.value ?? 1}</span>
            </div>
          </div>
        );

      case 'defineFunction':
        return (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Function</span>
            <span className="text-white/80 font-mono">{nodeData.functionName || 'fn'}()</span>
          </div>
        );

      case 'callFunction':
        return (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Call</span>
            <span className="text-white/80 font-mono">{nodeData.functionName || 'fn'}()</span>
          </div>
        );

      case 'return':
        return (
          <div className="text-xs text-white/60 text-center">
            Return value from function
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
      nodeType="variable"
      subType={nodeData.variableType}
      color={color}
      icon={<IconComponent className="w-4 h-4" />}
    >
      {renderContent()}
    </StrategyBaseNode>
  );
});

VariableNode.displayName = 'VariableNode';
