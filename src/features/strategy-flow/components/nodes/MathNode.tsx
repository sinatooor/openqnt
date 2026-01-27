/**
 * MathNode - Node for math operations (Add, Subtract, Multiply, Divide, Number, Advanced Math)
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { MathNodeData, AdvancedMathFunction } from '../../types';
import { MATH_NODES } from '../../catalog/nodeCatalog';

const MATH_FUNCTION_LABELS: Record<AdvancedMathFunction, string> = {
    sqrt: 'Square Root (√)',
    abs: 'Absolute Value',
    sin: 'Sine',
    cos: 'Cosine',
    tan: 'Tangent',
    log: 'Logarithm',
    exp: 'Exponential',
    floor: 'Floor',
    ceil: 'Ceiling',
    round: 'Round',
};

const OPERATOR_SYMBOLS: Record<string, string> = {
    add: '+',
    subtract: '−',
    multiply: '×',
    divide: '÷',
};

export const MathNode = memo(({ id, data, selected }: NodeProps) => {
    const nodeData = data as unknown as MathNodeData;

    // Find the catalog item for this math type
    const catalogItem = MATH_NODES.find(n => n.type === nodeData.mathType);
    const IconComponent = catalogItem ? (Icons as any)[catalogItem.icon] : Icons.Calculator;
    const color = catalogItem?.color || '#14b8a6';

    const renderContent = () => {
        switch (nodeData.mathType) {
            case 'add':
            case 'subtract':
            case 'multiply':
            case 'divide':
                return (
                    <div className="flex items-center justify-center text-2xl font-bold text-white/80">
                        {OPERATOR_SYMBOLS[nodeData.mathType]}
                    </div>
                );

            case 'number':
                return (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Value</span>
                            <span className="text-white/80 font-mono text-lg">{nodeData.value ?? 0}</span>
                        </div>
                    </div>
                );

            case 'advancedMath':
                return (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Function</span>
                            <span className="text-white/80 font-medium">
                                {nodeData.mathFunction ? MATH_FUNCTION_LABELS[nodeData.mathFunction] : 'sqrt'}
                            </span>
                        </div>
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
            nodeType="math"
            subType={nodeData.mathType}
            color={color}
            icon={<IconComponent className="w-4 h-4" />}
        >
            {renderContent()}
        </StrategyBaseNode>
    );
});

MathNode.displayName = 'MathNode';
