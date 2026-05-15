/**
 * SearchNodesDialog - Find and select nodes already on the canvas.
 * ⌘K / / shortcut. Shows nodes in the current strategy; clicking selects
 * the node and opens its property panel.
 */

import { memo, useState, useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MousePointerClick } from 'lucide-react';
import * as Icons from 'lucide-react';
import { NODE_CATALOG } from '../../catalog/nodeCatalog';
import { useStrategyFlowStore } from '../../store/strategyFlowStore';
import type { StrategyNodeData } from '../../types';

interface SearchNodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Extract the sub-type discriminator from node data
const getSubType = (data: StrategyNodeData): string | undefined =>
  (data as any).indicatorType ||
  (data as any).conditionType ||
  (data as any).actionType ||
  (data as any).triggerType ||
  (data as any).mathType ||
  (data as any).controlType ||
  (data as any).riskType ||
  (data as any).variableType ||
  (data as any).environmentType ||
  (data as any).tradeInfoType ||
  (data as any).llmType ||
  (data as any).integrationType ||
  (data as any).pineType ||
  (data as any).agentType ||
  (data as any).provider;

export const SearchNodesDialog = memo(({ open, onOpenChange }: SearchNodesDialogProps) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { nodes, selectNode } = useStrategyFlowStore();

  // Build a searchable list from canvas nodes
  const canvasEntries = useMemo(() => {
    return nodes.map((node) => {
      const data = node.data as StrategyNodeData;
      const subType = getSubType(data);

      // Find catalog item to get the right icon/color
      const catalogItem =
        NODE_CATALOG.find((c) => c.type === subType) ||
        NODE_CATALOG.find((c) => c.nodeType === node.type);

      return {
        id: node.id,
        label: data.label || node.type || 'Unnamed',
        nodeType: node.type || '',
        subType,
        icon: catalogItem?.icon || 'Box',
        color: catalogItem?.color || '#64748b',
        category: catalogItem?.category || node.type || '',
        position: node.position,
      };
    });
  }, [nodes]);

  // Filter by search query
  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return canvasEntries;
    return canvasEntries.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.nodeType.toLowerCase().includes(q) ||
        (e.subType || '').toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
    );
  }, [canvasEntries, search]);

  // Reset selected row when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredEntries]);

  // Focus + reset when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setSearch('');
    }
  }, [open]);

  const handleSelectEntry = (id: string) => {
    selectNode(id);
    onOpenChange(false);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredEntries.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredEntries[selectedIndex]) handleSelectEntry(filteredEntries[selectedIndex].id);
        break;
      case 'Escape':
        onOpenChange(false);
        break;
    }
  };

  const isEmpty = nodes.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card/80 backdrop-blur-xl border-border/50 text-foreground p-0">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="sr-only">Find Node on Canvas</DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Find node on canvas…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 bg-secondary border-border text-lg h-12"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[400px]">
          <div className="px-2 pb-4">
            {isEmpty && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No nodes on the canvas yet.
                <p className="text-xs mt-1 opacity-60">Drag nodes from the left sidebar to get started.</p>
              </div>
            )}

            {!isEmpty && filteredEntries.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No nodes match &quot;{search}&quot;
              </div>
            )}

            {filteredEntries.map((entry, index) => {
              const IconComponent = (Icons as any)[entry.icon] || Icons.Box;
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={entry.id}
                  onClick={() => handleSelectEntry(entry.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                    isSelected ? 'bg-purple-500/20' : 'hover:bg-accent'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: entry.color + '30' }}
                  >
                    <IconComponent className="w-4 h-4" style={{ color: entry.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">{entry.label}</span>
                      <span className="text-xs text-muted-foreground capitalize shrink-0">{entry.category}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {entry.id}
                    </p>
                  </div>
                  {isSelected && (
                    <MousePointerClick className="w-4 h-4 text-purple-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {/* Keyboard hints */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
          <span><kbd className="px-1.5 py-0.5 bg-secondary rounded">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1.5 py-0.5 bg-secondary rounded">Enter</kbd> Select</span>
          <span><kbd className="px-1.5 py-0.5 bg-secondary rounded">Esc</kbd> Close</span>
          <span className="ml-auto">{filteredEntries.length} / {nodes.length} nodes</span>
        </div>
      </DialogContent>
    </Dialog>
  );
});

SearchNodesDialog.displayName = 'SearchNodesDialog';
