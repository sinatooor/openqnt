import { useState } from "react";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, Input, Label, Tooltip, TooltipContent, TooltipTrigger, Separator, Badge, Card, CardContent } from "@/components/ui";
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
  // Advanced metrics (optional as they might not be present in all engines)
  cagr?: number;
  netProfit?: number;
  profitFactor?: number;
  expectancy?: number;
  payoffRatio?: number;
  maxDrawdownDuration?: string;
  calmarRatio?: number;
  sharpeRatio?: number;
  sortinoRatio?: number;
  lossRate?: number;
  avgHoldingTime?: string;
  rMultipleDist?: string;
  returnVolatility?: number;
  skewness?: number;
  kurtosis?: number;
  slippageImpact?: number;
  transactionCostImpact?: number;
  robustnessScore?: number;
  generalizationScore?: number;
  var95?: number;
  cvar95?: number;
  sqn?: number;
  kellyCriterion?: number;
  // Optimization
  bestParams?: Record<string, any>;
  bestMetricValue?: number;
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
  const [engine, setEngine] = useState<"frontend" | "backtesting.py" | "nautilus" | "ai_simulation">("frontend");

  // Optimization state
  const [isOptimization, setIsOptimization] = useState(false);
  const [optMetric, setOptMetric] = useState("Return [%]");
  const [optMethod, setOptMethod] = useState("grid");
  const [aiModel, setAiModel] = useState("deepseek");

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
          tradeSize: parseFloat(capitalAllocation),
          engine: engine,
          optimize: isOptimization,
          opt_metric: optMetric,
          opt_method: optMethod,
          ai_model: aiModel
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setBacktestResult({
          totalReturn: ((data.final_balance - data.initial_balance) / data.initial_balance) * 100,
          winRate: data.metrics.win_rate,
          totalTrades: data.metrics.total_trades,
          maxDrawdown: data.metrics.max_drawdown,
          finalBalance: data.final_balance || (data.initial_balance * (1 + (data.metrics.total_return / 100))),
          // Map advanced metrics
          cagr: data.metrics.cagr,
          netProfit: data.metrics.net_profit,
          profitFactor: data.metrics.profit_factor,
          expectancy: data.metrics.expectancy,
          payoffRatio: data.metrics.payoff_ratio,
          maxDrawdownDuration: data.metrics.max_drawdown_duration,
          calmarRatio: data.metrics.calmar_ratio,
          sharpeRatio: data.metrics.sharpe_ratio,
          sortinoRatio: data.metrics.sortino_ratio,
          lossRate: data.metrics.loss_rate,
          avgHoldingTime: data.metrics.avg_holding_time,
          rMultipleDist: data.metrics.r_multiple_dist,
          returnVolatility: data.metrics.return_volatility,
          skewness: data.metrics.skewness,
          kurtosis: data.metrics.kurtosis,
          slippageImpact: data.metrics.slippage_impact,
          transactionCostImpact: data.metrics.transaction_cost_impact,
          robustnessScore: data.metrics.robustness_score,
          generalizationScore: data.metrics.generalization_score,
          var95: data.metrics.var_95,
          cvar95: data.metrics.cvar_95,
          sqn: data.metrics.sqn,
          kellyCriterion: data.metrics.kelly_criterion,
          bestParams: data.best_params,
          bestMetricValue: data.best_metric_value
        });
        toast.success("Backtest completed!");
      } else {
        toast.error("Backtest failed", { description: data.error });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Backtest error:", error);
      toast.error("Backtest failed", { description: message });
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

  const MetricItem = ({ label, value, tooltip, valueClassName }: { label: string, value: string | number, tooltip: string, valueClassName?: string }) => (
    <div className="flex flex-col">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground cursor-help border-b border-dotted border-muted-foreground/30 w-fit">{label}</span>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
      <p className={`font-medium ${valueClassName || ''}`}>{value}</p>
    </div>
  );

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
              <SelectGroup>
                <SelectLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">Forex</SelectLabel>
                <SelectItem value="EURUSD">EUR/USD</SelectItem>
                <SelectItem value="GBPUSD">GBP/USD</SelectItem>
                <SelectItem value="USDJPY">USD/JPY</SelectItem>
                <SelectItem value="AUDUSD">AUD/USD</SelectItem>
                <SelectItem value="USDCAD">USD/CAD</SelectItem>
                <SelectItem value="USDCHF">USD/CHF</SelectItem>
              </SelectGroup>
              <Separator className="my-1" />
              <SelectGroup>
                <SelectLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">Stocks (US)</SelectLabel>
                <SelectItem value="AAPL">Apple (AAPL)</SelectItem>
                <SelectItem value="MSFT">Microsoft (MSFT)</SelectItem>
                <SelectItem value="GOOGL">Google (GOOGL)</SelectItem>
                <SelectItem value="AMZN">Amazon (AMZN)</SelectItem>
                <SelectItem value="TSLA">Tesla (TSLA)</SelectItem>
                <SelectItem value="NVDA">NVIDIA (NVDA)</SelectItem>
                <SelectItem value="META">Meta (META)</SelectItem>
                <SelectItem value="SPY">S&P 500 ETF (SPY)</SelectItem>
              </SelectGroup>
              <Separator className="my-1" />
              <SelectGroup>
                <SelectLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">Crypto</SelectLabel>
                <SelectItem value="BTCUSD">Bitcoin (BTC)</SelectItem>
                <SelectItem value="ETHUSD">Ethereum (ETH)</SelectItem>
                <SelectItem value="SOLUSD">Solana (SOL)</SelectItem>
              </SelectGroup>
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

            {/* Engine Selection */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Backtest Engine</label>
              <Select value={engine} onValueChange={(v: any) => setEngine(v)}>
                <SelectTrigger className="bg-secondary h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="frontend">Simple (Fast)</SelectItem>
                  <SelectItem value="backtesting.py">Python (AI-Generated)</SelectItem>
                  <SelectItem value="nautilus">NautilusTrader (Institutional)</SelectItem>
                  <SelectItem value="ai_simulation">AI Simulation (LLM)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* AI Model Selection */}
            {engine === "ai_simulation" && (
              <div className="mt-2">
                <label className="text-xs text-muted-foreground mb-1 block">AI Model</label>
                <Select value={aiModel} onValueChange={setAiModel}>
                  <SelectTrigger className="bg-secondary h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deepseek">DeepSeek (Finance Specialized)</SelectItem>
                    <SelectItem value="gemini">Google Gemini 2.0 Flash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Optimization Settings */}
            {(engine === "frontend" || engine === "backtesting.py" || engine === "nautilus") && (
              <div className="space-y-2 border-t border-border pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Optimization</label>
                  <Button
                    variant={isOptimization ? "default" : "ghost"}
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => setIsOptimization(!isOptimization)}
                  >
                    {isOptimization ? "Enabled" : "Enable"}
                  </Button>
                </div>

                {isOptimization && (
                  <div className="space-y-2 animate-in slide-in-from-top duration-200">
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Maximize Metric</label>
                      <Select value={optMetric} onValueChange={setOptMetric}>
                        <SelectTrigger className="bg-secondary h-7 text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Return [%]">Total Return</SelectItem>
                          <SelectItem value="Sharpe Ratio">Sharpe Ratio</SelectItem>
                          <SelectItem value="Sortino Ratio">Sortino Ratio</SelectItem>
                          <SelectItem value="Calmar Ratio">Calmar Ratio</SelectItem>
                          <SelectItem value="SQN">System Quality Number</SelectItem>
                          <SelectItem value="Win Rate [%]">Win Rate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Method</label>
                      <Select value={optMethod} onValueChange={setOptMethod}>
                        <SelectTrigger className="bg-secondary h-7 text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grid">Grid Search (Exhaustive)</SelectItem>
                          <SelectItem value="skopt">Bayesian (Skopt)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Backtest Results */}
            {backtestResult && (
              <Card className="bg-secondary/50">
                <CardContent className="p-3 space-y-2">
                  {/* Optimization Results */}
                  {backtestResult.bestParams && (
                    <div className="mb-4 p-2 bg-primary/10 rounded-md border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-3 h-3 text-primary" />
                        <span className="text-xs font-semibold text-primary">Optimization Results</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Best {optMetric}</span>
                          <span className="font-bold text-primary">{backtestResult.bestMetricValue?.toFixed(2)}</span>
                        </div>
                        <Separator className="my-1 bg-primary/20" />
                        {Object.entries(backtestResult.bestParams).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-[10px]">
                            <span className="text-muted-foreground">{key}</span>
                            <span className="font-mono">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Results</span>
                    <Badge variant={backtestResult.totalReturn >= 0 ? "default" : "destructive"}>
                      {backtestResult.totalReturn >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                      {backtestResult.totalReturn.toFixed(2)}%
                    </Badge>
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    {/* Performance & Return Quality */}
                    <div>
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Performance</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <MetricItem label="Win Rate" value={`${backtestResult.winRate.toFixed(1)}%`} tooltip="Percentage of profitable trades" />
                        <MetricItem label="Trades" value={backtestResult.totalTrades} tooltip="Total number of executed trades" />
                        <MetricItem label="Final Balance" value={`$${backtestResult.finalBalance.toFixed(0)}`} tooltip="Ending account balance" />
                        {backtestResult.cagr !== undefined && <MetricItem label="CAGR" value={`${backtestResult.cagr}%`} tooltip="Compounded Annual Growth Rate" />}
                        {backtestResult.profitFactor !== undefined && <MetricItem label="Profit Factor" value={backtestResult.profitFactor} tooltip="Gross Profit / Gross Loss" />}
                        {backtestResult.expectancy !== undefined && <MetricItem label="Expectancy" value={`$${backtestResult.expectancy}`} tooltip="Average profit per trade" />}
                      </div>
                    </div>

                    {/* Risk & Drawdown */}
                    <div>
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Risk</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <MetricItem label="Max Drawdown" value={`${backtestResult.maxDrawdown.toFixed(2)}%`} valueClassName="text-red-400" tooltip="Maximum peak-to-valley decline" />
                        {backtestResult.sharpeRatio !== undefined && <MetricItem label="Sharpe Ratio" value={backtestResult.sharpeRatio.toFixed(2)} tooltip="Risk-adjusted return (Return / Volatility)" />}
                        {backtestResult.sortinoRatio !== undefined && <MetricItem label="Sortino Ratio" value={backtestResult.sortinoRatio.toFixed(2)} tooltip="Return / Downside Deviation" />}
                        {backtestResult.calmarRatio !== undefined && <MetricItem label="Calmar Ratio" value={backtestResult.calmarRatio.toFixed(2)} tooltip="CAGR / Max Drawdown" />}
                        {backtestResult.var95 !== undefined && <MetricItem label="VaR (95%)" value={`${backtestResult.var95.toFixed(2)}%`} tooltip="Value at Risk (95% confidence)" />}
                        {backtestResult.cvar95 !== undefined && <MetricItem label="CVaR (95%)" value={`${backtestResult.cvar95.toFixed(2)}%`} tooltip="Conditional Value at Risk (Expected Shortfall)" />}
                      </div>
                    </div>

                    {/* Advanced Stats */}
                    {(backtestResult.sqn !== undefined || backtestResult.kellyCriterion !== undefined) && (
                      <div>
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Advanced</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {backtestResult.sqn !== undefined && <MetricItem label="SQN" value={backtestResult.sqn.toFixed(2)} tooltip="System Quality Number (Van Tharp)" />}
                          {backtestResult.kellyCriterion !== undefined && <MetricItem label="Kelly %" value={`${backtestResult.kellyCriterion.toFixed(2)}%`} tooltip="Optimal position size (Kelly Criterion)" />}
                        </div>
                      </div>
                    )}

                    {/* Volatility & Distribution */}
                    {(backtestResult.returnVolatility !== undefined || backtestResult.skewness !== undefined) && (
                      <div>
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Volatility</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {backtestResult.returnVolatility !== undefined && <MetricItem label="Volatility" value={`${backtestResult.returnVolatility}%`} tooltip="Standard deviation of returns" />}
                          {backtestResult.skewness !== undefined && <MetricItem label="Skewness" value={backtestResult.skewness} tooltip="Asymmetry of return distribution" />}
                        </div>
                      </div>
                    )}
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
