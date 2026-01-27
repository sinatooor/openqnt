/**
 * StrategyBaseNode - Base node component for all strategy flow nodes
 * Matches the dark theme design from reference screenshots
 */

import { memo, ReactNode, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { MoreHorizontal, Lock, Copy, Pencil, Trash2, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStrategyFlowStore } from '../../store/strategyFlowStore';
import { StrategyNodeData, HandleConfig } from '../../types';

// =============================================================================
// HANDLE CONFIGURATIONS FOR DIFFERENT NODE TYPES
// =============================================================================

export const getHandleConfigs = (nodeType: string, subType?: string): HandleConfig[] => {
  switch (nodeType) {
    case 'indicator':
      // Multi-output indicators based on BLOCK_CATALOG.xml
      // Bands & Channels with upper/middle/lower
      if (subType === 'bb' || subType === 'keltner' || subType === 'donchian') {
        return [
          { id: 'upper', type: 'source', position: 'right', label: 'Upper', dataType: 'number' },
          { id: 'middle', type: 'source', position: 'right', label: 'Middle', dataType: 'number' },
          { id: 'lower', type: 'source', position: 'right', label: 'Lower', dataType: 'number' },
        ];
      }
      // Envelopes with upper/lower only
      if (subType === 'envelopes') {
        return [
          { id: 'upper', type: 'source', position: 'right', label: 'Upper', dataType: 'number' },
          { id: 'lower', type: 'source', position: 'right', label: 'Lower', dataType: 'number' },
        ];
      }
      // MACD with line/signal/histogram
      if (subType === 'macd') {
        return [
          { id: 'line', type: 'source', position: 'right', label: 'MACD', dataType: 'number' },
          { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'number' },
          { id: 'histogram', type: 'source', position: 'right', label: 'Histogram', dataType: 'number' },
        ];
      }
      // Stochastic with main/signal
      if (subType === 'stochastic') {
        return [
          { id: 'main', type: 'source', position: 'right', label: '%K', dataType: 'number' },
          { id: 'signal', type: 'source', position: 'right', label: '%D', dataType: 'number' },
        ];
      }
      // Ichimoku with 5 lines
      if (subType === 'ichimoku') {
        return [
          { id: 'tenkan', type: 'source', position: 'right', label: 'Tenkan', dataType: 'number' },
          { id: 'kijun', type: 'source', position: 'right', label: 'Kijun', dataType: 'number' },
          { id: 'senkou_a', type: 'source', position: 'right', label: 'Senkou A', dataType: 'number' },
          { id: 'senkou_b', type: 'source', position: 'right', label: 'Senkou B', dataType: 'number' },
          { id: 'chikou', type: 'source', position: 'right', label: 'Chikou', dataType: 'number' },
        ];
      }
      // Alligator with jaw/teeth/lips
      if (subType === 'alligator') {
        return [
          { id: 'jaw', type: 'source', position: 'right', label: 'Jaw', dataType: 'number' },
          { id: 'teeth', type: 'source', position: 'right', label: 'Teeth', dataType: 'number' },
          { id: 'lips', type: 'source', position: 'right', label: 'Lips', dataType: 'number' },
        ];
      }
      // Gator with upper/lower
      if (subType === 'gator') {
        return [
          { id: 'upper', type: 'source', position: 'right', label: 'Upper', dataType: 'number' },
          { id: 'lower', type: 'source', position: 'right', label: 'Lower', dataType: 'number' },
        ];
      }
      // DMI with +DI/-DI/ADX
      if (subType === 'dmi') {
        return [
          { id: 'plus_di', type: 'source', position: 'right', label: '+DI', dataType: 'number' },
          { id: 'minus_di', type: 'source', position: 'right', label: '-DI', dataType: 'number' },
          { id: 'adx', type: 'source', position: 'right', label: 'ADX', dataType: 'number' },
        ];
      }
      // RVI with main/signal
      if (subType === 'rvi') {
        return [
          { id: 'main', type: 'source', position: 'right', label: 'Main', dataType: 'number' },
          { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'number' },
        ];
      }
      // OsMA with main/signal
      if (subType === 'osma') {
        return [
          { id: 'main', type: 'source', position: 'right', label: 'Main', dataType: 'number' },
          { id: 'signal', type: 'source', position: 'right', label: 'Signal', dataType: 'number' },
        ];
      }
      // Fractals with upper/lower
      if (subType === 'fractals') {
        return [
          { id: 'upper', type: 'source', position: 'right', label: 'Upper', dataType: 'number' },
          { id: 'lower', type: 'source', position: 'right', label: 'Lower', dataType: 'number' },
        ];
      }
      // Aroon with Up/Down
      if (subType === 'aroon') {
        return [
          { id: 'aroonup', type: 'source', position: 'right', label: 'Up', dataType: 'number' },
          { id: 'aroondown', type: 'source', position: 'right', label: 'Down', dataType: 'number' },
        ];
      }
      // Hilbert Transform Phasor
      if (subType === 'ht_phasor') {
        return [
          { id: 'inphase', type: 'source', position: 'right', label: 'InPhase', dataType: 'number' },
          { id: 'quadrature', type: 'source', position: 'right', label: 'Quad', dataType: 'number' },
        ];
      }
      // Hilbert Transform Sine
      if (subType === 'ht_sine') {
        return [
          { id: 'sine', type: 'source', position: 'right', label: 'Sine', dataType: 'number' },
          { id: 'leadsine', type: 'source', position: 'right', label: 'Lead', dataType: 'number' },
        ];
      }
      // Stochastic RSI
      if (subType === 'stochrsi') {
        return [
          { id: 'k', type: 'source', position: 'right', label: '%K', dataType: 'number' },
          { id: 'd', type: 'source', position: 'right', label: '%D', dataType: 'number' },
        ];
      }
      // Default: single output for simple indicators
      return [
        { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
      ];

    case 'condition':
      if (subType === 'and' || subType === 'or') {
        return [
          { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'boolean' },
          { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'boolean' },
          { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
        ];
      }
      if (subType === 'not') {
        return [
          { id: 'input', type: 'target', position: 'left', label: 'Input', dataType: 'boolean' },
          { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'boolean' },
        ];
      }
      return [
        { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'number' },
        { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'number' },
        { id: 'output', type: 'source', position: 'right', label: 'Signal', dataType: 'boolean' },
      ];

    case 'action':
      if (subType === 'stopLoss' || subType === 'takeProfit') {
        return [
          { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
          { id: 'price', type: 'target', position: 'left', label: 'Price', dataType: 'number' },
          { id: 'next', type: 'source', position: 'right', label: 'Next', dataType: 'signal' },
        ];
      }
      if (subType === 'order') {
        return [
          { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
          { id: 'size', type: 'target', position: 'left', label: 'Size', dataType: 'number' }, // Optional dynamic size
          { id: 'next', type: 'source', position: 'right', label: 'Next', dataType: 'signal' },
        ];
      }
      return [
        { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
        { id: 'next', type: 'source', position: 'right', label: 'Next', dataType: 'signal' },
      ];

    case 'environment':
      return [
        { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
      ];

    case 'control':
      if (subType === 'if' || subType === 'ifElse') {
        return [
          { id: 'condition', type: 'target', position: 'left', label: 'Condition', dataType: 'boolean' },
          { id: 'then', type: 'source', position: 'right', label: 'Then', dataType: 'signal' },
          ...(subType === 'ifElse' ? [{ id: 'else', type: 'source', position: 'right', label: 'Else', dataType: 'signal' } as HandleConfig] : []),
        ];
      }
      return [
        { id: 'trigger', type: 'target', position: 'left', label: 'Trigger', dataType: 'signal' },
        { id: 'output', type: 'source', position: 'right', label: 'Output', dataType: 'signal' },
      ];

    case 'variable':
      if (subType === 'getVariable') {
        return [
          { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'any' },
        ];
      }
      return [
        { id: 'input', type: 'target', position: 'left', label: 'Input', dataType: 'any' },
        { id: 'output', type: 'source', position: 'right', label: 'Output', dataType: 'signal' },
      ];

    case 'math':
      // Number node: output only
      if (subType === 'number') {
        return [
          { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
        ];
      }
      // Advanced math: single input, single output
      if (subType === 'advancedMath') {
        return [
          { id: 'input', type: 'target', position: 'left', label: 'Input', dataType: 'number' },
          { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'number' },
        ];
      }
      // Binary operators: two inputs, one output
      return [
        { id: 'input-a', type: 'target', position: 'left', label: 'A', dataType: 'number' },
        { id: 'input-b', type: 'target', position: 'left', label: 'B', dataType: 'number' },
        { id: 'output', type: 'source', position: 'right', label: 'Result', dataType: 'number' },
      ];

    case 'risk':
      // Risk params usually output a number (size, distance) or act as a rule (target?)
      // For now, treat them as sources of configuration values or rules
      if (['positionPercent', 'kellyCriterion', 'fixedAmount'].includes(subType || '')) {
        return [
          { id: 'size', type: 'source', position: 'right', label: 'Size', dataType: 'number' },
        ];
      }
      if (['trailingStop'].includes(subType || '')) {
        return [
          { id: 'output', type: 'source', position: 'right', label: 'Rule', dataType: 'any' },
        ];
      }
      // Global limits might not need handles, or could be outputs to Strategy Settings?
      // Let's provide an output just in case they are used as inputs to Trade nodes
      return [
        { id: 'output', type: 'source', position: 'right', label: 'Config', dataType: 'any' },
      ];

    case 'tradeInfo':
      // Trade info nodes source values
      return [
        { id: 'output', type: 'source', position: 'right', label: 'Value', dataType: 'number' },
      ];

    default:
      return [];
  }
};

// =============================================================================
// HANDLE COMPONENT
// =============================================================================

interface NodeHandleProps {
  config: HandleConfig;
  nodeColor: string;
  index: number;
  total: number;
  selected?: boolean;
}

const NodeHandle = memo(({ config, nodeColor, index, total, selected }: NodeHandleProps) => {
  const isLeft = config.position === 'left';

  // Calculate vertical position for multiple handles
  const offset = total > 1 ? ((index + 1) / (total + 1)) * 100 : 50;

  return (
    <>
      <Handle
        type={config.type}
        position={isLeft ? Position.Left : Position.Right}
        id={config.id}
        style={{
          top: `${offset}%`,
          width: 12,
          height: 12,
          background: nodeColor,
          border: '2px solid hsl(var(--background))',
          boxShadow: `0 0 0 2px ${nodeColor}`,
          zIndex: 50,
        }}
        className="!border-2"
      />
      {selected && (
        <span
          className="absolute text-[10px] font-mono font-medium tracking-tight pointer-events-none whitespace-nowrap"
          style={{
            top: `${offset}%`,
            [isLeft ? 'right' : 'left']: 'calc(100% + 8px)',
            transform: 'translateY(-50%)',
            color: nodeColor,
          }}
        >
          {config.label}
        </span>
      )}
    </>
  );
});

NodeHandle.displayName = 'NodeHandle';

// =============================================================================
// BASE NODE PROPS
// =============================================================================

interface StrategyBaseNodeProps {
  id: string;
  data: StrategyNodeData;
  selected?: boolean;
  nodeType: string;
  subType?: string;
  color: string;
  icon: ReactNode;
  children?: ReactNode;
}

// =============================================================================
// BASE NODE COMPONENT
// =============================================================================

export const StrategyBaseNode = memo(({
  id,
  data,
  selected,
  nodeType,
  subType,
  color,
  icon,
  children,
}: StrategyBaseNodeProps) => {
  const { selectNode, duplicateNode, deleteNode, lockNode } = useStrategyFlowStore();

  const handleConfigs = getHandleConfigs(nodeType, subType);
  const leftHandles = handleConfigs.filter(h => h.position === 'left');
  const rightHandles = handleConfigs.filter(h => h.position === 'right');

  const handleClick = useCallback(() => {
    selectNode(id);
  }, [id, selectNode]);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          onClick={handleClick}
          className="relative min-w-[180px] max-w-[280px] group"
        >
          {/* Visual Card Content - Inner Wrapper handles the styling/overflow */}
          <div
            className={cn(
              'rounded-xl overflow-hidden transition-all duration-150',
              'bg-[#1a1a1a] border-2',
              selected
                ? 'border-white/30 shadow-lg shadow-black/50'
                : 'border-white/10 hover:border-white/20',
              data.locked && 'opacity-75'
            )}
            style={{
              boxShadow: selected ? `0 0 20px ${color}30` : undefined,
            }}
          >
            {/* Header */}
            <div
              className="px-3 py-2 flex items-center gap-2"
              style={{ backgroundColor: `${color}15` }}
            >
              <div
                className="p-1.5 rounded-md"
                style={{ backgroundColor: `${color}30`, color }}
              >
                {icon}
              </div>
              <span className="text-sm font-medium text-white/90 flex-1 truncate">
                {data.label}
              </span>
              {data.locked && (
                <Lock className="w-3.5 h-3.5 text-white/50" />
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 rounded hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Keep node selected when menu is open
                      selectNode(id);
                    }}
                  >
                    <MoreHorizontal className="w-4 h-4 text-white/50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-[#1a1a1a] border-white/10 text-white">
                  <DropdownMenuItem onClick={() => duplicateNode(id)} className="focus:bg-white/10 focus:text-white cursor-pointer">
                    <Copy className="mr-2 h-4 w-4" />
                    <span>Duplicate</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigator.clipboard.writeText(id)} className="focus:bg-white/10 focus:text-white cursor-pointer">
                    <Pencil className="mr-2 h-4 w-4" />
                    <span>Rename</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => lockNode(id, !data.locked)} className="focus:bg-white/10 focus:text-white cursor-pointer">
                    {data.locked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                    <span>{data.locked ? 'Unlock' : 'Lock'}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={() => deleteNode(id)}
                    className="text-red-400 focus:text-red-400 focus:bg-red-400/10 cursor-pointer"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Content */}
            {children && (
              <div className="px-3 py-2 border-t border-white/5">
                {children}
              </div>
            )}

            {/* Internal Visual Guide Labels (optional, keeping for now inside card) */}
            {(leftHandles.length > 0 || rightHandles.length > 0) && (
              <div className="px-3 py-1.5 border-t border-white/5 flex justify-between text-[10px] text-white/40">
                <div className="space-y-1">
                  {leftHandles.map((h, i) => (
                    <div key={h.id} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span>{h.label}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 text-right">
                  {rightHandles.map((h, i) => (
                    <div key={h.id} className="flex items-center gap-1 justify-end">
                      <span>{h.label}</span>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Handles - Rendered OUTSIDE the overflow-hidden card to allow labels to float */}
          {leftHandles.map((config, i) => (
            <NodeHandle
              key={config.id}
              config={config}
              nodeColor={color}
              index={i}
              total={leftHandles.length}
              selected={selected}
            />
          ))}
          {rightHandles.map((config, i) => (
            <NodeHandle
              key={config.id}
              config={config}
              nodeColor={color}
              index={i}
              total={rightHandles.length}
              selected={selected}
            />
          ))}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => duplicateNode(id)}>
          Duplicate
          <ContextMenuShortcut>⌘D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => navigator.clipboard.writeText(id)}>
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={() => lockNode(id, !data.locked)}>
          {data.locked ? 'Unlock' : 'Lock'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => deleteNode(id)}
          className="text-destructive focus:text-destructive"
        >
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

StrategyBaseNode.displayName = 'StrategyBaseNode';
