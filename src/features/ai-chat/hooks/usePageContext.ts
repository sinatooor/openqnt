/**
 * usePageContext — register the current page's grounding info with pageContextStore.
 *
 * Call from any page that wants to ground the AI in what the user is looking at.
 *
 * Example:
 *   usePageContext({
 *     page: 'terminal/rmap',
 *     primaryEntity: { type: 'symbol', id: 'TSLA', label: 'Tesla' },
 *     visibleData: { kind: 'chart', snapshot: { timeframe: '1D' } },
 *   })
 *
 * The store auto-clears the previous context if the page string changes — so
 * stale Dashboard data never leaks into the Terminal.
 */

import { useEffect } from 'react';
import { usePageContextStore } from '../state/pageContextStore';
import type { PageContext } from '../types';

export function usePageContext(ctx: PageContext) {
  // Re-run the effect when any context property changes. Stringify is fine
  // here — context is small and shallow.
  const dep = JSON.stringify(ctx);

  useEffect(() => {
    usePageContextStore.getState().setContext(ctx);
    return () => {
      // Only clear if the store's current context is still ours (handles
      // race with the next page registering before unmount).
      const current = usePageContextStore.getState().context;
      if (current?.page === ctx.page) {
        usePageContextStore.getState().clear();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}
