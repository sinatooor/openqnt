/**
 * LiveTradingPanel - Execute strategies with connected brokers
 * Features: Paper/Live mode, position management, real-time monitoring
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  Activity,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Settings,
  RefreshCw,
  Power,
  Loader2,
  Shield,
  Zap,
  Clock,
  Target,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useStrategyFlowStore, validateStrategy } from '../../store/strategyFlowStore';
import { generatePythonCode } from '../../generators/pythonGenerator';

interface Position {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  entry_price: number;
  current_price: number;
  pnl: number;
  pnl_pct: number;
  stop_loss?: number;
  take_profit?: number;
  opened_at: string;
}

interface StrategyStatus {
  running: boolean;
  mode: 'paper' | 'live';
  started_at?: string;
  trades_count: number;
  pnl: number;
  positions: Position[];
}

interface LiveTradingPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BROKERS = [
  { id: 'ig', name: 'IG Markets', connected: false },
  { id: 'ibkr', name: 'Interactive Brokers', connected: false },
  { id: 'paper', name: 'Paper Trading', connected: true },
];

export const LiveTradingPanel = ({ open, onOpenChange }: LiveTradingPanelProps) => {
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState('paper');
  const [status, setStatus] = useState<StrategyStatus | null>(null);
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // Risk settings
  const [maxPositionSize, setMaxPositionSize] = useState(0.1);
  const [maxDrawdown, setMaxDrawdown] = useState(500);
  const [maxDailyLoss, setMaxDailyLoss] = useState(200);
  const [riskPerTrade, setRiskPerTrade] = useState(2);

  const { nodes, edges, strategyName, isRunning, setIsRunning } = useStrategyFlowStore();

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  // Poll for status when strategy is running
  useEffect(() => {
    if (isRunning && open) {
      const interval = setInterval(fetchStatus, 5000);
      setPollingInterval(interval);
      return () => clearInterval(interval);
    } else if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [isRunning, open]);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/live/strategy/status`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  }, [backendUrl]);

  const startStrategy = async () => {
    if (nodes.length === 0) {
      toast.error('Add nodes to your strategy first');
      return;
    }

    // Validate strategy before starting
    const validation = validateStrategy(nodes, edges);
    if (!validation.isValid) {
      toast.error('Strategy validation failed', {
        description: validation.errors.join('. '),
      });
      return;
    }

    if (validation.warnings.length > 0) {
      toast.warning('Strategy has warnings', {
        description: validation.warnings[0],
      });
    }

    // Confirm if live mode
    if (isLiveMode) {
      // Alert dialog handles this
    }

    setIsStarting(true);

    try {
      const pythonCode = generatePythonCode(nodes, edges);

      const response = await fetch(`${backendUrl}/api/live/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'EURUSD', // Default symbol, can be made configurable
          python_code: pythonCode,
          trade_size: maxPositionSize,
          poll_interval: 60,
          broker: selectedBroker === 'paper' ? 'paper' : selectedBroker,
          live_mode: isLiveMode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Failed to start strategy');
      }

      setIsRunning(true);
      toast.success(`Strategy started in ${isLiveMode ? 'LIVE' : 'paper'} mode`);
      await fetchStatus();
    } catch (error) {
      console.error('Start error:', error);
      toast.error('Failed to start strategy', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsStarting(false);
    }
  };

  const stopStrategy = async () => {
    setIsStopping(true);

    try {
      const response = await fetch(`${backendUrl}/api/live/strategy/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to stop strategy');
      }

      setIsRunning(false);
      setStatus(null);
      toast.success('Strategy stopped');
    } catch (error) {
      console.error('Stop error:', error);
      toast.error('Failed to stop strategy');
    } finally {
      setIsStopping(false);
    }
  };

  const closePosition = async (positionId: string) => {
    try {
      const response = await fetch(`${backendUrl}/api/live/position/${positionId}/close`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to close position');
      }

      toast.success('Position closed');
      await fetchStatus();
    } catch (error) {
      toast.error('Failed to close position');
    }
  };

  const triggerPanic = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/panic`, {
        method: 'POST',
      });

      if (response.ok) {
        setIsRunning(false);
        setStatus(null);
        toast.success('Emergency stop triggered - all positions closed');
      }
    } catch (error) {
      toast.error('Panic stop failed');
    }
  };

  const formatDuration = (startedAt?: string) => {
    if (!startedAt) return '--:--:--';
    const diff = Date.now() - new Date(startedAt).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[700px] glass border-border/50 shadow-trading-lg p-0 flex flex-col">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Activity className="w-5 h-5 text-purple-400" />
              Live Trading
            </DialogTitle>
            {isRunning && (
              <Badge 
                variant="outline" 
                className={`animate-pulse font-semibold tracking-wide ${
                  isLiveMode 
                    ? 'bg-loss/20 text-loss border-loss/40' 
                    : 'bg-profit/20 text-profit border-profit/40'
                }`}
              >
                <Activity className="w-3 h-3 mr-1.5" />
                {isLiveMode ? 'LIVE' : 'PAPER'} TRADING
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {/* Mode Selection */}
            {!isRunning && (
              <div className="p-5 glass rounded-xl border border-border/50 shadow-trading space-y-5">
                <h4 className="font-medium flex items-center gap-2">
                  <Settings className="w-4 h-4 text-purple-400" />
                  Trading Configuration
                </h4>

                {/* Broker Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm font-medium">Broker</Label>
                    <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                      <SelectTrigger className="bg-muted/50 border-border/50 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass border-border/50">
                        {BROKERS.map(b => (
                          <SelectItem key={b.id} value={b.id} disabled={!b.connected && b.id !== 'paper'}>
                            <span className="flex items-center gap-2">
                              {b.name}
                              {b.connected && <CheckCircle2 className="w-3 h-3 text-profit" />}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm font-medium">Trading Mode</Label>
                    <div className="flex items-center gap-3 h-10 px-4 glass rounded-lg border border-border/50">
                      <span className={`text-sm font-medium transition-colors ${!isLiveMode ? 'text-profit' : 'text-muted-foreground'}`}>Paper</span>
                      <Switch
                        checked={isLiveMode}
                        onCheckedChange={setIsLiveMode}
                        className="data-[state=checked]:bg-loss"
                      />
                      <span className={`text-sm font-medium transition-colors ${isLiveMode ? 'text-loss' : 'text-muted-foreground'}`}>Live</span>
                    </div>
                  </div>
                </div>

                {isLiveMode && (
                  <div className="p-4 bg-loss/10 border border-loss/30 rounded-lg flex items-start gap-3 shadow-trading">
                    <AlertTriangle className="w-5 h-5 text-loss shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-loss mb-1">Live Trading Warning</p>
                      <p className="text-muted-foreground leading-relaxed">Real money will be at risk. Ensure your strategy is thoroughly backtested.</p>
                    </div>
                  </div>
                )}

                <Separator className="bg-border/50" />

                {/* Risk Settings */}
                <h4 className="font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  Risk Management
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm font-medium">Max Position Size</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={maxPositionSize}
                      onChange={(e) => setMaxPositionSize(parseFloat(e.target.value))}
                      className="bg-muted/50 border-border/50 h-10 trading-number focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70 text-sm">Risk Per Trade (%)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={riskPerTrade}
                      onChange={(e) => setRiskPerTrade(parseFloat(e.target.value))}
                      className="bg-[#1a1a1f] border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70 text-sm">Max Drawdown ($)</Label>
                    <Input
                      type="number"
                      value={maxDrawdown}
                      onChange={(e) => setMaxDrawdown(parseFloat(e.target.value))}
                      className="bg-[#1a1a1f] border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70 text-sm">Max Daily Loss ($)</Label>
                    <Input
                      type="number"
                      value={maxDailyLoss}
                      onChange={(e) => setMaxDailyLoss(parseFloat(e.target.value))}
                      className="bg-[#1a1a1f] border-white/10"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Status Dashboard (when running) */}
            {isRunning && status && (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-4 glass rounded-xl border border-border/50 text-center hover-lift">
                    <Clock className="w-5 h-5 mx-auto mb-1 text-purple-400" />
                    <div className="text-lg font-mono trading-number text-foreground">{formatDuration(status.started_at)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Runtime</div>
                  </div>
                  <div className="p-3 bg-[#252530] rounded-lg border border-white/10 text-center">
                    <Target className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                    <div className="text-lg font-bold trading-number text-foreground">{status.trades_count}</div>
                    <div className="text-xs text-muted-foreground mt-1">Trades</div>
                  </div>
                  <div className="p-3 bg-[#252530] rounded-lg border border-white/10 text-center">
                    <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-400" />
                    <div className={`text-lg font-bold trading-number ${status.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {status.pnl >= 0 ? '+' : ''}${status.pnl.toFixed(2)}
                    </div>
                    <div className="text-xs text-white/50">PnL</div>
                  </div>
                  <div className="p-3 bg-[#252530] rounded-lg border border-white/10 text-center">
                    <Activity className="w-5 h-5 mx-auto mb-1 text-orange-400" />
                    <div className="text-lg font-bold trading-number text-foreground">{status.positions.length}</div>
                    <div className="text-xs text-muted-foreground mt-1">Open Positions</div>
                  </div>
                </div>

                {/* Open Positions */}
                <div className="p-5 glass rounded-xl border border-border/50 shadow-trading">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    Open Positions
                  </h4>

                  {status.positions.length === 0 ? (
                    <div className="text-center py-6 text-white/40">
                      <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No open positions</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {status.positions.map((position) => (
                        <div
                          key={position.id}
                          className="flex items-center gap-4 p-3 bg-[#1a1a1f] rounded-lg border border-white/5"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{position.symbol}</span>
                              <Badge
                                variant="outline"
                                className={position.direction === 'long'
                                  ? 'bg-profit/20 text-profit border-profit/40'
                                  : 'bg-loss/20 text-loss border-loss/40'
                                }
                              >
                                {position.direction.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="text-xs text-white/50 mt-1">
                              Entry: ${position.entry_price.toFixed(4)} | Size: {position.size}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-semibold trading-number ${position.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                              {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                              <span className="text-xs ml-1.5 font-normal">({position.pnl_pct.toFixed(2)}%)</span>
                            </div>
                            <div className="text-xs text-muted-foreground trading-number">
                              Current: ${position.current_price.toFixed(4)}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => closePosition(position.id)}
                            className="border-white/10 text-red-400 hover:bg-red-500/10"
                          >
                            Close
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Control Buttons */}
            <div className="flex gap-3">
              {!isRunning ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={isStarting || nodes.length === 0}
                      className={`flex-1 h-12 font-semibold transition-all duration-200 ${
                        isLiveMode
                          ? 'bg-loss hover:bg-loss/90 shadow-trading hover:shadow-trading-lg'
                          : 'bg-profit hover:bg-profit/90 shadow-trading hover:shadow-trading-lg'
                      }`}
                    >
                      {isStarting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 mr-2" />
                          Start {isLiveMode ? 'Live' : 'Paper'} Trading
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  {isLiveMode && (
                    <AlertDialogContent className="bg-[#1a1a1f] border-white/10">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-400">
                          <AlertTriangle className="w-5 h-5" />
                          Confirm Live Trading
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-white/60">
                          You are about to start LIVE trading with real money. This action will execute real trades on your connected broker account. Are you sure you want to continue?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={startStrategy}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Start Live Trading
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  )}
                </AlertDialog>
              ) : (
                <>
                  <Button
                    onClick={stopStrategy}
                    disabled={isStopping}
                    variant="outline"
                    className="flex-1 h-12 border-white/10"
                  >
                    {isStopping ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Stopping...
                      </>
                    ) : (
                      <>
                        <Square className="w-5 h-5 mr-2" />
                        Stop Strategy
                      </>
                    )}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="h-12 bg-red-600 hover:bg-red-700 px-6">
                        <Power className="w-5 h-5 mr-2" />
                        PANIC
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-[#1a1a1f] border-white/10">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-400">
                          <AlertTriangle className="w-5 h-5" />
                          Emergency Stop
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-white/60">
                          This will immediately stop the strategy and close ALL open positions at market price.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={triggerPanic}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Confirm Emergency Stop
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>

            {nodes.length === 0 && !isRunning && (
              <p className="text-center text-sm text-muted-foreground">
                Add nodes to your strategy to enable trading
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default LiveTradingPanel;
