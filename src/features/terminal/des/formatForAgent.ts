/**
 * DES → plain-text formatter for LLM / quant-agent consumption.
 *
 * Produces a deterministic Markdown brief that includes:
 *   • Identification block (ticker, legal name, listing info, identifiers).
 *   • Long-form business description.
 *   • Revenue-segment breakdown.
 *   • Financial highlights with margins and returns.
 *   • Valuation, capital structure, and trading stats.
 *   • Executives, highlights, risks, and catalysts.
 *
 * The text is designed to be paste-ready into an LLM context window, e.g.:
 *   "Here is the DES snapshot for NVDA, use it when answering follow-up
 *    questions about fundamentals / valuation / corporate profile."
 */

import type { DesData, DesExecutive, DesSegment } from './mockData';

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtUsdB(valueB: number): string {
  if (Math.abs(valueB) >= 1000) return `$${(valueB / 1000).toFixed(2)}T`;
  return `$${valueB.toFixed(2)}B`;
}

function signedPct(n: number, decimals = 2): string {
  const v = `${n.toFixed(decimals)}%`;
  return n > 0 ? `+${v}` : v;
}

function fmtPct(n: number, decimals = 2): string {
  return `${n.toFixed(decimals)}%`;
}

function segmentLine(s: DesSegment): string {
  return `- ${s.name} — ${fmtPct(s.revenuePct, 1)} of revenue. ${s.description}`;
}

function executiveLine(e: DesExecutive): string {
  const age = e.ageYrs ? `, age ${e.ageYrs}` : '';
  return `- ${e.name} — ${e.title}${age}. In role since ${e.since}.`;
}

export function formatDesForAgent(data: DesData): string {
  const { center: c, financials: f, valuation: v, segments, executives, highlights, risks, catalysts } = data;

  const out: string[] = [];

  out.push(`# DES — Company Description | ${c.ticker} (${c.name})`);
  out.push(`> Generated: ${new Date().toISOString()}`);
  out.push('> Source: fyer-terminal mock (deterministic). Replace with live fundamentals feed when available.');
  out.push('');

  // --- Identification ----------------------------------------------------
  out.push('## Identification');
  out.push(`- Ticker: ${c.ticker}`);
  out.push(`- Legal name: ${c.legalName}`);
  out.push(`- Exchange: ${c.exchange} (${c.currency})`);
  out.push(`- Listed: ${c.listingDate}`);
  out.push(`- Founded: ${c.founded}`);
  out.push(`- Incorporation: ${c.incorporation}`);
  out.push(`- Headquarters: ${c.hqCity}, ${c.hqCountry}`);
  out.push(`- Employees: ${c.employees.toLocaleString()}`);
  out.push(`- Website: ${c.website}`);
  out.push(`- GICS Sector / Industry: ${c.gicsSector} / ${c.gicsIndustry}`);
  out.push(`- NAICS: ${c.naicsCode}`);
  out.push(`- Fiscal year end: ${c.fiscalYearEnd}`);
  out.push(`- Identifiers: ISIN ${c.isin} · CUSIP ${c.cusip} · SEDOL ${c.sedol} · FIGI ${c.figi} · BBGID ${c.bbgid}`);
  out.push('');

  // --- Business description ---------------------------------------------
  out.push('## Business Description');
  out.push(c.description);
  out.push('');

  // --- Revenue segments --------------------------------------------------
  if (segments.length) {
    out.push('## Revenue Segments');
    segments.forEach((s) => out.push(segmentLine(s)));
    out.push('');
  }

  // --- Financial highlights ---------------------------------------------
  out.push('## Financial Highlights (TTM)');
  out.push(`- Revenue: ${fmtUsdB(f.revenueTtmB)} (${signedPct(f.revenueGrowthYoyPct, 1)} YoY)`);
  out.push(`- EBITDA: ${fmtUsdB(f.ebitdaTtmB)} (${fmtPct(f.ebitdaMarginPct, 1)} margin)`);
  out.push(`- Gross / Operating margin: ${fmtPct(f.grossMarginPct, 1)} / ${fmtPct(f.operatingMarginPct, 1)}`);
  out.push(`- Net income: ${fmtUsdB(f.netIncomeTtmB)} (${fmtPct(f.netMarginPct, 1)} margin)`);
  out.push(`- Free cash flow: ${fmtUsdB(f.fcfTtmB)} · Capex: ${fmtUsdB(f.capexTtmB)}`);
  out.push(`- Cash & ST investments: ${fmtUsdB(f.cashAndStB)}`);
  out.push(`- Total debt: ${fmtUsdB(f.totalDebtB)} · Net debt: ${fmtUsdB(f.netDebtB)}`);
  out.push(`- Returns: ROE ${fmtPct(f.roePct, 1)} · ROA ${fmtPct(f.roaPct, 1)} · ROIC ${fmtPct(f.roicPct, 1)}`);
  out.push('');

  // --- Valuation & trading ----------------------------------------------
  out.push('## Valuation & Trading');
  out.push(`- Price: $${v.price.toFixed(2)} (${signedPct(v.changePct, 2)} day)`);
  out.push(`- Market cap: ${fmtUsdB(v.marketCapB)} · Enterprise value: ${fmtUsdB(v.enterpriseValueB)}`);
  out.push(`- Shares out: ${fmtNum(v.sharesOutM, 0)}M · Float: ${fmtNum(v.floatM, 0)}M · Short interest: ${fmtPct(v.shortInterestPct, 2)}`);
  out.push(`- Multiples: P/E ${v.pe.toFixed(1)}x · Fwd P/E ${v.peFwd.toFixed(1)}x · P/B ${v.pbRatio.toFixed(1)}x · P/S ${v.psRatio.toFixed(1)}x · EV/EBITDA ${v.evEbitda.toFixed(1)}x`);
  out.push(`- Dividend: ${fmtPct(v.divYieldPct, 2)} yield · $${v.divPerShare.toFixed(2)}/sh · ${fmtPct(v.payoutRatioPct, 1)} payout`);
  out.push(`- 52-week range: $${v.w52Low.toFixed(2)} – $${v.w52High.toFixed(2)} · Beta ${v.beta.toFixed(2)} · Avg daily vol 3m ${fmtNum(v.avgVol3moM, 1)}M`);
  out.push('');

  // --- Key executives ---------------------------------------------------
  if (executives.length) {
    out.push('## Key Executives');
    executives.forEach((e) => out.push(executiveLine(e)));
    out.push('');
  }

  // --- Qualitative narrative --------------------------------------------
  if (highlights.length) {
    out.push('## Business Highlights');
    highlights.forEach((h) => out.push(`- ${h}`));
    out.push('');
  }
  if (risks.length) {
    out.push('## Risks');
    risks.forEach((r) => out.push(`- ${r}`));
    out.push('');
  }
  if (catalysts.length) {
    out.push('## Catalysts');
    catalysts.forEach((k) => out.push(`- ${k}`));
    out.push('');
  }

  // --- Agent notes (auto) -----------------------------------------------
  const notes: string[] = [];
  if (v.pe > 50) notes.push(`Trailing P/E of ${v.pe.toFixed(1)}x is rich — validate vs growth expectations.`);
  if (f.revenueGrowthYoyPct > 40) notes.push(`Hyper-growth regime: revenue ${signedPct(f.revenueGrowthYoyPct, 1)} YoY.`);
  if (f.revenueGrowthYoyPct < 0) notes.push(`Revenue is declining YoY (${signedPct(f.revenueGrowthYoyPct, 1)}) — review segment mix.`);
  if (f.operatingMarginPct > 40) notes.push(`Exceptional operating leverage at ${fmtPct(f.operatingMarginPct, 1)} operating margin.`);
  if (f.netDebtB < 0) notes.push(`Net cash position of ${fmtUsdB(-f.netDebtB)} — balance-sheet flexibility for buybacks, M&A, capex.`);
  if (v.divYieldPct === 0 && f.fcfTtmB > 0) notes.push('No dividend despite positive FCF — capital return policy biased to buybacks or reinvestment.');
  if (v.shortInterestPct > 3) notes.push(`Elevated short interest (${fmtPct(v.shortInterestPct, 2)}) — potential squeeze / bearish signal.`);
  if (!notes.length) notes.push('No unusual fundamental or valuation outliers detected.');

  out.push('## Agent Notes');
  notes.forEach((n) => out.push(`- ${n}`));

  return out.join('\n');
}

export function summariseDes(data: DesData): string {
  const { center: c, financials: f, valuation: v } = data;
  return `DES ${c.ticker} (${c.name}): ${c.gicsIndustry}, HQ ${c.hqCity}. Revenue ${fmtUsdB(f.revenueTtmB)} TTM (${signedPct(f.revenueGrowthYoyPct, 1)} YoY), ${fmtPct(f.operatingMarginPct, 1)} op margin. Market cap ${fmtUsdB(v.marketCapB)}, P/E ${v.pe.toFixed(1)}x, EV/EBITDA ${v.evEbitda.toFixed(1)}x. ${c.employees.toLocaleString()} employees.`;
}
