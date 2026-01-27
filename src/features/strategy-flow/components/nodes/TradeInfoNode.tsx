/**
 * TradeInfoNode - Node for accessing trade information (Entry Price, PnL, etc.)
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { TradeInfoNodeData } from '../../types';
import { TRADE_INFO_NODES } from '../../catalog/nodeCatalog';

export const TradeInfoNode = memo(({ id, data, selected }: NodeProps) => {
    const nodeData = data as unknown as TradeInfoNodeData;

    // Find the catalog item
    const catalogItem = TRADE_INFO_NODES.find(n => n.defaultData.tradeInfoType === nodeData.tradeInfoType);

    const IconComponent = catalogItem ? (Icons as any)[catalogItem.icon] : Icons.Info;
    const color = catalogItem?.color || '#8b5cf6';

    return (
        <StrategyBaseNode
            id={id}
            data={nodeData}
            selected={selected}
            nodeType="tradeInfo"
            subType={nodeData.tradeInfoType}
            color={color}
            icon={<IconComponent className="w-4 h-4" />}
        >
            <div className="text-xs text-white/50 lowercase">
                {nodeData.tradeInfoType.replace(/([A-Z])/g, ' $1').trim()}
            </div>
        </StrategyBaseNode>
    );
});

TradeInfoNode.displayName = 'TradeInfoNode';
