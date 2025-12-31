import React, { useEffect, useRef, memo } from 'react';

interface TradingViewMarketOverviewProps {
    colorTheme?: 'dark' | 'light';
    className?: string;
    width?: string;
    height?: string;
}

function TradingViewMarketOverviewComponent({
    colorTheme = 'dark',
    className = '',
    width = '100%',
    height = '100%',
}: TradingViewMarketOverviewProps) {
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
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
        script.type = 'text/javascript';
        script.async = true;
        script.innerHTML = JSON.stringify({
            colorTheme: colorTheme,
            dateRange: '12M',
            locale: 'en',
            largeChartUrl: '',
            isTransparent: true,
            showFloatingTooltip: false,
            plotLineColorGrowing: 'rgba(41, 98, 255, 1)',
            plotLineColorFalling: 'rgba(255, 68, 68, 1)',
            gridLineColor: 'rgba(240, 243, 250, 0)',
            scaleFontColor: '#DBDBDB',
            belowLineFillColorGrowing: 'rgba(41, 98, 255, 0.12)',
            belowLineFillColorFalling: 'rgba(255, 68, 68, 0.12)',
            belowLineFillColorGrowingBottom: 'rgba(41, 98, 255, 0)',
            belowLineFillColorFallingBottom: 'rgba(255, 68, 68, 0)',
            symbolActiveColor: 'rgba(41, 98, 255, 0.12)',
            tabs: [
                {
                    title: 'Indices',
                    symbols: [
                        { s: 'FOREXCOM:SPXUSD', d: 'S&P 500' },
                        { s: 'FOREXCOM:NSXUSD', d: 'NASDAQ 100' },
                        { s: 'FOREXCOM:DJI', d: 'Dow Jones' },
                        { s: 'INDEX:NKY', d: 'Nikkei 225' },
                        { s: 'INDEX:DEU40', d: 'DAX' },
                        { s: 'FOREXCOM:UKXGBP', d: 'FTSE 100' },
                    ],
                    originalTitle: 'Indices',
                },
                {
                    title: 'Forex',
                    symbols: [
                        { s: 'FX:EURUSD', d: 'EUR/USD' },
                        { s: 'FX:GBPUSD', d: 'GBP/USD' },
                        { s: 'FX:USDJPY', d: 'USD/JPY' },
                        { s: 'FX:USDCHF', d: 'USD/CHF' },
                        { s: 'FX:AUDUSD', d: 'AUD/USD' },
                        { s: 'FX:USDCAD', d: 'USD/CAD' },
                    ],
                    originalTitle: 'Forex',
                },
                {
                    title: 'Futures',
                    symbols: [
                        { s: 'COMEX:GC1!', d: 'Gold' },
                        { s: 'NYMEX:CL1!', d: 'Crude Oil' },
                        { s: 'CBOT:ZC1!', d: 'Corn' },
                        { s: 'CBOT:ZS1!', d: 'Soybeans' },
                    ],
                    originalTitle: 'Futures',
                },
                {
                    title: 'Crypto',
                    symbols: [
                        { s: 'BINANCE:BTCUSDT', d: 'Bitcoin' },
                        { s: 'BINANCE:ETHUSDT', d: 'Ethereum' },
                        { s: 'BINANCE:SOLUSDT', d: 'Solana' },
                    ],
                    originalTitle: 'Crypto',
                },
            ],
            backgroundColor: 'transparent',
            width: width,
            height: height,
            showSymbolLogo: true,
            showChart: true,
        });

        scriptRef.current = script;
        container.current?.appendChild(script);

        return () => {
            if (scriptRef.current) {
                scriptRef.current.remove();
            }
        };
    }, [colorTheme, width, height]);

    return (
        <div
            className={`tradingview-widget-container ${className}`}
            ref={container}
            style={{ height: '100%', width: '100%' }}
        >
            <div className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }} />
        </div>
    );
}

export const TradingViewMarketOverview = memo(TradingViewMarketOverviewComponent);
