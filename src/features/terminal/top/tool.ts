/**
 * TOP — Top Stories
 * -----------------
 * Cross-market editorial newsfeed. Falls back to the existing /api/news
 * route from the orchestrator when one is configured.
 */

import { registerTerminalTool } from '../agentTools/registry';
import type { TerminalTool } from '../agentTools/types';
import { terminalApiGet } from '../apiClient';

export interface TopInput { region?: 'global' | 'nordic' | 'us' }

export interface TopItem {
  id: string | null;
  headline: string;
  summary: string | null;
  source: string | null;
  timestamp: string | number | null;
  url: string | null;
}

export interface TopData {
  source: 'avanza' | 'newsapi' | 'yfinance' | 'mock';
  items: TopItem[];
}

async function fetchTop(_input: TopInput): Promise<TopData> {
  // The market-wide news endpoint isn't yet wired separately, so we
  // surface the editorial Avanza inspiration list when available.
  const resp = await terminalApiGet<{ source: string; data: { items?: TopItem[] } }>(
    `/api/terminal/news/_INDEX_`,
  );
  if (resp?.data?.items?.length) {
    return { source: resp.source as TopData['source'], items: resp.data.items };
  }
  return { source: 'mock', items: [] };
}

export const topTool: TerminalTool<TopInput, TopData> = {
  code: 'TOP',
  label: 'Top Stories',
  description: 'Cross-market editorial newsfeed.',
  pagePath: () => '/terminal/top',
  requiresTicker: false,
  inputSchema: {
    type: 'object',
    properties: { region: { type: 'string', enum: ['global', 'nordic', 'us'] } },
  },
  fetch: fetchTop,
  formatForAgent: (d) =>
    `# Top Stories (${d.source})\n${d.items.slice(0, 10).map((x) => `- ${x.headline}`).join('\n')}`,
};

registerTerminalTool(topTool);
