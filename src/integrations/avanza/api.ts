import { apiBase } from '@/lib/runtimeConfig';
/**
 * Avanza frontend API client
 * --------------------------
 * Thin wrapper around the FastAPI `/api/integrations/avanza/*` routes. Keeps
 * the credentials in transit (the request body) and the encrypted blob
 * server-side; nothing sensitive ever lands in the browser store.
 */

const BACKEND_URL =
  apiBase();

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

export type AvanzaTimePeriod =
  | 'ONE_WEEK' | 'ONE_MONTH' | 'THREE_MONTHS'
  | 'THIS_YEAR' | 'ONE_YEAR' | 'THREE_YEARS' | 'ALL_TIME';

export interface AvanzaChartPoint {
  timestamp: number;
  totalValue: number | null;
  performance: number | null;
}

export interface AvanzaChartResponse {
  points: AvanzaChartPoint[];
  timePeriod: AvanzaTimePeriod;
  from: string | null;
  to: string | null;
  currency: string;
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
  performanceChart: (timePeriod: AvanzaTimePeriod = 'ONE_YEAR', signal?: AbortSignal) =>
    call<AvanzaChartResponse>(
      `/api/integrations/avanza/performance/chart?timePeriod=${encodeURIComponent(timePeriod)}`,
      {},
      signal,
    ),
  performanceTotals: (signal?: AbortSignal) =>
    call<Record<string, unknown>>(
      '/api/integrations/avanza/performance/totals',
      {},
      signal,
    ),
  performanceKeyratios: (signal?: AbortSignal) =>
    call<Record<string, unknown>>(
      '/api/integrations/avanza/performance/keyratios',
      {},
      signal,
    ),
  upcomingDividends: (signal?: AbortSignal) =>
    call<unknown>('/api/integrations/avanza/dividends/upcoming', {}, signal),
  calendar: (signal?: AbortSignal) =>
    call<unknown>('/api/integrations/avanza/calendar', {}, signal),
  quote: (orderbookId: string, signal?: AbortSignal) =>
    call<Record<string, unknown>>(
      `/api/integrations/avanza/quote/${encodeURIComponent(orderbookId)}`,
      {},
      signal,
    ),
  marketIndex: (indexId: string, signal?: AbortSignal) =>
    call<Record<string, unknown>>(
      `/api/integrations/avanza/index/${encodeURIComponent(indexId)}`,
      {},
      signal,
    ),
  marketOverview: (signal?: AbortSignal) =>
    call<{
      gainers: { orderbooks: Array<Record<string, unknown>> };
      losers: { orderbooks: Array<Record<string, unknown>> };
      overviews: unknown;
    }>('/api/integrations/avanza/market-overview', {}, signal),
  stockDetail: (orderbookId: string, signal?: AbortSignal) =>
    call<{
      orderbookId: string;
      info: Record<string, unknown>;
      quote: Record<string, unknown>;
      details: Record<string, unknown>;
      orderdepth: Record<string, unknown>;
      trades: Record<string, unknown>;
      note: unknown;
    }>(`/api/integrations/avanza/stock/${encodeURIComponent(orderbookId)}`, {}, signal),
  accountDetail: (urlParameterId: string, signal?: AbortSignal) =>
    call<{
      urlParameterId: string;
      overview: Record<string, unknown>;
      positions: Record<string, unknown>;
      totals: Record<string, unknown>;
    }>(`/api/integrations/avanza/account/${encodeURIComponent(urlParameterId)}`, {}, signal),
  watchlistQuotes: (
    body: { watchlistId: string; orderbookIds: string[]; dataPoints?: string[] },
    signal?: AbortSignal,
  ) =>
    call<Array<Record<string, unknown>>>(
      '/api/integrations/avanza/watchlist/quotes',
      { method: 'POST', body: JSON.stringify(body) },
      signal,
    ),
  notesAll: (query?: string, signal?: AbortSignal) =>
    call<unknown>(
      `/api/integrations/avanza/notes/all${query ? `?query=${encodeURIComponent(query)}` : ''}`,
      {},
      signal,
    ),
  noteFor: (orderbookId: string, signal?: AbortSignal) =>
    call<unknown>(
      `/api/integrations/avanza/notes/${encodeURIComponent(orderbookId)}`,
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
