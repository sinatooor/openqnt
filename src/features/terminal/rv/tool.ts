/**
 * RV — Relative Value
 * -------------------
 * Peer comparison matrix. Uses the existing /api/terminal/splc and key-ratios
 * endpoints to gather the security plus a handful of peers, then renders a
 * grid with z-score heat-shading per ratio.
 */

import { registerTerminalTool } from '../agentTools/registry';
import type { TerminalTool } from '../agentTools/types';
import { terminalApiGet } from '../apiClient';

export interface RvInput { ticker: string }

export interface RvRow {
  ticker: string;
  name?: string | null;
  pe: number | null;
  pb: number | null;
  ps: number | null;
  evEbitda: number | null;
  roe: number | null;
  divYield: number | null;
}

export interface RvData {
  base: string;
  rows: RvRow[];
}

async function fetchRv(input: RvInput): Promise<RvData> {
  const ticker = String(input.ticker ?? '').trim().toUpperCase();
  if (!ticker) return { base: '', rows: [] };

  const splc = await terminalApiGet<{ data: { peers?: Array<{ ticker: string; name?: string }> } }>(
    `/api/terminal/splc/${encodeURIComponent(ticker)}`,
  );
  const peerTickers = (splc?.data?.peers ?? []).map((p) => p.ticker).slice(0, 8);
  const all = Array.from(new Set([ticker, ...peerTickers])).slice(0, 9);

  const settled = await Promise.all(
    all.map(async (t): Promise<RvRow> => {
      const resp = await terminalApiGet<{ source: string; data: Record<string, unknown> }>(
        `/api/terminal/key-ratios/${encodeURIComponent(t)}`,
      );
      if (!resp) return emptyRow(t);
      const row = emptyRow(t);
      if (resp.source === 'avanza') {
        const summary = ((resp.data as Record<string, Record<string, { latest?: number }>>).keyRatiosByYear) || {};
        row.pe = summary.priceEarningsRatio?.latest ?? null;
        row.pb = summary.priceBookRatio?.latest ?? null;
        row.ps = summary.priceSalesRatio?.latest ?? null;
        row.evEbitda = summary.evEbitRatio?.latest ?? null;
      } else {
        const ratios = ((resp.data as Record<string, Record<string, number | null>>).ratios) || {};
        row.pe = ratios.trailingPE ?? null;
        row.pb = ratios.priceToBook ?? null;
        row.ps = ratios.priceToSales ?? null;
        row.evEbitda = ratios.evToEbitda ?? null;
        row.roe = ratios.returnOnEquity ?? null;
        row.divYield = ratios.dividendYield ?? null;
      }
      return row;
    }),
  );

  return { base: ticker, rows: settled };
}

function emptyRow(ticker: string): RvRow {
  return {
    ticker,
    name: null,
    pe: null,
    pb: null,
    ps: null,
    evEbitda: null,
    roe: null,
    divYield: null,
  };
}

export const rvTool: TerminalTool<RvInput, RvData> = {
  code: 'RV',
  label: 'Relative Value',
  description: 'Peer comparison matrix across P/E, P/B, P/S, EV/EBITDA, ROE, dividend yield.',
  pagePath: (input) => {
    const t = String((input as unknown as RvInput).ticker ?? '').trim().toUpperCase();
    return t ? `/terminal/rv/${encodeURIComponent(t)}` : '/terminal/rv';
  },
  requiresTicker: true,
  inputSchema: {
    type: 'object',
    properties: { ticker: { type: 'string' } },
    required: ['ticker'],
  },
  fetch: fetchRv,
  formatForAgent: (d) => {
    const rows = d.rows
      .map((r) => `${r.ticker.padEnd(8)} P/E ${fmt(r.pe)}  P/B ${fmt(r.pb)}  EV/EBITDA ${fmt(r.evEbitda)}`)
      .join('\n');
    return `# Relative Value vs ${d.base}\n${rows}`;
  },
};

const fmt = (v: number | null) => (v == null ? '—' : v.toFixed(2));

registerTerminalTool(rvTool);
