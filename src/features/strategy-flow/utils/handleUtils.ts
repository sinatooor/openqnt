/**
 * Handle configuration utilities for strategy nodes
 */

import { HandleConfig } from '../types';

export const getHandleConfigs = (nodeType: string, subType?: string): HandleConfig[] => {
    switch (nodeType) {
        case 'indicator':
            // Multi-output indicators based on BLOCK_CATALOG.xml
            // Bands & Channels with upper/middle/lower
            if (subType === 'bb' || subType === 'keltner' || subType === 'donchian') {
                return [
                    { id: 'upper', type: 'source', position: 'right', label: 'Upper', dataType: 'number' },
                    { id: 'middle', type: 'source', position: 'right', label: 'Middle', dataType: 'number' },
                    { id: 'lower', type: 'source', position: 'right', label: 'Lower', dataType: 'number' },
                ];
            }
            // Envelopes with upper/lower only
            if (subType === 'envelopes') {
                return [
                    { id: 'upper', type: 'source', position: 'right', label: 'Upper', dataType: 'number' },
                    { id: 'lower', type: 'source', position: 'right', label: 'Lower', dataType: 'number' },
                ];
            }
            // MACD with line/signal/histogram
            if (subType === 'macd') {
                return [
                    { id: 'line', type: 'source', position: 'right', label: 'MACD', dataType: 'number' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'number' },
                    { id: 'histogram', type: 'source', position: 'right', label: 'Histogram', dataType: 'number' },
                ];
            }
            // Stochastic with main/signal
            if (subType === 'stochastic') {
                return [
                    { id: 'main', type: 'source', position: 'right', label: '%K', dataType: 'number' },
                    { id: 'signal', type: 'source', position: 'right', label: '%D', dataType: 'number' },
                ];
            }
            // Ichimoku with 5 lines
            if (subType === 'ichimoku') {
                return [
                    { id: 'tenkan', type: 'source', position: 'right', label: 'Tenkan', dataType: 'number' },
                    { id: 'kijun', type: 'source', position: 'right', label: 'Kijun', dataType: 'number' },
                    { id: 'senkou_a', type: 'source', position: 'right', label: 'Senkou A', dataType: 'number' },
                    { id: 'senkou_b', type: 'source', position: 'right', label: 'Senkou B', dataType: 'number' },
                    { id: 'chikou', type: 'source', position: 'right', label: 'Chikou', dataType: 'number' },
                ];
            }
            // Alligator with jaw/teeth/lips
            if (subType === 'alligator') {
                return [
                    { id: 'jaw', type: 'source', position: 'right', label: 'Jaw', dataType: 'number' },
                    { id: 'teeth', type: 'source', position: 'right', label: 'Teeth', dataType: 'number' },
                    { id: 'lips', type: 'source', position: 'right', label: 'Lips', dataType: 'number' },
                ];
            }
            // Gator with upper/lower
            if (subType === 'gator') {
                return [
                    { id: 'upper', type: 'source', position: 'right', label: 'Upper', dataType: 'number' },
                    { id: 'lower', type: 'source', position: 'right', label: 'Lower', dataType: 'number' },
                ];
            }
            // DMI with +DI/-DI/ADX
            if (subType === 'dmi') {
                return [
                    { id: 'plus_di', type: 'source', position: 'right', label: '+DI', dataType: 'number' },
                    { id: 'minus_di', type: 'source', position: 'right', label: '-DI', dataType: 'number' },
                    { id: 'adx', type: 'source', position: 'right', label: 'ADX', dataType: 'number' },
                ];
            }
            // RVI with main/signal
            if (subType === 'rvi') {
                return [
                    { id: 'main', type: 'source', position: 'right', label: 'Main', dataType: 'number' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'number' },
                ];
            }
            // OsMA with main/signal
            if (subType === 'osma') {
                return [
                    { id: 'main', type: 'source', position: 'right', label: 'Main', dataType: 'number' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'number' },
                ];
            }
            // Fractals with upper/lower
            if (subType === 'fractals') {
                return [
                    { id: 'upper', type: 'source', position: 'right', label: 'Upper', dataType: 'number' },
                    { id: 'lower', type: 'source', position: 'right', label: 'Lower', dataType: 'number' },
                ];
            }
            // Aroon with Up/Down
            if (subType === 'aroon') {
                return [
                    { id: 'aroonup', type: 'source', position: 'right', label: 'Up', dataType: 'number' },
                    { id: 'aroondown', type: 'source', position: 'right', label: 'Down', dataType: 'number' },
                ];
            }
            // Hilbert Transform Phasor
            if (subType === 'ht_phasor') {
                return [
                    { id: 'inphase', type: 'source', position: 'right', label: 'InPhase', dataType: 'number' },
                    { id: 'quadrature', type: 'source', position: 'right', label: 'Quad', dataType: 'number' },
                ];
            }
            // Hilbert Transform Sine
            if (subType === 'ht_sine') {
                return [
                    { id: 'sine', type: 'source', position: 'right', label: 'Sine', dataType: 'number' },
                    { id: 'leadsine', type: 'source', position: 'right', label: 'Lead', dataType: 'number' },
                ];
            }
            // Stochastic RSI
            if (subType === 'stochrsi') {
                return [
                    { id: 'k', type: 'source', position: 'right', label: '%K', dataType: 'number' },
                    { id: 'd', type: 'source', position: 'right', label: '%D', dataType: 'number' },
                ];
            }
            // Default: single output for simple indicators
            return [
                { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
            ];

        case 'condition':
            if (subType === 'and' || subType === 'or') {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'boolean' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'boolean' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
                ];
            }
            if (subType === 'not') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Input', dataType: 'boolean' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
                ];
            }
            return [
                { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'number' },
                { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'number' },
                { id: 'output', type: 'source', position: 'right', label: 'Signal', dataType: 'boolean' },
            ];

        case 'action':
            if (subType === 'stopLoss' || subType === 'takeProfit') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'price', type: 'target', position: 'left', label: 'Price', dataType: 'number' },
                    { id: 'next', type: 'source', position: 'right', label: 'Next', dataType: 'signal' },
                ];
            }
            if (subType === 'order') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'size', type: 'target', position: 'left', label: 'Size', dataType: 'number' }, // Optional dynamic size
                    { id: 'next', type: 'source', position: 'right', label: 'Next', dataType: 'signal' },
                ];
            }
            return [
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'next', type: 'source', position: 'right', label: 'Next', dataType: 'signal' },
            ];

        case 'environment':
            return [
                { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
            ];

        case 'control':
            if (subType === 'if' || subType === 'ifElse') {
                return [
                    { id: 'condition', type: 'target', position: 'left', label: 'Condition', dataType: 'boolean' },
                    { id: 'then', type: 'source', position: 'right', label: 'Then', dataType: 'signal' },
                    ...(subType === 'ifElse' ? [{ id: 'else', type: 'source', position: 'right', label: 'Else', dataType: 'signal' } as HandleConfig] : []),
                ];
            }
            return [
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'output', type: 'source', position: 'right', label: 'Output', dataType: 'signal' },
            ];

        case 'variable':
            if (subType === 'getVariable') {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'any' },
                ];
            }
            return [
                { id: 'input', type: 'target', position: 'left', label: 'Input', dataType: 'any' },
                { id: 'output', type: 'source', position: 'right', label: 'Output', dataType: 'signal' },
            ];

        case 'math':
            // Number node: output only
            if (subType === 'number') {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
                ];
            }
            // Advanced math: single input, single output
            if (subType === 'advancedMath') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Input', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'number' },
                ];
            }
            // Binary operators: two inputs, one output
            return [
                { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'number' },
                { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'number' },
                { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'number' },
            ];

        case 'risk':
            // Risk params usually output a number (size, distance) or act as a rule (target?)
            // For now, treat them as sources of configuration values or rules
            if (['positionPercent', 'kellyCriterion', 'fixedAmount'].includes(subType || '')) {
                return [
                    { id: 'size', type: 'source', position: 'right', label: 'Size', dataType: 'number' },
                ];
            }
            if (['trailingStop'].includes(subType || '')) {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Rule', dataType: 'any' },
                ];
            }
            // Global limits might not need handles, or could be outputs to Strategy Settings?
            // Let's provide an output just in case they are used as inputs to Trade nodes
            return [
                { id: 'output', type: 'source', position: 'right', label: 'Config', dataType: 'any' },
            ];

        case 'tradeInfo':
            // Trade info nodes source values
            return [
                { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
            ];

        default:
            return [];
    }
};
