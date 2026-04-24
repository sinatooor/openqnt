/**
 * RMAP → plain-text formatter for LLM / quant-agent consumption.
 *
 * Produces a tight Markdown brief that mirrors the visual layout: a
 * centre block, then one section per "data node" (peers, holders,
 * analysts, board/execs, news, events, options, balance). Empty sections
 * are skipped so the prompt only carries information that actually came
 * back from the upstream provider.
 */

import type { RmapData } from './mockData';

function pct(n: number, digits = 2): string {
  const v = `${n.toFixed(digits)}%`;
  return n > 0 ? `+${v}` : v;
}

export function formatRmapForAgent(d: RmapData): string {
  const lines: string[] = [];
  lines.push(`# RMAP — ${d.center.ticker} · ${d.center.name}`);
  lines.push(
    `${d.center.exchange || '—'} · ${d.center.currency} ${d.center.price.toFixed(2)} (${pct(d.center.changePct)})`,
  );

  if (d.peers.items.length) {
    lines.push('', '## Peers');
    lines.push(
      d.peers.items.map((p) => `${p.symbol} ${pct(p.changePct, 1)}`).join(' · '),
    );
  }

  if (d.holders.items.length) {
    lines.push('', '## Top Holders');
    for (const h of d.holders.items.slice(0, 8)) {
      lines.push(`- ${h.name} — ${h.pctOwned.toFixed(2)}%`);
    }
  }

  if (d.analysts.items.length) {
    const buys = d.analysts.items.filter((a) => a.action === 'BUY').length;
    const holds = d.analysts.items.filter((a) => a.action === 'HOLD').length;
    const sells = d.analysts.items.filter((a) => a.action === 'SELL').length;
    lines.push('', '## Analysts (recent)');
    lines.push(`Buy ${buys} · Hold ${holds} · Sell ${sells}`);
    lines.push(
      d.analysts.items.map((a) => `${a.firm} ${a.action}`).join(' · '),
    );
  }

  if (d.executives.items.length) {
    lines.push('', '## Executives');
    for (const p of d.executives.items) lines.push(`- ${p.role}: ${p.name}`);
  }
  if (d.board.items.length) {
    lines.push('', '## Board');
    for (const p of d.board.items) lines.push(`- ${p.role}: ${p.name}`);
  }

  if (d.news.items.length) {
    lines.push('', '## News');
    for (const n of d.news.items.slice(0, 6)) {
      lines.push(`- (${n.minutesAgo}m) ${n.source}: ${n.headline}`);
    }
  }

  if (d.events.items.length) {
    lines.push('', '## Events');
    for (const e of d.events.items) lines.push(`- ${e.date} — ${e.title}`);
  }

  if (d.options.items.length) {
    lines.push('', '## Options (front month, IV%)');
    lines.push(
      d.options.items
        .map((o) => `${o.strike.toFixed(0)} @ ${o.iv.toFixed(1)}%`)
        .join(' · '),
    );
  }

  if (d.balanceSheet.items.length) {
    lines.push('', '## Balance');
    for (const b of d.balanceSheet.items) {
      lines.push(`- ${b.label} (${b.tone}): $${b.value.toFixed(2)}B`);
    }
  }

  return lines.join('\n');
}

export function summariseRmap(d: RmapData): string {
  return `${d.center.ticker} ${d.center.price.toFixed(2)} (${pct(d.center.changePct)}) · ${d.peers.items.length} peers · ${d.holders.items.length} holders · ${d.news.items.length} news`;
}
