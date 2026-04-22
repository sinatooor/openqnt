/**
 * TerminalBmap Page — the Bloomberg BMAP (Commodity Map) function.
 *
 * URL: /terminal/bmap
 *
 * Displays a global asset map covering oil/gas fields, pipelines,
 * refineries, LNG terminals, mines, ports, vessels, wind farms and live
 * storms, rendered with Mapbox GL JS (dark-v11 style, 3D globe).
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfigProvider, theme as antTheme } from 'antd';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '../stores/authStore';
import BmapView from '@/features/terminal/bmap/BmapView';

export default function TerminalBmap() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

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
            <div className="terminal-commandbar flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-amber-400">
                  BMAP &lt;GO&gt;
                </span>
                <span className="text-[10px] text-zinc-500">|</span>
                <span className="text-[10px] text-zinc-500">
                  Global Commodity Asset Map
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigate('/terminal')}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-300 hover:bg-zinc-800"
                >
                  &larr; MENU
                </button>
                <span className="ml-2 font-mono text-[10px] text-amber-400">P170</span>
              </div>
            </div>

            <BmapView />
          </div>
        </div>
      </TooltipProvider>
    </ConfigProvider>
  );
}
