/**
 * EQS — Equity Screener
 * ---------------------
 * Free-form filter screen. Posts query params to /api/terminal/screener.
 */

import { registerTerminalTool } from '../agentTools/registry';
import type { TerminalTool } from '../agentTools/types';
import { terminalApiGet } from '../apiClient';

export interface EqsInput {
  minMarketCapB?: number;
  maxPe?: number;
  minDividendYield?: number;
  sector?: string;
  country?: string;
}

export interface EqsRow {
  ticker: string;
  name: string | null;
  marketCapB: number | null;
  pe: number | null;
  dividendYield: number | null;
  sector: string | null;
  country: string | null;
  lastPrice: number | null;
}

export interface EqsData {
  source: 'avanza' | 'yfinance' | 'mock';
  rows: EqsRow[];
}

async function fetchEqs(input: EqsInput): Promise<EqsData> {
  const params: Record<string, string | number> = { limit: 100 };
  if (input.minMarketCapB != null) params.min_market_cap_b = input.minMarketCapB;
  if (input.maxPe != null) params.max_pe = input.maxPe;
  if (input.minDividendYield != null) params.min_dividend_yield = input.minDividendYield;
  if (input.sector) params.sector = input.sector;
  if (input.country) params.country = input.country;
  const resp = await terminalApiGet<{ source: string; data: { rows: EqsRow[] } }>(
    `/api/terminal/screener`,
    params,
  );
  return {
    source: (resp?.source as EqsData['source']) || 'mock',
    rows: resp?.data?.rows ?? [],
  };
}

export const eqsTool: TerminalTool<EqsInput, EqsData> = {
  code: 'EQS',
  label: 'Equity Screener',
  description: 'Multi-factor equity screener (mcap, P/E, dividend, sector, country).',
  pagePath: () => '/terminal/eqs',
  requiresTicker: false,
  inputSchema: {
    type: 'object',
    properties: {
      minMarketCapB: { type: 'number' },
      maxPe: { type: 'number' },
      minDividendYield: { type: 'number' },
      sector: { type: 'string' },
      country: { type: 'string' },
    },
  },
  fetch: fetchEqs,
  formatForAgent: (d) =>
    `# Screener (${d.source}) — ${d.rows.length} hits\n` +
    d.rows
      .slice(0, 20)
      .map((r) => `  ${r.ticker.padEnd(8)} mcap ${r.marketCapB?.toFixed(1) ?? '—'}B  P/E ${r.pe ?? '—'}`)
      .join('\n'),
};

registerTerminalTool(eqsTool);
