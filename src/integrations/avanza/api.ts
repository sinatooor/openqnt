/**
 * Avanza frontend API client
 * --------------------------
 * Thin wrapper around the FastAPI `/api/integrations/avanza/*` routes. Keeps
 * the credentials in transit (the request body) and the encrypted blob
 * server-side; nothing sensitive ever lands in the browser store.
 */

const BACKEND_URL =
  (import.meta.env?.VITE_BACKEND_URL as string | undefined) ||
  'http://localhost:8000';

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
      `Avanza request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export interface AvanzaConnectInput {
  username: string;
  password: string;
  totpSecret: string;
}

export interface AvanzaStatus {
  connected: boolean;
  connectedAt: string | null;
  lastSyncAt: string | null;
  error: string | null;
  accounts: Array<{ id: string; name: string; type: string; totalValue?: number; currency?: string }>;
}

export interface AvanzaSyncResult {
  positions: number;
  watchlists: number;
  transactions: number;
  syncedAt: string;
}

export interface AvanzaPosition {
  accountId: string;
  orderbookId: string;
  symbol: string;
  name: string;
  quantity: number;
  averagePrice: number | null;
  lastPrice: number | null;
  marketValue: number | null;
  currency: string;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
}

export interface AvanzaWatchlist {
  id: string;
  name: string;
  orderbookIds: string[];
}

export interface AvanzaOrderRequest {
  accountId: string;
  orderbookId: string;
  side: 'BUY' | 'SELL';
  price: number;
  volume: number;
  validUntil?: string;
  orderType?: string;
  openVolume?: number;
  confirmed: true;
}

export interface AvanzaFundOrderRequest {
  accountId: string;
  orderbookId: string;
  amount?: number;
  sharesPercent?: number;
  confirmed: true;
}

export const avanzaApi = {
  connect: (input: AvanzaConnectInput, signal?: AbortSignal) =>
    call<AvanzaStatus>(
      '/api/integrations/avanza/connect',
      { method: 'POST', body: JSON.stringify(input) },
      signal,
    ),
  disconnect: (signal?: AbortSignal) =>
    call<{ ok: true }>(
      '/api/integrations/avanza/disconnect',
      { method: 'POST' },
      signal,
    ),
  status: (signal?: AbortSignal) =>
    call<AvanzaStatus>('/api/integrations/avanza/status', {}, signal),
  sync: (signal?: AbortSignal) =>
    call<AvanzaSyncResult>(
      '/api/integrations/avanza/sync',
      { method: 'POST' },
      signal,
    ),
  positions: (signal?: AbortSignal) =>
    call<{ positions: AvanzaPosition[] }>(
      '/api/integrations/avanza/positions',
      {},
      signal,
    ),
  watchlists: (signal?: AbortSignal) =>
    call<{ watchlists: AvanzaWatchlist[] }>(
      '/api/integrations/avanza/watchlists',
      {},
      signal,
    ),
  placeOrder: (order: AvanzaOrderRequest, signal?: AbortSignal) =>
    call<{ ok: true; result: Record<string, unknown> }>(
      '/api/integrations/avanza/orders',
      { method: 'POST', body: JSON.stringify(order) },
      signal,
    ),
  cancelOrder: (orderId: string, accountId: string, signal?: AbortSignal) =>
    call<{ ok: true; result: Record<string, unknown> }>(
      `/api/integrations/avanza/orders/${encodeURIComponent(orderId)}?accountId=${encodeURIComponent(accountId)}`,
      { method: 'DELETE' },
      signal,
    ),
  buyFund: (order: AvanzaFundOrderRequest, signal?: AbortSignal) =>
    call<{ ok: true; result: Record<string, unknown> }>(
      '/api/integrations/avanza/funds/buy',
      { method: 'POST', body: JSON.stringify(order) },
      signal,
    ),
  sellFund: (order: AvanzaFundOrderRequest, signal?: AbortSignal) =>
    call<{ ok: true; result: Record<string, unknown> }>(
      '/api/integrations/avanza/funds/sell',
      { method: 'POST', body: JSON.stringify(order) },
      signal,
    ),
};
