/**
 * NewsFeedWidget — Aggregates real headlines from /api/news (orchestrator
 * NewsAPI proxy) with fallback to /api/terminal/news/SPY (yfinance).
 */
import { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { terminalApiGet } from '@/features/terminal/apiClient';

interface NewsItem {
  id: string | number | null;
  title: string;
  url?: string | null;
  source?: string | null;
  publishedAt?: string | number | null;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
}

interface TerminalNewsResponse {
  source: string;
  data: {
    items: Array<{
      id: string | null;
      headline: string;
      summary?: string | null;
      source?: string | null;
      timestamp?: string | number | null;
      url?: string | null;
    }>;
  };
}

const ORCHESTRATOR_URL =
  (import.meta.env?.VITE_ORCHESTRATOR_URL as string | undefined) || 'http://localhost:3000';

function classifySentiment(headline: string): 'bullish' | 'bearish' | 'neutral' {
  const h = headline.toLowerCase();
  if (/(rally|surge|jump|beat|growth|hit\s+high|all-time high|outperform|raise|upgrade|gain)/.test(h)) return 'bullish';
  if (/(fall|drop|plunge|miss|cut|downgrade|recession|concern|fear|warn|loss|slump|weak)/.test(h)) return 'bearish';
  return 'neutral';
}

function formatRelative(ts: string | number | null | undefined): string {
  if (!ts) return '';
  const d = typeof ts === 'number' ? new Date(ts > 1e12 ? ts : ts * 1000) : new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export default function NewsFeedWidget() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'live' | 'offline'>('loading');

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    const tryOrchestrator = async (): Promise<NewsItem[] | null> => {
      try {
        const r = await fetch(`${ORCHESTRATOR_URL}/api/news?limit=10`, { signal: ctrl.signal });
        if (!r.ok) return null;
        const body = await r.json();
        const arr = Array.isArray(body) ? body : body.articles ?? body.items ?? body.data ?? [];
        if (!Array.isArray(arr) || arr.length === 0) return null;
        return arr.slice(0, 10).map((a: Record<string, unknown>, idx: number) => ({
          id: (a.id as string | number) ?? idx,
          title: String(a.title ?? a.headline ?? ''),
          url: (a.url as string) ?? null,
          source: ((a.source as { name?: string })?.name) ?? (a.source as string) ?? (a.publisher as string) ?? null,
          publishedAt: (a.publishedAt as string) ?? (a.timestamp as string) ?? null,
          sentiment: classifySentiment(String(a.title ?? a.headline ?? '')),
        }));
      } catch {
        return null;
      }
    };

    const tryTerminalNews = async (): Promise<NewsItem[] | null> => {
      const resp = await terminalApiGet<TerminalNewsResponse>('/api/terminal/news/SPY', undefined, ctrl.signal);
      if (!resp?.data?.items?.length) return null;
      return resp.data.items.slice(0, 10).map((it, idx) => ({
        id: it.id ?? idx,
        title: it.headline,
        url: it.url ?? null,
        source: it.source ?? null,
        publishedAt: it.timestamp ?? null,
        sentiment: classifySentiment(it.headline),
      }));
    };

    const load = async () => {
      const news = (await tryOrchestrator()) ?? (await tryTerminalNews());
      if (cancelled) return;
      if (news && news.length) {
        setItems(news);
        setStatus('live');
      } else {
        setStatus('offline');
      }
    };

    void load();
    const id = window.setInterval(load, 120_000);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
    };
  }, []);

  return (
    <section className="terminal-panel h-full">
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">Market News</span>
        <span className="text-[9px] text-zinc-500">{status === 'live' ? 'LIVE' : status.toUpperCase()}</span>
      </div>
      <div className="h-[calc(100%-28px)] p-0">
        <ScrollArea className="h-full px-3 py-2">
          <div className="space-y-1">
            {items.length === 0 && (
              <p className="px-1 py-3 text-center text-[10px] text-zinc-600">
                {status === 'loading' ? 'Loading headlines…' : 'No headlines available.'}
              </p>
            )}
            {items.map((item) => (
              <a
                key={item.id ?? item.title}
                href={item.url ?? '#'}
                target={item.url ? '_blank' : undefined}
                rel="noreferrer"
                className="terminal-row !block !py-2"
              >
                <h4 className="cursor-pointer text-[11px] font-semibold leading-relaxed text-zinc-100 hover:text-amber-300">
                  {item.title}
                </h4>
                <div className="mt-1 flex items-center gap-3 text-[10px]">
                  <span className="text-zinc-500">{formatRelative(item.publishedAt)}</span>
                  {item.source && <span className="text-zinc-500">{item.source}</span>}
                  {item.sentiment && (
                    <span
                      className={
                        item.sentiment === 'bullish'
                          ? 'text-green-400'
                          : item.sentiment === 'bearish'
                          ? 'text-red-400'
                          : 'text-amber-500'
                      }
                    >
                      {item.sentiment.toUpperCase()}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </ScrollArea>
      </div>
    </section>
  );
}
