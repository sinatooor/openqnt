/**
 * RightPropertyPanel - Settings panel that opens when a node is selected
 * Based on the reference screenshots showing node properties on the right side
 */

import { memo, useCallback } from 'react';
import { X, Lock, Unlock, Copy, Trash2, MoreHorizontal, AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import Editor from '@monaco-editor/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStrategyFlowStore, selectSelectedNode } from '../store/strategyFlowStore';
import {
  IndicatorNodeData,
  ActionNodeData,
  ConditionNodeData,
  ControlNodeData,
  VariableNodeData,
  MathNodeData,
  RiskNodeData,
  TradeInfoNodeData,
  LLMNodeData,
  LLM_MODELS,
  LLMNodeType,
  LLMModel,
  TIMEFRAME_OPTIONS,
  PortfolioNodeData,
} from '../types';

// =============================================================================
// PROPERTY EDITORS
// =============================================================================

// =============================================================================
// DETACHABLE PARAMETER COMPONENT
// =============================================================================

interface DetachableInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onDetachedChange: (detached: boolean) => void;
  isDetached: boolean;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  canDetach?: boolean;
}

const DetachableInput = memo(({
  label,
  value,
  onChange,
  onDetachedChange,
  isDetached,
  min,
  max,
  step = 1,
  description,
  canDetach = true
}: DetachableInputProps) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {canDetach && (
          <button
            onClick={() => onDetachedChange(!isDetached)}
            className={cn(
              "px-1.5 py-0.5 text-[9px] rounded transition-colors",
              isDetached
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "bg-white/5 text-muted-foreground hover:bg-white/10"
            )}
            title={isDetached ? "Click to use fixed value" : "Click to use node input"}
          >
            {isDetached ? "⚡ Edge" : "📌 Fixed"}
          </button>
        )}
      </div>
      {!isDetached && (
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          className="w-20 h-7 text-right text-sm"
        />
      )}
    </div>
    {isDetached && (
      <div className="px-2 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded text-[10px] text-purple-300">
        Value from connected edge. Connect a node to this parameter's input handle.
      </div>
    )}
    {description && !isDetached && (
      <p className="text-[10px] text-muted-foreground/70">{description}</p>
    )}
  </div>
));

DetachableInput.displayName = 'DetachableInput';

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

const NumberInput = memo(({ label, value, onChange, min, max, step = 1, description }: NumberInputProps) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className="w-20 h-7 text-right text-sm"
      />
    </div>
    {description && (
      <p className="text-[10px] text-muted-foreground/70">{description}</p>
    )}
  </div>
));

NumberInput.displayName = 'NumberInput';

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}

const SliderInput = memo(({ label, value, onChange, min, max, step = 1 }: SliderInputProps) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
    <Slider
      value={[value]}
      onValueChange={([v]) => onChange(v)}
      min={min}
      max={max}
      step={step}
      className="w-full"
    />
    <div className="flex justify-between text-[10px] text-muted-foreground/50">
      <span>{min}</span>
      <span>{max}</span>
    </div>
  </div>
));

SliderInput.displayName = 'SliderInput';

interface SelectInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

const SelectInput = memo(({ label, value, onChange, options }: SelectInputProps) => (
  <div className="space-y-2">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
));

SelectInput.displayName = 'SelectInput';

// =============================================================================
// INDICATOR PROPERTIES
// =============================================================================

interface IndicatorPropertiesProps {
  nodeId: string;
  data: IndicatorNodeData;
}

const IndicatorProperties = memo(({ nodeId, data }: IndicatorPropertiesProps) => {
  const { updateNodeData } = useStrategyFlowStore();

  const updateParam = useCallback((key: string, value: number | string) => {
    updateNodeData(nodeId, {
      params: { ...data.params, [key]: value },
    });
  }, [nodeId, data.params, updateNodeData]);

  const updateTimeframe = useCallback((tf: string) => {
    updateNodeData(nodeId, { timeframe: tf });
  }, [nodeId, updateNodeData]);

  // Common parameters based on indicator type
  const renderParams = () => {
    const params = data.params || {};

    switch (data.indicatorType) {
      case 'sma':
      case 'ema':
      case 'smma':
      case 'lwma':
      case 'dema':
      case 'tema':
        return (
          <>
            <SliderInput
              label="Period"
              value={params.period as number || 14}
              onChange={(v) => updateParam('period', v)}
              min={1}
              max={200}
            />
            <SelectInput
              label="Price Type"
              value={params.priceType as string || 'close'}
              onChange={(v) => updateParam('priceType', v)}
              options={[
                { value: 'close', label: 'Close' },
                { value: 'open', label: 'Open' },
                { value: 'high', label: 'High' },
                { value: 'low', label: 'Low' },
                { value: 'hl2', label: 'HL/2' },
                { value: 'hlc3', label: 'HLC/3' },
                { value: 'ohlc4', label: 'OHLC/4' },
              ]}
            />
          </>
        );

      case 'rsi':
        return (
          <SliderInput
            label="Period"
            value={params.period as number || 14}
            onChange={(v) => updateParam('period', v)}
            min={2}
            max={100}
          />
        );

      case 'macd':
        return (
          <>
            <NumberInput
              label="Fast Period"
              value={params.fastPeriod as number || 12}
              onChange={(v) => updateParam('fastPeriod', v)}
              min={1}
              max={100}
            />
            <NumberInput
              label="Slow Period"
              value={params.slowPeriod as number || 26}
              onChange={(v) => updateParam('slowPeriod', v)}
              min={1}
              max={100}
            />
            <NumberInput
              label="Signal Period"
              value={params.signalPeriod as number || 9}
              onChange={(v) => updateParam('signalPeriod', v)}
              min={1}
              max={100}
            />
          </>
        );

      case 'bb':
        return (
          <>
            <SliderInput
              label="Period"
              value={params.period as number || 20}
              onChange={(v) => updateParam('period', v)}
              min={2}
              max={100}
            />
            <SliderInput
              label="Deviation"
              value={params.deviation as number || 2}
              onChange={(v) => updateParam('deviation', v)}
              min={0.5}
              max={5}
              step={0.1}
            />
            <SelectInput
              label="Band"
              value={params.band as string || 'middle'}
              onChange={(v) => updateParam('band', v)}
              options={[
                { value: 'upper', label: 'Upper Band' },
                { value: 'middle', label: 'Middle Band' },
                { value: 'lower', label: 'Lower Band' },
              ]}
            />
          </>
        );

      case 'stochastic':
        return (
          <>
            <NumberInput
              label="K Period"
              value={params.kPeriod as number || 5}
              onChange={(v) => updateParam('kPeriod', v)}
              min={1}
              max={100}
            />
            <NumberInput
              label="D Period"
              value={params.dPeriod as number || 3}
              onChange={(v) => updateParam('dPeriod', v)}
              min={1}
              max={100}
            />
            <NumberInput
              label="Slowing"
              value={params.slowing as number || 3}
              onChange={(v) => updateParam('slowing', v)}
              min={1}
              max={100}
            />
          </>
        );

      case 'atr':
        return (
          <SliderInput
            label="Period"
            value={params.period as number || 14}
            onChange={(v) => updateParam('period', v)}
            min={1}
            max={100}
          />
        );

      case 'sar':
        return (
          <>
            <NumberInput
              label="Step"
              value={params.step as number || 0.02}
              onChange={(v) => updateParam('step', v)}
              min={0.01}
              max={0.5}
              step={0.01}
            />
            <NumberInput
              label="Max"
              value={params.max as number || 0.2}
              onChange={(v) => updateParam('max', v)}
              min={0.1}
              max={1}
              step={0.1}
            />
          </>
        );

      default:
        // Generic period parameter
        if ('period' in params) {
          return (
            <SliderInput
              label="Period"
              value={params.period as number || 14}
              onChange={(v) => updateParam('period', v)}
              min={1}
              max={200}
            />
          );
        }
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <SelectInput
        label="Timeframe"
        value={data.timeframe || '60'}
        onChange={updateTimeframe}
        options={TIMEFRAME_OPTIONS.map(tf => ({ value: tf.value, label: tf.label }))}
      />
      {renderParams()}
    </div>
  );
});

IndicatorProperties.displayName = 'IndicatorProperties';

// =============================================================================
// ACTION PROPERTIES
// =============================================================================

interface ActionPropertiesProps {
  nodeId: string;
  data: ActionNodeData;
}

const ActionProperties = memo(({ nodeId, data }: ActionPropertiesProps) => {
  const { updateNodeData } = useStrategyFlowStore();

  const updateField = useCallback((field: string, value: any) => {
    updateNodeData(nodeId, { [field]: value });
  }, [nodeId, updateNodeData]);

  switch (data.actionType) {
    case 'order':
      return (
        <div className="space-y-4">
          <SelectInput
            label="Direction"
            value={data.direction || 'long'}
            onChange={(v) => updateField('direction', v)}
            options={[
              { value: 'long', label: 'Long (Buy)' },
              { value: 'short', label: 'Short (Sell)' },
            ]}
          />
          <SelectInput
            label="Order Type"
            value={data.orderType || 'market'}
            onChange={(v) => updateField('orderType', v)}
            options={[
              { value: 'market', label: 'Market' },
              { value: 'limit', label: 'Limit' },
              { value: 'stop', label: 'Stop' },
            ]}
          />
          <NumberInput
            label="Size"
            value={data.size || 0.1}
            onChange={(v) => updateField('size', v)}
            min={0.01}
            step={0.01}
          />
          <SelectInput
            label="Size Type"
            value={data.sizeType || 'lots'}
            onChange={(v) => updateField('sizeType', v)}
            options={[
              { value: 'lots', label: 'Lots' },
              { value: 'usd', label: 'USD' },
              { value: 'percent', label: '% Equity' },
            ]}
          />
          {data.orderType === 'limit' && (
            <NumberInput
              label="Limit Price"
              value={data.limitPrice || 0}
              onChange={(v) => updateField('limitPrice', v)}
              step={0.00001}
            />
          )}
        </div>
      );

    case 'stopLoss':
      return (
        <div className="space-y-4">
          <NumberInput
            label="Stop Price"
            value={data.stopPrice || 0}
            onChange={(v) => updateField('stopPrice', v)}
            step={0.00001}
            description="Price level to close the position"
          />
        </div>
      );

    case 'takeProfit':
      return (
        <div className="space-y-4">
          <NumberInput
            label="Take Profit Price"
            value={data.takeProfitPrice || 0}
            onChange={(v) => updateField('takeProfitPrice', v)}
            step={0.00001}
            description="Price level to take profit"
          />
        </div>
      );

    case 'trailingStop':
      return (
        <div className="space-y-4">
          <NumberInput
            label="Trailing Distance"
            value={data.trailingDistance || 10}
            onChange={(v) => updateField('trailingDistance', v)}
            min={1}
            description="Distance in pips"
          />
        </div>
      );

    case 'notification':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Message</Label>
            <Input
              value={data.message || ''}
              onChange={(e) => updateField('message', e.target.value)}
              placeholder="Enter notification message"
              className="text-sm"
            />
          </div>
          <SelectInput
            label="Channel"
            value={data.channel || 'telegram'}
            onChange={(v) => updateField('channel', v)}
            options={[
              { value: 'telegram', label: 'Telegram' },
              { value: 'email', label: 'Email' },
              { value: 'sms', label: 'SMS' },
              { value: 'discord', label: 'Discord' },
            ]}
          />
        </div>
      );

    default:
      return null;
  }
});

ActionProperties.displayName = 'ActionProperties';

// =============================================================================
// CONDITION PROPERTIES
// =============================================================================

interface ConditionPropertiesProps {
  nodeId: string;
  data: ConditionNodeData;
}

const ConditionProperties = memo(({ nodeId, data }: ConditionPropertiesProps) => {
  const { updateNodeData } = useStrategyFlowStore();

  const updateField = useCallback((field: string, value: any) => {
    updateNodeData(nodeId, { [field]: value });
  }, [nodeId, updateNodeData]);

  switch (data.conditionType) {
    case 'compare':
    case 'threshold':
      return (
        <div className="space-y-4">
          <SelectInput
            label="Operator"
            value={data.operator || '>'}
            onChange={(v) => updateField('operator', v)}
            options={[
              { value: '>', label: 'Greater than (>)' },
              { value: '>=', label: 'Greater or equal (≥)' },
              { value: '<', label: 'Less than (<)' },
              { value: '<=', label: 'Less or equal (≤)' },
              { value: '==', label: 'Equal (=)' },
              { value: '!=', label: 'Not equal (≠)' },
            ]}
          />
          {data.conditionType === 'threshold' && (
            <NumberInput
              label="Threshold Value"
              value={data.value || 0}
              onChange={(v) => updateField('value', v)}
              step={0.01}
            />
          )}
        </div>
      );

    case 'range':
      return (
        <div className="space-y-4">
          <NumberInput
            label="Minimum"
            value={data.minValue || 0}
            onChange={(v) => updateField('minValue', v)}
            step={0.01}
          />
          <NumberInput
            label="Maximum"
            value={data.maxValue || 100}
            onChange={(v) => updateField('maxValue', v)}
            step={0.01}
          />
        </div>
      );

    case 'crossover':
    case 'crossunder':
      return (
        <div className="text-sm text-muted-foreground">
          <p>Connect two indicator outputs to detect crossover/crossunder.</p>
        </div>
      );

    default:
      return null;
  }
});

ConditionProperties.displayName = 'ConditionProperties';

// =============================================================================
// CONTROL PROPERTIES
// =============================================================================

interface ControlPropertiesProps {
  nodeId: string;
  data: ControlNodeData;
}

const ControlProperties = memo(({ nodeId, data }: ControlPropertiesProps) => {
  const { updateNodeData } = useStrategyFlowStore();

  switch (data.controlType) {
    case 'repeat':
      return (
        <SliderInput
          label="Repeat Count"
          value={data.repeatCount || 10}
          onChange={(v) => updateNodeData(nodeId, { repeatCount: v })}
          min={1}
          max={1000}
        />
      );

    case 'wait':
      return (
        <NumberInput
          label="Wait Seconds"
          value={data.waitSeconds || 1}
          onChange={(v) => updateNodeData(nodeId, { waitSeconds: v })}
          min={0.1}
          step={0.1}
        />
      );

    default:
      return null;
  }
});

ControlProperties.displayName = 'ControlProperties';

// =============================================================================
// VARIABLE PROPERTIES
// =============================================================================

interface VariablePropertiesProps {
  nodeId: string;
  data: VariableNodeData;
}

const VariableProperties = memo(({ nodeId, data }: VariablePropertiesProps) => {
  const { updateNodeData } = useStrategyFlowStore();

  return (
    <div className="space-y-4">
      {(data.variableType === 'setVariable' ||
        data.variableType === 'getVariable' ||
        data.variableType === 'changeVariable') && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Variable Name</Label>
            <Input
              value={data.variableName || ''}
              onChange={(e) => updateNodeData(nodeId, { variableName: e.target.value })}
              placeholder="myVariable"
              className="text-sm font-mono"
            />
          </div>
        )}

      {(data.variableType === 'setVariable' || data.variableType === 'changeVariable') && (
        <NumberInput
          label="Value"
          value={data.value as number || 0}
          onChange={(v) => updateNodeData(nodeId, { value: v })}
          step={0.01}
        />
      )}

      {(data.variableType === 'defineFunction' || data.variableType === 'callFunction') && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Function Name</Label>
          <Input
            value={data.functionName || ''}
            onChange={(e) => updateNodeData(nodeId, { functionName: e.target.value })}
            placeholder="myFunction"
            className="text-sm font-mono"
          />
        </div>
      )}
    </div>
  );
});

VariableProperties.displayName = 'VariableProperties';

// =============================================================================
// MATH PROPERTIES
// =============================================================================

interface MathPropertiesProps {
  nodeId: string;
  data: MathNodeData;
}

const MathProperties = memo(({ nodeId, data }: MathPropertiesProps) => {
  const { updateNodeData } = useStrategyFlowStore();

  switch (data.mathType) {
    case 'number':
      return (
        <NumberInput
          label="Value"
          value={data.value || 0}
          onChange={(v) => updateNodeData(nodeId, { value: v })}
          step={0.01}
          description="The numeric constant value"
        />
      );

    case 'advancedMath':
      return (
        <SelectInput
          label="Function"
          value={data.mathFunction || 'sqrt'}
          onChange={(v) => updateNodeData(nodeId, { mathFunction: v })}
          options={[
            { value: 'sqrt', label: 'Square Root (√)' },
            { value: 'abs', label: 'Absolute Value' },
            { value: 'sin', label: 'Sine' },
            { value: 'cos', label: 'Cosine' },
            { value: 'tan', label: 'Tangent' },
            { value: 'log', label: 'Logarithm' },
            { value: 'exp', label: 'Exponential' },
            { value: 'floor', label: 'Floor' },
            { value: 'ceil', label: 'Ceiling' },
            { value: 'round', label: 'Round' },
          ]}
        />
      );

    default:
      return (
        <div className="text-sm text-muted-foreground">
          <p>Connect two numeric inputs to perform {data.mathType} operation.</p>
        </div>
      );
  }
});

MathProperties.displayName = 'MathProperties';

// =============================================================================
// RISK PROPERTIES
// =============================================================================

interface RiskPropertiesProps {
  nodeId: string;
  data: RiskNodeData;
}

const RiskProperties = memo(({ nodeId, data }: RiskPropertiesProps) => {
  const { updateNodeData } = useStrategyFlowStore();

  switch (data.riskType) {
    case 'maxDrawdown':
    case 'dailyLossLimit':
      return (
        <SliderInput
          label="Limit (%)"
          value={data.value || 10}
          onChange={(v) => updateNodeData(nodeId, { value: v })}
          min={1}
          max={100}
        />
      );

    case 'positionPercent':
      return (
        <SliderInput
          label="Position Size (%)"
          value={data.percentage || 10}
          onChange={(v) => updateNodeData(nodeId, { percentage: v })}
          min={1}
          max={100}
        />
      );

    case 'fixedAmount':
      return (
        <NumberInput
          label="Amount"
          value={data.value || 100}
          onChange={(v) => updateNodeData(nodeId, { value: v })}
          min={1}
          step={1}
          description="Fixed position size in units"
        />
      );

    case 'trailingStop':
      return (
        <NumberInput
          label="Distance (points)"
          value={data.value || 10}
          onChange={(v) => updateNodeData(nodeId, { value: v })}
          min={1}
          step={1}
        />
      );

    default:
      return (
        <div className="text-sm text-muted-foreground">
          <p>Configure {data.riskType} settings.</p>
        </div>
      );
  }
});

RiskProperties.displayName = 'RiskProperties';

// =============================================================================
// TRADE INFO PROPERTIES
// =============================================================================

interface TradeInfoPropertiesProps {
  nodeId: string;
  data: TradeInfoNodeData;
}

const TradeInfoProperties = memo(({ nodeId, data }: TradeInfoPropertiesProps) => {
  return (
    <div className="text-sm text-muted-foreground">
      <p>This node outputs the {data.tradeInfoType?.replace(/([A-Z])/g, ' $1').toLowerCase().trim()} of the current trade.</p>
    </div>
  );
});

TradeInfoProperties.displayName = 'TradeInfoProperties';

// =============================================================================
// LLM PROPERTIES
// =============================================================================

// Load configured API keys to show which models are available
const getConfiguredProviders = (): Set<string> => {
  try {
    const stored = localStorage.getItem('llm-api-keys');
    if (stored) {
      const keys = JSON.parse(stored);
      const configured = new Set<string>();
      if (keys.openai) configured.add('openai');
      if (keys.anthropic) configured.add('anthropic');
      if (keys.google) configured.add('google');
      return configured;
    }
  } catch {
    // Ignore
  }
  return new Set();
};

interface LLMPropertiesProps {
  nodeId: string;
  data: LLMNodeData;
}

const LLMProperties = memo(({ nodeId, data }: LLMPropertiesProps) => {
  const { updateNodeData } = useStrategyFlowStore();
  const configuredProviders = getConfiguredProviders();
  const llmType = data.llmType || 'llmDecision';

  // Filter models by configured providers
  const availableModels = LLM_MODELS.filter(m => configuredProviders.has(m.provider));
  const hasAnyKey = configuredProviders.size > 0;

  // Render custom code editor
  if (llmType === 'customCode') {
    return (
      <div className="space-y-4">
        {/* Language Selection */}
        <SelectInput
          label="Language"
          value={data.language || 'python'}
          onChange={(v) => updateNodeData(nodeId, { language: v as 'python' | 'javascript' })}
          options={[
            { value: 'python', label: 'Python' },
            { value: 'javascript', label: 'JavaScript' },
          ]}
        />

        {/* Monaco Editor */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Code</Label>
          <div className="border border-border rounded-md overflow-hidden">
            <Editor
              height="300px"
              language={data.language || 'python'}
              theme="vs-dark"
              value={data.code || ''}
              onChange={(value) => updateNodeData(nodeId, { code: value || '' })}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                padding: { top: 8 },
              }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Available: data (OHLCV), indicators, context. Return object with signal & confidence.
          </p>
        </div>

        {/* Output Schema */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Output Schema (JSON)</Label>
          <Input
            value={JSON.stringify(data.schema || {})}
            onChange={(e) => {
              try {
                updateNodeData(nodeId, { schema: JSON.parse(e.target.value) });
              } catch {
                // Ignore invalid JSON while typing
              }
            }}
            placeholder='{"signal": "string", "confidence": "number"}'
            className="text-sm font-mono"
          />
        </div>
      </div>
    );
  }

  // Standard LLM node properties
  return (
    <div className="space-y-4">
      {/* No API Keys Warning */}
      {!hasAnyKey && (
        <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-200">
            <p className="font-medium">No API keys configured</p>
            <p className="text-amber-200/80">
              Go to Settings → LLM to add API keys.
            </p>
          </div>
        </div>
      )}

      {/* Model Selection */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Model</Label>
        <Select
          value={data.model || 'gpt-4o-mini'}
          onValueChange={(v) => updateNodeData(nodeId, { model: v as LLMModel })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LLM_MODELS.map((model) => {
              const isAvailable = configuredProviders.has(model.provider);
              return (
                <SelectItem
                  key={model.id}
                  value={model.id}
                  disabled={!isAvailable}
                  className={!isAvailable ? 'opacity-50' : ''}
                >
                  <div className="flex items-center gap-2">
                    <span>{model.label}</span>
                    {!isAvailable && (
                      <span className="text-[10px] text-muted-foreground">(No key)</span>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Temperature */}
      <SliderInput
        label="Temperature"
        value={data.temperature ?? 0.3}
        onChange={(v) => updateNodeData(nodeId, { temperature: v })}
        min={0}
        max={1}
        step={0.1}
      />

      {/* Prompt */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Prompt</Label>
        <Textarea
          value={data.prompt || ''}
          onChange={(e) => updateNodeData(nodeId, { prompt: e.target.value })}
          placeholder="Describe what the LLM should analyze or decide..."
          className="min-h-[120px] text-sm resize-none"
        />
      </div>

      {/* Type-specific settings */}
      {llmType === 'sentimentAnalysis' && (
        <>
          <SliderInput
            label="Sentiment Threshold"
            value={data.sentimentThreshold ?? 0.3}
            onChange={(v) => updateNodeData(nodeId, { sentimentThreshold: v })}
            min={-1}
            max={1}
            step={0.1}
          />
          <SelectInput
            label="Sentiment Source"
            value={data.sentimentSource || 'news'}
            onChange={(v) => updateNodeData(nodeId, { sentimentSource: v as 'news' | 'social' | 'custom' })}
            options={[
              { value: 'news', label: 'News Articles' },
              { value: 'social', label: 'Social Media' },
              { value: 'custom', label: 'Custom Input' },
            ]}
          />
        </>
      )}

      {(llmType === 'regimeDetection' || llmType === 'marketRegimeClassification') && (
        <NumberInput
          label="Lookback Period (bars)"
          value={data.lookbackPeriod ?? 20}
          onChange={(v) => updateNodeData(nodeId, { lookbackPeriod: v })}
          min={5}
          max={200}
        />
      )}

      {llmType === 'parameterTuning' && (
        <SelectInput
          label="Optimization Goal"
          value={data.optimizationGoal || 'sharpe'}
          onChange={(v) => updateNodeData(nodeId, { optimizationGoal: v as 'sharpe' | 'returns' | 'drawdown' })}
          options={[
            { value: 'sharpe', label: 'Sharpe Ratio' },
            { value: 'returns', label: 'Total Returns' },
            { value: 'drawdown', label: 'Min Drawdown' },
          ]}
        />
      )}

      {llmType === 'newsSentimentSignal' && (
        <SliderInput
          label="Signal Threshold"
          value={data.sentimentThreshold ?? 0.5}
          onChange={(v) => updateNodeData(nodeId, { sentimentThreshold: v })}
          min={0}
          max={1}
          step={0.1}
        />
      )}

      {/* Output Schema */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Output Schema (JSON)</Label>
        <Input
          value={JSON.stringify(data.schema || {})}
          onChange={(e) => {
            try {
              updateNodeData(nodeId, { schema: JSON.parse(e.target.value) });
            } catch {
              // Ignore invalid JSON while typing
            }
          }}
          placeholder='{"shouldTrade": "boolean"}'
          className="text-sm font-mono"
        />
      </div>

      {/* Fallback */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Fallback Value (JSON)</Label>
        <Input
          value={JSON.stringify(data.fallback || {})}
          onChange={(e) => {
            try {
              updateNodeData(nodeId, { fallback: JSON.parse(e.target.value) });
            } catch {
              // Ignore invalid JSON while typing
            }
          }}
          placeholder='{"shouldTrade": false}'
          className="text-sm font-mono"
        />
        <p className="text-[10px] text-muted-foreground">
          Used when LLM fails or returns invalid response.
        </p>
      </div>
    </div>
  );
});

LLMProperties.displayName = 'LLMProperties';

// =============================================================================
// PORTFOLIO PROPERTIES
// =============================================================================

interface PortfolioPropertiesProps {
  nodeId: string;
  data: PortfolioNodeData;
}

const PortfolioProperties = memo(({ nodeId, data }: PortfolioPropertiesProps) => {
  const { updateNodeData } = useStrategyFlowStore();
  const action = data.portfolioAction;

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        {action === 'readHoldings' && <p>Outputs your current portfolio holdings.</p>}
        {action === 'totalValue' && <p>Outputs the total value of your portfolio.</p>}
        {action === 'dayChange' && <p>Outputs today's portfolio change.</p>}
      </div>

      {['assetWeight', 'assetPnl', 'setTargetWeight'].includes(action) && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Symbol</Label>
          <Input
            value={data.symbol || ''}
            onChange={(e) => updateNodeData(nodeId, { symbol: e.target.value.toUpperCase() })}
            placeholder="e.g. AAPL or BTC"
            className="text-sm"
          />
        </div>
      )}

      {['concentrationCheck', 'correlationCheck'].includes(action) && (
        <SliderInput
          label="Threshold (%)"
          value={data.threshold ?? 30}
          onChange={(v) => updateNodeData(nodeId, { threshold: v })}
          min={1}
          max={100}
        />
      )}

      {action === 'rebalanceSignal' && (
        <SliderInput
          label="Drift Threshold (%)"
          value={data.driftThreshold ?? 5}
          onChange={(v) => updateNodeData(nodeId, { driftThreshold: v })}
          min={1}
          max={20}
        />
      )}

      {action === 'setTargetWeight' && (
        <SliderInput
          label="Target Allocation (%)"
          value={data.targetPct ?? 10}
          onChange={(v) => updateNodeData(nodeId, { targetPct: v })}
          min={0}
          max={100}
        />
      )}

      {action === 'optimizePortfolio' && (
        <SelectInput
          label="Optimization Goal"
          value={data.optimizationGoal || 'sharpe'}
          onChange={(v) => updateNodeData(nodeId, { optimizationGoal: v as any })}
          options={[
            { value: 'sharpe', label: 'Max Sharpe Ratio' },
            { value: 'risk', label: 'Min Risk (Variance)' },
            { value: 'return', label: 'Max Return' },
          ]}
        />
      )}
    </div>
  );
});

PortfolioProperties.displayName = 'PortfolioProperties';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const RightPropertyPanel = memo(() => {
  const {
    rightPanelOpen,
    rightPanelWidth,
    selectedNodeId,
    setRightPanelOpen,
    updateNodeData,
    duplicateNode,
    deleteNode,
    lockNode,
  } = useStrategyFlowStore();

  const selectedNode = useStrategyFlowStore(selectSelectedNode);

  if (!rightPanelOpen || !selectedNode) {
    return null;
  }

  const data = selectedNode.data;
  const isLocked = data.locked;

  const renderProperties = () => {
    switch (selectedNode.type) {
      case 'indicator':
        return <IndicatorProperties nodeId={selectedNode.id} data={data as IndicatorNodeData} />;
      case 'action':
        return <ActionProperties nodeId={selectedNode.id} data={data as ActionNodeData} />;
      case 'condition':
        return <ConditionProperties nodeId={selectedNode.id} data={data as ConditionNodeData} />;
      case 'control':
        return <ControlProperties nodeId={selectedNode.id} data={data as ControlNodeData} />;
      case 'variable':
        return <VariableProperties nodeId={selectedNode.id} data={data as VariableNodeData} />;
      case 'math':
        return <MathProperties nodeId={selectedNode.id} data={data as MathNodeData} />;
      case 'risk':
        return <RiskProperties nodeId={selectedNode.id} data={data as RiskNodeData} />;
      case 'tradeInfo':
        return <TradeInfoProperties nodeId={selectedNode.id} data={data as TradeInfoNodeData} />;
      case 'llm':
        return <LLMProperties nodeId={selectedNode.id} data={data as LLMNodeData} />;
      case 'portfolio':
        return <PortfolioProperties nodeId={selectedNode.id} data={data as PortfolioNodeData} />;
      case 'environment':
        return (
          <div className="text-sm text-muted-foreground">
            <p>This node outputs the current {data.label?.toLowerCase()}.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="h-full border-l border-border/50 glass flex flex-col shadow-trading-lg animate-in slide-in-from-right duration-300"
      style={{ width: rightPanelWidth }}
    >
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border/50 bg-card/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{data.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => duplicateNode(selectedNode.id)}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
                <span className="ml-auto text-xs text-muted-foreground">⌘D</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => lockNode(selectedNode.id, !isLocked)}>
                {isLocked ? (
                  <>
                    <Unlock className="w-4 h-4 mr-2" />
                    Unlock
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Lock
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => deleteNode(selectedNode.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
                <span className="ml-auto text-xs">⌫</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setRightPanelOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Node Label Edit */}
      <div className="px-4 py-3 border-b border-border/50">
        <Label className="text-xs text-muted-foreground">Name</Label>
        <Input
          value={data.label || ''}
          onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
          className="mt-1.5 h-9 text-sm bg-muted/50 border-border/50 focus:border-primary/50 transition-colors"
          disabled={isLocked}
        />
      </div>

      {/* Properties */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {renderProperties()}
        </div>
      </ScrollArea>

      {/* Footer with node type */}
      <div className="px-4 py-2 border-t border-border/50 text-[10px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Node ID: {selectedNode.id}</span>
          <span className="capitalize">{selectedNode.type}</span>
        </div>
      </div>
    </div>
  );
});

RightPropertyPanel.displayName = 'RightPropertyPanel';
