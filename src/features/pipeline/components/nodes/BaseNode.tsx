/**
 * BaseNode - Shared styling and structure for all pipeline nodes
 */

import { ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

interface HandleConfig {
  id: string;
  type: 'source' | 'target';
  position: Position;
  label?: string;
  color?: string;
  style?: React.CSSProperties;
}

interface BaseNodeProps {
  children: ReactNode;
  title: string;
  icon: ReactNode;
  color: string;
  selected?: boolean;
  handles?: HandleConfig[];
  className?: string;
  status?: 'idle' | 'running' | 'success' | 'error';
  statusText?: string;
}

export const BaseNode = ({
  children,
  title,
  icon,
  color,
  selected,
  handles = [
    { id: 'input', type: 'target', position: Position.Left },
    { id: 'output', type: 'source', position: Position.Right },
  ],
  className,
  status = 'idle',
  statusText,
}: BaseNodeProps) => {
  const statusColors = {
    idle: 'bg-muted-foreground/20',
    running: 'bg-blue-500 animate-pulse',
    success: 'bg-green-500',
    error: 'bg-red-500',
  };

  return (
    <div
      className={cn(
        'min-w-[260px] max-w-[300px] rounded-lg border-2 bg-card/95 backdrop-blur shadow-xl transition-all duration-200',
        selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.02]' : '',
        'hover:shadow-2xl',
        className
      )}
      style={{ borderColor: color }}
    >
      {/* Render Handles */}
      {handles.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type={handle.type}
          position={handle.position}
          className={cn(
            '!w-3 !h-3 !border-2 !border-background transition-transform hover:scale-125',
            handle.type === 'source' ? '!bg-primary' : '!bg-muted-foreground'
          )}
          style={{
            backgroundColor: handle.color,
            ...handle.style,
          }}
        />
      ))}

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-md cursor-grab active:cursor-grabbing"
        style={{ backgroundColor: `${color}15` }}
      >
        <GripVertical className="w-3 h-3 text-muted-foreground/50" />
        <div style={{ color }} className="flex-shrink-0">{icon}</div>
        <span className="text-xs font-semibold text-foreground truncate flex-1">{title}</span>
        
        {/* Status Indicator */}
        <div className="flex items-center gap-1.5">
          {statusText && (
            <span className="text-[9px] text-muted-foreground">{statusText}</span>
          )}
          <div className={cn('w-2 h-2 rounded-full', statusColors[status])} />
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2 nodrag">
        {children}
      </div>
    </div>
  );
};
