/**
 * EnvironmentNode - Node for environment data (Price, Time, Spread, etc.)
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { EnvironmentNodeData } from '../../types';
import { ENVIRONMENT_NODES } from '../../catalog/nodeCatalog';

export const EnvironmentNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as EnvironmentNodeData;
  
  // Find the catalog item for this environment node
  const catalogItem = ENVIRONMENT_NODES.find(n => n.type === nodeData.environmentType);
  const IconComponent = catalogItem ? (Icons as any)[catalogItem.icon] : Icons.Globe;
  const color = catalogItem?.color || '#6366f1';

  const renderContent = () => {
    switch (nodeData.environmentType) {
      case 'price':
        return (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Type</span>
            <span className="text-white/80 capitalize">{nodeData.priceType || 'Mid'}</span>
          </div>
        );

      case 'prevCandleOpen':
      case 'prevCandleClose':
        return (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Shift</span>
            <span className="text-white/80">{nodeData.shift || 1} candles back</span>
          </div>
        );

      case 'dayOfWeek':
        return (
          <div className="text-xs text-white/60">
            Returns 0-6 (Sun-Sat)
          </div>
        );

      case 'isMarketOpen':
      case 'newCandleOpen':
        return (
          <div className="text-xs text-white/60">
            Returns true/false
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
      nodeType="environment"
      subType={nodeData.environmentType}
      color={color}
      icon={<IconComponent className="w-4 h-4" />}
    >
      {renderContent()}
    </StrategyBaseNode>
  );
});

EnvironmentNode.displayName = 'EnvironmentNode';
