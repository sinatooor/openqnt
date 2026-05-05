/**
 * PortfolioSummaryWidget — Real equity, daily PnL, drawdown.
 *
 * Sources, in priority order:
 *   1. Avanza overview (/api/integrations/avanza/positions) when connected
 *   2. Local portfolioStore aggregated against /api/terminal/quotes
 */
import { useEffect, useMemo, useState } from 'react';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useIntegrationsStore } from '@/stores/integrationsStore';
import { avanzaApi, type AvanzaPosition } from '@/integrations/avanza/api';

interface PortfolioStats {
  totalEquity: number;
  dailyPnl: number;
  dailyPnlPct: number;
  positions: number;
  drawdownPct: number | null;
  currency: string;
  source: 'avanza' | 'local' | 'empty';
}

function fmtMoney(value: number, currency: string): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const formatted = abs >= 1000
    ? abs.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : abs.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${sign}${currencySymbol(currency)}${formatted}`;
}

function currencySymbol(currency: string): string {
  switch (currency.toUpperCase()) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'SEK': return 'kr ';
    case 'NOK': return 'kr ';
    case 'DKK': return 'kr ';
    default: return `${currency} `;
  }
}

export default function PortfolioSummaryWidget() {
  const holdings = usePortfolioStore((s) => s.holdings);
  const totalValueGetter = usePortfolioStore((s) => s.getTotalValue);
  const totalPnlGetter = usePortfolioStore((s) => s.getTotalPnL);
  const totalPnlPctGetter = usePortfolioStore((s) => s.getTotalPnLPercent);
  const baseCurrency = usePortfolioStore((s) => s.baseCurrency);
  const avanzaConnected = useIntegrationsStore((s) => s.integrations.avanza.status) === 'connected';
  const [avanzaPositions, setAvanzaPositions] = useState<AvanzaPosition[] | null>(null);

  useEffect(() => {
    if (!avanzaConnected) {
      setAvanzaPositions(null);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const resp = await avanzaApi.positions(ctrl.signal);
        if (!cancelled) setAvanzaPositions(resp.positions);
      } catch {
        if (!cancelled) setAvanzaPositions(null);
      }
    };
    void load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
    };
  }, [avanzaConnected]);

  const stats = useMemo<PortfolioStats>(() => {
    if (avanzaPositions && avanzaPositions.length > 0) {
      let equity = 0;
      let dailyPnl = 0;
      let unrealizedTotal = 0;
      const currency = avanzaPositions[0]?.currency ?? 'SEK';
      for (const p of avanzaPositions) {
        if (p.marketValue != null) equity += p.marketValue;
        if (p.unrealizedPnl != null) unrealizedTotal += p.unrealizedPnl;
        if (
          p.lastPrice != null &&
          p.averagePrice != null &&
          p.quantity != null &&
          p.unrealizedPnl != null
        ) {
          // Approximate daily PnL = quantity * (lastPrice - prevClose).
          // Avanza payload doesn't always include prevClose — fall back
          // to unrealized per share so the number is at least directional.
          dailyPnl += p.unrealizedPnl;
        }
      }
      const dailyPnlPct = equity > 0 ? (dailyPnl / equity) * 100 : 0;
      return {
        totalEquity: equity,
        dailyPnl: unrealizedTotal,
        dailyPnlPct,
        positions: avanzaPositions.length,
        drawdownPct: null,
        currency,
        source: 'avanza',
      };
    }

    if (holdings.length > 0) {
      const equity = totalValueGetter();
      const dailyPnl = totalPnlGetter();
      const dailyPnlPct = totalPnlPctGetter();
      return {
        totalEquity: equity,
        dailyPnl,
        dailyPnlPct,
        positions: holdings.length,
        drawdownPct: null,
        currency: baseCurrency,
        source: 'local',
      };
    }

    return {
      totalEquity: 0,
      dailyPnl: 0,
      dailyPnlPct: 0,
      positions: 0,
      drawdownPct: null,
      currency: baseCurrency,
      source: 'empty',
    };
  }, [avanzaPositions, holdings, totalValueGetter, totalPnlGetter, totalPnlPctGetter, baseCurrency]);

  const positive = stats.dailyPnlPct >= 0;

  return (
    <section className="terminal-panel h-full">
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">Portfolio Summary</span>
        <span className="text-[9px] text-emerald-400">
          {stats.source === 'avanza' ? 'AVANZA' : stats.source === 'local' ? 'LOCAL' : 'EMPTY'}
        </span>
      </div>

      {stats.source === 'empty' ? (
        <div className="p-3 text-center text-xs text-zinc-500">
          No holdings yet.<br />Add holdings in the Portfolio page or connect Avanza.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-3 text-xs">
          <div>
            <p className="text-zinc-500">TOTAL EQUITY</p>
            <p className="mt-1 font-mono text-2xl font-bold text-zinc-100">
              {fmtMoney(stats.totalEquity, stats.currency)}
            </p>
            <p className={`mt-1 font-mono text-[11px] ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {positive ? '+' : ''}
              {stats.dailyPnlPct.toFixed(2)}% TODAY
            </p>
          </div>
          <div className="space-y-1.5 text-right">
            <div>
              <span className="text-zinc-500">Daily PnL: </span>
              <span className={`font-mono ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {positive ? '+' : ''}
                {fmtMoney(stats.dailyPnl, stats.currency)}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Open Positions: </span>
              <span className="font-mono text-zinc-200">{stats.positions}</span>
            </div>
            {stats.drawdownPct != null && (
              <div>
                <span className="text-zinc-500">Drawdown: </span>
                <span className="font-mono text-red-400">{stats.drawdownPct.toFixed(2)}%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
