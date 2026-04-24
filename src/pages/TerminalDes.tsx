/**
 * TerminalDes Page — the Bloomberg DES (Company Description) function.
 *
 * URL: /terminal/des or /terminal/des/:ticker
 *
 * Like the other terminal function pages, this one exposes an
 * "AGENT CONTEXT" drawer so any quant agent (or a human operator) can see
 * / copy the exact Markdown payload the DES tool will inject into an LLM.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ConfigProvider, theme as antTheme } from 'antd';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '../stores/authStore';
import DesView from '@/features/terminal/des/DesView';
import AgentContextDrawer from '@/features/terminal/agentTools/AgentContextDrawer';
import {
  useDefaultTerminalSymbol,
  useSyncTerminalSymbol,
} from '@/features/terminal/useSyncTerminalSymbol';

const DEFAULT_TICKER = 'AAPL';

export default function TerminalDes() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const { ticker: urlTicker } = useParams<{ ticker?: string }>();
  const [searchParams] = useSearchParams();
  const queryTicker = searchParams.get('ticker') || undefined;

  const fallbackTicker = useDefaultTerminalSymbol(DEFAULT_TICKER);
  const initialTicker = (urlTicker || queryTicker || fallbackTicker).toUpperCase();
  const [ticker, setTicker] = useState(initialTicker);
  const [input, setInput] = useState(initialTicker);
  const [refreshSalt, setRefreshSalt] = useState(0);
  useSyncTerminalSymbol(ticker);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const next = (urlTicker || queryTicker || fallbackTicker).toUpperCase();
    setTicker(next);
    setInput(next);
  }, [urlTicker, queryTicker, fallbackTicker]);

  const submit = useMemo(
    () => (value: string) => {
      const clean = value.trim().toUpperCase();
      if (!clean) return;
      setTicker(clean);
      navigate(`/terminal/des/${encodeURIComponent(clean)}`, { replace: true });
    },
    [navigate],
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
                    DES
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
                  toolCode="DES"
                  input={{ ticker, seedSalt: refreshSalt }}
                />
                <button
                  onClick={() => setRefreshSalt((s) => s + 1)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-300 hover:bg-zinc-800"
                >
                  REFRESH
                </button>
                <span className="font-mono text-[10px] text-amber-400">P001</span>
              </div>
            </div>

            <DesView ticker={ticker} seedSalt={refreshSalt} />
          </div>
        </div>
      </TooltipProvider>
    </ConfigProvider>
  );
}
