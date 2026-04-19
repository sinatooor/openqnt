/**
 * RmapView - Bloomberg-style Relationship Map.
 *
 * Layout: 4-column x 4-row CSS grid with the central ticker card spanning
 * the middle 2x2 cells.  The surrounding 12 cells each host a data node
 * (News, Indices, Peers, Holders, Analysts, Board, Events, Options,
 * Exchanges, CDS, Balance Sheet, Executives).  An SVG layer draws thin
 * amber connector lines from the centre to every outer node.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
} from 'recharts';
import type {
  AnalystRating,
  BalanceBar,
  CdsPoint,
  EventItem,
  HolderTile,
  NewsItem,
  OptionsPoint,
  PersonTile,
  RmapData,
  TickerTile,
  ExchangeTile,
} from './mockData';
import { generateRmapData } from './mockData';

/* ------------------------------ color helpers ----------------------------- */

const AMBER = '#ff9f1a';
const AMBER_SOFT = 'rgba(255, 159, 26, 0.35)';
const AMBER_DIM = 'rgba(255, 159, 26, 0.10)';

function changeBg(change: number): string {
  if (change > 1.5) return 'bg-emerald-700/80 text-emerald-50 border-emerald-500/60';
  if (change > 0) return 'bg-emerald-800/70 text-emerald-100 border-emerald-600/40';
  if (change > -1.5) return 'bg-red-800/70 text-red-100 border-red-600/40';
  return 'bg-red-700/80 text-red-50 border-red-500/60';
}

function changeText(change: number): string {
  return change >= 0 ? 'text-emerald-400' : 'text-red-400';
}

/* ------------------------------- node shell ------------------------------- */

interface RmapNodeProps {
  title: string;
  total: string;
  children: React.ReactNode;
  /** Used to anchor the SVG connector; must be unique per node. */
  nodeId: string;
  /** Grid placement (1-indexed CSS grid lines) */
  col: [number, number];
  row: [number, number];
}

function RmapNode({ title, total, children, nodeId, col, row }: RmapNodeProps) {
  return (
    <div
      data-rmap-node={nodeId}
      className="relative flex min-h-0 flex-col overflow-hidden rounded-sm border border-[#332200] bg-[#050505]/95 shadow-[inset_0_0_0_1px_rgba(255,159,26,0.04)]"
      style={{
        gridColumn: `${col[0]} / span ${col[1] - col[0]}`,
        gridRow: `${row[0]} / span ${row[1] - row[0]}`,
      }}
    >
      <header className="flex items-center justify-between border-b border-[#332200] bg-[#141005] px-2 py-1">
        <span
          className="truncate text-[10px] font-bold uppercase tracking-wider"
          style={{ color: AMBER }}
        >
          {title}
        </span>
        <span className="ml-2 shrink-0 font-mono text-[9px] text-zinc-500">{total}</span>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden p-1.5">{children}</div>
    </div>
  );
}

/* ------------------------------ inner panels ------------------------------ */

function TickerTileGrid({ items }: { items: TickerTile[] }) {
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {items.slice(0, 9).map((t) => (
        <div
          key={t.symbol}
          title={`${t.symbol}  ${t.changePct >= 0 ? '+' : ''}${t.changePct}%`}
          className={`truncate rounded-sm border px-1 py-0.5 text-center font-mono text-[9px] leading-tight ${changeBg(
            t.changePct,
          )}`}
        >
          {t.symbol}
        </div>
      ))}
    </div>
  );
}

function HoldersPanel({ items }: { items: HolderTile[] }) {
  return (
    <ul className="space-y-0.5">
      {items.slice(0, 6).map((h) => (
        <li
          key={h.name}
          className="flex items-center justify-between rounded-sm bg-zinc-900/60 px-1.5 py-0.5 text-[9px]"
        >
          <span className="truncate text-zinc-200">{h.name}</span>
          <span className="ml-1 shrink-0 font-mono">
            <span className="text-zinc-400">{h.pctOwned}%</span>
            <span className={`ml-1 ${changeText(h.changePct)}`}>
              {h.changePct >= 0 ? '+' : ''}
              {h.changePct}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function AnalystsPanel({ items }: { items: AnalystRating[] }) {
  const buyColor = (a: AnalystRating['action']) =>
    a === 'BUY'
      ? 'bg-emerald-800/80 text-emerald-50 border-emerald-500/50'
      : a === 'HOLD'
        ? 'bg-amber-800/70 text-amber-50 border-amber-500/50'
        : 'bg-red-800/80 text-red-50 border-red-500/50';
  return (
    <div className="grid grid-cols-2 gap-0.5">
      {items.slice(0, 8).map((r, i) => (
        <div
          key={`${r.firm}-${i}`}
          className={`flex items-center justify-between rounded-sm border px-1 py-0.5 text-[9px] ${buyColor(r.action)}`}
        >
          <span className="truncate">{r.firm}</span>
          <span className="ml-1 font-mono text-[8px] opacity-80">{r.action[0]}</span>
        </div>
      ))}
    </div>
  );
}

function PeoplePanel({ items }: { items: PersonTile[] }) {
  return (
    <ul className="space-y-0.5">
      {items.slice(0, 6).map((p) => (
        <li
          key={p.name + p.role}
          className="flex items-center justify-between gap-1 rounded-sm bg-zinc-900/60 px-1.5 py-0.5 text-[9px]"
        >
          <span className="truncate text-zinc-200">{p.name}</span>
          <span className="shrink-0 font-mono text-[8px] text-amber-400/80">{p.role}</span>
        </li>
      ))}
    </ul>
  );
}

function NewsPanel({ items }: { items: NewsItem[] }) {
  return (
    <ul className="space-y-1">
      {items.slice(0, 6).map((n, i) => (
        <li key={i} className="leading-tight">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[8px] text-amber-400/80">
              {n.minutesAgo < 60
                ? `${n.minutesAgo}m`
                : `${Math.floor(n.minutesAgo / 60)}h`}
            </span>
            <span className="text-[10px] text-zinc-200">{n.headline}</span>
          </div>
          <div className="pl-6 font-mono text-[8px] text-zinc-500">{n.source}</div>
        </li>
      ))}
    </ul>
  );
}

function EventsPanel({ items }: { items: EventItem[] }) {
  const tone: Record<EventItem['kind'], string> = {
    earnings: 'bg-blue-900/50 text-blue-200 border-blue-600/40',
    conference: 'bg-violet-900/50 text-violet-200 border-violet-600/40',
    dividend: 'bg-emerald-900/50 text-emerald-200 border-emerald-600/40',
    guidance: 'bg-amber-900/50 text-amber-200 border-amber-600/40',
    split: 'bg-cyan-900/50 text-cyan-200 border-cyan-600/40',
  };
  return (
    <ul className="space-y-0.5">
      {items.slice(0, 5).map((e, i) => (
        <li key={i} className="flex items-center gap-1.5 text-[9px]">
          <span className="shrink-0 rounded-sm border border-[#332200] bg-[#141005] px-1 py-0.5 font-mono text-amber-400">
            {e.date}
          </span>
          <span className="truncate text-zinc-200">{e.title}</span>
          <span className={`ml-auto shrink-0 rounded-sm border px-1 text-[8px] uppercase ${tone[e.kind]}`}>
            {e.kind[0]}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ExchangesPanel({ items }: { items: ExchangeTile[] }) {
  const max = Math.max(...items.map((x) => x.volumePct), 1);
  return (
    <ul className="space-y-0.5">
      {items.slice(0, 6).map((x, i) => (
        <li key={i} className="flex items-center gap-1.5 text-[9px]">
          <span className="w-14 truncate font-mono text-zinc-200">{x.code}</span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-sm bg-zinc-900">
            <div
              className="h-full bg-amber-500/70"
              style={{ width: `${(x.volumePct / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right font-mono text-zinc-400">
            {x.volumePct.toFixed(1)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function OptionsPanel({ items }: { items: OptionsPoint[] }) {
  const data = items.map((o) => ({ strike: o.strike, iv: o.iv }));
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <Line
            type="monotone"
            dataKey="iv"
            stroke={AMBER}
            strokeWidth={1.5}
            dot={{ r: 1.5, fill: AMBER, stroke: 'none' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CdsPanel({ items }: { items: CdsPoint[] }) {
  const data = items.map((c) => ({ tenor: c.tenor, spread: c.spreadBp }));
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="cdsGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={AMBER} stopOpacity={0.6} />
              <stop offset="100%" stopColor={AMBER} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="spread"
            stroke={AMBER}
            strokeWidth={1.5}
            fill="url(#cdsGradient)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function BalanceSheetPanel({ items }: { items: BalanceBar[] }) {
  const toneFill: Record<BalanceBar['tone'], string> = {
    asset: '#10b981',
    liability: '#ef4444',
    equity: '#3b82f6',
  };
  const data = items.map((b) => ({
    label: b.label,
    value: b.value,
    fill: toneFill[b.tone],
  }));
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <Bar dataKey="value" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------ centre card ------------------------------- */

function CentralNode({ data, onRefresh }: { data: RmapData; onRefresh: () => void }) {
  const { center } = data;
  const up = center.changePct >= 0;
  const spark = center.sparkline.map((v, i) => ({ x: i, v }));

  return (
    <div
      data-rmap-node="center"
      className="relative z-10 flex min-h-0 flex-col items-stretch overflow-hidden rounded-sm border-2 border-[#ff9f1a]/60 bg-black shadow-[0_0_24px_rgba(255,159,26,0.15)]"
      style={{ gridColumn: '2 / span 2', gridRow: '2 / span 2' }}
    >
      <div className="flex items-center justify-between border-b border-[#332200] bg-[#141005] px-3 py-1">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: AMBER }}>
          Relationship Map
        </span>
        <button
          onClick={onRefresh}
          className="rounded border border-[#332200] bg-black px-1.5 py-0.5 font-mono text-[9px] text-amber-400 hover:bg-[#141005]"
        >
          REFRESH
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-1 p-3 text-center">
        <div className="font-mono text-[22px] font-bold tracking-wider text-white">
          {center.ticker}
          <span className="ml-1 text-[13px] text-amber-400/80">{center.exchange}</span>
        </div>
        <div className="text-[11px] text-zinc-400">{center.name}</div>

        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-[20px] font-bold text-white">
            {center.price.toFixed(2)}
          </span>
          <span className="font-mono text-[10px] text-zinc-500">{center.currency}</span>
          <span
            className={`font-mono text-[12px] font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {up ? '▲' : '▼'} {up ? '+' : ''}
            {center.changePct.toFixed(2)}%
          </span>
        </div>

        <div className="mt-2 h-10 w-full max-w-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={up ? '#10b981' : '#ef4444'} stopOpacity={0.45} />
                  <stop
                    offset="100%"
                    stopColor={up ? '#10b981' : '#ef4444'}
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={up ? '#10b981' : '#ef4444'}
                strokeWidth={1.5}
                fill="url(#sparkFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- connector lines ---------------------------- */

/**
 * Twelve lines drawn on a 100x100 viewBox from the centre (50,50) to the
 * centre of each surrounding grid cell.  The SVG is rendered with
 * `preserveAspectRatio="none"` so the lines stretch to match whatever size
 * the container ends up at.
 */
function ConnectorLines() {
  // Outer cell centres in a 4x4 grid: each cell is 25% wide.
  // Column centres: 12.5, 37.5, 62.5, 87.5
  // Row centres:    12.5, 37.5, 62.5, 87.5
  const targets: Array<[number, number]> = [
    [12.5, 12.5], // r1c1 - News
    [37.5, 12.5], // r1c2 - Indices
    [62.5, 12.5], // r1c3 - Peers
    [87.5, 12.5], // r1c4 - Holders
    [12.5, 37.5], // r2c1 - Events
    [87.5, 37.5], // r2c4 - Analysts
    [12.5, 62.5], // r3c1 - Options
    [87.5, 62.5], // r3c4 - Board
    [12.5, 87.5], // r4c1 - Exchanges
    [37.5, 87.5], // r4c2 - CDSs
    [62.5, 87.5], // r4c3 - Balance Sheet
    [87.5, 87.5], // r4c4 - Executives
  ];
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {targets.map(([x, y], i) => (
        <line
          key={i}
          x1={50}
          y1={50}
          x2={x}
          y2={y}
          stroke={AMBER_SOFT}
          strokeWidth={0.15}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {targets.map(([x, y], i) => (
        <circle key={`d-${i}`} cx={x} cy={y} r={0.4} fill={AMBER} />
      ))}
      <circle cx={50} cy={50} r={1.1} fill={AMBER} fillOpacity={0.25} />
    </svg>
  );
}

/* ----------------------------------- root --------------------------------- */

export interface RmapViewProps {
  ticker: string;
  /** Bumping this forces regeneration of mock data (used for the REFRESH button). */
  seedSalt?: number;
  onRefresh?: () => void;
}

export default function RmapView({ ticker, seedSalt = 0, onRefresh }: RmapViewProps) {
  const navigate = useNavigate();
  const data = useMemo(
    () => generateRmapData(`${ticker}#${seedSalt}`),
    [ticker, seedSalt],
  );

  return (
    <div className="space-y-2">
      {/* Command header */}
      <div className="terminal-commandbar flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-amber-400">
            {data.center.ticker} &lt;EQUITY&gt; RMAP
          </span>
          <span className="text-[10px] text-zinc-500">|</span>
          <span className="text-[10px] text-zinc-500">Relationship Map</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('/terminal')}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-300 hover:bg-zinc-800"
          >
            &larr; MENU
          </button>
        </div>
      </div>

      {/* Graphical map */}
      <div
        className="relative grid w-full gap-2"
        style={{
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gridAutoRows: 'minmax(120px, 1fr)',
          height: 'min(78vh, 900px)',
          padding: 8,
          background: `radial-gradient(ellipse at center, ${AMBER_DIM} 0%, transparent 62%), #050505`,
          border: '1px solid #332200',
          borderRadius: 2,
        }}
      >
        {/* SVG connector lines behind the nodes */}
        <ConnectorLines />

        {/* Row 1 */}
        <RmapNode
          nodeId="news"
          title={`News (${data.news.items.length}/${data.news.total})`}
          total="NH"
          col={[1, 2]}
          row={[1, 2]}
        >
          <NewsPanel items={data.news.items} />
        </RmapNode>
        <RmapNode
          nodeId="indices"
          title={`Indices (${data.indices.items.length}/${data.indices.total})`}
          total="WGT"
          col={[2, 3]}
          row={[1, 2]}
        >
          <TickerTileGrid items={data.indices.items} />
        </RmapNode>
        <RmapNode
          nodeId="peers"
          title={`Peers (${data.peers.items.length}/${data.peers.total})`}
          total="RV"
          col={[3, 4]}
          row={[1, 2]}
        >
          <TickerTileGrid items={data.peers.items} />
        </RmapNode>
        <RmapNode
          nodeId="holders"
          title={`Holders (${data.holders.items.length}/${data.holders.total})`}
          total="HDS"
          col={[4, 5]}
          row={[1, 2]}
        >
          <HoldersPanel items={data.holders.items} />
        </RmapNode>

        {/* Row 2 — left: Events, centre 2x2, right: Analysts */}
        <RmapNode
          nodeId="events"
          title={`Events (${data.events.items.length}/${data.events.total})`}
          total="CACS"
          col={[1, 2]}
          row={[2, 3]}
        >
          <EventsPanel items={data.events.items} />
        </RmapNode>

        <CentralNode data={data} onRefresh={onRefresh ?? (() => {})} />

        <RmapNode
          nodeId="analysts"
          title={`Analysts (${data.analysts.items.length}/${data.analysts.total})`}
          total="ANR"
          col={[4, 5]}
          row={[2, 3]}
        >
          <AnalystsPanel items={data.analysts.items} />
        </RmapNode>

        {/* Row 3 — left: Options, right: Board */}
        <RmapNode
          nodeId="options"
          title={`Options (${data.options.items.length}/${data.options.total})`}
          total="OMON"
          col={[1, 2]}
          row={[3, 4]}
        >
          <OptionsPanel items={data.options.items} />
        </RmapNode>

        <RmapNode
          nodeId="board"
          title={`Board (${data.board.items.length}/${data.board.total})`}
          total="MGMT"
          col={[4, 5]}
          row={[3, 4]}
        >
          <PeoplePanel items={data.board.items} />
        </RmapNode>

        {/* Row 4 */}
        <RmapNode
          nodeId="exchanges"
          title={`Exchanges (${data.exchanges.items.length}/${data.exchanges.total})`}
          total="QM"
          col={[1, 2]}
          row={[4, 5]}
        >
          <ExchangesPanel items={data.exchanges.items} />
        </RmapNode>
        <RmapNode
          nodeId="cds"
          title={`CDSs (${data.cds.items.length}/${data.cds.total})`}
          total="CG"
          col={[2, 3]}
          row={[4, 5]}
        >
          <CdsPanel items={data.cds.items} />
        </RmapNode>
        <RmapNode
          nodeId="balance"
          title="Balance Sheet"
          total="FA"
          col={[3, 4]}
          row={[4, 5]}
        >
          <BalanceSheetPanel items={data.balanceSheet.items} />
        </RmapNode>
        <RmapNode
          nodeId="executives"
          title={`Executives (${data.executives.items.length}/${data.executives.total})`}
          total="MGMT"
          col={[4, 5]}
          row={[4, 5]}
        >
          <PeoplePanel items={data.executives.items} />
        </RmapNode>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#332200] bg-[#0a0a00] px-3 py-1.5">
        <div className="flex items-center gap-3 text-[10px] text-zinc-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-emerald-500" />
            Up move
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-red-500" />
            Down move
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm border border-amber-500/60" />
            Data node
          </span>
        </div>
        <div className="font-mono text-[10px] text-zinc-500">
          Hover a tile for details &middot; Click to drill down (coming soon)
        </div>
      </div>
    </div>
  );
}
