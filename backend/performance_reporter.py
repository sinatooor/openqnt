"""
Performance Reporter

Generates detailed performance reports from SimulationResult objects.
Includes monthly breakdowns, timing analysis, and trade statistics.
"""
import pandas as pd
import numpy as np
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from ir_simulator import SimulationResult, Trade

class PerformanceReporter:
    def __init__(self, simulation_result: SimulationResult):
        self.result = simulation_result
        self.trades = simulation_result.trades
        self.equity_curve = simulation_result.equity_curve
        self.report_data: Dict[str, Any] = {}

    def generate(self) -> Dict[str, Any]:
        """Generates the full performance report."""
        
        self.report_data = {
            "summary": self.result.metrics,
            "monthly_breakdown": self._calculate_monthly_breakdown(),
            "day_of_week_stats": self._calculate_day_of_week_stats(),
            "trade_duration_stats": self._calculate_duration_stats(),
            "extreme_trades": self._get_extreme_trades()
        }
        return self.report_data

    def to_json(self) -> str:
        """Exports the report to a JSON string."""
        if not self.report_data:
            self.generate()
            
        # Helper to serialize datetime objects
        def json_serial(obj):
            if isinstance(obj, (datetime, pd.Timestamp)):
                return obj.isoformat()
            if isinstance(obj, np.integer):
                return int(obj)
            if isinstance(obj, np.floating):
                return float(obj)
            raise TypeError(f"Type {type(obj)} not serializable")

        return json.dumps(self.report_data, default=json_serial, indent=2)

    def to_markdown(self) -> str:
        """Exports the report to a Markdown string."""
        if not self.report_data:
            self.generate()
            
        md = "# Strategy Performance Report\n\n"
        
        # Summary Section
        md += "## 1. Summary Metrics\n"
        metrics = self.report_data.get("summary", {})
        for k, v in metrics.items():
            val = f"{v:.2f}" if isinstance(v, float) else str(v)
            md += f"- **{k.replace('_', ' ').title()}**: {val}\n"
        
        # Monthly Breakdown
        md += "\n## 2. Monthly Returns\n"
        monthly = self.report_data.get("monthly_breakdown", [])
        if not monthly:
            md += "No data available.\n"
        else:
            md += "| Month | Return % | Trades |\n"
            md += "|-------|----------|--------|\n"
            for m in monthly:
                md += f"| {m['month']} | {m['return_pct']:.2f}% | {m['trade_count']} |\n"

        # Day of Week Stats
        md += "\n## 3. Win Rate by Day of Week\n"
        dow_stats = self.report_data.get("day_of_week_stats", {})
        if not dow_stats:
             md += "No trades executed.\n"
        else:
            md += "| Day | Win Rate % | Trades |\n"
            md += "|-----|------------|--------|\n"
            # Sort by day order if possible, roughly
            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            for day in days:
                if day in dow_stats:
                    stats = dow_stats[day]
                    md += f"| {day} | {stats['win_rate']:.2f}% | {stats['total']} |\n"

        # Duration Stats
        md += "\n## 4. Trade Duration\n"
        dur = self.report_data.get("trade_duration_stats", {})
        if dur:
            md += f"- **Average Duration**: {dur['avg_duration_str']}\n"
            md += f"- **Max Duration**: {dur['max_duration_str']}\n"
            md += f"- **Min Duration**: {dur['min_duration_str']}\n"
        else:
            md += "No trades executed.\n"

        # Extreme Trades
        md += "\n## 5. Extreme Trades\n"
        extremes = self.report_data.get("extreme_trades", {})
        if extremes:
            best = extremes.get("best_trade")
            worst = extremes.get("worst_trade")
            
            if best:
                md += "### Best Trade\n"
                md += f"- **PnL**: {best['pnl']:.2f}\n"
                md += f"- **Entry**: {best['entry_time']} @ {best['entry_price']}\n"
                md += f"- **Exit**: {best['exit_time']} @ {best['exit_price']}\n"
            
            if worst:
                md += "\n### Worst Trade\n"
                md += f"- **PnL**: {worst['pnl']:.2f}\n"
                md += f"- **Entry**: {worst['entry_time']} @ {worst['entry_price']}\n"
                md += f"- **Exit**: {worst['exit_time']} @ {worst['exit_price']}\n"
        else:
            md += "No trades executed.\n"
            
        return md

    def _calculate_monthly_breakdown(self) -> List[Dict[str, Any]]:
        """Calculates monthly returns based on equity curve."""
        if self.equity_curve.empty:
            return []
            
        # Ensure index is datetime
        df = self.equity_curve.copy()
        if not isinstance(df.index, pd.DatetimeIndex):
            try:
                df.index = pd.to_datetime(df.index)
            except:
                return []

        # Resample to monthly last equity
        monthly_equity = df['equity'].resample('M').last()
        
        # Calculate monthly returns
        # We need the start equity for the first month
        # Use initial equity from result
        
        breakdown = []
        
        # Create a series including initial equity at the start
        # This is a bit tricky if equity curve doesn't start exactly at month boundary
        # Simplified approach: Monthly PnL / Start of Month Equity
        
        # Alternative: iterate through months
        grouped = df.groupby(pd.Grouper(freq='M'))
        
        for name, group in grouped:
            if group.empty:
                continue
                
            month_str = name.strftime("%Y-%m")
            start_equity = group['equity'].iloc[0] # Approximation
            end_equity = group['equity'].iloc[-1]
            
            # Count trades in this month
            # Filter trades where exit_time is in this month
            trade_count = 0
            for t in self.trades:
                if t.exit_time and t.exit_time.year == name.year and t.exit_time.month == name.month:
                    trade_count += 1
            
            # Simple return calculation for the period covered
            ret_pct = ((end_equity - start_equity) / start_equity) * 100 if start_equity != 0 else 0
            
            breakdown.append({
                "month": month_str,
                "return_pct": ret_pct,
                "trade_count": trade_count
            })
            
        return breakdown

    def _calculate_day_of_week_stats(self) -> Dict[str, Any]:
        if not self.trades:
            return {}
            
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        stats = {day: {"wins": 0, "losses": 0, "total": 0} for day in days}
        
        for trade in self.trades:
            day_name = days[trade.entry_time.weekday()]
            stats[day_name]["total"] += 1
            if trade.pnl > 0:
                stats[day_name]["wins"] += 1
            else:
                stats[day_name]["losses"] += 1
                
        results = {}
        for day, data in stats.items():
            if data["total"] > 0:
                results[day] = {
                    "total": data["total"],
                    "win_rate": (data["wins"] / data["total"]) * 100
                }
        return results

    def _calculate_duration_stats(self) -> Dict[str, Any]:
        if not self.trades:
            return {}
            
        durations = []
        for trade in self.trades:
            if trade.exit_time and trade.entry_time:
                durations.append((trade.exit_time - trade.entry_time).total_seconds())
                
        if not durations:
            return {}
            
        avg_dur = np.mean(durations)
        max_dur = np.max(durations)
        min_dur = np.min(durations)
        
        return {
            "avg_duration_seconds": avg_dur,
            "max_duration_seconds": max_dur,
            "min_duration_seconds": min_dur,
            "avg_duration_str": str(pd.Timedelta(seconds=avg_dur)),
            "max_duration_str": str(pd.Timedelta(seconds=max_dur)),
            "min_duration_str": str(pd.Timedelta(seconds=min_dur))
        }

    def _get_extreme_trades(self) -> Dict[str, Any]:
        if not self.trades:
            return {}
            
        sorted_trades = sorted(self.trades, key=lambda x: x.pnl)
        worst_trade = sorted_trades[0]
        best_trade = sorted_trades[-1]
        
        def trade_to_dict(t: Trade):
            return {
                "entry_time": t.entry_time,
                "exit_time": t.exit_time,
                "entry_price": t.entry_price,
                "exit_price": t.exit_price,
                "direction": t.direction,
                "size": t.size,
                "pnl": t.pnl,
                "exit_reason": t.exit_reason
            }

        return {
            "best_trade": trade_to_dict(best_trade),
            "worst_trade": trade_to_dict(worst_trade)
        }
