/**
 * LeftSidebar - VS Code-style sidebar with icon rail and expandable panel
 * Based on the reference screenshots provided
 */

import { memo, useState, DragEvent } from 'react';
import { 
  Search, 
  Clock, 
  Boxes,
  FileCode2,
  Settings,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useStrategyFlowStore } from '../store/strategyFlowStore';
import { 
  NODE_CATALOG,
  INDICATOR_NODES,
  CONDITION_NODES,
  ACTION_NODES,
  ENVIRONMENT_NODES,
  CONTROL_NODES,
  VARIABLE_NODES,
  getSubcategories,
  getNodesBySubcategory,
  getNodesByCategory,
} from '../catalog/nodeCatalog';
import { NodeCatalogItem, LeftSidebarTab } from '../types';
import * as Icons from 'lucide-react';

// =============================================================================
// ICON RAIL ITEMS
// =============================================================================

const RAIL_ITEMS = [
  { id: 'nodes' as LeftSidebarTab, icon: Boxes, label: 'Node Palette', shortcut: '⌘1' },
  { id: 'search' as LeftSidebarTab, icon: Search, label: 'Search Nodes', shortcut: '⌘F' },
  { id: 'templates' as LeftSidebarTab, icon: FileCode2, label: 'Templates', shortcut: '⌘T' },
  { id: 'history' as LeftSidebarTab, icon: Clock, label: 'History', shortcut: '⌘H' },
  { id: 'settings' as LeftSidebarTab, icon: Settings, label: 'Settings', shortcut: '⌘,' },
];

// =============================================================================
// NODE PALETTE CATEGORIES
// =============================================================================

interface CategoryConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  nodes: NodeCatalogItem[];
  color: string;
}

const CATEGORIES: CategoryConfig[] = [
  { 
    id: 'indicators', 
    label: 'Indicators', 
    icon: <Icons.LineChart className="w-4 h-4" />,
    nodes: INDICATOR_NODES,
    color: '#8b5cf6',
  },
  { 
    id: 'conditions', 
    label: 'Conditions', 
    icon: <Icons.GitBranch className="w-4 h-4" />,
    nodes: CONDITION_NODES,
    color: '#f59e0b',
  },
  { 
    id: 'actions', 
    label: 'Actions', 
    icon: <Icons.Zap className="w-4 h-4" />,
    nodes: ACTION_NODES,
    color: '#10b981',
  },
  { 
    id: 'environment', 
    label: 'Environment', 
    icon: <Icons.Globe className="w-4 h-4" />,
    nodes: ENVIRONMENT_NODES,
    color: '#6366f1',
  },
  { 
    id: 'control', 
    label: 'Control Flow', 
    icon: <Icons.Repeat className="w-4 h-4" />,
    nodes: CONTROL_NODES,
    color: '#06b6d4',
  },
  { 
    id: 'variables', 
    label: 'Variables', 
    icon: <Icons.Variable className="w-4 h-4" />,
    nodes: VARIABLE_NODES,
    color: '#ec4899',
  },
];

// =============================================================================
// DRAGGABLE NODE ITEM
// =============================================================================

interface NodeItemProps {
  item: NodeCatalogItem;
  onDragStart: (e: DragEvent, item: NodeCatalogItem) => void;
  onClick: (item: NodeCatalogItem) => void;
}

const NodeItem = memo(({ item, onDragStart, onClick }: NodeItemProps) => {
  const IconComponent = (Icons as any)[item.icon] || Icons.Box;

  return (
    <TooltipProvider delayDuration={500}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            draggable
            onDragStart={(e) => onDragStart(e, item)}
            onClick={() => onClick(item)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/60 transition-all duration-200 cursor-grab active:cursor-grabbing group hover-lift"
          >
            <div 
              className="p-1.5 rounded-md"
              style={{ backgroundColor: `${item.color}20`, color: item.color }}
            >
              <IconComponent className="w-4 h-4" />
            </div>
            <span className="text-sm text-foreground/90 group-hover:text-foreground truncate">
              {item.label}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="font-medium">{item.label}</p>
          <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

NodeItem.displayName = 'NodeItem';

// =============================================================================
// CATEGORY SECTION
// =============================================================================

interface CategorySectionProps {
  category: CategoryConfig;
  isExpanded: boolean;
  onToggle: () => void;
  onDragStart: (e: DragEvent, item: NodeCatalogItem) => void;
  onNodeClick: (item: NodeCatalogItem) => void;
  searchQuery: string;
}

const CategorySection = memo(({ 
  category, 
  isExpanded, 
  onToggle, 
  onDragStart, 
  onNodeClick,
  searchQuery,
}: CategorySectionProps) => {
  const [expandedSubcategories, setExpandedSubcategories] = useState<Record<string, boolean>>({});
  
  // Filter nodes based on search
  const filteredNodes = searchQuery
    ? category.nodes.filter(node => 
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : category.nodes;

  if (searchQuery && filteredNodes.length === 0) return null;

  // Get subcategories
  const subcategories = getSubcategories(category.id);
  const hasSubcategories = subcategories.length > 0;

  const toggleSubcategory = (sub: string) => {
    setExpandedSubcategories(prev => ({ ...prev, [sub]: !prev[sub] }));
  };

  return (
    <div className="mb-1">
      {/* Category Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-2 hover:bg-accent/40 rounded-md transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <span style={{ color: category.color }}>{category.icon}</span>
        <span className="text-sm font-medium text-foreground/90">{category.label}</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filteredNodes.length}
        </span>
      </button>

      {/* Category Content */}
      {isExpanded && (
        <div className="ml-2 pl-2 border-l border-border/50">
          {hasSubcategories && !searchQuery ? (
            // Show subcategories
            subcategories.map((sub) => {
              const subNodes = getNodesBySubcategory(category.id, sub);
              const isSubExpanded = expandedSubcategories[sub] ?? true;

              return (
                <div key={sub} className="mb-1">
                  <button
                    onClick={() => toggleSubcategory(sub)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent/30 rounded-md transition-colors text-xs"
                  >
                    {isSubExpanded ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground">{sub}</span>
                  </button>
                  {isSubExpanded && (
                    <div className="ml-3">
                      {subNodes.map((node) => (
                        <NodeItem
                          key={node.type}
                          item={node}
                          onDragStart={onDragStart}
                          onClick={onNodeClick}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            // Show all nodes flat
            filteredNodes.map((node) => (
              <NodeItem
                key={node.type}
                item={node}
                onDragStart={onDragStart}
                onClick={onNodeClick}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
});

CategorySection.displayName = 'CategorySection';

// =============================================================================
// NODE PALETTE PANEL
// =============================================================================

const NodePalettePanel = memo(() => {
  const { searchQuery, setSearchQuery, addNode } = useStrategyFlowStore();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    indicators: true,
    conditions: true,
    actions: true,
    environment: false,
    control: false,
    variables: false,
  });

  const handleDragStart = (e: DragEvent, item: NodeCatalogItem) => {
    e.dataTransfer.setData('application/strategyflow', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleNodeClick = (item: NodeCatalogItem) => {
    // Add node at center of visible area (will be handled by canvas)
    addNode(item, { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 });
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="p-3 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm bg-muted/50 border-border/50 focus:border-primary/50 transition-colors"
          />
        </div>
      </div>

      {/* Quick Access Section */}
      <div className="p-3 border-b border-border/50">
        <h3 className="text-xs font-semibold text-muted-foreground mb-2">Quick Access</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'RSI', type: 'rsi', icon: Icons.Activity, color: '#06b6d4' },
            { label: 'Order', type: 'order', icon: Icons.ShoppingCart, color: '#10b981' },
            { label: 'Compare', type: 'compare', icon: Icons.GitCompare, color: '#f59e0b' },
            { label: 'If', type: 'if', icon: Icons.GitBranch, color: '#f59e0b' },
          ].map((quick) => {
            const catalogItem = NODE_CATALOG.find(n => n.type === quick.type);
            if (!catalogItem) return null;
            const QuickIcon = quick.icon;
            return (
              <button
                key={quick.type}
                draggable
                onDragStart={(e) => handleDragStart(e, catalogItem)}
                onClick={() => handleNodeClick(catalogItem)}
                className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border/50 hover:border-border hover:bg-accent/50 transition-all cursor-grab active:cursor-grabbing"
              >
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${quick.color}15`, color: quick.color }}
                >
                  <QuickIcon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium">{quick.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Categories */}
      <ScrollArea className="flex-1 p-2">
        {CATEGORIES.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            isExpanded={expandedCategories[category.id] ?? false}
            onToggle={() => toggleCategory(category.id)}
            onDragStart={handleDragStart}
            onNodeClick={handleNodeClick}
            searchQuery={searchQuery}
          />
        ))}
      </ScrollArea>
    </div>
  );
});

NodePalettePanel.displayName = 'NodePalettePanel';

// =============================================================================
// SEARCH PANEL
// =============================================================================

const SearchPanel = memo(() => {
  const { searchQuery, setSearchQuery, addNode } = useStrategyFlowStore();

  const filteredNodes = searchQuery
    ? NODE_CATALOG.filter(node => 
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleDragStart = (e: DragEvent, item: NodeCatalogItem) => {
    e.dataTransfer.setData('application/strategyflow', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleNodeClick = (item: NodeCatalogItem) => {
    addNode(item, { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search all nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
            autoFocus
          />
        </div>
      </div>

      <ScrollArea className="flex-1 p-2">
        {searchQuery ? (
          filteredNodes.length > 0 ? (
            <div className="space-y-1">
              {filteredNodes.map((node) => (
                <NodeItem
                  key={node.type}
                  item={node}
                  onDragStart={handleDragStart}
                  onClick={handleNodeClick}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Search className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No nodes found</p>
              <p className="text-xs">Try a different search term</p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Sparkles className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Start typing to search</p>
            <p className="text-xs">Search {NODE_CATALOG.length} available nodes</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
});

SearchPanel.displayName = 'SearchPanel';

// =============================================================================
// TEMPLATES PANEL (Placeholder)
// =============================================================================

const TemplatesPanel = memo(() => {
  return (
    <div className="flex flex-col h-full p-4">
      <h3 className="text-sm font-semibold mb-4">Strategy Templates</h3>
      <div className="space-y-2">
        {['RSI Momentum', 'MACD Crossover', 'Bollinger Breakout', 'Trend Following'].map((template) => (
          <button
            key={template}
            className="w-full p-3 text-left rounded-lg border border-border/50 hover:border-border hover:bg-accent/50 transition-colors"
          >
            <p className="text-sm font-medium">{template}</p>
            <p className="text-xs text-muted-foreground mt-1">Click to load template</p>
          </button>
        ))}
      </div>
    </div>
  );
});

TemplatesPanel.displayName = 'TemplatesPanel';

// =============================================================================
// HISTORY PANEL (Placeholder)
// =============================================================================

const HistoryPanel = memo(() => {
  const { canUndo, canRedo, undo, redo } = useStrategyFlowStore();

  return (
    <div className="flex flex-col h-full p-4">
      <h3 className="text-sm font-semibold mb-4">History</h3>
      <div className="flex gap-2 mb-4">
        <button
          onClick={undo}
          disabled={!canUndo()}
          className="flex-1 py-2 px-3 text-sm rounded-md bg-muted/50 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={!canRedo()}
          className="flex-1 py-2 px-3 text-sm rounded-md bg-muted/50 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Redo
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Use ⌘Z to undo and ⌘⇧Z to redo
      </p>
    </div>
  );
});

HistoryPanel.displayName = 'HistoryPanel';

// =============================================================================
// SETTINGS PANEL (Placeholder)
// =============================================================================

const SettingsPanel = memo(() => {
  return (
    <div className="flex flex-col h-full p-4">
      <h3 className="text-sm font-semibold mb-4">Settings</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">Snap to Grid</span>
          <input type="checkbox" defaultChecked className="rounded" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Show Minimap</span>
          <input type="checkbox" defaultChecked className="rounded" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Animate Edges</span>
          <input type="checkbox" defaultChecked className="rounded" />
        </div>
      </div>
    </div>
  );
});

SettingsPanel.displayName = 'SettingsPanel';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const LeftSidebar = memo(() => {
  const { 
    leftSidebarOpen, 
    leftSidebarTab, 
    leftSidebarWidth,
    setLeftSidebarOpen,
    setLeftSidebarTab,
  } = useStrategyFlowStore();

  const renderPanel = () => {
    switch (leftSidebarTab) {
      case 'nodes':
        return <NodePalettePanel />;
      case 'search':
        return <SearchPanel />;
      case 'templates':
        return <TemplatesPanel />;
      case 'history':
        return <HistoryPanel />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return <NodePalettePanel />;
    }
  };

  return (
    <div className="flex h-full">
      {/* Icon Rail */}
      <div className="w-12 flex flex-col items-center py-2 bg-card border-r border-border/50 shadow-trading">
        <TooltipProvider delayDuration={0}>
          {RAIL_ITEMS.map((item) => {
            const IconComponent = item.icon;
            const isActive = leftSidebarOpen && leftSidebarTab === item.id;

            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      if (leftSidebarTab === item.id && leftSidebarOpen) {
                        setLeftSidebarOpen(false);
                      } else {
                        setLeftSidebarTab(item.id);
                        setLeftSidebarOpen(true);
                      }
                    }}
                    className={cn(
                      'w-10 h-10 flex items-center justify-center rounded-lg mb-1 transition-all duration-200',
                      isActive 
                        ? 'bg-primary/20 text-primary shadow-sm border border-primary/30' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 hover:scale-105'
                    )}
                  >
                    <IconComponent className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.shortcut}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Help */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-10 h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
                <HelpCircle className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Help & Documentation</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Expandable Panel */}
      {leftSidebarOpen && (
        <div 
          className="border-r border-border/50 glass overflow-hidden shadow-trading-lg animate-in slide-in-from-left duration-300"
          style={{ width: leftSidebarWidth }}
        >
          {/* Panel Header */}
          <div className="h-10 px-3 flex items-center border-b border-border/30">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {RAIL_ITEMS.find(item => item.id === leftSidebarTab)?.label}
            </h2>
          </div>

          {/* Panel Content */}
          <div className="h-[calc(100%-40px)]">
            {renderPanel()}
          </div>
        </div>
      )}
    </div>
  );
});

LeftSidebar.displayName = 'LeftSidebar';
