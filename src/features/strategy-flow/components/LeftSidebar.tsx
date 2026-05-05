import { memo, useState, useRef, useCallback, useMemo, DragEvent } from 'react';
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
  History,
  HelpCircle,
  Search,
  GripHorizontal,
  Sparkles,
  Briefcase,
  Bot,
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
  LLM_NODES,
  TRIGGER_NODES,
  INTEGRATION_NODES,
  PINE_SCRIPT_NODES,
  PORTFOLIO_NODES,
  AGENT_NODES,
} from '../catalog/nodeCatalog';
import { NodeCatalogItem } from '../types';
import { SettingsModal, JournalModal, HelpModal } from './modals';
import * as Icons from 'lucide-react';

// =============================================================================
// HELPERS - Cached icon lookup for performance
// =============================================================================

// Cache icon lookups to avoid repeated object access
const iconCache = new Map<string, React.ComponentType<any>>();

const getNodeIcon = (iconName: string): React.ComponentType<any> => {
  if (iconCache.has(iconName)) {
    return iconCache.get(iconName)!;
  }
  // @ts-ignore
  const icon = Icons[iconName] || Activity;
  iconCache.set(iconName, icon);
  return icon;
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
    id: 'triggers',
    label: 'Triggers',
    icon: Zap,
    color: '#8b5cf6',
    nodes: TRIGGER_NODES,
    description: 'Workflow entry points'
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
    id: 'integrations',
    label: 'Integrations',
    icon: Globe,
    color: '#0088cc',
    nodes: INTEGRATION_NODES,
    description: 'External service connections'
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
  {
    id: 'llm',
    label: 'LLM / AI',
    icon: Sparkles,
    color: '#a855f7',
    nodes: LLM_NODES,
    description: 'AI-powered analysis & signals'
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    icon: Briefcase,
    color: '#06b6d4',
    nodes: PORTFOLIO_NODES,
    description: 'Portfolio data & management'
  },
  {
    id: 'agents',
    label: 'AI Agents',
    icon: Bot,
    color: '#f59e0b',
    nodes: AGENT_NODES,
    description: 'Autonomous AI analyst agents'
  },
];

// Pine Script Categories
const PINE_CATEGORIES: SidebarCategory[] = (() => {
  const bySubcategory = new Map<string, NodeCatalogItem[]>();
  PINE_SCRIPT_NODES.forEach(n => {
    const sub = n.subcategory || 'Other';
    if (!bySubcategory.has(sub)) bySubcategory.set(sub, []);
    bySubcategory.get(sub)!.push(n);
  });

  const iconMap: Record<string, LucideIcon> = {
    'Script Setup': Icons.FileCode2 as LucideIcon,
    'Inputs': Icons.SlidersHorizontal as LucideIcon,
    'Data': Icons.Database as LucideIcon,
    'Indicators': Icons.Activity as LucideIcon,
    'Conditions': Icons.GitBranch as LucideIcon,
    'Strategy': Icons.Target as LucideIcon,
    'Plotting': Icons.LineChart as LucideIcon,
    'Alerts': Icons.Bell as LucideIcon,
  };

  const colorMap: Record<string, string> = {
    'Script Setup': '#2962FF',
    'Inputs': '#00BCD4',
    'Data': '#4CAF50',
    'Indicators': '#7C4DFF',
    'Conditions': '#FF9800',
    'Strategy': '#4CAF50',
    'Plotting': '#E91E63',
    'Alerts': '#FF5722',
  };

  const order = ['Script Setup', 'Inputs', 'Data', 'Indicators', 'Conditions', 'Strategy', 'Plotting', 'Alerts'];

  return order.filter(sub => bySubcategory.has(sub)).map(sub => ({
    id: `pine-${sub.toLowerCase().replace(/\s+/g, '-')}`,
    label: sub,
    icon: iconMap[sub] || Icons.Box as LucideIcon,
    color: colorMap[sub] || '#64748b',
    nodes: bySubcategory.get(sub)!,
    description: `Pine Script ${sub.toLowerCase()} blocks`,
  }));
})();

// =============================================================================
// SUB-COMPONENTS - Optimized with memoization
// =============================================================================

// Static type colors - moved outside component to avoid recreation
const TYPE_COLORS: Record<string, string> = {
  'Price Data': 'bg-purple-500/30 text-purple-200',
  'Number': 'bg-green-500/30 text-green-200',
  'Boolean': 'bg-yellow-500/30 text-yellow-200',
  'Trigger': 'bg-blue-500/30 text-blue-200',
  'Signal': 'bg-cyan-500/30 text-cyan-200',
  'Value': 'bg-pink-500/30 text-pink-200',
  'Volume': 'bg-orange-500/30 text-orange-200',
  'Time': 'bg-indigo-500/30 text-indigo-200',
  'Size': 'bg-emerald-500/30 text-emerald-200',
  'Price': 'bg-amber-500/30 text-amber-200',
  'default': 'bg-gray-500/30 text-gray-200',
};

const getTypeColor = (type: string) => TYPE_COLORS[type] || TYPE_COLORS['default'];

const DraggableItem = memo(({ item, onDragStart, onNodeClick }: {
  item: NodeCatalogItem;
  onDragStart: (e: DragEvent, item: NodeCatalogItem) => void;
  onNodeClick: (item: NodeCatalogItem) => void;
}) => {
  // Memoize icon lookup
  const Icon = useMemo(() => getNodeIcon(item.icon), [item.icon]);

  // Memoize icon style
  const iconStyle = useMemo(() => ({
    backgroundColor: `${item.color}15`,
    color: item.color
  }), [item.color]);

  const hasIO = (item.inputs?.length ?? 0) > 0 || (item.outputs?.length ?? 0) > 0;

  // Memoize drag handler
  const handleDrag = useCallback((e: DragEvent) => onDragStart(e, item), [onDragStart, item]);
  const handleClick = useCallback(() => onNodeClick(item), [onNodeClick, item]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          draggable
          onDragStart={handleDrag}
          onClick={handleClick}
          className="group flex items-center gap-2.5 p-2.5 mb-1.5 bg-card/40 border border-white/5 rounded-lg hover:border-primary/50 hover:bg-white/5 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md"
        >
          <div
            className="p-1.5 rounded-md shrink-0"
            style={iconStyle}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-medium text-[13px] text-foreground/90 block">{item.label}</span>
            <p className="text-[10px] text-muted-foreground/70 truncate">{item.description}</p>
          </div>
          <GripHorizontal className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 shrink-0" />
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={8}
        className="z-[9999] max-w-[280px] p-3 bg-popover/95 backdrop-blur-sm border border-white/10 shadow-xl"
      >
        <div className="space-y-2">
          {/* Title */}
          <p className="font-semibold text-sm text-foreground">{item.label}</p>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {item.tooltip || item.description}
          </p>

          {/* From/To Section */}
          {hasIO && (
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                {item.inputs && item.inputs.length > 0 && (
                  <>
                    <span className="text-muted-foreground/70 font-medium">From:</span>
                    {item.inputs.map((input, i) => (
                      <span key={i} className={cn("px-1.5 py-0.5 rounded font-medium", getTypeColor(input))}>
                        {input}
                      </span>
                    ))}
                  </>
                )}
                {item.outputs && item.outputs.length > 0 && (
                  <>
                    <span className="text-muted-foreground/70 font-medium ml-1">→</span>
                    {item.outputs.map((output, i) => (
                      <span key={i} className={cn("px-1.5 py-0.5 rounded font-medium", getTypeColor(output))}>
                        {output}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
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
  const { addNode, setSearchQuery, searchQuery, leftSidebarWidth, setLeftSidebarOpen, pineScriptMode } = useStrategyFlowStore();
  const [activeCategory, setActiveCategory] = useState<string>('recent');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  /**
   * Holds the category id the user explicitly clicked. We let the
   * scroll-spy run during the smooth scroll so the rail selector
   * animates through every section as the content sweeps past it
   * (matching the natural-scroll feel). Once the scroll settles we
   * force-set `activeCategory` back to this clicked id, which
   * protects against the spy's last reading landing on a neighbour
   * (the original "selector ends up below the clicked icon" bug).
   */
  const clickTargetRef = useRef<string | null>(null);
  const settleTimerRef = useRef<number | null>(null);

  // Select categories based on mode
  const currentCategories = pineScriptMode ? PINE_CATEGORIES : TOOL_CATEGORIES;

  // Filter categories based on search query
  const filteredCategories = searchQuery.trim()
    ? currentCategories.map(cat => ({
      ...cat,
      nodes: cat.nodes.filter(node =>
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(cat => cat.nodes.length > 0)
    : currentCategories;

  // Scroll Spy Logic — picks the section currently in view as the user
  // scrolls (naturally OR via a click-driven smooth scroll). The spy
  // fires on every intermediate scroll event, so when a click triggers
  // scrollIntoView the selector walks one section at a time toward the
  // target instead of jumping.
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;

    const scrollPosition = scrollContainerRef.current.scrollTop + 100; // Offset for stickiness

    // Find current active section
    for (const cat of filteredCategories) {
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

    const wasCollapsed = isCollapsed;
    if (wasCollapsed) {
      setIsCollapsed(false);
    }

    // Kick off a smooth scroll to the target. The scroll-spy runs as
    // scroll progresses, so the rail selector animates through each
    // intermediate section. After the scroll settles, force the active
    // category to the clicked target — guards against the spy's final
    // reading landing on a neighbour.
    setTimeout(() => {
      clickTargetRef.current = id;
      const element = categoryRefs.current[id];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
      settleTimerRef.current = window.setTimeout(() => {
        if (clickTargetRef.current === id) {
          setActiveCategory(id);
          clickTargetRef.current = null;
        }
        settleTimerRef.current = null;
      }, 650);
    }, wasCollapsed ? 150 : 0);
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
          <TooltipProvider delayDuration={0}>
            {currentCategories.map((cat) => (
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
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground/60 hover:bg-white/5 hover:text-foreground transition-all"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium bg-popover text-popover-foreground text-xs">
                Settings
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowHistory(true)}
                  className="flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground/60 hover:bg-white/5 hover:text-foreground transition-all"
                >
                  <History className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium bg-popover text-popover-foreground text-xs">
                History
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowHelp(true)}
                  className="flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground/60 hover:bg-white/5 hover:text-foreground transition-all"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium bg-popover text-popover-foreground text-xs">
                Docs & Help
              </TooltipContent>
            </Tooltip>
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

        {/* Pine Script Mode Indicator */}
        {pineScriptMode && (
          <div className="px-3 py-1.5 flex items-center gap-2 border-b border-[#2962FF]/20 bg-[#2962FF]/5">
            <Icons.LineChart className="w-3 h-3 text-[#2962FF]" />
            <span className="text-[10px] font-medium text-[#2962FF]">Pine Script Mode</span>
          </div>
        )}

        {/* Scrollable Categories */}
        <TooltipProvider delayDuration={1000}>
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-2 scroll-smooth no-scrollbar"
          >
            {filteredCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/50">
                <Search className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs">No tools found for "{searchQuery}"</p>
              </div>
            ) : (
              filteredCategories.map((cat) => (
                <CategorySection
                  key={cat.id}
                  category={cat}
                  onDragStart={handleDragStart}
                  onNodeClick={handleNodeClick}
                  setRef={(el) => (categoryRefs.current[cat.id] = el)}
                />
              ))
            )}

            {/* Bottom Padding for scroll */}
            <div className="h-24" />
          </div>
        </TooltipProvider>
      </div>

      {/* Modals */}
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
      <JournalModal open={showHistory} onOpenChange={setShowHistory} />
      <HelpModal open={showHelp} onOpenChange={setShowHelp} />
    </div>
  );
});

LeftSidebar.displayName = 'LeftSidebar';
