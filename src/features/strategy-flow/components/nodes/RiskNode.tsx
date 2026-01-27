/**
 * RiskNode - Node for risk management (Max Drawdown, Position Sizing, etc.)
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { RiskNodeData } from '../../types';
import { RISK_NODES } from '../../catalog/nodeCatalog';

export const RiskNode = memo(({ id, data, selected }: NodeProps) => {
    const nodeData = data as unknown as RiskNodeData;

    // Find the catalog item
    const catalogItem = RISK_NODES.find(n => n.type === `risk_${nodeData.riskType.replace(/([A-Z])/g, '_$1').toLowerCase()}`) ||
        RISK_NODES.find(n => n.defaultData.riskType === nodeData.riskType);

    const IconComponent = catalogItem ? (Icons as any)[catalogItem.icon] : Icons.Shield;
    const color = catalogItem?.color || '#ef4444';

    const renderContent = () => {
        switch (nodeData.riskType) {
            case 'maxDrawdown':
            case 'dailyLossLimit':
                return (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Limit</span>
                            <span className="text-white/80 font-mono">{nodeData.value}%</span>
                        </div>
                    </div>
                );

            case 'positionPercent':
                return (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Size</span>
                            <span className="text-white/80 font-mono">{nodeData.percentage}%</span>
                        </div>
                    </div>
                );

            case 'trailingStop':
                return (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Distance</span>
                            <span className="text-white/80 font-mono">{nodeData.value} pts</span>
                        </div>
                    </div>
                );

            default:
                return null; // Simple labels for others like Kelly Criterion
        }
    };

    return (
        <StrategyBaseNode
            id={id}
            data={nodeData}
            selected={selected}
            nodeType="risk"
            subType={nodeData.riskType}
            color={color}
            icon={<IconComponent className="w-4 h-4" />}
        >
            {renderContent()}
        </StrategyBaseNode>
    );
});

RiskNode.displayName = 'RiskNode';
