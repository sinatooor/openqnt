/**
 * StrategyBaseNode - Base node component for all strategy flow nodes
 * Matches the dark theme design from reference screenshots
 */

import { memo, ReactNode, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow, useHandleConnections } from '@xyflow/react';
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
import { getHandleConfigs } from '../../utils/handleUtils';



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
  const { getEdge } = useReactFlow();
  
  // Get connections to determine dynamic color
  const connections = useHandleConnections({
    type: config.type as 'source' | 'target',
    id: config.id
  });

  // Calculate vertical position for multiple handles
  const offset = total > 1 ? ((index + 1) / (total + 1)) * 100 : 50;

  // Determine handle color based on connection
  let handleColor = nodeColor;
  if (connections.length > 0) {
    const edge = getEdge(connections[0].edgeId);
    if (edge?.style?.stroke) {
      handleColor = edge.style.stroke;
    }
  }

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
          background: handleColor,
          border: '2px solid hsl(var(--background))',
          boxShadow: `0 0 0 2px ${handleColor}`,
          zIndex: 50,
        }}
        className="!border-2 transition-colors duration-200"
      />
      {selected && (
        <span
          className="absolute text-[10px] font-mono font-medium tracking-tight pointer-events-none whitespace-nowrap"
          style={{
            top: `${offset}%`,
            [isLeft ? 'right' : 'left']: 'calc(100% + 16px)',
            transform: 'translateY(-180%)',
            color: handleColor,
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
