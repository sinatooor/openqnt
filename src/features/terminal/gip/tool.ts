/**
 * GIP tool registration — makes the intraday graph callable by quant agents
 * through the shared terminal-tool registry.
 */

import { registerTerminalTool } from '../agentTools/registry';
import type { TerminalTool } from '../agentTools/types';
import { terminalApiGet } from '../apiClient';
import { generateGipData, type GipData, type GipInput, type GipInterval } from './mockData';
import { formatGipForAgent, summariseGip } from './formatForAgent';

async function fetchGip(input: GipInput): Promise<GipData> {
  const ticker = String(input.ticker ?? '').trim().toUpperCase();
  if (!ticker) return generateGipData(input);
  const resp = await terminalApiGet<{ source: string; data: GipData }>(
    `/api/terminal/gip/${encodeURIComponent(ticker)}`,
    {
      interval: input.interval ?? '5m',
      extended: input.extendedHours ?? true,
    },
  );
  if (resp?.data?.bars?.length) return resp.data;
  return generateGipData(input);
}

export const gipTool: TerminalTool<GipInput, GipData> = {
  code: 'GIP',
  label: 'Intraday Graph',
  description:
    'Intraday OHLCV chart for a given equity at 1m / 5m / 15m / 30m / 60m intervals, with VWAP, pre-market and after-hours session tagging, realized range, and volume vs ADV statistics.',
  pagePath: (input) => {
    const t = String(input.ticker ?? '').trim().toUpperCase();
    return t ? `/terminal/gip/${encodeURIComponent(t)}` : '/terminal/gip';
  },
  requiresTicker: true,
  inputSchema: {
    type: 'object',
    properties: {
      ticker: {
        type: 'string',
        description: 'Equity ticker (e.g. AAPL, NVDA, SPY).',
        examples: ['AAPL', 'NVDA', 'SPY'],
      },
      interval: {
        type: 'string',
        description: 'Bar interval.',
        enum: ['1m', '5m', '15m', '30m', '60m'] as const satisfies readonly GipInterval[],
        default: '5m',
      },
      extendedHours: {
        type: 'boolean',
        description: 'Include pre-market and after-hours bars.',
        default: true,
      },
      seedSalt: {
        type: 'integer',
        description: 'Refresh salt — same ticker + salt returns identical data.',
        default: 0,
      },
    },
    required: ['ticker'],
  },
  fetch: (input) => fetchGip(input),
  formatForAgent: (data) => formatGipForAgent(data),
  summarise: (data) => summariseGip(data),
};

registerTerminalTool(gipTool);
