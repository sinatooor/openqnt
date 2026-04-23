/**
 * TemplatesDialog - Browse and load strategy templates
 * Equivalent to Blockly's StrategyTemplatesDialog
 */

import { memo, useState, useMemo } from 'react';
import { WindowModal } from './WindowModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  TrendingUp,
  Zap,
  Shield,
  Clock,
  Star,
  Download,
  Layers,
  ShieldAlert,
  PieChart,
  LineChart,
  Bot,
} from 'lucide-react';
import { useStrategyFlowStore, EDGE_DATA_TYPE_COLORS } from '../../store/strategyFlowStore';
import { StrategyFlowNode, StrategyFlowEdge } from '../../types';
import { getHandleConfigs, repairEdges } from '../../utils/handleUtils';
import {
  StrategyTemplate,
  STRATEGY_TEMPLATES,
  PINE_SCRIPT_TEMPLATES,
  ADDITIONAL_STRATEGY_TEMPLATES,
  ADVANCED_STRATEGY_TEMPLATES,
  AGENTIC_STRATEGY_TEMPLATES,
} from '../../templates';

interface TemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  trend: <TrendingUp className="w-4 h-4" />,
  momentum: <Zap className="w-4 h-4" />,
  'mean-reversion': <Shield className="w-4 h-4" />,
  breakout: <TrendingUp className="w-4 h-4" />,
  scalping: <Clock className="w-4 h-4" />,
  trading: <TrendingUp className="w-4 h-4" />,
  hedging: <Shield className="w-4 h-4" />,
  portfolio: <PieChart className="w-4 h-4" />,
  'risk-management': <ShieldAlert className="w-4 h-4" />,
  pinescript: <LineChart className="w-4 h-4" />,
  agentic: <Bot className="w-4 h-4" />,
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-500/20 text-green-400',
  intermediate: 'bg-yellow-500/20 text-yellow-400',
  advanced: 'bg-red-500/20 text-red-400',
};

export const TemplatesDialog = memo(({ open, onOpenChange }: TemplatesDialogProps) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { clearCanvas, pineScriptMode } = useStrategyFlowStore();

  // Combine all templates, filter by mode
  const allTemplates = useMemo(() => {
    if (pineScriptMode) {
      return PINE_SCRIPT_TEMPLATES;
    }
    return [...AGENTIC_STRATEGY_TEMPLATES, ...STRATEGY_TEMPLATES, ...ADDITIONAL_STRATEGY_TEMPLATES, ...ADVANCED_STRATEGY_TEMPLATES];
  }, [pineScriptMode]);

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter(t => {
      const matchesSearch = !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !selectedCategory || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory, allTemplates]);

  const handleLoadTemplate = (template: StrategyTemplate) => {
    const store = useStrategyFlowStore.getState();

    // Clear current canvas
    store.clearCanvas();

    // Create a mapping from template node IDs to new node IDs
    const nodeIdMap: Record<string, string> = {};
    const newNodes: StrategyFlowNode[] = [];

    // Create nodes with new IDs
    template.nodes.forEach(node => {
      const newId = `${node.type}-${Math.random().toString(36).substring(2, 8)}`;
      nodeIdMap[node.id] = newId;

      newNodes.push({
        ...node,
        id: newId,
      });
    });

    // Remap edge source/target to new node IDs
    const remappedEdges: StrategyFlowEdge[] = template.edges.map(edge => ({
      ...edge,
      id: `edge-${Math.random().toString(36).substring(2, 8)}`,
      source: nodeIdMap[edge.source],
      target: nodeIdMap[edge.target],
    }));

    // Repair edges: auto-fill/fix sourceHandle and targetHandle to match actual node handles
    const repairedEdges = repairEdges(newNodes, remappedEdges);

    // Apply edge colors and styling based on source handle data type
    const styledEdges: StrategyFlowEdge[] = repairedEdges.map(edge => {
      const sourceNode = newNodes.find(n => n.id === edge.source);
      let edgeColor = EDGE_DATA_TYPE_COLORS.default;

      if (sourceNode) {
        const nodeType = sourceNode.type || '';
        const subType = (sourceNode.data as any)?.indicatorType ||
          (sourceNode.data as any)?.conditionType ||
          (sourceNode.data as any)?.actionType ||
          (sourceNode.data as any)?.environmentType ||
          (sourceNode.data as any)?.mathType;

        const handleConfigs = getHandleConfigs(nodeType, subType);

        // Find the specific source handle (now guaranteed correct after repair)
        const sourceHandleConfig = edge.sourceHandle
          ? handleConfigs.find(h => h.id === edge.sourceHandle && h.type === 'source')
          : handleConfigs.find(h => h.type === 'source');

        if (sourceHandleConfig?.dataType) {
          edgeColor = EDGE_DATA_TYPE_COLORS[sourceHandleConfig.dataType] || edgeColor;
        }
      }

      return {
        ...edge,
        type: 'bezier',
        animated: false,
        style: {
          stroke: edgeColor,
          strokeWidth: 2,
        },
      };
    });

    // Set nodes and edges directly via onNodesChange and onEdgesChange
    store.onNodesChange(newNodes.map(n => ({ type: 'add' as const, item: n })));
    store.onEdgesChange(styledEdges.map(e => ({ type: 'add' as const, item: e })));

    store.setStrategyName(template.name);
    // Carry the canonical-engine spec along with the template so the
    // Backtest button knows it can route through /api/backtest/run instead
    // of the legacy code-gen path.
    store.setTemplateBacktestSpec(template.backtestSpec ?? null);
    onOpenChange(false);
  };

  return (
    <WindowModal
      open={open}
      onOpenChange={onOpenChange}
      title={pineScriptMode ? 'Pine Script Templates' : 'Strategy Templates'}
      icon={pineScriptMode ? <LineChart className="w-5 h-5 text-[#2962FF]" /> : <Layers className="w-5 h-5 text-yellow-400" />}
      defaultWidth={900}
      defaultHeight={700}
      minWidth={600}
      minHeight={400}
    >
      <div className="p-4">
        <p className="text-sm text-muted-foreground mb-4">
          {pineScriptMode
            ? 'Choose a Pine Script template to start building TradingView scripts.'
            : 'Choose a pre-built strategy template to get started quickly.'}
        </p>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary border-border"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === null ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className="border-border"
          >
            All
          </Button>
          {(pineScriptMode
            ? ['pinescript']
            : [
              'trend',
              'momentum',
              'mean-reversion',
              'breakout',
              'scalping',
              'trading',
              'hedging',
              'portfolio',
              'risk-management',
            ]
          ).map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className="border-border capitalize"
            >
              {CATEGORY_ICONS[cat]}
              <span className="ml-1">{cat.replace('-', ' ')}</span>
            </Button>
          ))}
        </div>

        {/* Templates Grid */}
        <ScrollArea className="h-[400px] mt-4">
          <div className="grid grid-cols-1 gap-3 pr-4">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                className="p-4 bg-secondary rounded-lg border border-border hover:border-purple-500/50 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground">{template.name}</h3>
                      {template.featured && (
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={DIFFICULTY_COLORS[template.difficulty]}>
                        {template.difficulty}
                      </Badge>
                      <Badge variant="outline" className="border-border text-muted-foreground">
                        {template.indicators.length} indicators
                      </Badge>
                      <Badge variant="outline" className="border-border text-muted-foreground capitalize">
                        {template.category}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleLoadTemplate(template)}
                    className={pineScriptMode
                      ? 'bg-[#2962FF] hover:bg-[#2962FF]/80 opacity-0 group-hover:opacity-100 transition-opacity'
                      : 'bg-purple-600 hover:bg-purple-700 opacity-0 group-hover:opacity-100 transition-opacity'
                    }
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Load
                  </Button>
                </div>
              </div>
            ))}

            {filteredTemplates.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No templates match your search.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </WindowModal>
  );
});

TemplatesDialog.displayName = 'TemplatesDialog';
