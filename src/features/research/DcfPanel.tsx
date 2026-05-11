/**
 * DCF & Equity Research panel for the Research workbench.
 *
 * Three tabs:
 *   - DCF Calculator: pure two-stage growth model, deterministic output.
 *     Shows intrinsic value vs current price (when paired with fundamentals)
 *     plus a discount-rate × terminal-growth sensitivity grid.
 *   - Fundamentals: yfinance-sourced headline metrics for a ticker.
 *   - Case Studies: LLM-written bull/bear/base note (v1 is a stub — backend
 *     returns the prompt + fundamentals; real LLM call is a follow-up).
 *
 * Backend lives at `backend/routers/equity_research.py` and is namespaced
 * under `/equity-research/*`.
 */

import { useState } from 'react';
import {
  Calculator,
  Building2,
  FileText,
  Play,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { orchestratorBase, apiBase } from '@/lib/runtimeConfig';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  API helpers                                                                */
/* -------------------------------------------------------------------------- */

// Equity research is a Python-backend feature; the orchestrator doesn't proxy
// /equity-research/* yet, so we call the Python backend directly. Frontend
// switches to the desktop-injected backend URL automatically via runtimeConfig.
const equityBase = (): string => {
  // Prefer orchestrator if you wire a proxy later. For now, talk to Python.
  return apiBase();
};

async function post(endpoint: string, body: Record<string, unknown>) {
  const resp = await fetch(`${equityBase()}/equity-research/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || `HTTP ${resp.status}`);
  }
  return resp.json();
}

/* -------------------------------------------------------------------------- */
/*  Types (matching backend response shapes)                                   */
/* -------------------------------------------------------------------------- */

interface DcfYearlyRow {
  year: number;
  fcf: number;
  pv: number;
}

interface DcfResponse {
  ticker: string;
  intrinsic_value_per_share: number;
  enterprise_value: number;
  equity_value: number;
  npv_explicit: number;
  terminal_value: number;
  terminal_value_pv: number;
  yearly: DcfYearlyRow[];
  sensitivity: {
    discount_rates: number[];
    terminal_growths: number[];
    values: number[][];
  };
  inputs: Record<string, unknown>;
  summary: string;
}

interface FundamentalsResponse {
  ticker: string;
  name?: string;
  sector?: string;
  industry?: string;
  price?: number;
  market_cap?: number;
  enterprise_value?: number;
  shares_outstanding?: number;
  valuation: Record<string, number | null>;
  profitability: Record<string, number | null>;
  growth: Record<string, number | null>;
  balance_sheet: Record<string, number | null>;
  cash_flow: Record<string, number | null>;
  dividend: Record<string, number | null>;
}

interface CaseMetaEvent {
  type: 'meta';
  ticker: string;
  name: string;
  fundamentals: FundamentalsResponse;
  prompt: string;
}
interface CaseDeltaEvent {
  type: 'delta';
  content: string;
}
interface CaseDoneEvent {
  type: 'done';
}
interface CaseErrorEvent {
  type: 'error';
  message: string;
}
type CaseEvent = CaseMetaEvent | CaseDeltaEvent | CaseDoneEvent | CaseErrorEvent;

/* -------------------------------------------------------------------------- */
/*  Formatting helpers                                                         */
/* -------------------------------------------------------------------------- */

const fmtUsd = (v: number | null | undefined, opts?: { compact?: boolean }) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const compact = opts?.compact ?? false;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 2 : 2,
    }).format(v);
  } catch {
    return `$${v.toFixed(2)}`;
  }
};

const fmtPct = (v: number | null | undefined) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(2)}%`;
};

const fmtNumber = (v: number | null | undefined) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toFixed(2);
};

/* -------------------------------------------------------------------------- */
/*  DCF Calculator tab                                                         */
/* -------------------------------------------------------------------------- */

function DcfCalculatorTab() {
  const [ticker, setTicker] = useState('AAPL');
  const [fcfBase, setFcfBase] = useState(99584); // millions
  const [growthY15, setGrowthY15] = useState(0.08);
  const [growthY610, setGrowthY610] = useState(0.04);
  const [terminalGrowth, setTerminalGrowth] = useState(0.025);
  const [discountRate, setDiscountRate] = useState(0.09);
  const [sharesOut, setSharesOut] = useState(15500); // millions
  const [netDebt, setNetDebt] = useState(50000); // millions

  const [result, setResult] = useState<DcfResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = (await post('dcf', {
        ticker,
        fcf_base: fcfBase,
        growth_y1_5: growthY15,
        growth_y6_10: growthY610,
        terminal_growth: terminalGrowth,
        discount_rate: discountRate,
        shares_out: sharesOut,
        net_debt: netDebt,
      })) as DcfResponse;
      setResult(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'request failed';
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="bg-card/60 border-border/50">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Ticker">
              <Input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </Field>
            <Field label="Base FCF (millions)">
              <Input
                type="number"
                value={fcfBase}
                onChange={(e) => setFcfBase(+e.target.value)}
              />
            </Field>
            <Field label="Shares outstanding (millions)">
              <Input
                type="number"
                value={sharesOut}
                onChange={(e) => setSharesOut(+e.target.value)}
              />
            </Field>
            <Field label="Net debt (millions)">
              <Input
                type="number"
                value={netDebt}
                onChange={(e) => setNetDebt(+e.target.value)}
              />
            </Field>
            <Field label="Growth Y1–5 (e.g. 0.08)">
              <Input
                type="number"
                step="0.01"
                value={growthY15}
                onChange={(e) => setGrowthY15(+e.target.value)}
              />
            </Field>
            <Field label="Growth Y6–10">
              <Input
                type="number"
                step="0.01"
                value={growthY610}
                onChange={(e) => setGrowthY610(+e.target.value)}
              />
            </Field>
            <Field label="Terminal growth">
              <Input
                type="number"
                step="0.005"
                value={terminalGrowth}
                onChange={(e) => setTerminalGrowth(+e.target.value)}
              />
            </Field>
            <Field label="Discount rate (WACC)">
              <Input
                type="number"
                step="0.01"
                value={discountRate}
                onChange={(e) => setDiscountRate(+e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
        <div className="px-5 py-3 border-t border-border/50 bg-muted/30 flex justify-end">
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
            Compute DCF
          </Button>
        </div>
      </Card>

      {err && (
        <Card className="border-red-500/30 bg-red-500/[0.06]">
          <CardContent className="p-3 flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-red-300">{err}</span>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="bg-card/60 border-border/50">
          <CardContent className="p-5 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Intrinsic / share" value={fmtUsd(result.intrinsic_value_per_share)} tone="profit" emphasis />
              <Stat label="Enterprise value" value={fmtUsd(result.enterprise_value * 1_000_000, { compact: true })} />
              <Stat label="NPV (explicit Y1–10)" value={fmtUsd(result.npv_explicit * 1_000_000, { compact: true })} />
              <Stat
                label="Terminal value (PV)"
                value={fmtUsd(result.terminal_value_pv * 1_000_000, { compact: true })}
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{result.summary}</p>

            {/* Yearly FCF projection */}
            <div>
              <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
                Projected FCF (millions)
              </h4>
              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/30 border-b border-border/60">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Year</th>
                      {result.yearly.map((r) => (
                        <th key={r.year} className="text-right px-2 py-1.5 font-medium text-muted-foreground">
                          {r.year}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/30">
                      <td className="px-2 py-1.5 text-muted-foreground">FCF</td>
                      {result.yearly.map((r) => (
                        <td key={r.year} className="px-2 py-1.5 text-right font-mono">
                          {fmtNumber(r.fcf)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-2 py-1.5 text-muted-foreground">PV</td>
                      {result.yearly.map((r) => (
                        <td key={r.year} className="px-2 py-1.5 text-right font-mono text-foreground/80">
                          {fmtNumber(r.pv)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sensitivity */}
            <div>
              <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
                Sensitivity · Intrinsic value / share
              </h4>
              <SensitivityGrid sens={result.sensitivity} base={result.intrinsic_value_per_share} />
              <p className="text-[10.5px] text-muted-foreground mt-2">
                Columns vary terminal growth, rows vary discount rate. Cells coloured relative to the base case.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SensitivityGrid({
  sens,
  base,
}: {
  sens: DcfResponse['sensitivity'];
  base: number;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-[11px]">
        <thead className="bg-muted/30 border-b border-border/60">
          <tr>
            <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Discount ↓ / Terminal →</th>
            {sens.terminal_growths.map((tg) => (
              <th key={tg} className="text-right px-2 py-1.5 font-medium text-muted-foreground font-mono">
                {(tg * 100).toFixed(2)}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sens.values.map((row, i) => (
            <tr key={i} className="border-b border-border/30 last:border-0">
              <td className="px-2 py-1.5 font-mono text-muted-foreground">
                {(sens.discount_rates[i] * 100).toFixed(2)}%
              </td>
              {row.map((v, j) => {
                const isNaNValue = !Number.isFinite(v);
                const delta = isNaNValue ? 0 : (v - base) / Math.max(1e-9, Math.abs(base));
                const tone =
                  isNaNValue ? 'text-muted-foreground/40'
                    : delta > 0.05 ? 'bg-green-500/[0.12] text-green-300'
                      : delta < -0.05 ? 'bg-red-500/[0.12] text-red-300'
                        : 'text-foreground/80';
                return (
                  <td key={j} className={cn('px-2 py-1.5 text-right font-mono', tone)}>
                    {isNaNValue ? '—' : fmtUsd(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Fundamentals tab                                                           */
/* -------------------------------------------------------------------------- */

function FundamentalsTab() {
  const [ticker, setTicker] = useState('AAPL');
  const [data, setData] = useState<FundamentalsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setErr(null);
    try {
      setData((await post('fundamentals', { ticker })) as FundamentalsResponse);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'request failed';
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="bg-card/60 border-border/50">
        <CardContent className="p-5 flex items-center gap-3">
          <Field label="Ticker" wide>
            <Input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && run()}
              className="font-mono"
            />
          </Field>
          <Button onClick={run} disabled={loading} className="shrink-0 mt-5">
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
            Fetch
          </Button>
        </CardContent>
      </Card>

      {err && (
        <Card className="border-red-500/30 bg-red-500/[0.06]">
          <CardContent className="p-3 flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-red-300">{err}</span>
          </CardContent>
        </Card>
      )}

      {data && (
        <Card className="bg-card/60 border-border/50">
          <CardContent className="p-5 space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground truncate">
                  {data.name || data.ticker}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {data.sector ?? '—'} · {data.industry ?? '—'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-semibold tabular-nums">{fmtUsd(data.price)}</div>
                <div className="text-[10px] text-muted-foreground">
                  Market cap {fmtUsd(data.market_cap, { compact: true })}
                </div>
              </div>
            </div>

            <Group title="Valuation">
              <Metric label="P/E (TTM)" value={fmtNumber(data.valuation.pe_trailing)} />
              <Metric label="P/E (Fwd)" value={fmtNumber(data.valuation.pe_forward)} />
              <Metric label="PEG" value={fmtNumber(data.valuation.peg)} />
              <Metric label="P/B" value={fmtNumber(data.valuation.price_to_book)} />
              <Metric label="P/S (TTM)" value={fmtNumber(data.valuation.price_to_sales_ttm)} />
              <Metric label="EV / EBITDA" value={fmtNumber(data.valuation.ev_to_ebitda)} />
            </Group>

            <Group title="Profitability">
              <Metric label="Gross margin" value={fmtPct(data.profitability.gross_margin)} />
              <Metric label="Operating margin" value={fmtPct(data.profitability.operating_margin)} />
              <Metric label="Profit margin" value={fmtPct(data.profitability.profit_margin)} />
              <Metric label="ROE" value={fmtPct(data.profitability.roe)} />
              <Metric label="ROA" value={fmtPct(data.profitability.roa)} />
            </Group>

            <Group title="Growth">
              <Metric label="Revenue growth" value={fmtPct(data.growth.revenue_growth)} />
              <Metric label="Earnings growth" value={fmtPct(data.growth.earnings_growth)} />
              <Metric label="Earnings Q growth" value={fmtPct(data.growth.earnings_quarterly_growth)} />
            </Group>

            <Group title="Balance sheet">
              <Metric label="Total cash" value={fmtUsd(data.balance_sheet.total_cash, { compact: true })} />
              <Metric label="Total debt" value={fmtUsd(data.balance_sheet.total_debt, { compact: true })} />
              <Metric label="Debt / Equity" value={fmtNumber(data.balance_sheet.debt_to_equity)} />
              <Metric label="Current ratio" value={fmtNumber(data.balance_sheet.current_ratio)} />
              <Metric label="Quick ratio" value={fmtNumber(data.balance_sheet.quick_ratio)} />
              <Metric label="Book value" value={fmtNumber(data.balance_sheet.book_value)} />
            </Group>

            <Group title="Cash flow & dividend">
              <Metric label="Operating CF" value={fmtUsd(data.cash_flow.operating_cashflow, { compact: true })} />
              <Metric label="Free CF" value={fmtUsd(data.cash_flow.free_cashflow, { compact: true })} />
              <Metric label="Div yield" value={fmtPct(data.dividend.yield)} />
              <Metric label="Payout ratio" value={fmtPct(data.dividend.payout_ratio)} />
            </Group>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Case studies tab — placeholder UI, real LLM wiring in a follow-up         */
/* -------------------------------------------------------------------------- */

function CaseStudiesTab() {
  const [ticker, setTicker] = useState('AAPL');
  const [extra, setExtra] = useState('');
  const [meta, setMeta] = useState<CaseMetaEvent | null>(null);
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Abort the in-flight stream when the user cancels or restarts.
  const abortRef = useState<{ ctrl: AbortController | null }>({ ctrl: null })[0];

  const cancel = () => {
    abortRef.ctrl?.abort();
    abortRef.ctrl = null;
    setStreaming(false);
  };

  const run = async () => {
    cancel();
    setErr(null);
    setText('');
    setMeta(null);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.ctrl = ctrl;

    try {
      const resp = await fetch(`${equityBase()}/equity-research/case/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, extra_prompt: extra || undefined }),
        signal: ctrl.signal,
      });
      if (!resp.ok || !resp.body) {
        const detail = await resp.text().catch(() => `HTTP ${resp.status}`);
        throw new Error(detail || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Parse SSE frames: each event ends with a blank line ("\n\n"). The
      // event body lines start with "data: ". We collect deltas until 'done'.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          for (const line of frame.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            let evt: CaseEvent;
            try {
              evt = JSON.parse(json) as CaseEvent;
            } catch {
              continue;
            }
            if (evt.type === 'meta') {
              setMeta(evt);
            } else if (evt.type === 'delta') {
              setText((t) => t + evt.content);
            } else if (evt.type === 'done') {
              setStreaming(false);
            } else if (evt.type === 'error') {
              setErr(evt.message);
              setStreaming(false);
              toast.error(evt.message);
            }
          }
        }
      }
      setStreaming(false);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      const msg = e instanceof Error ? e.message : 'request failed';
      setErr(msg);
      setStreaming(false);
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="bg-card/60 border-border/50">
        <CardContent className="p-5 space-y-3">
          <Field label="Ticker">
            <Input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="font-mono max-w-[200px]"
            />
          </Field>
          <Field label="Focus (optional)">
            <Input
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="e.g. focus on AI exposure"
            />
          </Field>
        </CardContent>
        <div className="px-5 py-3 border-t border-border/50 bg-muted/30 flex justify-end gap-2">
          {streaming && (
            <Button variant="outline" onClick={cancel}>
              Stop
            </Button>
          )}
          <Button onClick={run} disabled={streaming}>
            {streaming ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 mr-1.5" />
            )}
            Generate case
          </Button>
        </div>
      </Card>

      {err && (
        <Card className="border-red-500/30 bg-red-500/[0.06]">
          <CardContent className="p-3 flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-red-300">{err}</span>
          </CardContent>
        </Card>
      )}

      {(meta || text) && (
        <Card className="bg-card/60 border-border/50">
          <CardContent className="p-5 space-y-4">
            {meta && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold truncate">{meta.name}</h3>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {meta.fundamentals.sector ?? '—'} · {meta.fundamentals.industry ?? '—'}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider shrink-0">
                  {meta.ticker}
                </Badge>
              </div>
            )}

            <div className="rounded-md border border-border/40 bg-muted/20 p-4 min-h-[120px]">
              {text ? (
                <CaseMarkdown text={text} />
              ) : streaming ? (
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating bull / bear / base case…
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground">Waiting for response…</p>
              )}
              {streaming && text && (
                <span className="inline-block w-1.5 h-3.5 bg-primary/70 ml-0.5 animate-pulse" />
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Minimal markdown-ish renderer for the streaming case text. We only need
 * H2 headings (## Bull case, etc.) and paragraph breaks — full markdown
 * would pull in another dep we don't need. Bold (**x**) and bullet lists
 * (- item) round out the basics the prompt asks the LLM to use.
 */
function CaseMarkdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-foreground/90">
      {blocks.map((block, i) => {
        if (block.startsWith('## ')) {
          return (
            <h4
              key={i}
              className="text-[11px] uppercase tracking-wider text-primary font-semibold pt-2"
            >
              {block.replace(/^##\s+/, '')}
            </h4>
          );
        }
        if (block.split('\n').every((l) => l.trim().startsWith('-'))) {
          return (
            <ul key={i} className="list-disc list-inside space-y-1">
              {block.split('\n').map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^\s*-\s*/, ''))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(block)}
          </p>
        );
      })}
    </div>
  );
}

/** Inline-format **bold** spans. */
function renderInline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={i} className="font-semibold text-foreground">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

/* -------------------------------------------------------------------------- */
/*  Layout helpers                                                             */
/* -------------------------------------------------------------------------- */

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('space-y-1', wide && 'flex-1')}>
      <Label className="text-[10.5px] text-muted-foreground uppercase tracking-wider">{label}</Label>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'profit' | 'loss';
  emphasis?: boolean;
}) {
  const toneClass =
    tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : 'text-foreground';
  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div
        className={cn(
          'tabular-nums leading-tight mt-1',
          toneClass,
          emphasis ? 'text-2xl font-semibold' : 'text-base font-semibold',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
        {title}
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">{children}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-card/30 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-mono text-foreground tabular-nums">{value}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Root panel                                                                 */
/* -------------------------------------------------------------------------- */

export function DcfPanel() {
  return (
    <Tabs defaultValue="dcf" className="space-y-4">
      <TabsList className="bg-muted/40 border border-border/60">
        <TabsTrigger value="dcf" className="text-xs gap-1.5">
          <Calculator className="w-3.5 h-3.5" />
          DCF Calculator
        </TabsTrigger>
        <TabsTrigger value="fundamentals" className="text-xs gap-1.5">
          <Building2 className="w-3.5 h-3.5" />
          Fundamentals
        </TabsTrigger>
        <TabsTrigger value="case" className="text-xs gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          Case Studies
        </TabsTrigger>
      </TabsList>
      <TabsContent value="dcf">
        <DcfCalculatorTab />
      </TabsContent>
      <TabsContent value="fundamentals">
        <FundamentalsTab />
      </TabsContent>
      <TabsContent value="case">
        <CaseStudiesTab />
      </TabsContent>
    </Tabs>
  );
}
