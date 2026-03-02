import { memo } from 'react';
import {
  HelpCircle,
  BookOpen,
  Video,
  MessageCircle,
  ExternalLink,
  Keyboard,
  Lightbulb,
  Zap,
  Code,
  Github,
  FileText,
  FlaskConical,
  BarChart3,
  Beaker,
} from 'lucide-react';
import { WindowModal } from './WindowModal';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KEYBOARD_SHORTCUTS = [
  { keys: ['⌘', 'K'], description: 'Open command palette / search nodes' },
  { keys: ['⌘', 'S'], description: 'Save strategy' },
  { keys: ['⌘', 'Z'], description: 'Undo' },
  { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
  { keys: ['Delete'], description: 'Delete selected nodes' },
  { keys: ['⌘', 'A'], description: 'Select all nodes' },
  { keys: ['⌘', 'C'], description: 'Copy selected nodes' },
  { keys: ['⌘', 'V'], description: 'Paste nodes' },
  { keys: ['Space'], description: 'Pan canvas (hold)' },
  { keys: ['Scroll'], description: 'Zoom in/out' },
  { keys: ['Escape'], description: 'Deselect / Close modal' },
];

const QUICK_TIPS = [
  {
    icon: Zap,
    title: 'Drag & Drop Nodes',
    description: 'Drag nodes from the left sidebar onto the canvas to add them to your strategy.'
  },
  {
    icon: Code,
    title: 'Connect Nodes',
    description: 'Drag from an output handle to an input handle to create connections between nodes.'
  },
  {
    icon: Lightbulb,
    title: 'AI Assistant',
    description: 'Use the AI chat to describe your strategy in plain English and get node suggestions.'
  },
];

const RESOURCES = [
  { icon: BookOpen, label: 'Documentation', href: '#', description: 'Complete guide to building strategies' },
  { icon: Video, label: 'Video Tutorials', href: '#', description: 'Step-by-step visual guides' },
  { icon: Github, label: 'GitHub', href: '#', description: 'Source code and contributions' },
  { icon: MessageCircle, label: 'Community', href: '#', description: 'Join our Discord community' },
  { icon: FileText, label: 'API Reference', href: '#', description: 'Technical documentation' },
];

const QUANT_STRATEGIES_HELP = [
  { name: 'MACD Oscillator', desc: 'Momentum crossover between fast/slow moving averages.', params: 'shortWindow, longWindow, signalWindow' },
  { name: 'Pair Trading', desc: 'Statistical arbitrage between two cointegrated assets.', params: 'tickerB, lookback, entryZ, exitZ' },
  { name: 'Heikin-Ashi', desc: 'Japanese candlestick variant filtering noise for trends.', params: 'None' },
  { name: 'Bollinger Bands', desc: 'Mean-reversion using upper/lower band signals.', params: 'period, stdDev' },
  { name: 'RSI Pattern', desc: 'Overbought/oversold signals from Relative Strength Index.', params: 'period, overbought, oversold' },
  { name: 'Parabolic SAR', desc: 'Stop-and-reverse trend following indicator.', params: 'af, maxAf' },
  { name: 'Awesome Oscillator', desc: 'Upgraded MACD using midpoint price for momentum.', params: 'shortPeriod, longPeriod' },
  { name: 'Dual Thrust', desc: 'Opening range breakout with dynamic thresholds.', params: 'lookback, k1, k2' },
  { name: 'Shooting Star', desc: 'Bearish candlestick reversal pattern recognition.', params: 'bodyRatio, shadowRatio' },
  { name: 'Options Straddle', desc: 'Long straddle payoff simulation for volatility plays.', params: 'strikePrice, callPremium, putPremium' },
  { name: 'VIX Calculator', desc: 'Realized volatility index from historical prices.', params: 'windowDays' },
];

export const HelpModal = memo(({ open, onOpenChange }: HelpModalProps) => {
  return (
    <WindowModal
      open={open}
      onOpenChange={onOpenChange}
      title="Help & Documentation"
      icon={<HelpCircle className="w-4 h-4" />}
      defaultWidth={600}
      defaultHeight={500}
      minWidth={400}
      minHeight={300}
    >
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Quick Tips */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              Quick Tips
            </h3>
            <div className="grid gap-3">
              {QUICK_TIPS.map((tip, index) => (
                <div
                  key={index}
                  className="flex gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50"
                >
                  <div className="p-2 rounded-md bg-primary/10">
                    <tip.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-foreground">{tip.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{tip.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-blue-500" />
              Keyboard Shortcuts
            </h3>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              {KEYBOARD_SHORTCUTS.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-3 py-2 even:bg-secondary/30"
                >
                  <span className="text-xs text-muted-foreground">{shortcut.description}</span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((key, i) => (
                      <kbd
                        key={i}
                        className="px-2 py-0.5 text-[10px] font-medium bg-secondary border border-border rounded"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Resources */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-green-500" />
              Resources
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {RESOURCES.map((resource, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto p-3 justify-start gap-3 border-border/50 hover:bg-secondary/50"
                  onClick={() => window.open(resource.href, '_blank')}
                >
                  <resource.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-medium">{resource.label}</div>
                    <div className="text-[10px] text-muted-foreground">{resource.description}</div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground/50 ml-auto shrink-0" />
                </Button>
              ))}
            </div>
          </section>

          {/* Quant Tools Guide */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-purple-500" />
              Quant Tools Guide
            </h3>

            <div className="space-y-4">
              {/* QuantStats */}
              <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-teal-400" />
                  <h4 className="text-sm font-medium">QuantStats — Portfolio Analytics</h4>
                </div>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Open <strong>Research & Quant Tools</strong> from the strategy builder toolbar (flask icon).</li>
                  <li>Click the <strong>QuantStats</strong> tab (first tab).</li>
                  <li>Enter a <strong>ticker</strong> (e.g. AAPL), optional <strong>benchmark</strong> (default SPY), and date range.</li>
                  <li>Click <strong>Analyze</strong> — the system fetches returns and computes 20+ metrics including Sharpe, Sortino, CAGR, max drawdown, win rate, VaR, Kelly criterion, and more.</li>
                  <li>Scroll down to see <strong>charts</strong>: performance snapshot, drawdown, monthly heatmap, return distribution, rolling Sharpe/volatility/beta.</li>
                </ol>
                <p className="text-[10px] text-muted-foreground/70 mt-2">Powered by <span className="text-teal-400">ranaroussi/quantstats</span></p>
              </div>

              {/* Quant Strategies */}
              <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Beaker className="w-4 h-4 text-orange-400" />
                  <h4 className="text-sm font-medium">Quant Strategies — Backtest Library</h4>
                </div>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside mb-3">
                  <li>Switch to the <strong>Strategies</strong> tab.</li>
                  <li>Pick a <strong>strategy</strong> from the dropdown — parameters update automatically with sensible defaults.</li>
                  <li>Enter a <strong>ticker</strong> and date range, adjust parameters if needed.</li>
                  <li>Click <strong>Run Backtest</strong> — the backend downloads data, computes signals, runs a vectorized backtest, and returns metrics + an equity curve chart.</li>
                </ol>

                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <table className="w-full text-[10px]">
                    <thead><tr className="bg-secondary/80 text-muted-foreground"><th className="text-left px-2 py-1">Strategy</th><th className="text-left px-2 py-1">Description</th><th className="text-left px-2 py-1">Parameters</th></tr></thead>
                    <tbody>
                      {QUANT_STRATEGIES_HELP.map((s, i) => (
                        <tr key={i} className="even:bg-secondary/30 border-t border-border/30">
                          <td className="px-2 py-1 font-medium text-foreground whitespace-nowrap">{s.name}</td>
                          <td className="px-2 py-1 text-muted-foreground">{s.desc}</td>
                          <td className="px-2 py-1 font-mono text-muted-foreground/80">{s.params}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-2">Powered by <span className="text-orange-400">je-suis-tm/quant-trading</span></p>
              </div>
            </div>
          </section>

          {/* Support */}
          <section className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground text-center">
              Need more help? Contact us at{' '}
              <a href="mailto:support@fyer.io" className="text-primary hover:underline">
                support@fyer.io
              </a>
            </p>
          </section>
        </div>
      </ScrollArea>
    </WindowModal>
  );
});

HelpModal.displayName = 'HelpModal';
