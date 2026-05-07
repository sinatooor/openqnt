import { apiBase } from '@/lib/runtimeConfig';
/**
 * Thin client for /api/backtest/* — the canonical backtest API exposed
 * by the Python backend. Same shape REST and the agent tool both return.
 */

const API_BASE =
  apiBase();

export interface StrategyMeta {
  name: string;
  params: Record<string, number | string | boolean>;
  doc: string;
}

export interface BacktestMetrics {
  return_pct: number;
  cagr_pct: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  max_drawdown_pct: number;
  win_rate_pct: number;
  profit_factor: number;
  n_trades: number;
  exposure_pct: number;
  final_equity: number;
  buy_and_hold_pct: number;
  duration_ms?: number;
}

export interface EquityPoint {
  ts: string;
  equity: number;
  drawdown_pct: number | null;
  buy_and_hold: number | null;
}

export interface Trade {
  entry_time: string | null;
  exit_time: string | null;
  entry_price: number | null;
  exit_price: number | null;
  size: number | null;
  pnl: number | null;
  return_pct: number | null;
  duration: string | null;
}

export interface BacktestResult {
  success: boolean;
  spec: Record<string, any>;
  metrics: BacktestMetrics;
  equity_curve: EquityPoint[];
  trades: Trade[];
  plot_b64?: string;
  plot_path?: string;
  artifacts_dir?: string;
  error?: string;
}

export interface BacktestRunRequest {
  symbol: string;
  start: string;
  end: string;
  interval?: string;
  initial_cash?: number;
  commission?: number;
  strategy: string;
  params?: Record<string, any>;
  code?: string;
  save_artifacts?: boolean;
  run_id?: string;
}

export async function listStrategies(): Promise<StrategyMeta[]> {
  const r = await fetch(`${API_BASE}/api/backtest/strategies`);
  if (!r.ok) throw new Error(`strategies: ${r.status}`);
  const j = await r.json();
  return j.strategies as StrategyMeta[];
}

export async function runBacktest(req: BacktestRunRequest): Promise<BacktestResult> {
  const r = await fetch(`${API_BASE}/api/backtest/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!r.ok) throw new Error(`run: ${r.status}`);
  return (await r.json()) as BacktestResult;
}
