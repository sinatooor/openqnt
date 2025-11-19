import { useState, useEffect } from "react";
import Draggable from "react-draggable";
import { TradingViewChart } from "./TradingViewChart";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { X, GripHorizontal } from "lucide-react";
import { useMarketData } from "@/hooks/useMarketData";
import { cn } from "@/lib/utils";

const SYMBOLS = ["AAPL", "MSFT", "GOOGL", "TSLA", "BTC/USD", "ETH/USD", "SPY"];
interface FloatingChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol?: string;
  interval?: string;
}
export const FloatingChartModal = ({
  isOpen,
  onClose,
  symbol = "AAPL",
  interval = "1D",
}: FloatingChartModalProps) => {
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [currentInterval, setCurrentInterval] = useState(interval);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState({
    x: 100,
    y: 100,
  });

  const { data: chartData, isLoading } = useMarketData({
    symbol: currentSymbol,
    interval: currentInterval,
    autoFetch: isOpen,
  });

  // Update data when interval changes
  const handleIntervalChange = (newInterval: string) => {
    setCurrentInterval(newInterval);
  };

  // Update data when symbol changes
  const handleSymbolChange = (newSymbol: string) => {
    setCurrentSymbol(newSymbol);
  };
  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
  };
  if (!isOpen) return null;
  return (
    <>
      {/* Backdrop - semi-transparent, allows click-through except on modal */}
      <div className="fixed inset-0 z-40 bg-background/20 backdrop-blur-sm pointer-events-none" />

      {/* Draggable Modal */}
      <Draggable
        handle=".drag-handle"
        bounds="body"
        position={position}
        onStop={(e, data) =>
          setPosition({
            x: data.x,
            y: data.y,
          })
        }
        disabled={isMaximized}
      >
        <div
          className={cn(
            "fixed z-50 pointer-events-auto transition-all duration-300",
            isMaximized 
              ? "inset-4" 
              : "w-full sm:w-[600px] md:w-[750px] lg:w-[900px] h-[400px] sm:h-[500px] md:h-[600px]",
          )}
        >
          <Card className="w-full h-full flex flex-col shadow-2xl border-2 animate-scale-in">
            {/* Header - Drag Handle */}
            <CardHeader className="drag-handle cursor-move border-b p-3 bg-card/95 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripHorizontal className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Chart</h3>
                  <Select value={currentSymbol} onValueChange={handleSymbolChange}>
                    <SelectTrigger className="h-7 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYMBOLS.map((sym) => (
                        <SelectItem key={sym} value={sym} className="text-xs">
                          {sym}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMaximize}
                    className="h-7 w-7 p-0 hover:bg-accent"
                    title={isMaximized ? "Restore" : "Maximize"}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isMaximized ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      )}
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-7 w-7 p-0 hover:bg-destructive/20 hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Chart Content */}
            <CardContent className="flex-1 p-4 overflow-hidden">
              <TradingViewChart
                data={chartData}
                symbol={currentSymbol}
                interval={currentInterval}
                onIntervalChange={handleIntervalChange}
              />
            </CardContent>
          </Card>
        </div>
      </Draggable>
    </>
  );
};
