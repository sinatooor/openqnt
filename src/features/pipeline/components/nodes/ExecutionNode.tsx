/**
 * ExecutionNode - Trade execution configuration node
 * Receives signals and executes trades based on settings
 */

import { memo, useState } from 'react';
import { Position } from '@xyflow/react';
import { Zap, Settings, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { BaseNode } from './BaseNode';
import { ExecutionNodeData } from '../../types';
import { usePipelineStore } from '../../store/pipelineStore';

interface ExecutionNodeProps {
  id: string;
  data: ExecutionNodeData;
  selected?: boolean;
}

export const ExecutionNode = memo(({ id, data, selected }: ExecutionNodeProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const toggleLive = () => {
    // Show warning before enabling live trading
    if (!data.isLive) {
      if (confirm('⚠️ Enable LIVE trading? Real money will be at risk!')) {
        updateNodeData<ExecutionNodeData>(id, { isLive: true });
      }
    } else {
      updateNodeData<ExecutionNodeData>(id, { isLive: false });
    }
  };

  return (
    <BaseNode
      title="Execute Trade"
      icon={<Zap className="w-4 h-4" />}
      color="#10b981"
      selected={selected}
      status={data.isLive ? 'running' : 'idle'}
      statusText={data.isLive ? 'LIVE' : 'Paper'}
      handles={[
        { id: 'signal-in', type: 'target', position: Position.Left, color: '#8b5cf6' },
        { id: 'result-out', type: 'source', position: Position.Right, color: '#10b981' },
      ]}
    >
      <div className="space-y-2.5">
        {/* Live Mode Warning */}
        {data.isLive && (
          <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Live trading enabled - real money at risk</span>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Trading Mode
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Paper</span>
            <Switch
              checked={data.isLive}
              onCheckedChange={toggleLive}
              className="scale-75"
            />
            <span className={`text-[10px] ${data.isLive ? 'text-red-400 font-medium' : 'text-muted-foreground'}`}>
              Live
            </span>
          </div>
        </div>

        {/* Broker Selection */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Broker</label>
          <Select
            value={data.broker}
            onValueChange={(v) => updateNodeData<ExecutionNodeData>(id, { broker: v })}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paper">Paper Trading</SelectItem>
              <SelectItem value="ig">IG Markets</SelectItem>
              <SelectItem value="ibkr">Interactive Brokers</SelectItem>
              <SelectItem value="binance">Binance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Symbol & Order Type Row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Symbol</label>
            <Input
              value={data.symbol}
              onChange={(e) => updateNodeData<ExecutionNodeData>(id, { symbol: e.target.value.toUpperCase() })}
              className="h-7 text-xs font-mono"
              placeholder="EURUSD"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Order Type</label>
            <Select
              value={data.orderType}
              onValueChange={(v) => updateNodeData<ExecutionNodeData>(id, { orderType: v as any })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market">Market</SelectItem>
                <SelectItem value="limit">Limit</SelectItem>
                <SelectItem value="stop">Stop</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Position Size Row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Size</label>
            <Input
              type="number"
              step="0.01"
              value={data.positionSize}
              onChange={(e) => updateNodeData<ExecutionNodeData>(id, { positionSize: parseFloat(e.target.value) || 0 })}
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Leverage</label>
            <Input
              type="number"
              value={data.leverage}
              onChange={(e) => updateNodeData<ExecutionNodeData>(id, { leverage: parseInt(e.target.value) || 1 })}
              className="h-7 text-xs"
            />
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-6 text-[10px] text-muted-foreground"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Settings className="w-3 h-3 mr-1" />
          {showAdvanced ? 'Hide' : 'Show'} Risk Settings
        </Button>

        {/* Advanced: SL/TP */}
        {showAdvanced && (
          <div className="grid grid-cols-2 gap-2 p-2 bg-muted/30 rounded">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Stop Loss (pips)</label>
              <Input
                type="number"
                value={data.stopLoss || ''}
                onChange={(e) => updateNodeData<ExecutionNodeData>(id, { stopLoss: parseFloat(e.target.value) || undefined })}
                className="h-7 text-xs"
                placeholder="—"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Take Profit (pips)</label>
              <Input
                type="number"
                value={data.takeProfit || ''}
                onChange={(e) => updateNodeData<ExecutionNodeData>(id, { takeProfit: parseFloat(e.target.value) || undefined })}
                className="h-7 text-xs"
                placeholder="—"
              />
            </div>
          </div>
        )}

        {/* Last Execution */}
        {data.lastExecution && (
          <div className="p-2 bg-muted/30 rounded text-[10px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last Order:</span>
              <Badge 
                variant={data.lastExecution.status === 'filled' ? 'default' : 'secondary'}
                className="text-[9px] h-4"
              >
                {data.lastExecution.status}
              </Badge>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

ExecutionNode.displayName = 'ExecutionNode';
