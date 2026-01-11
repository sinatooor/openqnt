import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Timeframe {
    value: string;
    label: string;
    minutes: number;
}

const TIMEFRAMES: Timeframe[] = [
    { value: '1m', label: '1m', minutes: 1 },
    { value: '5m', label: '5m', minutes: 5 },
    { value: '15m', label: '15m', minutes: 15 },
    { value: '30m', label: '30m', minutes: 30 },
    { value: '1h', label: '1H', minutes: 60 },
    { value: '4h', label: '4H', minutes: 240 },
    { value: '1d', label: '1D', minutes: 1440 },
    { value: '1w', label: '1W', minutes: 10080 },
];

interface TimeframeSelectorProps {
    value: string;
    onChange: (value: string) => void;
    availableTimeframes?: string[];
    size?: 'sm' | 'default' | 'lg';
    className?: string;
}

export const TimeframeSelector = ({
    value,
    onChange,
    availableTimeframes,
    size = 'default',
    className,
}: TimeframeSelectorProps) => {
    const timeframes = availableTimeframes
        ? TIMEFRAMES.filter((tf) => availableTimeframes.includes(tf.value))
        : TIMEFRAMES;

    const buttonSize = size === 'sm' ? 'h-7 px-2 text-xs' : size === 'lg' ? 'h-10 px-4' : 'h-8 px-3 text-sm';

    return (
        <div className={cn('inline-flex rounded-md border bg-muted/50 p-1', className)}>
            {timeframes.map((tf) => (
                <Button
                    key={tf.value}
                    variant={value === tf.value ? 'secondary' : 'ghost'}
                    className={cn(
                        buttonSize,
                        'rounded-sm font-mono',
                        value === tf.value && 'bg-background shadow-sm'
                    )}
                    onClick={() => onChange(tf.value)}
                >
                    {tf.label}
                </Button>
            ))}
        </div>
    );
};

// Compact variant for toolbars
export const TimeframeSelectorCompact = ({
    value,
    onChange,
    className,
}: Omit<TimeframeSelectorProps, 'size'>) => {
    const compactTimeframes = TIMEFRAMES.filter((tf) =>
        ['1m', '5m', '1h', '4h', '1d'].includes(tf.value)
    );

    return (
        <div className={cn('inline-flex gap-1', className)}>
            {compactTimeframes.map((tf) => (
                <Button
                    key={tf.value}
                    variant={value === tf.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 px-2 text-xs font-mono"
                    onClick={() => onChange(tf.value)}
                >
                    {tf.label}
                </Button>
            ))}
        </div>
    );
};

// Helper to convert timeframe string to minutes
export const timeframeToMinutes = (tf: string): number => {
    const found = TIMEFRAMES.find((t) => t.value === tf);
    return found?.minutes || 60;
};

// Helper to format timeframe for display
export const formatTimeframe = (tf: string): string => {
    const found = TIMEFRAMES.find((t) => t.value === tf);
    return found?.label || tf;
};

export default TimeframeSelector;
