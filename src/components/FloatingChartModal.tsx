
import { useState } from "react";
import { DraggableModal } from "./DraggableModal";
import { TradingViewAdvancedChart } from "./TradingViewAdvancedChart";
import { ScreenerPanel } from "./ScreenerPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp } from "lucide-react";

interface FloatingChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol?: string;
}

export const FloatingChartModal = ({
  isOpen,
  onClose,
  symbol = "NASDAQ:AAPL",
}: FloatingChartModalProps) => {
  const [currentSymbol, setCurrentSymbol] = useState(symbol);

  if (!isOpen) return null;

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title="Live Trading Dashboard"
      defaultWidth={1200}
      defaultHeight={800}
      minWidth={800}
      minHeight={600}
    >
      <div className="w-full h-full flex flex-col bg-background/95">
        <Tabs defaultValue="chart" className="flex-1 flex flex-col min-h-0 w-full">
          <div className="px-4 pt-2 border-b border-white/10 shrink-0">
            <TabsList className="bg-muted/30 p-1 h-9 mb-2">
              <TabsTrigger value="chart" className="text-xs px-4 data-[state=active]:bg-background">
                <BarChart3 className="w-3.5 h-3.5 mr-2" />
                Chart
              </TabsTrigger>
              <TabsTrigger value="screener" className="text-xs px-4 data-[state=active]:bg-background">
                <TrendingUp className="w-3.5 h-3.5 mr-2" />
                Screener
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="chart" className="flex-1 mt-0 relative min-h-0 m-0 p-0 border-0">
            <div className="w-full h-full bg-[#0f0f0f] relative">
              <TradingViewAdvancedChart
                symbol={currentSymbol}
                interval="D"
                theme="dark"
              />
            </div>
          </TabsContent>

          <TabsContent value="screener" className="flex-1 mt-0 relative min-h-0 overflow-hidden m-0 p-0 border-0">
            <ScreenerPanel />
          </TabsContent>
        </Tabs>
      </div>
    </DraggableModal>
  );
};
