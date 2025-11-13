import { useState, useEffect } from 'react';
import Draggable from 'react-draggable';
import { TradingViewChart } from './TradingViewChart';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { X, GripHorizontal } from 'lucide-react';
import { generateMockData } from '@/lib/marketData';
import { CandlestickData } from 'lightweight-charts';
import { cn } from '@/lib/utils';

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'ADA/USDT'];
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
  const [position, setPosition] = useState({
    x: 100,
    y: 100
  });

  // Generate initial data
  useEffect(() => {
    if (isOpen) {
      const data = generateMockData(currentSymbol, 90, {
        trend: 'up'
      });
      setChartData(data);
    }
  }, [isOpen, currentSymbol]);

  // Update data when interval changes
  const handleIntervalChange = (newInterval: string) => {
    setCurrentInterval(newInterval);
    const data = generateMockData(currentSymbol, 90, {
      trend: 'up'
    });
    setChartData(data);
  };

  // Update data when symbol changes
  const handleSymbolChange = (newSymbol: string) => {
    setCurrentSymbol(newSymbol);
    const data = generateMockData(newSymbol, 90, {
      trend: 'up'
    });
    setChartData(data);
  };
  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
  };
  if (!isOpen) return null;
  return <>
      {/* Backdrop - semi-transparent, allows click-through except on modal */}
      <div className="fixed inset-0 z-40 bg-background/20 backdrop-blur-sm pointer-events-none" />
      
      {/* Draggable Modal */}
      <Draggable handle=".drag-handle" bounds="parent" position={position} onStop={(e, data) => setPosition({
      x: data.x,
      y: data.y
    })} disabled={isMaximized}>
        <div className={cn("fixed z-50 pointer-events-auto transition-all duration-300", isMaximized ? "inset-4" : "w-[900px] h-[600px]")}>
          <Card className="w-full h-full flex flex-col shadow-2xl border-2 animate-scale-in">
            {/* Header - Drag Handle */}
            <CardHeader className="drag-handle cursor-move border-b p-3 bg-card/95 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripHorizontal className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Live Chart</h3>
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
                  <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 hover:bg-destructive/20 hover:text-destructive">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Chart Content */}
            <CardContent className="flex-1 p-4 overflow-hidden">
              <TradingViewChart data={chartData} symbol={currentSymbol} interval={currentInterval} onIntervalChange={handleIntervalChange} />
            </CardContent>
          </Card>
        </div>
      </Draggable>
    </>;
};