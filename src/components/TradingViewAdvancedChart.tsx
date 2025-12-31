import React, { useEffect, useRef, memo } from 'react';

interface TradingViewAdvancedChartProps {
    symbol?: string;
    interval?: string;
    theme?: 'dark' | 'light';
    className?: string;
}

function TradingViewAdvancedChartComponent({
    symbol = 'NASDAQ:AAPL',
    interval = 'D',
    theme = 'dark',
    className = '',
}: TradingViewAdvancedChartProps) {
    const container = useRef<HTMLDivElement>(null);
    const scriptRef = useRef<HTMLScriptElement | null>(null);

    useEffect(() => {
        // Clean up previous widget
        if (container.current) {
            const widgetDiv = container.current.querySelector('.tradingview-widget-container__widget');
            if (widgetDiv) {
                widgetDiv.innerHTML = '';
            }
            if (scriptRef.current) {
                scriptRef.current.remove();
            }
        }

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.type = 'text/javascript';
        script.async = true;
        script.innerHTML = JSON.stringify({
            allow_symbol_change: true,
            calendar: false,
            details: false,
            hide_side_toolbar: false,
            hide_top_toolbar: false,
            hide_legend: false,
            hide_volume: false,
            hotlist: false,
            interval: interval,
            locale: 'en',
            save_image: true,
            style: '1',
            symbol: symbol,
            theme: theme,
            timezone: 'Etc/UTC',
            backgroundColor: '#0F0F0F',
            gridColor: 'rgba(242, 242, 242, 0.06)',
            watchlist: [],
            withdateranges: false,
            compareSymbols: [
                {
                    symbol: 'SP:SPX',
                    position: 'SameScale',
                },
            ],
            show_popup_button: true,
            popup_height: '650',
            popup_width: '1000',
            studies: ['STD;MA%1Cross', 'STD;Divergence%1Indicator'],
            autosize: true,
        });

        scriptRef.current = script;
        container.current?.appendChild(script);

        return () => {
            if (scriptRef.current) {
                scriptRef.current.remove();
            }
        };
    }, [symbol, interval, theme]);

    return (
        <div
            className={`tradingview-widget-container ${className}`}
            ref={container}
            style={{ height: '100%', width: '100%' }}
        >
            <div
                className="tradingview-widget-container__widget"
                style={{ height: 'calc(100% - 32px)', width: '100%' }}
            />
            <div className="tradingview-widget-copyright text-[10px] text-muted-foreground/50 px-2 py-1">
                <a
                    href={`https://www.tradingview.com/symbols/${symbol.replace(':', '-')}/`}
                    rel="noopener nofollow"
                    target="_blank"
                    className="text-blue-400/70 hover:text-blue-400"
                >
                    <span>{symbol}</span>
                </a>
                <span className="ml-1">by TradingView</span>
            </div>
        </div>
    );
}

export const TradingViewAdvancedChart = memo(TradingViewAdvancedChartComponent);
