/**
 * PropertyPanel - Floating properties editor
 * Shows when a node is selected
 */

import { memo, useMemo } from 'react';
import { X, Trash2, Copy, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { NODE_CATALOG } from '../catalog/nodeCatalog';
import { useStrategyFlowStore } from '../store/strategyFlowStore';
import type { StrategyFlowNode, NodeCategory } from '../types';
import { cn } from '@/lib/utils';

interface PropertyPanelProps {
  node: StrategyFlowNode | null;
  onClose: () => void;
}

const categoryColors: Record<NodeCategory, string> = {
  indicators: 'border-l-violet-500',
  conditions: 'border-l-amber-500',
  actions: 'border-l-emerald-500',
  environment: 'border-l-blue-500',
  variables: 'border-l-pink-500',
  control: 'border-l-slate-500',
};

export const PropertyPanel = memo(({ node, onClose }: PropertyPanelProps) => {
  const updateNodeData = useStrategyFlowStore((s) => s.updateNodeData);
  const removeNode = useStrategyFlowStore((s) => s.deleteNode);
  const addNode = useStrategyFlowStore((s) => s.addNode);

  const catalogEntry = useMemo(() => {
    if (!node) return null;
    return NODE_CATALOG.find((n) => n.type === node.type);
  }, [node]);

  if (!node || !catalogEntry) return null;

  const handleParamChange = (key: string, value: unknown) => {
    const currentData = node.data as Record<string, unknown>;
    const currentParams = (currentData.params as Record<string, unknown>) || {};
    updateNodeData(node.id, {
      params: { ...currentParams, [key]: value },
    });
  };

  const handleLabelChange = (label: string) => {
    updateNodeData(node.id, { label });
  };

  const handleDelete = () => {
    removeNode(node.id);
    onClose();
  };

  const handleDuplicate = () => {
    addNode(catalogEntry, { x: (node.position?.x || 0) + 50, y: (node.position?.y || 0) + 50 });
  };

  const renderParamInput = (key: string, value: unknown) => {
    const nodeData = node.data as Record<string, unknown>;
    const params = (nodeData.params as Record<string, unknown>) || {};
    const currentValue = params[key] ?? value;
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    // Determine input type based on value type
    if (typeof value === 'number' || typeof currentValue === 'number') {
      return (
        <div key={key} className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Input
            type="number"
            value={currentValue as number}
            onChange={(e) => handleParamChange(key, parseFloat(e.target.value) || 0)}
            className="h-8 text-sm bg-background/50"
          />
        </div>
      );
    }

    if (typeof value === 'boolean' || typeof currentValue === 'boolean') {
      return (
        <div key={key} className="flex items-center justify-between py-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Switch
            checked={currentValue as boolean}
            onCheckedChange={(v) => handleParamChange(key, v)}
          />
        </div>
      );
    }

    // Default to string input
    return (
      <div key={key} className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Input
          value={String(currentValue || '')}
          onChange={(e) => handleParamChange(key, e.target.value)}
          className="h-8 text-sm bg-background/50"
        />
      </div>
    );
  };

  const category = catalogEntry.category;
  const borderColor = categoryColors[category] || 'border-l-border';

  return (
    <div className={cn(
      'w-72 bg-card/95 backdrop-blur-md border border-border/50 rounded-xl shadow-2xl overflow-hidden',
      'animate-in slide-in-from-right-2 duration-200',
      'border-l-4',
      borderColor
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: catalogEntry.color }}
          />
          <span className="text-sm font-semibold text-foreground">{catalogEntry.label}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="p-3 space-y-4">
          {/* Node Label */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Display Name</Label>
            <Input
              value={String((node.data as Record<string, unknown>).label || '')}
              onChange={(e) => handleLabelChange(e.target.value)}
              className="h-8 text-sm bg-background/50"
            />
          </div>

          {/* Description */}
          {catalogEntry.description && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
              <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {catalogEntry.description}
              </p>
            </div>
          )}

          <Separator className="bg-border/30" />

          {/* Parameters from defaultData.params */}
          {catalogEntry.defaultData?.params && Object.keys(catalogEntry.defaultData.params).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                Parameters
              </h4>
              {Object.entries(catalogEntry.defaultData.params).map(([key, defaultValue]) =>
                renderParamInput(key, defaultValue)
              )}
            </div>
          )}

          {/* Node Category */}
          <Separator className="bg-border/30" />
          
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">
              Info
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-md bg-muted/30">
                <span className="text-muted-foreground">Category:</span>
                <span className="ml-1 text-foreground capitalize">{catalogEntry.category}</span>
              </div>
              <div className="p-2 rounded-md bg-muted/30">
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-1 text-foreground">{catalogEntry.nodeType}</span>
              </div>
            </div>
          </div>

          {/* Node ID (for debugging) */}
          <div className="text-[10px] text-muted-foreground/50 font-mono break-all">
            ID: {node.id}
          </div>
        </div>
      </ScrollArea>

      {/* Actions Footer */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/30 bg-muted/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDuplicate}
          className="flex-1 h-8 text-xs"
        >
          <Copy className="w-3 h-3 mr-1" />
          Duplicate
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="flex-1 h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
});

PropertyPanel.displayName = 'PropertyPanel';
