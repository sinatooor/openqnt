import { useState } from "react";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input, Label, Tooltip, TooltipContent, TooltipTrigger, Separator, Badge, Card, CardContent } from "@/components/ui";
import { X, TrendingUp, History, Zap, AlertCircle, CheckCircle2, Play, Square, Loader2, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { TourTriggerButton } from "./GuidedTour";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";

interface BacktestResult {
  totalReturn: number;
  winRate: number;
  totalTrades: number;
  maxDrawdown: number;
  finalBalance: number;
}

interface SettingsPanelProps {
  onStartTour?: () => void;
  onToggleAI?: () => void;
  onClose?: () => void;
  leverage?: string;
  onLeverageChange?: (value: string) => void;
  getWorkspaceXml?: () => string | null;
}

export const SettingsPanel = ({ onStartTour, onToggleAI, onClose, leverage = "1", onLeverageChange, getWorkspaceXml }: SettingsPanelProps) => {
  const [mode, setMode] = useState<"backtest" | "live">("backtest");
  const [tradingSymbol, setTradingSymbol] = useState("EURUSD");
  const [isConnected, setIsConnected] = useState(false);
  const [capitalAllocation, setCapitalAllocation] = useState("10000");

  // Backtest state
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2024-03-31");

  // Live state
  const [isStrategyRunning, setIsStrategyRunning] = useState(false);
  const [isStartingStrategy, setIsStartingStrategy] = useState(false);
  const [strategyStatus, setStrategyStatus] = useState<any>(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  const handleRunBacktest = async () => {
    if (!getWorkspaceXml) {
      toast.error("No workspace connected");
      return;
    }
    const xml = getWorkspaceXml();
    if (!xml) {
      toast.error("Add blocks to workspace first");
      return;
    }

    setIsBacktesting(true);
    setBacktestResult(null);

    try {
      const response = await fetch(`${backendUrl}/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceXml: xml,
          symbol: tradingSymbol,
          startDate,
          endDate,
          initialBalance: parseFloat(capitalAllocation),
          tradeSize: parseFloat(capitalAllocation)
        })
      });

      const data = await response.json();

      if (data.success) {
        setBacktestResult({
          totalReturn: ((data.final_balance - data.initial_balance) / data.initial_balance) * 100,
          winRate: data.metrics.win_rate,
          totalTrades: data.metrics.total_trades,
          maxDrawdown: data.metrics.max_drawdown,
          finalBalance: data.final_balance
        });
        toast.success("Backtest completed!");
      } else {
        toast.error("Backtest failed", { description: data.error });
      }
    } catch (error) {
      toast.error("Backend not reachable");
    } finally {
      setIsBacktesting(false);
    }
  };

  const handleStartStrategy = async () => {
    if (!getWorkspaceXml) {
      toast.error("No workspace connected");
      return;
    }
    const xml = getWorkspaceXml();
    if (!xml) {
      toast.error("Add blocks to workspace first");
      return;
    }

    setIsStartingStrategy(true);
    try {
      const response = await fetch(`${backendUrl}/strategy/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceXml: xml,
          symbol: tradingSymbol,
          tradeSize: parseFloat(capitalAllocation) / 100000,
          pollInterval: 60
        }),
      });
      const data = await response.json();
      if (data.success) {
        setIsStrategyRunning(true);
        setStrategyStatus(data.status);
        toast.success("Strategy launched!", { description: `Running on ${tradingSymbol}` });
      } else {
        toast.error("Failed to start", { description: data.error });
      }
    } catch (e) {
      toast.error("Backend not reachable");
    } finally {
      setIsStartingStrategy(false);
    }
  };

  const handleStopStrategy = async () => {
    try {
      const response = await fetch(`${backendUrl}/strategy/stop`, { method: "POST" });
      const data = await response.json();
      if (data.success) {
        setIsStrategyRunning(false);
        setStrategyStatus(null);
        toast.success("Strategy stopped");
      }
    } catch (e) {
      toast.error("Error stopping strategy");
    }
  };

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="font-semibold text-foreground text-sm">Strategy</h2>
          <div className="flex items-center gap-1">
            {onToggleAI && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onToggleAI} variant="outline" size="icon" className="h-7 w-7">
                    <Wand2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>AI Assistant</p></TooltipContent>
              </Tooltip>
            )}
            {onStartTour && (
              <TourTriggerButton onClick={onStartTour} className="h-7 w-7" />
            )}
            {onClose && (
              <Button onClick={onClose} variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-2">
          <Button
            variant={mode === "backtest" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("backtest")}
            className="flex-1"
          >
            <History className="w-4 h-4 mr-2" />
            Backtest
          </Button>
          <Button
            variant={mode === "live" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMode("live")}
            className="flex-1"
          >
            <Zap className="w-4 h-4 mr-2" />
            Live
          </Button>
        </div>
      </div>

      {/* Content based on mode */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Common: Symbol Selection */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Symbol</label>
          <Select value={tradingSymbol} onValueChange={setTradingSymbol}>
            <SelectTrigger className="bg-secondary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EURUSD">EUR/USD</SelectItem>
              <SelectItem value="GBPUSD">GBP/USD</SelectItem>
              <SelectItem value="USDJPY">USD/JPY</SelectItem>
              <SelectItem value="BTCUSD">BTC/USD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Capital ($)</label>
          <Input
            type="number"
            value={capitalAllocation}
            onChange={(e) => setCapitalAllocation(e.target.value)}
            className="bg-secondary"
          />
        </div>

        {mode === "backtest" ? (
          <>
            {/* Backtest Settings */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-secondary text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-secondary text-xs"
                />
              </div>
            </div>

            {/* Backtest Results */}
            {backtestResult && (
              <Card className="bg-secondary/50">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Results</span>
                    <Badge variant={backtestResult.totalReturn >= 0 ? "default" : "destructive"}>
                      {backtestResult.totalReturn >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                      {backtestResult.totalReturn.toFixed(2)}%
                    </Badge>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Win Rate</span>
                      <p className="font-medium">{backtestResult.winRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Trades</span>
                      <p className="font-medium">{backtestResult.totalTrades}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Max Drawdown</span>
                      <p className="font-medium text-red-400">{backtestResult.maxDrawdown.toFixed(2)}%</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Final Balance</span>
                      <p className="font-medium">${backtestResult.finalBalance.toFixed(0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <>
            {/* Live Mode */}
            <Card className="bg-secondary/50">
              <CardContent className="p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  {isStrategyRunning ? (
                    <Badge className="bg-green-500 animate-pulse">
                      <Play className="w-3 h-3 mr-1" />
                      Running
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Stopped
                    </Badge>
                  )}
                </div>

                {isStrategyRunning && strategyStatus && (
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Position</span>
                      <span>{strategyStatus.current_position || 'None'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Signal</span>
                      <span>{strategyStatus.last_signal || 'None'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trades</span>
                      <span>{strategyStatus.trade_count || 0}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Action Button */}
      <div className="p-4 border-t border-border">
        {mode === "backtest" ? (
          <Button
            onClick={handleRunBacktest}
            disabled={isBacktesting}
            className="w-full bg-purple-600 hover:bg-purple-700 font-semibold py-5"
          >
            {isBacktesting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running Backtest...
              </>
            ) : (
              <>
                <BarChart3 className="w-4 h-4 mr-2" />
                Run Backtest
              </>
            )}
          </Button>
        ) : isStrategyRunning ? (
          <Button
            onClick={handleStopStrategy}
            variant="destructive"
            className="w-full font-semibold py-5"
          >
            <Square className="w-4 h-4 mr-2" />
            Stop Strategy
          </Button>
        ) : (
          <Button
            onClick={handleStartStrategy}
            disabled={isStartingStrategy}
            className="w-full bg-green-600 hover:bg-green-700 font-semibold py-5"
          >
            {isStartingStrategy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Launch Strategy
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
