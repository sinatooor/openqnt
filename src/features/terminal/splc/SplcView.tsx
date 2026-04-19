/**
 * SplcView — Bloomberg-style Supply-Chain Analysis.
 *
 * Layout (Chart View):
 *   ┌───────────────┬──────────────┬───────────────┐
 *   │  SUPPLIERS    │  CENTER      │  CUSTOMERS    │
 *   │  (left stack) │  (anchor)    │  (right stack)│
 *   └───────────────┴──────────────┴───────────────┘
 *   ┌──────────────────────────────────────────────┐
 *   │  PEERS / COMPETITORS                         │
 *   └──────────────────────────────────────────────┘
 *
 *   SVG overlay draws bezier curves from each supplier to the centre and
 *   from the centre to each customer.  Stroke width is scaled by the dollar
 *   value of the relationship and the colour encodes its "company exposure"
 *   (brighter amber = larger share of focal firm's COGS / revenue).
 *
 * A Table View toggle switches to a dense Bloomberg-style data grid.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, BarChart2, ChevronDown, ExternalLink, Filter, Table } from 'lucide-react';
import { generateSplcData, type SplcRelationship } from './mockData';
import './splc.css';

type SortMode = 'company' | 'relationship';
type ViewMode = 'chart' | 'table';

export interface SplcViewProps {
  ticker: string;
  /** When set, the refresh button bumps this to regenerate mock data */
  seedSalt?: number;
  onRefresh?: () => void;
}

/* ------------------------------- formatting ------------------------------- */

function fmtUsd(valueMm: number): string {
  if (valueMm >= 1000) return `$${(valueMm / 1000).toFixed(2)}B`;
  return `$${valueMm.toFixed(0)}M`;
}

function fmtPct(pct: number): string {
  if (pct >= 10) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(2)}%`;
}

function exposureTone(pct: number): string {
  if (pct >= 20) return 'splc-tone-strong';
  if (pct >= 10) return 'splc-tone-high';
  if (pct >= 3) return 'splc-tone-mid';
  return 'splc-tone-low';
}

function sortForView(rels: SplcRelationship[], mode: SortMode): SplcRelationship[] {
  return [...rels].sort((a, b) =>
    mode === 'company'
      ? b.companyExposurePct - a.companyExposurePct
      : b.relationshipExposurePct - a.relationshipExposurePct,
  );
}

/* ----------------------------- small primitives --------------------------- */

interface NodeCardProps {
  ticker: string;
  name: string;
  country: string;
  sub?: string;
  tone?: 'supplier' | 'customer' | 'peer';
  exposurePct?: number;
  exposureLabel?: string;
  valueMm?: number;
  deltaPct?: number;
  onClick?: () => void;
  quantified?: boolean;
  dim?: boolean;
}

function NodeCard({
  ticker,
  name,
  country,
  sub,
  tone = 'peer',
  exposurePct,
  exposureLabel,
  valueMm,
  deltaPct,
  onClick,
  quantified = true,
  dim,
}: NodeCardProps) {
  const toneClass =
    tone === 'supplier' ? 'splc-node-supplier' : tone === 'customer' ? 'splc-node-customer' : 'splc-node-peer';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`splc-node ${toneClass} ${dim ? 'splc-node-dim' : ''}`}
      title={`Click to load ${ticker} supply chain`}
    >
      <div className="splc-node-row">
        <span className="splc-node-ticker">{ticker}</span>
        <span className="splc-node-country">{country}</span>
      </div>
      <div className="splc-node-name">{name}</div>
      {sub && <div className="splc-node-sub">{sub}</div>}
      {(exposurePct !== undefined || valueMm !== undefined) && (
        <div className="splc-node-metrics">
          {exposurePct !== undefined && (
            <span className={`splc-node-exp ${exposureTone(exposurePct)}`}>
              {exposureLabel ?? 'Exp'} {fmtPct(exposurePct)}
            </span>
          )}
          {valueMm !== undefined && <span className="splc-node-value">{fmtUsd(valueMm)}</span>}
          {deltaPct !== undefined && (
            <span className={deltaPct >= 0 ? 'splc-delta-up' : 'splc-delta-down'}>
              {deltaPct >= 0 ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(1)}%
            </span>
          )}
        </div>
      )}
      {!quantified && <div className="splc-node-estimate">Est.</div>}
    </button>
  );
}

/* ----------------------------- center panel ------------------------------- */

function CenterCard({
  center,
  onRefresh,
}: {
  center: ReturnType<typeof generateSplcData>['center'];
  onRefresh: () => void;
}) {
  const metrics = center.metrics;
  return (
    <div className="splc-center">
      <div className="splc-center-header">
        <span className="splc-center-title">FOCAL COMPANY</span>
        <button className="splc-mini-btn" onClick={onRefresh}>
          REFRESH
        </button>
      </div>
      <div className="splc-center-main">
        <div className="splc-center-ticker">{center.ticker}</div>
        <div className="splc-center-name">{center.name}</div>
        <div className="splc-center-sub">
          {center.country} · {center.industry}
        </div>
        <div className="splc-center-price">
          <span className="splc-center-px">${center.price.toFixed(2)}</span>
          <span className="splc-center-mcap">· ${center.marketCapB.toFixed(0)}B mcap</span>
        </div>
      </div>
      <div className="splc-center-grid">
        <div className="splc-center-metric">
          <span>REV</span>
          <b>${center.revenueB.toFixed(1)}B</b>
          <em>{metrics.revenueQuantifiedPct}% Q</em>
        </div>
        <div className="splc-center-metric">
          <span>COGS</span>
          <b>${center.cogsB.toFixed(1)}B</b>
          <em>{metrics.cogsQuantifiedPct}% Q</em>
        </div>
        <div className="splc-center-metric">
          <span>GM</span>
          <b>{center.grossMarginPct.toFixed(1)}%</b>
          <em>ttm</em>
        </div>
        <div className="splc-center-metric">
          <span>CAPEX</span>
          <b>{metrics.capexQuantifiedPct}%</b>
          <em>Q</em>
        </div>
        <div className="splc-center-metric">
          <span>SG&amp;A</span>
          <b>{metrics.sgaQuantifiedPct}%</b>
          <em>Q</em>
        </div>
        <div className="splc-center-metric">
          <span>R&amp;D</span>
          <b>{metrics.rndQuantifiedPct}%</b>
          <em>Q</em>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- chart ---------------------------------- */

interface NodeGeometry {
  /** left edge %, top edge % */
  leftPct: number;
  topPct: number;
}

function layoutPositions(count: number, yStart = 6, yEnd = 94): number[] {
  if (count === 0) return [];
  if (count === 1) return [(yStart + yEnd) / 2];
  const step = (yEnd - yStart) / (count - 1);
  return Array.from({ length: count }, (_, i) => yStart + i * step);
}

function ChartView({
  suppliers,
  customers,
  sort,
  onPick,
  maxValueMm,
}: {
  suppliers: SplcRelationship[];
  customers: SplcRelationship[];
  sort: SortMode;
  onPick: (ticker: string) => void;
  maxValueMm: number;
}) {
  // Column x centres (%) for curves
  const SUPPLIER_X = 14;
  const CENTER_X = 50;
  const CUSTOMER_X = 86;

  const supplierYs = useMemo(() => layoutPositions(suppliers.length), [suppliers.length]);
  const customerYs = useMemo(() => layoutPositions(customers.length), [customers.length]);

  const curveFor = (fromX: number, fromY: number, toX: number, toY: number) => {
    // Cubic bezier with two control points half-way horizontally.
    const midX = (fromX + toX) / 2;
    return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
  };

  const widthFor = (valueMm: number) => {
    const scale = valueMm / (maxValueMm || 1);
    return 0.35 + scale * 2.2;
  };

  return (
    <div className="splc-chart">
      <svg
        className="splc-chart-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="splc-supplier-grad" x1="0" x2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ff9f1a" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="splc-customer-grad" x1="0" x2="1">
            <stop offset="0%" stopColor="#ff9f1a" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        {suppliers.map((s, i) => (
          <path
            key={`supplier-curve-${s.company.ticker}`}
            d={curveFor(SUPPLIER_X, supplierYs[i], CENTER_X, 50)}
            fill="none"
            stroke="url(#splc-supplier-grad)"
            strokeWidth={widthFor(s.valueMm)}
            strokeOpacity={0.55 + Math.min(s.companyExposurePct, 40) / 100}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {customers.map((c, i) => (
          <path
            key={`customer-curve-${c.company.ticker}`}
            d={curveFor(CENTER_X, 50, CUSTOMER_X, customerYs[i])}
            fill="none"
            stroke="url(#splc-customer-grad)"
            strokeWidth={widthFor(c.valueMm)}
            strokeOpacity={0.55 + Math.min(c.companyExposurePct, 40) / 100}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* Suppliers column */}
      <div className="splc-col splc-col-left">
        <div className="splc-col-header">
          <span className="splc-col-title">SUPPLIERS</span>
          <span className="splc-col-count">{suppliers.length}</span>
        </div>
        <div className="splc-col-scroll">
          {suppliers.map((s) => (
            <NodeCard
              key={s.company.ticker}
              tone="supplier"
              ticker={s.company.ticker}
              name={s.company.name}
              country={s.company.country}
              sub={s.company.industry}
              exposurePct={
                sort === 'company' ? s.companyExposurePct : s.relationshipExposurePct
              }
              exposureLabel={sort === 'company' ? 'of COGS' : 'of Supp Rev'}
              valueMm={s.valueMm}
              deltaPct={s.deltaPct}
              onClick={() => onPick(s.company.ticker)}
              quantified={s.quantified}
            />
          ))}
          {suppliers.length === 0 && (
            <div className="splc-empty">No supplier relationships found</div>
          )}
        </div>
      </div>

      {/* Customers column */}
      <div className="splc-col splc-col-right">
        <div className="splc-col-header">
          <span className="splc-col-title">CUSTOMERS</span>
          <span className="splc-col-count">{customers.length}</span>
        </div>
        <div className="splc-col-scroll">
          {customers.map((c) => (
            <NodeCard
              key={c.company.ticker}
              tone="customer"
              ticker={c.company.ticker}
              name={c.company.name}
              country={c.company.country}
              sub={c.company.industry}
              exposurePct={
                sort === 'company' ? c.companyExposurePct : c.relationshipExposurePct
              }
              exposureLabel={sort === 'company' ? 'of Rev' : 'of Cust COGS'}
              valueMm={c.valueMm}
              deltaPct={c.deltaPct}
              onClick={() => onPick(c.company.ticker)}
              quantified={c.quantified}
            />
          ))}
          {customers.length === 0 && (
            <div className="splc-empty">No customer relationships found</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------- table -------------------------------- */

function TableView({
  suppliers,
  customers,
  sort,
  onPick,
}: {
  suppliers: SplcRelationship[];
  customers: SplcRelationship[];
  sort: SortMode;
  onPick: (ticker: string) => void;
}) {
  const renderRows = (rels: SplcRelationship[], side: 'Supp' | 'Cust') =>
    rels.map((r) => {
      const primary = sort === 'company' ? r.companyExposurePct : r.relationshipExposurePct;
      const secondary = sort === 'company' ? r.relationshipExposurePct : r.companyExposurePct;
      return (
        <tr key={`${side}-${r.company.ticker}`} onClick={() => onPick(r.company.ticker)}>
          <td>
            <span className={`splc-side-chip splc-side-${side.toLowerCase()}`}>{side}</span>
          </td>
          <td className="splc-td-ticker">{r.company.ticker}</td>
          <td>{r.company.name}</td>
          <td className="splc-td-meta">{r.company.country}</td>
          <td className="splc-td-meta">{r.company.industry}</td>
          <td className={`splc-td-num ${exposureTone(primary)}`}>{fmtPct(primary)}</td>
          <td className={`splc-td-num ${exposureTone(secondary)}`}>{fmtPct(secondary)}</td>
          <td className="splc-td-num">{fmtUsd(r.valueMm)}</td>
          <td className={`splc-td-num ${r.deltaPct >= 0 ? 'splc-delta-up' : 'splc-delta-down'}`}>
            {r.deltaPct >= 0 ? '+' : ''}
            {r.deltaPct.toFixed(1)}%
          </td>
          <td className="splc-td-meta splc-source-cell">
            <span className="splc-source-badge">{r.source}</span>
            <span className="splc-source-date">{r.sourceDate}</span>
          </td>
          <td>
            <ExternalLink className="splc-td-icon" />
          </td>
        </tr>
      );
    });

  return (
    <div className="splc-table-wrap">
      <table className="splc-table">
        <thead>
          <tr>
            <th>Side</th>
            <th>Ticker</th>
            <th>Company</th>
            <th>Ctry</th>
            <th>Industry</th>
            <th>{sort === 'company' ? 'Company Exp.' : 'Rel. Exp.'}</th>
            <th>{sort === 'company' ? 'Rel. Exp.' : 'Company Exp.'}</th>
            <th>Flow $</th>
            <th>Δ YoY</th>
            <th>Source</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {renderRows(suppliers, 'Supp')}
          {renderRows(customers, 'Cust')}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------- root ---------------------------------- */

export default function SplcView({ ticker, seedSalt = 0, onRefresh }: SplcViewProps) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortMode>('company');
  const [view, setView] = useState<ViewMode>('chart');
  const [quantifiedOnly, setQuantifiedOnly] = useState(false);

  const data = useMemo(() => generateSplcData(`${ticker}#${seedSalt}`), [ticker, seedSalt]);

  const suppliers = useMemo(() => {
    const filtered = quantifiedOnly ? data.suppliers.filter((s) => s.quantified) : data.suppliers;
    return sortForView(filtered, sort);
  }, [data, quantifiedOnly, sort]);

  const customers = useMemo(() => {
    const filtered = quantifiedOnly ? data.customers.filter((c) => c.quantified) : data.customers;
    return sortForView(filtered, sort);
  }, [data, quantifiedOnly, sort]);

  const maxValue = useMemo(
    () => Math.max(1, ...suppliers.map((s) => s.valueMm), ...customers.map((c) => c.valueMm)),
    [suppliers, customers],
  );

  const topSupplier = suppliers[0];
  const topCustomer = customers[0];
  const top3SupplierShare = suppliers
    .slice(0, 3)
    .reduce((acc, s) => acc + s.companyExposurePct, 0);
  const top3CustomerShare = customers
    .slice(0, 3)
    .reduce((acc, c) => acc + c.companyExposurePct, 0);

  const pickCompany = (t: string) => {
    navigate(`/terminal/splc/${encodeURIComponent(t)}`);
  };

  return (
    <div className="splc-root">
      {/* Toolbar */}
      <div className="splc-toolbar">
        <div className="splc-toolbar-group">
          <span className="splc-toolbar-label">SORT</span>
          <div className="splc-segmented">
            <button
              className={sort === 'company' ? 'on' : ''}
              onClick={() => setSort('company')}
              title="Sort by how exposed the focal firm is to this relationship"
            >
              <ArrowLeftRight className="splc-ico" />
              Company Exposure
            </button>
            <button
              className={sort === 'relationship' ? 'on' : ''}
              onClick={() => setSort('relationship')}
              title="Sort by how exposed the counterparty is to the focal firm"
            >
              <ArrowLeftRight className="splc-ico" />
              Relationship Exposure
            </button>
          </div>
        </div>

        <div className="splc-toolbar-group">
          <span className="splc-toolbar-label">VIEW</span>
          <div className="splc-segmented">
            <button className={view === 'chart' ? 'on' : ''} onClick={() => setView('chart')}>
              <BarChart2 className="splc-ico" />
              Chart
            </button>
            <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>
              <Table className="splc-ico" />
              Table
            </button>
          </div>
        </div>

        <label className="splc-filter-toggle">
          <input
            type="checkbox"
            checked={quantifiedOnly}
            onChange={(e) => setQuantifiedOnly(e.target.checked)}
          />
          <Filter className="splc-ico" />
          Quantified Relationships Only
        </label>

        <div className="splc-toolbar-spacer" />

        <div className="splc-toolbar-meta">
          <span>
            Top 3 suppliers = <b>{top3SupplierShare.toFixed(1)}%</b> of COGS
          </span>
          <span>
            Top 3 customers = <b>{top3CustomerShare.toFixed(1)}%</b> of revenue
          </span>
        </div>
      </div>

      {/* Main canvas */}
      {view === 'chart' ? (
        <div className="splc-stage">
          <div className="splc-center-slot">
            <CenterCard center={data.center} onRefresh={onRefresh ?? (() => {})} />
          </div>
          <ChartView
            suppliers={suppliers}
            customers={customers}
            sort={sort}
            onPick={pickCompany}
            maxValueMm={maxValue}
          />
        </div>
      ) : (
        <div className="splc-stage splc-stage-table">
          <div className="splc-center-slot splc-center-slot-compact">
            <CenterCard center={data.center} onRefresh={onRefresh ?? (() => {})} />
          </div>
          <TableView
            suppliers={suppliers}
            customers={customers}
            sort={sort}
            onPick={pickCompany}
          />
        </div>
      )}

      {/* Peers row */}
      <div className="splc-peers">
        <div className="splc-peers-header">
          <span className="splc-peers-title">
            <ChevronDown className="splc-ico" />
            PEERS / COMPETITORS ({data.peers.length})
          </span>
        </div>
        <div className="splc-peers-list">
          {data.peers.map((p) => (
            <NodeCard
              key={p.ticker}
              tone="peer"
              ticker={p.ticker}
              name={p.name}
              country={p.country}
              sub={p.industry}
              onClick={() => pickCompany(p.ticker)}
            />
          ))}
        </div>
      </div>

      {/* Concentration footer */}
      <div className="splc-footer">
        <div className="splc-footer-cell">
          <span className="splc-footer-label">TOP SUPPLIER</span>
          <b>{topSupplier?.company.ticker ?? '—'}</b>
          <em>
            {topSupplier ? `${fmtPct(topSupplier.companyExposurePct)} of COGS` : 'n/a'}
          </em>
        </div>
        <div className="splc-footer-cell">
          <span className="splc-footer-label">TOP CUSTOMER</span>
          <b>{topCustomer?.company.ticker ?? '—'}</b>
          <em>
            {topCustomer ? `${fmtPct(topCustomer.companyExposurePct)} of revenue` : 'n/a'}
          </em>
        </div>
        <div className="splc-footer-cell">
          <span className="splc-footer-label">SUPPLIERS</span>
          <b>{suppliers.length}</b>
          <em>
            {suppliers.filter((s) => s.quantified).length} quantified
          </em>
        </div>
        <div className="splc-footer-cell">
          <span className="splc-footer-label">CUSTOMERS</span>
          <b>{customers.length}</b>
          <em>
            {customers.filter((c) => c.quantified).length} quantified
          </em>
        </div>
        <div className="splc-footer-cell">
          <span className="splc-footer-label">CONCENTRATION</span>
          <b
            className={
              top3SupplierShare > 35 || top3CustomerShare > 35
                ? 'splc-risk-high'
                : 'splc-risk-ok'
            }
          >
            {top3SupplierShare > 35 || top3CustomerShare > 35 ? 'ELEVATED' : 'NORMAL'}
          </b>
          <em>top-3 share</em>
        </div>
      </div>
    </div>
  );
}
