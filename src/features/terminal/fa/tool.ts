/**
 * FA — Financial Analysis
 * -----------------------
 * Multi-year fundamentals from Avanza key-ratios when available, falling
 * back to a yfinance-derived snapshot. The "Avanza or nothing" trader
 * gets full historical series; everyone else still gets the ratios from
 * the ticker's last filing.
 */

import { registerTerminalTool } from '../agentTools/registry';
import type { TerminalTool } from '../agentTools/types';
import { terminalApiGet } from '../apiClient';

export interface FaInput {
  ticker: string;
  seedSalt?: number;
}

export interface FaSeriesPoint {
  year: number;
  value: number | null;
  estimate?: number | null;
  onlyEstimate?: boolean;
}

export interface FaData {
  ticker: string;
  source: 'avanza' | 'yfinance' | 'mock';
  asOf: string;
  ratios: {
    trailingPE?: number | null;
    forwardPE?: number | null;
    priceToBook?: number | null;
    priceToSales?: number | null;
    evToEbitda?: number | null;
    returnOnEquity?: number | null;
    debtToEquity?: number | null;
    dividendYield?: number | null;
    payoutRatio?: number | null;
    profitMargins?: number | null;
  };
  series: {
    revenue?: FaSeriesPoint[];
    ebitda?: FaSeriesPoint[];
    netProfit?: FaSeriesPoint[];
    eps?: FaSeriesPoint[];
    peRatio?: FaSeriesPoint[];
    pbRatio?: FaSeriesPoint[];
    dividendPerShare?: FaSeriesPoint[];
  };
}

function emptyFa(ticker: string): FaData {
  return {
    ticker,
    source: 'mock',
    asOf: new Date().toISOString(),
    ratios: {},
    series: {},
  };
}

function avanzaSeries(rows: unknown): FaSeriesPoint[] | undefined {
  if (!Array.isArray(rows)) return undefined;
  return rows.map((r) => {
    const row = (r ?? {}) as Record<string, unknown>;
    return {
      year: Number(row.financialYear ?? row.year ?? 0),
      value: typeof row.value === 'number' ? row.value : null,
      estimate: typeof row.estimate === 'number' ? row.estimate : null,
      onlyEstimate: Boolean(row.onlyEstimate),
    };
  });
}

async function fetchFa(input: FaInput): Promise<FaData> {
  const ticker = String(input.ticker ?? '').trim().toUpperCase();
  if (!ticker) return emptyFa('');
  const resp = await terminalApiGet<{ source: string; data: Record<string, unknown> }>(
    `/api/terminal/key-ratios/${encodeURIComponent(ticker)}`,
  );
  if (!resp) return { ...emptyFa(ticker) };

  const out: FaData = { ...emptyFa(ticker) };
  out.source = (resp.source as FaData['source']) || 'mock';
  out.asOf = new Date().toISOString();

  if (resp.source === 'avanza') {
    const data = resp.data as Record<string, Record<string, unknown>>;
    const byYear = (data.companyFinancialsByYear || {}) as Record<string, unknown>;
    const ratios = (data.stockKeyRatiosByYear || {}) as Record<string, unknown>;
    const dividends = (data.dividendsByYear || {}) as Record<string, unknown>;
    const company = (data.companyKeyRatiosByYear || {}) as Record<string, unknown>;
    out.series = {
      revenue: avanzaSeries(byYear.sales),
      ebitda: avanzaSeries(byYear.ebitda),
      netProfit: avanzaSeries(byYear.netProfit),
      eps: avanzaSeries(company.earningsPerShare),
      peRatio: avanzaSeries(ratios.priceEarningsRatio),
      pbRatio: avanzaSeries(ratios.priceBookRatio),
      dividendPerShare: avanzaSeries(dividends.dividendPerShare),
    };
    const summary = (data.keyRatiosByYear || {}) as Record<string, { latest?: number }>;
    out.ratios = {
      trailingPE: summary.priceEarningsRatio?.latest ?? null,
      priceToBook: summary.priceBookRatio?.latest ?? null,
      priceToSales: summary.priceSalesRatio?.latest ?? null,
      evToEbitda: summary.evEbitRatio?.latest ?? null,
    };
  } else {
    const ratios = ((resp.data as Record<string, Record<string, unknown>>).ratios || {}) as Record<string, number | null>;
    out.ratios = ratios;
  }
  return out;
}

function formatFaForAgent(d: FaData): string {
  const lines = [`# Financial Analysis — ${d.ticker} (${d.source})`];
  const r = d.ratios;
  lines.push(
    `Trailing P/E: ${fmt(r.trailingPE)}  ·  P/B: ${fmt(r.priceToBook)}  ·  P/S: ${fmt(r.priceToSales)}  ·  EV/EBITDA: ${fmt(r.evToEbitda)}`,
  );
  lines.push(
    `ROE: ${fmt(r.returnOnEquity)}  ·  Debt/Equity: ${fmt(r.debtToEquity)}  ·  Dividend yield: ${fmt(r.dividendYield)}  ·  Payout: ${fmt(r.payoutRatio)}`,
  );
  if (d.series.revenue?.length) {
    lines.push('', '## Revenue (B)');
    for (const p of d.series.revenue.slice(-5)) {
      lines.push(`  ${p.year}: ${fmt(p.value)}${p.onlyEstimate ? ' (est)' : ''}`);
    }
  }
  return lines.join('\n');
}

function fmt(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  if (Math.abs(v) < 1) return v.toFixed(3);
  if (Math.abs(v) < 10) return v.toFixed(2);
  return v.toFixed(1);
}

export const faTool: TerminalTool<FaInput, FaData> = {
  code: 'FA',
  label: 'Financial Analysis',
  description:
    'Multi-year fundamentals: revenue / EBITDA / net profit, EPS, P/E, P/B, dividends. Sourced from Avanza when connected, yfinance otherwise.',
  pagePath: (input) => {
    const t = String((input as unknown as FaInput).ticker ?? '').trim().toUpperCase();
    return t ? `/terminal/fa/${encodeURIComponent(t)}` : '/terminal/fa';
  },
  requiresTicker: true,
  inputSchema: {
    type: 'object',
    properties: { ticker: { type: 'string', description: 'Equity ticker' } },
    required: ['ticker'],
  },
  fetch: fetchFa,
  formatForAgent: formatFaForAgent,
  summarise: (d) =>
    `${d.ticker} — P/E ${fmt(d.ratios.trailingPE)}, P/B ${fmt(d.ratios.priceToBook)}, ROE ${fmt(d.ratios.returnOnEquity)}`,
};

registerTerminalTool(faTool);
