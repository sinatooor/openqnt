import { useState } from 'react';
import { useTerminalData } from '../useTerminalData';
import { mostTool, type MostData, type MostRow } from './tool';

export default function MostView() {
  const [region, setRegion] = useState<'us' | 'nordic' | 'europe'>('us');
  const data = useTerminalData<{ region: 'us' | 'nordic' | 'europe' }, MostData>(
    mostTool,
    { region },
    () => ({ source: 'mock' as const, region, gainers: [], losers: [], active: [] }),
  );

  return (
    <div style={{ padding: 16, color: '#e4e4e7', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
      <header style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#fafafa' }}>Movers</h2>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value as 'us' | 'nordic' | 'europe')}
          style={{
            background: '#0a0a00',
            color: '#fafafa',
            border: '1px solid #332200',
            padding: '4px 8px',
            fontSize: 11,
          }}
        >
          <option value="us">US</option>
          <option value="nordic">Nordic</option>
          <option value="europe">Europe</option>
        </select>
        <span style={{ fontSize: 11, color: '#71717a' }}>{data.source.toUpperCase()}</span>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <Bucket title="Gainers" rows={data.gainers} accent="#10b981" />
        <Bucket title="Losers" rows={data.losers} accent="#ef4444" />
        <Bucket title="Most active" rows={data.active} accent="#3b82f6" />
      </div>
    </div>
  );
}

function Bucket({ title, rows, accent }: { title: string; rows: MostRow[]; accent: string }) {
  return (
    <section style={{ background: '#0a0a00', border: '1px solid #332200', borderRadius: 2 }}>
      <div
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid #332200',
          color: accent,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.1,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      <table style={{ width: '100%', fontSize: 12 }}>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} style={{ padding: 12, textAlign: 'center', color: '#71717a' }}>
                No data.
              </td>
            </tr>
          )}
          {rows.slice(0, 15).map((r, i) => (
            <tr key={`${r.ticker}-${i}`} style={{ borderBottom: '1px solid #131313' }}>
              <td style={{ padding: '6px 10px', color: '#fafafa', width: 80 }}>{r.ticker}</td>
              <td
                style={{
                  padding: '6px 10px',
                  textAlign: 'right',
                  color: r.changePct == null ? '#71717a' : r.changePct >= 0 ? '#10b981' : '#ef4444',
                }}
              >
                {r.changePct?.toFixed(2) ?? '—'}%
              </td>
              <td style={{ padding: '6px 10px', textAlign: 'right', color: '#a1a1aa' }}>
                {r.lastPrice == null ? '—' : r.lastPrice.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
