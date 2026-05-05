/**
 * DVD — Dividend
 * --------------
 * Dividend per share, payout ratio, yield trend, and (when Avanza) full
 * historical dividend series.
 */

import { registerTerminalTool } from '../agentTools/registry';
import type { TerminalTool } from '../agentTools/types';
import { terminalApiGet } from '../apiClient';

export interface DvdInput {
  ticker: string;
}

export interface DvdPoint {
  year: number;
  dividendPerShare: number | null;
  yield: number | null;
  payoutRatio: number | null;
  estimate?: boolean;
}

export interface DvdData {
  ticker: string;
  source: 'avanza' | 'yfinance' | 'mock';
  history: DvdPoint[];
  trailingYield: number | null;
  trailingPayoutRatio: number | null;
  upcomingExDate?: string | null;
}

function emptyDvd(ticker: string): DvdData {
  return {
    ticker,
    source: 'mock',
    history: [],
    trailingYield: null,
    trailingPayoutRatio: null,
    upcomingExDate: null,
  };
}

async function fetchDvd(input: DvdInput): Promise<DvdData> {
  const ticker = String(input.ticker ?? '').trim().toUpperCase();
  if (!ticker) return emptyDvd('');
  const resp = await terminalApiGet<{ source: string; data: Record<string, unknown> }>(
    `/api/terminal/key-ratios/${encodeURIComponent(ticker)}`,
  );
  if (!resp) return emptyDvd(ticker);

  const out = emptyDvd(ticker);
  out.source = resp.source as DvdData['source'];

  if (resp.source === 'avanza') {
    const data = resp.data as Record<string, Record<string, unknown>>;
    const dividends = (data.dividendsByYear || {}) as Record<string, unknown>;
    const dps = Array.isArray(dividends.dividendPerShare) ? dividends.dividendPerShare : [];
    const yields = Array.isArray(dividends.directYieldRatio) ? dividends.directYieldRatio : [];
    const payouts = Array.isArray(dividends.dividendPayoutRatio) ? dividends.dividendPayoutRatio : [];
    const yearMap = new Map<number, DvdPoint>();
    const fill = (rows: unknown[], key: keyof DvdPoint) => {
      rows.forEach((r) => {
        const row = (r ?? {}) as Record<string, unknown>;
        const y = Number(row.financialYear ?? row.year);
        if (!y) return;
        const point = yearMap.get(y) || {
          year: y,
          dividendPerShare: null,
          yield: null,
          payoutRatio: null,
        };
        if (row.value != null) (point[key] as number) = Number(row.value);
        else if (row.estimate != null) {
          (point[key] as number) = Number(row.estimate);
          point.estimate = true;
        }
        yearMap.set(y, point);
      });
    };
    fill(dps, 'dividendPerShare');
    fill(yields, 'yield');
    fill(payouts, 'payoutRatio');
    out.history = Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
    const last = out.history.filter((p) => !p.estimate).pop();
    out.trailingYield = last?.yield ?? null;
    out.trailingPayoutRatio = last?.payoutRatio ?? null;
  } else {
    const ratios = ((resp.data as Record<string, Record<string, unknown>>).ratios || {}) as Record<string, number | null>;
    out.trailingYield = (ratios.dividendYield as number | null) ?? null;
    out.trailingPayoutRatio = (ratios.payoutRatio as number | null) ?? null;
  }
  return out;
}

function formatDvdForAgent(d: DvdData): string {
  const lines = [`# Dividend — ${d.ticker} (${d.source})`];
  lines.push(`Trailing yield: ${pct(d.trailingYield)}  ·  Payout: ${pct(d.trailingPayoutRatio)}`);
  if (d.history.length) {
    lines.push('', '## History');
    for (const p of d.history.slice(-8)) {
      lines.push(
        `  ${p.year}: DPS ${num(p.dividendPerShare)}  yield ${pct(p.yield)}  payout ${pct(p.payoutRatio)}${p.estimate ? ' (est)' : ''}`,
      );
    }
  }
  return lines.join('\n');
}

const num = (v: number | null) => (v == null ? '—' : v.toFixed(2));
const pct = (v: number | null) => (v == null ? '—' : (v * 100).toFixed(2) + '%');

export const dvdTool: TerminalTool<DvdInput, DvdData> = {
  code: 'DVD',
  label: 'Dividend',
  description: 'Dividend history, yield trend, payout ratio, and ex-date calendar.',
  pagePath: (input) => {
    const t = String((input as unknown as DvdInput).ticker ?? '').trim().toUpperCase();
    return t ? `/terminal/dvd/${encodeURIComponent(t)}` : '/terminal/dvd';
  },
  requiresTicker: true,
  inputSchema: {
    type: 'object',
    properties: { ticker: { type: 'string', description: 'Equity ticker' } },
    required: ['ticker'],
  },
  fetch: fetchDvd,
  formatForAgent: formatDvdForAgent,
};

registerTerminalTool(dvdTool);
