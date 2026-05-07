import { apiBase } from '@/lib/runtimeConfig';
/**
 * Thin client for /api/execution/* — Phase H paper / live broker path.
 */

const API_BASE =
  apiBase();

export interface Position {
  symbol: string;
  qty: number;
  avg_price: number;
  last_price: number;
  unrealised_pnl: number;
  realised_pnl: number;
}

export interface AccountSnapshot {
  broker: string;
  halted: boolean;
  halt_reason: string | null;
  panic: { active: boolean; reason?: string; ts?: string };
  cash: number;
  equity: number;
  buying_power: number;
  realised_pnl: number;
  unrealised_pnl: number;
  positions: Position[];
  as_of: string;
}

export type OrderType =
  | 'market'
  | 'limit'
  | 'stop'
  | 'stop_limit'
  | 'trailing_stop';

/** Time-in-force: how long an order rests before being cancelled. */
export type TimeInForce =
  | 'DAY'  // expires at end of regular session
  | 'GTC'  // good-til-cancelled
  | 'GTD'  // good-til-date (requires good_til date)
  | 'IOC'  // immediate-or-cancel (no resting)
  | 'FOK'; // fill-or-kill (entire qty or none)

export interface JournalOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  type: OrderType;
  status: 'pending' | 'filled' | 'partial' | 'rejected' | 'cancelled';
  fill_price: number | null;
  fill_qty: number;
  submitted_at: string;
  filled_at: string | null;
  rejected_reason: string | null;
  broker: string;
  risk_decision?: { reason?: string | null; warnings?: string[] } | null;
  /** Set on stop / stop-limit orders. */
  stop_price?: number | null;
  /** Set on stop-limit orders (else equivalent to limit_price for limits). */
  limit_price?: number | null;
  /** For trailing-stop orders, distance from peak in absolute price. */
  trail_amount?: number | null;
  /** Optional trail expressed as a percentage (0–100). One of trail_amount/trail_percent. */
  trail_percent?: number | null;
  /** TIF; default DAY when not set. */
  tif?: TimeInForce | null;
  /** ISO 8601 expiry for GTD orders. */
  good_til?: string | null;
  /** OCO group id — sibling orders cancel each other on a fill. */
  oco_group?: string | null;
  /** Bracket parent — child take-profit/stop are linked to this id. */
  parent_id?: string | null;
}

export interface BracketLegs {
  /** Take-profit price for the bracket child sell-order. */
  take_profit_price: number;
  /** Stop-loss price for the bracket child stop-sell. */
  stop_price: number;
  /** Optional limit on the stop leg → makes it stop-limit. */
  stop_limit_price?: number;
}

export interface OcoLeg {
  type: Exclude<OrderType, 'trailing_stop'>;
  limit_price?: number;
  stop_price?: number;
}

export interface SignalRequest {
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  type?: OrderType;
  limit_price?: number;
  stop_price?: number;
  trail_amount?: number;
  trail_percent?: number;
  tif?: TimeInForce;
  good_til?: string;
  /**
   * Bracket children: server places parent + 2 OCO children (TP + SL) atomically.
   * Backend implementations should reject brackets that lack support; UI gates
   * the option behind a broker capability check.
   */
  bracket?: BracketLegs;
  /**
   * OCO group: pair of orders where filling one cancels the other. Server
   * generates and returns an oco_group id; this request describes the second leg.
   */
  oco?: OcoLeg;
}

/** Capability matrix surfaced by the backend so the UI can hide unsupported types. */
export interface BrokerCapabilities {
  broker: string;
  order_types: OrderType[];
  tif: TimeInForce[];
  brackets: boolean;
  oco: boolean;
  trailing_stops: boolean;
  fractional: boolean;
  short_selling: boolean;
}

export async function getAccount(): Promise<AccountSnapshot> {
  const r = await fetch(`${API_BASE}/api/execution/account`);
  if (!r.ok) throw new Error(`account: ${r.status}`);
  return await r.json();
}

export async function getOrders(limit = 100): Promise<JournalOrder[]> {
  const r = await fetch(`${API_BASE}/api/execution/orders?limit=${limit}`);
  if (!r.ok) throw new Error(`orders: ${r.status}`);
  const j = await r.json();
  return j.orders ?? [];
}

export async function submitSignal(req: SignalRequest): Promise<JournalOrder> {
  const r = await fetch(`${API_BASE}/api/execution/signal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!r.ok) throw new Error(`signal: ${r.status}`);
  const j = await r.json();
  return j.order as JournalOrder;
}

export async function engagePanic(reason = 'ui-engaged') {
  const r = await fetch(`${API_BASE}/api/execution/panic`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!r.ok) throw new Error(`panic: ${r.status}`);
  return await r.json();
}

export async function clearPanic() {
  const r = await fetch(`${API_BASE}/api/execution/panic`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`clear: ${r.status}`);
  return await r.json();
}

export async function cancelOrder(id: string) {
  const r = await fetch(`${API_BASE}/api/execution/orders/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!r.ok) throw new Error(`cancel: ${r.status}`);
  return await r.json();
}

/**
 * Capability fetch. Backends that don't yet implement /capabilities receive a
 * permissive default so the UI doesn't lock down legacy clients.
 */
export async function getBrokerCapabilities(): Promise<BrokerCapabilities> {
  try {
    const r = await fetch(`${API_BASE}/api/execution/capabilities`);
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch {
    return {
      broker: 'unknown',
      order_types: ['market', 'limit', 'stop', 'stop_limit', 'trailing_stop'],
      tif: ['DAY', 'GTC', 'IOC', 'FOK'],
      brackets: true,
      oco: true,
      trailing_stops: true,
      fractional: true,
      short_selling: false,
    };
  }
}

export interface TemplateSignal {
  signal: 'buy' | 'sell' | 'flat';
  rsi?: number;
  last_close?: number;
  reason?: string;
  spec?: Record<string, unknown>;
}

export async function getTemplateSignal(
  templateId = 'rsi-mean-reversion-spy',
): Promise<TemplateSignal> {
  const r = await fetch(
    `${API_BASE}/api/execution/template-signal?template_id=${encodeURIComponent(templateId)}`,
  );
  if (!r.ok) throw new Error(`template-signal: ${r.status}`);
  return await r.json();
}
