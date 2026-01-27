/**
 * NodePalette - Compact floating node palette
 * Collapsible with categorized nodes
 */

import { memo, useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search, GripVertical, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NODE_CATALOG } from '../catalog/nodeCatalog';
import { useStrategyFlowStore } from '../store/strategyFlowStore';
import { NodeCatalogItem, NodeCategory } from '../types';
import { cn } from '@/lib/utils';

interface NodePaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const categoryColors: Record<NodeCategory, string> = {
  indicators: 'bg-violet-500/20 border-violet-500/50 text-violet-400',
  conditions: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
  actions: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
  environment: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
  variables: 'bg-pink-500/20 border-pink-500/50 text-pink-400',
  control: 'bg-slate-500/20 border-slate-500/50 text-slate-400',
};

const categoryLabels: Record<NodeCategory, string> = {
  indicators: '📊 Indicators',
  conditions: '🔀 Conditions',
  actions: '🎯 Actions',
  environment: '⚡ Environment',
  variables: '📦 Variables',
  control: '🔧 Control Flow',
};

export const NodePalette = memo(({ isOpen, onClose }: NodePaletteProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<NodeCategory>>(
    new Set(['indicators', 'conditions', 'actions'])
  );
  const addNode = useStrategyFlowStore((s) => s.addNode);

  const toggleCategory = (cat: NodeCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const filteredNodes = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return NODE_CATALOG;
    return NODE_CATALOG.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q) ||
        n.description?.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const groupedNodes = useMemo(() => {
    const groups: Record<NodeCategory, NodeCatalogItem[]> = {
      indicators: [],
      conditions: [],
      actions: [],
      environment: [],
      variables: [],
      control: [],
    };
    filteredNodes.forEach((n) => groups[n.category].push(n));
    return groups;
  }, [filteredNodes]);

  const handleAddNode = (catalogItem: NodeCatalogItem) => {
    // Add node at center of viewport
    addNode(catalogItem, { x: 300 + Math.random() * 100, y: 200 + Math.random() * 100 });
  };

  const onDragStart = (e: React.DragEvent, catalogItem: NodeCatalogItem) => {
    e.dataTransfer.setData('application/reactflow', JSON.stringify(catalogItem));
    e.dataTransfer.effectAllowed = 'move';
  };

  if (!isOpen) return null;

  return (
    <div className="w-64 bg-card/95 backdrop-blur-md border border-border/50 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-left-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
        <span className="text-sm font-semibold text-foreground">Nodes</span>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-border/30">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="pl-8 h-8 text-xs bg-background/50 border-border/50"
          />
        </div>
      </div>

      {/* Node List */}
      <ScrollArea className="h-[400px]">
        <div className="p-2 space-y-1">
          {(Object.keys(groupedNodes) as NodeCategory[]).map((cat) => {
            const nodes = groupedNodes[cat];
            if (nodes.length === 0) return null;
            const isExpanded = expandedCategories.has(cat);

            return (
              <div key={cat} className="rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-md transition-colors',
                    categoryColors[cat]
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  {categoryLabels[cat]}
                  <span className="ml-auto text-[10px] opacity-60">{nodes.length}</span>
                </button>

                {isExpanded && (
                  <div className="mt-1 space-y-0.5 pl-2">
                    {nodes.map((node) => (
                      <div
                        key={node.type}
                        draggable
                        onDragStart={(e) => onDragStart(e, node)}
                        onClick={() => handleAddNode(node)}
                        className="group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing hover:bg-accent/50 transition-colors"
                      >
                        <GripVertical className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground" />
                        <div 
                          className="w-3 h-3 rounded-sm" 
                          style={{ backgroundColor: node.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground/90 truncate">
                            {node.label}
                          </div>
                          {node.description && (
                            <div className="text-[10px] text-muted-foreground truncate">
                              {node.description}
                            </div>
                          )}
                        </div>
                        <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-border/30 bg-muted/20">
        <p className="text-[10px] text-muted-foreground text-center">
          Drag to canvas or click to add
        </p>
      </div>
    </div>
  );
});

NodePalette.displayName = 'NodePalette';
