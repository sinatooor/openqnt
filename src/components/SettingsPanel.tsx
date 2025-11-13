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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";

export const SettingsPanel = () => {
  const [mode, setMode] = useState<"backtest" | "live">("live");
  const [tradingSymbol, setTradingSymbol] = useState("BTC/USDT");
  const [broker, setBroker] = useState("td");
  const [isConnected, setIsConnected] = useState(false);
  const [tradingOpen, setTradingOpen] = useState(true);
  const [executionOpen, setExecutionOpen] = useState(true);
  const [dailyLossLimit, setDailyLossLimit] = useState("500");
  const [maxDrawdown, setMaxDrawdown] = useState("10");

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Settings</h2>
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
            <span className="font-medium text-foreground">{tradingSymbol}</span>
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
                  <SelectItem value="BTC/USDT">BTC/USDT</SelectItem>
                  <SelectItem value="ETH/USDT">ETH/USDT</SelectItem>
                  <SelectItem value="BNB/USDT">BNB/USDT</SelectItem>
                  <SelectItem value="SOL/USDT">SOL/USDT</SelectItem>
                  <SelectItem value="XRP/USDT">XRP/USDT</SelectItem>
                  <SelectItem value="ADA/USDT">ADA/USDT</SelectItem>
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

        {/* Risk Protection */}
        <Collapsible open={executionOpen} onOpenChange={setExecutionOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-foreground hover:text-foreground/80 transition-colors py-2">
            <span>Risk Protection</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${executionOpen ? 'transform rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label htmlFor="dailyLossLimit" className="text-sm text-muted-foreground">
                Daily Loss Limit ($)
              </Label>
              <Input
                id="dailyLossLimit"
                type="number"
                value={dailyLossLimit}
                onChange={(e) => setDailyLossLimit(e.target.value)}
                className="h-9 bg-background"
                placeholder="500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxDrawdown" className="text-sm text-muted-foreground">
                Max Drawdown (%)
              </Label>
              <Input
                id="maxDrawdown"
                type="number"
                value={maxDrawdown}
                onChange={(e) => setMaxDrawdown(e.target.value)}
                className="h-9 bg-background"
                placeholder="10"
              />
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
