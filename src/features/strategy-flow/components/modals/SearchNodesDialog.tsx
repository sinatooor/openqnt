/**
 * SearchNodesDialog - Quick search and add nodes
 * Equivalent to Blockly's BlockSearchDialog
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
import { Search, ArrowRight } from 'lucide-react';
import * as Icons from 'lucide-react';
import { NODE_CATALOG } from '../../catalog/nodeCatalog';
import type { NodeCatalogItem } from '../../types';
import { useStrategyFlowStore } from '../../store/strategyFlowStore';

interface SearchNodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SearchNodesDialog = memo(({ open, onOpenChange }: SearchNodesDialogProps) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { addNode } = useStrategyFlowStore();

  // Filter nodes based on search
  const filteredNodes = useMemo(() => {
    if (!search.trim()) return NODE_CATALOG.slice(0, 20); // Show first 20 when empty
    
    const query = search.toLowerCase();
    return NODE_CATALOG.filter(node => 
      node.label.toLowerCase().includes(query) ||
      node.description.toLowerCase().includes(query) ||
      node.type.toLowerCase().includes(query) ||
      node.category.toLowerCase().includes(query)
    ).slice(0, 30);
  }, [search]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredNodes]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSearch('');
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredNodes.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredNodes[selectedIndex]) {
          handleSelectNode(filteredNodes[selectedIndex]);
        }
        break;
      case 'Escape':
        onOpenChange(false);
        break;
    }
  };

  const handleSelectNode = (node: NodeCatalogItem) => {
    // Add node at center of viewport
    const viewportCenter = { x: 400, y: 300 }; // Default center
    addNode(node, viewportCenter);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-[#1e1e1e] border-white/10 text-white p-0">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="sr-only">Search Nodes</DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              ref={inputRef}
              placeholder="Search nodes... (e.g., RSI, crossover, buy)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 bg-[#2a2a2a] border-white/10 text-lg h-12"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[400px]">
          <div className="px-2 pb-4">
            {filteredNodes.map((node, index) => {
              const IconComponent = (Icons as any)[node.icon] || Icons.Box;
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={`${node.type}-${index}`}
                  onClick={() => handleSelectNode(node)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                    isSelected ? 'bg-purple-500/20' : 'hover:bg-white/5'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: node.color + '30' }}
                  >
                    <IconComponent className="w-4 h-4" style={{ color: node.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{node.label}</span>
                      <span className="text-xs text-white/40 capitalize">{node.category}</span>
                    </div>
                    <p className="text-xs text-white/50 truncate">{node.description}</p>
                  </div>
                  {isSelected && (
                    <ArrowRight className="w-4 h-4 text-purple-400" />
                  )}
                </button>
              );
            })}

            {filteredNodes.length === 0 && (
              <div className="text-center py-8 text-white/50">
                No nodes found matching "{search}"
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Keyboard hints */}
        <div className="px-4 py-2 border-t border-white/10 flex items-center gap-4 text-xs text-white/40">
          <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Enter</kbd> Add</span>
          <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Esc</kbd> Close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
});

SearchNodesDialog.displayName = 'SearchNodesDialog';
