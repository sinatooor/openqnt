/**
 * GipView — Bloomberg-style GIP (Intraday Graph) implemented on top of
 * TradingView's lightweight-charts v5.  Features:
 *
 *   • Chart types: candles / bars / line / area
 *   • Intervals: 1m / 5m / 15m / 30m / 60m
 *   • Extended-hours toggle (pre-market + after-hours bars)
 *   • Volume histogram in a separate pane, coloured by up/down bar
 *   • VWAP overlay (toggleable) and SMA20 overlay (toggleable)
 *   • Dashed previous-close reference line
 *   • OHLC quote strip above the chart
 *   • Floating crosshair legend with OHLCV at the hovered timestamp
 *
 * The component stays agnostic of the data source — it accepts a `GipData`
 * payload so the same chart renders equally well from the mock generator
 * today and a live feed tomorrow.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { GipBar, GipData, GipInterval } from './mockData';
import './gip.css';

export type ChartType = 'candles' | 'bars' | 'line' | 'area';

export interface GipViewProps {
  data: GipData;
  interval: GipInterval;
  chartType: ChartType;
  extendedHours: boolean;
  showVwap: boolean;
  showSma: boolean;
  onChangeInterval: (v: GipInterval) => void;
  onChangeChartType: (v: ChartType) => void;
  onToggleExtendedHours: (v: boolean) => void;
  onToggleVwap: (v: boolean) => void;
  onToggleSma: (v: boolean) => void;
}

/* ------------------------------- helpers --------------------------------- */

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function fmtVolume(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function calcSma(bars: GipBar[], period: number): { time: UTCTimestamp; value: number }[] {
  const out: { time: UTCTimestamp; value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i += 1) {
    sum += bars[i].close;
    if (i >= period) sum -= bars[i - period].close;
    if (i >= period - 1) {
      out.push({ time: bars[i].time as UTCTimestamp, value: sum / period });
    }
  }
  return out;
}

/* ------------------------------- quote strip ----------------------------- */

function QuoteStrip({ data }: { data: GipData }) {
  const q = data.quote;
  const up = q.change >= 0;
  return (
    <div className="gip-quote">
      <div className="gip-quote-main">
        <span className="gip-quote-ticker">{data.center.ticker}</span>
        <span className="gip-quote-name">{data.center.name}</span>
        <span className="gip-quote-ex">{data.center.exchange}</span>
      </div>
      <div className="gip-quote-prices">
        <div className={`gip-quote-last ${up ? 'gip-up' : 'gip-down'}`}>
          <b>{fmtUsd(q.last)}</b>
          <em>
            {up ? '+' : ''}
            {q.change.toFixed(2)} ({fmtPct(q.changePct)})
          </em>
        </div>
        <div className="gip-quote-cell">
          <span>BID</span>
          <b>{fmtUsd(q.bid)}</b>
          <em>{q.bidSize.toLocaleString()}</em>
        </div>
        <div className="gip-quote-cell">
          <span>ASK</span>
          <b>{fmtUsd(q.ask)}</b>
          <em>{q.askSize.toLocaleString()}</em>
        </div>
        <div className="gip-quote-cell">
          <span>OPEN</span>
          <b>{fmtUsd(q.dayOpen)}</b>
        </div>
        <div className="gip-quote-cell">
          <span>HIGH</span>
          <b>{fmtUsd(q.dayHigh)}</b>
        </div>
        <div className="gip-quote-cell">
          <span>LOW</span>
          <b>{fmtUsd(q.dayLow)}</b>
        </div>
        <div className="gip-quote-cell">
          <span>PREV</span>
          <b>{fmtUsd(data.center.prevClose)}</b>
        </div>
        <div className="gip-quote-cell">
          <span>VWAP</span>
          <b>{fmtUsd(q.vwap)}</b>
        </div>
        <div className="gip-quote-cell">
          <span>VOL</span>
          <b>{fmtVolume(q.dayVolume)}</b>
          <em>avg {fmtVolume(data.center.avgDailyVolumeM * 1_000_000)}</em>
        </div>
        <div className="gip-quote-cell">
          <span>TRADES</span>
          <b>{fmtVolume(q.tradeCount)}</b>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- toolbar ------------------------------- */

const INTERVALS: GipInterval[] = ['1m', '5m', '15m', '30m', '60m'];

interface ToolbarProps {
  interval: GipInterval;
  chartType: ChartType;
  extendedHours: boolean;
  showVwap: boolean;
  showSma: boolean;
  onChangeInterval: (v: GipInterval) => void;
  onChangeChartType: (v: ChartType) => void;
  onToggleExtendedHours: (v: boolean) => void;
  onToggleVwap: (v: boolean) => void;
  onToggleSma: (v: boolean) => void;
}

function Toolbar(p: ToolbarProps) {
  return (
    <div className="gip-toolbar">
      <div className="gip-toolbar-group">
        <span className="gip-toolbar-label">INTERVAL</span>
        <div className="gip-segmented">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              className={iv === p.interval ? 'on' : ''}
              onClick={() => p.onChangeInterval(iv)}
            >
              {iv}
            </button>
          ))}
        </div>
      </div>

      <div className="gip-toolbar-group">
        <span className="gip-toolbar-label">TYPE</span>
        <div className="gip-segmented">
          {(['candles', 'bars', 'line', 'area'] as ChartType[]).map((ct) => (
            <button
              key={ct}
              className={ct === p.chartType ? 'on' : ''}
              onClick={() => p.onChangeChartType(ct)}
            >
              {ct.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="gip-toolbar-group">
        <label className="gip-check">
          <input
            type="checkbox"
            checked={p.extendedHours}
            onChange={(e) => p.onToggleExtendedHours(e.target.checked)}
          />
          Extended Hours
        </label>
        <label className="gip-check">
          <input
            type="checkbox"
            checked={p.showVwap}
            onChange={(e) => p.onToggleVwap(e.target.checked)}
          />
          VWAP
        </label>
        <label className="gip-check">
          <input
            type="checkbox"
            checked={p.showSma}
            onChange={(e) => p.onToggleSma(e.target.checked)}
          />
          SMA20
        </label>
      </div>
    </div>
  );
}

/* ------------------------------ crosshair hud ---------------------------- */

interface HoverState {
  bar?: GipBar;
  vwap?: number;
  sma?: number;
}

/* ---------------------------------- root --------------------------------- */

export default function GipView(props: GipViewProps) {
  const {
    data,
    chartType,
    showVwap,
    showSma,
    extendedHours,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick' | 'Bar' | 'Line' | 'Area'> | null>(null);
  const volSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const prevCloseLineRef = useRef<IPriceLine | null>(null);
  const [hover, setHover] = useState<HoverState>({});

  // Memoise transformed series data.
  const mainData = useMemo(() => {
    return data.bars.map((b) => ({
      time: b.time as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
  }, [data.bars]);

  const lineData = useMemo(
    () => data.bars.map((b) => ({ time: b.time as UTCTimestamp, value: b.close })),
    [data.bars],
  );

  const volumeData = useMemo(
    () =>
      data.bars.map((b) => ({
        time: b.time as UTCTimestamp,
        value: b.volume,
        color: b.close >= b.open ? 'rgba(16, 185, 129, 0.55)' : 'rgba(239, 68, 68, 0.55)',
      })),
    [data.bars],
  );

  const vwapData = useMemo(
    () => data.bars.map((b) => ({ time: b.time as UTCTimestamp, value: b.vwap })),
    [data.bars],
  );

  const smaData = useMemo(() => calcSma(data.bars, 20), [data.bars]);

  /* --- Build / rebuild chart on structural changes ----------------------- */
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#050505' },
        textColor: '#d4d4d8',
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        panes: { separatorColor: '#332200', separatorHoverColor: '#ff9f1a', enableResize: false },
      },
      grid: {
        vertLines: { color: '#141414' },
        horzLines: { color: '#141414' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#ff9f1a', width: 1, style: LineStyle.Dotted, labelBackgroundColor: '#141005' },
        horzLine: { color: '#ff9f1a', width: 1, style: LineStyle.Dotted, labelBackgroundColor: '#141005' },
      },
      rightPriceScale: {
        borderColor: '#332200',
        scaleMargins: { top: 0.08, bottom: 0.05 },
      },
      timeScale: {
        borderColor: '#332200',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
      },
      autoSize: true,
      localization: {
        priceFormatter: (p: number) => `$${p.toFixed(2)}`,
      },
    });
    chartRef.current = chart;

    // Main price series based on chart type.
    let mainSeries: ISeriesApi<'Candlestick' | 'Bar' | 'Line' | 'Area'>;
    if (chartType === 'candles') {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      }) as ISeriesApi<'Candlestick'>;
    } else if (chartType === 'bars') {
      mainSeries = chart.addSeries(BarSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        thinBars: false,
      }) as ISeriesApi<'Bar'>;
    } else if (chartType === 'area') {
      mainSeries = chart.addSeries(AreaSeries, {
        lineColor: '#ff9f1a',
        topColor: 'rgba(255, 159, 26, 0.35)',
        bottomColor: 'rgba(255, 159, 26, 0.03)',
        lineWidth: 2,
      }) as ISeriesApi<'Area'>;
    } else {
      mainSeries = chart.addSeries(LineSeries, {
        color: '#ff9f1a',
        lineWidth: 2,
        priceLineVisible: false,
      }) as ISeriesApi<'Line'>;
    }
    mainSeriesRef.current = mainSeries;

    // Volume pane (index 1).
    const volSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume-pane',
        lastValueVisible: false,
        priceLineVisible: false,
      },
      1,
    );
    volSeriesRef.current = volSeries;
    chart.priceScale('volume-pane').applyOptions({
      scaleMargins: { top: 0.1, bottom: 0 },
    });

    // VWAP (toggleable).
    if (showVwap) {
      const vwapSeries = chart.addSeries(LineSeries, {
        color: '#22d3ee',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        title: 'VWAP',
      });
      vwapSeriesRef.current = vwapSeries;
    } else {
      vwapSeriesRef.current = null;
    }

    // SMA20 (toggleable).
    if (showSma) {
      const smaSeries = chart.addSeries(LineSeries, {
        color: '#f472b6',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: true,
        title: 'SMA20',
      });
      smaSeriesRef.current = smaSeries;
    } else {
      smaSeriesRef.current = null;
    }

    // Size panes so the volume sub-pane is ~20% of the height.
    requestAnimationFrame(() => {
      const panes = chart.panes();
      if (panes.length >= 2) {
        const totalHeight = containerRef.current?.clientHeight ?? 480;
        panes[0].setHeight(Math.round(totalHeight * 0.78));
        panes[1].setHeight(Math.round(totalHeight * 0.22));
      }
    });

    // Crosshair → hover state
    const onMove = (param: MouseEventParams<Time>) => {
      if (!param.time) {
        setHover({});
        return;
      }
      const ts = param.time as UTCTimestamp;
      const bar = data.bars.find((b) => b.time === ts);
      const vwapPt = vwapData.find((p) => p.time === ts)?.value;
      const smaPt = smaData.find((p) => p.time === ts)?.value;
      setHover({ bar, vwap: vwapPt, sma: smaPt });
    };
    chart.subscribeCrosshairMove(onMove);

    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volSeriesRef.current = null;
      vwapSeriesRef.current = null;
      smaSeriesRef.current = null;
      prevCloseLineRef.current = null;
    };
    // Rebuild when chart type / indicators / extended-hours change because
    // those affect which series + pane layout are present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, showVwap, showSma, extendedHours]);

  /* --- Push data into the already-built series --------------------------- */
  useEffect(() => {
    const main = mainSeriesRef.current;
    const vol = volSeriesRef.current;
    if (!main || !vol) return;

    if (chartType === 'line' || chartType === 'area') {
      main.setData(lineData);
    } else {
      main.setData(mainData);
    }
    vol.setData(volumeData);
    vwapSeriesRef.current?.setData(vwapData);
    smaSeriesRef.current?.setData(smaData);

    // Previous-close reference line (remove old first if present).
    if (prevCloseLineRef.current) {
      try {
        main.removePriceLine(prevCloseLineRef.current);
      } catch {
        /* noop — series may have been swapped */
      }
    }
    prevCloseLineRef.current = main.createPriceLine({
      price: data.center.prevClose,
      color: '#71717a',
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      axisLabelVisible: true,
      title: 'PREV',
    });

    chartRef.current?.timeScale().fitContent();
  }, [chartType, mainData, lineData, volumeData, vwapData, smaData, data.center.prevClose]);

  /* ---------------------------------------------------------------------- */

  return (
    <div className="gip-root">
      <QuoteStrip data={data} />
      <Toolbar {...props} />

      <div className="gip-chart-wrap">
        <div className="gip-chart" ref={containerRef} />
        {hover.bar && (
          <div className="gip-hud">
            <span className="gip-hud-time">{fmtTime(hover.bar.time)}</span>
            <span>
              <em>O</em>
              <b>{hover.bar.open.toFixed(2)}</b>
            </span>
            <span>
              <em>H</em>
              <b>{hover.bar.high.toFixed(2)}</b>
            </span>
            <span>
              <em>L</em>
              <b>{hover.bar.low.toFixed(2)}</b>
            </span>
            <span className={hover.bar.close >= hover.bar.open ? 'gip-up' : 'gip-down'}>
              <em>C</em>
              <b>{hover.bar.close.toFixed(2)}</b>
            </span>
            <span>
              <em>V</em>
              <b>{fmtVolume(hover.bar.volume)}</b>
            </span>
            {hover.vwap !== undefined && (
              <span className="gip-hud-vwap">
                <em>VWAP</em>
                <b>{hover.vwap.toFixed(2)}</b>
              </span>
            )}
            {hover.sma !== undefined && (
              <span className="gip-hud-sma">
                <em>SMA20</em>
                <b>{hover.sma.toFixed(2)}</b>
              </span>
            )}
            <span className={`gip-hud-session gip-session-${hover.bar.session}`}>
              {hover.bar.session === 'pre' ? 'PRE-MKT' : hover.bar.session === 'after' ? 'AFTER-HRS' : 'REGULAR'}
            </span>
          </div>
        )}
      </div>

      <div className="gip-footer">
        <span>
          {data.bars.length.toLocaleString()} bars · {props.interval} · {extendedHours ? 'Extended' : 'Regular'} hrs
        </span>
        <span className="gip-footer-spacer" />
        <span>Trading date: {data.tradingDate}</span>
      </div>
    </div>
  );
}
