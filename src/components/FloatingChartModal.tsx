import { useState, useEffect } from "react";
import { DraggableModal } from "./DraggableModal";
import { TradingViewChart } from "@/features/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "./ui/select";
import { useMarketData } from "@/hooks";
import { fetchAvailableSymbols, SymbolInfo } from "@/services/marketData";
import { Loader2 } from "lucide-react";

// Fallback symbols if database is empty
const FALLBACK_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "TSLA", "SPY"];

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
  const [availableSymbols, setAvailableSymbols] = useState<SymbolInfo[]>([]);
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(true);
  const [groupedSymbols, setGroupedSymbols] = useState<Record<string, SymbolInfo[]>>({});

  const { data: chartData, isLoading } = useMarketData({
    symbol: currentSymbol,
    interval: currentInterval,
    autoFetch: isOpen,
  });

  // Fetch available symbols from database
  useEffect(() => {
    if (isOpen) {
      setIsLoadingSymbols(true);
      fetchAvailableSymbols()
        .then((result) => {
          if (result.success && result.symbols.length > 0) {
            setAvailableSymbols(result.symbols);
            setGroupedSymbols(result.grouped);

            // If current symbol is not in list, switch to first available
            const symbolExists = result.symbols.some(s => s.symbol === currentSymbol);
            if (!symbolExists && result.symbols.length > 0) {
              setCurrentSymbol(result.symbols[0].symbol);
            }
          } else {
            // Use fallback
            setAvailableSymbols(FALLBACK_SYMBOLS.map(s => ({
              symbol: s,
              name: s,
              asset_type: 'stock',
              is_active: true,
              record_count: 0,
              first_date: null,
              last_date: null,
            })));
          }
        })
        .finally(() => setIsLoadingSymbols(false));
    }
  }, [isOpen]);

  const handleIntervalChange = (newInterval: string) => {
    setCurrentInterval(newInterval);
  };

  const handleSymbolChange = (newSymbol: string) => {
    setCurrentSymbol(newSymbol);
  };

  if (!isOpen) return null;

  // Group symbols for the dropdown
  const assetTypes = Object.keys(groupedSymbols).filter(type => groupedSymbols[type]?.length > 0);

  const headerActions = (
    <div className="flex items-center gap-2">
      {isLoadingSymbols ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading symbols...
        </div>
      ) : (
        <Select value={currentSymbol} onValueChange={handleSymbolChange}>
          <SelectTrigger className="h-7 w-[180px] text-xs">
            <SelectValue placeholder="Select symbol" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] z-[9999]">
            {assetTypes.length > 0 ? (
              // Show grouped by asset type using SelectGroup
              assetTypes.map((assetType) => (
                <SelectGroup key={assetType}>
                  <SelectLabel className="text-xs font-semibold uppercase">
                    {assetType} ({groupedSymbols[assetType]?.length || 0})
                  </SelectLabel>
                  {groupedSymbols[assetType]?.map((sym) => (
                    <SelectItem
                      key={sym.symbol}
                      value={sym.symbol}
                      className="text-xs"
                    >
                      {sym.symbol} {sym.name && sym.name !== sym.symbol ? `- ${sym.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))
            ) : (
              // Fallback: show all symbols flat
              availableSymbols.map((sym) => (
                <SelectItem key={sym.symbol} value={sym.symbol} className="text-xs">
                  {sym.symbol}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}

      {availableSymbols.length > 0 && (
        <span className="text-[10px] text-muted-foreground">
          {availableSymbols.length} symbols
        </span>
      )}
    </div>
  );

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title="Chart"
      defaultWidth={900}
      defaultHeight={600}
      headerActions={headerActions}
    >
      <div className="w-full h-full p-4 flex flex-col">
        <TradingViewChart
          data={chartData}
          symbol={currentSymbol}
          interval={currentInterval}
          onIntervalChange={handleIntervalChange}
        />
      </div>
    </DraggableModal>
  );
};
