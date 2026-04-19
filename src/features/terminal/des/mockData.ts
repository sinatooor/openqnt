/**
 * Mock data generator for the Bloomberg-style DES (Company Description) function.
 *
 * DES packs the most commonly-referenced company data onto a single screen:
 *   • Business description and segment mix
 *   • Key executives
 *   • Financial highlights (income, margins, cash flow)
 *   • Valuation multiples and price stats
 *   • Corporate identifiers (ISIN, CUSIP, BBGID, FIGI) and HQ info
 *   • Business highlights, risks, and catalysts
 *
 * Output here is deterministic so UI, agents, and downstream tests all see
 * the same payload.  Replace `fetch()` with a real fundamentals feed (FDS,
 * Polygon, SimplyWallSt, etc.) once available — the shape stays stable.
 */

export interface DesCenter {
  ticker: string;
  name: string;
  legalName: string;
  founded: number;
  incorporation: string;
  hqCity: string;
  hqCountry: string;
  employees: number;
  website: string;
  phone: string;
  exchange: string;
  currency: string;
  listingDate: string;
  fiscalYearEnd: string;
  isin: string;
  cusip: string;
  sedol: string;
  bbgid: string;
  figi: string;
  gicsSector: string;
  gicsIndustry: string;
  naicsCode: string;
  description: string;
}

export interface DesFinancials {
  revenueTtmB: number;
  revenueGrowthYoyPct: number;
  ebitdaTtmB: number;
  ebitdaMarginPct: number;
  grossMarginPct: number;
  operatingMarginPct: number;
  netIncomeTtmB: number;
  netMarginPct: number;
  fcfTtmB: number;
  capexTtmB: number;
  cashAndStB: number;
  totalDebtB: number;
  netDebtB: number;
  roePct: number;
  roaPct: number;
  roicPct: number;
}

export interface DesValuation {
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  marketCapB: number;
  enterpriseValueB: number;
  sharesOutM: number;
  floatM: number;
  shortInterestPct: number;
  pe: number;
  peFwd: number;
  pbRatio: number;
  psRatio: number;
  evEbitda: number;
  divYieldPct: number;
  payoutRatioPct: number;
  divPerShare: number;
  w52High: number;
  w52Low: number;
  beta: number;
  avgVol3moM: number;
}

export interface DesSegment {
  name: string;
  revenuePct: number;
  description: string;
}

export interface DesExecutive {
  name: string;
  title: string;
  since: number;
  ageYrs?: number;
}

export interface DesData {
  center: DesCenter;
  financials: DesFinancials;
  valuation: DesValuation;
  segments: DesSegment[];
  executives: DesExecutive[];
  highlights: string[];
  risks: string[];
  catalysts: string[];
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

function hashId(seed: string, len: number, alphabet: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += alphabet[h % alphabet.length];
    h = (h * 17 + i * 13) >>> 0;
  }
  return out;
}

/* --------------------------- curated universe ---------------------------- */

interface CuratedCompany {
  name: string;
  legalName: string;
  founded: number;
  incorporation: string;
  hqCity: string;
  hqCountry: string;
  employees: number;
  website: string;
  phone: string;
  exchange: string;
  currency: string;
  listingDate: string;
  fiscalYearEnd: string;
  gicsSector: string;
  gicsIndustry: string;
  naicsCode: string;
  description: string;
  financials: DesFinancials;
  valuation: Omit<DesValuation, 'change' | 'changePct'>;
  segments: DesSegment[];
  executives: DesExecutive[];
  highlights: string[];
  risks: string[];
  catalysts: string[];
}

const CURATED: Record<string, CuratedCompany> = {
  AAPL: {
    name: 'Apple Inc',
    legalName: 'Apple Inc.',
    founded: 1976,
    incorporation: 'California, US',
    hqCity: 'Cupertino, CA',
    hqCountry: 'United States',
    employees: 164_000,
    website: 'www.apple.com',
    phone: '+1 408 996 1010',
    exchange: 'NASDAQ Global Select',
    currency: 'USD',
    listingDate: '1980-12-12',
    fiscalYearEnd: 'Late September',
    gicsSector: 'Information Technology',
    gicsIndustry: 'Technology Hardware, Storage & Peripherals',
    naicsCode: '334220',
    description:
      'Apple Inc. designs, manufactures and markets smartphones, personal computers, tablets, wearables and accessories, and sells a variety of related services. Its primary product is the iPhone, which remains the largest single revenue contributor. The company also operates a fast-growing Services segment encompassing the App Store, Apple Music, Apple TV+, iCloud, AppleCare, advertising, and payment services such as Apple Pay. Apple distributes globally through its direct channels, third-party retailers, wholesalers, and network carriers.',
    financials: {
      revenueTtmB: 391.0,
      revenueGrowthYoyPct: 2.0,
      ebitdaTtmB: 134.6,
      ebitdaMarginPct: 34.4,
      grossMarginPct: 46.2,
      operatingMarginPct: 31.5,
      netIncomeTtmB: 93.7,
      netMarginPct: 24.0,
      fcfTtmB: 108.8,
      capexTtmB: 9.5,
      cashAndStB: 65.2,
      totalDebtB: 101.3,
      netDebtB: 36.1,
      roePct: 157.4,
      roaPct: 27.5,
      roicPct: 58.0,
    },
    valuation: {
      price: 226.78,
      prevClose: 224.31,
      marketCapB: 3450,
      enterpriseValueB: 3486,
      sharesOutM: 15_204,
      floatM: 15_180,
      shortInterestPct: 0.85,
      pe: 37.0,
      peFwd: 31.2,
      pbRatio: 62.8,
      psRatio: 8.8,
      evEbitda: 25.9,
      divYieldPct: 0.45,
      payoutRatioPct: 15.3,
      divPerShare: 1.02,
      w52High: 237.49,
      w52Low: 164.08,
      beta: 1.12,
      avgVol3moM: 58.1,
    },
    segments: [
      { name: 'iPhone',             revenuePct: 51.4, description: 'Flagship smartphone line and accessories.' },
      { name: 'Services',           revenuePct: 24.6, description: 'App Store, cloud, media, advertising, AppleCare, payments.' },
      { name: 'Wearables / Home',   revenuePct: 10.1, description: 'Apple Watch, AirPods, HomePod, accessories.' },
      { name: 'Mac',                revenuePct:  7.7, description: 'Desktop and notebook computers running macOS.' },
      { name: 'iPad',               revenuePct:  6.2, description: 'Tablet computers and accessories.' },
    ],
    executives: [
      { name: 'Tim Cook',          title: 'CEO',                      since: 2011, ageYrs: 64 },
      { name: 'Luca Maestri',      title: 'CFO',                      since: 2014, ageYrs: 61 },
      { name: 'Jeff Williams',     title: 'COO',                      since: 2015, ageYrs: 61 },
      { name: 'Katherine Adams',   title: 'General Counsel',          since: 2017, ageYrs: 61 },
      { name: 'Arthur D. Levinson',title: 'Chair',                    since: 2011, ageYrs: 74 },
      { name: 'Deirdre O\'Brien',  title: 'SVP Retail & People',      since: 2019, ageYrs: 57 },
    ],
    highlights: [
      'Services revenue mix has grown to ~25% with structurally higher (~74%) gross margins.',
      'Installed base surpasses 2.2B active devices worldwide.',
      'Returned >$700B to shareholders via buybacks and dividends since 2012.',
      'Silicon vertical integration (Apple Silicon / M-series) accelerating platform differentiation.',
    ],
    risks: [
      'Concentration in China for both manufacturing (Foxconn) and premium-handset demand.',
      'Regulatory pressure on App Store economics (EU DMA, US v. Apple, Epic Games).',
      'iPhone unit elasticity in soft consumer cycles.',
      'Currency translation headwinds with ~60% of revenue ex-US.',
    ],
    catalysts: [
      'Apple Intelligence rollout driving iPhone upgrade cycle.',
      'Continued capital-return programs and dividend growth.',
      'New Vision / spatial computing category maturation.',
      'Services ARPU expansion (bundles, advertising, Apple TV+).',
    ],
  },

  MSFT: {
    name: 'Microsoft Corp',
    legalName: 'Microsoft Corporation',
    founded: 1975,
    incorporation: 'Washington, US',
    hqCity: 'Redmond, WA',
    hqCountry: 'United States',
    employees: 228_000,
    website: 'www.microsoft.com',
    phone: '+1 425 882 8080',
    exchange: 'NASDAQ Global Select',
    currency: 'USD',
    listingDate: '1986-03-13',
    fiscalYearEnd: 'June',
    gicsSector: 'Information Technology',
    gicsIndustry: 'Systems Software',
    naicsCode: '511210',
    description:
      'Microsoft Corporation develops, licenses, and supports software, services, devices, and solutions worldwide. Its three reportable segments are Productivity & Business Processes (Office 365, Dynamics, LinkedIn), Intelligent Cloud (Azure, server products, enterprise services), and More Personal Computing (Windows, Surface, Xbox, search advertising). The company is the largest OpenAI investor and is rapidly embedding AI (Copilot) across its enterprise and consumer stack.',
    financials: {
      revenueTtmB: 245.1,
      revenueGrowthYoyPct: 15.7,
      ebitdaTtmB: 134.2,
      ebitdaMarginPct: 54.8,
      grossMarginPct: 69.8,
      operatingMarginPct: 44.8,
      netIncomeTtmB: 88.1,
      netMarginPct: 35.9,
      fcfTtmB: 74.1,
      capexTtmB: 44.5,
      cashAndStB: 80.0,
      totalDebtB: 79.4,
      netDebtB: -0.6,
      roePct: 37.2,
      roaPct: 17.5,
      roicPct: 28.9,
    },
    valuation: {
      price: 427.15,
      prevClose: 423.85,
      marketCapB: 3180,
      enterpriseValueB: 3179,
      sharesOutM: 7_430,
      floatM: 7_425,
      shortInterestPct: 0.72,
      pe: 36.1,
      peFwd: 30.4,
      pbRatio: 10.9,
      psRatio: 13.0,
      evEbitda: 23.7,
      divYieldPct: 0.77,
      payoutRatioPct: 26.5,
      divPerShare: 3.30,
      w52High: 468.35,
      w52Low: 352.80,
      beta: 0.95,
      avgVol3moM: 21.3,
    },
    segments: [
      { name: 'Productivity & Business Processes', revenuePct: 33.0, description: 'Microsoft 365, Dynamics 365, LinkedIn.' },
      { name: 'Intelligent Cloud',                  revenuePct: 43.0, description: 'Azure, server products, GitHub, enterprise services.' },
      { name: 'More Personal Computing',            revenuePct: 24.0, description: 'Windows OEM, Surface, Xbox, search & news advertising.' },
    ],
    executives: [
      { name: 'Satya Nadella', title: 'Chair & CEO',     since: 2014, ageYrs: 57 },
      { name: 'Amy Hood',      title: 'CFO',             since: 2013, ageYrs: 53 },
      { name: 'Brad Smith',    title: 'President',       since: 2015, ageYrs: 65 },
      { name: 'Judson Althoff',title: 'EVP Commercial',  since: 2021, ageYrs: 51 },
    ],
    highlights: [
      'Azure growth reaccelerating on AI workloads; Copilot monetization ramping across the stack.',
      'Operating margins > 44% with low incremental cost on software distribution.',
      'Net cash positive balance sheet with $80B cash & equivalents.',
    ],
    risks: [
      'Heavy capex cycle (~$45B TTM) pressures near-term FCF.',
      'Antitrust scrutiny over Activision / Copilot bundling.',
      'Foreign-exchange exposure across enterprise contracts.',
    ],
    catalysts: [
      'Copilot attach rates in Microsoft 365 and GitHub.',
      'Azure AI service monetization beyond compute.',
      'Security (Defender, Sentinel, Entra) bundling upside.',
    ],
  },

  NVDA: {
    name: 'NVIDIA Corp',
    legalName: 'NVIDIA Corporation',
    founded: 1993,
    incorporation: 'Delaware, US',
    hqCity: 'Santa Clara, CA',
    hqCountry: 'United States',
    employees: 29_600,
    website: 'www.nvidia.com',
    phone: '+1 408 486 2000',
    exchange: 'NASDAQ Global Select',
    currency: 'USD',
    listingDate: '1999-01-22',
    fiscalYearEnd: 'Late January',
    gicsSector: 'Information Technology',
    gicsIndustry: 'Semiconductors',
    naicsCode: '334413',
    description:
      'NVIDIA Corporation is the leading designer of accelerated computing platforms. The Data Center segment (Hopper / Blackwell GPUs, networking, systems) powers the majority of the world\'s large-scale AI training and inference. The Gaming segment provides GeForce GPUs for consumers; Professional Visualization serves workstations and Omniverse; Automotive delivers DRIVE platforms for autonomous driving. NVIDIA also monetizes its software stack through CUDA, AI Enterprise, and Omniverse licensing.',
    financials: {
      revenueTtmB: 60.9,
      revenueGrowthYoyPct: 125.9,
      ebitdaTtmB: 38.6,
      ebitdaMarginPct: 63.4,
      grossMarginPct: 73.0,
      operatingMarginPct: 54.1,
      netIncomeTtmB: 29.8,
      netMarginPct: 48.9,
      fcfTtmB: 27.0,
      capexTtmB: 1.1,
      cashAndStB: 26.0,
      totalDebtB: 11.0,
      netDebtB: -15.0,
      roePct: 91.5,
      roaPct: 55.6,
      roicPct: 79.4,
    },
    valuation: {
      price: 118.27,
      prevClose: 117.50,
      marketCapB: 2910,
      enterpriseValueB: 2895,
      sharesOutM: 24_600,
      floatM: 23_580,
      shortInterestPct: 1.10,
      pe: 48.6,
      peFwd: 32.5,
      pbRatio: 49.2,
      psRatio: 39.8,
      evEbitda: 75.0,
      divYieldPct: 0.03,
      payoutRatioPct: 1.5,
      divPerShare: 0.04,
      w52High: 140.76,
      w52Low: 39.23,
      beta: 1.75,
      avgVol3moM: 260.0,
    },
    segments: [
      { name: 'Data Center',              revenuePct: 87.0, description: 'Hopper/Blackwell GPUs, NVLink, InfiniBand, DGX and systems.' },
      { name: 'Gaming',                   revenuePct:  9.0, description: 'GeForce GPUs for consumers, GeForce NOW streaming.' },
      { name: 'Professional Visualization', revenuePct: 2.0, description: 'RTX workstations, Omniverse.' },
      { name: 'Automotive & Other',       revenuePct:  2.0, description: 'DRIVE platform, robotics, OEM licensing.' },
    ],
    executives: [
      { name: 'Jensen Huang',    title: 'Founder, President & CEO', since: 1993, ageYrs: 62 },
      { name: 'Colette Kress',   title: 'EVP & CFO',               since: 2013, ageYrs: 57 },
      { name: 'Debora Shoquist', title: 'EVP Operations',          since: 2007, ageYrs: 69 },
      { name: 'Jay Puri',        title: 'EVP Worldwide Field Ops', since: 2005, ageYrs: 70 },
    ],
    highlights: [
      'Near-monopoly share of accelerator compute for generative AI training.',
      'CUDA moat → trillions of lines of GPU-optimised research + software.',
      'Gross margin scaling toward 75% as Blackwell ramps.',
      'Net cash balance sheet despite rapid hyperscaler-driven growth.',
    ],
    risks: [
      'Hyperscaler in-house accelerators (Trainium, TPU, MTIA) as a long-term share threat.',
      'US export controls into China restrict a meaningful TAM slice.',
      'Customer concentration — top four hyperscalers are >45% of Data Center revenue.',
      'Extreme valuation sensitivity to any growth deceleration.',
    ],
    catalysts: [
      'Blackwell B200 / GB200 ramp through CY2026.',
      'Sovereign-AI contracts (EU, ME, APAC) expanding beyond cloud customers.',
      'Software monetization (NIM, Enterprise AI, Omniverse licensing).',
    ],
  },

  TSLA: {
    name: 'Tesla Inc',
    legalName: 'Tesla, Inc.',
    founded: 2003,
    incorporation: 'Delaware, US',
    hqCity: 'Austin, TX',
    hqCountry: 'United States',
    employees: 140_500,
    website: 'www.tesla.com',
    phone: '+1 512 516 8177',
    exchange: 'NASDAQ Global Select',
    currency: 'USD',
    listingDate: '2010-06-29',
    fiscalYearEnd: 'December',
    gicsSector: 'Consumer Discretionary',
    gicsIndustry: 'Automobile Manufacturers',
    naicsCode: '336111',
    description:
      'Tesla, Inc. designs, develops, manufactures, and sells high-performance fully electric vehicles, solar energy generation, and energy storage products. Automotive revenue is led by Model 3/Y with Cybertruck, Model S/X, and the upcoming Model 2. Energy Generation & Storage covers Powerwall, Megapack, and solar roof products. Services & Other includes Supercharger access, insurance, used-car sales, software unlocks, and Full Self-Driving (FSD) subscriptions. Tesla also is investing heavily in humanoid robotics (Optimus) and robotaxi services.',
    financials: {
      revenueTtmB: 96.8,
      revenueGrowthYoyPct: -1.3,
      ebitdaTtmB: 14.5,
      ebitdaMarginPct: 15.0,
      grossMarginPct: 18.2,
      operatingMarginPct: 8.2,
      netIncomeTtmB: 7.1,
      netMarginPct: 7.3,
      fcfTtmB: 1.3,
      capexTtmB: 10.5,
      cashAndStB: 33.6,
      totalDebtB: 7.5,
      netDebtB: -26.1,
      roePct: 14.4,
      roaPct: 7.1,
      roicPct: 11.9,
    },
    valuation: {
      price: 248.19,
      prevClose: 245.30,
      marketCapB: 790,
      enterpriseValueB: 764,
      sharesOutM: 3_183,
      floatM: 2_760,
      shortInterestPct: 3.30,
      pe: 111.3,
      peFwd: 78.5,
      pbRatio: 10.5,
      psRatio: 8.2,
      evEbitda: 52.7,
      divYieldPct: 0.00,
      payoutRatioPct: 0.0,
      divPerShare: 0.00,
      w52High: 278.98,
      w52Low: 138.80,
      beta: 2.10,
      avgVol3moM: 110.4,
    },
    segments: [
      { name: 'Automotive Sales & Leasing', revenuePct: 78.0, description: 'Model 3/Y, Model S/X, Cybertruck, regulatory credits.' },
      { name: 'Energy Generation & Storage', revenuePct:  9.0, description: 'Megapack, Powerwall, solar.' },
      { name: 'Services & Other',            revenuePct: 13.0, description: 'Supercharging, insurance, software (FSD), used vehicles.' },
    ],
    executives: [
      { name: 'Elon Musk',         title: 'CEO',                  since: 2008, ageYrs: 54 },
      { name: 'Vaibhav Taneja',    title: 'CFO',                  since: 2023, ageYrs: 47 },
      { name: 'Robyn Denholm',     title: 'Chair',                since: 2018, ageYrs: 62 },
      { name: 'Tom Zhu',           title: 'SVP Auto. / Engineering', since: 2023, ageYrs: 45 },
    ],
    highlights: [
      'Dominant US BEV share; global leader in automotive software OTA.',
      'Megapack business growing >40% YoY with >25% gross margins.',
      'Net cash balance sheet with $33B cash & equivalents.',
    ],
    risks: [
      'Auto gross margin compression from ASP cuts and competitive pricing.',
      'Key-person exposure to Elon Musk across multiple strategic priorities.',
      'China EV competition (BYD, Xiaomi, Huawei-backed models) pressuring share.',
      'Regulatory approval uncertainty around unsupervised FSD / Robotaxi.',
    ],
    catalysts: [
      'Lower-cost Model 2 / affordable platform production start.',
      'Robotaxi commercialisation and ride-hail monetisation.',
      'Optimus humanoid robot pilot deployments.',
    ],
  },

  META: {
    name: 'Meta Platforms Inc',
    legalName: 'Meta Platforms, Inc.',
    founded: 2004,
    incorporation: 'Delaware, US',
    hqCity: 'Menlo Park, CA',
    hqCountry: 'United States',
    employees: 74_000,
    website: 'about.meta.com',
    phone: '+1 650 543 4800',
    exchange: 'NASDAQ Global Select',
    currency: 'USD',
    listingDate: '2012-05-18',
    fiscalYearEnd: 'December',
    gicsSector: 'Communication Services',
    gicsIndustry: 'Interactive Media & Services',
    naicsCode: '519130',
    description:
      'Meta Platforms, Inc. operates the world\'s largest social-networking ecosystem — Facebook, Instagram, Messenger, WhatsApp, and Threads — monetising ~3.9 billion monthly users primarily through advertising. The Reality Labs segment develops AR/VR hardware (Quest), Ray-Ban Meta smart glasses, and the Horizon metaverse platform. Meta is also a top-three investor in foundation AI models through its Llama open-source family and custom training infrastructure.',
    financials: {
      revenueTtmB: 134.9,
      revenueGrowthYoyPct: 18.9,
      ebitdaTtmB: 69.0,
      ebitdaMarginPct: 51.2,
      grossMarginPct: 81.5,
      operatingMarginPct: 38.8,
      netIncomeTtmB: 47.7,
      netMarginPct: 35.3,
      fcfTtmB: 45.0,
      capexTtmB: 31.0,
      cashAndStB: 58.1,
      totalDebtB: 28.9,
      netDebtB: -29.2,
      roePct: 33.4,
      roaPct: 20.1,
      roicPct: 29.5,
    },
    valuation: {
      price: 521.33,
      prevClose: 515.66,
      marketCapB: 1320,
      enterpriseValueB: 1291,
      sharesOutM: 2_533,
      floatM: 2_193,
      shortInterestPct: 1.40,
      pe: 28.1,
      peFwd: 23.2,
      pbRatio: 8.7,
      psRatio: 9.8,
      evEbitda: 18.7,
      divYieldPct: 0.39,
      payoutRatioPct: 11.0,
      divPerShare: 2.00,
      w52High: 542.81,
      w52Low: 274.38,
      beta: 1.25,
      avgVol3moM: 15.9,
    },
    segments: [
      { name: 'Family of Apps', revenuePct: 99.0, description: 'Facebook, Instagram, WhatsApp, Messenger, Threads advertising + payments.' },
      { name: 'Reality Labs',   revenuePct:  1.0, description: 'Quest VR, Ray-Ban smart glasses, Horizon platform.' },
    ],
    executives: [
      { name: 'Mark Zuckerberg', title: 'Founder, Chair & CEO',      since: 2004, ageYrs: 41 },
      { name: 'Susan Li',        title: 'CFO',                       since: 2022, ageYrs: 40 },
      { name: 'Javier Olivan',   title: 'COO',                       since: 2022, ageYrs: 48 },
      { name: 'Andrew Bosworth', title: 'CTO (Reality Labs)',        since: 2017, ageYrs: 44 },
    ],
    highlights: [
      '3.9B MAU family-of-apps audience with durable ad economics.',
      'Llama 3/4 family among largest deployed open-weight LLMs.',
      'Capex scaling with AI infrastructure spend but FCF still > $45B TTM.',
    ],
    risks: [
      'Reality Labs operating loss $16B+ annually.',
      'Regulatory risk: EU DMA, FTC antitrust, EU DSA, India PDPA.',
      'Teen / time-spent declines vs TikTok, Snap.',
    ],
    catalysts: [
      'Meta AI consumer adoption and advertising tie-ins.',
      'Threads monetisation ramp.',
      'Ray-Ban Meta 2 / Orion AR-glasses platform.',
    ],
  },
};

/* ----------------------- synthetic companies fallback -------------------- */

const INDUSTRY_POOL = [
  'Software',
  'Semiconductors',
  'Biotechnology',
  'Specialty Retail',
  'Industrial Machinery',
  'Oil & Gas E&P',
  'Regional Banks',
  'Aerospace & Defense',
  'Hotels & Leisure',
  'Media & Entertainment',
] as const;

const SECTOR_BY_INDUSTRY: Record<string, string> = {
  Software: 'Information Technology',
  Semiconductors: 'Information Technology',
  Biotechnology: 'Health Care',
  'Specialty Retail': 'Consumer Discretionary',
  'Industrial Machinery': 'Industrials',
  'Oil & Gas E&P': 'Energy',
  'Regional Banks': 'Financials',
  'Aerospace & Defense': 'Industrials',
  'Hotels & Leisure': 'Consumer Discretionary',
  'Media & Entertainment': 'Communication Services',
};

function synthCurated(ticker: string, rng: () => number): CuratedCompany {
  const name = `${ticker} Corp`;
  const industry = pick(rng, INDUSTRY_POOL);
  const sector = SECTOR_BY_INDUSTRY[industry];
  const revenueTtm = Number((1 + rng() * 80).toFixed(2));
  const growth = Number(((rng() - 0.35) * 40).toFixed(1));
  const gm = Number((20 + rng() * 60).toFixed(1));
  const om = Number(Math.max(1, gm - 15 - rng() * 12).toFixed(1));
  const nm = Number(Math.max(0, om - 3 - rng() * 6).toFixed(1));
  const ebitdaMargin = Number((om + 5).toFixed(1));
  const netIncome = Number(((nm / 100) * revenueTtm).toFixed(2));
  const ebitda = Number(((ebitdaMargin / 100) * revenueTtm).toFixed(2));
  const price = Number((10 + rng() * 400).toFixed(2));
  const mcap = Number((price * (50 + rng() * 2000) / 1000).toFixed(1)); // $B
  const sharesOut = Number(((mcap * 1000) / price).toFixed(0));
  const debt = Number((rng() * revenueTtm * 0.7).toFixed(2));
  const cash = Number((rng() * revenueTtm * 0.4).toFixed(2));

  return {
    name,
    legalName: `${ticker} Corporation`,
    founded: 1950 + Math.floor(rng() * 70),
    incorporation: pick(rng, ['Delaware, US', 'Nevada, US', 'California, US', 'Texas, US']),
    hqCity: pick(rng, ['New York, NY', 'San Jose, CA', 'Chicago, IL', 'Boston, MA', 'London, UK', 'Zurich, CH']),
    hqCountry: pick(rng, ['United States', 'United Kingdom', 'Germany', 'Canada', 'Japan']),
    employees: 1_000 + Math.floor(rng() * 200_000),
    website: `www.${ticker.toLowerCase()}.com`,
    phone: `+1 ${200 + Math.floor(rng() * 700)} 555 ${1000 + Math.floor(rng() * 8999)}`,
    exchange: rng() < 0.5 ? 'NYSE' : 'NASDAQ Global Select',
    currency: 'USD',
    listingDate: `${1980 + Math.floor(rng() * 44)}-${String(1 + Math.floor(rng() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rng() * 28)).padStart(2, '0')}`,
    fiscalYearEnd: pick(rng, ['December', 'March', 'June', 'September']),
    gicsSector: sector,
    gicsIndustry: industry,
    naicsCode: String(330000 + Math.floor(rng() * 5000)),
    description: `${name} is a ${industry.toLowerCase()} company operating primarily in ${sector.toLowerCase()}. The firm offers a range of products and services to enterprise and consumer customers across North America, Europe, and Asia. (Synthetic description — replace with verified IR copy when real data is wired.)`,
    financials: {
      revenueTtmB: revenueTtm,
      revenueGrowthYoyPct: growth,
      ebitdaTtmB: ebitda,
      ebitdaMarginPct: ebitdaMargin,
      grossMarginPct: gm,
      operatingMarginPct: om,
      netIncomeTtmB: netIncome,
      netMarginPct: nm,
      fcfTtmB: Number((netIncome * (0.6 + rng() * 0.5)).toFixed(2)),
      capexTtmB: Number((revenueTtm * 0.05 * (0.5 + rng())).toFixed(2)),
      cashAndStB: cash,
      totalDebtB: debt,
      netDebtB: Number((debt - cash).toFixed(2)),
      roePct: Number((5 + rng() * 40).toFixed(1)),
      roaPct: Number((2 + rng() * 15).toFixed(1)),
      roicPct: Number((5 + rng() * 25).toFixed(1)),
    },
    valuation: {
      price,
      prevClose: Number((price * (1 - (rng() - 0.5) * 0.02)).toFixed(2)),
      marketCapB: mcap,
      enterpriseValueB: Number((mcap + debt - cash).toFixed(1)),
      sharesOutM: sharesOut,
      floatM: Number((sharesOut * (0.6 + rng() * 0.4)).toFixed(0)),
      shortInterestPct: Number((rng() * 8).toFixed(2)),
      pe: Number((8 + rng() * 60).toFixed(1)),
      peFwd: Number((7 + rng() * 40).toFixed(1)),
      pbRatio: Number((0.5 + rng() * 15).toFixed(1)),
      psRatio: Number((0.2 + rng() * 12).toFixed(1)),
      evEbitda: Number((5 + rng() * 40).toFixed(1)),
      divYieldPct: Number((rng() * 4).toFixed(2)),
      payoutRatioPct: Number((rng() * 70).toFixed(1)),
      divPerShare: Number((rng() * 4).toFixed(2)),
      w52High: Number((price * 1.2).toFixed(2)),
      w52Low: Number((price * 0.65).toFixed(2)),
      beta: Number((0.4 + rng() * 2).toFixed(2)),
      avgVol3moM: Number((1 + rng() * 40).toFixed(1)),
    },
    segments: [
      { name: 'Core Products',     revenuePct: 60 + Math.floor(rng() * 20), description: 'Primary revenue-generating product line.' },
      { name: 'Services',          revenuePct: 20, description: 'Post-sale services, maintenance, and support.' },
      { name: 'Adjacent / Other',  revenuePct: 10, description: 'New ventures, licensing, and other businesses.' },
    ],
    executives: [
      { name: 'Jane Doe',   title: 'CEO',    since: 2019, ageYrs: 55 },
      { name: 'John Smith', title: 'CFO',    since: 2021, ageYrs: 50 },
      { name: 'A. Kumar',   title: 'COO',    since: 2020, ageYrs: 52 },
      { name: 'L. Chen',    title: 'CTO',    since: 2018, ageYrs: 49 },
    ],
    highlights: [
      'Leadership in its core operating market.',
      'Consistent free-cash-flow generation over the past 5 years.',
    ],
    risks: [
      'Macro sensitivity of end-markets.',
      'Rising competitive pressure in core segments.',
    ],
    catalysts: [
      'New product launches in next 12 months.',
      'Potential margin expansion from cost programs.',
    ],
  };
}

/* ------------------------------- main API -------------------------------- */

export interface DesInput {
  ticker: string;
  seedSalt?: number;
}

export function generateDesData(input: DesInput): DesData {
  const ticker = (input.ticker || 'AAPL').trim().toUpperCase() || 'AAPL';
  const salt = input.seedSalt ?? 0;
  const rng = makeRng(`des:${ticker}:${salt}`);

  const curated = CURATED[ticker] ?? synthCurated(ticker, rng);

  const change = Number((curated.valuation.price - curated.valuation.prevClose).toFixed(2));
  const changePct = Number(((change / curated.valuation.prevClose) * 100).toFixed(3));

  const center: DesCenter = {
    ticker,
    name: curated.name,
    legalName: curated.legalName,
    founded: curated.founded,
    incorporation: curated.incorporation,
    hqCity: curated.hqCity,
    hqCountry: curated.hqCountry,
    employees: curated.employees,
    website: curated.website,
    phone: curated.phone,
    exchange: curated.exchange,
    currency: curated.currency,
    listingDate: curated.listingDate,
    fiscalYearEnd: curated.fiscalYearEnd,
    isin: `US${hashId(ticker + 'isin', 9, '0123456789')}1`,
    cusip: hashId(ticker + 'cusip', 9, '0123456789ABCDEFGHIJKLMNPQRSTUVWXYZ'),
    sedol: hashId(ticker + 'sedol', 7, '0123456789BCDFGHJKLMNPQRSTVWXYZ'),
    bbgid: `BBG${hashId(ticker + 'bbg', 9, '0123456789ABCDEFGHJKLMNPQRSTVWXYZ')}`,
    figi: `BBG${hashId(ticker + 'figi', 9, '0123456789ABCDEFGHJKLMNPQRSTVWXYZ')}`,
    gicsSector: curated.gicsSector,
    gicsIndustry: curated.gicsIndustry,
    naicsCode: curated.naicsCode,
    description: curated.description,
  };

  return {
    center,
    financials: curated.financials,
    valuation: { ...curated.valuation, change, changePct },
    segments: curated.segments,
    executives: curated.executives,
    highlights: curated.highlights,
    risks: curated.risks,
    catalysts: curated.catalysts,
  };
}
