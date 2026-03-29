import { useMemo, useRef, useState, useEffect } from 'react';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface StockDatum {
  symbol: string;
  sector: string;
  subsector: string;
  marketCap: number;
  change: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SectorLayout {
  name: string;
  rect: Rect;
  stocks: (StockDatum & { rect: Rect })[];
}

/* ── DJ30 constituents (approx market-cap $B, sample daily Δ%) ─────────── */

const DJ30: StockDatum[] = [
  { symbol: 'AAPL', sector: 'Technology', subsector: 'Consumer Electronics', marketCap: 3400, change: -1.62 },
  { symbol: 'MSFT', sector: 'Technology', subsector: 'Software - Infra.', marketCap: 3100, change: -2.51 },
  { symbol: 'NVDA', sector: 'Technology', subsector: 'Semiconductors', marketCap: 2800, change: -2.17 },
  { symbol: 'CRM',  sector: 'Technology', subsector: 'Software - App.', marketCap: 280, change: -2.10 },
  { symbol: 'CSCO', sector: 'Technology', subsector: 'Comm. Equip.', marketCap: 240, change: -2.73 },
  { symbol: 'IBM',  sector: 'Technology', subsector: 'IT Services', marketCap: 210, change: -2.21 },

  { symbol: 'AMZN', sector: 'Consumer Cyclical', subsector: 'Internet Retail', marketCap: 2100, change: -3.95 },
  { symbol: 'HD',   sector: 'Consumer Cyclical', subsector: 'Home Improvement', marketCap: 380, change: -2.06 },
  { symbol: 'MCD',  sector: 'Consumer Cyclical', subsector: 'Restaurants', marketCap: 220, change: -0.98 },
  { symbol: 'DIS',  sector: 'Consumer Cyclical', subsector: 'Entertainment', marketCap: 200, change: -2.46 },
  { symbol: 'NKE',  sector: 'Consumer Cyclical', subsector: 'Footwear & Acc.', marketCap: 100, change: -1.37 },

  { symbol: 'JPM',  sector: 'Financial', subsector: 'Banks - Diversified', marketCap: 700, change: -3.02 },
  { symbol: 'V',    sector: 'Financial', subsector: 'Credit Services', marketCap: 620, change: -3.28 },
  { symbol: 'AXP',  sector: 'Financial', subsector: 'Credit Services', marketCap: 200, change: -2.38 },
  { symbol: 'GS',   sector: 'Financial', subsector: 'Capital Markets', marketCap: 180, change: -2.40 },
  { symbol: 'TRV',  sector: 'Financial', subsector: 'Insurance', marketCap: 60, change: -1.50 },

  { symbol: 'UNH',  sector: 'Healthcare', subsector: 'Health Insurance', marketCap: 560, change: -0.37 },
  { symbol: 'JNJ',  sector: 'Healthcare', subsector: 'Drug Mfr. - General', marketCap: 380, change: 0.51 },
  { symbol: 'MRK',  sector: 'Healthcare', subsector: 'Drug Mfr. - General', marketCap: 320, change: 0.59 },
  { symbol: 'AMGN', sector: 'Healthcare', subsector: 'Biotechnology', marketCap: 180, change: -1.24 },

  { symbol: 'WMT',  sector: 'Consumer Defensive', subsector: 'Discount Stores', marketCap: 600, change: 0.58 },
  { symbol: 'PG',   sector: 'Consumer Defensive', subsector: 'Household & Personal', marketCap: 400, change: 0.20 },
  { symbol: 'KO',   sector: 'Consumer Defensive', subsector: 'Beverages', marketCap: 290, change: 1.37 },

  { symbol: 'CAT',  sector: 'Industrials', subsector: 'Farm & Heavy Equip.', marketCap: 190, change: -1.11 },
  { symbol: 'HON',  sector: 'Industrials', subsector: 'Conglomerate', marketCap: 150, change: -0.91 },
  { symbol: 'BA',   sector: 'Industrials', subsector: 'Aerospace & Defense', marketCap: 140, change: -1.98 },
  { symbol: 'MMM',  sector: 'Industrials', subsector: 'Conglomerate', marketCap: 70, change: -0.66 },

  { symbol: 'CVX',  sector: 'Energy', subsector: 'Oil & Gas Integrated', marketCap: 280, change: 1.62 },

  { symbol: 'VZ',   sector: 'Comm. Services', subsector: 'Telecom Services', marketCap: 180, change: -0.85 },

  { symbol: 'SHW',  sector: 'Basic Materials', subsector: 'Specialty Chemicals', marketCap: 85, change: -1.20 },
];

/* ── Squarified treemap algorithm ──────────────────────────────────────────── */

function worstAspect(areas: number[], w: number): number {
  const s = areas.reduce((a, b) => a + b, 0);
  let mx = 0;
  for (const r of areas) {
    const v = Math.max((w * w * r) / (s * s), (s * s) / (w * w * r));
    if (v > mx) mx = v;
  }
  return mx;
}

function layoutTreemap<T extends { value: number }>(
  items: T[],
  box: Rect,
): (T & { rect: Rect })[] {
  if (items.length === 0 || box.w <= 0 || box.h <= 0) return [];

  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];

  const area = box.w * box.h;
  const nodes = [...items]
    .map(it => ({ ...it, _a: (it.value / total) * area, rect: { x: 0, y: 0, w: 0, h: 0 } as Rect }))
    .sort((a, b) => b._a - a._a);

  let rest = nodes.slice();
  let cur = { ...box };

  while (rest.length > 0) {
    const side = Math.min(cur.w, cur.h);
    if (side <= 0) break;

    const row: typeof nodes = [];
    let sum = 0;

    for (const n of rest) {
      const next = [...row.map(r => r._a), n._a];
      if (row.length === 0 || worstAspect(next, side) <= worstAspect(row.map(r => r._a), side)) {
        row.push(n);
        sum += n._a;
      } else break;
    }

    const thickness = sum / side;
    const wide = cur.w >= cur.h;
    let off = 0;

    for (const n of row) {
      const span = n._a / thickness;
      n.rect = wide
        ? { x: cur.x, y: cur.y + off, w: thickness, h: span }
        : { x: cur.x + off, y: cur.y, w: span, h: thickness };
      off += span;
    }

    cur = wide
      ? { x: cur.x + thickness, y: cur.y, w: cur.w - thickness, h: cur.h }
      : { x: cur.x, y: cur.y + thickness, w: cur.w, h: cur.h - thickness };

    rest = rest.slice(row.length);
  }

  return nodes;
}

/* ── Color helpers ─────────────────────────────────────────────────────────── */

function tileColor(pct: number): string {
  const t = Math.min(Math.abs(pct), 5) / 5;
  return pct >= 0
    ? `hsl(150 ${55 + t * 30}% ${18 + t * 22}%)`
    : `hsl(0 ${60 + t * 20}% ${20 + t * 16}%)`;
}

/* ── Widget ─────────────────────────────────────────────────────────────────── */

export default function SectorHeatmapWidget() {
  const ref = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setSz({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sectors = useMemo((): SectorLayout[] => {
    if (sz.w === 0 || sz.h === 0) return [];

    const SECTOR_GAP = 2;
    const LABEL_H = 14;

    const map = new Map<string, StockDatum[]>();
    for (const s of DJ30) {
      if (!map.has(s.sector)) map.set(s.sector, []);
      map.get(s.sector)!.push(s);
    }

    const secItems = [...map.entries()].map(([name, stocks]) => ({
      name,
      stocks,
      value: stocks.reduce((a, st) => a + st.marketCap, 0),
    }));

    const secRects = layoutTreemap(secItems, { x: 0, y: 0, w: sz.w, h: sz.h });

    return secRects.map(s => {
      const inner: Rect = {
        x: s.rect.x + SECTOR_GAP,
        y: s.rect.y + LABEL_H,
        w: Math.max(0, s.rect.w - SECTOR_GAP * 2),
        h: Math.max(0, s.rect.h - LABEL_H - SECTOR_GAP),
      };
      const stItems = s.stocks.map(st => ({ ...st, value: st.marketCap }));
      const stRects = layoutTreemap(stItems, inner);

      return {
        name: s.name,
        rect: s.rect,
        stocks: stRects.map(r => ({
          symbol: r.symbol, sector: r.sector, subsector: r.subsector,
          marketCap: r.marketCap, change: r.change, rect: r.rect,
        })),
      };
    });
  }, [sz]);

  return (
    <section className="terminal-panel h-full flex flex-col">
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">DJ30 Heatmap</span>
        <span className="text-[9px] text-zinc-500">Market Cap Weighted</span>
      </div>

      <div ref={ref} className="relative flex-1 min-h-0 bg-zinc-950 overflow-hidden">
        {sectors.map(sec => (
          <div
            key={sec.name}
            className="absolute overflow-hidden"
            style={{
              left: sec.rect.x,
              top: sec.rect.y,
              width: sec.rect.w,
              height: sec.rect.h,
            }}
          >
            {/* sector label */}
            <div
              className="absolute left-1.5 top-0.5 z-10 font-bold uppercase tracking-wider text-zinc-500 truncate pointer-events-none select-none"
              style={{ fontSize: 8, lineHeight: '12px', maxWidth: sec.rect.w - 12 }}
            >
              {sec.name}
            </div>

            {/* stock tiles */}
            {sec.stocks.map(st => {
              const rx = st.rect.x - sec.rect.x;
              const ry = st.rect.y - sec.rect.y;
              const minD = Math.min(st.rect.w, st.rect.h);
              const symSz = Math.max(7, Math.min(32, minD * 0.30));
              const chgSz = Math.max(6, symSz * 0.55);
              const showSub = st.rect.w > 58 && st.rect.h > 44;
              const showChg = minD > 22;

              return (
                <div
                  key={st.symbol}
                  className="absolute flex flex-col items-center justify-center overflow-hidden select-none"
                  style={{
                    left: rx + 0.5,
                    top: ry + 0.5,
                    width: st.rect.w - 1,
                    height: st.rect.h - 1,
                    backgroundColor: tileColor(st.change),
                    borderRadius: 1,
                  }}
                >
                  {showSub && (
                    <div
                      className="text-white/30 uppercase truncate w-full text-center px-0.5 leading-tight"
                      style={{ fontSize: Math.max(5, Math.min(7, symSz * 0.32)) }}
                    >
                      {st.subsector}
                    </div>
                  )}
                  <div
                    className="font-bold text-white leading-none"
                    style={{ fontSize: symSz }}
                  >
                    {st.symbol}
                  </div>
                  {showChg && (
                    <div
                      className="font-mono text-white/90 leading-none mt-px"
                      style={{ fontSize: chgSz }}
                    >
                      {st.change >= 0 ? '+' : ''}{st.change.toFixed(2)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
