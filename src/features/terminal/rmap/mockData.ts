/**
 * Mock data generator for the Bloomberg-style Relationship Map (RMAP).
 *
 * Bloomberg's RMAP (ticker <EQUITY> RMAP <GO>) displays a graphical overview
 * of a company's market/industry relationships across 12 "data nodes":
 *   1. News               (top stories)
 *   2. Events             (corporate events)
 *   3. Indices            (WGT — index weightings)
 *   4. Peers              (RV — relative value / competitors)
 *   5. Holders            (HDS — top institutional holders)
 *   6. Analysts           (ANR — analyst recommendations)
 *   7. Board              (MGMT — board of directors)
 *   8. Executives         (MGMT — key executives)
 *   9. Options            (OMN — options chain)
 *  10. Exchanges          (QM — trading venues)
 *  11. CDSs               (CG — credit default swaps)
 *  12. Balance Sheet      (FA — financial analysis)
 *
 * For now we generate deterministic mock data seeded by the ticker so the
 * layout is stable across refreshes.  Replace the individual loaders with
 * real backend calls as the data feeds come online.
 */

export type ChangeDirection = 'up' | 'down' | 'flat';

export interface TickerTile {
  /** Short label shown in the tile */
  symbol: string;
  /** Percentage change used for color-coding */
  changePct: number;
}

export interface NewsItem {
  headline: string;
  source: string;
  minutesAgo: number;
}

export interface EventItem {
  title: string;
  date: string;
  kind: 'earnings' | 'conference' | 'dividend' | 'guidance' | 'split';
}

export interface AnalystRating {
  firm: string;
  action: 'BUY' | 'HOLD' | 'SELL';
}

export interface HolderTile {
  name: string;
  pctOwned: number;
  changePct: number;
}

export interface PersonTile {
  name: string;
  role: string;
}

export interface ExchangeTile {
  code: string;
  volumePct: number;
}

export interface BalanceBar {
  label: string;
  value: number;
  tone: 'asset' | 'liability' | 'equity';
}

export interface OptionsPoint {
  strike: number;
  iv: number;
}

export interface CdsPoint {
  tenor: string;
  spreadBp: number;
}

export interface RmapCenter {
  ticker: string;
  name: string;
  exchange: string;
  price: number;
  changePct: number;
  currency: string;
  sparkline: number[];
}

export interface RmapData {
  center: RmapCenter;
  indices: { total: number; items: TickerTile[] };
  peers: { total: number; items: TickerTile[] };
  holders: { total: number; items: HolderTile[] };
  analysts: { total: number; items: AnalystRating[] };
  board: { total: number; items: PersonTile[] };
  executives: { total: number; items: PersonTile[] };
  news: { total: number; items: NewsItem[] };
  events: { total: number; items: EventItem[] };
  options: { total: number; items: OptionsPoint[] };
  exchanges: { total: number; items: ExchangeTile[] };
  cds: { total: number; items: CdsPoint[] };
  balanceSheet: { items: BalanceBar[] };
}

/* --------------------------------- helpers -------------------------------- */

/** Deterministic pseudo-random generator seeded from the ticker string. */
function createRng(seed: string) {
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

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/* ---------------------------- pools of sample data ------------------------ */

const INDEX_POOL = ['SPX', 'NDX', 'DJI', 'RAY', 'RLV', 'SPXL2', 'OEX', 'RUT', 'SOX', 'INDU', 'SSHLTH', 'SGX', 'IXIC', 'MID', 'SML', 'SPR'] as const;

const PEER_POOL = ['AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'NVDA', 'TSLA', 'NFLX', 'ORCL', 'ADBE', 'CRM', 'AMD', 'INTC', 'AVGO', 'QCOM', 'CSCO', 'IBM', 'TXN'] as const;

const HOLDER_POOL = ['Vanguard', 'BlackRock', 'State St', 'Fidelity', 'Capital Grp', 'T. Rowe', 'Geode', 'Wellington', 'Invesco', 'Morgan Stanley', 'Northern Tr', 'Bank of NY'] as const;

const ANALYST_POOL = ['JPM', 'GS', 'MS', 'BofA', 'Citi', 'Barclays', 'UBS', 'DB', 'HSBC', 'Jefferies', 'Wells Fargo', 'Piper'] as const;

const FIRST_NAMES = ['Emma', 'Liam', 'Noah', 'Olivia', 'Ava', 'Ethan', 'Mia', 'Lucas', 'Sophia', 'Aiden', 'Isabella', 'Mason', 'Amelia', 'James', 'Charlotte', 'Benjamin'] as const;
const LAST_NAMES = ['Chen', 'Patel', 'Garcia', 'Walker', 'Kim', 'Nguyen', 'Johnson', 'Silva', 'Khan', 'O\u2019Neil', 'Fischer', 'Rossi', 'Brown', 'Martinez', 'Young', 'Wang'] as const;

const BOARD_ROLES = ['Chair', 'Director', 'Lead Dir.', 'Director', 'Director'] as const;
const EXEC_ROLES = ['CEO', 'CFO', 'COO', 'CTO', 'Pres.', 'CMO'] as const;

const EXCHANGE_POOL = ['NASDAQ', 'NYSE', 'ARCA', 'BATS', 'EDGX', 'EDGA', 'IEX', 'CBOE', 'PHLX', 'LSE', 'XETRA', 'SGX', 'HKEX'] as const;

const NEWS_SOURCES = ['Reuters', 'Bloomberg', 'WSJ', 'FT', 'CNBC', 'AP'] as const;

const NEWS_HEADLINES = [
  '{T} beats quarterly revenue estimates',
  'Analysts raise price target on {T}',
  '{T} unveils new product roadmap at annual summit',
  'Regulatory probe widens into {T} supply chain',
  'Activist investor builds stake in {T}',
  '{T} announces $20B buyback program',
  'Credit rating upgraded for {T} by Moody\u2019s',
  '{T} faces class-action lawsuit over disclosures',
  'CEO of {T} interviewed on quarterly call',
  '{T} expands operations into Southeast Asia',
] as const;

const EVENT_TITLES: Array<{ title: string; kind: EventItem['kind'] }> = [
  { title: 'Q2 Earnings Call', kind: 'earnings' },
  { title: 'Investor Day', kind: 'conference' },
  { title: 'Ex-Dividend Date', kind: 'dividend' },
  { title: 'Guidance Update', kind: 'guidance' },
  { title: 'Analyst Conference', kind: 'conference' },
  { title: 'Annual Shareholder Meeting', kind: 'conference' },
];

/* ------------------------------- generators ------------------------------- */

function generateTickerTiles(rng: () => number, pool: readonly string[], count: number): TickerTile[] {
  const picked = new Set<string>();
  const result: TickerTile[] = [];
  while (result.length < count && picked.size < pool.length) {
    const s = pick(rng, pool);
    if (picked.has(s)) continue;
    picked.add(s);
    const chg = (rng() * 6 - 3);
    result.push({ symbol: s, changePct: Number(chg.toFixed(2)) });
  }
  return result;
}

function generatePerson(rng: () => number): string {
  return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
}

function generateSparkline(rng: () => number, base: number, points = 40): number[] {
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < points; i += 1) {
    v += (rng() - 0.48) * (base * 0.012);
    out.push(Number(v.toFixed(2)));
  }
  return out;
}

/* --------------------------------- API ----------------------------------- */

const KNOWN_NAMES: Record<string, { name: string; exchange: string; price: number }> = {
  AAPL: { name: 'Apple Inc', exchange: 'NASDAQ', price: 226.78 },
  MSFT: { name: 'Microsoft Corp', exchange: 'NASDAQ', price: 427.15 },
  GOOGL: { name: 'Alphabet Inc', exchange: 'NASDAQ', price: 174.02 },
  META: { name: 'Meta Platforms Inc', exchange: 'NASDAQ', price: 521.33 },
  AMZN: { name: 'Amazon.com Inc', exchange: 'NASDAQ', price: 191.46 },
  NVDA: { name: 'NVIDIA Corp', exchange: 'NASDAQ', price: 118.27 },
  TSLA: { name: 'Tesla Inc', exchange: 'NASDAQ', price: 248.19 },
  MRK: { name: 'Merck & Co Inc', exchange: 'NYSE', price: 114.58 },
  JPM: { name: 'JPMorgan Chase & Co', exchange: 'NYSE', price: 213.72 },
  BRKB: { name: 'Berkshire Hathaway', exchange: 'NYSE', price: 451.02 },
};

export function generateRmapData(tickerRaw: string): RmapData {
  const ticker = (tickerRaw || 'AAPL').trim().toUpperCase() || 'AAPL';
  const rng = createRng(ticker);
  const meta = KNOWN_NAMES[ticker] ?? {
    name: `${ticker} Corp`,
    exchange: pick(rng, ['NASDAQ', 'NYSE', 'LSE', 'TSX'] as const),
    price: Number((20 + rng() * 600).toFixed(2)),
  };

  const changePct = Number(((rng() * 6) - 2).toFixed(2));

  // Peers exclude the center ticker itself.
  const peerPool = PEER_POOL.filter((p) => p !== ticker);

  const news = range(8).map(() => {
    const template = pick(rng, NEWS_HEADLINES);
    return {
      headline: template.replace('{T}', ticker),
      source: pick(rng, NEWS_SOURCES),
      minutesAgo: Math.floor(rng() * 600) + 3,
    };
  });

  const events = range(5).map((i) => {
    const e = EVENT_TITLES[Math.floor(rng() * EVENT_TITLES.length)];
    const daysAhead = Math.floor(rng() * 60) - 10 + i * 7;
    const d = new Date(Date.now() + daysAhead * 86400000);
    return {
      title: e.title,
      kind: e.kind,
      date: d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
    } satisfies EventItem;
  });

  const holders = range(6).map(() => {
    const name = pick(rng, HOLDER_POOL);
    return {
      name,
      pctOwned: Number((rng() * 11 + 0.5).toFixed(2)),
      changePct: Number(((rng() * 4) - 2).toFixed(2)),
    } satisfies HolderTile;
  });

  const analysts = range(8).map(() => {
    const action = pick(rng, ['BUY', 'BUY', 'BUY', 'HOLD', 'HOLD', 'SELL'] as const);
    return { firm: pick(rng, ANALYST_POOL), action };
  });

  const board = range(5).map(() => ({
    name: generatePerson(rng),
    role: pick(rng, BOARD_ROLES),
  }));

  const executives = range(6).map(() => ({
    name: generatePerson(rng),
    role: pick(rng, EXEC_ROLES),
  }));

  const exchanges = range(5).map(() => ({
    code: pick(rng, EXCHANGE_POOL),
    volumePct: Number((rng() * 40 + 2).toFixed(1)),
  }));

  // Options smile: IV (%) by strike offset around current price.
  const options = range(9).map((i) => {
    const strike = Number((meta.price * (0.8 + i * 0.05)).toFixed(2));
    const iv = Number((22 + Math.pow(i - 4, 2) * 1.4 + rng() * 2).toFixed(1));
    return { strike, iv };
  });

  const cds = (['1Y', '3Y', '5Y', '7Y', '10Y'] as const).map((tenor, i) => ({
    tenor,
    spreadBp: Math.round(25 + i * 18 + rng() * 10),
  }));

  const balanceSheet: BalanceBar[] = [
    { label: 'Cash', value: Math.round(40 + rng() * 60), tone: 'asset' },
    { label: 'Recv', value: Math.round(20 + rng() * 40), tone: 'asset' },
    { label: 'PP&E', value: Math.round(60 + rng() * 80), tone: 'asset' },
    { label: 'ST Debt', value: Math.round(20 + rng() * 40), tone: 'liability' },
    { label: 'LT Debt', value: Math.round(50 + rng() * 120), tone: 'liability' },
    { label: 'Equity', value: Math.round(80 + rng() * 120), tone: 'equity' },
  ];

  return {
    center: {
      ticker,
      name: meta.name,
      exchange: meta.exchange,
      price: meta.price,
      changePct,
      currency: 'USD',
      sparkline: generateSparkline(rng, meta.price),
    },
    indices: {
      total: 50,
      items: generateTickerTiles(rng, INDEX_POOL, 10),
    },
    peers: {
      total: 27,
      items: generateTickerTiles(rng, peerPool, 10),
    },
    holders: { total: 120, items: holders },
    analysts: { total: 21, items: analysts },
    board: { total: 13, items: board },
    executives: { total: 15, items: executives },
    news: { total: 40, items: news },
    events: { total: 12, items: events },
    options: { total: 312, items: options },
    exchanges: { total: 23, items: exchanges },
    cds: { total: 5, items: cds },
    balanceSheet: { items: balanceSheet },
  };
}
