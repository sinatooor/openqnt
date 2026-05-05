/**
 * useSyncTerminalSymbol — keeps URL ↔ activeSymbol store in sync.
 *
 * Each terminal page parses its `:ticker` URL param and calls this hook
 * with the result. The store then knows which symbol the user is
 * actually looking at, so:
 *
 *   - the cmd+k palette's "ACTIVE" indicator is correct
 *   - recents reflect what the user has actually viewed (URL navigation
 *     and palette navigation both write through)
 *   - other panes can read `activeSymbol` to mirror state without each
 *     page reading every other page's URL.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTerminalSymbolStore } from '@/stores/terminalSymbolStore';
import { usePageContextStore } from '@/features/ai-chat/state/pageContextStore';

export function useSyncTerminalSymbol(ticker: string | undefined): void {
  const setActiveSymbol = useTerminalSymbolStore((s) => s.setActiveSymbol);
  const location = useLocation();

  useEffect(() => {
    if (ticker) setActiveSymbol(ticker);
  }, [ticker, setActiveSymbol]);

  // Register AI page context for this terminal page so the AI knows which
  // tool + symbol the user is viewing.
  useEffect(() => {
    // First two segments of the path: '/terminal/rmap/AAPL' → 'terminal/rmap'
    const segments = location.pathname.replace(/^\//, '').split('/');
    const page = segments.slice(0, 2).join('/') || 'terminal';
    usePageContextStore.getState().setContext({
      page,
      primaryEntity: ticker
        ? { type: 'symbol', id: ticker.toUpperCase(), label: ticker.toUpperCase() }
        : undefined,
    });
    return () => {
      const cur = usePageContextStore.getState().context;
      if (cur?.page === page) usePageContextStore.getState().clear();
    };
  }, [location.pathname, ticker]);
}

/**
 * Pages can use this when no URL param is present, to fall back to the
 * symbol the user last looked at.
 */
export function useDefaultTerminalSymbol(fallback = 'SPY'): string {
  return useTerminalSymbolStore((s) => s.activeSymbol || fallback);
}
