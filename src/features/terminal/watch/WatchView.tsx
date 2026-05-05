import { useTerminalData } from '../useTerminalData';
import { watchTool, type WatchData } from './tool';

const fmt = (v: number | null) => (v == null ? '—' : v.toFixed(2));
const pct = (v: number | null) =>
  v == null ? '' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

export default function WatchView() {
  const data = useTerminalData<{}, WatchData>(
    watchTool,
    {},
    () => ({ source: 'mock' as const, watchlists: [] }),
  );

  return (
    <div style={{ padding: 16, color: '#e4e4e7', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
      <header style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#fafafa' }}>Watchlists</h2>
        <div style={{ fontSize: 11, color: '#71717a' }}>{data.source.toUpperCase()}</div>
      </header>

      {data.watchlists.length === 0 && (
        <div style={{ padding: 16, color: '#71717a', textAlign: 'center' }}>
          No watchlists. Connect Avanza in Settings to import yours.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {data.watchlists.map((w) => (
          <section
            key={w.id}
            style={{ background: '#0a0a00', border: '1px solid #332200', borderRadius: 2 }}
          >
            <div
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #332200',
                color: '#ff9f1a',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.1,
              }}
            >
              {w.name} <span style={{ color: '#71717a', marginLeft: 6 }}>{w.rows.length} items</span>
            </div>
            <table style={{ width: '100%', fontSize: 12 }}>
              <thead>
                <tr style={{ color: '#71717a', fontSize: 9, textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '6px 12px' }}>Symbol</th>
                  <th style={{ textAlign: 'left', padding: '6px 12px' }}>Name</th>
                  <th style={{ textAlign: 'right', padding: '6px 12px' }}>Last</th>
                  <th style={{ textAlign: 'right', padding: '6px 12px' }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {w.rows.map((r) => (
                  <tr key={r.orderbookId} style={{ borderBottom: '1px solid #131313' }}>
                    <td style={{ padding: '6px 12px', color: '#fafafa' }}>{r.symbol ?? r.orderbookId}</td>
                    <td style={{ padding: '6px 12px', color: '#a1a1aa' }}>{r.name ?? ''}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>{fmt(r.lastPrice)}</td>
                    <td
                      style={{
                        padding: '6px 12px',
                        textAlign: 'right',
                        color: r.changePct == null ? '#71717a' : r.changePct >= 0 ? '#10b981' : '#ef4444',
                      }}
                    >
                      {pct(r.changePct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
