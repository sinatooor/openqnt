import { memo, useState, useRef, useEffect, DragEvent } from 'react';
import {
  Clock,
  Activity,
  GitBranch,
  Zap,
  Globe,
  Workflow,
  Database,
  Calculator,
  Shield,
  Info,
  Settings,
  User,
  History,
  HelpCircle,
  Search,
  GripHorizontal,
  LucideIcon
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
  INDICATOR_NODES,
  CONDITION_NODES,
  ACTION_NODES,
  ENVIRONMENT_NODES,
  CONTROL_NODES,
  VARIABLE_NODES,
  MATH_NODES,
  RISK_NODES,
  TRADE_INFO_NODES,
} from '../catalog/nodeCatalog';
import { NodeCatalogItem } from '../types';
import * as Icons from 'lucide-react';

// =============================================================================
// HELPERS
// =============================================================================

const getNodeIcon = (iconName: string) => {
  // @ts-ignore
  return Icons[iconName] || Activity;
};

// =============================================================================
// TYPES & CONFIG
// =============================================================================

interface SidebarCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  nodes: NodeCatalogItem[];
  description?: string;
}

// Mock Recent Nodes (Top 6 popular)
const RECENT_NODES = [
  ...INDICATOR_NODES.filter(n => n.type === 'sma'),
  ...CONDITION_NODES.filter(n => n.type === 'compare'),
  ...ACTION_NODES.filter(n => n.type === 'order'),
  ...ENVIRONMENT_NODES.filter(n => n.type === 'price'),
  ...ACTION_NODES.filter(n => n.type === 'stopLoss'),
  ...ACTION_NODES.filter(n => n.type === 'takeProfit'),
].slice(0, 6);

const TOOL_CATEGORIES: SidebarCategory[] = [
  {
    id: 'recent',
    label: 'Recent',
    icon: Clock,
    color: '#64748b',
    nodes: RECENT_NODES,
    description: 'Frequently used tools'
  },
  {
    id: 'environment',
    label: 'Environment',
    icon: Globe,
    color: '#6366f1',
    nodes: ENVIRONMENT_NODES,
    description: 'Market data and time'
  },
  {
    id: 'indicators',
    label: 'Indicators',
    icon: Activity,
    color: '#8b5cf6',
    nodes: INDICATOR_NODES,
    description: 'Technical analysis indicators'
  },
  {
    id: 'math',
    label: 'Math',
    icon: Calculator,
    color: '#84cc16',
    nodes: MATH_NODES,
    description: 'Mathematical operations'
  },
  {
    id: 'variables',
    label: 'Variables',
    icon: Database,
    color: '#06b6d4',
    nodes: VARIABLE_NODES,
    description: 'State management'
  },
  {
    id: 'conditions',
    label: 'Conditions',
    icon: GitBranch,
    color: '#f59e0b',
    nodes: CONDITION_NODES,
    description: 'Logic and comparison rules'
  },
  {
    id: 'risk',
    label: 'Risk',
    icon: Shield,
    color: '#ef4444',
    nodes: RISK_NODES,
    description: 'Risk management'
  },
  {
    id: 'actions',
    label: 'Actions',
    icon: Zap,
    color: '#10b981',
    nodes: ACTION_NODES,
    description: 'Execution and alerts'
  },
  {
    id: 'control',
    label: 'Control Flow',
    icon: Workflow,
    color: '#ec4899',
    nodes: CONTROL_NODES,
    description: 'Loops and logic flow'
  },
  {
    id: 'tradeInfo',
    label: 'Trade Info',
    icon: Info,
    color: '#3b82f6',
    nodes: TRADE_INFO_NODES,
    description: 'Position data'
  },
];

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const DraggableItem = memo(({ item, onDragStart, onNodeClick }: {
  item: NodeCatalogItem;
  onDragStart: (e: DragEvent, item: NodeCatalogItem) => void;
  onNodeClick: (item: NodeCatalogItem) => void;
}) => {
  const Icon = getNodeIcon(item.icon);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      onClick={() => onNodeClick(item)}
      className="group flex items-center gap-3 p-2.5 mb-1.5 bg-card/40 border border-white/5 rounded-lg hover:border-primary/50 hover:bg-white/5 cursor-grab active:cursor-grabbing transition-all shadow-sm hover:shadow-md"
    >
      <div
        className="p-1.5 rounded-md shrink-0 transition-colors"
        style={{ backgroundColor: `${item.color}15`, color: item.color }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-[13px] truncate text-foreground/90">{item.label}</span>
          <GripHorizontal className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className="text-[10px] text-muted-foreground/70 truncate leading-tight mt-0.5">
          {item.description}
        </p>
      </div>
    </div>
  );
});

DraggableItem.displayName = 'DraggableItem';

const CategorySection = memo(({
  category,
  onDragStart,
  onNodeClick,
  setRef
}: {
  category: SidebarCategory;
  onDragStart: (e: DragEvent, item: NodeCatalogItem) => void;
  onNodeClick: (item: NodeCatalogItem) => void;
  setRef: (el: HTMLDivElement | null) => void;
}) => {
  return (
    <div ref={setRef} id={`category-${category.id}`} className="mb-6 scroll-mt-2">
      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background/80 backdrop-blur-md p-2 z-10 border-b border-white/5 rounded-t-lg">
        <category.icon className="w-3.5 h-3.5" style={{ color: category.color }} />
        <h3 className="font-semibold text-xs tracking-wide uppercase text-muted-foreground">{category.label}</h3>
      </div>
      <div className="grid grid-cols-1 gap-1 px-1">
        {category.nodes.map((node) => (
          <DraggableItem
            key={`${category.id}-${node.type}`}
            item={node}
            onDragStart={onDragStart}
            onNodeClick={onNodeClick}
          />
        ))}
      </div>
    </div>
  );
});

CategorySection.displayName = 'CategorySection';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const LeftSidebar = memo(() => {
  const { addNode, setSearchQuery, searchQuery, leftSidebarWidth, setLeftSidebarOpen } = useStrategyFlowStore();
  const [activeCategory, setActiveCategory] = useState<string>('recent');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Scroll Spy Logic
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;

    const scrollPosition = scrollContainerRef.current.scrollTop + 100; // Offset for stickiness

    // Find current active section
    for (const cat of TOOL_CATEGORIES) {
      const element = categoryRefs.current[cat.id];
      if (element) {
        const { offsetTop, offsetHeight } = element;
        if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
          setActiveCategory(cat.id);
          break;
        }
      }
    }
  };

  // Scroll To Function with Toggle Logic
  const handleCategoryClick = (id: string) => {
    if (activeCategory === id && !isCollapsed) {
      // Toggle closed if clicking currently active category
      setIsCollapsed(true);
      return;
    }

    if (isCollapsed) {
      setIsCollapsed(false);
    }

    // Slight delay to allow expansion before scrolling
    setTimeout(() => {
      setActiveCategory(id);
      const element = categoryRefs.current[id];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, isCollapsed ? 150 : 0);
  };

  const handleDragStart = (e: DragEvent, item: NodeCatalogItem) => {
    e.dataTransfer.setData('application/strategyflow', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleNodeClick = (item: NodeCatalogItem) => {
    addNode(item, { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 });
  };

  return (
    <div
      style={{ width: isCollapsed ? 50 : (leftSidebarWidth || 340) }} // Collapsed width = 50px
      className="flex h-full bg-background/60 backdrop-blur-xl border-r border-white/10 overflow-hidden transition-all duration-300 ease-in-out"
    >

      {/* 1. Left Fixed Icon Sidebar */}
      <div className="w-[50px] shrink-0 flex flex-col justify-between border-r border-white/5 bg-black/20 z-20">

        {/* Tool Categories */}
        <div className="flex flex-col items-center gap-1.5 p-1.5 overflow-y-auto no-scrollbar pt-3">
          <TooltipProvider delayDuration={0} side="right">
            {TOOL_CATEGORIES.map((cat) => (
              <Tooltip key={cat.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleCategoryClick(cat.id)}
                    className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-md transition-all duration-200 group relative",
                      activeCategory === cat.id && !isCollapsed
                        ? "bg-white/10 text-white shadow-sm"
                        : "text-muted-foreground/60 hover:bg-white/5 hover:text-foreground"
                    )}
                  >
                    <cat.icon className={cn("w-4 h-4 transition-colors", activeCategory === cat.id && !isCollapsed && "fill-current/10")} />
                    {activeCategory === cat.id && !isCollapsed && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium bg-popover text-popover-foreground text-xs">
                  {cat.label} {activeCategory === cat.id && !isCollapsed ? '(Click to close)' : ''}
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>

        {/* Bottom Fixed Items */}
        <div className="flex flex-col items-center gap-1 p-1.5 border-t border-white/5 bg-black/20">
          <TooltipProvider delayDuration={0} side="right">
            {[
              { id: 'settings', icon: Settings, label: 'Settings' },
              { id: 'profile', icon: User, label: 'Profile' },
              { id: 'history', icon: History, label: 'History' },
              { id: 'help', icon: HelpCircle, label: 'Docs & Help' },
            ].map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => console.log(`Open ${item.label}`)}
                    className="flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground/60 hover:bg-white/5 hover:text-foreground transition-all"
                  >
                    <item.icon className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium bg-popover text-popover-foreground text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      </div>

      {/* 2. Right Scrollable Content */}
      <div
        className={cn(
          "flex-1 flex flex-col h-full overflow-hidden bg-transparent transition-opacity duration-200",
          isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        {/* Search Bar */}
        <div className="p-3 border-b border-white/5 bg-transparent z-10">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            <Input
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-xs bg-white/5 border-white/5 focus:bg-white/10 transition-all rounded-md"
            />
          </div>
        </div>

        {/* Scrollable Categories */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-2 scroll-smooth no-scrollbar"
        >
          {TOOL_CATEGORIES.map((cat) => (
            <CategorySection
              key={cat.id}
              category={cat}
              onDragStart={handleDragStart}
              onNodeClick={handleNodeClick}
              setRef={(el) => (categoryRefs.current[cat.id] = el)}
            />
          ))}

          {/* Bottom Padding for scroll */}
          <div className="h-24" />
        </div>
      </div>
    </div>
  );
});

LeftSidebar.displayName = 'LeftSidebar';
