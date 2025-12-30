"""
Nautilus Visualizer - Generate interactive Bokeh charts for Nautilus backtest results

Creates HTML visualization similar to backtesting.py's bt.plot() output.
Now enhanced with Drawdown, Monthly Heatmap, and Trade Distribution analysis.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional
from datetime import datetime
import math

# Bokeh imports
from bokeh.plotting import figure
from bokeh.models import (
    ColumnDataSource, HoverTool, CrosshairTool, 
    Span, Label, Range1d, LinearAxis, NumeralTickFormatter,
    DatetimeTickFormatter, WheelZoomTool, BoxAnnotation,
    TabPanel, Tabs, Div
)
from bokeh.layouts import column, row, gridplot
from bokeh.io import output_file
from bokeh.embed import file_html
from bokeh.resources import CDN
from bokeh.transform import cumsum, transform
from bokeh.palettes import Category20c, RdYlGn11


# Colors matching backtesting.py style
BULL_COLOR = "#26a69a"  # Green for up candles
BEAR_COLOR = "#ef5350"  # Red for down candles
EQUITY_COLOR = "#2196f3"  # Blue for equity curve
ENTRY_COLOR = "#4caf50"  # Green for entry markers
EXIT_COLOR = "#ff5722"  # Orange for exit markers
DRAWDOWN_COLOR = "#e57373" # Red for drawdown


def generate_nautilus_chart(
    ohlcv_data: pd.DataFrame,
    trades: List[Dict],
    equity_curve: List[Dict],
    metrics: Dict,
    symbol: str = "Unknown",
    title: str = None
) -> str:
    """
    Generate an interactive Bokeh HTML dashboard for Nautilus backtest results.
    """
    if title is None:
        title = f"Nautilus Backtest: {symbol}"
    
    # 1. Prepare Data
    df = _prepare_ohlcv(ohlcv_data)
    
    # Calculate chart dimensions
    plot_width = 1100
    
    # ==================== TAB 1: MAIN CHARTS ====================
    
    # --- Price Chart ---
    p_price = _create_price_chart(df, trades, title, plot_width)
    
    # --- Equity Chart ---
    p_equity = _create_equity_chart(equity_curve, p_price.x_range, plot_width)
    
    # --- Drawdown Chart ---
    p_drawdown = _create_drawdown_chart(equity_curve, p_price.x_range, plot_width)
    
    # Layout for Tab 1
    tab1_layout = column(p_price, p_equity, p_drawdown)
    tab1 = TabPanel(child=tab1_layout, title="Charts")
    
    # ==================== TAB 2: ANALYSIS ====================
    
    # --- Monthly Heatmap ---
    p_heatmap = _create_monthly_heatmap(equity_curve)
    
    # --- Trade Distribution ---
    p_dist = _create_trade_distribution(trades)
    
    # Layout for Tab 2
    if p_heatmap and p_dist:
        tab2_layout = column(
            Div(text="<h3>Monthly Returns</h3>"),
            p_heatmap,
            Div(text="<h3>Trade P&L Distribution</h3>"),
            p_dist
        )
        tab2 = TabPanel(child=tab2_layout, title="Analysis")
        tabs = Tabs(tabs=[tab1, tab2])
    else:
        tabs = Tabs(tabs=[tab1])
    
    # ==================== METRICS ====================
    metrics_html = _generate_metrics_html(metrics, symbol)
    
    # Generate HTML
    html = file_html(tabs, CDN, title=title)
    
    # Inject metrics css/html
    html = html.replace(
        '</body>',
        f'''
        <div style="position: fixed; top: 60px; right: 20px; background: rgba(0,0,0,0.85); 
                    color: white; padding: 15px; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    max-width: 250px; z-index: 1000; backdrop-filter: blur(5px);">
            <h3 style="margin: 0 0 10px 0; border-bottom: 1px solid #555; padding-bottom: 5px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                Performance
            </h3>
            {metrics_html}
        </div>
        </body>
        '''
    )
    
    return html


def _prepare_ohlcv(data):
    df = data.copy()
    df.columns = [c.lower() if isinstance(c, str) else c for c in df.columns]
    
    # Index handling
    if 'timestamp' in df.columns:
        df['date'] = pd.to_datetime(df['timestamp'])
    elif 'date' in df.columns:
        df['date'] = pd.to_datetime(df['date'])
    elif df.index.name and 'date' in df.index.name.lower():
        df = df.reset_index()
        df['date'] = pd.to_datetime(df[df.columns[0]])
    else:
        df = df.reset_index()
        df['date'] = pd.to_datetime(df['index'])

    # Column name normalization
    for col in ['open', 'high', 'low', 'close']:
        if col not in df.columns and col.capitalize() in df.columns:
            df[col] = df[col.capitalize()]
            
    df['color'] = df.apply(lambda row: BULL_COLOR if row['close'] >= row['open'] else BEAR_COLOR, axis=1)
    return df


def _create_price_chart(df, trades, title, width):
    source = ColumnDataSource(df)
    
    p = figure(
        title=title,
        x_axis_type='datetime',
        width=width,
        height=450,
        tools="pan,box_zoom,wheel_zoom,reset,save,crosshair",
        active_drag="pan",
        active_scroll="wheel_zoom"
    )
    
    # Candles
    if len(df) > 1:
        bar_width = (df['date'].iloc[1] - df['date'].iloc[0]).total_seconds() * 1000 * 0.8
    else:
        bar_width = 86400 * 1000 * 0.8 # 1 day

    p.segment(x0='date', y0='high', x1='date', y1='low', source=source, color='color')
    p.vbar(x='date', width=bar_width, top='close', bottom='open', source=source, line_color='color', fill_color='color')
    
    # Hover
    hover = HoverTool(
        tooltips=[
            ("Date", "@date{%F %H:%M}"),
            ("Open", "@open{0,0.00}"),
            ("High", "@high{0,0.00}"),
            ("Low", "@low{0,0.00}"),
            ("Close", "@close{0,0.00}"),
        ],
        formatters={"@date": "datetime"},
        mode='vline'
    )
    p.add_tools(hover)
    
    # Trade Markers
    _add_trade_markers(p, trades)
    
    p.yaxis.formatter = NumeralTickFormatter(format="0,0.00")
    p.grid.grid_line_alpha = 0.3
    
    return p


def _add_trade_markers(p, trades):
    if not trades:
        return

    entry_data = {'date': [], 'price': [], 'type': []}
    exit_data = {'date': [], 'price': [], 'pnl': []}
    
    for t in trades:
        try:
            # Entry
            entry_data['date'].append(pd.to_datetime(t['entry_time']))
            entry_data['price'].append(t['entry_price'])
            entry_data['type'].append(t.get('type', 'long'))
            
            # Exit
            exit_data['date'].append(pd.to_datetime(t['exit_time']))
            exit_data['price'].append(t['exit_price'])
            exit_data['pnl'].append(t.get('pnl', 0))
        except:
            continue
            
    if entry_data['date']:
        p.scatter(
            x='date', y='price', source=ColumnDataSource(entry_data),
            size=10, marker="triangle", color=ENTRY_COLOR, alpha=0.9, legend_label="Entry"
        )
        
    if exit_data['date']:
        exit_source = ColumnDataSource(exit_data)
        p.scatter(
            x='date', y='price', source=exit_source,
            size=10, marker="inverted_triangle", color=EXIT_COLOR, alpha=0.9, legend_label="Exit"
        )
        
        # Hover for exits
        p.add_tools(HoverTool(
            renderers=[p.renderers[-1]],
            tooltips=[
                ("Exit", "@date{%F %H:%M}"),
                ("Price", "@price{0,0.00}"),
                ("PnL", "@pnl{$0,0.00}")
            ],
            formatters={"@date": "datetime"}
        ))
        
    p.legend.location = "top_left"
    p.legend.click_policy = "hide"


def _create_equity_chart(equity_curve, x_range, width):
    p = figure(
        title="Equity Curve",
        x_axis_type='datetime',
        width=width,
        height=200,
        x_range=x_range,
        tools="pan,box_zoom,reset,hover",
        active_drag="pan"
    )
    
    if equity_curve:
        df = pd.DataFrame(equity_curve)
        df['date'] = pd.to_datetime(df['timestamp'])
        source = ColumnDataSource(df)
        
        p.line(x='date', y='equity', source=source, line_width=2, color=EQUITY_COLOR)
        p.varea(x='date', y1=df['equity'].min() * 0.99, y2='equity', source=source, fill_alpha=0.2, fill_color=EQUITY_COLOR)
        
        p.hover.tooltips = [("Date", "@date{%F}"), ("Equity", "@equity{$0,0}")]
        p.hover.formatters = {"@date": "datetime"}
        
    p.yaxis.formatter = NumeralTickFormatter(format="$0,0")
    p.grid.grid_line_alpha = 0.3
    return p


def _create_drawdown_chart(equity_curve, x_range, width):
    p = figure(
        title="Drawdown (%)",
        x_axis_type='datetime',
        width=width,
        height=150,
        x_range=x_range,
        tools="pan,box_zoom,reset,hover",
        active_drag="pan"
    )
    
    if equity_curve:
        df = pd.DataFrame(equity_curve)
        df['date'] = pd.to_datetime(df['timestamp'])
        
        # Calculate Drawdown
        df['peak'] = df['equity'].cummax()
        df['drawdown'] = (df['equity'] - df['peak']) / df['peak'] * 100
        
        source = ColumnDataSource(df)
        
        p.line(x='date', y='drawdown', source=source, line_width=1, color=DRAWDOWN_COLOR)
        p.varea(x='date', y1=0, y2='drawdown', source=source, fill_color=DRAWDOWN_COLOR, fill_alpha=0.4)
        
        p.hover.tooltips = [("Date", "@date{%F}"), ("Drawdown", "@drawdown{0.00}%")]
        p.hover.formatters = {"@date": "datetime"}
        
    p.yaxis.formatter = NumeralTickFormatter(format="0.00%")
    p.grid.grid_line_alpha = 0.3
    return p


def _create_monthly_heatmap(equity_curve):
    if not equity_curve:
        return None
        
    df = pd.DataFrame(equity_curve)
    df['date'] = pd.to_datetime(df['timestamp'])
    df.set_index('date', inplace=True)
    
    # Resample to monthly returns
    monthly = df['equity'].resample('ME').last().pct_change() * 100
    monthly = monthly.dropna()
    
    if monthly.empty:
        return None

    monthly_df = pd.DataFrame({'return': monthly})
    monthly_df['year'] = monthly_df.index.year.astype(str)
    monthly_df['month'] = monthly_df.index.month_name().str[:3] # Jan, Feb
    
    # Create Matrix
    years = sorted(list(set(monthly_df['year'])))
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    
    source = ColumnDataSource(monthly_df)
    
    # Color mapper (Green for pos, Red for neg)
    # Simple logic: map value to color
    
    p = figure(
        title="Monthly Returns (%)",
        x_range=years,
        y_range=list(reversed(months)),
        width=800,
        height=400,
        tools="hover",
        toolbar_location=None
    )
    
    # Custom color mapping via JS logic or simple transform
    # Here using a linear color mapper is tricky with 0 center. 
    # We'll stick to a simpler logic: variable extraction
    
    rect = p.rect(
        x='year', y='month', width=0.9, height=0.9, source=source,
        line_color=None,
        fill_color=transform('return', _get_color_mapper())
    )
    
    p.hover.tooltips = [
        ("Period", "@month @year"),
        ("Return", "@return{0.00}%")
    ]
    
    p.axis.axis_line_color = None
    p.axis.major_tick_line_color = None
    return p

def _get_color_mapper():
    from bokeh.models import LinearColorMapper
    return LinearColorMapper(palette=RdYlGn11, low=-10, high=10)


def _create_trade_distribution(trades):
    if not trades:
        return None
        
    pnls = [t.get('pnl', 0) for t in trades if t.get('pnl') is not None]
    if not pnls:
        return None
        
    hist, edges = np.histogram(pnls, bins=50)
    
    p = figure(
        title="Trade P&L Distribution",
        width=800,
        height=300,
        tools="pan,wheel_zoom,reset,hover"
    )
    
    p.quad(
        top=hist, bottom=0, left=edges[:-1], right=edges[1:],
        fill_color="#2196f3", line_color="white", alpha=0.7
    )
    
    p.xaxis.axis_label = "Profit/Loss ($)"
    p.yaxis.axis_label = "Count"
    p.hover.tooltips = [("Count", "@top")]
    
    return p


def _generate_metrics_html(metrics: Dict, symbol: str) -> str:
    """Generate HTML for metrics display panel."""
    
    def fmt(val, is_pct=False, is_money=False):
        if val is None: return "-"
        if is_money: return f"${val:,.2f}"
        if is_pct: return f"{val:.2f}%"
        return f"{val:.2f}" if isinstance(val, float) else val

    pnl = metrics.get('total_pnl', 0)
    color = "#4caf50" if pnl >= 0 else "#ef5350"
    
    return f'''
    <div style="font-size: 13px; line-height: 1.8; color: #eee;">
        <div style="display:flex; justify-content:space-between;"><span>Symbol:</span> <strong>{symbol}</strong></div>
        <div style="display:flex; justify-content:space-between;"><span>Total Trades:</span> <strong>{metrics.get('total_trades', 0)}</strong></div>
        <div style="display:flex; justify-content:space-between;"><span>Win Rate:</span> <strong>{fmt(metrics.get('win_rate', 0), is_pct=True)}</strong></div>
        <div style="border-top: 1px solid #444; margin: 8px 0;"></div>
        <div style="display:flex; justify-content:space-between;"><span>Net Profit:</span> <strong style="color: {color}">{fmt(pnl, is_money=True)}</strong></div>
        <div style="display:flex; justify-content:space-between;"><span>Max Drawdown:</span> <strong style="color: #ef5350">{fmt(metrics.get('max_drawdown', 0), is_pct=True)}</strong></div>
        <div style="display:flex; justify-content:space-between;"><span>Sharpe Ratio:</span> <strong>{fmt(metrics.get('sharpe_ratio', 0))}</strong></div>
        <div style="display:flex; justify-content:space-between;"><span>Profit Factor:</span> <strong>{fmt(metrics.get('profit_factor', 0))}</strong></div>
    </div>
    '''

def generate_simple_equity_chart(equity_curve, trades, metrics, symbol="Unknown"):
    """Legacy simple chart logic, mainly for when OHLCV is missing."""
    # Reuse the same powerful logic but with limited data
    return generate_nautilus_chart(pd.DataFrame(), trades, equity_curve, metrics, symbol)
