/**
 * ExecutionHistoryPanel - Browse past execution runs for the active workflow.
 *
 * Opens as a slide-over panel from the right (or can be embedded wherever).
 * Users can:
 *  - See a list of past runs with status, duration, and node counts
 *  - Click a run to load its frozen node states into executionStore for inspection
 *  - Delete individual runs or clear all history
 */

import { memo, useState, useCallback } from 'react';
import {
  X,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useExecutionHistoryStore } from '../store/executionHistoryStore';
import { useExecutionStore } from '../store/executionStore';
import { useStrategyFlowStore } from '../store/strategyFlowStore';
import type { ExecutionHistoryEntry } from '../store/executionHistoryStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Status icon
// ---------------------------------------------------------------------------

const PhaseIcon = ({ phase }: { phase: string }) => {
  switch (phase) {
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
    case 'error':
      return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    case 'running':
      return <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
    default:
      return <AlertCircle className="w-3.5 h-3.5 text-white/30" />;
  }
};

// ---------------------------------------------------------------------------
// Single entry row
// ---------------------------------------------------------------------------

interface EntryRowProps {
  entry: ExecutionHistoryEntry;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const EntryRow = memo(({ entry, isSelected, onSelect, onDelete }: EntryRowProps) => {
  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
        isSelected
          ? 'bg-blue-500/10 border-blue-500/30'
          : 'bg-white/3 border-white/8 hover:border-white/15 hover:bg-white/5',
      )}
      onClick={onSelect}
    >
      <div className="pt-0.5">
        <PhaseIcon phase={entry.phase} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-white/80 truncate">
            {formatRelativeTime(entry.startedAt)}
          </span>
          <span className="text-[10px] text-white/30 shrink-0 tabular-nums">
            {formatDuration(entry.durationMs)}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-green-400">{entry.successCount} ok</span>
          {entry.errorCount > 0 && (
            <span className="text-[10px] text-red-400">{entry.errorCount} err</span>
          )}
          {entry.skippedCount > 0 && (
            <span className="text-[10px] text-white/30">{entry.skippedCount} skipped</span>
          )}
          <span className="text-[10px] text-white/25">· {entry.executionOrderMode}</span>
        </div>
      </div>

      {/* Delete button */}
      <button
        className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete this run"
      >
        <Trash2 className="w-3 h-3" />
      </button>

      {isSelected && (
        <ChevronRight className="w-3 h-3 text-blue-400 shrink-0 self-center" />
      )}
    </div>
  );
});
EntryRow.displayName = 'EntryRow';

// ---------------------------------------------------------------------------
// Detailed view of a selected run
// ---------------------------------------------------------------------------

interface EntryDetailProps {
  entry: ExecutionHistoryEntry;
}

const EntryDetail = memo(({ entry }: EntryDetailProps) => {
  const [showNodes, setShowNodes] = useState(false);

  return (
    <div className="border-t border-white/10 p-3 space-y-3 bg-[#141414]">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Duration', value: formatDuration(entry.durationMs) },
          { label: 'Nodes run', value: String(entry.executionOrder.length) },
          { label: 'Status', value: entry.phase },
        ].map(({ label, value }) => (
          <div key={label} className="px-2 py-1.5 bg-white/5 rounded-md">
            <p className="text-[9px] text-white/30 uppercase tracking-wider">{label}</p>
            <p className="text-xs font-mono text-white/70 mt-0.5 capitalize">{value}</p>
          </div>
        ))}
      </div>

      {/* Execution order toggle */}
      <button
        className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80 transition-colors"
        onClick={() => setShowNodes((v) => !v)}
      >
        {showNodes ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Node execution order ({entry.executionOrder.length})
      </button>

      {showNodes && (
        <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
          {entry.executionOrder.map((nodeId, idx) => {
            const ns = entry.nodeStates[nodeId];
            return (
              <div key={nodeId} className="flex items-center gap-2 text-[10px]">
                <span className="text-white/20 tabular-nums w-4 text-right">{idx + 1}</span>
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    ns?.status === 'success' ? 'bg-green-400' :
                    ns?.status === 'error' ? 'bg-red-400' :
                    ns?.status === 'skipped' ? 'bg-white/20' :
                    'bg-amber-400',
                  )}
                />
                <span className="font-mono text-white/50 truncate">{nodeId}</span>
                {ns?.durationMs != null && (
                  <span className="ml-auto text-white/25 shrink-0">{formatDuration(ns.durationMs)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
EntryDetail.displayName = 'EntryDetail';

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface ExecutionHistoryPanelProps {
  onClose: () => void;
}

export const ExecutionHistoryPanel = memo(({ onClose }: ExecutionHistoryPanelProps) => {
  const workflowId = useStrategyFlowStore((s) => s.workflowId);
  const workflowName = useStrategyFlowStore((s) => s.strategyName);

  const { deleteEntry, clearHistory } = useExecutionHistoryStore();
  const entries = useExecutionHistoryStore((s) =>
    workflowId ? s.entries.filter((e) => e.workflowId === workflowId) : s.entries,
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadRun = useCallback(
    (entry: ExecutionHistoryEntry) => {
      if (selectedId === entry.id) {
        setSelectedId(null);
        return;
      }
      setSelectedId(entry.id);

      // Load frozen node states back into executionStore so the user can
      // inspect per-node input/output on the canvas
      const exec = useExecutionStore.getState();
      exec.resetExecution();

      // Replay node states
      for (const [nodeId, ns] of Object.entries(entry.nodeStates)) {
        if (ns.status === 'success') {
          exec.setNodeRunning(nodeId);
          exec.setNodeSuccess(
            nodeId,
            ns.outputData ?? {},
            ns.inputData ?? {},
            ns.itemsProcessed,
            ns.takenBranch,
          );
          if (ns.isPinned) exec.pinNode(nodeId);
        } else if (ns.status === 'error') {
          exec.setNodeRunning(nodeId);
          exec.setNodeError(nodeId, ns.error ?? 'Unknown error');
        } else if (ns.status === 'skipped') {
          exec.setNodeSkipped(nodeId);
        }
      }

      exec.completeExecution();
    },
    [selectedId],
  );

  const selectedEntry = entries.find((e) => e.id === selectedId);

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] border-l border-white/10 w-72">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white/90">Execution History</span>
        </div>
        <div className="flex items-center gap-1">
          {entries.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
              onClick={() => {
                if (window.confirm('Clear all execution history for this workflow?')) {
                  clearHistory(workflowId ?? undefined);
                  setSelectedId(null);
                }
              }}
            >
              Clear
            </Button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Workflow info */}
      <div className="px-4 py-2 text-[10px] text-white/30 border-b border-white/5">
        {workflowId ? (
          <>History for: <span className="text-white/50">{workflowName}</span></>
        ) : (
          'Save this workflow to track its history'
        )}
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {entries.length === 0 ? (
            <div className="py-10 text-center text-white/30 text-xs">
              <Clock className="w-8 h-8 mx-auto mb-3 opacity-30" />
              No executions recorded yet.
              <br />
              Run this workflow to see history here.
            </div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id}>
                <EntryRow
                  entry={entry}
                  isSelected={selectedId === entry.id}
                  onSelect={() => loadRun(entry)}
                  onDelete={() => {
                    deleteEntry(entry.id);
                    if (selectedId === entry.id) setSelectedId(null);
                  }}
                />
                {selectedId === entry.id && <EntryDetail entry={entry} />}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer hint */}
      {entries.length > 0 && (
        <div className="px-4 py-2 border-t border-white/8 text-[9px] text-white/25">
          Click a run to inspect per-node input/output data on the canvas.
        </div>
      )}
    </div>
  );
});

ExecutionHistoryPanel.displayName = 'ExecutionHistoryPanel';
