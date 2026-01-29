/**
 * ScreenerModal - Market screener for Strategy Flow
 * Scan for trading opportunities based on technical criteria
 */

import { useState, useCallback } from 'react';
import { WindowModal } from './WindowModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Filter,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface ScreenerResult {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  volume: number;
  rsi: number;
  sma_status: 'above' | 'below';
  signal: 'buy' | 'sell' | 'neutral';
  strength: number;
}

interface ScreenerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSymbol?: (symbol: string) => void;
}

const FILTERS = [
  { value: 'rsi_oversold', label: 'RSI Oversold (<30)', description: 'Potential buy signals' },
  { value: 'rsi_overbought', label: 'RSI Overbought (>70)', description: 'Potential sell signals' },
  { value: 'uptrend_sma200', label: 'Above SMA 200', description: 'Long-term uptrend' },
  { value: 'downtrend_sma200', label: 'Below SMA 200', description: 'Long-term downtrend' },
  { value: 'golden_cross', label: 'Golden Cross', description: 'SMA 50 crosses above SMA 200' },
  { value: 'death_cross', label: 'Death Cross', description: 'SMA 50 crosses below SMA 200' },
  { value: 'macd_bullish', label: 'MACD Bullish', description: 'MACD crossover signal' },
  { value: 'macd_bearish', label: 'MACD Bearish', description: 'MACD crossunder signal' },
  { value: 'high_volume', label: 'High Volume', description: 'Volume spike detected' },
  { value: 'breakout', label: 'Price Breakout', description: 'Breaking resistance/support' },
];

const WATCHLISTS = {
  forex: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'EURGBP'],
  crypto: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'SOLUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'],
  stocks: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'WMT'],
  indices: ['SPY', 'QQQ', 'DIA', 'IWM', 'VTI'],
};

export const ScreenerModal = ({ open, onOpenChange, onSelectSymbol }: ScreenerModalProps) => {
  const [filter, setFilter] = useState('rsi_oversold');
  const [watchlist, setWatchlist] = useState<'forex' | 'crypto' | 'stocks' | 'indices'>('stocks');
  const [customSymbols, setCustomSymbols] = useState('');
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  const runScreener = useCallback(async () => {
    setIsScanning(true);
    setResults([]);

    try {
      const symbols = customSymbols.trim()
        ? customSymbols.split(',').map(s => s.trim().toUpperCase())
        : WATCHLISTS[watchlist];

      const response = await fetch(`${backendUrl}/api/screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols,
          filter,
          days_back: 365,
        }),
      });

      if (!response.ok) {
        throw new Error('Screener request failed');
      }

      const data = await response.json();

      if (data.success && data.results) {
        setResults(data.results);
        setLastScan(new Date());
        toast.success(`Found ${data.results.length} matches`);
      } else {
        toast.info('No matches found for this filter');
      }
    } catch (error) {
      console.error('Screener error:', error);
      // Generate mock results for demo
      const mockResults: ScreenerResult[] = WATCHLISTS[watchlist].slice(0, 5).map((symbol, i) => ({
        symbol,
        name: symbol,
        price: 100 + Math.random() * 100,
        change_pct: (Math.random() - 0.5) * 10,
        volume: Math.floor(Math.random() * 10000000),
        rsi: Math.random() * 100,
        sma_status: Math.random() > 0.5 ? 'above' : 'below',
        signal: ['buy', 'sell', 'neutral'][Math.floor(Math.random() * 3)] as 'buy' | 'sell' | 'neutral',
        strength: Math.random() * 100,
      }));
      setResults(mockResults);
      setLastScan(new Date());
      toast.info('Using demo data (backend unavailable)');
    } finally {
      setIsScanning(false);
    }
  }, [filter, watchlist, customSymbols, backendUrl]);

  const handleSelectSymbol = (symbol: string) => {
    onSelectSymbol?.(symbol);
    toast.success(`Selected ${symbol}`);
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000000) return (volume / 1000000000).toFixed(1) + 'B';
    if (volume >= 1000000) return (volume / 1000000).toFixed(1) + 'M';
    if (volume >= 1000) return (volume / 1000).toFixed(1) + 'K';
    return volume.toString();
  };

  return (
    <WindowModal
      open={open}
      onOpenChange={onOpenChange}
      title="Market Screener"
      icon={<Search className="w-5 h-5 text-purple-400" />}
      defaultWidth={900}
      defaultHeight={700}
      minWidth={600}
      minHeight={400}
    >
      <div className="flex-1 flex flex-col p-4 gap-4">
          {/* Filters Section */}
          <div className="p-4 bg-secondary rounded-lg border border-border space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {/* Watchlist Selection */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Market</Label>
                <Select value={watchlist} onValueChange={(v: any) => setWatchlist(v)}>
                  <SelectTrigger className="bg-background border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-secondary border-border">
                    <SelectItem value="forex">Forex</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                    <SelectItem value="stocks">Stocks</SelectItem>
                    <SelectItem value="indices">Indices</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filter Selection */}
              <div className="space-y-2 col-span-2">
                <Label className="text-muted-foreground text-sm">Filter</Label>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="bg-background border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-secondary border-border">
                    {FILTERS.map(f => (
                      <SelectItem key={f.value} value={f.value}>
                        <div className="flex flex-col">
                          <span>{f.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Scan Button */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">&nbsp;</Label>
                <Button
                  onClick={runScreener}
                  disabled={isScanning}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Scan
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Custom Symbols */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Custom Symbols (optional, comma-separated)</Label>
              <Input
                value={customSymbols}
                onChange={(e) => setCustomSymbols(e.target.value)}
                placeholder="AAPL, MSFT, GOOGL..."
                className="bg-background border-white/10"
              />
            </div>

            {/* Current Filter Info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" />
              <span>Scanning {customSymbols.trim() ? 'custom symbols' : WATCHLISTS[watchlist].length + ' ' + watchlist + ' symbols'} for: </span>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                {FILTERS.find(f => f.value === filter)?.label}
              </Badge>
            </div>
          </div>

          {/* Results Section */}
          <div className="flex-1 bg-secondary rounded-lg border border-border overflow-hidden flex flex-col">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                <span className="font-medium">Results</span>
                {results.length > 0 && (
                  <Badge variant="outline" className="text-xs">{results.length} matches</Badge>
                )}
              </div>
              {lastScan && (
                <span className="text-xs text-muted-foreground">
                  Last scan: {lastScan.toLocaleTimeString()}
                </span>
              )}
            </div>

            <ScrollArea className="flex-1">
              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Search className="w-12 h-12 mb-3 opacity-50" />
                  <p>No results yet</p>
                  <p className="text-sm mt-1">Click "Scan" to search for opportunities</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Symbol</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">RSI</TableHead>
                      <TableHead className="text-center">Signal</TableHead>
                      <TableHead className="text-right">Strength</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={result.symbol} className="border-border hover:bg-secondary/50">
                        <TableCell>
                          <div>
                            <div className="font-medium">{result.symbol}</div>
                            {result.name !== result.symbol && (
                              <div className="text-xs text-muted-foreground">{result.name}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${result.price.toFixed(2)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${result.change_pct >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                          <span className="flex items-center justify-end gap-1">
                            {result.change_pct >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {result.change_pct >= 0 ? '+' : ''}{result.change_pct.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatVolume(result.volume)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${result.rsi < 30 ? 'text-green-400' : result.rsi > 70 ? 'text-red-400' : 'text-muted-foreground'
                          }`}>
                          {result.rsi.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={
                              result.signal === 'buy'
                                ? 'bg-green-500/10 text-green-400 border-green-500/30'
                                : result.signal === 'sell'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                  : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                            }
                          >
                            {result.signal === 'buy' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {result.signal === 'sell' && <AlertCircle className="w-3 h-3 mr-1" />}
                            {result.signal.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-secondary/50 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${result.strength > 70 ? 'bg-green-500' :
                                  result.strength > 40 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                style={{ width: `${result.strength}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8">{result.strength.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSelectSymbol(result.symbol)}
                            className="text-purple-400 hover:text-purple-300"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>
        </div>
    </WindowModal>
  );
};

export default ScreenerModal;
