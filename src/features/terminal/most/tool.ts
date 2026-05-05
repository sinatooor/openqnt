/**
 * MOST — Most Active / Movers
 * ---------------------------
 * Top gainers, losers, and most-traded by region.
 */

import { registerTerminalTool } from '../agentTools/registry';
import type { TerminalTool } from '../agentTools/types';
import { terminalApiGet } from '../apiClient';

export interface MostInput { region?: 'us' | 'nordic' | 'europe' }

export interface MostRow {
  ticker: string;
  name?: string | null;
  lastPrice: number | null;
  changePct: number | null;
  currency?: string | null;
}

export interface MostData {
  source: 'avanza' | 'yfinance' | 'mock';
  region: string;
  gainers: MostRow[];
  losers: MostRow[];
  active: MostRow[];
}

async function fetchMost(input: MostInput): Promise<MostData> {
  const region = input.region ?? 'us';
  const resp = await terminalApiGet<{
    source: string;
    region: string;
    data: { gainers: MostRow[]; losers: MostRow[]; active: MostRow[] };
  }>(`/api/terminal/movers`, { region });
  if (!resp) return { source: 'mock', region, gainers: [], losers: [], active: [] };
  return {
    source: resp.source as MostData['source'],
    region: resp.region,
    gainers: resp.data.gainers ?? [],
    losers: resp.data.losers ?? [],
    active: resp.data.active ?? [],
  };
}

export const mostTool: TerminalTool<MostInput, MostData> = {
  code: 'MOST',
  label: 'Movers',
  description: 'Top gainers, losers, and most-active by region.',
  pagePath: () => '/terminal/most',
  requiresTicker: false,
  inputSchema: {
    type: 'object',
    properties: {
      region: { type: 'string', enum: ['us', 'nordic', 'europe'], default: 'us' },
    },
  },
  fetch: fetchMost,
  formatForAgent: (d) => {
    const fmt = (rows: MostRow[]) =>
      rows
        .slice(0, 10)
        .map((r) => `  ${r.ticker}  ${r.lastPrice ?? '—'}  ${r.changePct?.toFixed(2) ?? '—'}%`)
        .join('\n');
    return `# Movers (${d.region}, ${d.source})\n## Gainers\n${fmt(d.gainers)}\n## Losers\n${fmt(d.losers)}\n## Active\n${fmt(d.active)}`;
  },
};

registerTerminalTool(mostTool);
