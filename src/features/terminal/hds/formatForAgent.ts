/**
 * HDS → plain-text formatter for LLM / quant-agent consumption.
 *
 * Produces a deterministic Markdown report that is:
 *   - Token-efficient (no decorative noise).
 *   - Self-describing (YAML-style header block + source tag so an agent can
 *     cite it reliably).
 *   - Stable across renders (ordering is explicit).
 *
 * Keeping the formatter separate from the data generator ensures real-data
 * replacements never require touching the agent prompt surface.
 */

import type { HdsData, Holder } from './mockData';

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtPct(n: number, decimals = 2): string {
  return `${n.toFixed(decimals)}%`;
}

function fmtUsdMm(valueMm: number): string {
  if (valueMm >= 1_000_000) return `$${(valueMm / 1_000_000).toFixed(2)}T`;
  if (valueMm >= 1_000) return `$${(valueMm / 1_000).toFixed(2)}B`;
  return `$${valueMm.toFixed(0)}MM`;
}

function signed(n: number, decimals = 2): string {
  const v = n.toFixed(decimals);
  return n > 0 ? `+${v}` : v;
}

function row(cells: (string | number)[]): string {
  return `| ${cells.join(' | ')} |`;
}

/** Collapse a Holder to a single table row (ordered, fixed column set) */
function holderRow(rank: number, h: Holder): string {
  return row([
    rank,
    h.name,
    h.type,
    h.source,
    fmtNum(h.positionSharesM, 2),
    fmtPct(h.pctOut, 3),
    signed(h.changeSharesM, 2),
    signed(h.changePct, 2),
    fmtUsdMm(h.marketValueMm),
    h.positionDate,
    fmtPct(h.portfolioPct, 2),
    h.status,
  ]);
}

export function formatHdsForAgent(data: HdsData): string {
  const { center, summary, holders, asOf } = data;

  const topN = holders.slice(0, 20);
  const newest = holders.filter((h) => h.status === 'New');
  const increased = [...holders]
    .filter((h) => h.status === 'Increased')
    .sort((a, b) => Math.abs(b.changeSharesM) - Math.abs(a.changeSharesM))
    .slice(0, 5);
  const decreased = [...holders]
    .filter((h) => h.status === 'Decreased')
    .sort((a, b) => Math.abs(b.changeSharesM) - Math.abs(a.changeSharesM))
    .slice(0, 5);
  const soldOut = holders.filter((h) => h.status === 'Sold Out');

  const tableHeader =
    row([
      'Rank', 'Name', 'Type', 'Src', 'Shares(M)', '%Out',
      'ΔShares(M)', 'Δ%', 'MktVal', 'Filed', 'Port%', 'Status',
    ]) +
    '\n' +
    row([
      '---:', '---', '---', '---', '---:', '---:',
      '---:', '---:', '---:', '---', '---:', ':---:',
    ]);

  const out: string[] = [];
  out.push(`# HDS — Holders Detail | ${center.ticker}`);
  out.push(`> Generated: ${new Date().toISOString()}`);
  out.push(`> As-of: ${asOf}`);
  out.push(`> Source: fyer-terminal mock (deterministic). Replace with live 13F/NPORT feed when available.`);
  out.push('');

  // Focal summary
  out.push('## Focal Company');
  out.push(`- Ticker: ${center.ticker}`);
  out.push(`- Name: ${center.name}`);
  out.push(`- Country: ${center.country}`);
  out.push(`- Industry: ${center.industry}`);
  out.push(`- Price: $${center.price.toFixed(2)}`);
  out.push(`- Market Cap: $${center.marketCapB.toFixed(1)}B`);
  out.push(`- Shares Outstanding: ${fmtNum(center.sharesOutstandingM, 1)}M`);
  out.push(`- Float: ${fmtPct(center.floatPctOfOut, 1)} of outstanding`);
  out.push('');

  // Ownership summary
  out.push('## Ownership Summary');
  out.push(`- Institutional: ${fmtPct(summary.institutionalPct, 2)}`);
  out.push(`- Mutual Funds: ${fmtPct(summary.mutualFundPct, 2)}`);
  out.push(`- ETFs: ${fmtPct(summary.etfPct, 2)}`);
  out.push(`- Hedge Funds: ${fmtPct(summary.hedgeFundPct, 2)}`);
  out.push(`- Insider / 5% Holders: ${fmtPct(summary.insiderPct, 2)}`);
  out.push(`- Top-10 Concentration: ${fmtPct(summary.top10Pct, 2)} of shares outstanding`);
  out.push(`- Holder Count: ${summary.holderCount.toLocaleString()} (${signed(summary.holderCountDeltaQoq, 0)} QoQ)`);
  out.push(`- Short Interest: ${fmtPct(summary.shortInterestPct, 2)} of float`);
  out.push(`- Days to Cover: ${summary.daysToCover.toFixed(1)}`);
  out.push(`- Avg Daily Volume: ${summary.avgDailyVolumeM.toFixed(1)}M shares`);
  out.push(`- Float Turnover: ${summary.floatTurnoverDays} days`);
  out.push('');

  // Top holders table
  out.push(`## Top ${topN.length} Holders`);
  out.push('Sorted by position size (shares).');
  out.push('');
  out.push(tableHeader);
  topN.forEach((h, i) => out.push(holderRow(i + 1, h)));
  out.push('');

  // Notable changes
  out.push('## Notable Changes Since Last Filing');
  if (newest.length) {
    out.push('### New Positions');
    newest.slice(0, 8).forEach((h) => {
      out.push(`- ${h.name} (${h.type}, ${h.source}) — ${fmtNum(h.positionSharesM, 2)}M sh (${fmtPct(h.pctOut, 3)} of S/O) · ${fmtUsdMm(h.marketValueMm)} · filed ${h.positionDate}`);
    });
  } else {
    out.push('### New Positions\n- None reported');
  }
  out.push('');

  out.push('### Largest Increases');
  if (increased.length) {
    increased.forEach((h) => {
      out.push(`- ${h.name} (${h.type}) — ${signed(h.changeSharesM, 2)}M sh (${signed(h.changePct, 2)}%) · now ${fmtPct(h.pctOut, 3)} of S/O`);
    });
  } else {
    out.push('- None');
  }
  out.push('');

  out.push('### Largest Decreases');
  if (decreased.length) {
    decreased.forEach((h) => {
      out.push(`- ${h.name} (${h.type}) — ${signed(h.changeSharesM, 2)}M sh (${signed(h.changePct, 2)}%) · now ${fmtPct(h.pctOut, 3)} of S/O`);
    });
  } else {
    out.push('- None');
  }
  out.push('');

  if (soldOut.length) {
    out.push('### Sold Out');
    soldOut.slice(0, 8).forEach((h) => {
      out.push(`- ${h.name} (${h.type}) — exited ${fmtNum(Math.abs(h.changeSharesM), 2)}M sh`);
    });
    out.push('');
  }

  // Per-bucket view
  const byBucket = groupBy(holders, (h) => h.type);
  out.push('## Holder Counts by Type');
  Object.entries(byBucket)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([type, list]) => {
      const totalShares = list.reduce((acc, h) => acc + h.positionSharesM, 0);
      const totalMv = list.reduce((acc, h) => acc + h.marketValueMm, 0);
      const pctOut = (totalShares / center.sharesOutstandingM) * 100;
      out.push(`- ${type}: ${list.length} holders · ${fmtNum(totalShares, 2)}M sh · ${fmtPct(pctOut, 2)} · ${fmtUsdMm(totalMv)}`);
    });
  out.push('');

  // Risk / concentration notes
  out.push('## Agent Notes');
  const notes: string[] = [];
  if (summary.top10Pct > 60) notes.push(`Very high concentration — top-10 holders own ${fmtPct(summary.top10Pct, 1)} of S/O.`);
  else if (summary.top10Pct > 40) notes.push(`Elevated concentration — top-10 holders own ${fmtPct(summary.top10Pct, 1)} of S/O.`);
  if (summary.insiderPct > 8) notes.push(`Insider ownership of ${fmtPct(summary.insiderPct, 1)} suggests founder/controlling influence.`);
  if (summary.shortInterestPct > 5) notes.push(`Short interest of ${fmtPct(summary.shortInterestPct, 1)} may indicate bearish positioning or hedging.`);
  if (summary.holderCountDeltaQoq > 250) notes.push(`Rapidly expanding holder base (+${summary.holderCountDeltaQoq} QoQ).`);
  if (summary.holderCountDeltaQoq < -150) notes.push(`Shrinking holder base (${summary.holderCountDeltaQoq} QoQ) — potential distribution.`);
  if (!notes.length) notes.push('No unusual concentration, insider, or short-interest signals detected.');
  notes.forEach((n) => out.push(`- ${n}`));

  return out.join('\n');
}

function groupBy<T, K extends string>(arr: T[], key: (t: T) => K): Record<K, T[]> {
  const r = {} as Record<K, T[]>;
  for (const item of arr) {
    const k = key(item);
    if (!r[k]) r[k] = [];
    r[k].push(item);
  }
  return r;
}

export function summariseHds(data: HdsData): string {
  const s = data.summary;
  return `HDS ${data.center.ticker}: Inst ${s.institutionalPct.toFixed(1)}%, ETF ${s.etfPct.toFixed(1)}%, MF ${s.mutualFundPct.toFixed(1)}%, HF ${s.hedgeFundPct.toFixed(1)}%, Insider ${s.insiderPct.toFixed(2)}%. Top-10 = ${s.top10Pct.toFixed(1)}%. Short ${s.shortInterestPct.toFixed(2)}% (${s.daysToCover.toFixed(1)} days to cover). ${s.holderCount.toLocaleString()} holders (Δ${s.holderCountDeltaQoq >= 0 ? '+' : ''}${s.holderCountDeltaQoq} QoQ).`;
}
