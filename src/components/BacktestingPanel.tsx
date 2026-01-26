import { useState } from "react";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, Input, Label, Tooltip, TooltipContent, TooltipTrigger, Separator, Badge, Card, CardContent } from "@/components/ui";
import { X, TrendingUp, History, Zap, AlertCircle, CheckCircle2, Play, Square, Loader2, BarChart3, ArrowUpRight, ArrowDownRight, GitCompare } from "lucide-react";
import { TourTriggerButton } from "./GuidedTour";
import { toast } from "sonner";
import { BacktestVisualizationModal } from "./BacktestVisualizationModal";
import { generateCode } from "@/config/blockly/generator";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { StrategyComparison, saveBacktestResult } from "./StrategyComparison";
import { McptSimulationModal } from "./McptSimulationModal";

// Helper function to format numbers to 4 decimal places
const formatNumber = (value: number | undefined, decimals: number = 4): string => {
    if (value === undefined || value === null || isNaN(value)) return "N/A";
    return value.toFixed(decimals);
};

interface Trade {
    entry_time: string;
    exit_time: string;
    entry_price: number;
    exit_price: number;
    size: number;
    pnl: number;
    return_pct: number;
    type: string;
}

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
    visualizationHtml?: string | null;
    rawStats?: string | null;
    trades?: Trade[];  // List of executed trades
}

interface BacktestingPanelProps {
    onStartTour?: () => void;
    onClose?: () => void;
    leverage?: string;
    onLeverageChange?: (value: string) => void;
    getWorkspaceXml?: () => string | null;
    getPythonCode?: () => string | null; // For backtesting.py engine
    getNautilusCode?: () => string | null; // For NautilusTrader engine
    generatedStrategyId?: string | null;
    loadedTemplateId?: string | null;
}

export const BacktestingPanel = ({ onStartTour, onClose, leverage = "1", onLeverageChange, getWorkspaceXml, getPythonCode, getNautilusCode, generatedStrategyId, loadedTemplateId }: BacktestingPanelProps) => {
    const [mode, setMode] = useState<"backtest" | "live">("backtest");
    const [tradingSymbol, setTradingSymbol] = useState("EURUSD");
    const [isConnected, setIsConnected] = useState(false);
    const [capitalAllocation, setCapitalAllocation] = useState("10000");
    const [accountLeverage, setAccountLeverage] = useState("1"); // 1:1 leverage by default
    const [engine, setEngine] = useState<"backtesting.py" | "rust" | "nautilus">("backtesting.py");

    // Optimization state
    const [isOptimization, setIsOptimization] = useState(false);
    const [optMetric, setOptMetric] = useState("Return [%]");
    const [optMethod, setOptMethod] = useState("grid");
    const [aiModel, setAiModel] = useState("deepseek");
    const [useLLMPolish, setUseLLMPolish] = useState(false); // Hybrid PyGenerator + LLM

    // Backtest state
    const [isBacktesting, setIsBacktesting] = useState(false);
    const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
    const [startDate, setStartDate] = useState("2024-01-01");
    const [endDate, setEndDate] = useState("2024-03-31");
    const [timeframe, setTimeframe] = useState<"1h" | "4h" | "1d" | "1w">("1d");

    // Live state
    const [isStrategyRunning, setIsStrategyRunning] = useState(false);
    const [isStartingStrategy, setIsStartingStrategy] = useState(false);
    const [strategyStatus, setStrategyStatus] = useState<any>(null);
    const [isLiveMode, setIsLiveMode] = useState(false); // False = Paper, True = Live
    const [maxTradeSize, setMaxTradeSize] = useState("1.0");
    const [maxDrawdown, setMaxDrawdown] = useState("500");

    // Visualization state
    const [isVisModalOpen, setIsVisModalOpen] = useState(false);
    const [visualizationHtml, setVisualizationHtml] = useState<string | null>(null);
    const [rawStats, setRawStats] = useState<string | null>(null);

    // Comparison state
    const [showComparison, setShowComparison] = useState(false);

    // MCPT state
    const [showMcptModal, setShowMcptModal] = useState(false);

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
        setVisualizationHtml(null);
        setRawStats(null);

        try {
            // Determine if we should skip verification
            // Skip if: using a template OR using an unmodified AI-generated strategy
            const isUsingTemplate = !!loadedTemplateId;
            const isUsingCachedAIStrategy = !!generatedStrategyId;
            const shouldSkipVerification = isUsingTemplate || isUsingCachedAIStrategy;

            // Optional: Run Gemini verification via Supabase Edge Function (Lovable gateway)
            // Only verify user-built or modified strategies
            if (!shouldSkipVerification) {
                try {
                    toast.info("Verifying strategy with Gemini...");

                    let pythonCodeForVerification = null;
                    if (engine === "nautilus" && getNautilusCode) {
                        try {
                            pythonCodeForVerification = getNautilusCode();
                        } catch (genErr) {
                            console.warn("Could not generate Nautilus code for verification:", genErr);
                        }
                    }

                    const response = await fetch('http://localhost:8000/verify-backtest', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            xml: xml.substring(0, 2000),
                            python_code: pythonCodeForVerification
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`Server error: ${response.status}`);
                    }

                    const verifyData = await response.json();

                    if (!verifyData.valid) {
                        console.warn("[VERIFY] Gemini found issues:", verifyData.issues);
                        // Non-blocking: show warning toast but continue with backtest
                        toast.warning("Strategy may have issues", {
                            description: verifyData.issues?.join(", ") || "Check console for details"
                        });
                    } else {
                        console.log("[VERIFY] Gemini verification passed");
                    }
                } catch (verifyErr) {
                    console.warn("[VERIFY] Verification step skipped:", verifyErr);
                    // Non-blocking: show error toast but continue with backtest
                    toast.error("Verification skipped", {
                        description: "Could not reach local verification service, proceeding..."
                    });
                }
            } else if (shouldSkipVerification) {
                // Log why we're skipping verification
                if (isUsingTemplate) {
                    console.log("[VERIFY] Skipping verification - using pre-built template:", loadedTemplateId);
                } else if (isUsingCachedAIStrategy) {
                    console.log("[VERIFY] Skipping verification - using cached AI strategy:", generatedStrategyId);
                }
            }

            // Handle backtesting.py engine - smart detection for template vs blocks
            if (engine === "backtesting.py") {
                // Smart logic: if using unmodified template, use pre-built code
                // Otherwise, generate code from blocks via pyGenerator
                const isUsingUnmodifiedTemplate = !!loadedTemplateId && !generatedStrategyId;
                // If using unmodified template, send templateId to backend to use pre-built code
                // Otherwise, generate Python code from blocks
                let pythonCode: string | null = null;

                if (!isUsingUnmodifiedTemplate) {
                    // Not using template or template was modified - generate code from blocks
                    if (!getPythonCode) {
                        toast.error("Code generation not available", {
                            description: "Python code generation is not connected to this panel."
                        });
                        setIsBacktesting(false);
                        return;
                    }
                    pythonCode = getPythonCode();
                    if (!pythonCode || pythonCode.includes("Add blocks to your workspace")) {
                        toast.error("No Python code generated", {
                            description: "Add blocks to your workspace first."
                        });
                        setIsBacktesting(false);
                        return;
                    }
                }

                const toastMessage = isUsingUnmodifiedTemplate
                    ? `Running pre-built template: ${loadedTemplateId}...`
                    : (useLLMPolish ? "Running backtest + LLM Polish..." : "Running backtest...");
                toast.info(toastMessage);

                const response = await fetch(`${backendUrl}/backtest-py-code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pythonCode: pythonCode || null, // null if using template
                        symbol: tradingSymbol,
                        startDate,
                        endDate,
                        initialBalance: parseFloat(capitalAllocation),
                        commission: 0.001,
                        polishWithLLM: useLLMPolish,
                        templateId: isUsingUnmodifiedTemplate ? loadedTemplateId : null // Use pre-built code
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                    throw new Error(errorData.detail || `HTTP ${response.status}`);
                }

                const data = await response.json();

                if (data.success) {
                    setBacktestResult({
                        totalReturn: data.metrics.total_return,
                        winRate: data.metrics.win_rate,
                        totalTrades: data.metrics.total_trades,
                        maxDrawdown: data.metrics.max_drawdown,
                        finalBalance: data.final_balance,
                        sharpeRatio: data.metrics.sharpe_ratio,
                        profitFactor: data.metrics.profit_factor,
                        visualizationHtml: data.visualization_html,
                        rawStats: data.raw_stats,
                    });

                    // Set visualization state for modal
                    if (data.visualization_html) {
                        setVisualizationHtml(data.visualization_html);
                    }
                    if (data.raw_stats) {
                        setRawStats(data.raw_stats);
                    }

                    toast.success("PyGenerator Backtest completed!", {
                        description: `Return: ${formatNumber(data.metrics.total_return, 4)}% with ${data.metrics.total_trades} trades`
                    });

                    // Save to comparison history
                    saveBacktestResult({
                        strategyName: 'Strategy',
                        timestamp: new Date().toISOString(),
                        symbol: tradingSymbol,
                        totalReturn: data.metrics.total_return,
                        winRate: data.metrics.win_rate,
                        totalTrades: data.metrics.total_trades,
                        maxDrawdown: data.metrics.max_drawdown,
                        sharpeRatio: data.metrics.sharpe_ratio,
                        profitFactor: data.metrics.profit_factor,
                        finalBalance: data.final_balance
                    });
                } else {
                    toast.error("Backtest failed", { description: data.error });
                }
                return;
            }

            // For Nautilus engine with modified blocks, generate Nautilus code
            let precompiledNautilusCode: string | null = null;
            const isUsingUnmodifiedTemplate = !!loadedTemplateId && !generatedStrategyId;

            if (engine === "nautilus" && !isUsingUnmodifiedTemplate && getNautilusCode) {
                precompiledNautilusCode = getNautilusCode();
                if (precompiledNautilusCode && !precompiledNautilusCode.includes("Add blocks to your workspace")) {
                    console.log("[NAUTILUS] Using generated Nautilus code from blocks");
                } else {
                    precompiledNautilusCode = null; // Let backend handle via XML parsing
                }
            }

            // Create AbortController for timeout (10 minutes for LLM-based backtests)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 600000);

            const response = await fetch(`${backendUrl}/backtest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    workspaceXml: xml,
                    symbol: tradingSymbol,
                    startDate,
                    endDate,
                    interval: timeframe,
                    initialBalance: parseFloat(capitalAllocation),
                    tradeSize: parseFloat(capitalAllocation),
                    leverage: parseFloat(accountLeverage),
                    engine: engine,
                    optimize: isOptimization,
                    opt_metric: optMetric,
                    opt_method: optMethod,
                    ai_model: aiModel,
                    strategyId: generatedStrategyId,
                    templateId: isUsingUnmodifiedTemplate ? loadedTemplateId : null,
                    precompiledCode: precompiledNautilusCode // For Nautilus with modified blocks
                })
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                const totalReturn = ((data.final_balance - data.initial_balance) / data.initial_balance) * 100;
                const totalTrades = data.metrics.total_trades;
                const winRate = data.metrics.win_rate;

                setBacktestResult({
                    totalReturn,
                    winRate,
                    totalTrades,
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
                    bestMetricValue: data.best_metric_value,
                    visualizationHtml: data.visualization_html,
                    rawStats: data.raw_stats,
                    trades: data.trades || []
                });

                if (data.visualization_html) {
                    setVisualizationHtml(data.visualization_html);
                }
                if (data.raw_stats) {
                    setRawStats(data.raw_stats);
                }

                // Show contextual toast messages based on results
                if (totalTrades === 0) {
                    toast.warning("No trades executed", {
                        description: "Your entry conditions were never met during this period. Try adjusting thresholds or date range."
                    });
                } else if (winRate === 0 && totalReturn < 0) {
                    toast.info("Strategy executed but all trades hit stop loss", {
                        description: `${totalTrades} trade(s) were stopped out. Consider widening your stop loss (e.g., 2× ATR instead of 1.5×) or using a trend filter.`
                    });
                } else if (totalReturn < -10) {
                    toast.warning("Backtest completed with significant losses", {
                        description: `Return: ${formatNumber(totalReturn, 4)}%. Review your risk management settings.`
                    });
                } else if (totalReturn > 0) {
                    toast.success("Backtest completed!", {
                        description: `Return: ${formatNumber(totalReturn, 4)}% with ${totalTrades} trades (${formatNumber(winRate, 4)}% win rate)`
                    });
                } else {
                    toast.success("Backtest completed!")
                }
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
                    pollInterval: 60,
                    live_mode: isLiveMode,
                    safety_config: {
                        max_size: parseFloat(maxTradeSize),
                        max_drawdown: parseFloat(maxDrawdown)
                    }
                }),
            });
            const data = await response.json();
            if (data.success) {
                setIsStrategyRunning(true);
                setStrategyStatus(data.status);
                const modeText = isLiveMode ? "LIVE TRADING" : "Paper Trading";
                toast.success(`Strategy launched in ${modeText}!`, { description: `Running on ${tradingSymbol}` });
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

                <div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block cursor-help border-b border-dotted border-muted-foreground/30 w-fit">
                                Account Leverage (x)
                            </label>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px]">
                            <p>Multiplies your position size. Higher leverage amplifies both gains and losses. Use with caution. Range: 1-100.</p>
                        </TooltipContent>
                    </Tooltip>
                    <Input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={accountLeverage}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (val >= 1 && val <= 100) {
                                setAccountLeverage(e.target.value);
                            } else if (e.target.value === "") {
                                setAccountLeverage("");
                            }
                        }}
                        onBlur={(e) => {
                            // Reset to 1 if empty or invalid on blur
                            if (e.target.value === "" || parseFloat(e.target.value) < 1) {
                                setAccountLeverage("1");
                            }
                        }}
                        className="bg-secondary"
                        placeholder="1"
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

                        {/* Timeframe Selection */}
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Timeframe</label>
                            <Select value={timeframe} onValueChange={(v: any) => setTimeframe(v)}>
                                <SelectTrigger className="bg-secondary h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1h">1 Hour</SelectItem>
                                    <SelectItem value="4h">4 Hours</SelectItem>
                                    <SelectItem value="1d">1 Day</SelectItem>
                                    <SelectItem value="1w">1 Week</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Engine Selection */}
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Backtest Engine</label>
                            <Select value={engine} onValueChange={(v: any) => setEngine(v)}>
                                <SelectTrigger className="bg-secondary h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="backtesting.py">backtesting.py (Recommended)</SelectItem>
                                    <SelectItem value="rust">🦀 Rust Engine (Fastest)</SelectItem>
                                    <SelectItem value="nautilus">NautilusTrader (Institutional)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>


                        {/* Optimization Settings */}
                        {(engine === "backtesting.py" || engine === "nautilus") && (
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
                                                    <span className="font-bold text-primary">{formatNumber(backtestResult.bestMetricValue, 4)}</span>
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
                                        <div className="flex gap-2">
                                            {backtestResult.visualizationHtml && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-6 text-xs"
                                                    onClick={() => setIsVisModalOpen(true)}
                                                >
                                                    <BarChart3 className="w-3 h-3 mr-1" />
                                                    View Chart
                                                </Button>
                                            )}
                                            <Badge variant={backtestResult.totalReturn >= 0 ? "default" : "destructive"}>
                                                {backtestResult.totalReturn >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                                                {formatNumber(backtestResult.totalReturn, 4)}%
                                            </Badge>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div className="space-y-4">
                                        {/* Performance & Return Quality */}
                                        <div>
                                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Performance</h4>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <MetricItem label="Win Rate" value={`${formatNumber(backtestResult.winRate, 4)}%`} tooltip="Percentage of profitable trades" />
                                                <MetricItem label="Trades" value={backtestResult.totalTrades} tooltip="Total number of executed trades" />
                                                <MetricItem label="Final Balance" value={`$${formatNumber(backtestResult.finalBalance, 4)}`} tooltip="Ending account balance" />
                                                {backtestResult.cagr !== undefined && <MetricItem label="CAGR" value={`${formatNumber(backtestResult.cagr, 4)}%`} tooltip="Compounded Annual Growth Rate" />}
                                                {backtestResult.profitFactor !== undefined && <MetricItem label="Profit Factor" value={formatNumber(backtestResult.profitFactor, 4)} tooltip="Gross Profit / Gross Loss" />}
                                                {backtestResult.expectancy !== undefined && <MetricItem label="Expectancy" value={`$${formatNumber(backtestResult.expectancy, 4)}`} tooltip="Average profit per trade" />}
                                            </div>
                                        </div>

                                        {/* Risk & Drawdown */}
                                        <div>
                                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Risk</h4>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <MetricItem label="Max Drawdown" value={`${formatNumber(backtestResult.maxDrawdown, 4)}%`} valueClassName="text-red-400" tooltip="Maximum peak-to-valley decline" />
                                                {backtestResult.sharpeRatio !== undefined && <MetricItem label="Sharpe Ratio" value={formatNumber(backtestResult.sharpeRatio, 4)} tooltip="Risk-adjusted return (Return / Volatility)" />}
                                                {backtestResult.sortinoRatio !== undefined && <MetricItem label="Sortino Ratio" value={formatNumber(backtestResult.sortinoRatio, 4)} tooltip="Return / Downside Deviation" />}
                                                {backtestResult.calmarRatio !== undefined && <MetricItem label="Calmar Ratio" value={formatNumber(backtestResult.calmarRatio, 4)} tooltip="CAGR / Max Drawdown" />}
                                                {backtestResult.var95 !== undefined && <MetricItem label="VaR (95%)" value={`${formatNumber(backtestResult.var95, 4)}%`} tooltip="Value at Risk (95% confidence)" />}
                                                {backtestResult.cvar95 !== undefined && <MetricItem label="CVaR (95%)" value={`${formatNumber(backtestResult.cvar95, 4)}%`} tooltip="Conditional Value at Risk (Expected Shortfall)" />}
                                            </div>
                                        </div>

                                        {/* Advanced Stats */}
                                        {(backtestResult.sqn !== undefined || backtestResult.kellyCriterion !== undefined) && (
                                            <div>
                                                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Advanced</h4>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    {backtestResult.sqn !== undefined && <MetricItem label="SQN" value={formatNumber(backtestResult.sqn, 4)} tooltip="System Quality Number (Van Tharp)" />}
                                                    {backtestResult.kellyCriterion !== undefined && <MetricItem label="Kelly %" value={`${formatNumber(backtestResult.kellyCriterion, 4)}%`} tooltip="Optimal position size (Kelly Criterion)" />}
                                                </div>
                                            </div>
                                        )}

                                        {/* Volatility & Distribution */}
                                        {(backtestResult.returnVolatility !== undefined || backtestResult.skewness !== undefined) && (
                                            <div>
                                                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Volatility</h4>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    {backtestResult.returnVolatility !== undefined && <MetricItem label="Volatility" value={`${formatNumber(backtestResult.returnVolatility, 4)}%`} tooltip="Standard deviation of returns" />}
                                                    {backtestResult.skewness !== undefined && <MetricItem label="Skewness" value={formatNumber(backtestResult.skewness, 4)} tooltip="Asymmetry of return distribution" />}
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
                        {/* Live Mode Controls */}
                        <div className="space-y-4">
                            <Card className={cn("transition-colors", isLiveMode ? "bg-red-950/30 border-red-900/50" : "bg-blue-950/30 border-blue-900/50")}>
                                <CardContent className="p-3">
                                    <div className="flex items-center justify-between mb-4">
                                        <Label className="font-semibold text-sm">Execution Mode</Label>
                                        <div className="flex bg-muted/50 rounded-lg p-1 gap-1">
                                            <Button
                                                variant={!isLiveMode ? "secondary" : "ghost"}
                                                size="sm"
                                                className={cn("h-7 text-xs px-3", !isLiveMode && "bg-blue-600 text-white hover:bg-blue-700")}
                                                onClick={() => setIsLiveMode(false)}
                                                disabled={isStrategyRunning}
                                            >
                                                Paper
                                            </Button>
                                            <Button
                                                variant={isLiveMode ? "secondary" : "ghost"}
                                                size="sm"
                                                className={cn("h-7 text-xs px-3", isLiveMode && "bg-red-600 text-white hover:bg-red-700")}
                                                onClick={() => setIsLiveMode(true)}
                                                disabled={isStrategyRunning}
                                            >
                                                LIVE
                                            </Button>
                                        </div>
                                    </div>

                                    {isLiveMode && (
                                        <div className="bg-red-900/20 border border-red-500/30 rounded p-2 mb-3">
                                            <div className="flex items-start gap-2 text-red-200">
                                                <AlertCircle className="w-4 h-4 mt-0.5 text-red-500" />
                                                <p className="text-[10px] leading-tight">
                                                    You are about to trade with <span className="font-bold underline">REAL MONEY</span>.
                                                    Ensure you have tested your strategy thoroughly.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <Separator className="bg-border/50 my-3" />

                                    <div className="space-y-3">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Safety Guardrails</h4>
                                        <div>
                                            <Label className="text-xs mb-1 block">Max Trade Size (Lots)</Label>
                                            <Input
                                                type="number"
                                                value={maxTradeSize}
                                                onChange={(e) => setMaxTradeSize(e.target.value)}
                                                className="h-8 text-xs"
                                                step="0.1"
                                                min="0.1"
                                                disabled={isStrategyRunning}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs mb-1 block">Max Daily Drawdown ($)</Label>
                                            <Input
                                                type="number"
                                                value={maxDrawdown}
                                                onChange={(e) => setMaxDrawdown(e.target.value)}
                                                className="h-8 text-xs"
                                                step="10"
                                                min="0"
                                                disabled={isStrategyRunning}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-secondary/50">
                                <CardContent className="p-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Status</span>
                                        {isStrategyRunning ? (
                                            <Badge className={cn("animate-pulse", isLiveMode ? "bg-red-600" : "bg-blue-600")}>
                                                <Play className="w-3 h-3 mr-1" />
                                                {isLiveMode ? "Running LIVE" : "Running Simulated"}
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
                                                <span className="font-mono">{strategyStatus.current_position || 'None'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Last Signal</span>
                                                <span className="font-mono">{strategyStatus.last_signal || 'None'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Trades</span>
                                                <span className="font-mono">{strategyStatus.trade_count || 0}</span>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}
            </div>

            {/* Action Button */}
            <div className="p-4 border-t border-border space-y-2">
                {mode === "backtest" ? (
                    <>
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
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowComparison(!showComparison)}
                            className="w-full"
                        >
                            <GitCompare className="w-4 h-4 mr-2" />
                            {showComparison ? 'Hide Comparison' : 'Compare Strategies'}
                        </Button>
                        {showComparison && (
                            <StrategyComparison onClose={() => setShowComparison(false)} />
                        )}
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowMcptModal(true)}
                            className="w-full mt-2 bg-purple-900/20 hover:bg-purple-900/40 text-purple-200 border border-purple-500/30"
                        >
                            <Zap className="w-4 h-4 mr-2" />
                            PPM Simulation
                        </Button>
                    </>
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

            <BacktestVisualizationModal
                isOpen={isVisModalOpen}
                onClose={() => setIsVisModalOpen(false)}
                htmlContent={visualizationHtml}
                rawStats={rawStats}
                trades={backtestResult?.trades}
            />

            <McptSimulationModal
                isOpen={showMcptModal}
                onClose={() => setShowMcptModal(false)}
                symbol={tradingSymbol}
            />
        </div>
    );
};

// Backward compatibility export
export const SettingsPanel = BacktestingPanel;
