/**
 * DES tool registration — exposes the Company Description function to
 * quant agents via the shared terminal-tool registry.
 */

import { registerTerminalTool } from '../agentTools/registry';
import type { TerminalTool } from '../agentTools/types';
import { generateDesData, type DesData, type DesInput } from './mockData';
import { formatDesForAgent, summariseDes } from './formatForAgent';

export const desTool: TerminalTool<DesInput, DesData> = {
  code: 'DES',
  label: 'Company Description',
  description:
    'Single-screen company profile: business description, revenue segments, key executives, financial highlights (revenue/EBITDA/margins/FCF/returns), valuation multiples, capital structure, trading stats, and corporate identifiers (ISIN/CUSIP/SEDOL/FIGI/BBGID).',
  pagePath: (input) => {
    const t = String(input.ticker ?? '').trim().toUpperCase();
    return t ? `/terminal/des/${encodeURIComponent(t)}` : '/terminal/des';
  },
  requiresTicker: true,
  inputSchema: {
    type: 'object',
    properties: {
      ticker: {
        type: 'string',
        description: 'Equity ticker (e.g. AAPL, MSFT, NVDA).',
        examples: ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META'],
      },
      seedSalt: {
        type: 'integer',
        description: 'Optional refresh salt — same ticker + salt returns identical data.',
        default: 0,
      },
    },
    required: ['ticker'],
  },
  fetch: (input) => generateDesData(input),
  formatForAgent: (data) => formatDesForAgent(data),
  summarise: (data) => summariseDes(data),
};

registerTerminalTool(desTool);
