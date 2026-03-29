import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const WATCHLIST = [
  { symbol: 'AAPL', price: 178.25, change: 1.2 },
  { symbol: 'TSLA', price: 188.45, change: -2.3 },
  { symbol: 'MSFT', price: 195.10, change: 0.8 },
  { symbol: 'NVDA', price: 825.14, change: 3.5 },
  { symbol: 'BTC/USD', price: 67120.00, change: -1.1 },
];

export default function WatchlistWidget() {
  return (
    <section className="terminal-panel h-full">
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">Watchlist</span>
        <span className="text-[9px] text-zinc-500">8 SYMBOLS</span>
      </div>
      <div className="p-1">
        <table className="terminal-table">
          <thead>
            <tr>
              <th className="text-left">Symbol</th>
              <th className="text-right">Price</th>
              <th className="text-right">Chg%</th>
            </tr>
          </thead>
          <tbody>
            {WATCHLIST.map((item) => (
              <tr key={item.symbol}>
                <td className="font-semibold text-zinc-100">{item.symbol}</td>
                <td className="text-right font-mono text-zinc-100">
                  {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className={`text-right font-mono ${item.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  <span className="inline-flex items-center gap-1">
                    {item.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(item.change)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
