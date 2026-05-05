/**
 * N — News
 * --------
 * Per-instrument news headlines. Pulls from /api/terminal/news/{ticker}
 * which routes to Avanza when source=avanza, yfinance otherwise.
 */

import { registerTerminalTool } from '../agentTools/registry';
import type { TerminalTool } from '../agentTools/types';
import { terminalApiGet } from '../apiClient';

export interface NewsInput { ticker: string }

export interface NewsItem {
  id: string | null;
  headline: string;
  summary: string | null;
  source: string | null;
  timestamp: string | number | null;
  url: string | null;
}

export interface NewsData {
  ticker: string;
  source: 'avanza' | 'yfinance' | 'mock';
  items: NewsItem[];
}

async function fetchNews(input: NewsInput): Promise<NewsData> {
  const ticker = String(input.ticker ?? '').trim().toUpperCase();
  if (!ticker) return { ticker: '', source: 'mock', items: [] };
  const resp = await terminalApiGet<{ source: string; data: { items?: NewsItem[] } }>(
    `/api/terminal/news/${encodeURIComponent(ticker)}`,
  );
  return {
    ticker,
    source: (resp?.source as NewsData['source']) || 'mock',
    items: Array.isArray(resp?.data?.items) ? resp!.data.items! : [],
  };
}

function formatNewsForAgent(d: NewsData): string {
  const lines = [`# News — ${d.ticker} (${d.source})`];
  for (const item of d.items.slice(0, 10)) {
    const ts =
      typeof item.timestamp === 'number'
        ? new Date(item.timestamp * 1000).toISOString().slice(0, 16)
        : item.timestamp || '';
    lines.push(`- [${ts}] ${item.headline} — ${item.source ?? ''}`);
  }
  return lines.join('\n');
}

export const newsTool: TerminalTool<NewsInput, NewsData> = {
  code: 'N',
  label: 'News',
  description: 'Per-instrument news headlines from Avanza editorial + Direkt + Cision (when connected) or yfinance.',
  pagePath: (input) => {
    const t = String((input as unknown as NewsInput).ticker ?? '').trim().toUpperCase();
    return t ? `/terminal/n/${encodeURIComponent(t)}` : '/terminal/n';
  },
  requiresTicker: true,
  inputSchema: {
    type: 'object',
    properties: { ticker: { type: 'string', description: 'Equity ticker' } },
    required: ['ticker'],
  },
  fetch: fetchNews,
  formatForAgent: formatNewsForAgent,
};

registerTerminalTool(newsTool);
