/**
 * PineScriptNode - Node component for TradingView Pine Script blocks
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { PineScriptNodeData, StrategyNodeData } from '../../types';
import { PINE_SCRIPT_NODES } from '../../catalog/nodeCatalog';

export const PineScriptNode = memo(({ id, data, selected }: NodeProps) => {
    const nodeData = data as unknown as PineScriptNodeData;

    // Find the catalog item for this Pine Script node
    const catalogItem = PINE_SCRIPT_NODES.find(n => n.type === nodeData.pineType);
    const IconComponent = catalogItem ? (Icons as any)[catalogItem.icon] : Icons.FileCode2;
    const color = catalogItem?.color || '#2962FF';

    // Get display info based on node sub-type
    const getDetailDisplay = () => {
        const pineType = nodeData.pineType;

        if (pineType === 'pine_strategy' || pineType === 'pine_indicator') {
            return nodeData.scriptTitle || 'Untitled';
        }
        if (pineType?.startsWith('pine_input_')) {
            return `${nodeData.inputName || 'param'} = ${nodeData.inputDefault ?? ''}`;
        }
        if (pineType?.startsWith('pine_ta_')) {
            const parts: string[] = [];
            if (nodeData.source) parts.push(nodeData.source);
            if (nodeData.period) parts.push(`${nodeData.period}`);
            return parts.join(', ') || null;
        }
        if (pineType === 'pine_strategy_entry' || pineType === 'pine_strategy_close' || pineType === 'pine_strategy_exit') {
            const parts: string[] = [];
            if (nodeData.entryId) parts.push(`"${nodeData.entryId}"`);
            if (nodeData.direction) parts.push(nodeData.direction);
            return parts.join(', ') || null;
        }
        if (pineType === 'pine_compare') {
            return nodeData.operator || '>';
        }
        if (pineType === 'pine_plot') {
            return nodeData.plotTitle || 'Plot';
        }
        if (pineType === 'pine_alertcondition' || pineType === 'pine_alert') {
            return nodeData.alertMessage ? `"${nodeData.alertMessage.substring(0, 20)}..."` : null;
        }
        return null;
    };

    const detail = getDetailDisplay();

    return (
        <StrategyBaseNode
            id={id}
            data={nodeData}
            selected={selected}
            nodeType="pineScript"
            subType={nodeData.pineType}
            color={color}
            icon={<IconComponent className="w-4 h-4" />}
        >
            {detail && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">Config</span>
                        <span className="text-white/80 font-mono text-[11px]">{detail}</span>
                    </div>
                </div>
            )}
        </StrategyBaseNode>
    );
});

PineScriptNode.displayName = 'PineScriptNode';
