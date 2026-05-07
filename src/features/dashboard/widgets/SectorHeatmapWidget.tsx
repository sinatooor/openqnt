/**
 * SectorHeatmapWidget — index/sector heatmap with a switchable universe.
 *
 * Default ("Sectors"): GICS sector ETFs from /api/terminal/sectors.
 * Other presets (DJ30, OMX30, Magnificent 7, Crypto Top 10) are constituent
 * lists fetched as a single batch from /api/terminal/quotes.
 * Tile size is weighted by liquidity; tile color encodes day Δ%.
 * Refreshes every 60 s.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { terminalApiGet } from '@/features/terminal/apiClient';

interface SectorRow {
  name: string;
  etf: string;
  price: number;
  changePct: number;
  volume: number;
}

interface SectorsResponse {
  source: string;
  sectors: SectorRow[];
}

interface QuoteRow {
  symbol: string;
  lastPrice: number | null;
  changePct: number | null;
}
interface QuotesResponse {
  source: string;
  quotes: QuoteRow[];
}

// Index/preset universes. `constituents: null` = use the existing
// /api/terminal/sectors endpoint (which returns SPDR sector ETFs).
type Universe = {
  id: string;
  label: string;
  constituents: Array<{ name: string; ticker: string }> | null;
};

const UNIVERSES: Universe[] = [
  { id: 'sectors', label: 'GICS Sectors', constituents: null },
  {
    id: 'dj30',
    label: 'DJIA · DJ30',
    constituents: [
      { name: 'AAPL', ticker: 'AAPL' }, { name: 'AMGN', ticker: 'AMGN' },
      { name: 'AMZN', ticker: 'AMZN' }, { name: 'AXP',  ticker: 'AXP'  },
      { name: 'BA',   ticker: 'BA'   }, { name: 'CAT',  ticker: 'CAT'  },
      { name: 'CRM',  ticker: 'CRM'  }, { name: 'CSCO', ticker: 'CSCO' },
      { name: 'CVX',  ticker: 'CVX'  }, { name: 'DIS',  ticker: 'DIS'  },
      { name: 'GS',   ticker: 'GS'   }, { name: 'HD',   ticker: 'HD'   },
      { name: 'HON',  ticker: 'HON'  }, { name: 'IBM',  ticker: 'IBM'  },
      { name: 'JNJ',  ticker: 'JNJ'  }, { name: 'JPM',  ticker: 'JPM'  },
      { name: 'KO',   ticker: 'KO'   }, { name: 'MCD',  ticker: 'MCD'  },
      { name: 'MMM',  ticker: 'MMM'  }, { name: 'MRK',  ticker: 'MRK'  },
      { name: 'MSFT', ticker: 'MSFT' }, { name: 'NKE',  ticker: 'NKE'  },
      { name: 'NVDA', ticker: 'NVDA' }, { name: 'PG',   ticker: 'PG'   },
      { name: 'SHW',  ticker: 'SHW'  }, { name: 'TRV',  ticker: 'TRV'  },
      { name: 'UNH',  ticker: 'UNH'  }, { name: 'V',    ticker: 'V'    },
      { name: 'VZ',   ticker: 'VZ'   }, { name: 'WMT',  ticker: 'WMT'  },
    ],
  },
  {
    id: 'omx30',
    label: 'OMX Stockholm 30',
    constituents: [
      { name: 'ABB',    ticker: 'ABB.ST'      }, { name: 'ALFA',   ticker: 'ALFA.ST'    },
      { name: 'ASSA',   ticker: 'ASSA-B.ST'   }, { name: 'ATCO',   ticker: 'ATCO-A.ST'  },
      { name: 'AZN',    ticker: 'AZN.ST'      }, { name: 'BOL',    ticker: 'BOL.ST'     },
      { name: 'ELUX',   ticker: 'ELUX-B.ST'   }, { name: 'ERIC',   ticker: 'ERIC-B.ST'  },
      { name: 'ESSITY', ticker: 'ESSITY-B.ST' }, { name: 'EVO',    ticker: 'EVO.ST'     },
      { name: 'GETI',   ticker: 'GETI-B.ST'   }, { name: 'HEXA',   ticker: 'HEXA-B.ST'  },
      { name: 'HM',     ticker: 'HM-B.ST'     }, { name: 'INVE',   ticker: 'INVE-B.ST'  },
      { name: 'KINV',   ticker: 'KINV-B.ST'   }, { name: 'NDA',    ticker: 'NDA-SE.ST'  },
      { name: 'NIBE',   ticker: 'NIBE-B.ST'   }, { name: 'SAND',   ticker: 'SAND.ST'    },
      { name: 'SBB',    ticker: 'SBB-B.ST'    }, { name: 'SCA',    ticker: 'SCA-B.ST'   },
      { name: 'SEB',    ticker: 'SEB-A.ST'    }, { name: 'SHB',    ticker: 'SHB-A.ST'   },
      { name: 'SINCH',  ticker: 'SINCH.ST'    }, { name: 'SKF',    ticker: 'SKF-B.ST'   },
      { name: 'SWED',   ticker: 'SWED-A.ST'   }, { name: 'TEL2',   ticker: 'TEL2-B.ST'  },
      { name: 'TELIA',  ticker: 'TELIA.ST'    }, { name: 'VOLV',   ticker: 'VOLV-B.ST'  },
      { name: 'BILL',   ticker: 'BILL.ST'     }, { name: 'STORA',  ticker: 'STORA-B.ST' },
    ],
  },
  {
    id: 'mag7',
    label: 'Magnificent 7',
    constituents: [
      { name: 'Apple',     ticker: 'AAPL'  },
      { name: 'Microsoft', ticker: 'MSFT'  },
      { name: 'Nvidia',    ticker: 'NVDA'  },
      { name: 'Alphabet',  ticker: 'GOOGL' },
      { name: 'Amazon',    ticker: 'AMZN'  },
      { name: 'Meta',      ticker: 'META'  },
      { name: 'Tesla',     ticker: 'TSLA'  },
    ],
  },
  {
    id: 'crypto10',
    label: 'Crypto · Top 10',
    constituents: [
      { name: 'BTC',  ticker: 'BTC-USD'  }, { name: 'ETH',  ticker: 'ETH-USD'  },
      { name: 'BNB',  ticker: 'BNB-USD'  }, { name: 'SOL',  ticker: 'SOL-USD'  },
      { name: 'XRP',  ticker: 'XRP-USD'  }, { name: 'ADA',  ticker: 'ADA-USD'  },
      { name: 'AVAX', ticker: 'AVAX-USD' }, { name: 'DOGE', ticker: 'DOGE-USD' },
      { name: 'DOT',  ticker: 'DOT-USD'  }, { name: 'LINK', ticker: 'LINK-USD' },
    ],
  },
];

const UNIVERSE_KEY = 'openqnt.heatmap.universe';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TiledSector extends SectorRow {
  rect: Rect;
  weight: number;
}

function worstAspect(areas: number[], w: number): number {
  const s = areas.reduce((a, b) => a + b, 0);
  let mx = 0;
  for (const r of areas) {
    const v = Math.max((w * w * r) / (s * s), (s * s) / (w * w * r));
    if (v > mx) mx = v;
  }
  return mx;
}

function layoutTreemap<T extends { value: number }>(items: T[], box: Rect): (T & { rect: Rect })[] {
  if (items.length === 0 || box.w <= 0 || box.h <= 0) return [];
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];
  const area = box.w * box.h;
  const nodes = [...items]
    .map((it) => ({ ...it, _a: (it.value / total) * area, rect: { x: 0, y: 0, w: 0, h: 0 } as Rect }))
    .sort((a, b) => b._a - a._a);
  let rest = nodes.slice();
  let cur = { ...box };
  while (rest.length > 0) {
    const side = Math.min(cur.w, cur.h);
    if (side <= 0) break;
    const row: typeof nodes = [];
    let sum = 0;
    for (const n of rest) {
      const next = [...row.map((r) => r._a), n._a];
      if (row.length === 0 || worstAspect(next, side) <= worstAspect(row.map((r) => r._a), side)) {
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

function tileColor(pct: number): string {
  const t = Math.min(Math.abs(pct), 5) / 5;
  return pct >= 0
    ? `hsl(150 ${55 + t * 30}% ${18 + t * 22}%)`
    : `hsl(0 ${60 + t * 20}% ${20 + t * 16}%)`;
}

export default function SectorHeatmapWidget() {
  const ref = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState({ w: 0, h: 0 });
  const [rows, setRows] = useState<SectorRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'live' | 'offline'>('loading');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [universeId, setUniverseId] = useState<string>(() => {
    try {
      return localStorage.getItem(UNIVERSE_KEY) || 'sectors';
    } catch {
      return 'sectors';
    }
  });
  const universe = UNIVERSES.find((u) => u.id === universeId) ?? UNIVERSES[0];

  useEffect(() => {
    try { localStorage.setItem(UNIVERSE_KEY, universeId); } catch { /* */ }
  }, [universeId]);

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

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    setStatus('loading');

    const loadSectors = async () => {
      const resp = await terminalApiGet<SectorsResponse>(
        '/api/terminal/sectors',
        undefined,
        ctrl.signal,
      );
      if (cancelled) return;
      if (resp?.sectors?.length) {
        setRows(resp.sectors);
        setStatus('live');
      } else {
        setRows([]);
        setStatus('offline');
      }
    };

    const loadConstituents = async () => {
      if (!universe.constituents) return;
      const symbols = universe.constituents.map((c) => c.ticker).join(',');
      const resp = await terminalApiGet<QuotesResponse>(
        '/api/terminal/quotes',
        { symbols },
        ctrl.signal,
      );
      if (cancelled) return;
      if (resp?.quotes?.length) {
        // Map back into the SectorRow shape so the existing treemap logic
        // doesn't change. `volume` is unavailable from /quotes — substitute a
        // proxy so tile size still differs by price (rough liquidity hint).
        const bySym = new Map(resp.quotes.map((q) => [q.symbol, q]));
        const next: SectorRow[] = universe.constituents
          .map((c) => {
            const q = bySym.get(c.ticker);
            return {
              name: c.name,
              etf: c.name, // tile shows the short name for non-sector universes
              price: q?.lastPrice ?? 0,
              changePct: q?.changePct ?? 0,
              volume: Math.max(1, (q?.lastPrice ?? 1) * 1_000_000),
            };
          })
          .filter((r) => r.price > 0);
        setRows(next);
        setStatus(next.length > 0 ? 'live' : 'offline');
      } else {
        setRows([]);
        setStatus('offline');
      }
    };

    const load = universe.constituents ? loadConstituents : loadSectors;
    void load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
    };
  }, [universe.id]);

  const tiled = useMemo<TiledSector[]>(() => {
    if (sz.w === 0 || sz.h === 0 || rows.length === 0) return [];
    const items = rows.map((r) => ({
      ...r,
      // Volume ~ liquidity proxy. Add a constant so all tiles render even
      // when one ETF has a runaway volume number.
      weight: Math.max(1, r.volume / 1_000_000 + 5),
      value: Math.max(1, r.volume / 1_000_000 + 5),
    }));
    const placed = layoutTreemap(items, { x: 0, y: 0, w: sz.w, h: sz.h });
    return placed.map((p) => ({ ...p, rect: p.rect }));
  }, [rows, sz]);

  return (
    <section className="terminal-panel h-full flex flex-col">
      <div className="terminal-panel-header flex items-center justify-between gap-2">
        <span className="terminal-title">Heatmap</span>
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] text-zinc-200"
            title="Switch universe"
          >
            <span>{universe.label}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          {pickerOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-30 w-48 rounded-md bg-[#15151b] border border-white/10 shadow-xl py-1"
              onMouseLeave={() => setPickerOpen(false)}
            >
              {UNIVERSES.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { setUniverseId(u.id); setPickerOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-white/[0.06] transition-colors ${
                    u.id === universeId ? 'text-emerald-300' : 'text-zinc-200'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          )}
          <span className="text-[9px] text-zinc-500">
            {status === 'live' ? 'LIVE' : status.toUpperCase()}
          </span>
        </div>
      </div>

      <div ref={ref} className="relative flex-1 min-h-0 bg-zinc-950 overflow-hidden">
        {tiled.length === 0 && status !== 'live' && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-zinc-600">
            {status === 'loading' ? 'Loading sector data…' : 'No sector data'}
          </div>
        )}
        {tiled.map((s) => {
          const minD = Math.min(s.rect.w, s.rect.h);
          const symSz = Math.max(8, Math.min(28, minD * 0.22));
          const labelSz = Math.max(7, Math.min(11, minD * 0.13));
          return (
            <div
              key={s.etf}
              className="absolute flex flex-col items-center justify-center select-none overflow-hidden"
              style={{
                left: s.rect.x + 0.5,
                top: s.rect.y + 0.5,
                width: s.rect.w - 1,
                height: s.rect.h - 1,
                backgroundColor: tileColor(s.changePct),
                borderRadius: 1,
              }}
            >
              <div className="text-white/40 uppercase tracking-wide" style={{ fontSize: labelSz }}>
                {s.name}
              </div>
              <div className="font-bold text-white" style={{ fontSize: symSz, lineHeight: 1 }}>
                {s.etf}
              </div>
              <div className="font-mono text-white/90 mt-px" style={{ fontSize: symSz * 0.6, lineHeight: 1 }}>
                {s.changePct >= 0 ? '+' : ''}
                {s.changePct.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
