/**
 * Mock dataset for the Bloomberg-style BMAP (Commodity Map) function.
 *
 * BMAP layers real-world commodity assets onto an interactive map:
 *   - Oil / gas fields
 *   - Pipelines (natural gas, crude oil)
 *   - Refineries & LNG terminals
 *   - Mines (coal, copper, uranium, gold)
 *   - Ports
 *   - Vessels (tankers, LNG carriers, bulkers)
 *   - Wind farms
 *   - Tropical storms (real-time weather overlay)
 *
 * Coordinates are approximate but match real-world asset locations so the
 * map reads plausibly.  Prices / statuses are randomised at generation time
 * from a deterministic seed.
 */

export type LonLat = [number, number]; // [lng, lat]
export type LatLng = [number, number]; // [lat, lng] — flipped to [lng, lat] in BmapView for GeoJSON

export type AssetLayerId =
  | 'oilFields'
  | 'gasFields'
  | 'refineries'
  | 'lng'
  | 'mines'
  | 'pipelines'
  | 'shaleBasins'
  | 'ports'
  | 'vessels'
  | 'windFarms'
  | 'storms';

export interface AssetLayerMeta {
  id: AssetLayerId;
  label: string;
  description: string;
  /** CSS hex used for marker fill / line stroke */
  color: string;
  /** Short code shown in legend / popup */
  code: string;
}

export const LAYER_META: Record<AssetLayerId, AssetLayerMeta> = {
  oilFields: {
    id: 'oilFields',
    label: 'Oil Fields',
    description: 'Producing & development crude oil fields',
    color: '#f97316',
    code: 'OIL',
  },
  gasFields: {
    id: 'gasFields',
    label: 'Gas Fields',
    description: 'Producing & development natural gas fields',
    color: '#dc2626',
    code: 'GAS',
  },
  refineries: {
    id: 'refineries',
    label: 'Refineries',
    description: 'Crude refineries & petrochemical plants',
    color: '#eab308',
    code: 'REF',
  },
  lng: {
    id: 'lng',
    label: 'LNG Terminals',
    description: 'Liquefaction / regasification terminals',
    color: '#22d3ee',
    code: 'LNG',
  },
  mines: {
    id: 'mines',
    label: 'Mines',
    description: 'Coal, copper, uranium & gold mines',
    color: '#a78bfa',
    code: 'MIN',
  },
  pipelines: {
    id: 'pipelines',
    label: 'Pipelines',
    description: 'Major crude oil & natural gas pipelines',
    color: '#ef4444',
    code: 'PIPE',
  },
  shaleBasins: {
    id: 'shaleBasins',
    label: 'Shale Basins',
    description: 'Major unconventional hydrocarbon basins',
    color: '#3b82f6',
    code: 'SHALE',
  },
  ports: {
    id: 'ports',
    label: 'Ports',
    description: 'Major commodity shipping ports',
    color: '#38bdf8',
    code: 'PORT',
  },
  vessels: {
    id: 'vessels',
    label: 'Vessels',
    description: 'Tankers, LNG carriers & bulk carriers',
    color: '#ff9f1a',
    code: 'VSL',
  },
  windFarms: {
    id: 'windFarms',
    label: 'Wind Farms',
    description: 'Onshore & offshore wind capacity',
    color: '#10b981',
    code: 'WND',
  },
  storms: {
    id: 'storms',
    label: 'Storms',
    description: 'Active tropical storms & cyclones',
    color: '#f472b6',
    code: 'STM',
  },
};

export const LAYER_ORDER: AssetLayerId[] = [
  'oilFields',
  'gasFields',
  'pipelines',
  'shaleBasins',
  'refineries',
  'lng',
  'mines',
  'ports',
  'vessels',
  'windFarms',
  'storms',
];

/* ---------------------------------- data ---------------------------------- */

export interface PointAsset {
  id: string;
  name: string;
  country: string;
  position: LatLng;
  /** Free-form KV pairs shown in the popup */
  props: Array<{ label: string; value: string; tone?: 'good' | 'bad' | 'neutral' | 'warn' }>;
}

export interface LineAsset {
  id: string;
  name: string;
  path: LatLng[];
  kind: 'oil' | 'gas';
  operator: string;
  capacityMbd?: number; // oil million bbl / day
  capacityBcfd?: number; // gas billion cf / day
}

export interface BasinAsset {
  id: string;
  name: string;
  country: string;
  /** Simple ring of points for a polygon. */
  ring: LatLng[];
  resource: 'oil' | 'gas' | 'mixed';
}

export interface VesselAsset {
  id: string;
  name: string;
  flag: string;
  type: 'VLCC' | 'Suezmax' | 'Aframax' | 'LNG' | 'Bulker';
  dwt: number; // deadweight tonnes (k)
  cargo: string;
  destination: string;
  eta: string;
  speedKts: number;
  headingDeg: number;
  position: LatLng;
}

export interface StormAsset {
  id: string;
  name: string;
  category: 1 | 2 | 3 | 4 | 5 | 0; // 0 = TS
  windMph: number;
  position: LatLng;
  track: LatLng[];
}

export interface BmapData {
  oilFields: PointAsset[];
  gasFields: PointAsset[];
  refineries: PointAsset[];
  lng: PointAsset[];
  mines: PointAsset[];
  ports: PointAsset[];
  windFarms: PointAsset[];
  pipelines: LineAsset[];
  shaleBasins: BasinAsset[];
  vessels: VesselAsset[];
  storms: StormAsset[];
}

/* ---------------------------- seeded randomness --------------------------- */

function makeRng(seedStr: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i += 1) {
    h ^= seedStr.charCodeAt(i);
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

/* ------------------------------ static tables ----------------------------- */

const OIL_FIELDS: Array<Omit<PointAsset, 'props'> & { prodMbd: number; operator: string }> = [
  { id: 'ghawar', name: 'Ghawar', country: 'Saudi Arabia', position: [25.43, 49.6], prodMbd: 3.8, operator: 'Saudi Aramco' },
  { id: 'safaniya', name: 'Safaniya', country: 'Saudi Arabia', position: [28.0, 48.78], prodMbd: 1.2, operator: 'Saudi Aramco' },
  { id: 'burgan', name: 'Burgan', country: 'Kuwait', position: [28.95, 47.93], prodMbd: 1.6, operator: 'KOC' },
  { id: 'rumaila', name: 'Rumaila', country: 'Iraq', position: [30.45, 47.45], prodMbd: 1.4, operator: 'BP / CNPC' },
  { id: 'azadegan', name: 'Azadegan', country: 'Iran', position: [31.5, 48.08], prodMbd: 0.52, operator: 'NIOC' },
  { id: 'kashagan', name: 'Kashagan', country: 'Kazakhstan', position: [46.55, 51.3], prodMbd: 0.38, operator: 'NCOC' },
  { id: 'tengiz', name: 'Tengiz', country: 'Kazakhstan', position: [46.12, 53.5], prodMbd: 0.7, operator: 'TCO' },
  { id: 'prudhoe', name: 'Prudhoe Bay', country: 'USA', position: [70.25, -148.33], prodMbd: 0.28, operator: 'BP' },
  { id: 'cantarell', name: 'Cantarell', country: 'Mexico', position: [19.43, -92.12], prodMbd: 0.13, operator: 'Pemex' },
  { id: 'lula', name: 'Lula (Tupi)', country: 'Brazil', position: [-25.37, -42.8], prodMbd: 1.02, operator: 'Petrobras' },
  { id: 'bonga', name: 'Bonga', country: 'Nigeria', position: [4.42, 5.0], prodMbd: 0.19, operator: 'Shell' },
  { id: 'daqing', name: 'Daqing', country: 'China', position: [46.58, 125.0], prodMbd: 0.78, operator: 'PetroChina' },
  { id: 'samotlor', name: 'Samotlor', country: 'Russia', position: [60.7, 76.9], prodMbd: 0.52, operator: 'Rosneft' },
  { id: 'priobskoye', name: 'Priobskoye', country: 'Russia', position: [60.9, 68.9], prodMbd: 0.7, operator: 'Rosneft' },
  { id: 'bab', name: 'Bab', country: 'UAE', position: [23.87, 54.0], prodMbd: 0.37, operator: 'ADNOC' },
  { id: 'wafra', name: 'Wafra', country: 'Kuwait/Saudi', position: [28.4, 48.1], prodMbd: 0.2, operator: 'KGOC / Chevron' },
];

const GAS_FIELDS: Array<Omit<PointAsset, 'props'> & { prodBcfd: number; operator: string }> = [
  { id: 'north-field', name: 'North Field', country: 'Qatar', position: [26.6, 52.1], prodBcfd: 18.5, operator: 'QatarEnergy' },
  { id: 'south-pars', name: 'South Pars', country: 'Iran', position: [26.3, 52.0], prodBcfd: 24.0, operator: 'NIOC' },
  { id: 'groningen', name: 'Groningen', country: 'Netherlands', position: [53.2, 6.7], prodBcfd: 0.8, operator: 'NAM' },
  { id: 'urengoy', name: 'Urengoy', country: 'Russia', position: [65.97, 78.37], prodBcfd: 22.0, operator: 'Gazprom' },
  { id: 'yamburg', name: 'Yamburg', country: 'Russia', position: [67.8, 75.3], prodBcfd: 14.0, operator: 'Gazprom' },
  { id: 'bovanenkovo', name: 'Bovanenkovo', country: 'Russia', position: [70.45, 68.5], prodBcfd: 10.0, operator: 'Gazprom' },
  { id: 'haynesville-hub', name: 'Haynesville Hub', country: 'USA', position: [32.7, -93.6], prodBcfd: 14.5, operator: 'Various' },
  { id: 'marcellus-hub', name: 'Marcellus Hub', country: 'USA', position: [41.0, -77.9], prodBcfd: 36.0, operator: 'Various' },
  { id: 'gorgon', name: 'Gorgon', country: 'Australia', position: [-20.68, 115.55], prodBcfd: 2.1, operator: 'Chevron' },
  { id: 'ichthys', name: 'Ichthys', country: 'Australia', position: [-13.78, 123.5], prodBcfd: 1.3, operator: 'Inpex' },
  { id: 'galkynysh', name: 'Galkynysh', country: 'Turkmenistan', position: [37.8, 62.6], prodBcfd: 8.0, operator: 'Türkmengaz' },
  { id: 'leviathan', name: 'Leviathan', country: 'Israel', position: [33.05, 34.5], prodBcfd: 1.2, operator: 'NewMed' },
];

const REFINERIES: Array<Omit<PointAsset, 'props'> & { capKbd: number; operator: string }> = [
  { id: 'jamnagar', name: 'Jamnagar', country: 'India', position: [22.35, 69.8], capKbd: 1240, operator: 'Reliance' },
  { id: 'ulsan', name: 'Ulsan', country: 'South Korea', position: [35.52, 129.35], capKbd: 840, operator: 'SK Energy' },
  { id: 'paraguana', name: 'Paraguaná', country: 'Venezuela', position: [11.72, -70.2], capKbd: 955, operator: 'PDVSA' },
  { id: 'ras-tanura', name: 'Ras Tanura', country: 'Saudi Arabia', position: [26.65, 50.16], capKbd: 550, operator: 'Aramco' },
  { id: 'port-arthur', name: 'Port Arthur', country: 'USA', position: [29.87, -93.92], capKbd: 640, operator: 'Motiva' },
  { id: 'baytown', name: 'Baytown', country: 'USA', position: [29.74, -94.97], capKbd: 584, operator: 'ExxonMobil' },
  { id: 'garyville', name: 'Garyville', country: 'USA', position: [30.05, -90.62], capKbd: 597, operator: 'Marathon' },
  { id: 'rotterdam', name: 'Pernis (Rotterdam)', country: 'Netherlands', position: [51.88, 4.38], capKbd: 416, operator: 'Shell' },
  { id: 'singapore-jurong', name: 'Jurong Island', country: 'Singapore', position: [1.26, 103.7], capKbd: 592, operator: 'ExxonMobil' },
  { id: 'mailiao', name: 'Mailiao', country: 'Taiwan', position: [23.8, 120.19], capKbd: 540, operator: 'Formosa' },
];

const LNG_TERMINALS: Array<Omit<PointAsset, 'props'> & { capMtpa: number; kind: 'export' | 'import'; operator: string }> = [
  { id: 'ras-laffan', name: 'Ras Laffan', country: 'Qatar', position: [25.92, 51.58], capMtpa: 77, kind: 'export', operator: 'QatarEnergy' },
  { id: 'sabine-pass', name: 'Sabine Pass', country: 'USA', position: [29.73, -93.87], capMtpa: 30, kind: 'export', operator: 'Cheniere' },
  { id: 'corpus-christi', name: 'Corpus Christi', country: 'USA', position: [27.87, -97.22], capMtpa: 15, kind: 'export', operator: 'Cheniere' },
  { id: 'gladstone', name: 'Gladstone', country: 'Australia', position: [-23.83, 151.26], capMtpa: 25, kind: 'export', operator: 'Santos' },
  { id: 'arzew', name: 'Arzew', country: 'Algeria', position: [35.85, -0.32], capMtpa: 18, kind: 'export', operator: 'Sonatrach' },
  { id: 'yamal-lng', name: 'Yamal LNG', country: 'Russia', position: [71.26, 72.07], capMtpa: 17.4, kind: 'export', operator: 'Novatek' },
  { id: 'zeebrugge', name: 'Zeebrugge', country: 'Belgium', position: [51.34, 3.2], capMtpa: 9, kind: 'import', operator: 'Fluxys' },
  { id: 'senboku', name: 'Senboku', country: 'Japan', position: [34.55, 135.43], capMtpa: 12, kind: 'import', operator: 'Osaka Gas' },
  { id: 'dahej', name: 'Dahej', country: 'India', position: [21.71, 72.57], capMtpa: 17.5, kind: 'import', operator: 'Petronet' },
  { id: 'rovigo', name: 'Adriatic', country: 'Italy', position: [45.03, 12.6], capMtpa: 8, kind: 'import', operator: 'Terminale GNL' },
];

const MINES: Array<Omit<PointAsset, 'props'> & { commodity: string; prod: string; operator: string }> = [
  { id: 'escondida', name: 'Escondida', country: 'Chile', position: [-24.26, -69.08], commodity: 'Copper', prod: '1.1 Mt/y', operator: 'BHP' },
  { id: 'grasberg', name: 'Grasberg', country: 'Indonesia', position: [-4.05, 137.12], commodity: 'Copper/Gold', prod: '0.8 Mt/y', operator: 'Freeport' },
  { id: 'olympic-dam', name: 'Olympic Dam', country: 'Australia', position: [-30.44, 136.88], commodity: 'Copper/Uranium', prod: '0.22 Mt/y', operator: 'BHP' },
  { id: 'nevada-gold', name: 'Carlin Trend', country: 'USA', position: [40.95, -116.3], commodity: 'Gold', prod: '3.2 Moz/y', operator: 'Barrick/Newmont' },
  { id: 'mponeng', name: 'Mponeng', country: 'South Africa', position: [-26.43, 27.44], commodity: 'Gold', prod: '0.25 Moz/y', operator: 'Harmony' },
  { id: 'mcarthur-river', name: 'McArthur River', country: 'Canada', position: [57.76, -105.04], commodity: 'Uranium', prod: '18 Mlb/y', operator: 'Cameco' },
  { id: 'carajas', name: 'Carajás', country: 'Brazil', position: [-6.05, -50.18], commodity: 'Iron Ore', prod: '180 Mt/y', operator: 'Vale' },
  { id: 'shenhua', name: 'Shendong', country: 'China', position: [38.9, 110.1], commodity: 'Coal', prod: '215 Mt/y', operator: 'Shenhua' },
  { id: 'kuzbass', name: 'Kuzbass', country: 'Russia', position: [54.3, 86.2], commodity: 'Coal', prod: '210 Mt/y', operator: 'Various' },
  { id: 'bowen', name: 'Bowen Basin', country: 'Australia', position: [-21.8, 148.3], commodity: 'Coking Coal', prod: '240 Mt/y', operator: 'Various' },
];

const PORTS: Array<Omit<PointAsset, 'props'> & { teu: string }> = [
  { id: 'fujairah', name: 'Fujairah', country: 'UAE', position: [25.12, 56.35], teu: 'Bunker hub' },
  { id: 'rotterdam-p', name: 'Rotterdam', country: 'Netherlands', position: [51.9, 4.47], teu: '14.5M TEU' },
  { id: 'shanghai', name: 'Shanghai', country: 'China', position: [31.2, 121.48], teu: '47.3M TEU' },
  { id: 'singapore-p', name: 'Singapore', country: 'Singapore', position: [1.265, 103.82], teu: '37.3M TEU' },
  { id: 'houston-p', name: 'Houston', country: 'USA', position: [29.72, -95.05], teu: '4.1M TEU' },
  { id: 'panama', name: 'Balboa', country: 'Panama', position: [8.95, -79.57], teu: '3.5M TEU' },
  { id: 'suez-port', name: 'Port Said', country: 'Egypt', position: [31.25, 32.3], teu: '3.9M TEU' },
  { id: 'busan-p', name: 'Busan', country: 'South Korea', position: [35.1, 129.04], teu: '22.1M TEU' },
];

const WIND_FARMS: Array<Omit<PointAsset, 'props'> & { capMw: number; kind: 'offshore' | 'onshore'; operator: string }> = [
  { id: 'hornsea', name: 'Hornsea', country: 'UK', position: [53.88, 1.8], capMw: 2600, kind: 'offshore', operator: 'Ørsted' },
  { id: 'dogger', name: 'Dogger Bank', country: 'UK', position: [54.77, 2.73], capMw: 3600, kind: 'offshore', operator: 'SSE / Equinor' },
  { id: 'gemini', name: 'Gemini', country: 'Netherlands', position: [54.03, 5.97], capMw: 600, kind: 'offshore', operator: 'Northland' },
  { id: 'vineyard', name: 'Vineyard Wind 1', country: 'USA', position: [41.07, -70.62], capMw: 800, kind: 'offshore', operator: 'Avangrid' },
  { id: 'altamont', name: 'Altamont Pass', country: 'USA', position: [37.73, -121.65], capMw: 576, kind: 'onshore', operator: 'NextEra' },
  { id: 'gansu-wf', name: 'Gansu Wind', country: 'China', position: [40.14, 97.2], capMw: 8000, kind: 'onshore', operator: 'CGN' },
  { id: 'markbygden', name: 'Markbygden', country: 'Sweden', position: [65.58, 20.6], capMw: 1100, kind: 'onshore', operator: 'Svevind' },
];

const PIPELINES_RAW: Array<Omit<LineAsset, 'id'>> = [
  {
    name: 'Druzhba Pipeline',
    kind: 'oil',
    operator: 'Transneft',
    capacityMbd: 1.2,
    path: [
      [52.72, 52.08], // Samara
      [53.2, 45.0],
      [52.4, 31.0],
      [51.5, 23.5], // Belarus
      [52.22, 21.0], // Warsaw area
      [51.34, 12.37], // Leipzig
    ],
  },
  {
    name: 'Trans-Alaska Pipeline',
    kind: 'oil',
    operator: 'Alyeska',
    capacityMbd: 2.1,
    path: [
      [70.25, -148.33],
      [64.84, -147.72],
      [61.22, -149.9],
      [60.1, -149.45],
    ],
  },
  {
    name: 'TurkStream',
    kind: 'gas',
    operator: 'Gazprom',
    capacityBcfd: 3.1,
    path: [
      [45.25, 37.0],
      [43.5, 35.2],
      [41.8, 32.0],
      [41.06, 28.97], // Istanbul
    ],
  },
  {
    name: 'Nord Stream',
    kind: 'gas',
    operator: 'Nord Stream AG',
    capacityBcfd: 5.5,
    path: [
      [60.06, 29.3],
      [59.6, 25.5],
      [58.8, 20.0],
      [55.5, 15.5],
      [54.1, 13.6],
    ],
  },
  {
    name: 'Keystone Pipeline',
    kind: 'oil',
    operator: 'TC Energy',
    capacityMbd: 0.59,
    path: [
      [57.0, -111.3], // Alberta
      [49.8, -97.14],
      [44.5, -100.0],
      [38.88, -94.68],
      [29.74, -94.97], // Houston
    ],
  },
  {
    name: 'Trans-Saharan',
    kind: 'gas',
    operator: 'Sonatrach / NNPC',
    capacityBcfd: 2.9,
    path: [
      [9.0, 8.67], // Nigeria
      [16.77, 3.0], // Niger
      [22.0, 3.4],
      [28.0, 2.8],
      [35.85, -0.32], // Arzew
    ],
  },
  {
    name: 'West-East Gas Pipeline',
    kind: 'gas',
    operator: 'PetroChina',
    capacityBcfd: 3.9,
    path: [
      [41.0, 80.0],
      [39.0, 95.0],
      [36.1, 103.8],
      [34.3, 108.9],
      [31.23, 121.47],
    ],
  },
];

const SHALE_BASINS_RAW: Array<Omit<BasinAsset, 'id'>> = [
  {
    name: 'Permian Basin',
    country: 'USA',
    resource: 'mixed',
    ring: [
      [32.5, -104.5],
      [32.5, -101.0],
      [30.0, -101.0],
      [30.0, -104.5],
    ],
  },
  {
    name: 'Marcellus',
    country: 'USA',
    resource: 'gas',
    ring: [
      [43.0, -79.5],
      [43.0, -74.5],
      [39.5, -74.5],
      [39.5, -79.5],
    ],
  },
  {
    name: 'Bakken',
    country: 'USA',
    resource: 'oil',
    ring: [
      [49.0, -104.5],
      [49.0, -101.5],
      [47.0, -101.5],
      [47.0, -104.5],
    ],
  },
  {
    name: 'Vaca Muerta',
    country: 'Argentina',
    resource: 'mixed',
    ring: [
      [-37.5, -70.5],
      [-37.5, -68.5],
      [-39.5, -68.5],
      [-39.5, -70.5],
    ],
  },
  {
    name: 'Sichuan Basin',
    country: 'China',
    resource: 'gas',
    ring: [
      [31.5, 103.5],
      [31.5, 107.5],
      [28.0, 107.5],
      [28.0, 103.5],
    ],
  },
];

const FLAG_POOL = ['LR', 'PA', 'MH', 'SG', 'MT', 'BS', 'HK', 'GR', 'NO', 'CY'];
const CARGO_POOL = ['Crude', 'Crude', 'Fuel Oil', 'Diesel', 'LNG', 'LPG', 'Iron Ore', 'Coal', 'Grain'];
const DEST_POOL = ['Rotterdam', 'Singapore', 'Ningbo', 'Houston', 'Ras Tanura', 'Yokohama', 'Mumbai', 'Algeciras', 'Suez'];
const VESSEL_PREFIXES = ['Sea', 'Star', 'Ocean', 'Pacific', 'Atlantic', 'Golden', 'Eagle', 'Crimson', 'Aurora', 'Meridian'];
const VESSEL_SUFFIXES = ['Voyager', 'Pioneer', 'Horizon', 'Trader', 'Navigator', 'Crescent', 'Sovereign', 'Phoenix', 'Beacon'];

const VESSEL_HOTSPOTS: Array<{ center: LatLng; spread: number; count: number }> = [
  { center: [26.0, 56.5], spread: 2, count: 22 }, // Strait of Hormuz
  { center: [30.0, 32.5], spread: 1.4, count: 8 }, // Suez
  { center: [9.3, -79.8], spread: 1.2, count: 6 }, // Panama
  { center: [1.4, 104.5], spread: 3, count: 18 }, // Malacca
  { center: [51.9, 3.0], spread: 2.2, count: 10 }, // North Sea
  { center: [29.6, -94.0], spread: 2.5, count: 14 }, // US Gulf
  { center: [-22.0, 43.0], spread: 6, count: 10 }, // Mozambique channel
  { center: [37.0, -40.0], spread: 10, count: 12 }, // N Atlantic
];

const STORMS_STATIC: Omit<StormAsset, 'id'>[] = [
  {
    name: 'TS Aida',
    category: 2,
    windMph: 105,
    position: [21.5, -80.5],
    track: [
      [17.0, -65.0],
      [18.8, -72.0],
      [20.2, -77.0],
      [21.5, -80.5],
      [24.0, -84.0],
      [27.0, -86.5],
      [30.0, -88.0],
    ],
  },
  {
    name: 'TY Hiroshi',
    category: 3,
    windMph: 130,
    position: [18.0, 132.0],
    track: [
      [13.0, 142.0],
      [15.0, 138.0],
      [17.0, 135.0],
      [18.0, 132.0],
      [20.5, 128.0],
      [23.0, 124.0],
      [26.5, 122.0],
    ],
  },
  {
    name: 'TC Bruno',
    category: 1,
    windMph: 80,
    position: [-18.0, 68.0],
    track: [
      [-12.0, 75.0],
      [-14.5, 72.0],
      [-16.0, 70.0],
      [-18.0, 68.0],
      [-20.5, 65.0],
      [-23.0, 62.5],
    ],
  },
];

/* ------------------------------ generation -------------------------------- */

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function jitter(rng: () => number, v: number, spread: number): number {
  return v + (rng() - 0.5) * 2 * spread;
}

function fmtMoney(n: number): string {
  return n >= 1 ? `$${n.toFixed(2)}` : `$${(n * 100).toFixed(1)}¢`;
}

function prodTone(pct: number): 'good' | 'bad' | 'warn' {
  if (pct > 1.5) return 'good';
  if (pct < -1.5) return 'bad';
  return 'warn';
}

function generateVessels(rng: () => number): VesselAsset[] {
  const out: VesselAsset[] = [];
  let counter = 0;
  for (const hot of VESSEL_HOTSPOTS) {
    for (let i = 0; i < hot.count; i += 1) {
      const type: VesselAsset['type'] = pick(rng, ['VLCC', 'Suezmax', 'Aframax', 'LNG', 'Bulker'] as const);
      const dwt =
        type === 'VLCC' ? 280 + Math.floor(rng() * 40)
        : type === 'Suezmax' ? 140 + Math.floor(rng() * 30)
        : type === 'Aframax' ? 100 + Math.floor(rng() * 20)
        : type === 'LNG' ? 170 + Math.floor(rng() * 30)
        : 60 + Math.floor(rng() * 120);
      out.push({
        id: `vsl-${counter++}`,
        name: `${pick(rng, VESSEL_PREFIXES)} ${pick(rng, VESSEL_SUFFIXES)} ${Math.floor(rng() * 99) + 1}`,
        flag: pick(rng, FLAG_POOL),
        type,
        dwt,
        cargo: type === 'LNG' ? 'LNG' : type === 'Bulker' ? pick(rng, ['Iron Ore', 'Coal', 'Grain']) : pick(rng, CARGO_POOL),
        destination: pick(rng, DEST_POOL),
        eta: `${Math.floor(rng() * 20) + 1}d ${Math.floor(rng() * 24)}h`,
        speedKts: Number((rng() * 14 + 2).toFixed(1)),
        headingDeg: Math.floor(rng() * 360),
        position: [jitter(rng, hot.center[0], hot.spread), jitter(rng, hot.center[1], hot.spread)],
      });
    }
  }
  return out;
}

export function generateBmapData(seed = 'BMAP-1'): BmapData {
  const rng = makeRng(seed);

  const oilFields: PointAsset[] = OIL_FIELDS.map((f) => {
    const chg = (rng() * 6 - 3);
    const price = 70 + rng() * 25;
    return {
      id: f.id,
      name: f.name,
      country: f.country,
      position: f.position,
      props: [
        { label: 'Operator', value: f.operator },
        { label: 'Production', value: `${f.prodMbd.toFixed(2)} mbd` },
        { label: 'Brent ref', value: `$${price.toFixed(2)}` },
        { label: 'Δ 1d', value: `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`, tone: prodTone(chg) },
      ],
    };
  });

  const gasFields: PointAsset[] = GAS_FIELDS.map((f) => {
    const chg = (rng() * 6 - 3);
    const hh = 2 + rng() * 3;
    return {
      id: f.id,
      name: f.name,
      country: f.country,
      position: f.position,
      props: [
        { label: 'Operator', value: f.operator },
        { label: 'Production', value: `${f.prodBcfd.toFixed(1)} Bcf/d` },
        { label: 'Henry Hub', value: fmtMoney(hh) },
        { label: 'Δ 1d', value: `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`, tone: prodTone(chg) },
      ],
    };
  });

  const refineries: PointAsset[] = REFINERIES.map((r) => {
    const util = 78 + rng() * 20;
    return {
      id: r.id,
      name: r.name,
      country: r.country,
      position: r.position,
      props: [
        { label: 'Operator', value: r.operator },
        { label: 'Capacity', value: `${r.capKbd} kbd` },
        { label: 'Utilisation', value: `${util.toFixed(1)}%`, tone: util > 90 ? 'good' : util < 82 ? 'warn' : 'neutral' },
        { label: 'Status', value: rng() > 0.1 ? 'Online' : 'Turnaround', tone: rng() > 0.1 ? 'good' : 'warn' },
      ],
    };
  });

  const lng: PointAsset[] = LNG_TERMINALS.map((t) => {
    const util = 72 + rng() * 25;
    return {
      id: t.id,
      name: t.name,
      country: t.country,
      position: t.position,
      props: [
        { label: 'Type', value: t.kind === 'export' ? 'Liquefaction' : 'Regasification' },
        { label: 'Operator', value: t.operator },
        { label: 'Capacity', value: `${t.capMtpa} MTPA` },
        { label: 'Utilisation', value: `${util.toFixed(0)}%`, tone: util > 88 ? 'good' : 'neutral' },
      ],
    };
  });

  const mines: PointAsset[] = MINES.map((m) => {
    const chg = (rng() * 8 - 4);
    return {
      id: m.id,
      name: m.name,
      country: m.country,
      position: m.position,
      props: [
        { label: 'Commodity', value: m.commodity },
        { label: 'Operator', value: m.operator },
        { label: 'Production', value: m.prod },
        { label: 'Spot Δ 1d', value: `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`, tone: prodTone(chg) },
      ],
    };
  });

  const ports: PointAsset[] = PORTS.map((p) => ({
    id: p.id,
    name: p.name,
    country: p.country,
    position: p.position,
    props: [
      { label: 'Throughput', value: p.teu },
      { label: 'Waiting', value: `${Math.floor(rng() * 40) + 5} vessels` },
      { label: 'Avg wait', value: `${(rng() * 3 + 0.4).toFixed(1)}d` },
    ],
  }));

  const windFarms: PointAsset[] = WIND_FARMS.map((w) => {
    const load = 28 + rng() * 40;
    return {
      id: w.id,
      name: w.name,
      country: w.country,
      position: w.position,
      props: [
        { label: 'Type', value: w.kind === 'offshore' ? 'Offshore' : 'Onshore' },
        { label: 'Operator', value: w.operator },
        { label: 'Capacity', value: `${w.capMw.toLocaleString()} MW` },
        { label: 'Load factor', value: `${load.toFixed(1)}%`, tone: load > 45 ? 'good' : 'neutral' },
      ],
    };
  });

  const pipelines: LineAsset[] = PIPELINES_RAW.map((p, i) => ({
    ...p,
    id: `pipe-${i}`,
  }));

  const shaleBasins: BasinAsset[] = SHALE_BASINS_RAW.map((b, i) => ({
    ...b,
    id: `basin-${i}`,
  }));

  const vessels = generateVessels(rng);
  const storms: StormAsset[] = STORMS_STATIC.map((s, i) => ({ ...s, id: `storm-${i}` }));

  return {
    oilFields,
    gasFields,
    refineries,
    lng,
    mines,
    pipelines,
    shaleBasins,
    ports,
    vessels,
    windFarms,
    storms,
  };
}
