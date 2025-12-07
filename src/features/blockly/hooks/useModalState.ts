/**
 * Custom hook for managing indicator and advanced logic modal states
 */

import { useState } from "react";
import { BacktestResult } from "@/features/backtest/logic/engine";

export const useModalState = () => {
  // Advanced Logic Modal
  const [currentLogicBlockId, setCurrentLogicBlockId] = useState<string | null>(
    null
  );
  const [currentLogicXml, setCurrentLogicXml] = useState<string>("");
  const [currentIndicatorType, setCurrentIndicatorType] = useState<string>("");

  // Indicator Settings Modal
  const [currentIndicatorBlockId, setCurrentIndicatorBlockId] = useState<
    string | null
  >(null);
  const [currentIndicatorName, setCurrentIndicatorName] = useState<string>("");
  const [currentIndicatorParams, setCurrentIndicatorParams] = useState<
    Record<string, number>
  >({});

  // Backtest Results
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(
    null
  );

  return {
    // Advanced logic
    currentLogicBlockId,
    setCurrentLogicBlockId,
    currentLogicXml,
    setCurrentLogicXml,
    currentIndicatorType,
    setCurrentIndicatorType,

    // Indicator settings
    currentIndicatorBlockId,
    setCurrentIndicatorBlockId,
    currentIndicatorName,
    setCurrentIndicatorName,
    currentIndicatorParams,
    setCurrentIndicatorParams,

    // Backtest result
    backtestResult,
    setBacktestResult,
  };
};
