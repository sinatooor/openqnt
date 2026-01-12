/**
 * NotificationCenter - Dropdown panel for notification history
 * Shows all past notifications with filtering and management controls
 */

import { useState } from 'react';
import { useNotifications, NotificationType, Notification } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Bell,
    CheckCircle2,
    XCircle,
    Info,
    AlertTriangle,
    TrendingUp,
    Check,
    Trash2,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';

const typeConfig: Record<NotificationType, { icon: typeof Bell; color: string; label: string }> = {
    success: { icon: CheckCircle2, color: 'text-green-500', label: 'Success' },
    error: { icon: XCircle, color: 'text-red-500', label: 'Error' },
    info: { icon: Info, color: 'text-blue-500', label: 'Info' },
    warning: { icon: AlertTriangle, color: 'text-yellow-500', label: 'Warning' },
    trade: { icon: TrendingUp, color: 'text-purple-500', label: 'Trade' },
};

type FilterType = 'all' | NotificationType;

interface NotificationCenterProps {
    className?: string;
}

export const NotificationCenter = ({ className }: NotificationCenterProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState<FilterType>('all');
    const {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearAll,
    } = useNotifications();

    const filteredNotifications = filter === 'all'
        ? notifications
        : notifications.filter(n => n.type === filter);

    const formatTimestamp = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }
    };

    const filterButtons: { type: FilterType; label: string }[] = [
        { type: 'all', label: 'All' },
        { type: 'trade', label: 'Trades' },
        { type: 'success', label: 'Success' },
        { type: 'error', label: 'Errors' },
    ];

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("relative h-8 w-8", className)}
                >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 p-0 z-[1100]"
                align="end"
                side="top"
                sideOffset={8}
            >
                {/* Header */}
                <div className="px-3 py-2 border-b border-border">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">Notifications</h4>
                        <div className="flex gap-1">
                            {unreadCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={markAllAsRead}
                                >
                                    <Check className="h-3 w-3 mr-1" />
                                    Mark all read
                                </Button>
                            )}
                            {notifications.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-destructive hover:text-destructive"
                                    onClick={clearAll}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-1 mt-2">
                        {filterButtons.map(({ type, label }) => (
                            <Button
                                key={type}
                                variant={filter === type ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-6 text-xs px-2"
                                onClick={() => setFilter(type)}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Notification List */}
                <ScrollArea className="h-[300px]">
                    {filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                            <Bell className="h-8 w-8 mb-2 opacity-50" />
                            <p className="text-sm">No notifications</p>
                        </div>
                    ) : (
                        <div className="p-1">
                            {filteredNotifications.map((notification) => {
                                const config = typeConfig[notification.type];
                                const Icon = config.icon;

                                return (
                                    <div
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={cn(
                                            "flex gap-3 p-2 rounded-md cursor-pointer transition-colors",
                                            notification.read
                                                ? "opacity-60 hover:opacity-80"
                                                : "bg-muted/50 hover:bg-muted"
                                        )}
                                    >
                                        <div className={cn("mt-0.5", config.color)}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={cn(
                                                    "text-sm truncate",
                                                    !notification.read && "font-medium"
                                                )}>
                                                    {notification.title}
                                                </p>
                                                {!notification.read && (
                                                    <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                                                )}
                                            </div>
                                            {notification.description && (
                                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                                    {notification.description}
                                                </p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {formatTimestamp(notification.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
};

export default NotificationCenter;
