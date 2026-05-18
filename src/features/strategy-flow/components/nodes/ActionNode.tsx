/**
 * ActionNode - Node for trading actions (Order, Close, Stop Loss, etc.)
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { ActionNodeData } from '../../types';
import { ACTION_NODES } from '../../catalog/nodeCatalog';

export const ActionNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as ActionNodeData;
  
  // Find the catalog item for this action
  const catalogItem = ACTION_NODES.find(n => n.type === nodeData.actionType);
  const IconComponent = catalogItem ? (Icons as any)[catalogItem.icon] : Icons.Zap;
  const color = catalogItem?.color || '#10b981';

  const renderContent = () => {
    switch (nodeData.actionType) {
      case 'order':
        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Direction</span>
              <span 
                className="font-medium"
                style={{ color: nodeData.direction === 'long' ? '#22c55e' : '#ef4444' }}
              >
                {nodeData.direction?.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Size</span>
              <span className="text-white/80">
                {nodeData.size} {nodeData.sizeType}
              </span>
            </div>
            {nodeData.orderType !== 'market' && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Type</span>
                <span className="text-white/80 capitalize">{nodeData.orderType}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Broker</span>
              <span className="text-white/80 uppercase">{nodeData.broker ?? 'paper'}</span>
            </div>
          </div>
        );

      case 'stopLoss':
        return (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Price</span>
            <span className="text-white/80 font-mono">{nodeData.stopPrice || 'Dynamic'}</span>
          </div>
        );

      case 'takeProfit':
        return (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Price</span>
            <span className="text-white/80 font-mono">{nodeData.takeProfitPrice || 'Dynamic'}</span>
          </div>
        );

      case 'trailingStop':
        return (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Distance</span>
            <span className="text-white/80">{nodeData.trailingDistance} pips</span>
          </div>
        );

      case 'notification':
        return (
          <div className="space-y-1">
            <div className="text-xs text-white/60 truncate max-w-[200px]">
              "{nodeData.message}"
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Channel</span>
              <span className="text-white/80 capitalize">{nodeData.channel}</span>
            </div>
          </div>
        );

      case 'closePosition':
      case 'closeAll':
        return (
          <div className="text-xs text-white/60 text-center">
            {nodeData.actionType === 'closeAll' ? 'Close all positions' : 'Close position'}
          </div>
        );

      case 'log':
        return (
          <div className="text-xs text-white/60 truncate max-w-[200px]">
            "{nodeData.message}"
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
      nodeType="action"
      subType={nodeData.actionType}
      color={color}
      icon={<IconComponent className="w-4 h-4" />}
    >
      {renderContent()}
    </StrategyBaseNode>
  );
});

ActionNode.displayName = 'ActionNode';
