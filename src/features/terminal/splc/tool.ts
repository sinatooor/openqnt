/**
 * SPLC tool registration — exposes the Supply-Chain Analysis function to the
 * shared agent-tool registry so quant agents can consume structured data and
 * formatted text payloads identically to how the human-facing SPLC page
 * does.
 */

import { registerTerminalTool } from '../agentTools/registry';
import type { TerminalTool } from '../agentTools/types';
import { generateSplcData, type SplcData, type SplcRelationship } from './mockData';

export interface SplcInput {
  ticker: string;
  seedSalt?: number;
}

function fmtUsdMm(valueMm: number): string {
  if (valueMm >= 1_000_000) return `$${(valueMm / 1_000_000).toFixed(2)}T`;
  if (valueMm >= 1_000) return `$${(valueMm / 1_000).toFixed(2)}B`;
  return `$${valueMm.toFixed(0)}MM`;
}

function signed(n: number, d = 2): string {
  return n > 0 ? `+${n.toFixed(d)}` : n.toFixed(d);
}

function relRow(r: SplcRelationship, side: 'Supplier' | 'Customer', rank: number): string {
  return `| ${rank} | ${r.company.ticker} | ${r.company.name} | ${side} | ${r.companyExposurePct.toFixed(2)}% | ${r.relationshipExposurePct.toFixed(2)}% | ${fmtUsdMm(r.valueMm)} | ${signed(r.deltaPct)}% | ${r.source} (${r.sourceDate}) | ${r.quantified ? 'Y' : 'N'} |`;
}

function formatSplcForAgent(data: SplcData): string {
  const { center, suppliers, customers, peers } = data;
  const out: string[] = [];
  out.push(`# SPLC — Supply Chain Analysis | ${center.ticker}`);
  out.push(`> Generated: ${new Date().toISOString()}`);
  out.push('> Source: fyer-terminal mock (deterministic). Replace with live Bloomberg / FactSet / Sayari feeds when available.');
  out.push('');

  out.push('## Focal Company');
  out.push(`- Ticker: ${center.ticker}`);
  out.push(`- Name: ${center.name}`);
  out.push(`- Country / Industry: ${center.country} · ${center.industry}`);
  out.push(`- Price: $${center.price.toFixed(2)}`);
  out.push(`- Market Cap: $${center.marketCapB.toFixed(1)}B`);
  out.push(`- Revenue (ttm): $${center.revenueB.toFixed(1)}B`);
  out.push(`- COGS (ttm): $${center.cogsB.toFixed(1)}B`);
  out.push(`- Gross Margin: ${center.grossMarginPct.toFixed(1)}%`);
  out.push(`- Quantified Coverage: revenue ${center.metrics.revenueQuantifiedPct}% · COGS ${center.metrics.cogsQuantifiedPct}% · capex ${center.metrics.capexQuantifiedPct}% · SG&A ${center.metrics.sgaQuantifiedPct}% · R&D ${center.metrics.rndQuantifiedPct}%`);
  out.push('');

  const top3SupplierShare = suppliers.slice(0, 3).reduce((a, s) => a + s.companyExposurePct, 0);
  const top3CustomerShare = customers.slice(0, 3).reduce((a, c) => a + c.companyExposurePct, 0);
  out.push('## Concentration');
  out.push(`- Top-3 suppliers = ${top3SupplierShare.toFixed(2)}% of focal COGS`);
  out.push(`- Top-3 customers = ${top3CustomerShare.toFixed(2)}% of focal revenue`);
  out.push(`- Supplier count (listed): ${suppliers.length} · Customer count (listed): ${customers.length}`);
  out.push('');

  const header =
    '| # | Ticker | Name | Side | Company Exp. | Rel. Exp. | $Flow | Δ YoY | Source | Quantified |\n' +
    '|---|--------|------|------|-------------:|---------:|------:|------:|--------|:----------:|';
  out.push('## Suppliers (sorted by company exposure)');
  if (suppliers.length) {
    out.push(header);
    suppliers.forEach((s, i) => out.push(relRow(s, 'Supplier', i + 1)));
  } else {
    out.push('_No supplier relationships disclosed._');
  }
  out.push('');

  out.push('## Customers (sorted by company exposure)');
  if (customers.length) {
    out.push(header);
    customers.forEach((c, i) => out.push(relRow(c, 'Customer', i + 1)));
  } else {
    out.push('_No customer relationships disclosed._');
  }
  out.push('');

  out.push('## Peers / Competitors');
  peers.forEach((p) => out.push(`- ${p.ticker} — ${p.name} (${p.country}, ${p.industry})`));
  out.push('');

  out.push('## Agent Notes');
  const notes: string[] = [];
  if (top3SupplierShare > 50) notes.push(`Severe upstream concentration — top-3 suppliers own ${top3SupplierShare.toFixed(1)}% of COGS.`);
  else if (top3SupplierShare > 35) notes.push(`Elevated upstream concentration (${top3SupplierShare.toFixed(1)}% of COGS in top-3 suppliers).`);
  if (top3CustomerShare > 50) notes.push(`Severe downstream concentration — top-3 customers drive ${top3CustomerShare.toFixed(1)}% of revenue.`);
  else if (top3CustomerShare > 35) notes.push(`Elevated downstream concentration (${top3CustomerShare.toFixed(1)}% of revenue in top-3 customers).`);
  const topSupplier = suppliers[0];
  const topCustomer = customers[0];
  if (topSupplier && topSupplier.relationshipExposurePct > 50) {
    notes.push(`${topSupplier.company.ticker} is critically dependent on ${center.ticker} (${topSupplier.relationshipExposurePct.toFixed(1)}% of its revenue).`);
  }
  if (topCustomer && topCustomer.relationshipExposurePct > 50) {
    notes.push(`${topCustomer.company.ticker} depends on ${center.ticker} for ${topCustomer.relationshipExposurePct.toFixed(1)}% of its COGS.`);
  }
  if (!notes.length) notes.push('No unusual concentration risks detected at the top of either tier.');
  notes.forEach((n) => out.push(`- ${n}`));

  return out.join('\n');
}

function summariseSplc(data: SplcData): string {
  const top3S = data.suppliers.slice(0, 3).reduce((a, s) => a + s.companyExposurePct, 0);
  const top3C = data.customers.slice(0, 3).reduce((a, c) => a + c.companyExposurePct, 0);
  return `SPLC ${data.center.ticker}: ${data.suppliers.length} suppliers, ${data.customers.length} customers. Top-3 supplier share = ${top3S.toFixed(1)}% of COGS; top-3 customer share = ${top3C.toFixed(1)}% of revenue.`;
}

export const splcTool: TerminalTool<SplcInput, SplcData> = {
  code: 'SPLC',
  label: 'Supply Chain Analysis',
  description:
    'Suppliers, customers, and industry peers of a focal firm with dollar flows, company vs relationship exposure, filing sources, and concentration risk flags.',
  pagePath: (input) => {
    const t = String(input.ticker ?? '').trim().toUpperCase();
    return t ? `/terminal/splc/${encodeURIComponent(t)}` : '/terminal/splc';
  },
  requiresTicker: true,
  inputSchema: {
    type: 'object',
    properties: {
      ticker: {
        type: 'string',
        description: 'Equity ticker of the focal company.',
        examples: ['AAPL', 'NVDA', 'TSLA'],
      },
      seedSalt: {
        type: 'integer',
        description: 'Optional refresh salt.',
        default: 0,
      },
    },
    required: ['ticker'],
  },
  fetch: (input) => {
    // The generator accepts a composite string seed — combine ticker + salt to keep outputs stable.
    const salted = input.seedSalt != null ? `${input.ticker}#${input.seedSalt}` : input.ticker;
    return generateSplcData(salted);
  },
  formatForAgent: (data) => formatSplcForAgent(data),
  summarise: (data) => summariseSplc(data),
};

registerTerminalTool(splcTool);
