/**
 * LiveIndexTicker — live-quote strip rendered above the Terminal canvas.
 *
 * Reuses the Avanza market-index endpoint (the same data the prior
 * /market page surfaced) but mounted inside Terminal so we don't carry
 * a duplicate page. Labels Avanza doesn't expose (DAX/VIX/US10Y/GOLD/OIL/BTC)
 * still render in the strip with a "—" placeholder so the visual layout
 * stays stable; they can be wired later when their data source is added.
 */

import { useEffect, useState } from 'react';
import { useIntegrationsStore } from '@/stores/integrationsStore';
import { avanzaApi } from '@/integrations/avanza/api';

interface IndexSpec {
  label: string;
  orderbookId?: string; // Avanza orderbookId; undefined → static placeholder
}

// Mapping resolved from Avanza's /_api/market-index/{id} during the proxy capture.
const INDEX_STRIP: IndexSpec[] = [
  { label: 'OMX30', orderbookId: '19002' },
  { label: 'SPX', orderbookId: '19000' },
  { label: 'NDX', orderbookId: '18981' },
  { label: 'DJI', orderbookId: '18983' },
  { label: 'DAX' },
  { label: 'VIX' },
  { label: 'US10Y' },
  { label: 'GOLD' },
  { label: 'OIL' },
  { label: 'BTC' },
];

interface Quote {
  last?: number;
  changePercent?: number;
}

export function LiveIndexTicker() {
  const avanzaConnected = useIntegrationsStore((s) => s.integrations.avanza.status === 'connected');
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});

  useEffect(() => {
    if (!avanzaConnected) return;
    let cancelled = false;
    const targets = INDEX_STRIP.filter((i) => i.orderbookId);
    Promise.all(
      targets.map(async (i) => {
        try {
          const r = (await avanzaApi.marketIndex(i.orderbookId!)) as {
            quote?: { last?: number; changePercent?: number };
          };
          return [i.label, { last: r.quote?.last, changePercent: r.quote?.changePercent }] as const;
        } catch {
          return [i.label, {} as Quote] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setQuotes(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [avanzaConnected]);

  return (
    <div className="terminal-fkeybar flex items-center gap-1 overflow-x-auto px-2 py-1 no-scrollbar">
      {INDEX_STRIP.map(({ label }) => {
        const q = quotes[label];
        const positive = (q?.changePercent ?? 0) >= 0;
        const colorClass = q?.changePercent == null
          ? 'text-zinc-400'
          : positive
            ? 'text-emerald-400'
            : 'text-red-400';
        return (
          <span
            key={label}
            className="rounded-sm border border-zinc-800 bg-black px-2 py-0.5 text-[10px] flex items-center gap-1.5 tabular-nums"
          >
            <span className="text-zinc-400">{label}</span>
            {q?.last != null && (
              <>
                <span className="text-zinc-200">{q.last.toFixed(2)}</span>
                {q.changePercent != null && (
                  <span className={colorClass}>
                    {q.changePercent > 0 ? '+' : ''}{q.changePercent.toFixed(2)}%
                  </span>
                )}
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}
