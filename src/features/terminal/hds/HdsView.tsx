/**
 * HdsView — Bloomberg-style HDS (Holdings Detail) table.
 *
 * Layout:
 *   • Summary ribbon of 8 metric tiles (institutional %, insider %, top-10,
 *     short interest, holder count, …).
 *   • Top-10 horizontal bar chart (% of shares outstanding).
 *   • Filter bar (holder type, status, filing source, text search).
 *   • Sortable dense data grid with one row per holder.
 *
 * The component consumes the `hdsTool.fetch(...)` output directly so it is
 * guaranteed to render the same data an agent would see.
 */

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { hdsTool } from './tool';
import type { FilingSource, Holder, HolderStatus, HolderType } from './mockData';
import './hds.css';

export interface HdsViewProps {
  ticker: string;
  seedSalt?: number;
}

type SortKey =
  | 'positionSharesM'
  | 'pctOut'
  | 'marketValueMm'
  | 'changeSharesM'
  | 'changePct'
  | 'portfolioPct'
  | 'positionDate'
  | 'name';

type SortDir = 'asc' | 'desc';

const TYPE_COLORS: Record<HolderType, string> = {
  Institution: 'hds-chip-inst',
  'Mutual Fund': 'hds-chip-mf',
  ETF: 'hds-chip-etf',
  'Hedge Fund': 'hds-chip-hf',
  Insider: 'hds-chip-ins',
  Individual: 'hds-chip-ind',
  'Sovereign Wealth': 'hds-chip-sov',
  Pension: 'hds-chip-pen',
};

const STATUS_COLORS: Record<HolderStatus, string> = {
  New: 'hds-status-new',
  Increased: 'hds-status-up',
  Decreased: 'hds-status-down',
  Unchanged: 'hds-status-flat',
  'Sold Out': 'hds-status-out',
};

/* ------------------------------- formatters ------------------------------ */

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtUsdMm(valueMm: number): string {
  if (valueMm >= 1_000_000) return `$${(valueMm / 1_000_000).toFixed(2)}T`;
  if (valueMm >= 1_000) return `$${(valueMm / 1_000).toFixed(2)}B`;
  return `$${valueMm.toFixed(0)}MM`;
}

function signedClass(n: number): string {
  if (n > 0) return 'hds-delta-up';
  if (n < 0) return 'hds-delta-down';
  return 'hds-delta-flat';
}

function signed(n: number, decimals = 2): string {
  if (n === 0) return '0';
  const v = n.toFixed(decimals);
  return n > 0 ? `+${v}` : v;
}

/* -------------------------------- tiles ---------------------------------- */

interface TileProps {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
}

function Tile({ label, value, sub, tone = 'neutral' }: TileProps) {
  return (
    <div className={`hds-tile hds-tile-${tone}`}>
      <span className="hds-tile-label">{label}</span>
      <b className="hds-tile-value">{value}</b>
      {sub && <em className="hds-tile-sub">{sub}</em>}
    </div>
  );
}

/* --------------------------- top-10 bar chart ---------------------------- */

function TopBars({ holders, max }: { holders: Holder[]; max: number }) {
  return (
    <div className="hds-bars">
      <div className="hds-bars-title">
        TOP 10 HOLDERS — % of Shares Outstanding
      </div>
      <div className="hds-bars-list">
        {holders.slice(0, 10).map((h, i) => {
          const widthPct = Math.max(2, (h.pctOut / max) * 100);
          return (
            <div className="hds-bar-row" key={h.id}>
              <span className="hds-bar-rank">{i + 1}</span>
              <span className="hds-bar-name" title={h.name}>
                {h.name}
              </span>
              <div className="hds-bar-track">
                <div
                  className={`hds-bar-fill ${TYPE_COLORS[h.type]}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className="hds-bar-pct">{h.pctOut.toFixed(2)}%</span>
              <span className="hds-bar-val">{fmtUsdMm(h.marketValueMm)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------- filters --------------------------------- */

const ALL_TYPES: HolderType[] = [
  'Institution',
  'Mutual Fund',
  'ETF',
  'Hedge Fund',
  'Insider',
  'Sovereign Wealth',
  'Pension',
  'Individual',
];

const ALL_STATUSES: HolderStatus[] = ['New', 'Increased', 'Decreased', 'Unchanged', 'Sold Out'];

const ALL_SOURCES: FilingSource[] = ['13F', '13G', '13D', 'NPORT', 'Form 4', 'S-Beneficial', 'Fund Report'];

/* --------------------------------- root ---------------------------------- */

export default function HdsView({ ticker, seedSalt = 0 }: HdsViewProps) {
  const data = useMemo(
    () => hdsTool.fetch({ ticker, seedSalt }),
    [ticker, seedSalt],
  );

  const [typeFilter, setTypeFilter] = useState<Set<HolderType>>(new Set(ALL_TYPES));
  const [statusFilter, setStatusFilter] = useState<Set<HolderStatus>>(new Set(ALL_STATUSES));
  const [sourceFilter, setSourceFilter] = useState<Set<FilingSource>>(new Set(ALL_SOURCES));
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('positionSharesM');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return data.holders.filter((h) => {
      if (!typeFilter.has(h.type)) return false;
      if (!statusFilter.has(h.status)) return false;
      if (!sourceFilter.has(h.source)) return false;
      if (s && !h.name.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [data.holders, typeFilter, statusFilter, sourceFilter, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === 'name' || sortKey === 'positionDate') {
        av = a[sortKey];
        bv = b[sortKey];
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      if (av === bv) return 0;
      const sign = sortDir === 'asc' ? 1 : -1;
      return av > bv ? sign : -sign;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir(k === 'name' ? 'asc' : 'desc');
    }
  };

  const toggleInSet = <T,>(set: Set<T>, value: T, setter: (v: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const SortableHead = ({ k, label, align }: { k: SortKey; label: string; align?: 'right' | 'left' | 'center' }) => {
    const active = sortKey === k;
    return (
      <th
        className={`hds-sortable ${align ? `hds-align-${align}` : ''} ${active ? 'hds-sort-on' : ''}`}
        onClick={() => toggleSort(k)}
      >
        <span>{label}</span>
        {active && (sortDir === 'asc' ? <ArrowUp className="hds-sort-ico" /> : <ArrowDown className="hds-sort-ico" />)}
      </th>
    );
  };

  const center = data.center;
  const summary = data.summary;
  const top10Max = data.holders.slice(0, 10).reduce((m, h) => Math.max(m, h.pctOut), 0.01);

  return (
    <div className="hds-root">
      {/* Focal strip */}
      <div className="hds-focal">
        <div className="hds-focal-main">
          <span className="hds-focal-ticker">{center.ticker}</span>
          <span className="hds-focal-name">{center.name}</span>
          <span className="hds-focal-meta">{center.country} · {center.industry}</span>
        </div>
        <div className="hds-focal-px">
          <span>${center.price.toFixed(2)}</span>
          <em>${center.marketCapB.toFixed(1)}B mcap · {fmtNum(center.sharesOutstandingM, 1)}M S/O · float {center.floatPctOfOut.toFixed(1)}%</em>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="hds-tiles">
        <Tile label="INST" value={`${summary.institutionalPct.toFixed(1)}%`} sub="of S/O" tone="neutral" />
        <Tile label="ETF" value={`${summary.etfPct.toFixed(1)}%`} sub="of S/O" tone="neutral" />
        <Tile label="MUTUAL FUND" value={`${summary.mutualFundPct.toFixed(1)}%`} sub="of S/O" tone="neutral" />
        <Tile label="HEDGE FUND" value={`${summary.hedgeFundPct.toFixed(1)}%`} sub="of S/O" tone="neutral" />
        <Tile label="INSIDER" value={`${summary.insiderPct.toFixed(2)}%`} sub="5% & Form 4" tone={summary.insiderPct > 8 ? 'warn' : 'neutral'} />
        <Tile
          label="TOP-10 CONC."
          value={`${summary.top10Pct.toFixed(1)}%`}
          sub="ownership"
          tone={summary.top10Pct > 60 ? 'bad' : summary.top10Pct > 40 ? 'warn' : 'good'}
        />
        <Tile
          label="SHORT INT."
          value={`${summary.shortInterestPct.toFixed(2)}%`}
          sub={`${summary.daysToCover.toFixed(1)} days to cover`}
          tone={summary.shortInterestPct > 5 ? 'bad' : summary.shortInterestPct > 2 ? 'warn' : 'good'}
        />
        <Tile
          label="HOLDER COUNT"
          value={summary.holderCount.toLocaleString()}
          sub={`${signed(summary.holderCountDeltaQoq, 0)} QoQ`}
          tone={summary.holderCountDeltaQoq >= 0 ? 'good' : 'warn'}
        />
      </div>

      {/* Top-10 bar chart */}
      <TopBars holders={data.holders} max={top10Max} />

      {/* Filters */}
      <div className="hds-filterbar">
        <div className="hds-filter-group">
          <span className="hds-filter-label">TYPE</span>
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              className={`hds-filter-pill ${TYPE_COLORS[t]} ${typeFilter.has(t) ? 'on' : 'off'}`}
              onClick={() => toggleInSet(typeFilter, t, setTypeFilter)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="hds-filter-group">
          <span className="hds-filter-label">STATUS</span>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              className={`hds-filter-pill hds-pill-plain ${statusFilter.has(s) ? 'on' : 'off'}`}
              onClick={() => toggleInSet(statusFilter, s, setStatusFilter)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="hds-filter-group">
          <span className="hds-filter-label">SOURCE</span>
          {ALL_SOURCES.map((s) => (
            <button
              key={s}
              className={`hds-filter-pill hds-pill-plain ${sourceFilter.has(s) ? 'on' : 'off'}`}
              onClick={() => toggleInSet(sourceFilter, s, setSourceFilter)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="hds-search">
          <Search className="hds-search-ico" />
          <input
            type="text"
            placeholder="Search holder name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="hds-filter-meta">
          {sorted.length} of {data.holders.length} holders
        </div>
      </div>

      {/* Data grid */}
      <div className="hds-table-wrap">
        <table className="hds-table">
          <thead>
            <tr>
              <th className="hds-align-right">#</th>
              <SortableHead k="name" label="Holder" align="left" />
              <th>Type</th>
              <th>Src</th>
              <SortableHead k="positionSharesM" label="Shares (M)" align="right" />
              <SortableHead k="pctOut" label="% Out" align="right" />
              <SortableHead k="changeSharesM" label="Δ Shares (M)" align="right" />
              <SortableHead k="changePct" label="Δ %" align="right" />
              <SortableHead k="marketValueMm" label="$Value" align="right" />
              <SortableHead k="positionDate" label="Filed" align="center" />
              <SortableHead k="portfolioPct" label="Port %" align="right" />
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h, i) => (
              <tr key={h.id}>
                <td className="hds-align-right hds-dim">{i + 1}</td>
                <td className="hds-cell-name">
                  <span className="hds-holder-name">{h.name}</span>
                  <span className="hds-holder-country">{h.country}</span>
                </td>
                <td>
                  <span className={`hds-chip ${TYPE_COLORS[h.type]}`}>{h.type}</span>
                </td>
                <td className="hds-src">{h.source}</td>
                <td className="hds-align-right hds-mono">{fmtNum(h.positionSharesM, 2)}</td>
                <td className="hds-align-right hds-mono hds-bold">{h.pctOut.toFixed(3)}%</td>
                <td className={`hds-align-right hds-mono ${signedClass(h.changeSharesM)}`}>
                  {signed(h.changeSharesM, 2)}
                </td>
                <td className={`hds-align-right hds-mono ${signedClass(h.changePct)}`}>
                  {signed(h.changePct, 2)}%
                </td>
                <td className="hds-align-right hds-mono">{fmtUsdMm(h.marketValueMm)}</td>
                <td className="hds-align-center hds-mono hds-dim">{h.positionDate}</td>
                <td className="hds-align-right hds-mono">{h.portfolioPct.toFixed(2)}%</td>
                <td>
                  <span className={`hds-status ${STATUS_COLORS[h.status]}`}>{h.status}</span>
                </td>
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={12} className="hds-empty">
                  No holders match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
