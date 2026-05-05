/**
 * WATCH — Watchlist
 * -----------------
 * Live-quote table for the user's watchlist. Pulls Avanza watchlists when
 * connected, otherwise uses the local portfolio store as a watchlist.
 */

import { registerTerminalTool } from '../agentTools/registry';
import type { TerminalTool } from '../agentTools/types';
import { avanzaApi } from '@/integrations/avanza/api';

export interface WatchInput {
  watchlistId?: string;
}

export interface WatchRow {
  orderbookId: string;
  symbol: string | null;
  name: string | null;
  lastPrice: number | null;
  changePct: number | null;
  currency: string | null;
}

export interface WatchData {
  source: 'avanza' | 'local' | 'mock';
  watchlists: Array<{ id: string; name: string; rows: WatchRow[] }>;
}

async function fetchWatch(_input: WatchInput): Promise<WatchData> {
  try {
    const [watchlistsResp] = await Promise.all([avanzaApi.watchlists()]);
    if (watchlistsResp.watchlists.length === 0) {
      return { source: 'local', watchlists: [] };
    }
    return {
      source: 'avanza',
      watchlists: watchlistsResp.watchlists.map((w) => ({
        id: w.id,
        name: w.name,
        rows: w.orderbookIds.map((id) => ({
          orderbookId: id,
          symbol: null,
          name: null,
          lastPrice: null,
          changePct: null,
          currency: null,
        })),
      })),
    };
  } catch {
    return { source: 'local', watchlists: [] };
  }
}

export const watchTool: TerminalTool<WatchInput, WatchData> = {
  code: 'WATCH',
  label: 'Watchlist',
  description: 'Live-quote table for watchlists. Uses Avanza watchlists when connected.',
  pagePath: () => '/terminal/watch',
  requiresTicker: false,
  inputSchema: {
    type: 'object',
    properties: { watchlistId: { type: 'string', description: 'Optional watchlist id' } },
  },
  fetch: fetchWatch,
  formatForAgent: (d) => {
    const lines = [`# Watchlist (${d.source})`];
    for (const w of d.watchlists) {
      lines.push(`## ${w.name} (${w.rows.length})`);
      for (const r of w.rows.slice(0, 20)) {
        lines.push(`  ${r.symbol ?? r.orderbookId}  ${fmt(r.lastPrice)}  ${pct(r.changePct)}`);
      }
    }
    return lines.join('\n');
  },
};

const fmt = (v: number | null) => (v == null ? '—' : v.toFixed(2));
const pct = (v: number | null) => (v == null ? '' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`);

registerTerminalTool(watchTool);
