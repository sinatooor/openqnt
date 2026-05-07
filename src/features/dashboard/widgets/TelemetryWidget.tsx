/**
 * TelemetryWidget — Phase J3 surface on the Dashboard.
 *
 * Polls /api/telemetry/summary every 5s, renders three counter blocks
 * (agent runs, tool calls, errors) and the most recent 8 errors with
 * their `where` + tail-of-message. Uses the same Bloomberg-amber
 * styling as the Agent Activity widget for visual consistency.
 */

import { useEffect, useState } from 'react';
import { Activity, AlertCircle, Wrench, RotateCcw } from 'lucide-react';

import { apiBase } from '@/lib/runtimeConfig';
const API_BASE =
  apiBase();

interface Summary {
  since: string | null;
  updated_at: string | null;
  agent_runs: {
    started: number;
    succeeded: number;
    errored: number;
    by_agent: Record<string, { started: number; succeeded: number; errored: number }>;
  };
  tool_calls: {
    total: number;
    by_name: Record<string, number>;
    errors_by_name: Record<string, number>;
  };
  errors: {
    total: number;
    recent: Array<{ ts: string; where: string; message: string }>;
  };
}

const C = {
  bg: '#0a0a0f',
  panel: '#171723',
  border: '#332200',
  amber: '#ff9f1a',
  text: '#e2e8f0',
  muted: '#94a3b8',
  good: '#10b981',
  bad: '#ef4444',
};

function relTime(iso?: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const sec = Math.max(0, (Date.now() - t) / 1000);
  if (sec < 60) return `${sec.toFixed(0)}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function Block({ icon, label, value, sub, tone }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  tone?: 'good' | 'bad';
}) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: '#000', border: `1px solid ${C.border}`,
      borderRadius: 4, padding: '8px 10px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 9, color: C.muted, textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>{icon}{label}</div>
      <div style={{
        marginTop: 3, fontSize: 18, fontWeight: 700,
        color: tone === 'good' ? C.good : tone === 'bad' ? C.bad : C.text,
        fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{sub}</div>
      )}
    </div>
  );
}

export default function TelemetryWidget() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/telemetry/summary`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
      setError(null);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  };

  const onReset = async () => {
    if (!confirm('Reset all telemetry counters?')) return;
    await fetch(`${API_BASE}/api/telemetry/reset`, { method: 'POST' });
    await refresh();
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: C.bg, color: C.text, overflow: 'hidden',
      fontFamily: 'ui-monospace, monospace',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', borderBottom: `1px solid ${C.border}`,
        background: '#141005', fontSize: 10, color: C.amber,
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity style={{ width: 11, height: 11 }} />
          Telemetry
          {data?.since && (
            <span style={{ color: C.muted, fontWeight: 400 }}>
              · since {relTime(data.since)}
            </span>
          )}
        </span>
        <button onClick={onReset} title="Reset counters"
          style={{
            background: 'transparent', border: `1px solid ${C.border}`,
            color: C.muted, fontSize: 9, padding: '1px 6px',
            borderRadius: 2, cursor: 'pointer', display: 'flex',
            alignItems: 'center', gap: 4,
          }}>
          <RotateCcw style={{ width: 9, height: 9 }} /> RESET
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {error && (
          <div style={{ padding: 10, color: C.bad, fontSize: 11 }}>
            Could not load — {error}
          </div>
        )}

        {data && (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <Block
                icon={<Activity style={{ width: 10, height: 10 }} />}
                label="Agent runs"
                value={data.agent_runs.started}
                sub={`${data.agent_runs.succeeded} ok · ${data.agent_runs.errored} err`}
              />
              <Block
                icon={<Wrench style={{ width: 10, height: 10 }} />}
                label="Tool calls"
                value={data.tool_calls.total}
                sub={`${Object.keys(data.tool_calls.by_name).length} unique`}
              />
              <Block
                icon={<AlertCircle style={{ width: 10, height: 10 }} />}
                label="Errors"
                value={data.errors.total}
                tone={data.errors.total > 0 ? 'bad' : undefined}
                sub={data.errors.total > 0 ? `${data.errors.recent.length} recent` : 'none'}
              />
            </div>

            {Object.keys(data.tool_calls.by_name).length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  fontSize: 9, color: C.muted, textTransform: 'uppercase',
                  letterSpacing: 0.5, marginBottom: 4,
                }}>By tool</div>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <tbody>
                    {Object.entries(data.tool_calls.by_name)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 8)
                      .map(([name, n]) => {
                        const errs = data.tool_calls.errors_by_name[name] ?? 0;
                        return (
                          <tr key={name} style={{ borderTop: `1px solid ${C.border}` }}>
                            <td style={{ padding: '3px 6px', color: C.text }}>{name}</td>
                            <td style={{ padding: '3px 6px', textAlign: 'right' }}>{n}</td>
                            <td style={{ padding: '3px 6px', textAlign: 'right',
                                         color: errs > 0 ? C.bad : C.muted }}>
                              {errs > 0 ? `${errs} err` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {data.errors.recent.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  fontSize: 9, color: C.muted, textTransform: 'uppercase',
                  letterSpacing: 0.5, marginBottom: 4,
                }}>Recent errors</div>
                {data.errors.recent.slice(-6).reverse().map((e, i) => (
                  <div key={i} style={{
                    padding: '4px 6px', borderTop: `1px solid ${C.border}`,
                    fontSize: 10,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ color: C.amber }}>{e.where}</span>
                      <span style={{ color: C.muted }}>{relTime(e.ts)}</span>
                    </div>
                    <div style={{ color: C.bad, marginTop: 1, wordBreak: 'break-word' }}>
                      {e.message.slice(0, 140)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
