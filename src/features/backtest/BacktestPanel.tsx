/**
 * BacktestPanel — minimal UI over /api/backtest/run.
 *
 * Same engine the agent tool calls, so numbers shown here will match what
 * an agent reports for the same spec. Renders the metrics table + the
 * equity-curve PNG returned inline as `plot_b64`.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listStrategies,
  runBacktest,
  type BacktestResult,
  type StrategyMeta,
} from './api';

const COLORS = {
  bg: '#0f0f17',
  panel: '#171723',
  border: 'rgba(139,92,246,0.15)',
  text: '#e2e8f0',
  muted: '#94a3b8',
  accent: '#8b5cf6',
  good: '#10b981',
  bad: '#ef4444',
};

const inputStyle: React.CSSProperties = {
  background: '#0a0a12',
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  padding: '8px 10px',
  borderRadius: 6,
  fontSize: 13,
  width: '100%',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: COLORS.muted,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 4,
  display: 'block',
};

function fmtPct(n: number | undefined | null, digits = 2): string {
  if (n === null || n === undefined || isNaN(n as number)) return '—';
  return `${(n as number).toFixed(digits)}%`;
}
function fmt(n: number | undefined | null, digits = 2): string {
  if (n === null || n === undefined || isNaN(n as number)) return '—';
  return (n as number).toFixed(digits);
}

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' | 'muted' }) => (
  <div
    style={{
      background: COLORS.bg,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 6,
      padding: '10px 12px',
      minWidth: 0,
    }}
  >
    <div style={{ fontSize: 10, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    <div
      style={{
        fontSize: 18,
        fontWeight: 600,
        marginTop: 2,
        color: tone === 'good' ? COLORS.good : tone === 'bad' ? COLORS.bad : COLORS.text,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}
    </div>
  </div>
);

export default function BacktestPanel() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<StrategyMeta[]>([]);
  const [symbol, setSymbol] = useState('SPY');
  const [start, setStart] = useState('2020-01-01');
  const [end, setEnd] = useState('2023-12-31');
  const [strategy, setStrategy] = useState('sma_crossover');
  const [paramsText, setParamsText] = useState('{"fast": 50, "slow": 200}');
  const [initialCash, setInitialCash] = useState(10000);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);

  useEffect(() => {
    listStrategies()
      .then((s) => {
        setStrategies(s);
      })
      .catch((e) => setError(`Could not load strategies: ${e.message}`));
  }, []);

  // When strategy changes, prefill the params textarea with the defaults.
  useEffect(() => {
    const meta = strategies.find((s) => s.name === strategy);
    if (meta) setParamsText(JSON.stringify(meta.params, null, 2));
  }, [strategy, strategies]);

  const onRun = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      let params: Record<string, any> = {};
      if (paramsText.trim()) {
        try {
          params = JSON.parse(paramsText);
        } catch {
          throw new Error('Params is not valid JSON');
        }
      }
      const res = await runBacktest({
        symbol,
        start,
        end,
        strategy,
        params,
        initial_cash: initialCash,
      });
      setResult(res);
      if (!res.success) setError(res.error || 'Backtest failed');
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setRunning(false);
    }
  };

  const m = result?.metrics;
  const beatsBH = useMemo(() => {
    if (!m) return null;
    return m.return_pct - m.buy_and_hold_pct;
  }, [m]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 20,
        color: COLORS.text,
        background: '#0a0a12',
        minHeight: '100%',
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Backtest</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: COLORS.muted }}>
          Same engine the agents use. Metrics here match what an agent reports for the same spec.
        </p>
      </div>

      {/* Form */}
      <div
        style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
        }}
      >
        <div>
          <label style={labelStyle}>Symbol</label>
          <input style={inputStyle} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
        </div>
        <div>
          <label style={labelStyle}>Start</label>
          <input style={inputStyle} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>End</label>
          <input style={inputStyle} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Strategy</label>
          <select style={inputStyle} value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            {strategies.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Initial cash</label>
          <input
            style={inputStyle}
            type="number"
            value={initialCash}
            onChange={(e) => setInitialCash(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Params (JSON)</label>
          <textarea
            style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace', minHeight: 60 }}
            value={paramsText}
            onChange={(e) => setParamsText(e.target.value)}
          />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
          {error && <span style={{ fontSize: 12, color: COLORS.bad }}>{error}</span>}
          <button
            onClick={() => {
              const qs = new URLSearchParams({
                symbol, start, end, strategy, params: paramsText,
              }).toString();
              navigate(`/improvement?${qs}`);
            }}
            disabled={running}
            title="Run the Phase-I self-improvement loop seeded with this spec"
            style={{
              background: 'transparent',
              color: COLORS.accent,
              border: `1px solid ${COLORS.border}`,
              padding: '8px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Improve →
          </button>
          <button
            onClick={onRun}
            disabled={running}
            style={{
              background: running ? '#5b3fb6' : COLORS.accent,
              color: 'white',
              border: 'none',
              padding: '8px 18px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: running ? 'wait' : 'pointer',
            }}
          >
            {running ? 'Running…' : 'Run backtest'}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && result.success && m && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <Stat label="Return" value={fmtPct(m.return_pct, 1)} tone={m.return_pct >= 0 ? 'good' : 'bad'} />
            <Stat label="vs B&H" value={beatsBH! >= 0 ? `+${fmtPct(beatsBH!, 1)}` : fmtPct(beatsBH!, 1)} tone={beatsBH! >= 0 ? 'good' : 'bad'} />
            <Stat label="Sharpe" value={fmt(m.sharpe, 2)} />
            <Stat label="Max DD" value={fmtPct(m.max_drawdown_pct, 1)} tone="bad" />
            <Stat label="Trades" value={String(m.n_trades)} />
            <Stat label="Win rate" value={fmtPct(m.win_rate_pct, 1)} />
            <Stat label="Final equity" value={`$${fmt(m.final_equity, 0)}`} />
            <Stat label="Buy & hold" value={fmtPct(m.buy_and_hold_pct, 1)} tone="muted" />
          </div>

          {result.plot_b64 && (
            <div
              style={{
                background: COLORS.panel,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: 12,
              }}
            >
              <img
                src={result.plot_b64}
                alt="Equity curve"
                style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 4 }}
              />
            </div>
          )}

          {result.trades.length > 0 && (
            <div
              style={{
                background: COLORS.panel,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: 12,
                overflow: 'auto',
              }}
            >
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>
                Trades · showing {Math.min(result.trades.length, 50)} of {result.trades.length}
              </div>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead style={{ color: COLORS.muted, textAlign: 'left' }}>
                  <tr>
                    <th style={{ padding: '6px 8px' }}>Entry</th>
                    <th style={{ padding: '6px 8px' }}>Exit</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Entry $</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Exit $</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>PnL</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Return</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.slice(0, 50).map((t, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>
                        {t.entry_time?.slice(0, 10) ?? '—'}
                      </td>
                      <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>
                        {t.exit_time?.slice(0, 10) ?? '—'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(t.entry_price)}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(t.exit_price)}
                      </td>
                      <td
                        style={{
                          padding: '6px 8px',
                          textAlign: 'right',
                          color: (t.pnl ?? 0) >= 0 ? COLORS.good : COLORS.bad,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {fmt(t.pnl)}
                      </td>
                      <td
                        style={{
                          padding: '6px 8px',
                          textAlign: 'right',
                          color: (t.return_pct ?? 0) >= 0 ? COLORS.good : COLORS.bad,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {fmtPct((t.return_pct ?? 0) * 100, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {result && !result.success && (
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            padding: 12,
            fontSize: 13,
            color: COLORS.bad,
            whiteSpace: 'pre-wrap',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {result.error}
        </div>
      )}
    </div>
  );
}
