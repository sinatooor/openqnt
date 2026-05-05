/**
 * integrationsStore
 * -----------------
 * Tracks per-provider connection status (Avanza first; later Nordnet, IBKR,
 * etc.). Used by Settings UI, useAppBootstrap (decides whether to sync on
 * open), and Terminal data hooks (decides whether to allow `source=avanza`).
 *
 * The encrypted credentials themselves never enter this store - they live
 * server-side in the user_integrations table. We only mirror status flags
 * and timestamps.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type IntegrationProvider = 'avanza' | 'nordnet' | 'ibkr';
export type IntegrationStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface IntegrationState {
  status: IntegrationStatus;
  connectedAt: number | null;
  lastSyncAt: number | null;
  lastError: string | null;
}

const DEFAULT_STATE: IntegrationState = {
  status: 'disconnected',
  connectedAt: null,
  lastSyncAt: null,
  lastError: null,
};

interface IntegrationsStore {
  integrations: Record<IntegrationProvider, IntegrationState>;
  setStatus: (provider: IntegrationProvider, patch: Partial<IntegrationState>) => void;
  reset: (provider: IntegrationProvider) => void;
}

export const useIntegrationsStore = create<IntegrationsStore>()(
  persist(
    (set) => ({
      integrations: {
        avanza: { ...DEFAULT_STATE },
        nordnet: { ...DEFAULT_STATE },
        ibkr: { ...DEFAULT_STATE },
      },
      setStatus: (provider, patch) =>
        set((state) => ({
          integrations: {
            ...state.integrations,
            [provider]: { ...state.integrations[provider], ...patch },
          },
        })),
      reset: (provider) =>
        set((state) => ({
          integrations: {
            ...state.integrations,
            [provider]: { ...DEFAULT_STATE },
          },
        })),
    }),
    {
      name: 'openqwnt-integrations',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function getIntegrationState(provider: IntegrationProvider): IntegrationState {
  return useIntegrationsStore.getState().integrations[provider];
}

export const STALE_SYNC_MS = 5 * 60 * 1000;

export function isSyncStale(provider: IntegrationProvider): boolean {
  const s = getIntegrationState(provider);
  if (s.status !== 'connected') return false;
  if (s.lastSyncAt == null) return true;
  return Date.now() - s.lastSyncAt > STALE_SYNC_MS;
}
