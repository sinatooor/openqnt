/**
 * RMAP tool registration — surfaces the Relationship Map to quant agents
 * via the shared terminal-tool registry. Calls /api/terminal/rmap which
 * aggregates yfinance facts; falls back to deterministic mock data when
 * the backend is unreachable so the UI never goes blank.
 */

import { registerTerminalTool } from '../agentTools/registry';
import type { TerminalTool } from '../agentTools/types';
import { terminalApiGet } from '../apiClient';
import { generateRmapData, type RmapData } from './mockData';
import { formatRmapForAgent, summariseRmap } from './formatForAgent';

export interface RmapInput {
  ticker?: string;
}

async function fetchRmap(input: RmapInput): Promise<RmapData> {
  const ticker = String(input.ticker ?? '').trim().toUpperCase();
  if (!ticker) return generateRmapData(ticker);
  try {
    const resp = await terminalApiGet<{ source: string; data: RmapData }>(
      `/api/terminal/rmap/${encodeURIComponent(ticker)}`,
    );
    if (resp?.data?.center?.name) {
      // Merge: backend wins, mock fills gaps so empty sections don't ghost
      // the layout (yfinance is patchy on small caps).
      const mock = generateRmapData(ticker);
      const d = resp.data;
      const merge = <T extends { items: unknown[] }>(
        live: T | undefined,
        fb: T,
      ): T => (live && live.items.length ? live : fb);
      return {
        center: { ...mock.center, ...d.center },
        indices: merge(d.indices, mock.indices),
        peers: merge(d.peers, mock.peers),
        holders: merge(d.holders, mock.holders),
        analysts: merge(d.analysts, mock.analysts),
        board: merge(d.board, mock.board),
        executives: merge(d.executives, mock.executives),
        news: merge(d.news, mock.news),
        events: merge(d.events, mock.events),
        options: merge(d.options, mock.options),
        exchanges: merge(d.exchanges, mock.exchanges),
        cds: merge(d.cds, mock.cds),
        balanceSheet:
          d.balanceSheet?.items?.length ? d.balanceSheet : mock.balanceSheet,
      };
    }
  } catch {
    /* fall through to mock */
  }
  return generateRmapData(ticker);
}

export const rmapTool: TerminalTool<RmapInput, RmapData> = {
  code: 'RMAP',
  label: 'Relationship Map',
  description:
    'Single-screen relationship overview for an equity: peers, top holders, recent analyst actions, board & executives, news, calendar events, front-month options chain, and balance-sheet bars.',
  pagePath: (input) => {
    const t = String(input.ticker ?? '').trim().toUpperCase();
    return t ? `/terminal/rmap/${encodeURIComponent(t)}` : '/terminal/rmap';
  },
  requiresTicker: true,
  inputSchema: {
    type: 'object',
    properties: {
      ticker: {
        type: 'string',
        description: 'Equity ticker (e.g. AAPL, NVDA, JPM).',
        examples: ['AAPL', 'NVDA', 'JPM', 'TSLA'],
      },
    },
    required: ['ticker'],
  },
  fetch: (input) => fetchRmap(input),
  formatForAgent: (data) => formatRmapForAgent(data),
  summarise: (data) => summariseRmap(data),
};

registerTerminalTool(rmapTool);
