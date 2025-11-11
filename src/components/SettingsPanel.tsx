import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const SettingsPanel = () => {
  const [mode, setMode] = useState<"backtest" | "live">("live");

  return (
    <div className="w-80 bg-card border-l border-border p-6 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <Button
            variant={mode === "backtest" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("backtest")}
          >
            Backtest
          </Button>
          <Button
            variant={mode === "live" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMode("live")}
          >
            Live
          </Button>
        </div>
        <Button variant="ghost" size="icon">
          <X size={20} />
        </Button>
      </div>

      <div className="space-y-6 flex-1">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Trading:
          </label>
          <Select defaultValue="tsla">
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
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Broker:
          </label>
          <Select defaultValue="td">
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
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Leverage:
          </label>
          <Select defaultValue="50">
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
      </div>

      <Button className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold py-6 text-base">
        Launch
      </Button>
    </div>
  );
};
