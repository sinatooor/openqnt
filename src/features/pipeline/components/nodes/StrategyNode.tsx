/**
 * StrategyNode - Node containing Blockly strategy blocks
 * This is the core node where users build their trading logic
 */

import { memo, useState } from 'react';
import { Position } from '@xyflow/react';
import { Blocks, Edit2, Play, Pause, ChevronRight } from 'lucide-react';
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
import { StrategyNodeData } from '../../types';
import { usePipelineStore } from '../../store/pipelineStore';

interface StrategyNodeProps {
  id: string;
  data: StrategyNodeData;
  selected?: boolean;
}

export const StrategyNode = memo(({ id, data, selected }: StrategyNodeProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const setSelectedNode = usePipelineStore((s) => s.setSelectedNode);

  const toggleActive = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNodeData<StrategyNodeData>(id, { isActive: !data.isActive });
  };

  const handleOpenBlockly = () => {
    // Set this node as selected and trigger Blockly editor opening
    setSelectedNode(id);
    // Dispatch custom event to open Blockly modal
    window.dispatchEvent(new CustomEvent('openBlocklyEditor', { 
      detail: { nodeId: id, xml: data.blocklyXml } 
    }));
  };

  return (
    <BaseNode
      title={data.strategyName || 'Strategy'}
      icon={<Blocks className="w-4 h-4" />}
      color="#8b5cf6"
      selected={selected}
      status={data.isActive ? 'running' : 'idle'}
      statusText={data.isActive ? 'Active' : 'Paused'}
      handles={[
        { id: 'data-in', type: 'target', position: Position.Left, color: '#3b82f6' },
        { id: 'signal-out', type: 'source', position: Position.Right, color: '#8b5cf6' },
      ]}
    >
      <div className="space-y-2.5">
        {/* Strategy Name - Editable */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Name</label>
          {isEditingName ? (
            <Input
              value={data.strategyName}
              onChange={(e) => updateNodeData<StrategyNodeData>(id, { strategyName: e.target.value })}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
              autoFocus
              className="h-7 text-xs"
            />
          ) : (
            <div 
              className="h-7 px-2 flex items-center text-xs bg-muted/50 rounded border border-transparent hover:border-border cursor-pointer"
              onClick={() => setIsEditingName(true)}
            >
              {data.strategyName}
              <Edit2 className="w-3 h-3 ml-auto text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Signal Type */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Signal Output</label>
          <Select
            value={data.signalType}
            onValueChange={(v) => updateNodeData<StrategyNodeData>(id, { signalType: v as any })}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buy">Buy Only</SelectItem>
              <SelectItem value="sell">Sell Only</SelectItem>
              <SelectItem value="both">Buy & Sell</SelectItem>
              <SelectItem value="value">Numeric Value</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Blockly Editor Button */}
        <Button 
          variant="outline" 
          size="sm"
          className="w-full h-8 text-xs justify-between group"
          onClick={handleOpenBlockly}
        >
          <span className="flex items-center gap-1.5">
            <Blocks className="w-3.5 h-3.5" />
            {data.blocklyXml ? 'Edit Strategy Blocks' : 'Create Strategy'}
          </span>
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Button>

        {/* Last Signal Display */}
        {data.lastSignal && (
          <div className="p-2 bg-muted/30 rounded text-[10px] flex items-center justify-between">
            <span className="text-muted-foreground">Last Signal:</span>
            <Badge 
              variant={data.lastSignal.type === 'buy' ? 'default' : 'destructive'}
              className="text-[9px] h-4"
            >
              {data.lastSignal.type.toUpperCase()}
            </Badge>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 pt-1 border-t border-border/50">
          <Button 
            size="sm" 
            variant={data.isActive ? 'secondary' : 'default'}
            className="flex-1 h-6 text-[10px]"
            onClick={toggleActive}
          >
            {data.isActive ? (
              <><Pause className="w-3 h-3 mr-1" /> Pause</>
            ) : (
              <><Play className="w-3 h-3 mr-1" /> Activate</>
            )}
          </Button>
        </div>
      </div>
    </BaseNode>
  );
});

StrategyNode.displayName = 'StrategyNode';
