/**
 * Graph-integrity tests for strategy templates.
 *
 * Every agentic template must be loadable without repair surprises:
 * unique node ids, edges that reference real nodes, and handles that
 * survive `repairEdges` unchanged (i.e. they were correct as authored).
 */

import { describe, expect, it } from 'vitest';
import { AGENTIC_STRATEGY_TEMPLATES } from '../agenticTemplates';
import { repairEdges, validateEdgeHandles } from '../../utils/handleUtils';

describe.each(AGENTIC_STRATEGY_TEMPLATES.map((t) => [t.id, t] as const))(
  'agentic template %s',
  (_id, template) => {
    it('has unique node ids', () => {
      const ids = template.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('has unique edge ids', () => {
      const ids = template.edges.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('has edges that reference existing nodes', () => {
      const ids = new Set(template.nodes.map((n) => n.id));
      for (const e of template.edges) {
        expect(ids.has(e.source), `edge ${e.id} source "${e.source}" missing`).toBe(true);
        expect(ids.has(e.target), `edge ${e.id} target "${e.target}" missing`).toBe(true);
      }
    });

    it('produces no multi-handle ambiguity warnings', () => {
      expect(validateEdgeHandles(template.nodes, template.edges)).toEqual([]);
    });

    it('agent nodes are shaped to sync into the Agents tab monitor', () => {
      // useFlowAgentSync registers nodes with type 'agent' via their
      // agentNodeType/agentType — both must be present.
      const agents = template.nodes.filter((n) => n.type === 'agent');
      expect(agents.length).toBeGreaterThan(0);
      for (const a of agents) {
        const data = a.data as { agentNodeType?: string; agentType?: string };
        expect(data.agentNodeType, `${a.id} missing agentNodeType`).toBeTruthy();
        expect(data.agentType, `${a.id} missing agentType`).toBeTruthy();
      }
    });
  }
);

describe('buy-rumor-sell-news-sentinel (strict)', () => {
  const template = AGENTIC_STRATEGY_TEMPLATES.find(
    (t) => t.id === 'buy-rumor-sell-news-sentinel'
  )!;

  it('exists and is featured under the agentic category', () => {
    expect(template).toBeDefined();
    expect(template.category).toBe('agentic');
    expect(template.featured).toBe(true);
  });

  it('handles survive repairEdges unchanged (correct as authored)', () => {
    const repaired = repairEdges(template.nodes, template.edges);
    for (let i = 0; i < template.edges.length; i++) {
      expect(
        { source: repaired[i].sourceHandle, target: repaired[i].targetHandle },
        `edge ${template.edges[i].id} was repaired — authored handles are wrong`
      ).toEqual({
        source: template.edges[i].sourceHandle,
        target: template.edges[i].targetHandle,
      });
    }
  });

  it('is advisory-only — presents data, never trades', () => {
    const actionTypes = template.nodes
      .filter((n) => n.type === 'action')
      .map((n) => (n.data as { actionType?: string }).actionType);
    expect(actionTypes).not.toContain('order');
    expect(actionTypes).not.toContain('closePosition');
    expect(actionTypes).not.toContain('closeAll');
    expect(actionTypes).not.toContain('stopLoss');
    expect(actionTypes).not.toContain('takeProfit');
    // Three Telegram outcomes + audit log.
    expect(actionTypes.filter((t) => t === 'notification')).toHaveLength(3);
  });

  it('covers rumor, news, social, technical, and fundamental desks', () => {
    const agentTypes = template.nodes
      .filter((n) => n.type === 'agent')
      .map((n) => (n.data as { agentType: string }).agentType)
      .sort();
    expect(agentTypes).toEqual([
      'fundamentals_analyst',
      'news_analyst',
      'news_analyst',
      'social_monitor',
      'synthesis',
      'technical_analyst',
    ]);
  });

  it('wires the Truth Social feed into the Rumor Desk', () => {
    const feedEdge = template.edges.find((e) => e.source === 'truth-feed');
    expect(feedEdge?.target).toBe('rumor-desk');
  });

  it('every desk reports into the PM synthesis', () => {
    const intoSynth = template.edges
      .filter((e) => e.target === 'pm-synth' && e.targetHandle === 'agentData')
      .map((e) => e.source)
      .sort();
    expect(intoSynth).toEqual(
      ['chartist', 'news-desk5', 'rumor-desk', 'social-pulse', 'valuation'].sort()
    );
  });

  it('every node participates in the graph (no orphans)', () => {
    const connected = new Set<string>();
    for (const e of template.edges) {
      connected.add(e.source);
      connected.add(e.target);
    }
    for (const n of template.nodes) {
      expect(connected.has(n.id), `node ${n.id} is orphaned`).toBe(true);
    }
  });
});
