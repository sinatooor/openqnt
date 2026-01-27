/**
 * TemplatesDialog - Browse and load strategy templates
 * Equivalent to Blockly's StrategyTemplatesDialog
 */

import { memo, useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, TrendingUp, Zap, Shield, Clock, Star, Download } from 'lucide-react';
import { useStrategyFlowStore } from '../../store/strategyFlowStore';
import {
  INDICATOR_NODES,
  CONDITION_NODES,
  ACTION_NODES,
} from '../../catalog/nodeCatalog';
import { StrategyFlowNode, StrategyFlowEdge } from '../../types';

interface TemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  category: 'trend' | 'momentum' | 'mean-reversion' | 'breakout' | 'scalping';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  indicators: string[];
  nodes: StrategyFlowNode[];
  edges: StrategyFlowEdge[];
  featured?: boolean;
}

// Pre-built strategy templates
const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'sma-crossover',
    name: 'SMA Crossover',
    description: 'Classic moving average crossover strategy. Buy when fast MA crosses above slow MA.',
    category: 'trend',
    difficulty: 'beginner',
    indicators: ['SMA (Fast)', 'SMA (Slow)'],
    featured: true,
    nodes: [
      {
        id: 'sma-fast',
        type: 'indicator',
        position: { x: 100, y: 100 },
        data: { label: 'SMA (Fast)', indicatorType: 'sma', timeframe: '60', params: { period: 10 } },
      },
      {
        id: 'sma-slow',
        type: 'indicator',
        position: { x: 100, y: 220 },
        data: { label: 'SMA (Slow)', indicatorType: 'sma', timeframe: '60', params: { period: 20 } },
      },
      {
        id: 'crossover',
        type: 'condition',
        position: { x: 350, y: 160 },
        data: { label: 'Crossover', conditionType: 'crossover' },
      },
      {
        id: 'buy',
        type: 'action',
        position: { x: 600, y: 160 },
        data: { label: 'Buy', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' },
      },
    ],
    edges: [
      { id: 'e1', source: 'sma-fast', target: 'crossover' },
      { id: 'e2', source: 'sma-slow', target: 'crossover' },
      { id: 'e3', source: 'crossover', target: 'buy' },
    ],
  },
  {
    id: 'rsi-oversold',
    name: 'RSI Oversold',
    description: 'Mean reversion strategy. Buy when RSI drops below 30 (oversold).',
    category: 'mean-reversion',
    difficulty: 'beginner',
    indicators: ['RSI'],
    nodes: [
      {
        id: 'rsi',
        type: 'indicator',
        position: { x: 100, y: 150 },
        data: { label: 'RSI', indicatorType: 'rsi', timeframe: '60', params: { period: 14 } },
      },
      {
        id: 'threshold',
        type: 'condition',
        position: { x: 350, y: 150 },
        data: { label: 'RSI < 30', conditionType: 'threshold', operator: '<', value: 30 },
      },
      {
        id: 'buy',
        type: 'action',
        position: { x: 600, y: 150 },
        data: { label: 'Buy', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' },
      },
    ],
    edges: [
      { id: 'e1', source: 'rsi', target: 'threshold' },
      { id: 'e2', source: 'threshold', target: 'buy' },
    ],
  },
  {
    id: 'macd-signal',
    name: 'MACD Signal Cross',
    description: 'Momentum strategy using MACD line crossing signal line.',
    category: 'momentum',
    difficulty: 'intermediate',
    indicators: ['MACD'],
    featured: true,
    nodes: [
      {
        id: 'macd',
        type: 'indicator',
        position: { x: 100, y: 150 },
        data: { label: 'MACD', indicatorType: 'macd', timeframe: '60', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
      },
      {
        id: 'crossover',
        type: 'condition',
        position: { x: 350, y: 150 },
        data: { label: 'MACD Crossover', conditionType: 'crossover' },
      },
      {
        id: 'buy',
        type: 'action',
        position: { x: 600, y: 150 },
        data: { label: 'Buy', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' },
      },
    ],
    edges: [
      { id: 'e1', source: 'macd', target: 'crossover' },
      { id: 'e2', source: 'crossover', target: 'buy' },
    ],
  },
  {
    id: 'bb-breakout',
    name: 'Bollinger Band Breakout',
    description: 'Breakout strategy. Buy when price breaks above upper Bollinger Band.',
    category: 'breakout',
    difficulty: 'intermediate',
    indicators: ['Bollinger Bands'],
    nodes: [
      {
        id: 'bb',
        type: 'indicator',
        position: { x: 100, y: 150 },
        data: { label: 'Bollinger Bands', indicatorType: 'bb', timeframe: '60', params: { period: 20, stdDev: 2 } },
      },
      {
        id: 'price',
        type: 'environment',
        position: { x: 100, y: 280 },
        data: { label: 'Price', environmentType: 'price', priceType: 'mid' },
      },
      {
        id: 'compare',
        type: 'condition',
        position: { x: 350, y: 200 },
        data: { label: 'Price > Upper', conditionType: 'compare', operator: '>' },
      },
      {
        id: 'buy',
        type: 'action',
        position: { x: 600, y: 200 },
        data: { label: 'Buy', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' },
      },
    ],
    edges: [
      { id: 'e1', source: 'bb', target: 'compare' },
      { id: 'e2', source: 'price', target: 'compare' },
      { id: 'e3', source: 'compare', target: 'buy' },
    ],
  },
  {
    id: 'triple-ema',
    name: 'Triple EMA',
    description: 'Advanced trend following with 3 EMAs for confirmation.',
    category: 'trend',
    difficulty: 'advanced',
    indicators: ['EMA (Fast)', 'EMA (Medium)', 'EMA (Slow)'],
    nodes: [
      {
        id: 'ema-fast',
        type: 'indicator',
        position: { x: 100, y: 80 },
        data: { label: 'EMA 9', indicatorType: 'ema', timeframe: '60', params: { period: 9 } },
      },
      {
        id: 'ema-medium',
        type: 'indicator',
        position: { x: 100, y: 200 },
        data: { label: 'EMA 21', indicatorType: 'ema', timeframe: '60', params: { period: 21 } },
      },
      {
        id: 'ema-slow',
        type: 'indicator',
        position: { x: 100, y: 320 },
        data: { label: 'EMA 55', indicatorType: 'ema', timeframe: '60', params: { period: 55 } },
      },
      {
        id: 'cross1',
        type: 'condition',
        position: { x: 350, y: 140 },
        data: { label: 'Fast > Medium', conditionType: 'compare', operator: '>' },
      },
      {
        id: 'cross2',
        type: 'condition',
        position: { x: 350, y: 260 },
        data: { label: 'Medium > Slow', conditionType: 'compare', operator: '>' },
      },
      {
        id: 'and',
        type: 'condition',
        position: { x: 550, y: 200 },
        data: { label: 'AND', conditionType: 'and' },
      },
      {
        id: 'buy',
        type: 'action',
        position: { x: 750, y: 200 },
        data: { label: 'Buy', actionType: 'order', direction: 'long', size: 10, sizeType: 'percent' },
      },
    ],
    edges: [
      { id: 'e1', source: 'ema-fast', target: 'cross1' },
      { id: 'e2', source: 'ema-medium', target: 'cross1' },
      { id: 'e3', source: 'ema-medium', target: 'cross2' },
      { id: 'e4', source: 'ema-slow', target: 'cross2' },
      { id: 'e5', source: 'cross1', target: 'and' },
      { id: 'e6', source: 'cross2', target: 'and' },
      { id: 'e7', source: 'and', target: 'buy' },
    ],
  },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  trend: <TrendingUp className="w-4 h-4" />,
  momentum: <Zap className="w-4 h-4" />,
  'mean-reversion': <Shield className="w-4 h-4" />,
  breakout: <TrendingUp className="w-4 h-4" />,
  scalping: <Clock className="w-4 h-4" />,
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-500/20 text-green-400',
  intermediate: 'bg-yellow-500/20 text-yellow-400',
  advanced: 'bg-red-500/20 text-red-400',
};

export const TemplatesDialog = memo(({ open, onOpenChange }: TemplatesDialogProps) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { clearCanvas } = useStrategyFlowStore();

  const filteredTemplates = useMemo(() => {
    return STRATEGY_TEMPLATES.filter(t => {
      const matchesSearch = !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !selectedCategory || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory]);

  const handleLoadTemplate = (template: StrategyTemplate) => {
    const store = useStrategyFlowStore.getState();

    // Clear current canvas and load template
    store.clearCanvas();

    // Add nodes
    template.nodes.forEach(node => {
      store.addNode(
        {
          type: (node.data as any).indicatorType || (node.data as any).conditionType || (node.data as any).actionType || (node.data as any).environmentType || 'unknown',
          nodeType: node.type as any,
          label: node.data.label as string,
          description: node.data.description as string || '',
          category: 'indicators',
          icon: 'Activity',
          color: '#8b5cf6',
          defaultData: node.data as any,
        },
        node.position
      );
    });

    // Note: Edges would need to be reconnected based on new node IDs
    // This is a simplified implementation

    store.setStrategyName(template.name);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl bg-card/80 backdrop-blur-xl border-border/50 text-foreground max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            Strategy Templates
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Choose a pre-built strategy template to get started quickly.
          </DialogDescription>
        </DialogHeader>

        {/* Search and Filters */}
        <div className="flex items-center gap-3 mt-2">
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
          {['trend', 'momentum', 'mean-reversion', 'breakout'].map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className="border-border capitalize"
            >
              {CATEGORY_ICONS[cat]}
              <span className="ml-1">{cat}</span>
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
                    className="bg-purple-600 hover:bg-purple-700 opacity-0 group-hover:opacity-100 transition-opacity"
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
      </DialogContent>
    </Dialog>
  );
});

TemplatesDialog.displayName = 'TemplatesDialog';
