/**
 * ControlNode - Node for control flow (If, Loops, Wait, etc.)
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { ControlNodeData } from '../../types';
import { CONTROL_NODES } from '../../catalog/nodeCatalog';

export const ControlNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as ControlNodeData;
  
  // Find the catalog item for this control node
  const catalogItem = CONTROL_NODES.find(n => n.type === nodeData.controlType);
  const IconComponent = catalogItem ? (Icons as any)[catalogItem.icon] : Icons.GitBranch;
  const color = catalogItem?.color || '#f59e0b';

  const renderContent = () => {
    switch (nodeData.controlType) {
      case 'if':
        return (
          <div className="text-xs text-white/60">
            If condition is true, execute next
          </div>
        );

      case 'ifElse':
        return (
          <div className="text-xs text-white/60">
            If true → Then, else → Else
          </div>
        );

      case 'repeat':
        return (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Count</span>
            <span className="text-white/80 font-mono">{nodeData.repeatCount || 10}</span>
          </div>
        );

      case 'repeatUntil':
        return (
          <div className="text-xs text-white/60">
            Repeat until condition is true
          </div>
        );

      case 'wait':
        return (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Duration</span>
            <span className="text-white/80">{nodeData.waitSeconds || 1}s</span>
          </div>
        );

      case 'waitUntil':
        return (
          <div className="text-xs text-white/60">
            Wait until condition is true
          </div>
        );

      case 'stop':
        return (
          <div className="text-xs text-white/60 text-center">
            Stop strategy execution
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
      nodeType="control"
      subType={nodeData.controlType}
      color={color}
      icon={<IconComponent className="w-4 h-4" />}
    >
      {renderContent()}
    </StrategyBaseNode>
  );
});

ControlNode.displayName = 'ControlNode';
