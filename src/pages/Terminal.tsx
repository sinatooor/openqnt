/**
 * Terminal Page – Modular widget canvas (moved from Dashboard).
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ConfigProvider, theme as antTheme } from 'antd';
import { TooltipProvider } from '@/components/ui/tooltip';
import DashboardCanvas from '../features/dashboard/canvas/DashboardCanvas';

const Terminal = () => {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated]);

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
            <div className="terminal-fkeybar flex items-center gap-1 overflow-x-auto px-2 py-1 no-scrollbar">
              {['SPX', 'NDX', 'DJI', 'DAX', 'VIX', 'US10Y', 'GOLD', 'OIL', 'BTC'].map((sym) => (
                <span
                  key={sym}
                  className="rounded-sm border border-zinc-800 bg-black px-2 py-0.5 text-[10px] text-zinc-400"
                >
                  {sym}
                </span>
              ))}
            </div>
            <DashboardCanvas />
          </div>
        </div>
      </TooltipProvider>
    </ConfigProvider>
  );
};

export default Terminal;
