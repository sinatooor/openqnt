/**
 * AgentList — left-hand column. Shows every agent the user has "hired":
 *  - legacy backend agents (news, macro, social, technical, synthesis)
 *  - every agent node currently on their strategy canvas
 * Plus live status dots and a one-click Run button.
 */

import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Link } from 'react-router-dom';
import { Loader2, Play, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useAgentMonitorStore,
  selectAgents,
  selectActiveRunFor,
} from '../store/agentMonitorStore';
import { simulateAgentRun, isAgentRunning } from '../runtime/simulatedRun';
import { resolveIcon } from './iconResolver';

interface AgentListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Enables the run button per row */
  onRun?: (agentId: string) => void;
}

export const AgentList = memo(({ selectedId, onSelect, onRun }: AgentListProps) => {
  const agents = useAgentMonitorStore(useShallow(selectAgents));

  // Group by source so canvas agents sit above legacy ones.
  const grouped = useMemo(() => {
    const flow = agents.filter((a) => a.source === 'flow');
    const legacy = agents.filter((a) => a.source === 'legacy');
    const manual = agents.filter((a) => a.source === 'manual');
    return { flow, legacy, manual };
  }, [agents]);

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-3">
        {grouped.flow.length > 0 && (
          <Section
            title="From your strategies"
            subtitle="Auto-synced from the canvas"
            agents={grouped.flow}
            selectedId={selectedId}
            onSelect={onSelect}
            onRun={onRun}
          />
        )}
        {grouped.legacy.length > 0 && (
          <Section
            title="Built-in analysts"
            subtitle="Backed by the Python ADK pipeline"
            agents={grouped.legacy}
            selectedId={selectedId}
            onSelect={onSelect}
            onRun={onRun}
          />
        )}
        {grouped.manual.length > 0 && (
          <Section
            title="Custom"
            subtitle="Manually registered"
            agents={grouped.manual}
            selectedId={selectedId}
            onSelect={onSelect}
            onRun={onRun}
          />
        )}

        {agents.length === 0 && (
          <div className="text-[11px] text-white/40 p-6 text-center">
            <Sparkles className="w-5 h-5 mx-auto mb-2 text-white/20" />
            No agents yet. Drop an agent node into a strategy — it'll appear here.
            <Link
              to="/builder"
              className="block mt-2 text-primary hover:underline text-[11px]"
            >
              Open the strategy canvas →
            </Link>
          </div>
        )}
      </div>
    </ScrollArea>
  );
});

AgentList.displayName = 'AgentList';

// ──────────────────────────────────────────────────── Sub-components ──

interface SectionProps {
  title: string;
  subtitle: string;
  agents: ReturnType<typeof selectAgents>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRun?: (agentId: string) => void;
}

const Section = ({ title, subtitle, agents, selectedId, onSelect, onRun }: SectionProps) => (
  <div>
    <div className="px-2 pb-1.5">
      <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
        {title}
      </p>
      <p className="text-[9px] text-white/25">{subtitle}</p>
    </div>
    <div className="space-y-1">
      {agents.map((a) => (
        <AgentRow
          key={a.id}
          id={a.id}
          selected={selectedId === a.id}
          onSelect={onSelect}
          onRun={onRun}
        />
      ))}
    </div>
  </div>
);

interface AgentRowProps {
  id: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onRun?: (agentId: string) => void;
}

const AgentRow = memo(({ id, selected, onSelect, onRun }: AgentRowProps) => {
  const agent = useAgentMonitorStore((s) => s.agents[id]);
  const activeRun = useAgentMonitorStore(selectActiveRunFor(id));
  if (!agent) return null;
  const Icon = resolveIcon(agent.icon);
  const running = activeRun?.status === 'running' || isAgentRunning(id);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(id);
        }
      }}
      className={cn(
        'group w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors border cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20',
        selected
          ? 'bg-white/[0.06] border-white/10'
          : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/5'
      )}
    >
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
        style={{
          backgroundColor: `${agent.color ?? '#7c3aed'}22`,
          color: agent.color ?? '#c4b5fd',
        }}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/90 truncate">{agent.label}</span>
          {running && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          )}
        </div>
        <p className="text-[10px] text-white/30 truncate font-mono">
          {agent.agentType}
          {agent.meta?.symbols && (agent.meta.symbols as string[]).length > 0 && (
            <span className="ml-1 text-white/40">
              · {(agent.meta.symbols as string[]).join(', ')}
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onRun) onRun(id);
          else simulateAgentRun({ agentId: id });
        }}
        disabled={running}
        className={cn(
          'opacity-0 group-hover:opacity-100 transition-opacity shrink-0',
          'p-1 rounded-md border border-white/10 text-white/60 hover:text-white hover:border-white/25 disabled:opacity-40'
        )}
        aria-label={`Run ${agent.label}`}
      >
        {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
      </button>
    </div>
  );
});

AgentRow.displayName = 'AgentRow';
