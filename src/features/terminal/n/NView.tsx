import { useTerminalData } from '../useTerminalData';
import { newsTool, type NewsData } from './tool';

interface Props { ticker: string }

export default function NView({ ticker }: Props) {
  const data = useTerminalData<{ ticker: string }, NewsData>(
    newsTool,
    { ticker },
    () => ({ ticker, source: 'mock' as const, items: [] }),
  );

  return (
    <div style={{ padding: 16, color: '#e4e4e7', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
      <header style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#fafafa' }}>{data.ticker} — News</h2>
        <div style={{ fontSize: 11, color: '#71717a' }}>{data.source.toUpperCase()}</div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.items.length === 0 && (
          <div style={{ color: '#71717a', padding: 12 }}>No news available.</div>
        )}
        {data.items.map((item, i) => (
          <a
            key={item.id ?? i}
            href={item.url ?? '#'}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'block',
              padding: 10,
              background: '#0a0a00',
              border: '1px solid #332200',
              borderRadius: 2,
              color: '#e4e4e7',
              textDecoration: 'none',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{item.headline}</div>
            {item.summary && (
              <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4, lineHeight: 1.4 }}>
                {item.summary}
              </div>
            )}
            <div style={{ fontSize: 9, color: '#71717a', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.1 }}>
              {(item.source || '').toString()}{' '}·{' '}{formatTs(item.timestamp)}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function formatTs(ts: NewsData['items'][number]['timestamp']): string {
  if (ts == null) return '';
  if (typeof ts === 'number') return new Date(ts * 1000).toLocaleString();
  return new Date(ts).toLocaleString();
}
