/**
 * Terminal Page – Modular widget canvas (moved from Dashboard).
 *
 * Hosts a Bloomberg-style command input that lets the user launch terminal
 * functions by typing e.g. "AAPL RMAP" <GO>.  The widget dashboard lives
 * below the command bar.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ConfigProvider, theme as antTheme } from 'antd';
import { TooltipProvider } from '@/components/ui/tooltip';
import DashboardCanvas from '../features/dashboard/canvas/DashboardCanvas';
import { LiveIndexTicker } from '../features/terminal/LiveIndexTicker';

/**
 * Registry of supported Bloomberg-style mnemonics. New functions just add a
 * row here — the command parser handles routing automatically.
 */
interface FunctionSpec {
  code: string;
  label: string;
  description: string;
  /** Builds the target URL when invoked.  Ticker is optional for some. */
  toPath: (ticker?: string) => string;
  requiresTicker: boolean;
}

const FUNCTIONS: FunctionSpec[] = [
  {
    code: 'RMAP',
    label: 'Relationship Map',
    description: 'Company market & industry relationships',
    toPath: (t) => `/terminal/rmap/${encodeURIComponent(t ?? '')}`.replace(/\/$/, ''),
    requiresTicker: true,
  },
  {
    code: 'BMAP',
    label: 'Commodity Map',
    description: 'Global oil, gas, pipelines, vessels & storms map',
    toPath: () => '/terminal/bmap',
    requiresTicker: false,
  },
  {
    code: 'SPLC',
    label: 'Supply Chain',
    description: 'Suppliers, customers & peers with exposure analytics',
    toPath: (t) => `/terminal/splc/${encodeURIComponent(t ?? '')}`.replace(/\/$/, ''),
    requiresTicker: true,
  },
  {
    code: 'HDS',
    label: 'Holders Detail',
    description: 'Institutional, fund, ETF, hedge fund & insider holders',
    toPath: (t) => `/terminal/hds/${encodeURIComponent(t ?? '')}`.replace(/\/$/, ''),
    requiresTicker: true,
  },
  {
    code: 'GIP',
    label: 'Intraday Graph',
    description: 'Intraday OHLCV chart with VWAP, volume pane & extended hours',
    toPath: (t) => `/terminal/gip/${encodeURIComponent(t ?? '')}`.replace(/\/$/, ''),
    requiresTicker: true,
  },
  {
    code: 'DES',
    label: 'Company Description',
    description: 'Business description, segments, execs, fundamentals, valuation & corporate identifiers',
    toPath: (t) => `/terminal/des/${encodeURIComponent(t ?? '')}`.replace(/\/$/, ''),
    requiresTicker: true,
  },
  {
    code: 'FA',
    label: 'Financial Analysis',
    description: 'Multi-year fundamentals: revenue, EBITDA, margins, EPS, P/E history',
    toPath: (t) => `/terminal/fa/${encodeURIComponent(t ?? '')}`.replace(/\/$/, ''),
    requiresTicker: true,
  },
  {
    code: 'DVD',
    label: 'Dividend',
    description: 'Dividend history, yield trend, payout ratio, ex-date calendar',
    toPath: (t) => `/terminal/dvd/${encodeURIComponent(t ?? '')}`.replace(/\/$/, ''),
    requiresTicker: true,
  },
  {
    code: 'N',
    label: 'News',
    description: 'Per-instrument news headlines',
    toPath: (t) => `/terminal/n/${encodeURIComponent(t ?? '')}`.replace(/\/$/, ''),
    requiresTicker: true,
  },
  {
    code: 'RV',
    label: 'Relative Value',
    description: 'Peer comparison matrix across P/E, P/B, P/S, EV/EBITDA, ROE, dividend yield',
    toPath: (t) => `/terminal/rv/${encodeURIComponent(t ?? '')}`.replace(/\/$/, ''),
    requiresTicker: true,
  },
  {
    code: 'WATCH',
    label: 'Watchlist',
    description: 'Live-quote table for the user\'s watchlist',
    toPath: () => '/terminal/watch',
    requiresTicker: false,
  },
  {
    code: 'MOST',
    label: 'Movers',
    description: 'Top gainers, losers, and most-active by region',
    toPath: () => '/terminal/most',
    requiresTicker: false,
  },
  {
    code: 'TOP',
    label: 'Top Stories',
    description: 'Cross-market editorial newsfeed',
    toPath: () => '/terminal/top',
    requiresTicker: false,
  },
  {
    code: 'EQS',
    label: 'Equity Screener',
    description: 'Multi-factor screener with savable thresholds',
    toPath: () => '/terminal/eqs',
    requiresTicker: false,
  },
];

const FUNCTION_CODES = new Set(FUNCTIONS.map((f) => f.code));

/**
 * Parse a free-form command such as "AAPL RMAP", "RMAP AAPL", or just "RMAP".
 * Tokens are split by whitespace; the first recognised function code becomes
 * the mnemonic and the first non-function token becomes the ticker.
 */
function parseCommand(raw: string): { fn?: FunctionSpec; ticker?: string } {
  const tokens = raw
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t !== '<GO>' && t !== 'GO' && t !== '<EQUITY>' && t !== 'EQUITY');

  let fn: FunctionSpec | undefined;
  let ticker: string | undefined;
  for (const tok of tokens) {
    if (!fn && FUNCTION_CODES.has(tok)) {
      fn = FUNCTIONS.find((f) => f.code === tok);
      continue;
    }
    if (!ticker) ticker = tok;
  }
  return { fn, ticker };
}

const Terminal = () => {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [command, setCommand] = useState('');
  const [cmdError, setCmdError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated]);

  const runCommand = (raw: string) => {
    const { fn, ticker } = parseCommand(raw);
    if (!fn) {
      setCmdError(
        `Unknown function. Try: ${FUNCTIONS.map((f) => `TICKER ${f.code}`).join(', ')}`,
      );
      return;
    }
    if (fn.requiresTicker && !ticker) {
      setCmdError(`${fn.code} requires a ticker (e.g. "AAPL ${fn.code}")`);
      return;
    }
    setCmdError(null);
    navigate(fn.toPath(ticker));
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: antTheme.darkAlgorithm,
        token: {
          colorPrimary: '#3b82f6',
          colorBgContainer: 'transparent',
          colorText: '#e2e8f0',
          colorTextSecondary: '#94a3b8',
          borderRadius: 8,
          fontSize: 13,
        },
      }}
    >
      <TooltipProvider delayDuration={200}>
        <div className="min-h-screen bg-background pt-14">
          <div className="w-full max-w-none space-y-2 p-4 md:p-6">
            {/* Bloomberg-style command bar */}
            <div className="terminal-commandbar flex flex-wrap items-center gap-2 px-3 py-1.5">
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  runCommand(command);
                }}
              >
                <span className="shrink-0 font-mono text-[10px] text-amber-400">
                  &lt;HELP&gt;
                </span>
                <input
                  value={command}
                  onChange={(e) => {
                    setCommand(e.target.value);
                    if (cmdError) setCmdError(null);
                  }}
                  placeholder="e.g. AAPL RMAP"
                  className="flex-1 max-w-[340px] rounded-sm border border-[#332200] bg-black px-2 py-1 font-mono text-[11px] uppercase text-amber-300 outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="rounded-sm border border-emerald-500/50 bg-emerald-900/40 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300 hover:bg-emerald-800/60"
                >
                  GO
                </button>
                {cmdError && (
                  <span className="font-mono text-[10px] text-red-400">{cmdError}</span>
                )}
              </form>
              <div className="ml-auto flex flex-wrap items-center gap-1">
                <span className="mr-1 font-mono text-[10px] text-zinc-500">FUNCTIONS:</span>
                {FUNCTIONS.map((f) => (
                  <button
                    key={f.code}
                    onClick={() =>
                      runCommand(f.requiresTicker ? `AAPL ${f.code}` : f.code)
                    }
                    title={`${f.label} — ${f.description}`}
                    className="rounded-sm border border-amber-500/40 bg-[#141005] px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300 hover:bg-[#1e1706]"
                  >
                    {f.code}
                  </button>
                ))}
              </div>
            </div>

            <LiveIndexTicker />
            <DashboardCanvas />
          </div>
        </div>
      </TooltipProvider>
    </ConfigProvider>
  );
};

export default Terminal;
