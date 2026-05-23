/**
 * IBKR (Interactive Brokers) frontend API client.
 *
 * Mirrors `src/integrations/avanza/api.ts` so the UI can treat both brokers
 * uniformly. Routes are served by `backend/routers/integrations.py` under
 * `/api/integrations/ibkr/*`.
 */
import { apiBase } from '@/lib/runtimeConfig';

const BACKEND_URL = apiBase();

function authHeaders(): Record<string, string> {
  try {
    const authState = JSON.parse(localStorage.getItem('strategyflow-auth') || '{}');
    if (authState?.state?.accessToken) {
      return { Authorization: `Bearer ${authState.state.accessToken}` };
    }
  } catch {
    /* no auth */
  }
  return {};
}

async function call<T>(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
    signal,
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'detail' in body && typeof (body as { detail?: unknown }).detail === 'string'
        ? (body as { detail: string }).detail
        : null) ||
      (typeof body === 'string' ? body : null) ||
      `IBKR request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export interface IbkrConnectInput {
  host: string;
  port: number;
  clientId: number;
  accountId?: string;
}

export interface IbkrStatus {
  connected: boolean;
  connectedAt: string | null;
  lastSyncAt: string | null;
  error: string | null;
  host: string | null;
  port: number | null;
  clientId: number | null;
  accountId: string | null;
}

export interface IbkrPosition {
  symbol: string;
  qty: number;
  avg_price: number;
  last_price: number;
  unrealised_pnl: number;
  realised_pnl: number;
}

export interface IbkrAccount {
  connected: boolean;
  cash: number;
  equity: number;
  buying_power: number;
  unrealised_pnl: number;
  realised_pnl: number;
  positions: IbkrPosition[];
  broker: string;
  as_of?: string;
}

export interface IbkrSyncResult {
  positions: number;
  equity: number;
  syncedAt: string;
}

export const ibkrApi = {
  connect: (input: IbkrConnectInput, signal?: AbortSignal) =>
    call<IbkrStatus>(
      '/api/integrations/ibkr/connect',
      { method: 'POST', body: JSON.stringify(input) },
      signal,
    ),
  disconnect: (signal?: AbortSignal) =>
    call<{ ok: true }>(
      '/api/integrations/ibkr/disconnect',
      { method: 'POST' },
      signal,
    ),
  status: (signal?: AbortSignal) => call<IbkrStatus>('/api/integrations/ibkr/status', {}, signal),
  sync: (signal?: AbortSignal) =>
    call<IbkrSyncResult>('/api/integrations/ibkr/sync', { method: 'POST' }, signal),
  positions: (signal?: AbortSignal) =>
    call<{ positions: IbkrPosition[]; connected: boolean; asOf?: string }>(
      '/api/integrations/ibkr/positions',
      {},
      signal,
    ),
  account: (signal?: AbortSignal) => call<IbkrAccount>('/api/integrations/ibkr/account', {}, signal),
  quote: (symbol: string, signal?: AbortSignal) =>
    call<{ symbol: string; last: number | null }>(
      `/api/integrations/ibkr/quote/${encodeURIComponent(symbol)}`,
      {},
      signal,
    ),
  optionChain: (symbol: string, signal?: AbortSignal) =>
    call<IbkrOptionChain>(
      `/api/integrations/ibkr/options/${encodeURIComponent(symbol)}/chain`,
      {},
      signal,
    ),
  placeOptionOrder: (body: IbkrOptionOrderInput, signal?: AbortSignal) =>
    call<{ ok: true; order: IbkrOrderResult }>(
      '/api/integrations/ibkr/options/order',
      { method: 'POST', body: JSON.stringify(body) },
      signal,
    ),
};

export interface IbkrOptionChain {
  underlyingConId: number;
  underlyingSymbol: string;
  longName?: string;
  params: Array<{
    exchange: string;
    underlyingConId: number;
    tradingClass: string;
    multiplier: string;
    expirations: string[]; // YYYYMMDD
    strikes: number[];
  }>;
}

export interface IbkrOptionOrderInput {
  symbol: string;
  expiry: string;    // YYYYMMDD
  strike: number;
  right: 'C' | 'P';
  side: 'buy' | 'sell';
  qty: number;
  orderType?: 'market' | 'limit';
  limitPrice?: number;
  confirmed: true;
}

export interface IbkrOrderResult {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  status: string;
  rejected_reason?: string;
  fill_price?: number;
  fill_qty?: number;
  broker: string;
}
