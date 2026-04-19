/**
 * TerminalGip Page — the Bloomberg GIP (Intraday Graph) function.
 *
 * URL: /terminal/gip  or  /terminal/gip/:ticker
 *
 * Carries the Bloomberg-style command input, passes the ticker and
 * interval/indicator state through the `gipTool` so data rendered in the
 * UI and data delivered to agents stay bit-identical.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ConfigProvider, theme as antTheme } from 'antd';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '../stores/authStore';
import GipView, { type ChartType } from '@/features/terminal/gip/GipView';
import { gipTool } from '@/features/terminal/gip/tool';
import type { GipInterval } from '@/features/terminal/gip/mockData';
import AgentContextDrawer from '@/features/terminal/agentTools/AgentContextDrawer';

const DEFAULT_TICKER = 'AAPL';

export default function TerminalGip() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const { ticker: urlTicker } = useParams<{ ticker?: string }>();
  const [searchParams] = useSearchParams();
  const queryTicker = searchParams.get('ticker') || undefined;

  const initialTicker = (urlTicker || queryTicker || DEFAULT_TICKER).toUpperCase();
  const [ticker, setTicker] = useState(initialTicker);
  const [input, setInput] = useState(initialTicker);
  const [refreshSalt, setRefreshSalt] = useState(0);

  const [interval, setInterval] = useState<GipInterval>('5m');
  const [chartType, setChartType] = useState<ChartType>('candles');
  const [extendedHours, setExtendedHours] = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [showSma, setShowSma] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const next = (urlTicker || queryTicker || DEFAULT_TICKER).toUpperCase();
    setTicker(next);
    setInput(next);
  }, [urlTicker, queryTicker]);

  const submit = useMemo(
    () => (value: string) => {
      const clean = value.trim().toUpperCase();
      if (!clean) return;
      setTicker(clean);
      navigate(`/terminal/gip/${encodeURIComponent(clean)}`, { replace: true });
    },
    [navigate],
  );

  const data = useMemo(
    () =>
      gipTool.fetch({
        ticker,
        interval,
        extendedHours,
        seedSalt: refreshSalt,
      }),
    [ticker, interval, extendedHours, refreshSalt],
  );

  return (
    <ConfigProvider
      theme={{
        algorithm: antTheme.darkAlgorithm,
        token: {
          colorPrimary: '#ff9f1a',
          colorBgContainer: 'transparent',
          colorText: '#e2e8f0',
          colorTextSecondary: '#94a3b8',
          borderRadius: 2,
          fontSize: 13,
        },
      }}
    >
      <TooltipProvider delayDuration={200}>
        <div className="min-h-screen bg-background pt-14">
          <div className="w-full max-w-none space-y-2 p-4 md:p-6">
            {/* Bloomberg-style command input */}
            <div className="terminal-commandbar flex flex-wrap items-center gap-2 px-3 py-1.5">
              <span className="font-mono text-[10px] text-amber-400">
                &lt;HELP&gt; for explanation
              </span>
              <div className="flex flex-1 items-center gap-1">
                <form
                  className="flex flex-1 items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(input);
                  }}
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value.toUpperCase())}
                    className="w-40 rounded-sm border border-[#332200] bg-black px-2 py-1 font-mono text-[11px] text-amber-300 outline-none focus:border-amber-500"
                    placeholder="TICKER"
                    autoFocus
                  />
                  <span className="font-mono text-[10px] text-zinc-500">&lt;EQUITY&gt;</span>
                  <span className="rounded-sm border border-amber-500/50 bg-[#141005] px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                    GIP
                  </span>
                  <button
                    type="submit"
                    className="rounded-sm border border-emerald-500/50 bg-emerald-900/40 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300 hover:bg-emerald-800/60"
                  >
                    GO
                  </button>
                </form>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <AgentContextDrawer
                  toolCode="GIP"
                  input={{ ticker, interval, extendedHours, seedSalt: refreshSalt }}
                />
                <button
                  onClick={() => setRefreshSalt((s) => s + 1)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-300 hover:bg-zinc-800"
                >
                  REFRESH
                </button>
                <span className="font-mono text-[10px] text-amber-400">P804</span>
              </div>
            </div>

            <GipView
              data={data}
              interval={interval}
              chartType={chartType}
              extendedHours={extendedHours}
              showVwap={showVwap}
              showSma={showSma}
              onChangeInterval={setInterval}
              onChangeChartType={setChartType}
              onToggleExtendedHours={setExtendedHours}
              onToggleVwap={setShowVwap}
              onToggleSma={setShowSma}
            />
          </div>
        </div>
      </TooltipProvider>
    </ConfigProvider>
  );
}
