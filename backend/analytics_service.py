"""
Analytics & Telemetry Service

Tracks usage patterns and system performance.
Privacy-respecting with no PII collection.
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from collections import defaultdict
import json


@dataclass
class AnalyticsEvent:
    event_type: str
    timestamp: datetime
    properties: Dict[str, Any] = field(default_factory=dict)
    session_id: Optional[str] = None


class AnalyticsService:
    """
    In-memory analytics service for tracking usage patterns.
    
    In production, this would send to a proper analytics backend.
    """
    
    def __init__(self):
        self.events: List[AnalyticsEvent] = []
        self.counters: Dict[str, int] = defaultdict(int)
        self.timers: Dict[str, List[float]] = defaultdict(list)
        self.session_start = datetime.utcnow()
    
    def track(
        self,
        event_type: str,
        properties: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None
    ):
        """Track an event."""
        event = AnalyticsEvent(
            event_type=event_type,
            timestamp=datetime.utcnow(),
            properties=properties or {},
            session_id=session_id
        )
        self.events.append(event)
        self.counters[event_type] += 1
        
        # Keep events list bounded
        if len(self.events) > 10000:
            self.events = self.events[-5000:]
    
    def track_timing(self, name: str, duration_ms: float):
        """Track a timing metric."""
        self.timers[name].append(duration_ms)
        
        # Keep bounded
        if len(self.timers[name]) > 1000:
            self.timers[name] = self.timers[name][-500:]
    
    def increment(self, counter: str, amount: int = 1):
        """Increment a counter."""
        self.counters[counter] += amount
    
    # Pre-defined tracking methods
    
    def track_backtest(self, engine: str, symbol: str, duration_ms: float, success: bool):
        """Track backtest execution."""
        self.track("backtest_run", {
            "engine": engine,
            "symbol": symbol,
            "success": success
        })
        self.track_timing("backtest_duration", duration_ms)
    
    def track_strategy_generation(self, model: str, duration_ms: float, success: bool):
        """Track AI strategy generation."""
        self.track("strategy_generation", {
            "model": model,
            "success": success
        })
        self.track_timing("generation_duration", duration_ms)
    
    def track_live_trade(self, symbol: str, direction: str, size: float, is_paper: bool):
        """Track live/paper trade execution."""
        self.track("trade_executed", {
            "symbol": symbol,
            "direction": direction,
            "size": size,
            "mode": "paper" if is_paper else "live"
        })
    
    def track_export(self, format: str):
        """Track strategy export."""
        self.track("strategy_export", {"format": format})
    
    def track_error(self, error_type: str, message: str):
        """Track an error occurrence."""
        self.track("error", {
            "type": error_type,
            "message": message[:200]  # Truncate
        })
    
    # Reporting methods
    
    def get_summary(self) -> Dict[str, Any]:
        """Get analytics summary."""
        uptime = datetime.utcnow() - self.session_start
        
        return {
            "uptime_seconds": int(uptime.total_seconds()),
            "total_events": len(self.events),
            "event_counts": dict(self.counters),
            "timing_averages": {
                name: sum(times) / len(times) if times else 0
                for name, times in self.timers.items()
            }
        }
    
    def get_recent_events(self, limit: int = 100, event_type: Optional[str] = None) -> List[Dict]:
        """Get recent events."""
        events = self.events
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        
        return [
            {
                "type": e.event_type,
                "timestamp": e.timestamp.isoformat(),
                "properties": e.properties
            }
            for e in events[-limit:]
        ]
    
    def get_timing_stats(self, name: str) -> Dict[str, float]:
        """Get timing statistics for a metric."""
        times = self.timers.get(name, [])
        if not times:
            return {"count": 0}
        
        sorted_times = sorted(times)
        n = len(times)
        
        return {
            "count": n,
            "min": min(times),
            "max": max(times),
            "avg": sum(times) / n,
            "p50": sorted_times[n // 2],
            "p95": sorted_times[int(n * 0.95)] if n >= 20 else sorted_times[-1],
            "p99": sorted_times[int(n * 0.99)] if n >= 100 else sorted_times[-1]
        }


# Singleton instance
analytics = AnalyticsService()
