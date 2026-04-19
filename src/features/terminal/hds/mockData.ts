/**
 * Mock data generator for the Bloomberg-style HDS (Holdings Detail) function.
 *
 * HDS shows every reporting holder of an equity — mutual funds, ETFs,
 * institutions, hedge funds, insiders, and sovereigns — with position size,
 * percent-of-outstanding, change vs prior filing, market value, filing
 * source, and portfolio weight.  This module produces deterministic mock
 * data shaped exactly like the real 13F / NPORT / Form-4 feeds will, so the
 * UI, agents, and downstream consumers can be developed against a stable
 * contract.
 */

export type HolderType =
  | 'Institution'
  | 'Mutual Fund'
  | 'ETF'
  | 'Hedge Fund'
  | 'Insider'
  | 'Individual'
  | 'Sovereign Wealth'
  | 'Pension';

export type FilingSource = '13F' | '13G' | '13D' | 'NPORT' | 'Form 4' | 'S-Beneficial' | 'Fund Report';

export type HolderStatus = 'New' | 'Increased' | 'Decreased' | 'Unchanged' | 'Sold Out';

export interface Holder {
  id: string;
  name: string;
  type: HolderType;
  country: string;
  source: FilingSource;
  /** Shares in millions */
  positionSharesM: number;
  /** Percent of shares outstanding */
  pctOut: number;
  /** Change in shares since prior filing (M) */
  changeSharesM: number;
  /** Change as % of prior position */
  changePct: number;
  /** Filing / as-of date */
  positionDate: string;
  /** Market value of the position in $MM (at the focal firm's latest price) */
  marketValueMm: number;
  /** % of this holder's overall portfolio this position represents */
  portfolioPct: number;
  status: HolderStatus;
}

export interface HdsCenter {
  ticker: string;
  name: string;
  country: string;
  industry: string;
  price: number;
  marketCapB: number;
  sharesOutstandingM: number;
  floatPctOfOut: number;
}

export interface HdsSummary {
  institutionalPct: number;
  mutualFundPct: number;
  etfPct: number;
  hedgeFundPct: number;
  insiderPct: number;
  top10Pct: number;
  holderCount: number;
  holderCountDeltaQoq: number;
  shortInterestPct: number;
  daysToCover: number;
  avgDailyVolumeM: number;
  floatTurnoverDays: number;
}

export interface HdsData {
  asOf: string;
  center: HdsCenter;
  summary: HdsSummary;
  holders: Holder[];
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

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/* --------------------------- curated universe ---------------------------- */

/** Real-world top institutional / fund managers — used to make the table look authentic. */
const TOP_INSTITUTIONS: { name: string; type: HolderType; country: string }[] = [
  { name: 'The Vanguard Group',                    type: 'Institution',     country: 'US' },
  { name: 'BlackRock Inc',                         type: 'Institution',     country: 'US' },
  { name: 'State Street Corp',                     type: 'Institution',     country: 'US' },
  { name: 'Fidelity Management & Research',        type: 'Institution',     country: 'US' },
  { name: 'Geode Capital Management',              type: 'Institution',     country: 'US' },
  { name: 'T. Rowe Price Associates',              type: 'Institution',     country: 'US' },
  { name: 'Capital Research & Management (World)', type: 'Institution',     country: 'US' },
  { name: 'Northern Trust Investments',            type: 'Institution',     country: 'US' },
  { name: 'Morgan Stanley Investment Mgmt',        type: 'Institution',     country: 'US' },
  { name: 'JPMorgan Asset Management',             type: 'Institution',     country: 'US' },
  { name: 'Bank of America Securities',            type: 'Institution',     country: 'US' },
  { name: 'Wellington Management',                 type: 'Institution',     country: 'US' },
  { name: 'Norges Bank Investment Management',     type: 'Sovereign Wealth',country: 'NO' },
  { name: 'GIC Private Ltd',                       type: 'Sovereign Wealth',country: 'SG' },
  { name: 'Abu Dhabi Investment Authority',        type: 'Sovereign Wealth',country: 'AE' },
  { name: 'CalPERS',                               type: 'Pension',         country: 'US' },
  { name: 'Ontario Teachers Pension Plan',         type: 'Pension',         country: 'CA' },
];

const ETFS: { name: string; type: HolderType; country: string }[] = [
  { name: 'Vanguard Total Stock Market ETF (VTI)',    type: 'ETF', country: 'US' },
  { name: 'Vanguard S&P 500 ETF (VOO)',                type: 'ETF', country: 'US' },
  { name: 'SPDR S&P 500 ETF (SPY)',                    type: 'ETF', country: 'US' },
  { name: 'iShares Core S&P 500 (IVV)',                type: 'ETF', country: 'US' },
  { name: 'Invesco QQQ Trust',                         type: 'ETF', country: 'US' },
  { name: 'Vanguard Growth ETF (VUG)',                 type: 'ETF', country: 'US' },
  { name: 'iShares Russell 1000 Growth (IWF)',         type: 'ETF', country: 'US' },
];

const MUTUAL_FUNDS: { name: string; type: HolderType; country: string }[] = [
  { name: 'Fidelity Contrafund',                      type: 'Mutual Fund', country: 'US' },
  { name: 'American Funds Growth Fund of America',    type: 'Mutual Fund', country: 'US' },
  { name: 'Vanguard 500 Index Fund',                  type: 'Mutual Fund', country: 'US' },
  { name: 'T. Rowe Price Blue Chip Growth',           type: 'Mutual Fund', country: 'US' },
  { name: 'Dodge & Cox Stock Fund',                   type: 'Mutual Fund', country: 'US' },
  { name: 'Fidelity Magellan',                        type: 'Mutual Fund', country: 'US' },
];

const HEDGE_FUNDS: { name: string; type: HolderType; country: string }[] = [
  { name: 'Citadel Advisors',                         type: 'Hedge Fund',  country: 'US' },
  { name: 'Renaissance Technologies',                 type: 'Hedge Fund',  country: 'US' },
  { name: 'Bridgewater Associates',                   type: 'Hedge Fund',  country: 'US' },
  { name: 'Two Sigma Investments',                    type: 'Hedge Fund',  country: 'US' },
  { name: 'Millennium Management',                    type: 'Hedge Fund',  country: 'US' },
  { name: 'Point72 Asset Management',                 type: 'Hedge Fund',  country: 'US' },
  { name: 'D.E. Shaw & Co',                           type: 'Hedge Fund',  country: 'US' },
  { name: 'Tiger Global Management',                  type: 'Hedge Fund',  country: 'US' },
  { name: 'Coatue Management',                        type: 'Hedge Fund',  country: 'US' },
];

/* ---------------------------- focal companies ---------------------------- */

const CENTER_DIRECTORY: Record<string, HdsCenter> = {
  AAPL:  { ticker: 'AAPL',  name: 'Apple Inc',          country: 'US', industry: 'Consumer Electronics', price: 226.78, marketCapB: 3450, sharesOutstandingM: 15204, floatPctOfOut: 99.9 },
  MSFT:  { ticker: 'MSFT',  name: 'Microsoft Corp',     country: 'US', industry: 'Software',             price: 427.15, marketCapB: 3180, sharesOutstandingM:  7430, floatPctOfOut: 99.9 },
  GOOGL: { ticker: 'GOOGL', name: 'Alphabet Inc',       country: 'US', industry: 'Internet',             price: 174.02, marketCapB: 2150, sharesOutstandingM: 12360, floatPctOfOut: 87.0 },
  META:  { ticker: 'META',  name: 'Meta Platforms',     country: 'US', industry: 'Internet',             price: 521.33, marketCapB: 1320, sharesOutstandingM:  2533, floatPctOfOut: 87.8 },
  AMZN:  { ticker: 'AMZN',  name: 'Amazon.com',         country: 'US', industry: 'E-commerce',           price: 191.46, marketCapB: 1990, sharesOutstandingM: 10394, floatPctOfOut: 89.8 },
  NVDA:  { ticker: 'NVDA',  name: 'NVIDIA Corp',        country: 'US', industry: 'Semiconductors',       price: 118.27, marketCapB: 2910, sharesOutstandingM: 24600, floatPctOfOut: 95.8 },
  TSLA:  { ticker: 'TSLA',  name: 'Tesla Inc',          country: 'US', industry: 'Auto Manufacturer',    price: 248.19, marketCapB:  790, sharesOutstandingM:  3183, floatPctOfOut: 86.7 },
  TSM:   { ticker: 'TSM',   name: 'Taiwan Semiconductor', country: 'TW', industry: 'Semiconductors',     price: 172.50, marketCapB:  900, sharesOutstandingM:  5194, floatPctOfOut: 99.0 },
  NFLX:  { ticker: 'NFLX',  name: 'Netflix Inc',        country: 'US', industry: 'Streaming',            price: 680.00, marketCapB:  294, sharesOutstandingM:   432, floatPctOfOut: 99.0 },
  AVGO:  { ticker: 'AVGO',  name: 'Broadcom Inc',       country: 'US', industry: 'Semiconductors',       price: 170.00, marketCapB:  790, sharesOutstandingM:  4650, floatPctOfOut: 98.0 },
};

/** "Shape" of the holder base keyed by focal firm type */
interface CenterShape {
  instShare: number;  // % of shares held by long-only institutions
  etfShare: number;
  mfShare: number;
  hfShare: number;
  insiderShare: number;
  shortInterestPct: number;
}

const DEFAULT_SHAPE: CenterShape = { instShare: 42, etfShare: 18, mfShare: 12, hfShare: 5, insiderShare: 0.1, shortInterestPct: 1.2 };

const CENTER_SHAPES: Record<string, CenterShape> = {
  AAPL:  { instShare: 43, etfShare: 19, mfShare: 14, hfShare: 3.5, insiderShare: 0.07, shortInterestPct: 0.85 },
  MSFT:  { instShare: 48, etfShare: 18, mfShare: 13, hfShare: 3.0, insiderShare: 0.05, shortInterestPct: 0.72 },
  NVDA:  { instShare: 45, etfShare: 20, mfShare: 14, hfShare: 6.0, insiderShare: 4.2,  shortInterestPct: 1.10 },
  TSLA:  { instShare: 30, etfShare: 14, mfShare:  9, hfShare: 8.0, insiderShare: 12.9, shortInterestPct: 3.30 },
  META:  { instShare: 40, etfShare: 15, mfShare: 11, hfShare: 5.5, insiderShare: 13.5, shortInterestPct: 1.40 },
  GOOGL: { instShare: 42, etfShare: 16, mfShare: 12, hfShare: 5.0, insiderShare: 11.8, shortInterestPct: 0.90 },
  AMZN:  { instShare: 44, etfShare: 18, mfShare: 13, hfShare: 5.0, insiderShare:  9.1, shortInterestPct: 0.95 },
};

/* ---------------------- synthesis helpers -------------------------------- */

function synthCenter(ticker: string, rng: () => number): HdsCenter {
  return {
    ticker,
    name: `${ticker} Inc`,
    country: pick(rng, ['US', 'CA', 'DE', 'GB', 'JP'] as const),
    industry: pick(rng, ['Software', 'Industrials', 'Consumer Goods', 'Financials', 'Healthcare'] as const),
    price: Number((20 + rng() * 400).toFixed(2)),
    marketCapB: Number((5 + rng() * 500).toFixed(1)),
    sharesOutstandingM: Number((100 + rng() * 4000).toFixed(0)),
    floatPctOfOut: Number((80 + rng() * 18).toFixed(1)),
  };
}

function insiderNames(ticker: string): string[] {
  const map: Record<string, string[]> = {
    AAPL:  ['Tim Cook', 'Luca Maestri', 'Jeff Williams', 'Katherine Adams', 'Arthur Levinson'],
    MSFT:  ['Satya Nadella', 'Brad Smith', 'Amy Hood', 'Bradford Smith'],
    NVDA:  ['Jen-Hsun Huang', 'Colette Kress', 'Tench Coxe', 'Mark Stevens'],
    TSLA:  ['Elon Musk', 'Vaibhav Taneja', 'Robyn Denholm', 'Kimbal Musk', 'James Murdoch'],
    META:  ['Mark Zuckerberg', 'Susan Li', 'David Wehner', 'Peggy Alford', 'Andrew Bosworth'],
    GOOGL: ['Sundar Pichai', 'Ruth Porat', 'Larry Page', 'Sergey Brin', 'John Hennessy'],
    AMZN:  ['Andy Jassy', 'Brian Olsavsky', 'Jeff Bezos', 'Andrew Jassy'],
    NFLX:  ['Ted Sarandos', 'Spencer Neumann', 'Reed Hastings'],
    AVGO:  ['Hock Tan', 'Kirsten Spears', 'Charlie Kawwas'],
  };
  return map[ticker] ?? ['CEO', 'CFO', 'COO', 'Chair', 'Director'];
}

function skewedSplit(rng: () => number, total: number, count: number, skew = 1.8): number[] {
  // Produces `count` positive weights summing to `total` with heavier top-of-list.
  const weights: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const rank = i + 1;
    weights.push((1 / Math.pow(rank, skew)) * (0.6 + rng() * 0.4));
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (w / sum) * total);
}

function daysAgoIso(rng: () => number, max = 95, min = 8): string {
  const days = Math.floor(min + rng() * (max - min));
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().slice(0, 10);
}

function statusFromChange(rng: () => number, changePct: number, newHolder: boolean): HolderStatus {
  if (newHolder) return 'New';
  if (changePct <= -99) return 'Sold Out';
  if (changePct > 1) return 'Increased';
  if (changePct < -1) return 'Decreased';
  if (rng() < 0.15) return rng() < 0.5 ? 'Increased' : 'Decreased';
  return 'Unchanged';
}

function sourceFor(type: HolderType, rng: () => number): FilingSource {
  switch (type) {
    case 'ETF':
    case 'Mutual Fund':
      return 'NPORT';
    case 'Insider':
      return 'Form 4';
    case 'Institution':
    case 'Pension':
    case 'Sovereign Wealth':
      return rng() < 0.8 ? '13F' : '13G';
    case 'Hedge Fund':
      return rng() < 0.7 ? '13F' : '13D';
    default:
      return 'S-Beneficial';
  }
}

/* ------------------------------- main api -------------------------------- */

export interface HdsInput {
  ticker: string;
  /** Refresh salt — the same ticker + salt yields the same data. */
  seedSalt?: number;
}

export function generateHdsData(input: HdsInput): HdsData {
  const ticker = (input.ticker || 'AAPL').trim().toUpperCase() || 'AAPL';
  const salt = input.seedSalt ?? 0;
  const rng = makeRng(`hds:${ticker}:${salt}`);

  const center = CENTER_DIRECTORY[ticker] ?? synthCenter(ticker, rng);
  const shape = CENTER_SHAPES[ticker] ?? DEFAULT_SHAPE;

  const so = center.sharesOutstandingM;

  const instSharesTotal = (shape.instShare / 100) * so;
  const etfSharesTotal = (shape.etfShare / 100) * so;
  const mfSharesTotal = (shape.mfShare / 100) * so;
  const hfSharesTotal = (shape.hfShare / 100) * so;
  const insiderSharesTotal = (shape.insiderShare / 100) * so;

  // How many holders to synthesise per bucket.  Bloomberg shows up to ~4k;
  // we emit a healthy but bounded list.
  const N_INST = 14;
  const N_ETF = 7;
  const N_MF = 6;
  const N_HF = 8;
  const N_INSIDER = 5;

  const instWeights = skewedSplit(rng, instSharesTotal, N_INST, 1.25);
  const etfWeights = skewedSplit(rng, etfSharesTotal, N_ETF, 1.35);
  const mfWeights = skewedSplit(rng, mfSharesTotal, N_MF, 1.4);
  const hfWeights = skewedSplit(rng, hfSharesTotal, N_HF, 1.7);
  const insiderWeights = skewedSplit(rng, insiderSharesTotal, N_INSIDER, 1.1);

  const holders: Holder[] = [];
  let idCounter = 1;

  const makeHolder = (
    name: string,
    type: HolderType,
    country: string,
    shares: number,
  ): Holder => {
    const newHolder = rng() < 0.06;
    const changePct = newHolder
      ? 100
      : rng() < 0.03
        ? -100
        : Number(((rng() * 40 - 20)).toFixed(2));
    const priorShares = newHolder ? 0 : changePct === -100 ? shares / Math.max(rng() * 0.5 + 0.5, 0.4) : shares / (1 + changePct / 100);
    const changeShares = shares - priorShares;
    const marketValueMm = shares * center.price;
    const pctOut = (shares / so) * 100;
    const aumApprox = rng() * 800 + 40; // $B
    const portfolioPct = Number(Math.min(98, (marketValueMm / 1000 / aumApprox) * 100).toFixed(2));
    const status = statusFromChange(rng, changePct, newHolder);
    const src = sourceFor(type, rng);
    return {
      id: `H${(idCounter++).toString().padStart(4, '0')}`,
      name,
      type,
      country,
      source: src,
      positionSharesM: Number(shares.toFixed(2)),
      pctOut: Number(pctOut.toFixed(3)),
      changeSharesM: Number(changeShares.toFixed(2)),
      changePct: Number(changePct.toFixed(2)),
      positionDate: daysAgoIso(rng, src === 'Form 4' ? 30 : 95, src === 'Form 4' ? 2 : 8),
      marketValueMm: Number(marketValueMm.toFixed(0)),
      portfolioPct,
      status: status === 'Sold Out' ? 'Sold Out' : status,
    };
  };

  // Institutional longs
  const instSelection = shuffleTake(rng, TOP_INSTITUTIONS, N_INST);
  instWeights.forEach((w, i) => {
    const src = instSelection[i];
    holders.push(makeHolder(src.name, src.type, src.country, w));
  });

  // ETFs
  const etfSelection = shuffleTake(rng, ETFS, N_ETF);
  etfWeights.forEach((w, i) => {
    const src = etfSelection[i];
    holders.push(makeHolder(src.name, src.type, src.country, w));
  });

  // Mutual funds
  const mfSelection = shuffleTake(rng, MUTUAL_FUNDS, N_MF);
  mfWeights.forEach((w, i) => {
    const src = mfSelection[i];
    holders.push(makeHolder(src.name, src.type, src.country, w));
  });

  // Hedge funds
  const hfSelection = shuffleTake(rng, HEDGE_FUNDS, N_HF);
  hfWeights.forEach((w, i) => {
    const src = hfSelection[i];
    holders.push(makeHolder(src.name, src.type, src.country, w));
  });

  // Insiders
  const insiders = insiderNames(ticker);
  insiderWeights.forEach((w, i) => {
    holders.push(makeHolder(insiders[i % insiders.length], 'Insider', center.country, w));
  });

  // Sort descending by position
  holders.sort((a, b) => b.positionSharesM - a.positionSharesM);

  const top10Pct = holders.slice(0, 10).reduce((acc, h) => acc + h.pctOut, 0);

  const summary: HdsSummary = {
    institutionalPct: Number(shape.instShare.toFixed(2)),
    mutualFundPct: Number(shape.mfShare.toFixed(2)),
    etfPct: Number(shape.etfShare.toFixed(2)),
    hedgeFundPct: Number(shape.hfShare.toFixed(2)),
    insiderPct: Number(shape.insiderShare.toFixed(2)),
    top10Pct: Number(top10Pct.toFixed(2)),
    holderCount: 1200 + Math.floor(rng() * 3800),
    holderCountDeltaQoq: Math.floor(rng() * 500) - 150,
    shortInterestPct: Number(shape.shortInterestPct.toFixed(2)),
    daysToCover: Number((0.4 + rng() * 3.5).toFixed(1)),
    avgDailyVolumeM: Number((10 + rng() * 120).toFixed(1)),
    floatTurnoverDays: Number((40 + rng() * 260).toFixed(0)),
  };

  return {
    asOf: new Date().toISOString().slice(0, 10),
    center,
    summary,
    holders,
  };
}

function shuffleTake<T>(rng: () => number, arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}
