/**
 * Mock data generator for the Bloomberg-style GIP (Intraday Graph) function.
 *
 * Produces a deterministic 1-day intraday OHLCV series for any ticker at any
 * of the supported bar intervals (1m through 60m).  Bars are tagged with
 * their trading session (pre-market / regular / after-hours) so both the UI
 * and the agent-text output can highlight extended-hours activity.
 *
 * Real Bloomberg GIP pulls tick-level data from BPIPE; when that plumbing
 * is wired in this generator is the single point of replacement.
 */

export type GipInterval = '1m' | '5m' | '15m' | '30m' | '60m';

export type Session = 'pre' | 'regular' | 'after';

/** Lightweight-charts 5.x time type — seconds since unix epoch */
export type UnixSeconds = number;

export interface GipBar {
  time: UnixSeconds;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  session: Session;
}

export interface GipCenter {
  ticker: string;
  name: string;
  exchange: string;
  currency: string;
  tickSize: number;
  prevClose: number;
  avgDailyVolumeM: number;
}

export interface GipQuote {
  last: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  dayVolume: number;
  change: number;
  changePct: number;
  vwap: number;
  tradeCount: number;
  /** Wall-clock time of the latest tick, UTC seconds */
  asOf: UnixSeconds;
}

export interface GipData {
  center: GipCenter;
  interval: GipInterval;
  bars: GipBar[];
  quote: GipQuote;
  extendedHours: boolean;
  /** ISO date string of the trading day represented (yyyy-mm-dd, US/Eastern). */
  tradingDate: string;
}

/* ----------------------------- deterministic RNG ------------------------- */

function makeRng(seed: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  // Box–Muller
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ----------------------------- tickers universe -------------------------- */

const CENTER_DIRECTORY: Record<
  string,
  Omit<GipCenter, 'ticker'> & { atrPctDaily: number; beta: number }
> = {
  AAPL:  { name: 'Apple Inc',           exchange: 'NASDAQ', currency: 'USD', tickSize: 0.01, prevClose: 226.78, avgDailyVolumeM:  58.1, atrPctDaily: 0.012, beta: 1.12 },
  MSFT:  { name: 'Microsoft Corp',      exchange: 'NASDAQ', currency: 'USD', tickSize: 0.01, prevClose: 427.15, avgDailyVolumeM:  21.3, atrPctDaily: 0.010, beta: 0.95 },
  GOOGL: { name: 'Alphabet Inc',        exchange: 'NASDAQ', currency: 'USD', tickSize: 0.01, prevClose: 174.02, avgDailyVolumeM:  28.4, atrPctDaily: 0.014, beta: 1.05 },
  META:  { name: 'Meta Platforms',      exchange: 'NASDAQ', currency: 'USD', tickSize: 0.01, prevClose: 521.33, avgDailyVolumeM:  15.9, atrPctDaily: 0.018, beta: 1.25 },
  AMZN:  { name: 'Amazon.com',          exchange: 'NASDAQ', currency: 'USD', tickSize: 0.01, prevClose: 191.46, avgDailyVolumeM:  45.2, atrPctDaily: 0.015, beta: 1.15 },
  NVDA:  { name: 'NVIDIA Corp',         exchange: 'NASDAQ', currency: 'USD', tickSize: 0.01, prevClose: 118.27, avgDailyVolumeM: 260.0, atrPctDaily: 0.030, beta: 1.75 },
  TSLA:  { name: 'Tesla Inc',           exchange: 'NASDAQ', currency: 'USD', tickSize: 0.01, prevClose: 248.19, avgDailyVolumeM: 110.4, atrPctDaily: 0.035, beta: 2.10 },
  TSM:   { name: 'Taiwan Semiconductor',exchange: 'NYSE',   currency: 'USD', tickSize: 0.01, prevClose: 172.50, avgDailyVolumeM:  12.7, atrPctDaily: 0.018, beta: 1.20 },
  SPY:   { name: 'SPDR S&P 500 ETF',    exchange: 'NYSE',   currency: 'USD', tickSize: 0.01, prevClose: 560.20, avgDailyVolumeM:  80.0, atrPctDaily: 0.008, beta: 1.00 },
  QQQ:   { name: 'Invesco QQQ',         exchange: 'NASDAQ', currency: 'USD', tickSize: 0.01, prevClose: 485.30, avgDailyVolumeM:  50.0, atrPctDaily: 0.011, beta: 1.10 },
  AVGO:  { name: 'Broadcom Inc',        exchange: 'NASDAQ', currency: 'USD', tickSize: 0.01, prevClose: 170.00, avgDailyVolumeM:  30.0, atrPctDaily: 0.017, beta: 1.35 },
  NFLX:  { name: 'Netflix Inc',         exchange: 'NASDAQ', currency: 'USD', tickSize: 0.01, prevClose: 680.00, avgDailyVolumeM:   4.8, atrPctDaily: 0.022, beta: 1.30 },
  JPM:   { name: 'JPMorgan Chase',      exchange: 'NYSE',   currency: 'USD', tickSize: 0.01, prevClose: 210.00, avgDailyVolumeM:   9.2, atrPctDaily: 0.010, beta: 1.15 },
  XOM:   { name: 'Exxon Mobil',         exchange: 'NYSE',   currency: 'USD', tickSize: 0.01, prevClose: 118.00, avgDailyVolumeM:  14.0, atrPctDaily: 0.012, beta: 0.80 },
};

function getOrSynthCenter(ticker: string, rng: () => number): GipCenter & { atrPctDaily: number; beta: number } {
  const known = CENTER_DIRECTORY[ticker];
  if (known) return { ticker, ...known };
  return {
    ticker,
    name: `${ticker} Inc`,
    exchange: rng() < 0.5 ? 'NYSE' : 'NASDAQ',
    currency: 'USD',
    tickSize: 0.01,
    prevClose: Number((15 + rng() * 400).toFixed(2)),
    avgDailyVolumeM: Number((1 + rng() * 60).toFixed(1)),
    atrPctDaily: 0.012 + rng() * 0.025,
    beta: 0.7 + rng() * 1.4,
  };
}

/* ------------------------------ time helpers ----------------------------- */

const INTERVAL_MINUTES: Record<GipInterval, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '60m': 60,
};

/** Regular session 09:30-16:00 US/Eastern = 13:30-20:00 UTC (ignoring DST). */
const REGULAR_START_UTC_HOURS = 13.5;
const REGULAR_END_UTC_HOURS = 20;
const PREMARKET_START_UTC_HOURS = 8;    // 04:00 ET
const AFTERHOURS_END_UTC_HOURS = 24;    // 20:00 ET = 00:00 UTC next day

/** Returns yyyy-mm-dd for the most recent weekday at UTC midnight for determinism. */
function mostRecentWeekday(seed: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  // Find the most recent weekday (treat Sat/Sun as previous Friday).
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  if (seed) d.setUTCDate(d.getUTCDate() - (seed % 5));
  return d.toISOString().slice(0, 10);
}

function barsForSession(tradingDateIso: string, interval: GipInterval, extendedHours: boolean) {
  const step = INTERVAL_MINUTES[interval] * 60; // seconds
  const base = Math.floor(new Date(`${tradingDateIso}T00:00:00Z`).getTime() / 1000);
  const startHours = extendedHours ? PREMARKET_START_UTC_HOURS : REGULAR_START_UTC_HOURS;
  const endHours = extendedHours ? AFTERHOURS_END_UTC_HOURS : REGULAR_END_UTC_HOURS;
  const startTs = base + Math.floor(startHours * 3600);
  const endTs = base + Math.floor(endHours * 3600);
  const times: { time: UnixSeconds; session: Session }[] = [];
  for (let t = startTs; t < endTs; t += step) {
    const hoursIntoDay = (t - base) / 3600;
    let session: Session;
    if (hoursIntoDay < REGULAR_START_UTC_HOURS) session = 'pre';
    else if (hoursIntoDay >= REGULAR_END_UTC_HOURS) session = 'after';
    else session = 'regular';
    times.push({ time: t, session });
  }
  return times;
}

/* ------------------------------- main API -------------------------------- */

export interface GipInput {
  ticker: string;
  interval?: GipInterval;
  extendedHours?: boolean;
  seedSalt?: number;
}

function round(value: number, tickSize: number): number {
  return Math.round(value / tickSize) * tickSize;
}

export function generateGipData(input: GipInput): GipData {
  const ticker = (input.ticker || 'AAPL').trim().toUpperCase() || 'AAPL';
  const interval = input.interval ?? '5m';
  const extendedHours = input.extendedHours ?? true;
  const salt = input.seedSalt ?? 0;

  const rng = makeRng(`gip:${ticker}:${interval}:${extendedHours ? 1 : 0}:${salt}`);
  const center = getOrSynthCenter(ticker, rng);

  const tradingDate = mostRecentWeekday(salt);
  const times = barsForSession(tradingDate, interval, extendedHours);

  // Daily-scale parameters.  ATR% of prevClose defines how wildly the name moves.
  const atrAbs = center.prevClose * center.atrPctDaily;
  const driftPctDay = (rng() - 0.5) * 0.012; // ±0.6% total drift across the day
  const totalRegularBars = barsForSession(tradingDate, interval, false).length;
  const perBarSigma = atrAbs / Math.sqrt(Math.max(1, totalRegularBars)) * 0.85;
  const perBarDrift = (driftPctDay * center.prevClose) / Math.max(1, totalRegularBars);

  // Rare overnight gap.
  const gap = (rng() - 0.5) * 0.004 * center.prevClose;

  // Build 1-minute walk first, rolled up to the interval.  This keeps OHLC
  // coherent (high >= max(open, close), low <= min(open, close)).
  const stepMin = INTERVAL_MINUTES[interval];
  const noiseScale = perBarSigma * Math.sqrt(stepMin) * 0.35;

  let price = center.prevClose + gap;
  let cumPV = 0; // sum of price * volume
  let cumVol = 0;

  const bars: GipBar[] = [];

  for (let i = 0; i < times.length; i += 1) {
    const { time, session } = times[i];
    const open = price;

    // Intrabar drift: regular session carries most of the movement.
    const sessionWeight = session === 'regular' ? 1.0 : session === 'pre' ? 0.35 : 0.55;
    const drift = perBarDrift * sessionWeight;
    const sigma = perBarSigma * sessionWeight;

    // Subdivide the bar into 5 ticks to get realistic H/L.
    let high = open;
    let low = open;
    let close = open;
    const subTicks = 5;
    for (let k = 0; k < subTicks; k += 1) {
      close = close + drift / subTicks + gaussian(rng) * sigma * 0.55;
      if (close > high) high = close;
      if (close < low) low = close;
    }
    // Add a small extra noise to the wicks.
    high += Math.abs(gaussian(rng)) * noiseScale;
    low -= Math.abs(gaussian(rng)) * noiseScale;
    if (high < Math.max(open, close)) high = Math.max(open, close);
    if (low > Math.min(open, close)) low = Math.min(open, close);

    // Volume U-shape around regular session with lower extended-hours prints.
    const regularFraction =
      session === 'regular'
        ? (() => {
            const idx = bars.filter((b) => b.session === 'regular').length;
            const total = Math.max(1, totalRegularBars);
            const t = idx / total;
            return 0.6 + Math.pow(2 * t - 1, 2) * 1.6; // U-shape
          })()
        : session === 'pre'
          ? 0.18
          : 0.28;
    const avgPerBar = (center.avgDailyVolumeM * 1_000_000) / Math.max(1, totalRegularBars);
    const volume = Math.max(
      100,
      Math.round(avgPerBar * regularFraction * (0.75 + rng() * 0.5)),
    );

    cumVol += volume;
    const typicalPrice = (high + low + close) / 3;
    cumPV += typicalPrice * volume;
    const vwap = cumPV / Math.max(1, cumVol);

    bars.push({
      time,
      open: round(open, center.tickSize),
      high: round(high, center.tickSize),
      low: round(low, center.tickSize),
      close: round(close, center.tickSize),
      volume,
      vwap: round(vwap, center.tickSize),
      session,
    });

    price = close;
  }

  const regularBars = bars.filter((b) => b.session === 'regular');
  const dayBars = regularBars.length ? regularBars : bars;
  const dayOpen = dayBars[0]?.open ?? center.prevClose;
  const dayHigh = dayBars.reduce((m, b) => Math.max(m, b.high), -Infinity);
  const dayLow = dayBars.reduce((m, b) => Math.min(m, b.low), Infinity);
  const dayVolume = dayBars.reduce((s, b) => s + b.volume, 0);
  const last = bars[bars.length - 1]?.close ?? center.prevClose;
  const change = last - center.prevClose;
  const changePct = (change / center.prevClose) * 100;

  // Synthesize a plausible top-of-book spread based on tick size.
  const spread = Math.max(center.tickSize, center.tickSize * Math.round(1 + rng() * 3));
  const quote: GipQuote = {
    last: round(last, center.tickSize),
    bid: round(last - spread / 2, center.tickSize),
    ask: round(last + spread / 2, center.tickSize),
    bidSize: 100 + Math.floor(rng() * 9900),
    askSize: 100 + Math.floor(rng() * 9900),
    dayOpen,
    dayHigh,
    dayLow,
    dayVolume,
    change: round(change, center.tickSize),
    changePct: Number(changePct.toFixed(3)),
    vwap: bars[bars.length - 1]?.vwap ?? dayOpen,
    tradeCount: Math.round(dayVolume / (50 + rng() * 150)),
    asOf: bars[bars.length - 1]?.time ?? Math.floor(Date.now() / 1000),
  };

  return {
    center: {
      ticker: center.ticker,
      name: center.name,
      exchange: center.exchange,
      currency: center.currency,
      tickSize: center.tickSize,
      prevClose: center.prevClose,
      avgDailyVolumeM: center.avgDailyVolumeM,
    },
    interval,
    bars,
    quote,
    extendedHours,
    tradingDate,
  };
}
