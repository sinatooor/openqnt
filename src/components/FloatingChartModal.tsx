import { useState, useEffect } from 'react';
import Draggable from 'react-draggable';
import { TradingViewChart } from './TradingViewChart';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { X, GripHorizontal, Maximize2, Minimize2 } from 'lucide-react';
import { generateMockData } from '@/lib/marketData';
import { CandlestickData } from 'lightweight-charts';
import { cn } from '@/lib/utils';

interface FloatingChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol?: string;
  interval?: string;
}

export const FloatingChartModal = ({ 
  isOpen, 
  onClose, 
  symbol = 'BTC/USDT',
  interval = '1D' 
}: FloatingChartModalProps) => {
  const [chartData, setChartData] = useState<CandlestickData[]>([]);
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [currentInterval, setCurrentInterval] = useState(interval);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });

  // Generate initial data
  useEffect(() => {
    if (isOpen) {
      const data = generateMockData(currentSymbol, 90, { trend: 'up' });
      setChartData(data);
    }
  }, [isOpen, currentSymbol]);

  // Update data when interval changes
  const handleIntervalChange = (newInterval: string) => {
    setCurrentInterval(newInterval);
    // In a real app, this would fetch data for the new interval
    const data = generateMockData(currentSymbol, 90, { trend: 'up' });
    setChartData(data);
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
        bounds="parent"
        position={position}
        onStop={(e, data) => setPosition({ x: data.x, y: data.y })}
        disabled={isMaximized}
      >
        <div
          className={cn(
            "fixed z-50 pointer-events-auto transition-all duration-300",
            isMaximized 
              ? "inset-4" 
              : "w-[900px] h-[600px]"
          )}
        >
          <Card className="w-full h-full flex flex-col shadow-2xl border-2 animate-scale-in">
            {/* Header - Drag Handle */}
            <CardHeader className="drag-handle cursor-move border-b p-3 bg-card/95 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripHorizontal className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Live Chart</h3>
                  <span className="text-xs text-muted-foreground">• {currentSymbol}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMaximize}
                    className="h-7 w-7 p-0"
                  >
                    {isMaximized ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
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
            <CardContent className="flex-1 p-0 overflow-hidden">
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
