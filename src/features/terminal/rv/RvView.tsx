import { useTerminalData } from '../useTerminalData';
import { rvTool, type RvData, type RvRow } from './tool';

interface Props { ticker: string }

const fmt = (v: number | null) => (v == null ? '—' : v.toFixed(2));

function zScore(value: number | null, values: Array<number | null>): number {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length < 2 || value == null) return 0;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length;
  const sd = Math.sqrt(variance) || 1;
  return (value - mean) / sd;
}

function shade(z: number): string {
  if (z <= -1.5) return 'rgba(34, 197, 94, 0.25)';
  if (z <= -0.5) return 'rgba(34, 197, 94, 0.10)';
  if (z >= 1.5) return 'rgba(239, 68, 68, 0.25)';
  if (z >= 0.5) return 'rgba(239, 68, 68, 0.10)';
  return 'transparent';
}

const COLUMNS: Array<{ key: keyof RvRow; label: string }> = [
  { key: 'pe', label: 'P/E' },
  { key: 'pb', label: 'P/B' },
  { key: 'ps', label: 'P/S' },
  { key: 'evEbitda', label: 'EV/EBITDA' },
  { key: 'roe', label: 'ROE' },
  { key: 'divYield', label: 'Div Yield' },
];

export default function RvView({ ticker }: Props) {
  const data = useTerminalData<{ ticker: string }, RvData>(
    rvTool,
    { ticker },
    () => ({ base: ticker, rows: [] }),
  );

  const columnValues = Object.fromEntries(
    COLUMNS.map((c) => [c.key, data.rows.map((r) => r[c.key] as number | null)] as const),
  ) as Record<keyof RvRow, Array<number | null>>;

  return (
    <div style={{ padding: 16, color: '#e4e4e7', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
      <header style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#fafafa' }}>{data.base} — Relative Value</h2>
      </header>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#141005', color: '#71717a', fontSize: 9, textTransform: 'uppercase' }}>
            <th style={{ textAlign: 'left', padding: 6 }}>Ticker</th>
            {COLUMNS.map((c) => (
              <th key={c.key} style={{ textAlign: 'right', padding: 6 }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr
              key={r.ticker}
              style={{
                borderBottom: '1px solid #131313',
                background: r.ticker === data.base ? 'rgba(255, 159, 26, 0.05)' : undefined,
              }}
            >
              <td style={{ padding: 6, color: '#fafafa', fontWeight: r.ticker === data.base ? 700 : 400 }}>
                {r.ticker}
              </td>
              {COLUMNS.map((c) => {
                const value = r[c.key] as number | null;
                const z = zScore(value, columnValues[c.key]);
                return (
                  <td
                    key={c.key}
                    style={{
                      padding: 6,
                      textAlign: 'right',
                      background: shade(z),
                    }}
                  >
                    {fmt(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
