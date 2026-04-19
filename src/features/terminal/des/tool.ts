/**
 * DES tool registration — exposes the Company Description function to
 * quant agents via the shared terminal-tool registry.
 */

import { registerTerminalTool } from '../agentTools/registry';
import type { TerminalTool } from '../agentTools/types';
import { terminalApiGet } from '../apiClient';
import { generateDesData, type DesData, type DesInput } from './mockData';
import { formatDesForAgent, summariseDes } from './formatForAgent';

async function fetchDes(input: DesInput): Promise<DesData> {
  const ticker = String(input.ticker ?? '').trim().toUpperCase();
  if (!ticker) return generateDesData(input);
  const resp = await terminalApiGet<{ source: string; data: DesData }>(
    `/api/terminal/des/${encodeURIComponent(ticker)}`,
  );
  // Require at least a populated center.name to trust the backend.
  if (resp?.data?.center?.name) {
    // Merge with mock to fill in any fields the free provider didn't return,
    // so the UI never sees undefined in a column it expects to exist.
    const mock = generateDesData(input);
    return {
      ...mock,
      ...resp.data,
      center: { ...mock.center, ...resp.data.center },
      financials: { ...mock.financials, ...resp.data.financials },
      valuation: { ...mock.valuation, ...resp.data.valuation },
      segments: resp.data.segments?.length ? resp.data.segments : mock.segments,
      executives: resp.data.executives?.length ? resp.data.executives : mock.executives,
      highlights: resp.data.highlights?.length ? resp.data.highlights : mock.highlights,
      risks: resp.data.risks?.length ? resp.data.risks : mock.risks,
      catalysts: resp.data.catalysts?.length ? resp.data.catalysts : mock.catalysts,
    };
  }
  return generateDesData(input);
}

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
  fetch: (input) => fetchDes(input),
  formatForAgent: (data) => formatDesForAgent(data),
  summarise: (data) => summariseDes(data),
};

registerTerminalTool(desTool);
