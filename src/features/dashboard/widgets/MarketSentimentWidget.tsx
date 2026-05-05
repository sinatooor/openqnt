/**
 * MarketSentimentWidget — Composite score from /api/terminal/sentiment.
 * Composite = VIX inverted + SPY 5d return + sector advance/decline.
 */
import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { terminalApiGet } from '@/features/terminal/apiClient';

interface SentimentResponse {
  source: string;
  score: number;
  label: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  vix: number | null;
  spy5dPct: number | null;
  bullish: number;
  neutral: number;
  bearish: number;
}

export default function MarketSentimentWidget() {
  const [data, setData] = useState<SentimentResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'live' | 'offline'>('loading');

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const load = async () => {
      const resp = await terminalApiGet<SentimentResponse>('/api/terminal/sentiment', undefined, ctrl.signal);
      if (cancelled) return;
      if (resp?.score != null) {
        setData(resp);
        setStatus('live');
      } else {
        setStatus('offline');
      }
    };
    void load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
    };
  }, []);

  const score = data?.score ?? 50;
  const label = data?.label ?? 'NEUTRAL';
  const tone = label === 'BULLISH' ? 'text-emerald-400' : label === 'BEARISH' ? 'text-red-400' : 'text-amber-400';

  return (
    <section className="terminal-panel h-full">
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">Market Sentiment</span>
        <span className="text-[9px] text-zinc-500">{status === 'live' ? 'BREADTH · LIVE' : status.toUpperCase()}</span>
      </div>
      <div className="space-y-3 p-3">
        <div className="rounded-sm border border-amber-600/25 bg-zinc-900/80 p-2 text-center">
          <p className="text-[10px] tracking-wide text-zinc-500">COMPOSITE SCORE</p>
          <p className={`font-mono text-2xl font-bold ${tone}`}>
            {data ? Math.round(data.score) : '—'}
          </p>
          <p className={`text-[10px] font-semibold tracking-wide ${tone}`}>{label}</p>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
            <span>Fear & Greed</span>
            <span className="font-mono text-amber-400">{Math.round(score)}/100</span>
          </div>
          <Progress value={score} className="h-1.5 rounded-none" />
        </div>
        <div className="space-y-1 text-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">VIX</span>
            <span className="font-mono text-zinc-200">{data?.vix?.toFixed(2) ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">SPY 5d</span>
            <span className={`font-mono ${(data?.spy5dPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {data?.spy5dPct != null ? `${data.spy5dPct >= 0 ? '+' : ''}${data.spy5dPct.toFixed(2)}%` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">▲ Sectors</span>
            <span className="font-mono text-emerald-400">{data?.bullish ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">▼ Sectors</span>
            <span className="font-mono text-red-400">{data?.bearish ?? '—'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
