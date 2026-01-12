/**
 * TradeFeed - Real-time trade execution feed
 * Shows live trade updates with status, price, and PnL
 */

import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    CheckCircle,
    Circle,
    XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TradeEvent {
    id: number;
    symbol: string;
    direction: 'BUY' | 'SELL';
    entry_price: number;
    exit_price?: number;
    size: number;
    pnl?: number;
    status: 'PENDING' | 'OPEN' | 'CLOSED' | 'CANCELLED';
    entry_time: string;
    exit_time?: string;
}

interface TradeFeedProps {
    trades: TradeEvent[];
    isLive?: boolean;
    className?: string;
}

const statusConfig = {
    PENDING: { icon: Clock, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
    OPEN: { icon: Circle, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    CLOSED: { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-500/10' },
    CANCELLED: { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
};

export const TradeFeed = ({ trades, isLive = false, className }: TradeFeedProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new trades
    useEffect(() => {
        if (scrollRef.current && trades.length > 0) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [trades.length]);

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    if (trades.length === 0) {
        return (
            <div className={cn("flex items-center justify-center py-8 text-muted-foreground", className)}>
                <div className="text-center">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Waiting for trades...</p>
                    {isLive && (
                        <p className="text-xs mt-1 text-green-500 animate-pulse">● Live feed connected</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={cn("space-y-2", className)}>
            {isLive && (
                <div className="flex items-center gap-2 text-xs text-green-500 mb-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Live updates enabled
                </div>
            )}

            <ScrollArea className="h-[200px]" ref={scrollRef as any}>
                <div className="space-y-1 pr-2">
                    {trades.map((trade, index) => {
                        const config = statusConfig[trade.status] || statusConfig.PENDING;
                        const StatusIcon = config.icon;
                        const isNew = index === trades.length - 1;

                        return (
                            <div
                                key={trade.id}
                                className={cn(
                                    "flex items-center gap-2 p-2 rounded-lg border transition-all",
                                    config.bgColor,
                                    isNew && isLive && "animate-pulse border-primary"
                                )}
                            >
                                {/* Direction */}
                                <div className={cn(
                                    "flex items-center justify-center w-6 h-6 rounded",
                                    trade.direction === 'BUY' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                                )}>
                                    {trade.direction === 'BUY'
                                        ? <ArrowUpRight className="w-4 h-4" />
                                        : <ArrowDownRight className="w-4 h-4" />
                                    }
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-medium">{trade.symbol}</span>
                                        <Badge variant="outline" className={cn("text-[10px] h-4", config.color)}>
                                            <StatusIcon className="w-2 h-2 mr-1" />
                                            {trade.status}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                        <span>{formatTime(trade.entry_time)}</span>
                                        <span>@</span>
                                        <span className="font-mono">{trade.entry_price.toFixed(5)}</span>
                                        <span>×</span>
                                        <span>{trade.size}</span>
                                    </div>
                                </div>

                                {/* PnL */}
                                {trade.pnl !== undefined && trade.status === 'CLOSED' && (
                                    <div className={cn(
                                        "text-right font-mono text-sm font-bold",
                                        trade.pnl >= 0 ? "text-green-500" : "text-red-500"
                                    )}>
                                        {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
};

export default TradeFeed;
