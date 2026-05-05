import { useState } from 'react';
import { useTerminalData } from '../useTerminalData';
import { eqsTool, type EqsData, type EqsInput } from './tool';

export default function EqsView() {
  const [filters, setFilters] = useState<EqsInput>({});
  const data = useTerminalData<EqsInput, EqsData>(
    eqsTool,
    filters,
    () => ({ source: 'mock' as const, rows: [] }),
  );

  return (
    <div style={{ padding: 16, color: '#e4e4e7', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
      <header style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#fafafa' }}>Equity Screener</h2>
        <span style={{ fontSize: 11, color: '#71717a' }}>{data.source.toUpperCase()}</span>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <Input label="Min mcap (B)" value={filters.minMarketCapB} onChange={(v) => setFilters({ ...filters, minMarketCapB: v })} />
        <Input label="Max P/E" value={filters.maxPe} onChange={(v) => setFilters({ ...filters, maxPe: v })} />
        <Input
          label="Min div yield"
          value={filters.minDividendYield}
          onChange={(v) => setFilters({ ...filters, minDividendYield: v })}
        />
        <TextInput
          label="Sector"
          value={filters.sector ?? ''}
          onChange={(v) => setFilters({ ...filters, sector: v || undefined })}
        />
        <TextInput
          label="Country"
          value={filters.country ?? ''}
          onChange={(v) => setFilters({ ...filters, country: v || undefined })}
        />
      </section>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#141005', color: '#71717a', fontSize: 9, textTransform: 'uppercase' }}>
            <th style={{ padding: 6, textAlign: 'left' }}>Ticker</th>
            <th style={{ padding: 6, textAlign: 'left' }}>Name</th>
            <th style={{ padding: 6, textAlign: 'right' }}>MCap (B)</th>
            <th style={{ padding: 6, textAlign: 'right' }}>P/E</th>
            <th style={{ padding: 6, textAlign: 'right' }}>Div Y</th>
            <th style={{ padding: 6, textAlign: 'left' }}>Sector</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 12, textAlign: 'center', color: '#71717a' }}>
                No matches.
              </td>
            </tr>
          )}
          {data.rows.map((r) => (
            <tr key={r.ticker} style={{ borderBottom: '1px solid #131313' }}>
              <td style={{ padding: 6, color: '#fafafa' }}>{r.ticker}</td>
              <td style={{ padding: 6, color: '#a1a1aa' }}>{r.name}</td>
              <td style={{ padding: 6, textAlign: 'right' }}>{r.marketCapB?.toFixed(1) ?? '—'}</td>
              <td style={{ padding: 6, textAlign: 'right' }}>{r.pe?.toFixed(2) ?? '—'}</td>
              <td style={{ padding: 6, textAlign: 'right' }}>
                {r.dividendYield != null ? (r.dividendYield * 100).toFixed(2) + '%' : '—'}
              </td>
              <td style={{ padding: 6, color: '#a1a1aa' }}>{r.sector}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.1 }}>
        {label}
      </span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        style={{
          background: '#0a0a00',
          color: '#fafafa',
          border: '1px solid #332200',
          padding: '4px 6px',
          fontSize: 12,
        }}
      />
    </label>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.1 }}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: '#0a0a00',
          color: '#fafafa',
          border: '1px solid #332200',
          padding: '4px 6px',
          fontSize: 12,
        }}
      />
    </label>
  );
}
