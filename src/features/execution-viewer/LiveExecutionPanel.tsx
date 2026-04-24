/**
 * LiveExecutionPanel — Phase H execution viewer.
 *
 * Three sections:
 *   1. Account header — broker, cash, equity, P&L, KILL SWITCH (H5).
 *   2. Open positions table.
 *   3. Order journal (newest first) with status pill + risk reason.
 *
 * Plus a compact "Send signal" form so the exit criterion can be
 * reproduced from the UI: pick {symbol, side, qty}, hit Send → see the
 * order land in the journal + position update within ~1 s.
 *
 * "Take template signal" calls /api/execution/template-signal which
 * reads the Phase E RSI template's spec and converts today's close +
 * RSI into a {buy/sell/flat} suggestion. The user can then click Send
 * to actually submit it — that's the Phase H exit criterion happy
 * path.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  clearPanic,
  engagePanic,
  getAccount,
  getOrders,
  getTemplateSignal,
  submitSignal,
  type AccountSnapshot,
  type JournalOrder,
  type TemplateSignal,
} from './api';

const C = {
  bg: '#0a0a12',
  panel: '#171723',
  border: 'rgba(139,92,246,0.15)',
  amber: '#ff9f1a',
  text: '#e2e8f0',
  muted: '#94a3b8',
  good: '#10b981',
  bad: '#ef4444',
  accent: '#8b5cf6',
};

const POLL_MS = 2000;

function fmt(n: number, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function signed(n: number, digits = 2): string {
  const v = fmt(n, digits);
  return n > 0 ? `+${v}` : v;
}
function relTime(iso?: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const sec = Math.max(0, (Date.now() - t) / 1000);
  if (sec < 60) return `${sec.toFixed(0)}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function StatusPill({ status }: { status: JournalOrder['status'] }) {
  const colour = {
    filled: C.good,
    rejected: C.bad,
    pending: C.amber,
    cancelled: C.muted,
    partial: C.amber,
  }[status] || C.muted;
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: colour,
        background: `${colour}1f`,
        padding: '1px 6px',
        borderRadius: 3,
      }}
    >
      {status}
    </span>
  );
}

export default function LiveExecutionPanel() {
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [orders, setOrders] = useState<JournalOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [symbol, setSymbol] = useState('SPY');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qty, setQty] = useState('1');
  const [tplSignal, setTplSignal] = useState<TemplateSignal | null>(null);

  const refresh = async () => {
    try {
      const [a, o] = await Promise.all([getAccount(), getOrders(50)]);
      setAccount(a);
      setOrders(o);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const onSend = async () => {
    setBusy(true);
    try {
      await submitSignal({ symbol, side, qty: parseFloat(qty) });
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onTemplate = async () => {
    setBusy(true);
    try {
      const s = await getTemplateSignal();
      setTplSignal(s);
      if (s.signal !== 'flat') {
        setSide(s.signal as 'buy' | 'sell');
        setSymbol((s.spec?.symbol as string) ?? 'SPY');
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onPanic = async () => {
    if (!confirm('Engage kill switch? Closes ALL positions and blocks further orders.')) return;
    setBusy(true);
    try {
      await engagePanic('ui-button');
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onClearPanic = async () => {
    setBusy(true);
    try {
      await clearPanic();
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const totalPnl = useMemo(() => {
    if (!account) return 0;
    return (account.realised_pnl ?? 0) + (account.unrealised_pnl ?? 0);
  }, [account]);

  return (
    <div style={{ padding: 20, background: C.bg, color: C.text, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Live Execution</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>
          Same path agents use: signal → RiskGate → broker → journal. Polls every {POLL_MS / 1000}s.
        </p>
      </div>

      {error && (
        <div style={{ padding: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 12, color: C.bad }}>
          {error}
        </div>
      )}

      {/* Account header */}
      {account && (
        <div style={{
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10,
        }}>
          <Stat label="Broker" value={account.broker.toUpperCase()} />
          <Stat label="Cash" value={`$${fmt(account.cash, 2)}`} />
          <Stat label="Equity" value={`$${fmt(account.equity, 2)}`} />
          <Stat label="Realised P&L" value={`$${signed(account.realised_pnl)}`} tone={account.realised_pnl >= 0 ? 'good' : 'bad'} />
          <Stat label="Unrealised" value={`$${signed(account.unrealised_pnl)}`} tone={account.unrealised_pnl >= 0 ? 'good' : 'bad'} />
          <Stat label="Total P&L" value={`$${signed(totalPnl)}`} tone={totalPnl >= 0 ? 'good' : 'bad'} />
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            padding: '6px 0', alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Kill switch</span>
            {account.panic.active ? (
              <button onClick={onClearPanic} disabled={busy}
                style={{ background: C.amber, color: '#000', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                CLEAR PANIC
              </button>
            ) : (
              <button onClick={onPanic} disabled={busy}
                style={{ background: C.bad, color: 'white', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                KILL ALL
              </button>
            )}
          </div>
        </div>
      )}

      {account?.halted && account.halt_reason && (
        <div style={{ padding: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 12, color: C.bad }}>
          Trading halted by RiskGate · {account.halt_reason}
        </div>
      )}

      {/* Submit signal */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Submit signal</h3>
          <span style={{ fontSize: 10, color: C.muted, marginLeft: 'auto' }}>
            POST /api/execution/signal
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="SYMBOL"
            style={inputStyle(80)} />
          <select value={side} onChange={(e) => setSide(e.target.value as 'buy' | 'sell')} style={inputStyle(70)}>
            <option value="buy">buy</option>
            <option value="sell">sell</option>
          </select>
          <input type="number" min={0} step="0.0001" value={qty} onChange={(e) => setQty(e.target.value)}
            style={inputStyle(80)} />
          <button onClick={onSend} disabled={busy}
            style={{ background: C.accent, color: 'white', border: 'none', padding: '6px 14px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>
            Send
          </button>
          <button onClick={onTemplate} disabled={busy}
            style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.amber, padding: '6px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>
            Take template signal
          </button>
          {tplSignal && (
            <span style={{ fontSize: 11, color: C.muted, marginLeft: 6 }}>
              RSI {tplSignal.rsi?.toFixed(2)} · last ${tplSignal.last_close?.toFixed(2)} →{' '}
              <strong style={{ color: tplSignal.signal === 'buy' ? C.good : tplSignal.signal === 'sell' ? C.bad : C.amber }}>
                {tplSignal.signal.toUpperCase()}
              </strong>
            </span>
          )}
        </div>
      </div>

      {/* Positions */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, overflow: 'auto' }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Positions</h3>
        {(!account || account.positions.length === 0) ? (
          <div style={{ fontSize: 12, color: C.muted, padding: 8 }}>No open positions.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>Symbol</th>
                <th style={th}>Qty</th>
                <th style={thR}>Avg</th>
                <th style={thR}>Last</th>
                <th style={thR}>Unreal P&L</th>
                <th style={thR}>Realised</th>
              </tr>
            </thead>
            <tbody>
              {account.positions.filter((p) => p.qty !== 0).map((p) => (
                <tr key={p.symbol} style={trBorder}>
                  <td style={tdMono}>{p.symbol}</td>
                  <td style={tdMono}>{fmt(p.qty, 4)}</td>
                  <td style={tdMonoR}>{fmt(p.avg_price)}</td>
                  <td style={tdMonoR}>{fmt(p.last_price)}</td>
                  <td style={{ ...tdMonoR, color: p.unrealised_pnl >= 0 ? C.good : C.bad }}>
                    {signed(p.unrealised_pnl)}
                  </td>
                  <td style={{ ...tdMonoR, color: p.realised_pnl >= 0 ? C.good : C.bad }}>
                    {signed(p.realised_pnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Order journal */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, overflow: 'auto' }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          Orders <span style={{ color: C.muted, fontWeight: 400 }}>· newest first</span>
        </h3>
        {orders.length === 0 ? (
          <div style={{ fontSize: 12, color: C.muted, padding: 8 }}>No orders yet.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>When</th>
                <th style={th}>Status</th>
                <th style={th}>Symbol</th>
                <th style={th}>Side</th>
                <th style={thR}>Qty</th>
                <th style={thR}>Fill</th>
                <th style={th}>Reason / risk</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={trBorder}>
                  <td style={td}>{relTime(o.submitted_at)}</td>
                  <td style={td}><StatusPill status={o.status} /></td>
                  <td style={tdMono}>{o.symbol}</td>
                  <td style={{ ...tdMono, color: o.side === 'buy' ? C.good : C.bad }}>{o.side}</td>
                  <td style={tdMonoR}>{fmt(o.qty, 4)}</td>
                  <td style={tdMonoR}>{o.fill_price !== null ? `$${fmt(o.fill_price)}` : '—'}</td>
                  <td style={{ ...td, color: C.muted, fontSize: 10 }}>
                    {o.rejected_reason ?? o.risk_decision?.warnings?.join(' · ') ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── tiny helpers ────────────────────────────────────────────

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{
        marginTop: 2, fontSize: 16, fontWeight: 600,
        color: tone === 'good' ? C.good : tone === 'bad' ? C.bad : C.text,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  );
}

function inputStyle(width: number): React.CSSProperties {
  return {
    background: '#000',
    color: C.text,
    border: `1px solid ${C.border}`,
    padding: '5px 8px',
    fontSize: 12,
    fontFamily: 'ui-monospace, monospace',
    borderRadius: 4,
    width,
  };
}

const tableStyle: React.CSSProperties = { width: '100%', fontSize: 12, borderCollapse: 'collapse' };
const th: React.CSSProperties = { padding: '5px 8px', color: C.muted, textAlign: 'left', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 };
const thR: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '5px 8px' };
const tdMono: React.CSSProperties = { ...td, fontFamily: 'ui-monospace, monospace' };
const tdMonoR: React.CSSProperties = { ...td, fontFamily: 'ui-monospace, monospace', textAlign: 'right' };
const trBorder: React.CSSProperties = { borderTop: `1px solid ${C.border}` };
