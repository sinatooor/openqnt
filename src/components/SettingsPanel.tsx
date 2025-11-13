import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, TrendingUp, History, Network, Zap, AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";

export const SettingsPanel = () => {
  const [mode, setMode] = useState<"backtest" | "live">("live");
  const [tradingSymbol, setTradingSymbol] = useState("tsla");
  const [broker, setBroker] = useState("td");
  const [leverage, setLeverage] = useState("50");
  const [isConnected, setIsConnected] = useState(false);
  const [tradingOpen, setTradingOpen] = useState(true);
  const [executionOpen, setExecutionOpen] = useState(true);

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Settings</h2>
          <Button variant="ghost" size="icon">
            <X size={20} />
          </Button>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mode === "backtest" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMode("backtest")}
                className="flex-1 transition-all duration-200"
              >
                <History className="w-4 h-4 mr-2" />
                Backtest
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Test strategy on historical data</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mode === "live" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMode("live")}
                className="flex-1 transition-all duration-200"
              >
                <Zap className="w-4 h-4 mr-2" />
                Live
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Execute strategy in real-time</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="m-4 bg-secondary/50 border-border">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Mode:</span>
            <Badge variant={mode === "live" ? "default" : "secondary"} className="capitalize">
              {mode === "live" ? <Zap className="w-3 h-3 mr-1" /> : <History className="w-3 h-3 mr-1" />}
              {mode}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Symbol:</span>
            <span className="font-medium text-foreground">{tradingSymbol.toUpperCase()}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Leverage:</span>
            <span className="font-medium text-foreground">{leverage}x</span>
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status:</span>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-green-500 font-medium">Connected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  <span className="text-yellow-500 font-medium">Not Connected</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collapsible Settings */}
      <div className="flex-1 overflow-auto px-4 pb-4 space-y-4">
        {/* Trading Settings */}
        <Collapsible open={tradingOpen} onOpenChange={setTradingOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full group">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Trading</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${tradingOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4 animate-accordion-down">
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block cursor-help">
                    Trading Symbol
                  </label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select the financial instrument to trade</p>
                </TooltipContent>
              </Tooltip>
              <Select value={tradingSymbol} onValueChange={setTradingSymbol}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tsla">NASDAQ: TSLA</SelectItem>
                  <SelectItem value="aapl">NASDAQ: AAPL</SelectItem>
                  <SelectItem value="googl">NASDAQ: GOOGL</SelectItem>
                  <SelectItem value="msft">NASDAQ: MSFT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block cursor-help">
                    Leverage
                  </label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Trading leverage multiplier</p>
                  <p className="text-xs text-yellow-500 mt-1">⚠️ Higher leverage = Higher risk</p>
                </TooltipContent>
              </Tooltip>
              <Select value={leverage} onValueChange={setLeverage}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1x</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                  <SelectItem value="5">5x</SelectItem>
                  <SelectItem value="10">10x</SelectItem>
                  <SelectItem value="20">20x</SelectItem>
                  <SelectItem value="50">50x</SelectItem>
                  <SelectItem value="100">100x</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Execution Settings */}
        <Collapsible open={executionOpen} onOpenChange={setExecutionOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full group">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Execution</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${executionOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4 animate-accordion-down">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <label className="text-sm font-medium text-muted-foreground cursor-help">
                      Broker
                    </label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Select your brokerage platform</p>
                  </TooltipContent>
                </Tooltip>
                {isConnected && (
                  <Badge variant="outline" className="text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                )}
              </div>
              <Select value={broker} onValueChange={setBroker}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="td">TD Ameritrade</SelectItem>
                  <SelectItem value="ib">Interactive Brokers</SelectItem>
                  <SelectItem value="alpaca">Alpaca</SelectItem>
                  <SelectItem value="robinhood">Robinhood</SelectItem>
                </SelectContent>
              </Select>
              {!isConnected && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setIsConnected(true)}
                >
                  Connect to Broker
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Launch Button */}
      <div className="p-4 border-t border-border">
        <Button className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold py-6 text-base transition-all duration-200 hover:scale-[1.02]">
          Launch Strategy
        </Button>
      </div>
    </div>
  );
};
