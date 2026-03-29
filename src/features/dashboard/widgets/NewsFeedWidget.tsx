import { ScrollArea } from '@/components/ui/scroll-area';

const SAMPLE_NEWS = [
  { id: 1, title: 'Federal Reserve holds interest rates steady in latest meeting', time: '10 min ago', sentiment: 'neutral' },
  { id: 2, title: 'Tech stocks rally on strong AMD earnings guidance', time: '24 min ago', sentiment: 'bullish' },
  { id: 3, title: 'Oil prices drop below $80 amid demand concerns', time: '1 hr ago', sentiment: 'bearish' },
  { id: 4, title: 'New labor report shows slowing job growth', time: '2 hrs ago', sentiment: 'bearish' },
];

export default function NewsFeedWidget() {
  return (
    <section className="terminal-panel h-full">
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">Market News</span>
        <span className="text-[9px] text-zinc-500">SPY FEED</span>
      </div>
      <div className="h-[calc(100%-28px)] p-0">
        <ScrollArea className="h-full px-3 py-2">
          <div className="space-y-1">
            {SAMPLE_NEWS.map((item) => (
              <div key={item.id} className="terminal-row !block !py-2">
                <h4 className="cursor-pointer text-[11px] font-semibold leading-relaxed text-zinc-100 hover:text-amber-300">
                  {item.title}
                </h4>
                <div className="mt-1 flex items-center gap-3 text-[10px]">
                  <span className="text-zinc-500">{item.time}</span>
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
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </section>
  );
}
