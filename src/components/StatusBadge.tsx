import { cn } from '@/lib/utils';
import {
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    Loader2,
    Circle,
    Pause,
    Play
} from 'lucide-react';

type StatusType =
    | 'success'
    | 'error'
    | 'warning'
    | 'info'
    | 'pending'
    | 'running'
    | 'stopped'
    | 'paused'
    | 'idle';

interface StatusBadgeProps {
    status: StatusType;
    label?: string;
    showIcon?: boolean;
    size?: 'sm' | 'default' | 'lg';
    pulse?: boolean;
    className?: string;
}

const statusConfig: Record<StatusType, {
    icon: typeof CheckCircle;
    iconClass: string;
    bgClass: string;
    textClass: string;
    label: string;
}> = {
    success: {
        icon: CheckCircle,
        iconClass: 'text-green-500',
        bgClass: 'bg-green-500/10 border-green-500/20',
        textClass: 'text-green-600',
        label: 'Success',
    },
    error: {
        icon: XCircle,
        iconClass: 'text-red-500',
        bgClass: 'bg-red-500/10 border-red-500/20',
        textClass: 'text-red-600',
        label: 'Error',
    },
    warning: {
        icon: AlertTriangle,
        iconClass: 'text-yellow-500',
        bgClass: 'bg-yellow-500/10 border-yellow-500/20',
        textClass: 'text-yellow-600',
        label: 'Warning',
    },
    info: {
        icon: Circle,
        iconClass: 'text-blue-500',
        bgClass: 'bg-blue-500/10 border-blue-500/20',
        textClass: 'text-blue-600',
        label: 'Info',
    },
    pending: {
        icon: Clock,
        iconClass: 'text-gray-500',
        bgClass: 'bg-gray-500/10 border-gray-500/20',
        textClass: 'text-gray-600',
        label: 'Pending',
    },
    running: {
        icon: Loader2,
        iconClass: 'text-blue-500 animate-spin',
        bgClass: 'bg-blue-500/10 border-blue-500/20',
        textClass: 'text-blue-600',
        label: 'Running',
    },
    stopped: {
        icon: XCircle,
        iconClass: 'text-gray-500',
        bgClass: 'bg-gray-500/10 border-gray-500/20',
        textClass: 'text-gray-600',
        label: 'Stopped',
    },
    paused: {
        icon: Pause,
        iconClass: 'text-yellow-500',
        bgClass: 'bg-yellow-500/10 border-yellow-500/20',
        textClass: 'text-yellow-600',
        label: 'Paused',
    },
    idle: {
        icon: Circle,
        iconClass: 'text-gray-400',
        bgClass: 'bg-gray-400/10 border-gray-400/20',
        textClass: 'text-gray-500',
        label: 'Idle',
    },
};

export const StatusBadge = ({
    status,
    label,
    showIcon = true,
    size = 'default',
    pulse = false,
    className,
}: StatusBadgeProps) => {
    const config = statusConfig[status] || statusConfig.idle;
    const Icon = config.icon;

    const sizeClasses = {
        sm: 'text-xs px-1.5 py-0.5 gap-1',
        default: 'text-sm px-2 py-1 gap-1.5',
        lg: 'text-base px-3 py-1.5 gap-2',
    };

    const iconSizes = {
        sm: 'w-3 h-3',
        default: 'w-4 h-4',
        lg: 'w-5 h-5',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border font-medium',
                config.bgClass,
                config.textClass,
                sizeClasses[size],
                pulse && 'animate-pulse',
                className
            )}
        >
            {showIcon && (
                <Icon className={cn(iconSizes[size], config.iconClass)} />
            )}
            {label || config.label}
        </span>
    );
};

// Dot-only status indicator
export const StatusDot = ({
    status,
    pulse = false,
    size = 'default'
}: {
    status: StatusType;
    pulse?: boolean;
    size?: 'sm' | 'default' | 'lg';
}) => {
    const config = statusConfig[status];

    const sizeClasses = {
        sm: 'w-2 h-2',
        default: 'w-3 h-3',
        lg: 'w-4 h-4',
    };

    return (
        <span className="relative inline-flex">
            <span
                className={cn(
                    'rounded-full',
                    sizeClasses[size],
                    config.iconClass.replace('text-', 'bg-')
                )}
            />
            {pulse && (
                <span
                    className={cn(
                        'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
                        config.iconClass.replace('text-', 'bg-')
                    )}
                />
            )}
        </span>
    );
};

export default StatusBadge;
