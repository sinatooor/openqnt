/**
 * RightPropertyPanel - Settings panel that opens when a node is selected
 * Based on the reference screenshots showing node properties on the right side
 */

import { memo, useCallback } from 'react';
import { X, Lock, Unlock, Copy, Trash2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  EnvironmentNodeData,
  ControlNodeData,
  VariableNodeData,
  TIMEFRAME_OPTIONS,
} from '../types';

// =============================================================================
// PROPERTY EDITORS
// =============================================================================

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
