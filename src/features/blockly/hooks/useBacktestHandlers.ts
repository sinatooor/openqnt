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
  const handlePreviewBacktest = async () => {
    // Validate workspace has blocks
    if (!workspaceRef.current || isEmpty) {
      toast.error("Add blocks to your workspace first to run a backtest.");
      return;
    }
    if (!generatedCode) {
      toast.error("No strategy code generated. Add blocks to create a strategy.");
      return;
    }

    // Start backtesting
    setIsBacktesting(true);
    setShowBacktest(true);
    const loadingToast = toast.loading("Running backtest simulation...", {
      description: "Fetching real market data and analyzing your strategy",
    });

    try {
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

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      // Show success toast with key metrics and visual feedback
      const isProfit = result.metrics.totalReturn >= 0;
      toast.success(
        isProfit
          ? "🎉 Backtest completed successfully!"
          : "Backtest completed",
        {
          description: `${isProfit ? "📈" : "📉"} Return: ${result.metrics.totalReturn.toFixed(2)}% | Win Rate: ${result.metrics.winRate.toFixed(1)}% | ${result.metrics.totalTrades} trades`,
          duration: 5000,
        }
      );
    } catch (error) {
      console.error("Backtest error:", error);
      toast.dismiss(loadingToast);
      toast.error("Backtest failed", {
        description:
          "Failed to run backtest simulation. Check your strategy blocks.",
      });
      setShowBacktest(false);
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
