import { useState } from "react";
import { BlocklyWorkspace } from "@/components/BlocklyWorkspace";
import { SettingsPanel } from "@/components/SettingsPanel";
import { BacktestingPanel } from "@/components/BacktestingPanel";
import { BacktestResult } from "@/lib/backtestEngine";
import { CandleData } from "@/lib/marketData";

const Index = () => {
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [marketData, setMarketData] = useState<CandleData[]>([]);

  const handleBacktestStart = (result: BacktestResult, data: CandleData[]) => {
    setBacktestResult(result);
    setMarketData(data);
  };

  const handleCloseBacktest = () => {
    setBacktestResult(null);
    setMarketData([]);
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <SettingsPanel />
      <BlocklyWorkspace onBacktestStart={handleBacktestStart} />
      {backtestResult && <BacktestingPanel result={backtestResult} marketData={marketData} />}
    </div>
  );
};

export default Index;
