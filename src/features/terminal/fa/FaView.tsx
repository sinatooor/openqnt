import { useTerminalData } from '../useTerminalData';
import { faTool, type FaData } from './tool';

interface Props {
  ticker: string;
}

const fmt = (v: number | null | undefined, suffix = '') => {
  if (v == null || Number.isNaN(v)) return '—';
  return Math.abs(v) < 1 ? v.toFixed(3) + suffix : Math.abs(v) < 10 ? v.toFixed(2) + suffix : v.toFixed(1) + suffix;
};

export default function FaView({ ticker }: Props) {
  const data = useTerminalData<{ ticker: string }, FaData>(
    faTool,
    { ticker },
    () => ({
      ticker,
      source: 'mock' as const,
      asOf: new Date().toISOString(),
      ratios: {},
      series: {},
    }),
  );

  const r = data.ratios;
  const ratios: Array<[string, number | null | undefined, string]> = [
    ['Trailing P/E', r.trailingPE, ''],
    ['Forward P/E', r.forwardPE, ''],
    ['P/B', r.priceToBook, ''],
    ['P/S', r.priceToSales, ''],
    ['EV/EBITDA', r.evToEbitda, ''],
    ['ROE', r.returnOnEquity, ''],
    ['Debt/Equity', r.debtToEquity, ''],
    ['Div yield', r.dividendYield, ''],
    ['Payout ratio', r.payoutRatio, ''],
    ['Profit margin', r.profitMargins, ''],
  ];

  return (
    <div style={{ padding: 16, color: '#e4e4e7', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
      <header style={{ marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', margin: 0 }}>{data.ticker} — Financial Analysis</h2>
        <span style={{ fontSize: 11, color: '#71717a' }}>
          {data.source.toUpperCase()} · as of {new Date(data.asOf).toLocaleString()}
        </span>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 8,
          marginBottom: 16,
        }}
      >
        {ratios.map(([label, value]) => (
          <div
            key={label}
            style={{
              padding: 10,
              background: '#0a0a00',
              border: '1px solid #332200',
              borderRadius: 2,
            }}
          >
            <div style={{ fontSize: 9, color: '#71717a', letterSpacing: 0.1, textTransform: 'uppercase' }}>
              {label}
            </div>
            <div style={{ fontSize: 15, color: '#fafafa', fontWeight: 700, marginTop: 4 }}>{fmt(value)}</div>
          </div>
        ))}
      </section>

      {data.source === 'avanza' && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {([
            ['Revenue', data.series.revenue],
            ['EBITDA', data.series.ebitda],
            ['Net profit', data.series.netProfit],
            ['EPS', data.series.eps],
            ['P/E ratio', data.series.peRatio],
            ['Dividend per share', data.series.dividendPerShare],
          ] as const).map(([label, series]) =>
            series && series.length ? (
              <div
                key={label}
                style={{ background: '#0a0a00', border: '1px solid #332200', borderRadius: 2, padding: 8 }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: '#ff9f1a', letterSpacing: 0.1, marginBottom: 6 }}>
                  {label}
                </div>
                <table style={{ width: '100%', fontSize: 11 }}>
                  <tbody>
                    {series.slice(-8).map((p) => (
                      <tr key={p.year} style={{ borderBottom: '1px solid #131313' }}>
                        <td style={{ padding: '3px 4px', color: '#a1a1aa' }}>{p.year}</td>
                        <td style={{ padding: '3px 4px', textAlign: 'right' }}>
                          {fmt(p.value ?? p.estimate)}
                          {p.onlyEstimate && (
                            <span style={{ marginLeft: 4, color: '#71717a' }}>(est)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null,
          )}
        </section>
      )}
    </div>
  );
}
