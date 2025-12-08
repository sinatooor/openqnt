/**
 * Custom hook for backtest operation handlers
 */

import { toast } from "sonner";
import { fetchMarketData } from "@/services/marketData";
import { BacktestResult, runBacktest } from "@/features/backtest/logic/engine";
import * as Blockly from "blockly";

interface UseBacktestHandlersProps {
  workspaceRef: React.RefObject<Blockly.WorkspaceSvg | null>;
  isEmpty: boolean;
  generatedCode: string;
  setIsBacktesting: (isBacktesting: boolean) => void;
  setShowBacktest: (show: boolean) => void;
  setBacktestResult: (result: BacktestResult | null) => void;
}

export const useBacktestHandlers = ({
  workspaceRef,
  isEmpty,
  generatedCode,
  setIsBacktesting,
  setShowBacktest,
  setBacktestResult,
}: UseBacktestHandlersProps) => {
  const handlePreviewBacktest = async (engine: 'frontend' | 'backtesting.py' | 'nautilus' = 'frontend') => {
    // Validate workspace has blocks
    if (!workspaceRef.current || isEmpty) {
      toast.error("Add blocks to your workspace first to run a backtest.");
      return;
    }

    // Start backtesting
    setIsBacktesting(true);
    setShowBacktest(true);
    const loadingToast = toast.loading(`Running backtest (${engine})...`, {
      description: engine === 'frontend' ? "Simulating in browser..." : "Running on server...",
    });

    try {
      if (engine === 'frontend') {
        if (!generatedCode) {
          throw new Error("No strategy code generated");
        }
        // Fetch real market data
        const historicalData = await fetchMarketData({
          symbol: "AAPL",
          interval: "daily",
          outputsize: "full",
        });

        // Run backtest with real data
        const result = await runBacktest(
          generatedCode,
          "AAPL",
          90,
          historicalData
        );
        setBacktestResult(result);
      } else {
        // Backend execution
        const xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspaceRef.current));

        const response = await fetch('http://localhost:8000/backtest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceXml: xml,
            symbol: 'EURUSD', // Default for now
            startDate: '2024-01-01',
            endDate: '2024-03-31',
            initialBalance: 10000,
            engine: engine // Pass engine preference
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.detail || "Backend backtest failed");
        }

        const data = await response.json();

        // Convert backend result to frontend format
        const result: BacktestResult = {
          trades: data.trades.map((t: any) => ({
            time: new Date(t.entry_time).getTime() / 1000 as any,
            type: t.type,
            price: t.entry_price,
            profit: t.pnl
          })),
          metrics: {
            totalReturn: data.metrics.total_return,
            winRate: data.metrics.win_rate,
            maxDrawdown: data.metrics.max_drawdown,
            sharpeRatio: data.metrics.sharpe_ratio,
            totalTrades: data.metrics.total_trades,
            winningTrades: 0, // Not returned by backend yet
            losingTrades: 0,
            averageWin: 0,
            averageLoss: 0,
            profitFactor: data.metrics.profit_factor
          },
          chartData: [] // Need to handle chart data
        };
        setBacktestResult(result);
      }

      // Dismiss loading toast
      toast.dismiss(loadingToast);
      toast.success("Backtest completed successfully!");

    } catch (error: any) {
      console.error("Backtest error:", error);
      toast.dismiss(loadingToast);
      toast.error("Backtest failed", {
        description: error.message || "Failed to run backtest simulation.",
      });
      // Don't hide panel on error so user can see what happened
    } finally {
      setIsBacktesting(false);
    }
  };

  const handleCloseBacktest = () => {
    setShowBacktest(false);
    setBacktestResult(null);
  };

  return {
    handlePreviewBacktest,
    handleCloseBacktest,
  };
};
