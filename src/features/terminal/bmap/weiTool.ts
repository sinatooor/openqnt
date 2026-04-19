/**
 * WEI — World Equity Indices agent tool.
 *
 * Powers the BMAP country-index heatmap layer and is also exposed
 * independently through the terminal-tool registry so any quant agent can
 * request a global equity-market snapshot in plain Markdown.
 */

import { registerTerminalTool } from '../agentTools/registry';
import type { TerminalTool } from '../agentTools/types';
import {
  COUNTRY_INDICES,
  generateWeiData,
  type IndexSnapshot,
  type WeiData,
  type WeiInput,
} from './countryIndices';

function signed(n: number, decimals = 2): string {
  const v = n.toFixed(decimals);
  return n > 0 ? `+${v}` : v;
}

function row(cells: (string | number)[]): string {
  return `| ${cells.join(' | ')} |`;
}

function formatWeiForAgent(data: WeiData): string {
  const out: string[] = [];
  out.push('# WEI — World Equity Indices Snapshot');
  out.push(`> As-of: ${data.asOf}`);
  out.push(`> Universe: ${data.snapshots.length} country flagship indices`);
  out.push('> Source: fyer-terminal mock (deterministic). Replace with live vendor feed when available.');
  out.push('');

  // Headline regime
  const up = data.snapshots.filter((s) => s.changePct > 0).length;
  const down = data.snapshots.filter((s) => s.changePct < 0).length;
  const flat = data.snapshots.length - up - down;
  const avg = data.snapshots.reduce((acc, s) => acc + s.changePct, 0) / data.snapshots.length;

  out.push('## Breadth');
  out.push(`- Advancing: ${up}`);
  out.push(`- Declining: ${down}`);
  out.push(`- Flat: ${flat}`);
  out.push(`- Average day change: ${signed(avg, 2)}%`);
  out.push('');

  out.push('## Top Gainers');
  data.topGainers.forEach((s) => {
    out.push(`- ${s.country} · ${s.ticker} (${s.index}): ${signed(s.changePct, 2)}% → ${s.price.toLocaleString()} ${s.currency} · YTD ${signed(s.ytdPct, 1)}%`);
  });
  out.push('');

  out.push('## Top Losers');
  data.topLosers.forEach((s) => {
    out.push(`- ${s.country} · ${s.ticker} (${s.index}): ${signed(s.changePct, 2)}% → ${s.price.toLocaleString()} ${s.currency} · YTD ${signed(s.ytdPct, 1)}%`);
  });
  out.push('');

  // Full table — grouped by region for readability.
  const groups: Array<{ label: string; iso3: string[] }> = [
    { label: 'Americas',     iso3: ['USA', 'CAN', 'MEX', 'BRA', 'ARG', 'CHL', 'COL', 'PER'] },
    { label: 'Europe',       iso3: ['GBR', 'DEU', 'FRA', 'ITA', 'ESP', 'PRT', 'NLD', 'BEL', 'CHE', 'AUT', 'IRL', 'SWE', 'NOR', 'FIN', 'DNK', 'ISL', 'POL', 'CZE', 'HUN', 'ROU', 'GRC', 'TUR', 'RUS', 'UKR'] },
    { label: 'Asia-Pacific', iso3: ['JPN', 'CHN', 'HKG', 'TWN', 'KOR', 'IND', 'PAK', 'BGD', 'LKA', 'IDN', 'MYS', 'THA', 'VNM', 'PHL', 'SGP', 'AUS', 'NZL'] },
    { label: 'Middle East',  iso3: ['ISR', 'SAU', 'ARE', 'QAT', 'KWT', 'OMN', 'JOR', 'IRN'] },
    { label: 'Africa',       iso3: ['EGY', 'MAR', 'ZAF', 'NGA', 'KEN', 'GHA', 'TUN'] },
  ];
  const byIso: Record<string, IndexSnapshot> = Object.fromEntries(
    data.snapshots.map((s) => [s.iso3, s]),
  );

  out.push('## Full Universe');
  out.push(row(['Region', 'Country', 'Index', 'Ticker', 'Last', 'Δ%', 'YTD%', 'Ccy']));
  out.push(row(['---', '---', '---', '---', '---:', '---:', '---:', '---']));
  groups.forEach((g) => {
    g.iso3.forEach((id) => {
      const s = byIso[id];
      if (!s) return;
      out.push(
        row([
          g.label,
          s.country,
          s.index,
          s.ticker,
          s.price.toLocaleString(),
          signed(s.changePct, 2),
          signed(s.ytdPct, 1),
          s.currency,
        ]),
      );
    });
  });
  out.push('');

  // Agent notes
  const notes: string[] = [];
  if (avg > 0.5) notes.push(`Risk-on tape — global average +${avg.toFixed(2)}%; breadth skewed to advancers (${up}/${data.snapshots.length}).`);
  if (avg < -0.5) notes.push(`Risk-off tape — global average ${avg.toFixed(2)}%; breadth skewed to decliners (${down}/${data.snapshots.length}).`);
  const extremeUp = data.snapshots.filter((s) => s.changePct >= 3);
  const extremeDn = data.snapshots.filter((s) => s.changePct <= -3);
  if (extremeUp.length) notes.push(`Outlier gainers (≥ +3%): ${extremeUp.map((s) => s.ticker).join(', ')}.`);
  if (extremeDn.length) notes.push(`Outlier losers (≤ -3%): ${extremeDn.map((s) => s.ticker).join(', ')}.`);
  if (!notes.length) notes.push('No macro outliers; dispersion is within typical single-day ranges.');

  out.push('## Agent Notes');
  notes.forEach((n) => out.push(`- ${n}`));

  return out.join('\n');
}

function summariseWei(data: WeiData): string {
  const up = data.snapshots.filter((s) => s.changePct > 0).length;
  const avg = data.snapshots.reduce((acc, s) => acc + s.changePct, 0) / data.snapshots.length;
  const best = data.topGainers[0];
  const worst = data.topLosers[0];
  return `WEI ${data.asOf}: ${up}/${data.snapshots.length} advancing, avg ${signed(avg, 2)}%. Best: ${best.ticker} ${signed(best.changePct, 2)}%. Worst: ${worst.ticker} ${signed(worst.changePct, 2)}%.`;
}

export const weiTool: TerminalTool<WeiInput, WeiData> = {
  code: 'WEI',
  label: 'World Equity Indices',
  description:
    'Daily snapshot of every country\'s flagship equity index (S&P 500, Nikkei 225, FTSE 100, DAX, OMXS30, Nifty 50, Hang Seng, etc.) with day change, YTD return, price, and currency. Used to drive the BMAP country heatmap and is independently callable by agents for global macro summaries.',
  pagePath: () => '/terminal/bmap',
  requiresTicker: false,
  inputSchema: {
    type: 'object',
    properties: {
      seedSalt: {
        type: 'integer',
        description: 'Refresh salt — same salt returns identical data. Increment for a fresh snapshot.',
        default: 0,
      },
    },
  },
  fetch: (input) => generateWeiData(input),
  formatForAgent: (data) => formatWeiForAgent(data),
  summarise: (data) => summariseWei(data),
};

registerTerminalTool(weiTool);

/** Re-exported for BmapView convenience. */
export { COUNTRY_INDICES };
