/**
 * TerminalShell — small reusable wrapper used by the new Bloomberg-style
 * function pages (FA, RV, DVD, N, WATCH, MOST, TOP, EQS). Keeps each page
 * to a few lines so we don't end up with eight near-identical files.
 */

import { ReactNode } from 'react';
import { ConfigProvider, theme as antTheme } from 'antd';
import { TooltipProvider } from '@/components/ui/tooltip';

interface TerminalShellProps {
  title: string;
  code: string;
  children: ReactNode;
}

export default function TerminalShell({ title, code, children }: TerminalShellProps) {
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
            <div className="terminal-commandbar flex items-center gap-2 px-3 py-1.5">
              <span className="font-mono text-[10px] text-amber-400">{title}</span>
              <span className="ml-auto rounded-sm border border-amber-500/50 bg-[#141005] px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                {code}
              </span>
            </div>
            {children}
          </div>
        </div>
      </TooltipProvider>
    </ConfigProvider>
  );
}
