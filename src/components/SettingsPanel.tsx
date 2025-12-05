import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, TrendingUp, History, Network, Zap, AlertCircle, CheckCircle2, ChevronDown, Shield, DollarSign } from "lucide-react";
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
import { TourTriggerButton } from "./GuidedTour";
import { Wand2 } from "lucide-react";

interface SettingsPanelProps {
  onStartTour?: () => void;
  onToggleAI?: () => void;
  leverage?: string;
  onLeverageChange?: (value: string) => void;
}

export const SettingsPanel = ({ onStartTour, onToggleAI, leverage = "1", onLeverageChange }: SettingsPanelProps) => {
  const [mode, setMode] = useState<"backtest" | "live">("live");
  const [tradingSymbol, setTradingSymbol] = useState("BTC/USDT");
  const [broker, setBroker] = useState("td");
  const [isConnected, setIsConnected] = useState(false);
  const [tradingOpen, setTradingOpen] = useState(true);
  const [executionOpen, setExecutionOpen] = useState(true);
  const [capitalOpen, setCapitalOpen] = useState(true);
  const [riskOpen, setRiskOpen] = useState(true);
  const [capitalAllocation, setCapitalAllocation] = useState("10000");
  const [dailyLossLimit, setDailyLossLimit] = useState("500");
  const [maxDrawdown, setMaxDrawdown] = useState("10");

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="font-semibold text-foreground text-sm">Settings</h2>
          <div className="flex items-center gap-1">
            {onToggleAI && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onToggleAI}
                    variant="outline"
                    size="icon"
                    className="ai-panel-trigger hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200"
                    title="Toggle AI Assistant"
                  >
                    <Wand2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Toggle AI Assistant</p>
                </TooltipContent>
              </Tooltip>
            )}
            {onStartTour && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <TourTriggerButton onClick={onStartTour} className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Start Guided Tour</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
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

        {/* Capital Allocation */}
        <Collapsible open={capitalOpen} onOpenChange={setCapitalOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full group">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Capital Allocation</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${capitalOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4 animate-accordion-down">
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block cursor-help">
                    Strategy Capital ($)
                  </label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total capital allocated to this strategy</p>
                </TooltipContent>
              </Tooltip>
              <Input
                id="capitalAllocation"
                type="number"
                value={capitalAllocation}
                onChange={(e) => setCapitalAllocation(e.target.value)}
                className="bg-secondary"
                placeholder="10000"
              />
            </div>
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block cursor-help">
                    Account Leverage (x)
                  </label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Your account leverage (e.g. 25, 50, 100)</p>
                </TooltipContent>
              </Tooltip>
              <Input
                id="leverage"
                type="number"
                value={leverage}
                onChange={(e) => onLeverageChange?.(e.target.value)}
                className="bg-secondary"
                placeholder="1"
                min="1"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Risk Protection */}
        <Collapsible open={riskOpen} onOpenChange={setRiskOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full group">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Risk Protection</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${riskOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4 animate-accordion-down">
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block cursor-help">
                    Daily Loss Limit ($)
                  </label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum loss allowed per day</p>
                </TooltipContent>
              </Tooltip>
              <Input
                id="dailyLossLimit"
                type="number"
                value={dailyLossLimit}
                onChange={(e) => setDailyLossLimit(e.target.value)}
                className="bg-secondary"
                placeholder="500"
              />
            </div>
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block cursor-help">
                    Max Drawdown (%)
                  </label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum portfolio drawdown allowed</p>
                </TooltipContent>
              </Tooltip>
              <Input
                id="maxDrawdown"
                type="number"
                value={maxDrawdown}
                onChange={(e) => setMaxDrawdown(e.target.value)}
                className="bg-secondary"
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
