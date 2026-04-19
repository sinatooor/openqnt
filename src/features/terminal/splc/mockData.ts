/**
 * Mock data generator for the Bloomberg-style SPLC (Supply Chain Analysis).
 *
 * Bloomberg's SPLC function maps a focal company to its suppliers (left),
 * customers (right), and competitors (bottom), with two exposure metrics:
 *
 *   • Company exposure (default):
 *       - Suppliers: % of focal firm's COGS paid to supplier
 *       - Customers: % of focal firm's revenue received from customer
 *     -> "To whom is the center most exposed?"
 *
 *   • Relationship exposure:
 *       - Suppliers: % of supplier's revenue coming from focal firm
 *       - Customers: % of customer's COGS paid to focal firm
 *     -> "Who is most exposed to the center?"
 *
 * Each relationship is annotated with a $ value, data source (10-K, 10-Q,
 * earnings call), and a confidence score indicating whether the number is
 * quantified or inferred.
 */

export type RelationshipSource = '10-K' | '10-Q' | 'Earnings Call' | 'Investor Presentation' | 'Estimate';

export interface SplcCompany {
  ticker: string;
  name: string;
  country: string;
  industry: string;
}

export interface SplcRelationship {
  company: SplcCompany;
  /** $ flow in millions between the two companies */
  valueMm: number;
  /** % of focal firm's COGS (supplier) or revenue (customer) */
  companyExposurePct: number;
  /** % of counterparty's revenue (supplier) or COGS (customer) */
  relationshipExposurePct: number;
  source: RelationshipSource;
  sourceDate: string;
  quantified: boolean;
  /** Year-over-year change in relationship value (%) */
  deltaPct: number;
}

export interface SplcCenterMetrics {
  revenueQuantifiedPct: number;
  cogsQuantifiedPct: number;
  capexQuantifiedPct: number;
  sgaQuantifiedPct: number;
  rndQuantifiedPct: number;
  proprietaryPct: number;
}

export interface SplcCenter extends SplcCompany {
  price: number;
  marketCapB: number;
  revenueB: number;
  cogsB: number;
  grossMarginPct: number;
  metrics: SplcCenterMetrics;
}

export interface SplcData {
  center: SplcCenter;
  suppliers: SplcRelationship[];
  customers: SplcRelationship[];
  peers: SplcCompany[];
}

/* --------------------------------- helpers -------------------------------- */

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

/* ------------------------------- known tickers ---------------------------- */

/** Curated real-world company metadata — used for both centers and peers. */
const COMPANY_DIRECTORY: Record<string, SplcCompany & { price: number; marketCapB: number; revenueB: number; grossMarginPct: number }> = {
  AAPL:   { ticker: 'AAPL', name: 'Apple Inc',          country: 'US', industry: 'Consumer Electronics', price: 226.78, marketCapB: 3450, revenueB: 391.0, grossMarginPct: 46.2 },
  MSFT:   { ticker: 'MSFT', name: 'Microsoft Corp',     country: 'US', industry: 'Software',             price: 427.15, marketCapB: 3180, revenueB: 245.1, grossMarginPct: 69.8 },
  GOOGL:  { ticker: 'GOOGL',name: 'Alphabet Inc',       country: 'US', industry: 'Internet',             price: 174.02, marketCapB: 2150, revenueB: 307.4, grossMarginPct: 56.9 },
  META:   { ticker: 'META', name: 'Meta Platforms',     country: 'US', industry: 'Internet',             price: 521.33, marketCapB: 1320, revenueB: 134.9, grossMarginPct: 81.5 },
  AMZN:   { ticker: 'AMZN', name: 'Amazon.com',         country: 'US', industry: 'E-commerce',           price: 191.46, marketCapB: 1990, revenueB: 574.8, grossMarginPct: 46.9 },
  NVDA:   { ticker: 'NVDA', name: 'NVIDIA Corp',        country: 'US', industry: 'Semiconductors',       price: 118.27, marketCapB: 2910, revenueB: 60.9, grossMarginPct: 73.0 },
  TSLA:   { ticker: 'TSLA', name: 'Tesla Inc',          country: 'US', industry: 'Auto Manufacturer',    price: 248.19, marketCapB: 790,  revenueB: 96.8,  grossMarginPct: 18.2 },
  TSM:    { ticker: 'TSM',  name: 'Taiwan Semi (TSMC)', country: 'TW', industry: 'Semiconductors',       price: 172.5,  marketCapB: 900,  revenueB: 75.4,  grossMarginPct: 53.1 },
  ASML:   { ticker: 'ASML', name: 'ASML Holding',       country: 'NL', industry: 'Semiconductors',       price: 700.0,  marketCapB: 275,  revenueB: 30.0,  grossMarginPct: 51.3 },
  AMAT:   { ticker: 'AMAT', name: 'Applied Materials',  country: 'US', industry: 'Semiconductors',       price: 170.0,  marketCapB: 143,  revenueB: 26.5,  grossMarginPct: 47.5 },
  LRCX:   { ticker: 'LRCX', name: 'Lam Research',       country: 'US', industry: 'Semiconductors',       price: 780.0,  marketCapB: 105,  revenueB: 15.0,  grossMarginPct: 45.0 },
  KLAC:   { ticker: 'KLAC', name: 'KLA Corp',           country: 'US', industry: 'Semiconductors',       price: 650.0,  marketCapB: 87,   revenueB: 9.8,   grossMarginPct: 58.0 },
  AVGO:   { ticker: 'AVGO', name: 'Broadcom',           country: 'US', industry: 'Semiconductors',       price: 170.0,  marketCapB: 790,  revenueB: 35.8,  grossMarginPct: 74.2 },
  QCOM:   { ticker: 'QCOM', name: 'Qualcomm',           country: 'US', industry: 'Semiconductors',       price: 164.0,  marketCapB: 182,  revenueB: 35.8,  grossMarginPct: 56.1 },
  INTC:   { ticker: 'INTC', name: 'Intel Corp',         country: 'US', industry: 'Semiconductors',       price: 23.0,   marketCapB: 99,   revenueB: 54.2,  grossMarginPct: 40.0 },
  AMD:    { ticker: 'AMD',  name: 'Adv Micro Devices',  country: 'US', industry: 'Semiconductors',       price: 163.0,  marketCapB: 264,  revenueB: 22.7,  grossMarginPct: 50.3 },
  SWKS:   { ticker: 'SWKS', name: 'Skyworks Solutions', country: 'US', industry: 'Semiconductors',       price: 96.0,   marketCapB: 15,   revenueB: 4.2,   grossMarginPct: 39.8 },
  QRVO:   { ticker: 'QRVO', name: 'Qorvo Inc',          country: 'US', industry: 'Semiconductors',       price: 90.0,   marketCapB: 8.5,  revenueB: 3.8,   grossMarginPct: 38.6 },
  STM:    { ticker: 'STM',  name: 'STMicroelectronics', country: 'FR', industry: 'Semiconductors',       price: 32.0,   marketCapB: 28,   revenueB: 17.3,  grossMarginPct: 47.9 },
  MU:     { ticker: 'MU',   name: 'Micron Technology',  country: 'US', industry: 'Semiconductors',       price: 110.0,  marketCapB: 119,  revenueB: 25.1,  grossMarginPct: 21.3 },
  '2317':{ ticker: '2317', name: 'Hon Hai (Foxconn)',  country: 'TW', industry: 'Electronics Manufacturing', price: 3.5, marketCapB: 70, revenueB: 216.0, grossMarginPct: 6.5 },
  '066570':{ticker:'066570',name: 'LG Electronics',     country: 'KR', industry: 'Consumer Electronics', price: 0.08,  marketCapB: 15,  revenueB: 60.0,  grossMarginPct: 25.0 },
  '005930':{ticker:'005930',name: 'Samsung Electronics',country: 'KR', industry: 'Conglomerate',         price: 0.06,  marketCapB: 365, revenueB: 200.0, grossMarginPct: 37.0 },
  '034220':{ticker:'034220',name: 'LG Display',         country: 'KR', industry: 'Display Panels',       price: 0.008, marketCapB: 4,   revenueB: 19.0,  grossMarginPct: 5.0 },
  PANW:   { ticker: 'PANW', name: 'Palo Alto Networks', country: 'US', industry: 'Cybersecurity',        price: 356.0,  marketCapB: 117, revenueB: 8.0,   grossMarginPct: 74.0 },
  NFLX:   { ticker: 'NFLX', name: 'Netflix',            country: 'US', industry: 'Streaming',            price: 680.0,  marketCapB: 294, revenueB: 33.7,  grossMarginPct: 41.5 },
  ORCL:   { ticker: 'ORCL', name: 'Oracle Corp',        country: 'US', industry: 'Software',             price: 148.0,  marketCapB: 410, revenueB: 52.9,  grossMarginPct: 71.0 },
  ADBE:   { ticker: 'ADBE', name: 'Adobe Inc',          country: 'US', industry: 'Software',             price: 515.0,  marketCapB: 228, revenueB: 21.5,  grossMarginPct: 88.0 },
  CRM:    { ticker: 'CRM',  name: 'Salesforce',         country: 'US', industry: 'Software',             price: 302.0,  marketCapB: 290, revenueB: 34.9,  grossMarginPct: 75.0 },
  IBM:    { ticker: 'IBM',  name: 'IBM Corp',           country: 'US', industry: 'IT Services',          price: 220.0,  marketCapB: 205, revenueB: 62.0,  grossMarginPct: 55.0 },
  // Tesla supply chain
  '6752': { ticker: '6752', name: 'Panasonic Holdings', country: 'JP', industry: 'Battery / Electronics',price: 10.0,   marketCapB: 25,  revenueB: 55.0,  grossMarginPct: 26.0 },
  '051910':{ticker:'051910',name: 'LG Chem (LG Energy)',country: 'KR', industry: 'Battery Cells',        price: 0.25,   marketCapB: 24,  revenueB: 28.0,  grossMarginPct: 18.0 },
  '300750':{ticker:'300750',name: 'CATL',               country: 'CN', industry: 'Battery Cells',        price: 35.0,   marketCapB: 155, revenueB: 55.0,  grossMarginPct: 22.0 },
  ALB:    { ticker: 'ALB',  name: 'Albemarle Corp',     country: 'US', industry: 'Specialty Chemicals',  price: 90.0,   marketCapB: 11,  revenueB: 9.6,   grossMarginPct: 20.0 },
  // Distribution / retail customers
  WMT:    { ticker: 'WMT',  name: 'Walmart',            country: 'US', industry: 'Retail',               price: 90.0,   marketCapB: 725, revenueB: 648.0, grossMarginPct: 24.0 },
  BBY:    { ticker: 'BBY',  name: 'Best Buy',           country: 'US', industry: 'Retail',               price: 91.0,   marketCapB: 19.5,revenueB: 43.5,  grossMarginPct: 22.4 },
  COST:   { ticker: 'COST', name: 'Costco',             country: 'US', industry: 'Retail',               price: 880.0,  marketCapB: 390, revenueB: 242.0, grossMarginPct: 12.5 },
  TGT:    { ticker: 'TGT',  name: 'Target Corp',        country: 'US', industry: 'Retail',               price: 147.0,  marketCapB: 67,  revenueB: 107.0, grossMarginPct: 28.0 },
  T:      { ticker: 'T',    name: 'AT&T Inc',           country: 'US', industry: 'Telecom',              price: 22.0,   marketCapB: 157, revenueB: 122.4, grossMarginPct: 59.0 },
  VZ:     { ticker: 'VZ',   name: 'Verizon',            country: 'US', industry: 'Telecom',              price: 44.0,   marketCapB: 186, revenueB: 134.0, grossMarginPct: 60.0 },
  TMUS:   { ticker: 'TMUS', name: 'T-Mobile US',        country: 'US', industry: 'Telecom',              price: 220.0,  marketCapB: 260, revenueB: 81.0,  grossMarginPct: 63.0 },
};

/* ----------------------- curated real-ish relationships ------------------- */

interface CuratedRel {
  ticker: string;
  /** company exposure as fraction 0-1 */
  cExp: number;
  /** relationship exposure as fraction 0-1 */
  rExp: number;
  source?: RelationshipSource;
}

interface CuratedChain {
  suppliers: CuratedRel[];
  customers: CuratedRel[];
  peers: string[];
}

/** Hand-tuned approximate relationships for well-known tickers. */
const CURATED: Record<string, CuratedChain> = {
  AAPL: {
    suppliers: [
      { ticker: '2317',   cExp: 0.23, rExp: 0.55, source: '10-K' }, // Foxconn
      { ticker: 'TSM',    cExp: 0.21, rExp: 0.25, source: 'Earnings Call' },
      { ticker: '005930', cExp: 0.09, rExp: 0.04, source: '10-K' }, // Samsung
      { ticker: '034220', cExp: 0.04, rExp: 0.33, source: 'Earnings Call' }, // LG Display
      { ticker: 'QCOM',   cExp: 0.03, rExp: 0.22, source: '10-K' },
      { ticker: 'SWKS',   cExp: 0.02, rExp: 0.68, source: '10-K' },
      { ticker: 'QRVO',   cExp: 0.02, rExp: 0.47, source: '10-K' },
      { ticker: 'STM',    cExp: 0.015,rExp: 0.17, source: 'Investor Presentation' },
      { ticker: 'AVGO',   cExp: 0.018,rExp: 0.20, source: 'Estimate' },
      { ticker: 'MU',     cExp: 0.012,rExp: 0.10, source: 'Estimate' },
    ],
    customers: [
      { ticker: 'WMT',    cExp: 0.04, rExp: 0.02, source: 'Estimate' },
      { ticker: 'COST',   cExp: 0.03, rExp: 0.04, source: 'Estimate' },
      { ticker: 'BBY',    cExp: 0.025,rExp: 0.22, source: 'Estimate' },
      { ticker: 'T',      cExp: 0.04, rExp: 0.06, source: 'Estimate' },
      { ticker: 'VZ',     cExp: 0.05, rExp: 0.09, source: 'Estimate' },
      { ticker: 'TMUS',   cExp: 0.03, rExp: 0.14, source: 'Estimate' },
      { ticker: 'TGT',    cExp: 0.02, rExp: 0.07, source: 'Estimate' },
    ],
    peers: ['MSFT', 'GOOGL', '005930', 'META', 'AMZN', 'NVDA'],
  },
  NVDA: {
    suppliers: [
      { ticker: 'TSM',    cExp: 0.62, rExp: 0.11, source: '10-K' },
      { ticker: 'ASML',   cExp: 0.08, rExp: 0.07, source: 'Estimate' },
      { ticker: 'AMAT',   cExp: 0.06, rExp: 0.08, source: 'Estimate' },
      { ticker: 'LRCX',   cExp: 0.05, rExp: 0.10, source: 'Estimate' },
      { ticker: 'KLAC',   cExp: 0.03, rExp: 0.05, source: 'Estimate' },
      { ticker: '2317',   cExp: 0.04, rExp: 0.03, source: 'Estimate' },
      { ticker: 'MU',     cExp: 0.03, rExp: 0.06, source: 'Estimate' },
    ],
    customers: [
      { ticker: 'MSFT',   cExp: 0.19, rExp: 0.04, source: '10-K' },
      { ticker: 'META',   cExp: 0.13, rExp: 0.06, source: 'Earnings Call' },
      { ticker: 'GOOGL',  cExp: 0.11, rExp: 0.02, source: 'Earnings Call' },
      { ticker: 'AMZN',   cExp: 0.09, rExp: 0.01, source: '10-K' },
      { ticker: 'ORCL',   cExp: 0.04, rExp: 0.03, source: 'Earnings Call' },
      { ticker: 'TSLA',   cExp: 0.03, rExp: 0.02, source: 'Estimate' },
    ],
    peers: ['AMD', 'INTC', 'AVGO', 'QCOM', 'TSM'],
  },
  TSLA: {
    suppliers: [
      { ticker: '300750', cExp: 0.19, rExp: 0.27, source: '10-K' }, // CATL
      { ticker: '6752',   cExp: 0.12, rExp: 0.18, source: '10-K' }, // Panasonic
      { ticker: '051910', cExp: 0.08, rExp: 0.22, source: 'Earnings Call' }, // LG Energy
      { ticker: 'ALB',    cExp: 0.04, rExp: 0.17, source: '10-K' },
      { ticker: 'STM',    cExp: 0.03, rExp: 0.05, source: 'Estimate' },
      { ticker: 'NVDA',   cExp: 0.02, rExp: 0.003, source: 'Estimate' },
    ],
    customers: [
      { ticker: 'WMT',    cExp: 0.02, rExp: 0.003, source: 'Estimate' },
    ],
    peers: ['F', 'GM', 'TM', 'RIVN', 'LCID'],
  },
  MSFT: {
    suppliers: [
      { ticker: 'NVDA',   cExp: 0.09, rExp: 0.19, source: 'Earnings Call' },
      { ticker: 'AMD',    cExp: 0.05, rExp: 0.12, source: 'Estimate' },
      { ticker: 'INTC',   cExp: 0.06, rExp: 0.07, source: 'Estimate' },
      { ticker: '2317',   cExp: 0.03, rExp: 0.02, source: 'Estimate' },
      { ticker: 'TSM',    cExp: 0.04, rExp: 0.03, source: 'Estimate' },
    ],
    customers: [
      { ticker: 'BBY',    cExp: 0.02, rExp: 0.04, source: 'Estimate' },
      { ticker: 'WMT',    cExp: 0.015,rExp: 0.006,source: 'Estimate' },
    ],
    peers: ['GOOGL', 'AAPL', 'META', 'ORCL', 'CRM', 'ADBE'],
  },
  META: {
    suppliers: [
      { ticker: 'NVDA',   cExp: 0.28, rExp: 0.13, source: 'Earnings Call' },
      { ticker: 'AMD',    cExp: 0.09, rExp: 0.14, source: 'Estimate' },
      { ticker: 'INTC',   cExp: 0.04, rExp: 0.03, source: 'Estimate' },
      { ticker: 'TSM',    cExp: 0.03, rExp: 0.02, source: 'Estimate' },
    ],
    customers: [],
    peers: ['GOOGL', 'MSFT', 'AAPL', 'AMZN', 'NFLX'],
  },
};

/* ------------------------------- generators ------------------------------- */

const INDUSTRY_POOL = ['Software', 'Semiconductors', 'Retail', 'Consumer Electronics', 'Auto Manufacturer', 'Specialty Chemicals', 'Battery Cells', 'E-commerce', 'Telecom', 'Media'] as const;
const COUNTRY_POOL = ['US', 'CN', 'KR', 'JP', 'TW', 'DE', 'NL', 'IN', 'BR', 'GB'] as const;
const GENERIC_PREFIXES = ['Apex', 'Vertex', 'Sigma', 'Orion', 'Nova', 'Zenith', 'Helios', 'Cobalt', 'Titan', 'Luxor'];
const GENERIC_SUFFIXES = ['Industries', 'Tech', 'Systems', 'Networks', 'Corp', 'Group', 'Holdings', 'Labs', 'Dynamics', 'Ventures'];

function getOrSynthCompany(ticker: string, rng: () => number): SplcCompany {
  const known = COMPANY_DIRECTORY[ticker];
  if (known) {
    return { ticker: known.ticker, name: known.name, country: known.country, industry: known.industry };
  }
  return {
    ticker,
    name: `${pick(rng, GENERIC_PREFIXES)} ${pick(rng, GENERIC_SUFFIXES)}`,
    country: pick(rng, COUNTRY_POOL),
    industry: pick(rng, INDUSTRY_POOL),
  };
}

function synthTicker(rng: () => number, used: Set<string>): string {
  for (let i = 0; i < 20; i += 1) {
    const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    const len = 3 + Math.floor(rng() * 2);
    let t = '';
    for (let j = 0; j < len; j += 1) t += letters[Math.floor(rng() * letters.length)];
    if (!used.has(t)) {
      used.add(t);
      return t;
    }
  }
  return `GEN${Math.floor(rng() * 10000)}`;
}

function synthRelationships(
  rng: () => number,
  count: number,
  used: Set<string>,
): CuratedRel[] {
  const out: CuratedRel[] = [];
  let remaining = 0.45;
  for (let i = 0; i < count; i += 1) {
    const cExp = Math.max(0.005, (remaining * (0.25 + rng() * 0.35)));
    remaining = Math.max(0, remaining - cExp);
    out.push({
      ticker: synthTicker(rng, used),
      cExp,
      rExp: 0.02 + rng() * 0.55,
      source: pick(rng, ['10-K', '10-Q', 'Earnings Call', 'Investor Presentation', 'Estimate'] as const),
    });
  }
  return out;
}

function buildCenter(ticker: string, rng: () => number): SplcCenter {
  const known = COMPANY_DIRECTORY[ticker];
  const base = known ?? {
    ticker,
    name: `${pick(rng, GENERIC_PREFIXES)} ${pick(rng, GENERIC_SUFFIXES)}`,
    country: pick(rng, COUNTRY_POOL),
    industry: pick(rng, INDUSTRY_POOL),
    price: Number((20 + rng() * 600).toFixed(2)),
    marketCapB: Number((10 + rng() * 500).toFixed(1)),
    revenueB: Number((5 + rng() * 200).toFixed(1)),
    grossMarginPct: Number((15 + rng() * 65).toFixed(1)),
  };
  const cogsB = Number((base.revenueB * (1 - base.grossMarginPct / 100)).toFixed(2));
  return {
    ticker: base.ticker,
    name: base.name,
    country: base.country,
    industry: base.industry,
    price: base.price,
    marketCapB: base.marketCapB,
    revenueB: base.revenueB,
    cogsB,
    grossMarginPct: base.grossMarginPct,
    metrics: {
      revenueQuantifiedPct: Math.min(92, 20 + Math.floor(rng() * 70)),
      cogsQuantifiedPct: Math.min(95, 25 + Math.floor(rng() * 65)),
      capexQuantifiedPct: 5 + Math.floor(rng() * 40),
      sgaQuantifiedPct: 2 + Math.floor(rng() * 25),
      rndQuantifiedPct: 2 + Math.floor(rng() * 20),
      proprietaryPct: 30 + Math.floor(rng() * 50),
    },
  };
}

function todayShifted(rng: () => number): string {
  const daysAgo = Math.floor(rng() * 180) + 1;
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

export function generateSplcData(tickerRaw: string): SplcData {
  const ticker = (tickerRaw || 'AAPL').trim().toUpperCase() || 'AAPL';
  const rng = makeRng(`splc:${ticker}`);

  const center = buildCenter(ticker, rng);
  const curated = CURATED[ticker];
  const usedTickers = new Set<string>([ticker]);
  const suppliersRaw = curated?.suppliers.slice() ?? [];
  const customersRaw = curated?.customers.slice() ?? [];

  // If curated list is sparse, top it up with synthetic tickers.
  if (suppliersRaw.length < 8) {
    const extras = synthRelationships(rng, 8 - suppliersRaw.length, usedTickers);
    suppliersRaw.push(...extras);
  }
  if (customersRaw.length < 6) {
    const extras = synthRelationships(rng, 6 - customersRaw.length, usedTickers);
    customersRaw.push(...extras);
  }

  suppliersRaw.forEach((s) => usedTickers.add(s.ticker));
  customersRaw.forEach((c) => usedTickers.add(c.ticker));

  const toRel = (r: CuratedRel, side: 'supplier' | 'customer'): SplcRelationship => {
    const co = getOrSynthCompany(r.ticker, rng);
    // $ flow = company exposure × (COGS for supplier, Revenue for customer)
    const base = side === 'supplier' ? center.cogsB : center.revenueB;
    const valueMm = Math.round(base * r.cExp * 1000);
    const source = r.source ?? pick(rng, ['10-K', '10-Q', 'Earnings Call', 'Investor Presentation', 'Estimate'] as const);
    return {
      company: co,
      valueMm,
      companyExposurePct: Number((r.cExp * 100).toFixed(2)),
      relationshipExposurePct: Number((r.rExp * 100).toFixed(2)),
      source,
      sourceDate: todayShifted(rng),
      quantified: source !== 'Estimate',
      deltaPct: Number(((rng() * 40) - 18).toFixed(1)),
    };
  };

  const suppliers = suppliersRaw
    .map((s) => toRel(s, 'supplier'))
    .sort((a, b) => b.companyExposurePct - a.companyExposurePct);
  const customers = customersRaw
    .map((c) => toRel(c, 'customer'))
    .sort((a, b) => b.companyExposurePct - a.companyExposurePct);

  const peerTickers = curated?.peers ?? [];
  const peers = peerTickers.length
    ? peerTickers.map((t) => getOrSynthCompany(t, rng))
    : Array.from({ length: 5 }).map(() => getOrSynthCompany(synthTicker(rng, usedTickers), rng));

  return { center, suppliers, customers, peers };
}
