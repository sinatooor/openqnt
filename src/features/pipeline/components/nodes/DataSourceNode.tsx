/**
 * DataSourceNode - Market data input node
 * Provides price feeds to connected strategy/prompt nodes
 */

import { memo, useState } from 'react';
import { Position } from '@xyflow/react';
import { Database, RefreshCw, Wifi, WifiOff, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { BaseNode } from './BaseNode';
import { DataSourceNodeData } from '../../types';
import { usePipelineStore } from '../../store/pipelineStore';

interface DataSourceNodeProps {
  id: string;
  data: DataSourceNodeData;
  selected?: boolean;
}

const SOURCES = [
  { id: 'yahoo', label: 'Yahoo Finance', type: 'free' },
  { id: 'fmp', label: 'FMP', type: 'api' },
  { id: 'polygon', label: 'Polygon.io', type: 'api' },
  { id: 'binance', label: 'Binance', type: 'crypto' },
  { id: 'ig', label: 'IG Markets', type: 'broker' },
] as const;

const DATA_TYPES = [
  { id: 'ohlcv', label: 'OHLCV Candles' },
  { id: 'tick', label: 'Tick Data' },
  { id: 'orderbook', label: 'Order Book' },
  { id: 'news', label: 'News Feed' },
  { id: 'sentiment', label: 'Sentiment' },
] as const;

export const DataSourceNode = memo(({ id, data, selected }: DataSourceNodeProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const toggleConnection = async () => {
    if (data.isConnected) {
      updateNodeData<DataSourceNodeData>(id, { isConnected: false, lastPrice: undefined });
      return;
    }

    setIsConnecting(true);
    try {
      // Simulate connection delay
      await new Promise((r) => setTimeout(r, 1000));
      
      // Mock price data
      updateNodeData<DataSourceNodeData>(id, { 
        isConnected: true,
        lastPrice: 1.0850 + Math.random() * 0.01,
        lastUpdate: new Date().toISOString(),
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const refreshData = async () => {
    if (!data.isConnected) return;
    
    setIsConnecting(true);
    await new Promise((r) => setTimeout(r, 500));
    
    const prevPrice = data.lastPrice || 1.0850;
    const change = (Math.random() - 0.5) * 0.001;
    
    updateNodeData<DataSourceNodeData>(id, { 
      lastPrice: prevPrice + change,
      lastUpdate: new Date().toISOString(),
    });
    setIsConnecting(false);
  };

  return (
    <BaseNode
      title="Data Source"
      icon={<Database className="w-4 h-4" />}
      color="#6366f1"
      selected={selected}
      status={data.isConnected ? 'running' : 'idle'}
      statusText={data.isConnected ? 'Live' : 'Disconnected'}
      handles={[
        { id: 'data-out', type: 'source', position: Position.Right, color: '#6366f1' },
      ]}
    >
      <div className="space-y-2.5">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {data.isConnected ? (
              <Wifi className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span className={`text-[10px] ${data.isConnected ? 'text-green-500' : 'text-muted-foreground'}`}>
              {data.isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
          {data.isConnected && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={refreshData}
              disabled={isConnecting}
            >
              <RefreshCw className={`w-3 h-3 ${isConnecting ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>

        {/* Source Selection */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Source</label>
          <Select
            value={data.source}
            onValueChange={(v) => updateNodeData<DataSourceNodeData>(id, { source: v })}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2">
                    <span>{s.label}</span>
                    <Badge variant="outline" className="text-[8px] h-3 px-1">
                      {s.type}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Symbol & Data Type */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Symbol</label>
            <Input
              value={data.symbol}
              onChange={(e) => updateNodeData<DataSourceNodeData>(id, { symbol: e.target.value.toUpperCase() })}
              className="h-7 text-xs font-mono"
              placeholder="EURUSD"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Type</label>
            <Select
              value={data.dataType}
              onValueChange={(v) => updateNodeData<DataSourceNodeData>(id, { dataType: v })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map((dt) => (
                  <SelectItem key={dt.id} value={dt.id}>
                    {dt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Timeframe */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Timeframe</label>
          <Select
            value={data.timeframe}
            onValueChange={(v) => updateNodeData<DataSourceNodeData>(id, { timeframe: v })}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">1 Minute</SelectItem>
              <SelectItem value="5m">5 Minutes</SelectItem>
              <SelectItem value="15m">15 Minutes</SelectItem>
              <SelectItem value="1h">1 Hour</SelectItem>
              <SelectItem value="4h">4 Hours</SelectItem>
              <SelectItem value="1d">Daily</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Connect Button */}
        <Button
          size="sm"
          variant={data.isConnected ? 'destructive' : 'default'}
          className="w-full h-7 text-xs"
          onClick={toggleConnection}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              Connecting...
            </>
          ) : data.isConnected ? (
            <>
              <WifiOff className="w-3 h-3 mr-1" />
              Disconnect
            </>
          ) : (
            <>
              <Wifi className="w-3 h-3 mr-1" />
              Connect
            </>
          )}
        </Button>

        {/* Live Price Display */}
        {data.isConnected && data.lastPrice !== undefined && (
          <div className="p-2 bg-muted/30 rounded">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Last Price</span>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-500" />
                <span className="text-sm font-mono font-medium text-green-500">
                  {data.lastPrice.toFixed(5)}
                </span>
              </div>
            </div>
            <div className="text-[9px] text-muted-foreground text-right mt-1">
              Updated: {data.lastUpdate ? new Date(data.lastUpdate).toLocaleTimeString() : '—'}
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

DataSourceNode.displayName = 'DataSourceNode';
