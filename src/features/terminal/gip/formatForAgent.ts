/**
 * GIP → plain-text formatter for LLM / quant-agent consumption.
 *
 * Keeps the payload compact by summarising the tape rather than dumping
 * every bar: an agent typically wants *shape* and *notable events*, not a
 * wall of OHLCV rows.  If bar-level detail is required, the structured
 * `GipData` object is always available on the tool's fetch output.
 */

import type { GipBar, GipData } from './mockData';

function fmt(n: number, d = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtVol(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function signed(n: number, d = 2): string {
  return n > 0 ? `+${n.toFixed(d)}` : n.toFixed(d);
}

function hhmm(ts: number): string {
  const d = new Date(ts * 1000);
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mm = d.getUTCMinutes().toString().padStart(2, '0');
  return `${hh}:${mm} UTC`;
}

/** True-range-based realised volatility estimate (annualised-free). */
function realizedRange(bars: GipBar[]): number {
  if (bars.length < 2) return 0;
  let sumSq = 0;
  for (let i = 1; i < bars.length; i += 1) {
    const prev = bars[i - 1].close;
    const ret = Math.log(bars[i].close / prev);
    sumSq += ret * ret;
  }
  return Math.sqrt(sumSq);
}

function findLargestMove(bars: GipBar[]): { from: GipBar; to: GipBar; retPct: number } | null {
  if (bars.length < 2) return null;
  let best = { fromIdx: 0, toIdx: 0, diff: 0 };
  // Scan adjacent bars (1-bar moves).  O(n) and fast enough.
  for (let i = 1; i < bars.length; i += 1) {
    const diff = bars[i].close - bars[i - 1].close;
    if (Math.abs(diff) > Math.abs(best.diff)) {
      best = { fromIdx: i - 1, toIdx: i, diff };
    }
  }
  const from = bars[best.fromIdx];
  const to = bars[best.toIdx];
  return { from, to, retPct: (to.close / from.close - 1) * 100 };
}

export function formatGipForAgent(data: GipData): string {
  const { center, bars, quote, interval, extendedHours, tradingDate } = data;

  const regularBars = bars.filter((b) => b.session === 'regular');
  const preBars = bars.filter((b) => b.session === 'pre');
  const afterBars = bars.filter((b) => b.session === 'after');
  const rrv = realizedRange(regularBars) * 100; // %
  const move = findLargestMove(bars);

  // Volume vs ADV
  const advShares = center.avgDailyVolumeM * 1_000_000;
  const advPct = (quote.dayVolume / Math.max(1, advShares)) * 100;

  // Build a compact sparkline-ish summary every ~5 bars for the agent to reason over.
  const sparkStep = Math.max(1, Math.ceil(bars.length / 24));
  const spark = bars.filter((_, i) => i % sparkStep === 0 || i === bars.length - 1);

  const out: string[] = [];
  out.push(`# GIP — Intraday Price | ${center.ticker}`);
  out.push(`> Generated: ${new Date().toISOString()}`);
  out.push(`> Trading date: ${tradingDate} · Interval: ${interval} · Extended hours: ${extendedHours ? 'on' : 'off'}`);
  out.push('> Source: fyer-terminal mock (deterministic). Replace with BPIPE/Polygon/IEX feed when available.');
  out.push('');

  out.push('## Focal Instrument');
  out.push(`- Ticker: ${center.ticker}`);
  out.push(`- Name: ${center.name}`);
  out.push(`- Exchange: ${center.exchange} (${center.currency})`);
  out.push(`- Tick size: ${center.tickSize}`);
  out.push(`- Prev Close: $${center.prevClose.toFixed(2)}`);
  out.push(`- ADV (shares): ${fmtVol(advShares)}`);
  out.push('');

  out.push('## Quote Snapshot');
  out.push(`- Last: $${fmt(quote.last)} (${signed(quote.change)} / ${signed(quote.changePct)}%)`);
  out.push(`- Bid / Ask: $${fmt(quote.bid)} x${quote.bidSize.toLocaleString()} / $${fmt(quote.ask)} x${quote.askSize.toLocaleString()}  (spread ${fmt(quote.ask - quote.bid)})`);
  out.push(`- Session OHLC: O $${fmt(quote.dayOpen)} · H $${fmt(quote.dayHigh)} · L $${fmt(quote.dayLow)} · C $${fmt(quote.last)}`);
  out.push(`- Day Range: ${fmt(quote.dayHigh - quote.dayLow)} (${fmt(((quote.dayHigh - quote.dayLow) / center.prevClose) * 100)}% of prev close)`);
  out.push(`- VWAP: $${fmt(quote.vwap)} — last trades ${quote.last >= quote.vwap ? 'above' : 'below'} VWAP`);
  out.push(`- Volume: ${fmtVol(quote.dayVolume)} shares  (${advPct.toFixed(1)}% of ADV)`);
  out.push(`- Trade count: ${fmtVol(quote.tradeCount)}`);
  out.push('');

  out.push('## Session Breakdown');
  if (preBars.length) {
    const preVol = preBars.reduce((s, b) => s + b.volume, 0);
    const preOpen = preBars[0].open;
    const preClose = preBars[preBars.length - 1].close;
    out.push(`- Pre-market: ${preBars.length} bars · ${fmtVol(preVol)} shares · ${signed(((preClose / preOpen - 1) * 100))}% move`);
  } else {
    out.push('- Pre-market: not included');
  }
  if (regularBars.length) {
    const regVol = regularBars.reduce((s, b) => s + b.volume, 0);
    const regOpen = regularBars[0].open;
    const regClose = regularBars[regularBars.length - 1].close;
    out.push(`- Regular: ${regularBars.length} bars · ${fmtVol(regVol)} shares · ${signed(((regClose / regOpen - 1) * 100))}% move`);
  }
  if (afterBars.length) {
    const afterVol = afterBars.reduce((s, b) => s + b.volume, 0);
    const afterOpen = afterBars[0].open;
    const afterClose = afterBars[afterBars.length - 1].close;
    out.push(`- After-hours: ${afterBars.length} bars · ${fmtVol(afterVol)} shares · ${signed(((afterClose / afterOpen - 1) * 100))}% move`);
  } else {
    out.push('- After-hours: not included');
  }
  out.push('');

  out.push('## Statistics');
  out.push(`- Realized Range (∑|log-returns|²)½: ${rrv.toFixed(2)}%`);
  if (move) {
    out.push(`- Largest single-bar move: ${signed(move.retPct)}% between ${hhmm(move.from.time)} and ${hhmm(move.to.time)} ($${fmt(move.from.close)} → $${fmt(move.to.close)})`);
  }
  const maxVolBar = [...bars].sort((a, b) => b.volume - a.volume)[0];
  if (maxVolBar) {
    out.push(`- Heaviest volume bar: ${hhmm(maxVolBar.time)} — ${fmtVol(maxVolBar.volume)} shares @ $${fmt(maxVolBar.close)}`);
  }
  out.push('');

  // Compact sparkline table — agent can eyeball the shape
  out.push(`## Sample Bars (every ~${sparkStep}, last inclusive)`);
  out.push('| Time (UTC) | Session | O | H | L | C | Vol | VWAP |');
  out.push('|-----------|---------|---|---|---|---|-----|------|');
  for (const b of spark) {
    out.push(
      `| ${hhmm(b.time)} | ${b.session} | ${fmt(b.open)} | ${fmt(b.high)} | ${fmt(b.low)} | ${fmt(b.close)} | ${fmtVol(b.volume)} | ${fmt(b.vwap)} |`,
    );
  }
  out.push('');

  out.push('## Agent Notes');
  const notes: string[] = [];
  if (Math.abs(quote.changePct) > 4) notes.push(`Notable daily move of ${signed(quote.changePct)}%.`);
  if (advPct > 200) notes.push(`Unusual volume — ${advPct.toFixed(0)}% of 30-day ADV.`);
  else if (advPct > 130) notes.push(`Elevated volume — ${advPct.toFixed(0)}% of ADV.`);
  if (quote.last < quote.vwap - 0.002 * center.prevClose) notes.push('Tape is trading below VWAP — intraday buyers underwater.');
  else if (quote.last > quote.vwap + 0.002 * center.prevClose) notes.push('Tape is trading above VWAP — intraday buyers in profit.');
  if (afterBars.length) {
    const aClose = afterBars[afterBars.length - 1].close;
    const regClose = regularBars.length ? regularBars[regularBars.length - 1].close : center.prevClose;
    const delta = ((aClose / regClose - 1) * 100);
    if (Math.abs(delta) > 1) notes.push(`Meaningful after-hours drift of ${signed(delta)}% vs regular close.`);
  }
  if (!notes.length) notes.push('No unusual intraday pattern detected relative to recent averages.');
  notes.forEach((n) => out.push(`- ${n}`));

  return out.join('\n');
}

export function summariseGip(data: GipData): string {
  const q = data.quote;
  return `GIP ${data.center.ticker} ${data.interval}: Last $${q.last.toFixed(2)} (${q.change >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%). Vol ${fmtVol(q.dayVolume)} (${((q.dayVolume / (data.center.avgDailyVolumeM * 1_000_000)) * 100).toFixed(0)}% ADV). Range $${q.dayLow.toFixed(2)}-$${q.dayHigh.toFixed(2)}. VWAP $${q.vwap.toFixed(2)}.`;
}
