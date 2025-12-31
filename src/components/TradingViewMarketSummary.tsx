import React, { useEffect, useRef, memo } from 'react';

interface TradingViewMarketSummaryProps {
    direction?: 'horizontal' | 'vertical';
    theme?: 'dark' | 'light';
    className?: string;
}

function TradingViewMarketSummaryComponent({
    direction = 'horizontal',
    theme = 'dark',
    className = '',
}: TradingViewMarketSummaryProps) {
    const container = useRef<HTMLDivElement>(null);
    const scriptRef = useRef<HTMLScriptElement | null>(null);

    useEffect(() => {
        if (!container.current) return;

        // Clean up previous widget
        container.current.innerHTML = '';
        if (scriptRef.current) {
            scriptRef.current.remove();
        }

        // Create the custom element
        const widget = document.createElement('tv-market-summary');
        widget.setAttribute('direction', direction);
        widget.setAttribute('theme', theme);
        container.current.appendChild(widget);

        // Add the script
        const script = document.createElement('script');
        script.src = 'https://widgets.tradingview-widget.com/w/en/tv-market-summary.js';
        script.type = 'module';
        script.async = true;
        scriptRef.current = script;
        container.current.appendChild(script);

        return () => {
            if (scriptRef.current) {
                scriptRef.current.remove();
            }
        };
    }, [direction, theme]);

    return (
        <div
            ref={container}
            className={`tradingview-market-summary ${className}`}
            style={{
                width: '100%',
                height: direction === 'horizontal' ? '48px' : '100%',
                overflow: 'hidden',
            }}
        />
    );
}

export const TradingViewMarketSummary = memo(TradingViewMarketSummaryComponent);
