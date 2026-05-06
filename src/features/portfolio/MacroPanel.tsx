/**
 * MacroPanel — morning-glance dashboard of the indicators every PM checks first.
 *
 * Loads from /api/macro/snapshot (FRED-backed when wired). Falls back to a
 * static stub so the UI ships before the backend route exists. Each tile is
 * small and clickable; click navigates to a deeper view (TODO: route wiring).
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Globe } from 'lucide-react';

const API_BASE =
  (import.meta as any).env?.VITE_BACKEND_URL?.replace(/\/$/, '') ?? 'http://localhost:8000';

export type MacroSeries =
  | 'fed_funds'
  | 'cpi_yoy'
  | 'core_cpi_yoy'
  | 'unemployment'
  | 'real_gdp_yoy'
  | 'us10y'
  | 'us2y'
  | 'curve_2s10s'
  | 'dxy'
  | 'oil_wti'
  | 'gold_xau'
  | 'btc';

export interface MacroTileData {
  series: MacroSeries;
  label: string;
  /** Latest value. */
  value: number | null;
  /** Day-over-day or month-over-month change in same units as value. */
  change: number | null;
  /** Suffix for display: '%', 'bps', '$/bbl', '$', '/oz', etc. */
  unit: string;
  /** Latest data point timestamp ISO. */
  asOf: string | null;
  /** Optional 1Y-ago value for overlay context. */
  oneYearAgo?: number | null;
}

const STUB: MacroTileData[] = [
  { series: 'fed_funds', label: 'Fed Funds', value: null, change: null, unit: '%', asOf: null },
  { series: 'us10y', label: 'US 10y', value: null, change: null, unit: '%', asOf: null },
  { series: 'us2y', label: 'US 2y', value: null, change: null, unit: '%', asOf: null },
  { series: 'curve_2s10s', label: '2s10s', value: null, change: null, unit: 'bps', asOf: null },
  { series: 'cpi_yoy', label: 'CPI YoY', value: null, change: null, unit: '%', asOf: null },
  { series: 'core_cpi_yoy', label: 'Core CPI YoY', value: null, change: null, unit: '%', asOf: null },
  { series: 'unemployment', label: 'Unemployment', value: null, change: null, unit: '%', asOf: null },
  { series: 'real_gdp_yoy', label: 'Real GDP YoY', value: null, change: null, unit: '%', asOf: null },
  { series: 'dxy', label: 'DXY', value: null, change: null, unit: '', asOf: null },
  { series: 'oil_wti', label: 'WTI Crude', value: null, change: null, unit: '$/bbl', asOf: null },
  { series: 'gold_xau', label: 'Gold', value: null, change: null, unit: '$/oz', asOf: null },
  { series: 'btc', label: 'BTC', value: null, change: null, unit: '$', asOf: null },
];

const fmt = (v: number | null, unit: string): string => {
  if (v == null || !Number.isFinite(v)) return '–';
  if (unit === '%') return `${v.toFixed(2)}%`;
  if (unit === 'bps') return `${v.toFixed(0)}bps`;
  if (unit === '$') return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (unit.startsWith('$/')) return `$${v.toFixed(2)}`;
  return v.toFixed(2);
};

const changeColor = (series: MacroSeries, change: number | null): string => {
  if (change == null || change === 0) return 'text-muted-foreground';
  // For inflation/unemployment, a rise is "bad" (red); for GDP, a rise is "good" (green).
  const inverted = ['cpi_yoy', 'core_cpi_yoy', 'unemployment', 'us10y', 'us2y'].includes(series);
  const positive = change > 0;
  if (inverted) return positive ? 'text-red-400' : 'text-emerald-400';
  return positive ? 'text-emerald-400' : 'text-red-400';
};

export function MacroPanel() {
  const [tiles, setTiles] = useState<MacroTileData[]>(STUB);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    fetch(`${API_BASE}/api/macro/snapshot`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data: { tiles: MacroTileData[] }) => {
        if (cancelled) return;
        if (Array.isArray(data?.tiles)) setTiles(data.tiles);
        setLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-foreground text-sm">
          <Globe className="w-4 h-4 text-primary" />
          Macro snapshot
          {!loaded && (
            <span className="text-[10px] text-muted-foreground italic">stub data</span>
          )}
        </CardTitle>
        <span className="text-[10px] text-muted-foreground">
          source: FRED, BLS, Treasury
        </span>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-2 text-[11px] text-amber-400">
            Live macro feed unavailable — wire {API_BASE}/api/macro/snapshot to populate.
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {tiles.map((t) => (
            <div
              key={t.series}
              className="rounded-md border border-border/40 bg-card/40 p-2 hover:border-border transition-colors"
            >
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {t.label}
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-1">
                <span className="font-mono text-sm font-medium text-foreground">
                  {fmt(t.value, t.unit)}
                </span>
                {t.change != null && (
                  <span className={`text-[10px] font-mono ${changeColor(t.series, t.change)}`}>
                    {t.change >= 0 ? '+' : ''}
                    {fmt(t.change, t.unit)}
                  </span>
                )}
              </div>
              {t.asOf && (
                <div className="text-[9px] text-muted-foreground mt-0.5">
                  {new Date(t.asOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default MacroPanel;
