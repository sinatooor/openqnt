/**
 * useFlowAgentSync — keeps the agent monitor store in sync with the
 * strategy-flow canvas.
 *
 * Whenever an agent node appears on the canvas (directly added or loaded from
 * a saved strategy), this hook registers it as an `AgentInstance` in the
 * monitor store. It also keeps existing entries' metadata fresh — if the user
 * renames a node or changes which terminal tools a Quant Agent is allowed to
 * call, those updates propagate to the /agents page automatically.
 *
 * Agents are never auto-deleted: removing a node on the canvas doesn't fire
 * the agent — the user decides when to retire it from the monitor.
 */

import { useEffect } from 'react';
import { useStrategyFlowStore } from '@/features/strategy-flow/store/strategyFlowStore';
import { AGENT_NODES } from '@/features/strategy-flow/catalog/nodes/agentNodes';
import type { AgentNodeData } from '@/features/strategy-flow/types';
import { useAgentMonitorStore } from '../store/agentMonitorStore';

// Legacy catalogue — these 5 agents existed before the canvas integration
// and are exposed by the Python backend. We seed them on first boot so the
// page never starts empty.
const LEGACY_AGENTS = [
  {
    id: 'legacy:news_analyst',
    label: 'News Analyst',
    agentType: 'news_analyst',
    icon: 'Newspaper',
    color: '#3b82f6',
  },
  {
    id: 'legacy:macro_analyst',
    label: 'Macro Analyst',
    agentType: 'macro_analyst',
    icon: 'Globe',
    color: '#f59e0b',
  },
  {
    id: 'legacy:social_monitor',
    label: 'Social Monitor',
    agentType: 'social_monitor',
    icon: 'Users',
    color: '#a855f7',
  },
  {
    id: 'legacy:technical_analyst',
    label: 'Technical Analyst',
    agentType: 'technical_analyst',
    icon: 'TrendingUp',
    color: '#22c55e',
  },
  {
    id: 'legacy:synthesis',
    label: 'Synthesis Agent',
    agentType: 'synthesis',
    icon: 'Layers',
    color: '#f43f5e',
  },
] as const;

export function useFlowAgentSync(): void {
  const nodes = useStrategyFlowStore((s) => s.nodes);
  const agents = useAgentMonitorStore((s) => s.agents);
  const registerAgent = useAgentMonitorStore((s) => s.registerAgent);

  // Seed legacy agents once.
  useEffect(() => {
    for (const a of LEGACY_AGENTS) {
      if (!agents[a.id]) {
        registerAgent({
          id: a.id,
          label: a.label,
          agentType: a.agentType,
          source: 'legacy',
          icon: a.icon,
          color: a.color,
        });
      }
    }
    // Only run on first mount — subsequent re-registrations would be no-ops
    // but we avoid the wasted work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync canvas agent nodes.
  useEffect(() => {
    for (const node of nodes) {
      if (node.type !== 'agent') continue;
      const data = node.data as unknown as AgentNodeData;
      const catalog = AGENT_NODES.find(
        (n) =>
          n.type === data.agentNodeType ||
          n.defaultData.agentType === data.agentType
      );
      const fallbackType =
        ((catalog?.defaultData as Partial<AgentNodeData> | undefined)?.agentType as string | undefined) ??
        'agent';
      registerAgent({
        id: node.id,
        label: (data.label as string) ?? catalog?.label ?? 'Agent',
        agentType: data.agentType ?? fallbackType,
        agentNodeType: data.agentNodeType,
        source: 'flow',
        icon: catalog?.icon,
        color: catalog?.color,
        meta: {
          model: data.model,
          symbols: data.symbols,
          confidenceThreshold: data.confidenceThreshold,
          terminalTools: data.terminalTools,
          researchTools: data.researchTools,
        },
      });
    }
  }, [nodes, registerAgent]);
}
