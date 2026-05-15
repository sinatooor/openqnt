/**
 * DataSourceNode — renders data source nodes (Yahoo Finance, Avanza, FMP, FRED, etc.)
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { DATA_SOURCE_NODES } from '../../catalog/nodeCatalog';

export const DataSourceNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as Record<string, any>;

  const catalogItem = DATA_SOURCE_NODES.find(
    (n) => (n.defaultData as any)?.provider === nodeData.provider || n.type === nodeData.dataSourceType
  );
  const IconComponent = catalogItem ? (Icons as any)[catalogItem.icon] : Icons.Database;
  const color = catalogItem?.color || '#a855f7';

  const symbol = nodeData.symbol || nodeData.seriesId || nodeData.watchlistId;

  return (
    <StrategyBaseNode
      id={id}
      data={nodeData as any}
      selected={selected}
      nodeType="dataSource"
      subType={nodeData.provider}
      color={color}
      icon={<IconComponent className="w-4 h-4" />}
    >
      <div className="space-y-1">
        {symbol && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Symbol</span>
            <span className="text-white/80 font-mono">{symbol}</span>
          </div>
        )}
        {nodeData.timeframe && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Timeframe</span>
            <span className="text-white/80">{nodeData.timeframe}</span>
          </div>
        )}
      </div>
    </StrategyBaseNode>
  );
});

DataSourceNode.displayName = 'DataSourceNode';
