/**
 * Handle configs for catalog enrichment.
 *
 * Verbatim copy of getHandleConfigs() from
 *   src/features/strategy-flow/utils/handleUtils.ts
 * minus the data-parameter handling (this side never has node data — we only
 * need the static handle topology for the catalog the LLM sees).
 *
 * Keep this file IN SYNC with the frontend version. The strategy-ai service
 * uses it to enrich each catalog entry with real handle ids/labels/dataTypes
 * so the LLM can call `connect(source, target, sourceHandle, targetHandle)`
 * with the correct ids (e.g. "trigger", "data", "value") rather than guessing
 * from labels.
 */

export interface HandleConfig {
  id: string;
  type: 'target' | 'source';
  position: 'left' | 'right';
  label: string;
  dataType?: string;
}

export const getHandleConfigs = (nodeType: string, subType?: string): HandleConfig[] => {
    switch (nodeType) {
        case 'indicator': {
            const handles: HandleConfig[] = [];

            // Trigger handle — gates when the indicator recomputes
            handles.push({ id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' });

            // Standard target handles for indicators
            if (subType === 'spread') {
                handles.push({ id: 'data-a', type: 'target', position: 'left', label: 'Data A', dataType: 'any' });
                handles.push({ id: 'data-b', type: 'target', position: 'left', label: 'Data B', dataType: 'any' });
            } else if (['vwap', 'obv', 'mfi', 'adx', 'chaikin'].includes(subType || '')) {
                handles.push({ id: 'data', type: 'target', position: 'left', label: 'Price Data', dataType: 'any' });
                handles.push({ id: 'volume', type: 'target', position: 'left', label: 'Volume', dataType: 'any' });
            } else {
                handles.push({ id: 'data', type: 'target', position: 'left', label: 'Price Data', dataType: 'any' });
            }

            // Multi-output indicators
            if (subType === 'bb' || subType === 'keltner' || subType === 'donchian') {
                handles.push(
                    { id: 'upper', type: 'source', position: 'right', label: 'Upper', dataType: 'number' },
                    { id: 'middle', type: 'source', position: 'right', label: 'Middle', dataType: 'number' },
                    { id: 'lower', type: 'source', position: 'right', label: 'Lower', dataType: 'number' }
                );
                return handles;
            }
            if (subType === 'envelopes' || subType === 'stochastic' || subType === 'stochrsi') {
                handles.push(
                    { id: 'upper', type: 'source', position: 'right', label: (subType === 'stochastic' || subType === 'stochrsi') ? '%K' : 'Upper', dataType: 'number' },
                    { id: 'lower', type: 'source', position: 'right', label: (subType === 'stochastic' || subType === 'stochrsi') ? '%D' : 'Lower', dataType: 'number' }
                );
                return handles;
            }
            if (subType === 'macd') {
                handles.push(
                    { id: 'line', type: 'source', position: 'right', label: 'MACD', dataType: 'number' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'number' },
                    { id: 'histogram', type: 'source', position: 'right', label: 'Histogram', dataType: 'number' }
                );
                return handles;
            }
            if (subType === 'dmi') {
                handles.push(
                    { id: 'plus_di', type: 'source', position: 'right', label: '+DI', dataType: 'number' },
                    { id: 'minus_di', type: 'source', position: 'right', label: '-DI', dataType: 'number' },
                    { id: 'adx', type: 'source', position: 'right', label: 'ADX', dataType: 'number' }
                );
                return handles;
            }
            if (subType === 'ichimoku') {
                handles.push(
                    { id: 'tenkan', type: 'source', position: 'right', label: 'Tenkan', dataType: 'number' },
                    { id: 'kijun', type: 'source', position: 'right', label: 'Kijun', dataType: 'number' },
                    { id: 'senkou_a', type: 'source', position: 'right', label: 'Span A', dataType: 'number' },
                    { id: 'senkou_b', type: 'source', position: 'right', label: 'Span B', dataType: 'number' },
                    { id: 'chikou', type: 'source', position: 'right', label: 'Chikou', dataType: 'number' }
                );
                return handles;
            }
            if (subType === 'alligator') {
                handles.push(
                    { id: 'jaw', type: 'source', position: 'right', label: 'Jaw', dataType: 'number' },
                    { id: 'teeth', type: 'source', position: 'right', label: 'Teeth', dataType: 'number' },
                    { id: 'lips', type: 'source', position: 'right', label: 'Lips', dataType: 'number' }
                );
                return handles;
            }
            if (subType === 'aroon') {
                handles.push(
                    { id: 'aroonup', type: 'source', position: 'right', label: 'Up', dataType: 'number' },
                    { id: 'aroondown', type: 'source', position: 'right', label: 'Down', dataType: 'number' }
                );
                return handles;
            }

            // Default output for single-value indicators
            handles.push({ id: 'value', type: 'source', position: 'right', label: 'Value', dataType: 'number' });
            return handles;
        }

        case 'condition':
            if (subType === 'and' || subType === 'or') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'boolean' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'boolean' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
                ];
            }
            if (subType === 'not') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'input', type: 'target', position: 'left', label: 'In', dataType: 'boolean' },
                    { id: 'output', type: 'source', position: 'right', label: 'Out', dataType: 'boolean' },
                ];
            }
            if (subType === 'crossover' || subType === 'crossunder' || subType === 'compare') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'number' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
                ];
            }
            if (subType === 'threshold') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'input-a', type: 'target', position: 'left', label: 'Value', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
                ];
            }
            if (subType === 'range') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'input-a', type: 'target', position: 'left', label: 'Value', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'In Range', dataType: 'boolean' },
                ];
            }
            return [
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'any' },
                { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'any' },
                { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
            ];

        case 'action':
            if (subType === 'stopLoss') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'stopPrice', type: 'target', position: 'left', label: 'Price', dataType: 'number' },
                    { id: 'next', type: 'source', position: 'right', label: 'Next', dataType: 'signal' },
                ];
            }
            if (subType === 'takeProfit') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'takeProfitPrice', type: 'target', position: 'left', label: 'Price', dataType: 'number' },
                    { id: 'next', type: 'source', position: 'right', label: 'Next', dataType: 'signal' },
                ];
            }
            if (subType === 'trailingStop') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'next', type: 'source', position: 'right', label: 'Next', dataType: 'signal' },
                ];
            }
            if (subType === 'order') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'size', type: 'target', position: 'left', label: 'Size', dataType: 'number' },
                    { id: 'limitPrice', type: 'target', position: 'left', label: 'Limit', dataType: 'number' },
                    { id: 'stopPrice', type: 'target', position: 'left', label: 'Stop', dataType: 'number' },
                    { id: 'takeProfitPrice', type: 'target', position: 'left', label: 'TP', dataType: 'number' },
                    { id: 'next', type: 'source', position: 'right', label: 'Next', dataType: 'signal' },
                ];
            }
            return [
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'next', type: 'source', position: 'right', label: 'Next', dataType: 'signal' },
            ];

        case 'environment':
            return [
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'value', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
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
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'input', type: 'target', position: 'left', label: 'Input', dataType: 'any' },
                { id: 'output', type: 'source', position: 'right', label: 'Output', dataType: 'signal' },
            ];

        case 'math':
            // Number node: output only (constant)
            if (subType === 'number') {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
                ];
            }
            // Advanced math: single input, single output
            if (subType === 'advancedMath') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'input', type: 'target', position: 'left', label: 'Input', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'number' },
                ];
            }
            // Binary operators: two inputs, one output
            return [
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'number' },
                { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'number' },
                { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'number' },
            ];

        case 'risk':
            if (['positionPercent', 'kellyCriterion', 'fixedAmount'].includes(subType || '')) {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'size', type: 'source', position: 'right', label: 'Size', dataType: 'number' },
                ];
            }
            if (['trailingStop'].includes(subType || '')) {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'output', type: 'source', position: 'right', label: 'Rule', dataType: 'any' },
                ];
            }
            return [
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'output', type: 'source', position: 'right', label: 'Config', dataType: 'any' },
            ];

        case 'tradeInfo':
            return [
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
            ];

        case 'llm':
            // Different handle configs based on LLM node subtype
            if (subType === 'sentimentAnalysis') {
                return [
                    { id: 'text', type: 'target', position: 'left', label: 'Text', dataType: 'any' },
                    { id: 'score', type: 'source', position: 'right', label: 'Score', dataType: 'number' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'boolean' },
                ];
            }
            if (subType === 'regimeDetection' || subType === 'marketRegimeClassification') {
                return [
                    { id: 'data', type: 'target', position: 'left', label: 'Data', dataType: 'any' },
                    { id: 'indicators', type: 'target', position: 'left', label: 'Indicators', dataType: 'any' },
                    { id: 'regime', type: 'source', position: 'right', label: 'Regime', dataType: 'any' },
                    { id: 'confidence', type: 'source', position: 'right', label: 'Confidence', dataType: 'number' },
                ];
            }
            if (subType === 'nlStrategyRules') {
                return [
                    { id: 'context', type: 'target', position: 'left', label: 'Context', dataType: 'any' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'any' },
                    { id: 'reasoning', type: 'source', position: 'right', label: 'Reasoning', dataType: 'any' },
                ];
            }
            if (subType === 'parameterTuning') {
                return [
                    { id: 'performance', type: 'target', position: 'left', label: 'Performance', dataType: 'any' },
                    { id: 'params', type: 'target', position: 'left', label: 'Params', dataType: 'any' },
                    { id: 'suggested', type: 'source', position: 'right', label: 'Suggested', dataType: 'any' },
                ];
            }
            if (subType === 'newsSentimentSignal') {
                return [
                    { id: 'symbol', type: 'target', position: 'left', label: 'Symbol', dataType: 'any' },
                    { id: 'news', type: 'target', position: 'left', label: 'News', dataType: 'any' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'any' },
                    { id: 'strength', type: 'source', position: 'right', label: 'Strength', dataType: 'number' },
                ];
            }
            if (subType === 'customCode') {
                // Static base handles only — runtime customInputs/customOutputs
                // can't be enumerated from the catalog alone. The LLM will see
                // the base 3 handles and that's sufficient for connect() calls.
                return [
                    { id: 'data', type: 'target', position: 'left', label: 'Data', dataType: 'any' },
                    { id: 'context', type: 'target', position: 'left', label: 'Context', dataType: 'any' },
                    { id: 'result', type: 'source', position: 'right', label: 'Result', dataType: 'any' },
                ];
            }
            // Default LLM decision node
            return [
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'output', type: 'source', position: 'right', label: 'JSON', dataType: 'any' },
            ];

        case 'trigger':
            if (subType === 'conditionTrigger') {
                return [
                    { id: 'value', type: 'target', position: 'left', label: 'Value', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Signal', dataType: 'signal' },
                ];
            }
            if (subType === 'webhookTrigger' || subType === 'newsTrigger' || subType === 'brokerEventTrigger') {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Signal', dataType: 'signal' },
                    { id: 'data', type: 'source', position: 'right', label: 'Data', dataType: 'any' },
                ];
            }
            if (subType === 'priceAlertTrigger') {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Signal', dataType: 'signal' },
                    { id: 'price', type: 'source', position: 'right', label: 'Price', dataType: 'number' },
                ];
            }
            return [
                { id: 'output', type: 'source', position: 'right', label: 'Signal', dataType: 'signal' },
            ];

        case 'dataSource':
            return [
                { id: 'candles', type: 'source', position: 'right', label: 'Candles', dataType: 'any' },
            ];

        case 'integration':
            if (subType === 'mergeNode') {
                return [
                    { id: 'data-a', type: 'target', position: 'left', label: 'A', dataType: 'any' },
                    { id: 'data-b', type: 'target', position: 'left', label: 'B', dataType: 'any' },
                    { id: 'output', type: 'source', position: 'right', label: 'Merged', dataType: 'any' },
                ];
            }
            if (subType === 'splitNode') {
                return [
                    { id: 'data', type: 'target', position: 'left', label: 'Data', dataType: 'any' },
                    { id: 'item', type: 'source', position: 'right', label: 'Item', dataType: 'any' },
                    { id: 'output', type: 'source', position: 'right', label: 'Done', dataType: 'signal' },
                ];
            }
            if (subType === 'filterNode') {
                return [
                    { id: 'data', type: 'target', position: 'left', label: 'Data', dataType: 'any' },
                    { id: 'passed', type: 'source', position: 'right', label: 'Passed', dataType: 'any' },
                    { id: 'rejected', type: 'source', position: 'right', label: 'Rejected', dataType: 'any' },
                ];
            }
            if (subType === 'hitlNode') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'data', type: 'target', position: 'left', label: 'Data', dataType: 'any' },
                    { id: 'approved', type: 'source', position: 'right', label: 'Approved', dataType: 'signal' },
                    { id: 'rejected', type: 'source', position: 'right', label: 'Rejected', dataType: 'signal' },
                ];
            }
            if (subType === 'aggregateNode' || subType === 'setNode') {
                return [
                    { id: 'data', type: 'target', position: 'left', label: 'Data', dataType: 'any' },
                    { id: 'output', type: 'source', position: 'right', label: 'Data', dataType: 'any' },
                ];
            }
            // Default integration: trigger + data in, data + signal out
            return [
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'data', type: 'target', position: 'left', label: 'Data', dataType: 'any' },
                { id: 'output', type: 'source', position: 'right', label: 'Data', dataType: 'any' },
                { id: 'signal', type: 'source', position: 'right', label: 'Done', dataType: 'signal' },
            ];

        // =====================================================================
        // PINE SCRIPT NODES
        // =====================================================================
        case 'pineScript':
            // Script Setup — declaration nodes, output-only
            if (subType === 'pine_strategy' || subType === 'pine_indicator' || subType === 'pine_version') {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Script', dataType: 'any' },
                ];
            }
            // Input nodes — output-only (user-configurable params)
            if (subType?.startsWith('pine_input_')) {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: subType === 'pine_input_bool' ? 'boolean' : 'number' },
                ];
            }
            // Data series — output-only (close, open, high, low, volume, etc.)
            if (['pine_close', 'pine_open', 'pine_high', 'pine_low', 'pine_volume',
                'pine_time', 'pine_bar_index'].includes(subType || '')) {
                return [
                    { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
                ];
            }
            // MACD — 1 input, 3 outputs
            if (subType === 'pine_ta_macd') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Source', dataType: 'number' },
                    { id: 'macd', type: 'source', position: 'right', label: 'MACD', dataType: 'number' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'number' },
                    { id: 'histogram', type: 'source', position: 'right', label: 'Histogram', dataType: 'number' },
                ];
            }
            // Bollinger Bands — 2 inputs, 3 outputs
            if (subType === 'pine_ta_bb') {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'Source', dataType: 'number' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'Length', dataType: 'number' },
                    { id: 'basis', type: 'source', position: 'right', label: 'Basis', dataType: 'number' },
                    { id: 'upper', type: 'source', position: 'right', label: 'Upper', dataType: 'number' },
                    { id: 'lower', type: 'source', position: 'right', label: 'Lower', dataType: 'number' },
                ];
            }
            // Indicators with Series+Number inputs, Series output (SMA, EMA, RSI, Stoch)
            if (['pine_ta_sma', 'pine_ta_ema', 'pine_ta_rsi', 'pine_ta_stoch'].includes(subType || '')) {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'Source', dataType: 'number' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'Length', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
                ];
            }
            // ATR — Number input, Series output
            if (subType === 'pine_ta_atr') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Length', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
                ];
            }
            // VWAP — optional Series input, Series output
            if (subType === 'pine_ta_vwap') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Source', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
                ];
            }
            // Crossover / Crossunder — 2 Series inputs, Boolean output
            if (subType === 'pine_ta_crossover' || subType === 'pine_ta_crossunder') {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'number' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Signal', dataType: 'boolean' },
                ];
            }
            // Compare — 2 inputs, Boolean output
            if (subType === 'pine_compare') {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'number' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
                ];
            }
            // AND / OR — 2 Boolean inputs, Boolean output
            if (subType === 'pine_and' || subType === 'pine_or') {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'boolean' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'boolean' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
                ];
            }
            // NOT — 1 Boolean input, Boolean output
            if (subType === 'pine_not') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Input', dataType: 'boolean' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
                ];
            }
            // Ternary — 3 inputs, 1 output
            if (subType === 'pine_ternary') {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'Cond', dataType: 'boolean' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'Then', dataType: 'any' },
                    { id: 'input-c', type: 'target', position: 'left', label: 'Else', dataType: 'any' },
                    { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'any' },
                ];
            }
            // Strategy actions — Boolean input + optional Signal output
            if (['pine_strategy_entry', 'pine_strategy_close', 'pine_strategy_exit', 'pine_strategy_order'].includes(subType || '')) {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Condition', dataType: 'boolean' },
                    { id: 'output', type: 'source', position: 'right', label: 'Signal', dataType: 'signal' },
                ];
            }
            // Plot — Series input, no output
            if (subType === 'pine_plot') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Series', dataType: 'number' },
                ];
            }
            // Plotshape, bgcolor, barcolor — Boolean input, no output
            if (['pine_plotshape', 'pine_bgcolor', 'pine_barcolor', 'pine_plotchar'].includes(subType || '')) {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Condition', dataType: 'boolean' },
                ];
            }
            // Hline — Number input, no output
            if (subType === 'pine_hline') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Level', dataType: 'number' },
                ];
            }
            // Fill — 2 inputs (plot references), no output
            if (subType === 'pine_fill') {
                return [
                    { id: 'input-a', type: 'target', position: 'left', label: 'Plot 1', dataType: 'any' },
                    { id: 'input-b', type: 'target', position: 'left', label: 'Plot 2', dataType: 'any' },
                ];
            }
            // Alert nodes — Boolean input, no output
            if (subType === 'pine_alertcondition' || subType === 'pine_alert') {
                return [
                    { id: 'input', type: 'target', position: 'left', label: 'Condition', dataType: 'boolean' },
                ];
            }
            // Fallback for unknown Pine Script subtypes: single input + single output
            return [
                { id: 'input', type: 'target', position: 'left', label: 'Input', dataType: 'any' },
                { id: 'output', type: 'source', position: 'right', label: 'Output', dataType: 'any' },
            ];

        case 'portfolio':
            if (subType === 'concentrationCheck' || subType === 'correlationCheck') {
                return [
                    { id: 'threshold', type: 'target', position: 'left', label: 'Threshold', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Output', dataType: 'boolean' },
                ];
            }
            if (subType === 'rebalanceSignal') {
                return [
                    { id: 'driftThreshold', type: 'target', position: 'left', label: 'Drift', dataType: 'number' },
                    { id: 'targetPct', type: 'target', position: 'left', label: 'Target', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Signal', dataType: 'boolean' },
                ];
            }
            if (subType === 'setTargetWeight') {
                return [
                    { id: 'targetPct', type: 'target', position: 'left', label: 'Target', dataType: 'number' },
                    { id: 'output', type: 'source', position: 'right', label: 'Output', dataType: 'boolean' },
                ];
            }
            return [
                { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
            ];

        case 'agent':
            if (subType === 'synthesis') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'symbols', type: 'target', position: 'left', label: 'Symbols', dataType: 'any' },
                    { id: 'agentData', type: 'target', position: 'left', label: 'Agent Data', dataType: 'any' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'signal' },
                    { id: 'confidence', type: 'source', position: 'right', label: 'Confidence', dataType: 'number' },
                    { id: 'recommendation', type: 'source', position: 'right', label: 'Rec', dataType: 'any' },
                ];
            }
            if (subType === 'sentiment_analyst') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'symbols', type: 'target', position: 'left', label: 'Symbols', dataType: 'any' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'signal' },
                    { id: 'confidence', type: 'source', position: 'right', label: 'Confidence', dataType: 'number' },
                    { id: 'score', type: 'source', position: 'right', label: 'Score', dataType: 'number' },
                ];
            }
            if (subType === 'research_analyst') {
                return [
                    { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                    { id: 'symbols', type: 'target', position: 'left', label: 'Symbols', dataType: 'any' },
                    { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'signal' },
                    { id: 'confidence', type: 'source', position: 'right', label: 'Confidence', dataType: 'number' },
                    { id: 'findings', type: 'source', position: 'right', label: 'Findings', dataType: 'any' },
                    { id: 'riskScore', type: 'source', position: 'right', label: 'Risk Score', dataType: 'number' },
                ];
            }
            return [
                { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
                { id: 'symbols', type: 'target', position: 'left', label: 'Symbols', dataType: 'any' },
                { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'signal' },
                { id: 'confidence', type: 'source', position: 'right', label: 'Confidence', dataType: 'number' },
                { id: 'findings', type: 'source', position: 'right', label: 'Findings', dataType: 'any' },
            ];

        default:
            return [];
    }
};
