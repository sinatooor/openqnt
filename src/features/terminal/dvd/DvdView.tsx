import { useTerminalData } from '../useTerminalData';
import { dvdTool, type DvdData } from './tool';

interface Props { ticker: string }

const num = (v: number | null) => (v == null ? '—' : v.toFixed(2));
const pct = (v: number | null) => (v == null ? '—' : (v * 100).toFixed(2) + '%');

export default function DvdView({ ticker }: Props) {
  const data = useTerminalData<{ ticker: string }, DvdData>(
    dvdTool,
    { ticker },
    () => ({
      ticker,
      source: 'mock' as const,
      history: [],
      trailingYield: null,
      trailingPayoutRatio: null,
    }),
  );

  return (
    <div style={{ padding: 16, color: '#e4e4e7', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
      <header style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#fafafa' }}>{data.ticker} — Dividend</h2>
        <div style={{ fontSize: 11, color: '#71717a' }}>{data.source.toUpperCase()}</div>
      </header>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Stat label="Trailing yield" value={pct(data.trailingYield)} />
        <Stat label="Payout ratio" value={pct(data.trailingPayoutRatio)} />
        {data.upcomingExDate && <Stat label="Next ex-date" value={data.upcomingExDate} />}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#141005', color: '#71717a', textTransform: 'uppercase', fontSize: 9 }}>
            <th style={{ textAlign: 'left', padding: 6 }}>Year</th>
            <th style={{ textAlign: 'right', padding: 6 }}>DPS</th>
            <th style={{ textAlign: 'right', padding: 6 }}>Yield</th>
            <th style={{ textAlign: 'right', padding: 6 }}>Payout</th>
          </tr>
        </thead>
        <tbody>
          {data.history.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: 12, textAlign: 'center', color: '#71717a' }}>
                No historical dividend data — connect Avanza for the full series.
              </td>
            </tr>
          )}
          {data.history.map((p) => (
            <tr key={p.year} style={{ borderBottom: '1px solid #131313' }}>
              <td style={{ padding: 6 }}>
                {p.year}
                {p.estimate && <span style={{ marginLeft: 4, color: '#71717a' }}>(est)</span>}
              </td>
              <td style={{ padding: 6, textAlign: 'right' }}>{num(p.dividendPerShare)}</td>
              <td style={{ padding: 6, textAlign: 'right' }}>{pct(p.yield)}</td>
              <td style={{ padding: 6, textAlign: 'right' }}>{pct(p.payoutRatio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 10, background: '#0a0a00', border: '1px solid #332200', borderRadius: 2, minWidth: 140 }}>
      <div style={{ fontSize: 9, color: '#71717a', letterSpacing: 0.1, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 15, color: '#fafafa', fontWeight: 700 }}>{value}</div>
    </div>
  );
}
