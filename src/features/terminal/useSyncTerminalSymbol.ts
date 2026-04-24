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
import { useTerminalSymbolStore } from '@/stores/terminalSymbolStore';

export function useSyncTerminalSymbol(ticker: string | undefined): void {
  const setActiveSymbol = useTerminalSymbolStore((s) => s.setActiveSymbol);
  useEffect(() => {
    if (ticker) setActiveSymbol(ticker);
  }, [ticker, setActiveSymbol]);
}

/**
 * Pages can use this when no URL param is present, to fall back to the
 * symbol the user last looked at.
 */
export function useDefaultTerminalSymbol(fallback = 'SPY'): string {
  return useTerminalSymbolStore((s) => s.activeSymbol || fallback);
}
