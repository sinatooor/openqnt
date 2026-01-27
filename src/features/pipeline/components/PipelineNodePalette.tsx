/**
 * PipelineNodePalette - Side panel for dragging nodes onto canvas
 */

import { memo, DragEvent } from 'react';
import { 
  Puzzle, 
  Zap, 
  Sparkles, 
  LineChart, 
  Database, 
  Bell,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePipelineStore } from '../store/pipelineStore';
import { PipelineNodeType } from '../types';

interface NodePaletteItem {
  type: PipelineNodeType;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const NODE_PALETTE: NodePaletteItem[] = [
  {
    type: 'strategy',
    label: 'Strategy',
    icon: <Puzzle className="w-4 h-4" />,
    color: '#8b5cf6',
    description: 'Blockly strategy blocks that generate trading signals',
  },
  {
    type: 'execution',
    label: 'Execute',
    icon: <Zap className="w-4 h-4" />,
    color: '#10b981',
    description: 'Execute trades on connected broker',
  },
  {
    type: 'prompt',
    label: 'AI Prompt',
    icon: <Sparkles className="w-4 h-4" />,
    color: '#f59e0b',
    description: 'Process data with AI/LLM models',
  },
  {
    type: 'backtest',
    label: 'Backtest',
    icon: <LineChart className="w-4 h-4" />,
    color: '#06b6d4',
    description: 'Run historical backtests on strategies',
  },
  {
    type: 'dataSource',
    label: 'Data',
    icon: <Database className="w-4 h-4" />,
    color: '#6366f1',
    description: 'Market data feeds and sources',
  },
  {
    type: 'notification',
    label: 'Notify',
    icon: <Bell className="w-4 h-4" />,
    color: '#ec4899',
    description: 'Send alerts via email, SMS, Telegram',
  },
];

export const PipelineNodePalette = memo(() => {
  const { 
    addStrategyNode,
    addExecutionNode,
    addPromptNode,
    addBacktestNode,
    addDataSourceNode,
    addNotificationNode,
  } = usePipelineStore();

  const handleDragStart = (e: DragEvent, nodeType: PipelineNodeType) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleAddNode = (type: PipelineNodeType) => {
    // Add node at center of viewport
    const position = {
      x: 200 + Math.random() * 100,
      y: 150 + Math.random() * 100,
    };

    switch (type) {
      case 'strategy':
        addStrategyNode(position);
        break;
      case 'execution':
        addExecutionNode(position);
        break;
      case 'prompt':
        addPromptNode(position);
        break;
      case 'backtest':
        addBacktestNode(position);
        break;
      case 'dataSource':
        addDataSourceNode(position);
        break;
      case 'notification':
        addNotificationNode(position);
        break;
    }
  };

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex flex-col gap-1 p-1.5 bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-xl">
        <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Nodes
        </div>
        
        {NODE_PALETTE.map((item) => (
          <Tooltip key={item.type}>
            <TooltipTrigger asChild>
              <button
                draggable
                onDragStart={(e) => handleDragStart(e, item.type)}
                onClick={() => handleAddNode(item.type)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-accent/80 transition-all duration-150 cursor-grab active:cursor-grabbing active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 text-left"
                aria-label={`Add ${item.label} node`}
              >
                <div 
                  className="p-1.5 rounded-md flex-shrink-0"
                  style={{ backgroundColor: `${item.color}15`, color: item.color }}
                >
                  {item.icon}
                </div>
                <span className="text-xs font-medium text-foreground/90 truncate">
                  {item.label}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[180px]">
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Click or drag to add</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
});

PipelineNodePalette.displayName = 'PipelineNodePalette';
