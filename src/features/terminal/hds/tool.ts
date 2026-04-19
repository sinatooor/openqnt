/**
 * HDS tool registration — makes the function available to quant agents
 * through the shared terminal-tool registry.
 */

import { registerTerminalTool } from '../agentTools/registry';
import type { TerminalTool } from '../agentTools/types';
import { terminalApiGet } from '../apiClient';
import { generateHdsData, type HdsData, type HdsInput } from './mockData';
import { formatHdsForAgent, summariseHds } from './formatForAgent';

/**
 * HDS fetcher: try the backend terminal-data API first (SEC 13F + yfinance
 * institutional/mutual-fund holders). Fall back to the deterministic mock
 * generator only when the backend is unreachable / empty — so the frontend
 * remains demo-able offline.
 */
async function fetchHds(input: HdsInput): Promise<HdsData> {
  const ticker = String(input.ticker ?? '').trim().toUpperCase();
  if (!ticker) return generateHdsData(input);
  const resp = await terminalApiGet<{ source: string; data: HdsData }>(
    `/api/terminal/hds/${encodeURIComponent(ticker)}`,
  );
  if (resp?.data?.holders?.length) return resp.data;
  return generateHdsData(input);
}

export const hdsTool: TerminalTool<HdsInput, HdsData> = {
  code: 'HDS',
  label: 'Holders Detail',
  description:
    'Institutional, mutual-fund, ETF, hedge-fund, and insider holders of a given equity, with position size, %-of-outstanding, change vs prior filing, market value, filing source, and portfolio weight.',
  pagePath: (input) => {
    const t = String(input.ticker ?? '').trim().toUpperCase();
    return t ? `/terminal/hds/${encodeURIComponent(t)}` : '/terminal/hds';
  },
  requiresTicker: true,
  inputSchema: {
    type: 'object',
    properties: {
      ticker: {
        type: 'string',
        description: 'Equity ticker (e.g. AAPL, MSFT, TSLA).',
        examples: ['AAPL', 'MSFT', 'NVDA'],
      },
      seedSalt: {
        type: 'integer',
        description: 'Optional refresh salt — same ticker + salt returns identical data.',
        default: 0,
      },
    },
    required: ['ticker'],
  },
  fetch: (input) => fetchHds(input),
  formatForAgent: (data) => formatHdsForAgent(data),
  summarise: (data) => summariseHds(data),
};

registerTerminalTool(hdsTool);
