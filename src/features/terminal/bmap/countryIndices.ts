/**
 * Curated dataset of flagship equity indices by country and a deterministic
 * generator that ticks each index with a day-over-day price change.  The
 * results feed two consumers:
 *
 *   1.  The BMAP map heatmap layer (choropleth coloured by day change).
 *   2.  The shared terminal-tool registry as `WEI` (World Equity Indices)
 *       so quant agents can ask for a global snapshot in plain text.
 *
 * ISO-3 codes align with Natural-Earth / johan-world-geo-json boundaries so
 * the choropleth joins correctly on the client.
 */

export interface CountryIndex {
  iso3: string;            // matches GeoJSON feature id / ISO_A3
  country: string;
  index: string;           // e.g. "S&P 500"
  ticker: string;          // e.g. "SPX"
  currency: string;        // ISO-4217
  basePrice: number;       // reference level used when regenerating prices
}

export interface IndexSnapshot extends CountryIndex {
  price: number;           // current level (base + walk)
  changePct: number;       // daily change in %
  changeAbs: number;       // daily absolute change
  ytdPct: number;          // year-to-date return
  prevClose: number;       // derived: price / (1 + changePct/100)
}

/* --------------------------- curated universe ---------------------------- */
/* Prices are late-2025 ball-park figures. They act as an anchor the         */
/* per-seed walk centres around; replace with a live feed later.             */

export const COUNTRY_INDICES: CountryIndex[] = [
  /* ------------- Americas ------------- */
  { iso3: 'USA', country: 'United States',  index: 'S&P 500',          ticker: 'SPX',    currency: 'USD', basePrice: 5_700 },
  { iso3: 'CAN', country: 'Canada',         index: 'S&P/TSX Composite', ticker: 'SPTSX', currency: 'CAD', basePrice: 24_200 },
  { iso3: 'MEX', country: 'Mexico',         index: 'IPC BMV',           ticker: 'MEXBOL',currency: 'MXN', basePrice: 52_400 },
  { iso3: 'BRA', country: 'Brazil',         index: 'Ibovespa',          ticker: 'IBOV',  currency: 'BRL', basePrice: 132_600 },
  { iso3: 'ARG', country: 'Argentina',      index: 'Merval',            ticker: 'MERVAL',currency: 'ARS', basePrice: 1_784_000 },
  { iso3: 'CHL', country: 'Chile',          index: 'S&P IPSA',          ticker: 'IPSA',  currency: 'CLP', basePrice: 7_350 },
  { iso3: 'COL', country: 'Colombia',       index: 'COLCAP',            ticker: 'COLCAP',currency: 'COP', basePrice: 1_440 },
  { iso3: 'PER', country: 'Peru',           index: 'S&P/BVL Peru Gen',  ticker: 'SPBLPGPT', currency: 'PEN', basePrice: 26_300 },

  /* ------------- Europe ------------- */
  { iso3: 'GBR', country: 'United Kingdom', index: 'FTSE 100',          ticker: 'UKX',   currency: 'GBP', basePrice: 8_240 },
  { iso3: 'DEU', country: 'Germany',        index: 'DAX',               ticker: 'DAX',   currency: 'EUR', basePrice: 19_600 },
  { iso3: 'FRA', country: 'France',         index: 'CAC 40',            ticker: 'CAC',   currency: 'EUR', basePrice: 7_530 },
  { iso3: 'ITA', country: 'Italy',          index: 'FTSE MIB',          ticker: 'FTSEMIB', currency: 'EUR', basePrice: 34_600 },
  { iso3: 'ESP', country: 'Spain',          index: 'IBEX 35',           ticker: 'IBEX',  currency: 'EUR', basePrice: 11_750 },
  { iso3: 'PRT', country: 'Portugal',       index: 'PSI 20',            ticker: 'PSI20', currency: 'EUR', basePrice: 6_750 },
  { iso3: 'NLD', country: 'Netherlands',    index: 'AEX',               ticker: 'AEX',   currency: 'EUR', basePrice: 915 },
  { iso3: 'BEL', country: 'Belgium',        index: 'BEL 20',            ticker: 'BEL20', currency: 'EUR', basePrice: 4_310 },
  { iso3: 'CHE', country: 'Switzerland',    index: 'SMI',               ticker: 'SMI',   currency: 'CHF', basePrice: 11_880 },
  { iso3: 'AUT', country: 'Austria',        index: 'ATX',               ticker: 'ATX',   currency: 'EUR', basePrice: 3_690 },
  { iso3: 'IRL', country: 'Ireland',        index: 'ISEQ 20',           ticker: 'ISEQ20', currency: 'EUR', basePrice: 1_870 },
  { iso3: 'SWE', country: 'Sweden',         index: 'OMX Stockholm 30',  ticker: 'OMXS30',currency: 'SEK', basePrice: 2_520 },
  { iso3: 'NOR', country: 'Norway',         index: 'OBX',               ticker: 'OBX',   currency: 'NOK', basePrice: 1_370 },
  { iso3: 'FIN', country: 'Finland',        index: 'OMX Helsinki 25',   ticker: 'OMXH25',currency: 'EUR', basePrice: 4_090 },
  { iso3: 'DNK', country: 'Denmark',        index: 'OMX Copenhagen 25', ticker: 'OMXC25',currency: 'DKK', basePrice: 2_280 },
  { iso3: 'ISL', country: 'Iceland',        index: 'OMX Iceland',       ticker: 'OMXI10',currency: 'ISK', basePrice: 2_250 },
  { iso3: 'POL', country: 'Poland',         index: 'WIG20',             ticker: 'WIG20', currency: 'PLN', basePrice: 2_460 },
  { iso3: 'CZE', country: 'Czech Republic', index: 'PX',                ticker: 'PX',    currency: 'CZK', basePrice: 1_650 },
  { iso3: 'HUN', country: 'Hungary',        index: 'BUX',               ticker: 'BUX',   currency: 'HUF', basePrice: 76_900 },
  { iso3: 'ROU', country: 'Romania',        index: 'BET',               ticker: 'BET',   currency: 'RON', basePrice: 17_400 },
  { iso3: 'GRC', country: 'Greece',         index: 'ASE General',       ticker: 'ASE',   currency: 'EUR', basePrice: 1_470 },
  { iso3: 'TUR', country: 'Turkey',         index: 'BIST 100',          ticker: 'XU100', currency: 'TRY', basePrice: 10_180 },
  { iso3: 'RUS', country: 'Russia',         index: 'MOEX Russia',       ticker: 'IMOEX', currency: 'RUB', basePrice: 2_760 },
  { iso3: 'UKR', country: 'Ukraine',        index: 'PFTS',              ticker: 'PFTS',  currency: 'UAH', basePrice: 560 },

  /* ------------- Asia-Pacific ------------- */
  { iso3: 'JPN', country: 'Japan',          index: 'Nikkei 225',        ticker: 'NKY',   currency: 'JPY', basePrice: 39_200 },
  { iso3: 'CHN', country: 'China',          index: 'CSI 300',           ticker: 'SHSZ300',currency: 'CNY', basePrice: 3_920 },
  { iso3: 'HKG', country: 'Hong Kong',      index: 'Hang Seng',         ticker: 'HSI',   currency: 'HKD', basePrice: 20_250 },
  { iso3: 'TWN', country: 'Taiwan',         index: 'TAIEX',             ticker: 'TWSE',  currency: 'TWD', basePrice: 22_700 },
  { iso3: 'KOR', country: 'South Korea',    index: 'KOSPI',             ticker: 'KOSPI', currency: 'KRW', basePrice: 2_690 },
  { iso3: 'IND', country: 'India',          index: 'Nifty 50',          ticker: 'NIFTY', currency: 'INR', basePrice: 24_600 },
  { iso3: 'PAK', country: 'Pakistan',       index: 'KSE 100',           ticker: 'KSE100',currency: 'PKR', basePrice: 91_800 },
  { iso3: 'BGD', country: 'Bangladesh',     index: 'DSEX',              ticker: 'DSEX',  currency: 'BDT', basePrice: 5_290 },
  { iso3: 'LKA', country: 'Sri Lanka',      index: 'CSE All Share',     ticker: 'CSEALL',currency: 'LKR', basePrice: 12_900 },
  { iso3: 'IDN', country: 'Indonesia',      index: 'IDX Composite',     ticker: 'JCI',   currency: 'IDR', basePrice: 7_420 },
  { iso3: 'MYS', country: 'Malaysia',       index: 'KLCI',              ticker: 'KLCI',  currency: 'MYR', basePrice: 1_620 },
  { iso3: 'THA', country: 'Thailand',       index: 'SET Index',         ticker: 'SET',   currency: 'THB', basePrice: 1_460 },
  { iso3: 'VNM', country: 'Vietnam',        index: 'VN-Index',          ticker: 'VNINDEX', currency: 'VND', basePrice: 1_280 },
  { iso3: 'PHL', country: 'Philippines',    index: 'PSEi',              ticker: 'PCOMP', currency: 'PHP', basePrice: 6_950 },
  { iso3: 'SGP', country: 'Singapore',      index: 'Straits Times',     ticker: 'STI',   currency: 'SGD', basePrice: 3_580 },
  { iso3: 'AUS', country: 'Australia',      index: 'S&P/ASX 200',       ticker: 'ASX200',currency: 'AUD', basePrice: 8_320 },
  { iso3: 'NZL', country: 'New Zealand',    index: 'S&P/NZX 50',        ticker: 'NZX50', currency: 'NZD', basePrice: 12_720 },

  /* ------------- Middle East ------------- */
  { iso3: 'ISR', country: 'Israel',         index: 'TA-35',             ticker: 'TA35',  currency: 'ILS', basePrice: 2_165 },
  { iso3: 'SAU', country: 'Saudi Arabia',   index: 'Tadawul All Share', ticker: 'TASI',  currency: 'SAR', basePrice: 12_030 },
  { iso3: 'ARE', country: 'UAE',            index: 'ADX General',       ticker: 'ADXGEN',currency: 'AED', basePrice: 9_460 },
  { iso3: 'QAT', country: 'Qatar',          index: 'QE Index',          ticker: 'DSM',   currency: 'QAR', basePrice: 10_510 },
  { iso3: 'KWT', country: 'Kuwait',         index: 'Boursa Kuwait Prem',ticker: 'BKP',   currency: 'KWD', basePrice: 7_840 },
  { iso3: 'OMN', country: 'Oman',           index: 'MSX 30',            ticker: 'MSX30', currency: 'OMR', basePrice: 4_700 },
  { iso3: 'JOR', country: 'Jordan',         index: 'ASE General',       ticker: 'ASEJO', currency: 'JOD', basePrice: 2_520 },
  { iso3: 'IRN', country: 'Iran',           index: 'TEDPIX',            ticker: 'TEDPIX',currency: 'IRR', basePrice: 2_150_000 },

  /* ------------- Africa ------------- */
  { iso3: 'EGY', country: 'Egypt',          index: 'EGX 30',            ticker: 'EGX30', currency: 'EGP', basePrice: 30_700 },
  { iso3: 'MAR', country: 'Morocco',        index: 'MASI',              ticker: 'MASI',  currency: 'MAD', basePrice: 14_420 },
  { iso3: 'ZAF', country: 'South Africa',   index: 'FTSE/JSE Top 40',   ticker: 'TOP40', currency: 'ZAR', basePrice: 73_500 },
  { iso3: 'NGA', country: 'Nigeria',        index: 'NGX All Share',     ticker: 'NGSEASI', currency: 'NGN', basePrice: 97_600 },
  { iso3: 'KEN', country: 'Kenya',          index: 'NSE 20',            ticker: 'NSE20', currency: 'KES', basePrice: 1_895 },
  { iso3: 'GHA', country: 'Ghana',          index: 'GSE Composite',     ticker: 'GSECI', currency: 'GHS', basePrice: 4_430 },
  { iso3: 'TUN', country: 'Tunisia',        index: 'Tunindex',          ticker: 'TUNINDEX', currency: 'TND', basePrice: 10_210 },
];

export const INDEX_BY_ISO3: Record<string, CountryIndex> = Object.fromEntries(
  COUNTRY_INDICES.map((i) => [i.iso3, i]),
);

/* --------------------------- deterministic RNG --------------------------- */

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

/** Normal-ish draw from two uniforms (Box-Muller subset). */
function normal(rng: () => number, mean = 0, stdDev = 1): number {
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/* ---------------------------- snapshot builder --------------------------- */

export interface WeiInput {
  seedSalt?: number;
}

export interface WeiData {
  asOf: string;
  snapshots: IndexSnapshot[];
  /** Quick top / bottom cuts for agent summaries. */
  topGainers: IndexSnapshot[];
  topLosers: IndexSnapshot[];
}

export function generateWeiData(input: WeiInput = {}): WeiData {
  const rng = makeRng(`wei:${input.seedSalt ?? 0}`);
  const snapshots: IndexSnapshot[] = COUNTRY_INDICES.map((idx) => {
    // Daily change ~ N(0, 1.1%). Occasionally fat-tailed outliers.
    const tail = rng() < 0.06 ? (rng() < 0.5 ? -1 : 1) * (1.5 + rng() * 2.5) : 0;
    const changePct = Number((normal(rng, 0, 1.1) + tail).toFixed(2));
    const ytdPct = Number((normal(rng, 6, 12) + (rng() < 0.5 ? 0 : rng() * 4)).toFixed(2));
    const price = Number((idx.basePrice * (1 + changePct / 100)).toFixed(2));
    const prevClose = idx.basePrice;
    const changeAbs = Number((price - prevClose).toFixed(2));
    return {
      ...idx,
      price,
      prevClose,
      changePct,
      changeAbs,
      ytdPct,
    };
  });

  const sortedByChg = [...snapshots].sort((a, b) => b.changePct - a.changePct);
  const asOf = new Date().toISOString().slice(0, 10);
  return {
    asOf,
    snapshots,
    topGainers: sortedByChg.slice(0, 5),
    topLosers: sortedByChg.slice(-5).reverse(),
  };
}

/* --------------------------- heatmap color scale ------------------------- */

/**
 * Finance-style heatmap colour.  Bucketed for perceptual clarity on a world
 * choropleth (continuous gradients wash out on large map areas).
 */
export function heatmapFill(changePct: number | null | undefined, alpha = 0.7): string {
  if (changePct === null || changePct === undefined || Number.isNaN(changePct)) {
    return `rgba(39, 39, 42, ${alpha * 0.55})`; // no data — neutral gray
  }
  // Discrete buckets: ±0.25, ±0.75, ±1.5, ±3.
  const p = changePct;
  const a = alpha;
  if (p >= 3)    return `rgba(5, 122, 85, ${a})`;    // deep green
  if (p >= 1.5)  return `rgba(16, 185, 129, ${a})`;  // green
  if (p >= 0.75) return `rgba(52, 211, 153, ${a})`;  // light green
  if (p >= 0.25) return `rgba(110, 231, 183, ${a * 0.85})`; // pale green
  if (p > -0.25) return `rgba(113, 113, 122, ${a * 0.6})`;  // flat
  if (p > -0.75) return `rgba(252, 165, 165, ${a * 0.85})`; // pale red
  if (p > -1.5)  return `rgba(239, 68, 68, ${a * 0.9})`;    // red
  if (p > -3)    return `rgba(220, 38, 38, ${a})`;          // strong red
  return `rgba(153, 27, 27, ${a})`;                         // deep red
}

/** Border/stroke colour that still reads on dark tiles. */
export function heatmapStroke(changePct: number | null | undefined): string {
  if (changePct === null || changePct === undefined || Number.isNaN(changePct)) {
    return '#27272a';
  }
  return changePct >= 0 ? '#10b981' : '#ef4444';
}

/** Legend buckets — used by both the map and the agent description. */
export const HEATMAP_LEGEND = [
  { label: '≥ +3%',   color: 'rgba(5, 122, 85, 0.8)' },
  { label: '+1.5%',   color: 'rgba(16, 185, 129, 0.8)' },
  { label: '+0.75%',  color: 'rgba(52, 211, 153, 0.8)' },
  { label: '+0.25%',  color: 'rgba(110, 231, 183, 0.7)' },
  { label: 'Flat',    color: 'rgba(113, 113, 122, 0.5)' },
  { label: '-0.25%',  color: 'rgba(252, 165, 165, 0.7)' },
  { label: '-0.75%',  color: 'rgba(239, 68, 68, 0.8)' },
  { label: '-1.5%',   color: 'rgba(220, 38, 38, 0.9)' },
  { label: '≤ -3%',   color: 'rgba(153, 27, 27, 1.0)' },
] as const;
