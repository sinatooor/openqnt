/**
 * RightPropertyPanel - Settings panel that opens when a node is selected
 * Based on the reference screenshots showing node properties on the right side
 */

import { memo, useCallback, useState } from 'react';
import { X, Lock, Unlock, Copy, Trash2, MoreHorizontal, AlertTriangle, ExternalLink, Sparkles, Plus, Trash } from 'lucide-react';
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
  AgentNodeData,
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
            {isDetached ? "Edge" : "Fixed"}
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
      case 'ichimoku':
        return (
          <>
            <NumberInput
              label="Conversion (Tenkan)"
              value={params.conversionPeriod as number || 9}
              onChange={(v) => updateParam('conversionPeriod', v)}
              min={1}
            />
            <NumberInput
              label="Base (Kijun)"
              value={params.basePeriod as number || 26}
              onChange={(v) => updateParam('basePeriod', v)}
              min={1}
            />
            <NumberInput
              label="Senkou B Period"
              value={params.laggingSpan2Period as number || 52}
              onChange={(v) => updateParam('laggingSpan2Period', v)}
              min={1}
            />
            <NumberInput
              label="Displacement"
              value={params.displacement as number || 26}
              onChange={(v) => updateParam('displacement', v)}
              min={1}
            />
          </>
        );

      case 'dmi':
        return (
          <SliderInput
            label="Period"
            value={params.period as number || 14}
            onChange={(v) => updateParam('period', v)}
            min={1}
            max={100}
          />
        );

      case 'donchian':
        return (
          <SliderInput
            label="Period"
            value={params.period as number || 20}
            onChange={(v) => updateParam('period', v)}
            min={1}
            max={100}
          />
        );

      case 'alligator':
        return (
          <>
            <NumberInput
              label="Jaw Period"
              value={params.jawPeriod as number || 13}
              onChange={(v) => updateParam('jawPeriod', v)}
            />
            <NumberInput
              label="Teeth Period"
              value={params.teethPeriod as number || 8}
              onChange={(v) => updateParam('teethPeriod', v)}
            />
            <NumberInput
              label="Lips Period"
              value={params.lipsPeriod as number || 5}
              onChange={(v) => updateParam('lipsPeriod', v)}
            />
          </>
        );

      case 'aroon':
        return (
          <SliderInput
            label="Period"
            value={params.period as number || 14}
            onChange={(v) => updateParam('period', v)}
            min={1}
            max={100}
          />
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

  const toggleDetached = useCallback((field: string) => {
    const current = new Set(data.detachedInputs || []);
    if (current.has(field)) {
      current.delete(field);
    } else {
      current.add(field);
    }
    updateNodeData(nodeId, { detachedInputs: Array.from(current) });
  }, [nodeId, data.detachedInputs, updateNodeData]);

  const isDetached = (field: string) => (data.detachedInputs || []).includes(field);

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
          <DetachableInput
            label="Size"
            value={data.size || 0.1}
            onChange={(v) => updateField('size', v)}
            isDetached={isDetached('size')}
            onDetachedChange={() => toggleDetached('size')}
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
            <DetachableInput
              label="Limit Price"
              value={data.limitPrice || 0}
              onChange={(v) => updateField('limitPrice', v)}
              isDetached={isDetached('limitPrice')}
              onDetachedChange={() => toggleDetached('limitPrice')}
              step={0.00001}
            />
          )}
        </div>
      );

    case 'stopLoss':
      return (
        <div className="space-y-4">
          <DetachableInput
            label="Stop Price"
            value={data.stopPrice || 0}
            onChange={(v) => updateField('stopPrice', v)}
            isDetached={isDetached('stopPrice')}
            onDetachedChange={() => toggleDetached('stopPrice')}
            step={0.00001}
            description="Price level to close the position"
          />
        </div>
      );

    case 'takeProfit':
      return (
        <div className="space-y-4">
          <DetachableInput
            label="Take Profit Price"
            value={data.takeProfitPrice || 0}
            onChange={(v) => updateField('takeProfitPrice', v)}
            isDetached={isDetached('takeProfitPrice')}
            onDetachedChange={() => toggleDetached('takeProfitPrice')}
            step={0.00001}
            description="Price level to take profit"
          />
        </div>
      );

    case 'trailingStop':
      return (
        <div className="space-y-4">
          <DetachableInput
            label="Trailing Distance"
            value={data.trailingDistance || 10}
            onChange={(v) => updateField('trailingDistance', v)}
            isDetached={isDetached('trailingDistance')}
            onDetachedChange={() => toggleDetached('trailingDistance')}
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

    case 'phoneCall':
      return (
        <div className="space-y-4">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-xs text-red-200/80">
              Places an automated phone call via Twilio Voice API. Use for urgent, time-sensitive alerts.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Phone Number</Label>
            <Input
              value={data.phoneNumber || ''}
              onChange={(e) => updateField('phoneNumber', e.target.value)}
              placeholder="+1234567890"
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Message (Text-to-Speech)</Label>
            <Textarea
              value={data.message || ''}
              onChange={(e) => updateField('message', e.target.value)}
              placeholder="Urgent trading alert..."
              className="text-sm min-h-[80px]"
            />
          </div>
          <SelectInput
            label="Voice"
            value={data.voiceType || 'alice'}
            onChange={(v) => updateField('voiceType', v)}
            options={[
              { value: 'alice', label: 'Alice (Natural)' },
              { value: 'man', label: 'Man' },
              { value: 'woman', label: 'Woman' },
              { value: 'Polly.Joanna', label: 'Polly Joanna (AWS)' },
            ]}
          />
          <SelectInput
            label="Urgency Level"
            value={data.urgencyLevel || 'high'}
            onChange={(v) => updateField('urgencyLevel', v)}
            options={[
              { value: 'low', label: 'Low (single call)' },
              { value: 'medium', label: 'Medium (retry once)' },
              { value: 'high', label: 'High (retry 3x, escalate to SMS)' },
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

  const toggleDetached = useCallback((field: string) => {
    const current = new Set(data.detachedInputs || []);
    if (current.has(field)) {
      current.delete(field);
    } else {
      current.add(field);
    }
    updateNodeData(nodeId, { detachedInputs: Array.from(current) });
  }, [nodeId, data.detachedInputs, updateNodeData]);

  const isDetached = (field: string) => (data.detachedInputs || []).includes(field);

  switch (data.conditionType) {
    case 'compare':
    case 'threshold':
      return (
        <div className="space-y-4">
          <DetachableInput
            label="Input A"
            value={Number(data.inputA) || 0}
            onChange={(v) => updateField('inputA', v)}
            isDetached={isDetached('inputA')}
            onDetachedChange={() => toggleDetached('inputA')}
            step={0.0001}
          />
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
            <DetachableInput
              label="Threshold Value"
              value={data.value || 0}
              onChange={(v) => updateField('value', v)}
              isDetached={isDetached('value')}
              onDetachedChange={() => toggleDetached('value')}
              step={0.01}
            />
          )}
          {data.conditionType === 'compare' && (
            <DetachableInput
              label="Input B"
              value={Number(data.inputB) || 0}
              onChange={(v) => updateField('inputB', v)}
              isDetached={isDetached('inputB')}
              onDetachedChange={() => toggleDetached('inputB')}
              step={0.0001}
            />
          )}
        </div>
      );

    case 'range':
      return (
        <div className="space-y-4">
          <DetachableInput
            label="Minimum"
            value={data.minValue || 0}
            onChange={(v) => updateField('minValue', v)}
            isDetached={isDetached('minValue')}
            onDetachedChange={() => toggleDetached('minValue')}
            step={0.01}
          />
          <DetachableInput
            label="Maximum"
            value={data.maxValue || 100}
            onChange={(v) => updateField('maxValue', v)}
            isDetached={isDetached('maxValue')}
            onDetachedChange={() => toggleDetached('maxValue')}
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

  const toggleDetached = useCallback((field: string) => {
    const current = new Set(data.detachedInputs || []);
    if (current.has(field)) {
      current.delete(field);
    } else {
      current.add(field);
    }
    updateNodeData(nodeId, { detachedInputs: Array.from(current) });
  }, [nodeId, data.detachedInputs, updateNodeData]);

  const isDetached = (field: string) => (data.detachedInputs || []).includes(field);

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
        <DetachableInput
          label="Value"
          value={data.value as number || 0}
          onChange={(v) => updateNodeData(nodeId, { value: v })}
          isDetached={isDetached('value')}
          onDetachedChange={() => toggleDetached('value')}
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

  const toggleDetached = useCallback((field: string) => {
    const current = new Set(data.detachedInputs || []);
    if (current.has(field)) {
      current.delete(field);
    } else {
      current.add(field);
    }
    updateNodeData(nodeId, { detachedInputs: Array.from(current) });
  }, [nodeId, data.detachedInputs, updateNodeData]);

  const isDetached = (field: string) => (data.detachedInputs || []).includes(field);

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
        <div className="space-y-4">
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
          <DetachableInput
            label="Input"
            value={data.input || 0}
            onChange={(v) => updateNodeData(nodeId, { input: v })}
            isDetached={isDetached('input')}
            onDetachedChange={() => toggleDetached('input')}
            step={0.0001}
          />
        </div>
      );

    default:
      return (
        <div className="space-y-4">
          <DetachableInput
            label="Input A"
            value={data.inputA || 0}
            onChange={(v) => updateNodeData(nodeId, { inputA: v })}
            isDetached={isDetached('inputA')}
            onDetachedChange={() => toggleDetached('inputA')}
            step={0.0001}
          />
          <DetachableInput
            label="Input B"
            value={data.inputB || 0}
            onChange={(v) => updateNodeData(nodeId, { inputB: v })}
            isDetached={isDetached('inputB')}
            onDetachedChange={() => toggleDetached('inputB')}
            step={0.0001}
          />
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
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const configuredProviders = getConfiguredProviders();
  const llmType = data.llmType || 'llmDecision';

  // Filter models by configured providers
  const availableModels = LLM_MODELS.filter(m => configuredProviders.has(m.provider));
  const hasAnyKey = configuredProviders.size > 0;

  // Render custom code editor
  if (llmType === 'customCode') {
    const handleAddInput = () => {
      const id = `input_${Date.now()}`;
      const newInputs = [...(data.customInputs || []), { id, label: 'New Input', dataType: 'any' }];
      updateNodeData(nodeId, { customInputs: newInputs });
    };

    const handleRemoveInput = (id: string) => {
      const newInputs = (data.customInputs || []).filter(i => i.id !== id);
      updateNodeData(nodeId, { customInputs: newInputs });
    };

    const handleAddOutput = () => {
      const id = `output_${Date.now()}`;
      const newOutputs = [...(data.customOutputs || []), { id, label: 'New Output', dataType: 'any' }];
      updateNodeData(nodeId, { customOutputs: newOutputs });
    };

    const handleRemoveOutput = (id: string) => {
      const newOutputs = (data.customOutputs || []).filter(o => o.id !== id);
      updateNodeData(nodeId, { customOutputs: newOutputs });
    };

    const handleGenerateCode = async () => {
      if (!aiPrompt) return;
      setIsGenerating(true);
      try {
        // Construct system prompt with current handles
        const inputs = (data.customInputs || []).map(i => i.id).join(', ');
        const outputs = (data.customOutputs || []).map(o => o.id).join(', ');
        
        const systemPrompt = `You are an expert quantitative developer. Generate a ${data.language || 'python'} function for a custom trading node.
Inputs available in 'context': ${inputs} (and default 'data', 'indicators')
Expected output format: JSON with keys: ${outputs || 'signal, confidence'}
User request: ${aiPrompt}`;

        // Call AI service (mocking for now, or using a generic analyze call)
        // In a real app, this would be a dedicated endpoint
        const response = await fetch(`${import.meta.env.VITE_ORCHESTRATOR_URL || "http://localhost:3000"}/api/ai/generate-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: systemPrompt, language: data.language || 'python' })
        });
        
        const result = await response.json();
        if (result.code) {
          updateNodeData(nodeId, { code: result.code });
        }
      } catch (error) {
        console.error('Failed to generate code:', error);
      } finally {
        setIsGenerating(false);
        setAiPrompt('');
      }
    };

    return (
      <div className="space-y-6">
        {/* Custom Handles Management */}
        <div className="space-y-4 p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-white/70 uppercase tracking-wider">Dynamic Handles</Label>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground uppercase">Inputs</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleAddInput}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-2">
                {(data.customInputs || []).map(input => (
                  <div key={input.id} className="flex gap-2">
                    <Input 
                      className="h-7 text-[10px]" 
                      value={input.label} 
                      onChange={(e) => {
                        const newInputs = data.customInputs!.map(i => i.id === input.id ? { ...i, label: e.target.value } : i);
                        updateNodeData(nodeId, { customInputs: newInputs });
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={() => handleRemoveInput(input.id)}>
                      <Trash className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground uppercase">Outputs</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleAddOutput}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-2">
                {(data.customOutputs || []).map(output => (
                  <div key={output.id} className="flex gap-2">
                    <Input 
                      className="h-7 text-[10px]" 
                      value={output.label} 
                      onChange={(e) => {
                        const newOutputs = data.customOutputs!.map(o => o.id === output.id ? { ...o, label: e.target.value } : o);
                        updateNodeData(nodeId, { customOutputs: newOutputs });
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={() => handleRemoveOutput(output.id)}>
                      <Trash className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI Assistant Section */}
        <div className="space-y-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
          <div className="flex items-center gap-2 text-purple-400">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase">AI Code Assistant</span>
          </div>
          <Textarea 
            placeholder="Describe what this node should do... (e.g., 'Buy if RSI < 30 and volume is increasing')"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="text-xs min-h-[60px] bg-black/20 border-purple-500/20"
          />
          <Button 
            className="w-full h-8 bg-purple-600 hover:bg-purple-500 text-white text-xs gap-2"
            onClick={handleGenerateCode}
            disabled={isGenerating || !aiPrompt}
          >
            {isGenerating ? 'Generating...' : 'Generate Code'}
          </Button>
        </div>

        {/* Language Selection */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Execution Language</Label>
          <Select
            value={data.language || 'python'}
            onValueChange={(v) => updateNodeData(nodeId, { language: v as 'python' | 'javascript' })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Monaco Editor */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Code Editor</Label>
          <div className="border border-border rounded-md overflow-hidden ring-1 ring-white/5">
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
            Default objects: <code>data</code>, <code>indicators</code>, <code>context</code>.
          </p>
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

  const isDetached = (field: string) => (data.detachedInputs || []).includes(field);
  const toggleDetached = (field: string) => {
    const detached = data.detachedInputs || [];
    const newDetached = detached.includes(field)
      ? detached.filter(f => f !== field)
      : [...detached, field];
    updateNodeData(nodeId, { detachedInputs: newDetached });
  };

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
        <DetachableInput
          label="Threshold (%)"
          value={data.threshold ?? 30}
          onChange={(v) => updateNodeData(nodeId, { threshold: v })}
          isDetached={isDetached('threshold')}
          onDetachedChange={() => toggleDetached('threshold')}
          min={1}
          max={100}
        />
      )}

      {action === 'rebalanceSignal' && (
        <DetachableInput
          label="Drift Threshold (%)"
          value={data.driftThreshold ?? 5}
          onChange={(v) => updateNodeData(nodeId, { driftThreshold: v })}
          isDetached={isDetached('driftThreshold')}
          onDetachedChange={() => toggleDetached('driftThreshold')}
          min={1}
          max={20}
        />
      )}

      {action === 'setTargetWeight' && (
        <DetachableInput
          label="Target Allocation (%)"
          value={data.targetPct ?? 10}
          onChange={(v) => updateNodeData(nodeId, { targetPct: v })}
          isDetached={isDetached('targetPct')}
          onDetachedChange={() => toggleDetached('targetPct')}
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
// AGENT PROPERTIES
// =============================================================================

interface AgentPropertiesProps {
  nodeId: string;
  data: AgentNodeData;
}

const MultiSelectChips = memo(({ label, values, onChange, options, description }: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: { value: string; label: string }[];
  description?: string;
}) => (
  <div className="space-y-2">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const active = values.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => {
              if (active) onChange(values.filter(v => v !== opt.value));
              else onChange([...values, opt.value]);
            }}
            className={cn(
              "px-2 py-1 text-[10px] rounded-md border transition-colors",
              active
                ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
    {description && <p className="text-[10px] text-muted-foreground/70">{description}</p>}
  </div>
));
MultiSelectChips.displayName = 'MultiSelectChips';

const TagsInput = memo(({ label, values, onChange, placeholder, description }: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  description?: string;
}) => (
  <div className="space-y-2">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input
      value={values.join(', ')}
      onChange={(e) => {
        const items = e.target.value.split(/[,]+/).map(s => s.trim()).filter(Boolean);
        onChange(items);
      }}
      placeholder={placeholder}
      className="text-sm"
    />
    {description && <p className="text-[10px] text-muted-foreground/70">{description}</p>}
  </div>
));
TagsInput.displayName = 'TagsInput';

const AgentProperties = memo(({ nodeId, data }: AgentPropertiesProps) => {
  const { updateNodeData } = useStrategyFlowStore();

  const agentType = data.agentNodeType || data.agentType;

  return (
    <div className="space-y-4">
      {/* Agent Description */}
      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <p className="text-xs text-amber-200/80">
          This node runs an AI agent that analyzes data and produces signals.
          Agents call LLMs and are not available during backtesting.
        </p>
      </div>

      {/* Model Override */}
      <SelectInput
        label="LLM Model"
        value={data.model || 'gemini-2.0-flash'}
        onChange={(v) => updateNodeData(nodeId, { model: v })}
        options={[
          { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
          { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
          { value: 'gpt-4o', label: 'GPT-4o' },
          { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
        ]}
      />

      {/* Symbols */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Target Symbols</Label>
        <Input
          value={(data.symbols || []).join(', ')}
          onChange={(e) => {
            const syms = e.target.value
              .split(/[,\s]+/)
              .map(s => s.trim().toUpperCase())
              .filter(Boolean);
            updateNodeData(nodeId, { symbols: syms });
          }}
          placeholder="e.g. AAPL, MSFT, NVDA"
          className="text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          Comma-separated symbols to analyze. Leave empty to use strategy symbol.
        </p>
      </div>

      {/* Confidence Threshold */}
      <SliderInput
        label="Confidence Threshold"
        value={data.confidenceThreshold ?? 0.5}
        onChange={(v) => updateNodeData(nodeId, { confidenceThreshold: v })}
        min={0}
        max={1}
        step={0.05}
      />
      <p className="text-[10px] text-muted-foreground -mt-2">
        Minimum confidence (0-1) required to emit a signal to downstream nodes.
      </p>

      {/* ── Per-Agent-Type Settings ──────────────────────────────────── */}

      {/* News Agent Settings */}
      {agentType === 'newsAgentNode' && (
        <div className="space-y-3 pt-2 border-t border-white/5">
          <p className="text-[10px] font-medium text-blue-400 uppercase tracking-wider">News Settings</p>
          <MultiSelectChips
            label="News Sources"
            values={data.newsSources || ['newsapi', 'sec']}
            onChange={(v) => updateNodeData(nodeId, { newsSources: v })}
            options={[
              { value: 'newsapi', label: 'NewsAPI' },
              { value: 'sec', label: 'SEC Filings' },
              { value: 'bloomberg', label: 'Bloomberg' },
              { value: 'reuters', label: 'Reuters' },
              { value: 'finnhub', label: 'Finnhub' },
              { value: 'alphavantage', label: 'Alpha Vantage' },
            ]}
            description="Select which news services to monitor"
          />
          <TagsInput
            label="Keywords Filter"
            values={data.newsKeywords || []}
            onChange={(v) => updateNodeData(nodeId, { newsKeywords: v })}
            placeholder="e.g. earnings, FDA approval, tariff"
            description="Additional keywords to filter news (comma-separated)"
          />
          <NumberInput
            label="Max News Age (hours)"
            value={data.newsMaxAge ?? 24}
            onChange={(v) => updateNodeData(nodeId, { newsMaxAge: v })}
            min={1}
            max={168}
            step={1}
            description="Only consider news articles within this time window"
          />
        </div>
      )}

      {/* Social Monitor Settings */}
      {agentType === 'socialAgentNode' && (
        <div className="space-y-3 pt-2 border-t border-white/5">
          <p className="text-[10px] font-medium text-pink-400 uppercase tracking-wider">Social Monitor Settings</p>
          <MultiSelectChips
            label="Platforms"
            values={data.socialPlatforms || ['twitter', 'reddit']}
            onChange={(v) => updateNodeData(nodeId, { socialPlatforms: v })}
            options={[
              { value: 'twitter', label: 'Twitter / X' },
              { value: 'reddit', label: 'Reddit' },
              { value: 'truthsocial', label: 'Truth Social' },
              { value: 'stocktwits', label: 'StockTwits' },
              { value: 'youtube', label: 'YouTube' },
            ]}
            description="Which social platforms to monitor"
          />
          <TagsInput
            label="Accounts to Track"
            values={data.socialAccounts || []}
            onChange={(v) => updateNodeData(nodeId, { socialAccounts: v })}
            placeholder="e.g. @realDonaldTrump, @elonmusk"
            description="Specific accounts whose posts trigger analysis"
          />
          <TagsInput
            label="Keywords / Hashtags"
            values={data.socialKeywords || []}
            onChange={(v) => updateNodeData(nodeId, { socialKeywords: v })}
            placeholder="e.g. #tariffs, $AAPL, interest rates"
            description="Track specific keywords or cashtags"
          />
        </div>
      )}

      {/* Fundamentals Agent Settings */}
      {agentType === 'fundamentalsAgentNode' && (
        <div className="space-y-3 pt-2 border-t border-white/5">
          <p className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">Fundamentals Settings</p>
          <MultiSelectChips
            label="Report Types"
            values={data.reportTypes || ['10-K', '10-Q', 'earnings']}
            onChange={(v) => updateNodeData(nodeId, { reportTypes: v })}
            options={[
              { value: '10-K', label: '10-K (Annual)' },
              { value: '10-Q', label: '10-Q (Quarterly)' },
              { value: 'earnings', label: 'Earnings Reports' },
              { value: 'guidance', label: 'Forward Guidance' },
              { value: '8-K', label: '8-K (Current Events)' },
              { value: 'proxy', label: 'Proxy Statements' },
            ]}
            description="Which SEC filings and reports to analyze"
          />
          <MultiSelectChips
            label="Analyst Sources"
            values={data.analystSources || ['wallstreet', 'institutional']}
            onChange={(v) => updateNodeData(nodeId, { analystSources: v })}
            options={[
              { value: 'wallstreet', label: 'Wall Street Analysts' },
              { value: 'institutional', label: 'Institutional Reports' },
              { value: 'insider', label: 'Insider Transactions' },
              { value: 'shortinterest', label: 'Short Interest Data' },
            ]}
            description="Sources for expert expectations and analyst ratings"
          />
          <NumberInput
            label="Lookback Quarters"
            value={data.lookbackQuarters ?? 4}
            onChange={(v) => updateNodeData(nodeId, { lookbackQuarters: v })}
            min={1}
            max={20}
            step={1}
            description="How many quarters of financial history to analyze"
          />
        </div>
      )}

      {/* Technical Agent Settings */}
      {agentType === 'technicalAgentNode' && (
        <div className="space-y-3 pt-2 border-t border-white/5">
          <p className="text-[10px] font-medium text-cyan-400 uppercase tracking-wider">Technical Analysis Settings</p>
          <MultiSelectChips
            label="Timeframes"
            values={data.technicalTimeframes || ['1H', '4H', '1D']}
            onChange={(v) => updateNodeData(nodeId, { technicalTimeframes: v })}
            options={[
              { value: '5m', label: '5min' },
              { value: '15m', label: '15min' },
              { value: '1H', label: '1H' },
              { value: '4H', label: '4H' },
              { value: '1D', label: 'Daily' },
              { value: '1W', label: 'Weekly' },
            ]}
            description="Which timeframes to run technical analysis on"
          />
          <MultiSelectChips
            label="Focus Indicators"
            values={data.technicalIndicators || ['rsi', 'macd', 'bollinger', 'volume']}
            onChange={(v) => updateNodeData(nodeId, { technicalIndicators: v })}
            options={[
              { value: 'rsi', label: 'RSI' },
              { value: 'macd', label: 'MACD' },
              { value: 'bollinger', label: 'Bollinger' },
              { value: 'ema', label: 'EMA' },
              { value: 'volume', label: 'Volume Profile' },
              { value: 'ichimoku', label: 'Ichimoku' },
              { value: 'fibonacci', label: 'Fibonacci' },
              { value: 'support_resistance', label: 'S/R Levels' },
            ]}
            description="Which indicators the agent should focus on"
          />
        </div>
      )}

      {/* Research Agent Settings */}
      {agentType === 'researchAgentNode' && (
        <div className="space-y-3 pt-2 border-t border-white/5">
          <p className="text-[10px] font-medium text-teal-400 uppercase tracking-wider">Research Settings</p>
          <MultiSelectChips
            label="Research Tools"
            values={data.researchTools || ['quantstats', 'var', 'stress_test']}
            onChange={(v) => updateNodeData(nodeId, { researchTools: v })}
            options={[
              { value: 'quantstats', label: 'QuantStats' },
              { value: 'montecarlo', label: 'Monte Carlo' },
              { value: 'var', label: 'VaR / CVaR' },
              { value: 'stress_test', label: 'Stress Testing' },
              { value: 'walk_forward', label: 'Walk-Forward' },
              { value: 'parameter_sweep', label: 'Param Sweep' },
              { value: 'cointegration', label: 'Cointegration' },
              { value: 'hmm_regime', label: 'HMM Regime' },
            ]}
            description="Which research tools from the Research page to use"
          />
          <SelectInput
            label="Research Depth"
            value={data.researchDepth || 'standard'}
            onChange={(v) => updateNodeData(nodeId, { researchDepth: v })}
            options={[
              { value: 'quick', label: 'Quick (1-2 min)' },
              { value: 'standard', label: 'Standard (5-10 min)' },
              { value: 'deep', label: 'Deep (15-30 min)' },
            ]}
          />
        </div>
      )}

      {/* Agent Type Info */}
      <div className="pt-2 border-t border-white/5 space-y-1">
        <p className="text-[10px] text-muted-foreground">
          Agent Type: <span className="font-mono text-foreground/70">{data.agentType}</span>
        </p>
      </div>
    </div>
  );
});

AgentProperties.displayName = 'AgentProperties';

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
      case 'agent':
        return <AgentProperties nodeId={selectedNode.id} data={data as AgentNodeData} />;
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
