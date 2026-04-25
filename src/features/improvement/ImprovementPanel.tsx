/**
 * ImprovementPanel — Phase I tree view + control surface.
 *
 * Three sections:
 *   1. Seed form — symbol, dates, strategy, params, validation window.
 *   2. Live tree — nodes appear as the WS streams events; rows are
 *      grouped by iteration, sorted by score within a group, with the
 *      "best" + "validation" tags surfaced.
 *   3. Summary card — once the run finishes, side-by-side seed vs best
 *      in-sample, plus the validation re-run on the held-out window.
 *
 * Defaults to the Phase E RSI template seed, so the exit-criterion
 * happy path is "land on /improvement, hit Run".
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getImprovementRun,
  openImprovementWs,
  startImprovement,
  type ImprovementNode,
  type ImprovementSummary,
  type ImprovementWsEvent,
} from './api';

const C = {
  bg: '#0a0a12',
  panel: '#171723',
  border: 'rgba(139,92,246,0.18)',
  amber: '#ff9f1a',
  text: '#e2e8f0',
  muted: '#94a3b8',
  good: '#10b981',
  bad: '#ef4444',
  accent: '#8b5cf6',
};

const SEED_DEFAULT = {
  symbol: 'SPY',
  start: '2018-01-01',
  end: '2022-12-31',
  strategy: 'rsi_meanrev',
  params: { rsi_period: 14, oversold: 30, overbought: 70 },
};

function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v as number)) return '—';
  return (v as number).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function StatusDot({ status }: { status: ImprovementNode['status'] }) {
  const colour = status === 'success' ? C.good
    : status === 'error' ? C.bad
    : status === 'pending' ? C.amber
    : C.muted;
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: colour, marginRight: 6,
    }} />
  );
}

function TagPill({ tag }: { tag: string }) {
  if (!tag) return null;
  const map: Record<string, [string, string]> = {
    seed:       [C.amber,  'rgba(255,159,26,0.15)'],
    best:       [C.good,   'rgba(16,185,129,0.15)'],
    validation: [C.accent, 'rgba(139,92,246,0.15)'],
  };
  const [fg, bg] = map[tag] || [C.muted, 'rgba(148,163,184,0.12)'];
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 0.5, color: fg, background: bg,
      padding: '1px 6px', borderRadius: 3,
    }}>{tag}</span>
  );
}

export default function ImprovementPanel() {
  const [searchParams] = useSearchParams();
  // Allow the BacktestPanel "Improve →" button to pre-seed via query
  // string: ?symbol=…&start=…&end=…&strategy=…&params=<json>
  const initialFromUrl = useMemo(() => {
    const sym = searchParams.get('symbol')?.toUpperCase();
    const strat = searchParams.get('strategy');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const paramsRaw = searchParams.get('params') ?? '';
    return {
      symbol: sym || SEED_DEFAULT.symbol,
      start: start || SEED_DEFAULT.start,
      end: end || SEED_DEFAULT.end,
      strategy: strat || SEED_DEFAULT.strategy,
      paramsJson: paramsRaw || JSON.stringify(SEED_DEFAULT.params, null, 2),
    };
  }, [searchParams]);

  const [seedForm, setSeedForm] = useState({
    ...SEED_DEFAULT,
    ...initialFromUrl,
    nIters: 5,
    fanout: 2,
    validationStart: '2023-01-01',
    validationEnd: '2023-12-31',
  });
  const [runId, setRunId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<ImprovementNode[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [summary, setSummary] = useState<ImprovementSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Tear down WS on unmount.
  useEffect(() => () => {
    if (wsRef.current) wsRef.current.close();
  }, []);

  const onStart = async () => {
    setError(null);
    setSummary(null);
    setNodes([]);
    let params: Record<string, any> = {};
    try {
      params = seedForm.paramsJson.trim() ? JSON.parse(seedForm.paramsJson) : {};
    } catch {
      setError('Params is not valid JSON');
      return;
    }
    setStatus('running');
    try {
      const { run_id } = await startImprovement({
        seed: {
          symbol: seedForm.symbol,
          start: seedForm.start,
          end: seedForm.end,
          strategy: seedForm.strategy,
          params,
        },
        n_iters: seedForm.nIters,
        fanout: seedForm.fanout,
        validation_start: seedForm.validationStart || undefined,
        validation_end: seedForm.validationEnd || undefined,
      });
      setRunId(run_id);
      // Wire WS.
      if (wsRef.current) wsRef.current.close();
      wsRef.current = openImprovementWs(run_id, (e: ImprovementWsEvent) => {
        if (e.kind === 'node_added' && e.node) {
          setNodes((prev) => [...prev, e.node!]);
        } else if (e.kind === 'node_updated' && e.node) {
          setNodes((prev) => prev.map((n) => n.id === e.node!.id ? e.node! : n));
        } else if (e.kind === 'run_complete') {
          setStatus(e.status === 'done' ? 'done' : 'error');
          if (e.summary) setSummary(e.summary);
        } else if (e.kind === 'error') {
          setError(e.message ?? 'unknown WS error');
          setStatus('error');
        }
      });
    } catch (e: any) {
      setError(e.message ?? String(e));
      setStatus('error');
    }
  };

  // If summary missing when WS closes early, fetch it once.
  useEffect(() => {
    if (status === 'done' && !summary && runId) {
      getImprovementRun(runId).then((r) => {
        if (r.summary) setSummary(r.summary);
        if (r.nodes?.length) setNodes(r.nodes);
      }).catch(() => undefined);
    }
  }, [status, summary, runId]);

  const grouped = useMemo(() => {
    const by: Record<number, ImprovementNode[]> = {};
    for (const n of nodes) (by[n.iteration] ||= []).push(n);
    for (const k of Object.keys(by)) {
      by[+k].sort((a, b) =>
        (b.score ?? -Infinity) - (a.score ?? -Infinity),
      );
    }
    return by;
  }, [nodes]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 14,
      padding: 20, background: C.bg, color: C.text, minHeight: '100%',
    }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Improve</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>
          Iterates a strategy's params, scores by Sharpe with a max-DD brake,
          re-runs the winner on a held-out window. Streams over WebSocket.
        </p>
      </div>

      {/* Seed + run controls */}
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: 14,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10,
      }}>
        <Field label="Symbol">
          <input style={inp} value={seedForm.symbol}
            onChange={(e) => setSeedForm({ ...seedForm, symbol: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="In-sample start">
          <input style={inp} type="date" value={seedForm.start}
            onChange={(e) => setSeedForm({ ...seedForm, start: e.target.value })} />
        </Field>
        <Field label="In-sample end">
          <input style={inp} type="date" value={seedForm.end}
            onChange={(e) => setSeedForm({ ...seedForm, end: e.target.value })} />
        </Field>
        <Field label="Validation start">
          <input style={inp} type="date" value={seedForm.validationStart}
            onChange={(e) => setSeedForm({ ...seedForm, validationStart: e.target.value })} />
        </Field>
        <Field label="Validation end">
          <input style={inp} type="date" value={seedForm.validationEnd}
            onChange={(e) => setSeedForm({ ...seedForm, validationEnd: e.target.value })} />
        </Field>
        <Field label="Strategy">
          <select style={inp} value={seedForm.strategy}
            onChange={(e) => setSeedForm({ ...seedForm, strategy: e.target.value })}>
            <option value="rsi_meanrev">rsi_meanrev</option>
            <option value="sma_crossover">sma_crossover</option>
          </select>
        </Field>
        <Field label="Iterations">
          <input style={inp} type="number" min={1} max={20}
            value={seedForm.nIters}
            onChange={(e) => setSeedForm({ ...seedForm, nIters: parseInt(e.target.value || '5') })} />
        </Field>
        <Field label="Fanout / iter">
          <input style={inp} type="number" min={1} max={6}
            value={seedForm.fanout}
            onChange={(e) => setSeedForm({ ...seedForm, fanout: parseInt(e.target.value || '2') })} />
        </Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={lab}>Seed params (JSON)</label>
          <textarea
            value={seedForm.paramsJson}
            onChange={(e) => setSeedForm({ ...seedForm, paramsJson: e.target.value })}
            style={{
              ...inp, fontFamily: 'ui-monospace, monospace',
              minHeight: 60, width: '100%',
            }}
          />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'center' }}>
          {error && <span style={{ fontSize: 12, color: C.bad }}>{error}</span>}
          <button onClick={onStart} disabled={status === 'running'}
            style={{
              marginLeft: 'auto',
              background: status === 'running' ? '#5b3fb6' : C.accent,
              color: 'white', border: 'none', padding: '8px 18px',
              borderRadius: 6, fontSize: 13, fontWeight: 600,
              cursor: status === 'running' ? 'wait' : 'pointer',
            }}>
            {status === 'running' ? 'Running…' : 'Improve'}
          </button>
        </div>
      </div>

      {/* Tree */}
      {nodes.length > 0 && (
        <div style={{
          background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: 14, overflow: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Search tree</h3>
            <span style={{ fontSize: 11, color: C.muted }}>
              {nodes.length} node{nodes.length === 1 ? '' : 's'}
              {runId && ` · ${runId}`}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color:
              status === 'done' ? C.good : status === 'error' ? C.bad : C.amber,
              fontWeight: 600,
            }}>{status}</span>
          </div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>Iter</th>
                <th style={th}>Tag</th>
                <th style={th}>Status</th>
                <th style={th}>Params</th>
                <th style={thR}>Sharpe</th>
                <th style={thR}>Max DD</th>
                <th style={thR}>Return</th>
                <th style={thR}>Trades</th>
                <th style={thR}>Score</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(grouped).map((k) => +k).sort((a, b) => a - b).flatMap((iter) =>
                grouped[iter].map((n) => (
                  <tr key={n.id} style={trBorder}>
                    <td style={tdMono}>{iter}</td>
                    <td style={td}><TagPill tag={n.tag} /></td>
                    <td style={td}><StatusDot status={n.status} />{n.status}</td>
                    <td style={{ ...tdMono, fontSize: 10 }}>
                      {JSON.stringify(n.spec.params)}
                    </td>
                    <td style={tdMonoR}>{fmt(n.metrics.sharpe)}</td>
                    <td style={tdMonoR}>{fmt(n.metrics.max_drawdown_pct, 1)}%</td>
                    <td style={tdMonoR}>{fmt(n.metrics.return_pct, 1)}%</td>
                    <td style={tdMonoR}>{n.metrics.n_trades ?? '—'}</td>
                    <td style={{
                      ...tdMonoR,
                      color: n.score === null ? C.muted
                        : n.score >= 0 ? C.good : C.bad,
                      fontWeight: n.tag === 'best' ? 700 : 400,
                    }}>{fmt(n.score, 3)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div style={{
          background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: 14,
        }}>
          <h3 style={{ margin: 0, marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
            Summary
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <Stat label="Iters run" value={String(summary.n_iters_run)} />
            <Stat label="Duration" value={`${summary.duration_s.toFixed(1)}s`} />
            <Stat label="Seed score" value={fmt(summary.seed_score, 3)} />
            <Stat label="Best score"
                  value={fmt(summary.best_score, 3)}
                  tone={summary.best_score > summary.seed_score ? 'good' : 'muted'} />
            <Stat label="Best params"
                  value={JSON.stringify(summary.best_params)} />
          </div>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <MetricsCard title="In-sample" m={summary.in_sample_metrics} />
            <MetricsCard title="Validation (out-of-sample)"
                         m={summary.validation_metrics ?? {}} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── small helpers ────────────────────────────────────────────

const lab: React.CSSProperties = {
  fontSize: 10, color: C.muted, textTransform: 'uppercase',
  letterSpacing: 0.5, marginBottom: 4, display: 'block',
};
const inp: React.CSSProperties = {
  background: '#000', color: C.text, border: `1px solid ${C.border}`,
  padding: '6px 8px', fontSize: 12, borderRadius: 4, width: '100%',
};
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={lab}>{label}</label>{children}</div>;
}
function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' | 'muted' }) {
  return (
    <div>
      <div style={lab}>{label}</div>
      <div style={{
        marginTop: 2, fontSize: 14, fontWeight: 600,
        color: tone === 'good' ? C.good : tone === 'bad' ? C.bad : C.text,
        fontFamily: 'ui-monospace, monospace',
        wordBreak: 'break-all',
      }}>{value}</div>
    </div>
  );
}
function MetricsCard({ title, m }: { title: string; m: Record<string, number> }) {
  return (
    <div style={{ background: '#000', border: `1px solid ${C.border}`,
                  borderRadius: 6, padding: 10 }}>
      <div style={{ fontSize: 11, color: C.amber, fontWeight: 600,
                    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </div>
      <table style={{ width: '100%', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>
        <tbody>
          {(['sharpe', 'max_drawdown_pct', 'return_pct', 'n_trades',
             'win_rate_pct', 'buy_and_hold_pct'] as const).map((k) => (
            <tr key={k}>
              <td style={{ color: C.muted, padding: '2px 6px' }}>{k}</td>
              <td style={{ textAlign: 'right', padding: '2px 6px' }}>
                {fmt(m?.[k] as number, k === 'n_trades' ? 0 : 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const tableStyle: React.CSSProperties = { width: '100%', fontSize: 12, borderCollapse: 'collapse' };
const th: React.CSSProperties = { padding: '5px 8px', color: C.muted, textAlign: 'left', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 };
const thR: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '5px 8px' };
const tdMono: React.CSSProperties = { ...td, fontFamily: 'ui-monospace, monospace' };
const tdMonoR: React.CSSProperties = { ...td, fontFamily: 'ui-monospace, monospace', textAlign: 'right' };
const trBorder: React.CSSProperties = { borderTop: `1px solid ${C.border}` };
