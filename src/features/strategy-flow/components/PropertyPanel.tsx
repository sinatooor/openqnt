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
  dataSources: 'border-l-cyan-600',
  indicators: 'border-l-violet-500',
  conditions: 'border-l-amber-500',
  actions: 'border-l-emerald-500',
  environment: 'border-l-blue-500',
  variables: 'border-l-pink-500',
  control: 'border-l-slate-500',
  math: 'border-l-teal-500',
  risk: 'border-l-red-500',
  tradeInfo: 'border-l-cyan-500',
  llm: 'border-l-purple-500',
  triggers: 'border-l-orange-500',
  integrations: 'border-l-fuchsia-500',
  pineScript: 'border-l-blue-600',
  portfolio: 'border-l-yellow-500',
  agents: 'border-l-purple-600',
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

  const handleTopLevelChange = (key: string, value: unknown) => {
    updateNodeData(node.id, { [key]: value });
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
    const label = humanizeKey(key);

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

  const renderTopLevelInput = (key: string, defaultValue: unknown) => {
    const nodeData = node.data as Record<string, unknown>;
    const currentValue = nodeData[key] ?? defaultValue;
    const label = humanizeKey(key);
    const isLong =
      typeof currentValue === 'string' && (key === 'prompt' || key === 'code' || currentValue.length > 60);

    if (typeof defaultValue === 'number' || typeof currentValue === 'number') {
      return (
        <div key={key} className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Input
            type="number"
            value={(currentValue as number) ?? ''}
            onChange={(e) => handleTopLevelChange(key, parseFloat(e.target.value) || 0)}
            className="h-8 text-sm bg-background/50"
          />
        </div>
      );
    }
    if (typeof defaultValue === 'boolean' || typeof currentValue === 'boolean') {
      return (
        <div key={key} className="flex items-center justify-between py-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Switch
            checked={!!currentValue}
            onCheckedChange={(v) => handleTopLevelChange(key, v)}
          />
        </div>
      );
    }
    if (isLong) {
      return (
        <div key={key} className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <textarea
            value={String(currentValue ?? '')}
            onChange={(e) => handleTopLevelChange(key, e.target.value)}
            rows={key === 'code' ? 8 : 3}
            className="w-full rounded-md border border-input bg-background/50 px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      );
    }
    return (
      <div key={key} className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Input
          value={String(currentValue ?? '')}
          onChange={(e) => handleTopLevelChange(key, e.target.value)}
          className="h-8 text-sm bg-background/50"
        />
      </div>
    );
  };

  const renderJsonField = (key: string, defaultValue: unknown) => {
    const nodeData = node.data as Record<string, unknown>;
    const currentValue = nodeData[key] ?? defaultValue;
    return (
      <div key={key} className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{humanizeKey(key)}</Label>
        <textarea
          defaultValue={safeStringify(currentValue)}
          onBlur={(e) => {
            try {
              handleTopLevelChange(key, JSON.parse(e.target.value));
            } catch {
              // ignore invalid JSON; user keeps editing
            }
          }}
          rows={3}
          className="w-full rounded-md border border-input bg-background/50 px-2 py-1 font-mono text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="text-[10px] text-muted-foreground">
          JSON. Saved on blur.
        </p>
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

          {/* Top-level config fields (provider, symbol, prompt, model, etc.).
              defaultData fields outside `params` are typically the node's
              real configuration — without rendering them here, only the
              label was editable for data-source / LLM / integration nodes. */}
          {(() => {
            const topLevel = catalogEntry.defaultData
              ? Object.entries(catalogEntry.defaultData).filter(
                  ([k]) => !TOP_LEVEL_HIDDEN_KEYS.has(k),
                )
              : [];
            if (topLevel.length === 0) return null;
            return (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                  Configuration
                </h4>
                {topLevel.map(([key, defaultValue]) => {
                  if (defaultValue && typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
                    return renderJsonField(key, defaultValue);
                  }
                  return renderTopLevelInput(key, defaultValue);
                })}
              </div>
            );
          })()}

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

const TOP_LEVEL_HIDDEN_KEYS = new Set<string>([
  // Identity / display fields are rendered separately above.
  'label',
  'params',
  // Type discriminators that the catalog already pins; editing them
  // would un-link the node from its catalog entry.
  'nodeType',
  'indicatorType',
  'conditionType',
  'actionType',
  'environmentType',
  'mathType',
  'controlType',
  'variableType',
  'riskType',
  'tradeInfoType',
  'llmType',
  'triggerType',
  'integrationType',
  'agentType',
  'portfolioType',
]);

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}
