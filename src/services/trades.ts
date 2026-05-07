import { apiBase } from '@/lib/runtimeConfig';
const BACKEND_URL = apiBase();

export interface Trade {
  id: number;
  execution_id: number;
  symbol: string;
  direction: string;
  entry_time: string;
  entry_price: number;
  size: number;
  exit_time: string | null;
  exit_price: number | null;
  pnl: number | null;
  pnl_percent: number | null;
  status: string;
  broker_ref: string | null;
}

export interface TradeSummary {
  total_trades: number;
  win_rate: number;
  total_pnl: number;
}

export async function fetchTrades(params: {
  skip?: number;
  limit?: number;
  symbol?: string;
  status?: string;
  execution_id?: number;
} = {}): Promise<Trade[]> {
  const queryParams = new URLSearchParams();
  if (params.skip !== undefined) queryParams.append('skip', params.skip.toString());
  if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
  if (params.symbol) queryParams.append('symbol', params.symbol);
  if (params.status) queryParams.append('status', params.status);
  if (params.execution_id !== undefined) queryParams.append('execution_id', params.execution_id.toString());

  const response = await fetch(`${BACKEND_URL}/api/trades/?${queryParams.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch trades');
  }
  return response.json();
}

export async function fetchTradeSummary(): Promise<TradeSummary> {
  const response = await fetch(`${BACKEND_URL}/api/trades/summary`);
  if (!response.ok) {
    throw new Error('Failed to fetch trade summary');
  }
  return response.json();
}

export interface Execution {
  id: number;
  strategy_name: string;
  symbol: string;
  start_time: string;
  end_time: string | null;
  status: string;
  trade_count: number;
}

export async function fetchExecution(id: number): Promise<Execution> {
  const response = await fetch(`${BACKEND_URL}/api/trades/executions/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch execution details');
  }
  return response.json();
}