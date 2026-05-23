/**
 * Market — top-level page with indexes ticker + gainers/losers.
 */
import { Activity } from 'lucide-react';
import { PAGE_CONTENT_CLASS } from '@/components/PageHeader';
import { MarketOverviewWidget } from '@/integrations/avanza/MarketOverviewWidget';

export default function Market() {
  return (
    <div className={`${PAGE_CONTENT_CLASS} space-y-4`}>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-5 h-5 text-orange-400" />
        <h1 className="text-xl font-semibold text-foreground">Market Overview</h1>
        <span className="text-[11px] text-muted-foreground ml-2">Live from Avanza</span>
      </div>
      <MarketOverviewWidget />
    </div>
  );
}
