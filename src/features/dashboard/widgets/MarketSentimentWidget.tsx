import { Progress } from '@/components/ui/progress';

export default function MarketSentimentWidget() {
  const score = 62;
  const bullish = 14;
  const neutral = 6;
  const bearish = 5;
  return (
    <section className="terminal-panel h-full">
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">Market Sentiment</span>
        <span className="text-[9px] text-zinc-500">BREADTH</span>
      </div>
      <div className="space-y-3 p-3">
        <div className="rounded-sm border border-amber-600/25 bg-zinc-900/80 p-2 text-center">
          <p className="text-[10px] tracking-wide text-zinc-500">COMPOSITE SCORE</p>
          <p className="font-mono text-2xl font-bold text-emerald-400">+{score}</p>
          <p className="text-[10px] font-semibold tracking-wide text-emerald-400">BULLISH</p>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
            <span>Fear & Greed</span>
            <span className="font-mono text-amber-400">{score}/100</span>
          </div>
          <Progress value={score} className="h-1.5 rounded-none" />
        </div>
        <div className="space-y-1 text-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">▲ Bull</span>
            <span className="font-mono text-emerald-400">{bullish}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">■ Neutral</span>
            <span className="font-mono text-zinc-300">{neutral}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">▼ Bear</span>
            <span className="font-mono text-red-400">{bearish}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
