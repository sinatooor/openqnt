/**
 * StrategyBaseNode - Base node component for all strategy flow nodes
 * Matches the dark theme design from reference screenshots
 */

import { memo, ReactNode, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { MoreHorizontal, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useStrategyFlowStore } from '../../store/strategyFlowStore';
import { StrategyNodeData, HandleConfig } from '../../types';

// =============================================================================
// HANDLE CONFIGURATIONS FOR DIFFERENT NODE TYPES
// =============================================================================

export const getHandleConfigs = (nodeType: string, subType?: string): HandleConfig[] => {
  switch (nodeType) {
    case 'indicator':
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
}

const NodeHandle = memo(({ config, nodeColor, index, total }: NodeHandleProps) => {
  const isLeft = config.position === 'left';
  
  // Calculate vertical position for multiple handles
  const offset = total > 1 ? ((index + 1) / (total + 1)) * 100 : 50;

  return (
    <Handle
      type={config.type}
      position={isLeft ? Position.Left : Position.Right}
      id={config.id}
      style={{
        top: `${offset}%`,
        width: 10,
        height: 10,
        background: nodeColor,
        border: '2px solid rgba(0,0,0,0.3)',
      }}
      className="!border-2"
    />
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
          className={cn(
            'min-w-[180px] max-w-[280px] rounded-xl overflow-hidden transition-all duration-150',
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
            <button 
              className="p-1 rounded hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                selectNode(id);
              }}
            >
              <MoreHorizontal className="w-4 h-4 text-white/50" />
            </button>
          </div>

          {/* Content */}
          {children && (
            <div className="px-3 py-2 border-t border-white/5">
              {children}
            </div>
          )}

          {/* Handle Labels */}
          {(leftHandles.length > 0 || rightHandles.length > 0) && (
            <div className="px-3 py-1.5 border-t border-white/5 flex justify-between text-[10px] text-white/40">
              <div className="space-y-1">
                {leftHandles.map((h, i) => (
                  <div key={h.id} className="flex items-center gap-1">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span>{h.label}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-right">
                {rightHandles.map((h, i) => (
                  <div key={h.id} className="flex items-center gap-1 justify-end">
                    <span>{h.label}</span>
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Handles */}
          {leftHandles.map((config, i) => (
            <NodeHandle 
              key={config.id} 
              config={config} 
              nodeColor={color}
              index={i}
              total={leftHandles.length}
            />
          ))}
          {rightHandles.map((config, i) => (
            <NodeHandle 
              key={config.id} 
              config={config} 
              nodeColor={color}
              index={i}
              total={rightHandles.length}
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
