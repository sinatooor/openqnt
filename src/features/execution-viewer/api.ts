/**
 * Thin client for /api/execution/* — Phase H paper / live broker path.
 */

const API_BASE =
  (import.meta as any).env?.VITE_BACKEND_URL?.replace(/\/$/, '') ??
  'http://localhost:8000';

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

export interface JournalOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  type: 'market' | 'limit';
  status: 'pending' | 'filled' | 'partial' | 'rejected' | 'cancelled';
  fill_price: number | null;
  fill_qty: number;
  submitted_at: string;
  filled_at: string | null;
  rejected_reason: string | null;
  broker: string;
  risk_decision?: { reason?: string | null; warnings?: string[] } | null;
}

export interface SignalRequest {
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  type?: 'market' | 'limit';
  limit_price?: number;
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
