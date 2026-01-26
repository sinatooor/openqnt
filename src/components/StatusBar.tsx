
import { useState } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useQuery } from "@tanstack/react-query";
import { fetchTradeSummary } from "@/services/trades";
import { cn } from "@/lib/utils";
import {
    Activity,
    Wifi,
    WifiOff,
    GitBranch,
    ChevronUp,
    Check,
    Users,
    Plus
} from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator
} from "@/components/ui/command";
import { SystemStatus } from "./SystemStatus";
import { NotificationCenter } from "./NotificationCenter";

const MAX_STRATEGIES = 8;

interface StatusBarProps {
    currentStrategyName: string;
    onLoadStrategy: (xml: string, name: string) => void;
    onNewStrategy?: () => void;
}

export const StatusBar = ({ currentStrategyName, onLoadStrategy, onNewStrategy }: StatusBarProps) => {
    const [openStrategySelector, setOpenStrategySelector] = useState(false);
    const { savedStrategies } = useUserProfile();

    // Fetch trade stats for profit
    const { data: tradeSummary } = useQuery({
        queryKey: ['trade-summary'],
        queryFn: fetchTradeSummary,
        refetchInterval: 30000,
    });

    // Mock active agents for now - or fetch if available
    // Assuming 1 active agent if system is online, else 0? 
    // Or just a static number for now as per system capability.
    const activeAgents = 1; // Placeholder

    return (
        <div className="h-6 bg-card border-t border-border text-[10px] flex items-center justify-between px-2 select-none text-muted-foreground transition-colors">
            {/* Left Section: Strategy Selector (Branch-like) */}
            <div className="flex items-center gap-4">
                <Popover open={openStrategySelector} onOpenChange={setOpenStrategySelector}>
                    <PopoverTrigger asChild>
                        <button className="flex items-center gap-1 hover:bg-muted/50 hover:text-foreground px-1.5 py-0.5 rounded-sm transition-colors focus:outline-none">
                            <GitBranch className="w-3 h-3" />
                            <span className="font-medium max-w-[140px] truncate">
                                {currentStrategyName || "Untitled Strategy"}
                            </span>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0 mb-1 z-[1100]" side="top" align="start">
                        <Command>
                            <CommandInput placeholder="Switch strategy..." />
                            <CommandList>
                                <CommandEmpty>No strategies found.</CommandEmpty>
                                {/* New Strategy Option */}
                                {onNewStrategy && savedStrategies.length < MAX_STRATEGIES && (
                                    <CommandGroup>
                                        <CommandItem
                                            onSelect={() => {
                                                onNewStrategy();
                                                setOpenStrategySelector(false);
                                            }}
                                            className="text-primary"
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            New Strategy
                                            <span className="ml-auto text-xs text-muted-foreground">
                                                {savedStrategies.length}/{MAX_STRATEGIES}
                                            </span>
                                        </CommandItem>
                                    </CommandGroup>
                                )}
                                {savedStrategies.length >= MAX_STRATEGIES && (
                                    <CommandGroup>
                                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                            Max {MAX_STRATEGIES} strategies reached
                                        </div>
                                    </CommandGroup>
                                )}
                                <CommandSeparator />
                                <CommandGroup heading="Saved Strategies">
                                    {savedStrategies.map((strategy) => (
                                        <CommandItem
                                            key={strategy.id}
                                            value={strategy.name}
                                            onSelect={() => {
                                                onLoadStrategy(strategy.xml, strategy.name);
                                                setOpenStrategySelector(false);
                                            }}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    currentStrategyName === strategy.name
                                                        ? "opacity-100"
                                                        : "opacity-0"
                                                )}
                                            />
                                            {strategy.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

                <div className="flex items-center gap-1.5 hover:bg-muted/50 hover:text-foreground px-2 py-0.5 rounded-sm cursor-pointer transition-colors" title="Active Agents">
                    <Users className="w-3.5 h-3.5" />
                    <span>{activeAgents} Agent{activeAgents !== 1 ? 's' : ''} Active</span>
                </div>
            </div>

            {/* Right Section: Stats & System Status */}
            <div className="flex items-center gap-4">
                {/* Total Profit */}
                <div className="flex items-center gap-1.5 px-2 py-0.5" title="Total Profit">
                    <span className={cn(
                        "font-medium transition-colors",
                        (tradeSummary?.total_pnl || 0) >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                        PnL: ${(tradeSummary?.total_pnl || 0).toFixed(2)}
                    </span>
                </div>

                {/* Latency Mock */}
                <div className="flex items-center gap-1.5 hover:bg-muted/50 hover:text-foreground px-2 py-0.5 rounded-sm cursor-pointer transition-colors" title="Network Latency">
                    <Activity className="w-3.5 h-3.5" />
                    <span>24ms</span>
                </div>

                {/* System Status */}
                <SystemStatusInBar />

                {/* Notifications */}
                <NotificationCenter className="h-6 w-6" />
            </div>
        </div>
    );
};

// Internal minimal system status for the bar
const SystemStatusInBar = () => {
    return (
        <div className="flex items-center gap-1.5 hover:bg-muted/50 hover:text-foreground px-2 py-0.5 rounded-sm cursor-pointer transition-colors">
            <SystemStatus className="bg-transparent border-0 p-0 shadow-none text-inherit text-xs" />
        </div>
    );
}
