import { useState, useEffect } from "react";
import { Card, ScrollArea, Button } from "@/components/ui";
import { Download, Trash2, X } from "lucide-react";

export interface LogEntry {
  type: 'request' | 'response' | 'error';
  mode: 'generate' | 'chat';
  message?: string;
  workspaceBlocks?: number;
  workspaceSize?: string;
  hasAttachedBlock?: boolean;
  timestamp: number;
  duration?: number;
  error?: string;
  success?: boolean;
}

interface DevLogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
  onClose: () => void;
}

export const DevLogPanel = ({ logs, onClear, onClose }: DevLogPanelProps) => {
  const exportLogs = () => {
    const data = JSON.stringify(logs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dev-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${timeStr}.${ms}`;
  };

  const getLogColor = (log: LogEntry) => {
    if (log.type === 'error') return 'border-destructive bg-destructive/10';
    if (log.mode === 'generate') return 'border-blue-500 bg-blue-500/10';
    return 'border-green-500 bg-green-500/10';
  };

  return (
    <Card className="fixed bottom-4 right-4 w-[500px] h-[400px] z-50 flex flex-col shadow-2xl border-2">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm">Dev Logs (Ctrl+Shift+D)</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={exportLogs} className="h-7 w-7">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClear} className="h-7 w-7">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {logs.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              No logs yet. Send a message to see activity.
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={`p-2 rounded border ${getLogColor(log)}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatTime(log.timestamp)}
                  </span>
                  <span className="text-xs font-semibold uppercase">
                    {log.mode} - {log.type}
                  </span>
                </div>
                
                {log.type === 'request' && (
                  <div className="text-xs space-y-1">
                    <div><strong>Message:</strong> {log.message?.substring(0, 100)}{log.message && log.message.length > 100 ? '...' : ''}</div>
                    <div><strong>Workspace:</strong> {log.workspaceBlocks || 0} blocks ({log.workspaceSize || '0'}KB)</div>
                    <div><strong>Attached Block:</strong> {log.hasAttachedBlock ? 'Yes' : 'No'}</div>
                  </div>
                )}
                
                {log.type === 'response' && (
                  <div className="text-xs space-y-1">
                    <div><strong>Status:</strong> {log.success ? '✓ Success' : '✗ Failed'}</div>
                    {log.duration && <div><strong>Duration:</strong> {log.duration}ms</div>}
                  </div>
                )}
                
                {log.type === 'error' && (
                  <div className="text-xs text-destructive">
                    <strong>Error:</strong> {log.error}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};
