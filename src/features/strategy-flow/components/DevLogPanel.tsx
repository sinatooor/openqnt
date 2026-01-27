/**
 * DevLogPanel - Developer/execution log panel
 * Equivalent to Blockly's execution logs
 */

import { memo, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Trash2,
  Download,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  source: string;
  message: string;
  details?: string;
}

interface DevLogPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs?: LogEntry[];
}

const LEVEL_ICONS = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
};

const LEVEL_COLORS = {
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
  success: 'text-green-400',
};

const LEVEL_BG = {
  info: 'bg-blue-500/10',
  warning: 'bg-yellow-500/10',
  error: 'bg-red-500/10',
  success: 'bg-green-500/10',
};

// Demo logs for development
const DEMO_LOGS: LogEntry[] = [
  {
    id: '1',
    timestamp: new Date(),
    level: 'info',
    source: 'System',
    message: 'Strategy flow initialized',
  },
  {
    id: '2',
    timestamp: new Date(),
    level: 'success',
    source: 'Store',
    message: 'State loaded from localStorage',
  },
];

export const DevLogPanel = memo(({ 
  open, 
  onOpenChange, 
  logs: externalLogs 
}: DevLogPanelProps) => {
  const [logs, setLogs] = useState<LogEntry[]>(externalLogs || DEMO_LOGS);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Update from external logs
  useEffect(() => {
    if (externalLogs) {
      setLogs(externalLogs);
    }
  }, [externalLogs]);

  const filteredLogs = filter 
    ? logs.filter(l => l.level === filter)
    : logs;

  const handleClear = () => {
    setLogs([]);
  };

  const handleExport = () => {
    const content = logs.map(l => 
      `[${l.timestamp.toISOString()}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}${l.details ? '\n' + l.details : ''}`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strategy-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-64 bg-[#1a1a1a] border-t border-white/10 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#1e1e1e]">
        <div className="flex items-center gap-3">
          <span className="font-medium text-white">Dev Log</span>
          <div className="flex gap-1">
            {(['info', 'warning', 'error', 'success'] as const).map(level => {
              const count = logs.filter(l => l.level === level).length;
              if (count === 0) return null;
              const Icon = LEVEL_ICONS[level];
              return (
                <button
                  key={level}
                  onClick={() => setFilter(filter === level ? null : level)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    filter === level ? LEVEL_BG[level] : 'hover:bg-white/5'
                  } ${LEVEL_COLORS[level]}`}
                >
                  <Icon className="w-3 h-3" />
                  {count}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="h-7 text-xs text-white/70"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-7 text-xs text-white/70"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Clear
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/70"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Log entries */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-2 space-y-1 font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-white/40">
              No logs to display
            </div>
          ) : (
            filteredLogs.map(log => {
              const Icon = LEVEL_ICONS[log.level];
              const isExpanded = expandedLog === log.id;
              
              return (
                <div
                  key={log.id}
                  className={`rounded px-2 py-1.5 ${LEVEL_BG[log.level]} ${log.details ? 'cursor-pointer' : ''}`}
                  onClick={() => log.details && setExpandedLog(isExpanded ? null : log.id)}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${LEVEL_COLORS[log.level]}`} />
                    <span className="text-white/40 shrink-0">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1 h-4 border-white/20 shrink-0">
                      {log.source}
                    </Badge>
                    <span className="text-white/90 flex-1">{log.message}</span>
                    {log.details && (
                      isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                    )}
                  </div>
                  {isExpanded && log.details && (
                    <pre className="mt-2 ml-6 p-2 bg-black/30 rounded text-white/70 overflow-x-auto">
                      {log.details}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
});

DevLogPanel.displayName = 'DevLogPanel';

// Helper to add logs programmatically (can be used as a global logger)
export const logStore = {
  logs: [] as LogEntry[],
  listeners: new Set<(logs: LogEntry[]) => void>(),

  addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
    const log: LogEntry = {
      ...entry,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    this.logs = [...this.logs, log];
    this.listeners.forEach(l => l(this.logs));
    return log;
  },

  info(source: string, message: string, details?: string) {
    return this.addLog({ level: 'info', source, message, details });
  },

  warning(source: string, message: string, details?: string) {
    return this.addLog({ level: 'warning', source, message, details });
  },

  error(source: string, message: string, details?: string) {
    return this.addLog({ level: 'error', source, message, details });
  },

  success(source: string, message: string, details?: string) {
    return this.addLog({ level: 'success', source, message, details });
  },

  clear() {
    this.logs = [];
    this.listeners.forEach(l => l(this.logs));
  },

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },
};
