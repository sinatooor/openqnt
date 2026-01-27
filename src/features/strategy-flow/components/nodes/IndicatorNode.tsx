/**
 * IndicatorNode - Node for all technical indicators (RSI, MACD, SMA, etc.)
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { IndicatorNodeData, TIMEFRAME_OPTIONS, StrategyNodeData } from '../../types';
import { INDICATOR_NODES } from '../../catalog/nodeCatalog';

export const IndicatorNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as IndicatorNodeData;
  
  // Find the catalog item for this indicator
  const catalogItem = INDICATOR_NODES.find(n => n.type === nodeData.indicatorType);
  const IconComponent = catalogItem ? (Icons as any)[catalogItem.icon] : Icons.Activity;
  const color = catalogItem?.color || '#8b5cf6';

  // Get timeframe label
  const tfLabel = TIMEFRAME_OPTIONS.find(tf => tf.value === nodeData.timeframe)?.label || nodeData.timeframe;

  // Get main parameter display
  const getParamDisplay = () => {
    const params = nodeData.params || {};
    if ('period' in params) {
      return `Period: ${params.period}`;
    }
    if ('fastPeriod' in params && 'slowPeriod' in params) {
      return `${params.fastPeriod}/${params.slowPeriod}/${params.signalPeriod || 9}`;
    }
    return null;
  };

  const paramDisplay = getParamDisplay();

  return (
    <StrategyBaseNode
      id={id}
      data={nodeData}
      selected={selected}
      nodeType="indicator"
      subType={nodeData.indicatorType}
      color={color}
      icon={<IconComponent className="w-4 h-4" />}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/50">Timeframe</span>
          <span className="text-white/80 font-medium">{tfLabel}</span>
        </div>
        {paramDisplay && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Settings</span>
            <span className="text-white/80 font-mono">{paramDisplay}</span>
          </div>
        )}
      </div>
    </StrategyBaseNode>
  );
});

IndicatorNode.displayName = 'IndicatorNode';
