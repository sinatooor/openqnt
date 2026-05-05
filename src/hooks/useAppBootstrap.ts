/**
 * useAppBootstrap
 * ---------------
 * Runs once after auth + Zustand hydration to reconcile data the user has
 * configured but not yet fetched in this session. Today it covers:
 *
 *   - Avanza: if connected and lastSyncAt is stale, fire the sync endpoint
 *     in the background. Failures show a toast but never block UI.
 *
 * Future steps (BMAP layer warming, portfolio price refresh) hang off the
 * same hook — this is the single boot path so we don't end up with N
 * different "fetch on mount" useEffects scattered across pages.
 */

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useIntegrationsStore, isSyncStale } from '@/stores/integrationsStore';
import { avanzaApi } from '@/integrations/avanza/api';

export function useAppBootstrap(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setStatus = useIntegrationsStore((s) => s.setStatus);
  const fired = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || fired.current) return;
    fired.current = true;

    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const status = await avanzaApi.status(controller.signal);
        if (cancelled) return;
        setStatus('avanza', {
          status: status.connected ? 'connected' : 'disconnected',
          connectedAt: status.connectedAt ? Date.parse(status.connectedAt) : null,
          lastSyncAt: status.lastSyncAt ? Date.parse(status.lastSyncAt) : null,
          lastError: status.error,
        });
        if (status.connected && isSyncStale('avanza')) {
          const result = await avanzaApi.sync(controller.signal);
          if (cancelled) return;
          setStatus('avanza', {
            lastSyncAt: Date.parse(result.syncedAt),
            lastError: null,
          });
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setStatus('avanza', { lastError: message });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isAuthenticated, setStatus]);
}
