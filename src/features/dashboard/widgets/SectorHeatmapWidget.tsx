/**
 * SectorHeatmapWidget — GICS-sector ETF day-changes from /api/terminal/sectors.
 *
 * Each ETF (XLK / XLF / XLV / etc.) tracks an S&P sector index. Tile size
 * is weighted by the ETF's last close (a rough proxy for relative size);
 * tile color encodes day Δ%. Refreshes every 60 s.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
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
    const load = async () => {
      const resp = await terminalApiGet<SectorsResponse>('/api/terminal/sectors', undefined, ctrl.signal);
      if (cancelled) return;
      if (resp?.sectors?.length) {
        setRows(resp.sectors);
        setStatus('live');
      } else {
        setStatus('offline');
      }
    };
    void load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
    };
  }, []);

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
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">Sector Heatmap</span>
        <span className="text-[9px] text-zinc-500">
          {status === 'live' ? 'GICS · LIVE' : status.toUpperCase()}
        </span>
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
