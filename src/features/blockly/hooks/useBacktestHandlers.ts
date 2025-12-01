/**
 * Custom hook for handling backtest operations
 */

import { BacktestResult } from "@/features/backtest/logic/engine";

interface UseBacktestHandlersProps {
  setShowBacktest: (show: boolean) => void;
  setBacktestResult: (result: BacktestResult | null) => void;
}

export const useBacktestHandlers = ({
  setShowBacktest,
  setBacktestResult,
}: UseBacktestHandlersProps) => {
  const handleCloseBacktest = () => {
    setShowBacktest(false);
    setBacktestResult(null);
  };

  return {
    handleCloseBacktest,
  };
};
