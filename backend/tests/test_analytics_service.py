import pytest
from datetime import datetime, timedelta
from typing import Dict, List, Any

from backend.analytics_service import AnalyticsService, AnalyticsEvent

@pytest.fixture
def analytics_service():
    return AnalyticsService()

def test_init(analytics_service):
    assert isinstance(analytics_service.events, list)
    assert len(analytics_service.events) == 0
    assert isinstance(analytics_service.counters, dict)
    assert len(analytics_service.counters) == 0
    assert isinstance(analytics_service.timers, dict)
    assert len(analytics_service.timers) == 0
    assert isinstance(analytics_service.session_start, datetime)

def test_track(analytics_service):
    analytics_service.track("test_event", {"prop": "value"}, "session_1")

    assert len(analytics_service.events) == 1
    event = analytics_service.events[0]
    assert isinstance(event, AnalyticsEvent)
    assert event.event_type == "test_event"
    assert event.properties == {"prop": "value"}
    assert event.session_id == "session_1"
    assert isinstance(event.timestamp, datetime)

    assert analytics_service.counters["test_event"] == 1

def test_track_without_optional_args(analytics_service):
    analytics_service.track("simple_event")

    assert len(analytics_service.events) == 1
    event = analytics_service.events[0]
    assert event.event_type == "simple_event"
    assert event.properties == {}
    assert event.session_id is None

    assert analytics_service.counters["simple_event"] == 1

def test_track_bounded_list(analytics_service):
    # Track 10005 events
    for i in range(10005):
        analytics_service.track("flood_event", {"index": i})

    # Check bounded list logic:
    # After adding the 10001st event, it gets truncated to 5000.
    # It then adds 4 more events, resulting in 5004 events.
    assert len(analytics_service.events) == 5004
    assert analytics_service.counters["flood_event"] == 10005

    # Check that it kept the correct elements
    assert analytics_service.events[0].properties["index"] == 5001
    assert analytics_service.events[-1].properties["index"] == 10004

def test_track_timing(analytics_service):
    analytics_service.track_timing("test_timing", 150.5)
    analytics_service.track_timing("test_timing", 200.0)

    assert len(analytics_service.timers["test_timing"]) == 2
    assert analytics_service.timers["test_timing"] == [150.5, 200.0]

def test_track_timing_bounded_list(analytics_service):
    for i in range(1005):
        analytics_service.track_timing("flood_timing", float(i))

    # Check bounded list logic:
    # After adding the 1001st timing, it gets truncated to 500.
    # It then adds 4 more timings, resulting in 504 timings.
    assert len(analytics_service.timers["flood_timing"]) == 504
    assert analytics_service.timers["flood_timing"][0] == 501.0
    assert analytics_service.timers["flood_timing"][-1] == 1004.0

def test_increment(analytics_service):
    analytics_service.increment("test_counter")
    assert analytics_service.counters["test_counter"] == 1

    analytics_service.increment("test_counter", 5)
    assert analytics_service.counters["test_counter"] == 6

def test_track_backtest(analytics_service):
    analytics_service.track_backtest("engine_a", "AAPL", 1234.5, True)

    assert len(analytics_service.events) == 1
    event = analytics_service.events[0]
    assert event.event_type == "backtest_run"
    assert event.properties == {
        "engine": "engine_a",
        "symbol": "AAPL",
        "success": True
    }

    assert analytics_service.timers["backtest_duration"] == [1234.5]
    assert analytics_service.counters["backtest_run"] == 1

def test_track_strategy_generation(analytics_service):
    analytics_service.track_strategy_generation("model_x", 456.7, False)

    assert len(analytics_service.events) == 1
    event = analytics_service.events[0]
    assert event.event_type == "strategy_generation"
    assert event.properties == {
        "model": "model_x",
        "success": False
    }

    assert analytics_service.timers["generation_duration"] == [456.7]
    assert analytics_service.counters["strategy_generation"] == 1

def test_track_live_trade(analytics_service):
    # Test paper trade
    analytics_service.track_live_trade("MSFT", "buy", 10.5, True)

    event = analytics_service.events[-1]
    assert event.event_type == "trade_executed"
    assert event.properties == {
        "symbol": "MSFT",
        "direction": "buy",
        "size": 10.5,
        "mode": "paper"
    }

    # Test live trade
    analytics_service.track_live_trade("GOOG", "sell", 5.0, False)

    event = analytics_service.events[-1]
    assert event.event_type == "trade_executed"
    assert event.properties == {
        "symbol": "GOOG",
        "direction": "sell",
        "size": 5.0,
        "mode": "live"
    }

def test_track_export(analytics_service):
    analytics_service.track_export("json")

    assert len(analytics_service.events) == 1
    event = analytics_service.events[0]
    assert event.event_type == "strategy_export"
    assert event.properties == {"format": "json"}

def test_track_error(analytics_service):
    long_msg = "A" * 300
    analytics_service.track_error("test_error", long_msg)

    assert len(analytics_service.events) == 1
    event = analytics_service.events[0]
    assert event.event_type == "error"
    assert event.properties["type"] == "test_error"
    assert len(event.properties["message"]) == 200
    assert event.properties["message"] == "A" * 200

def test_get_summary(analytics_service):
    analytics_service.track("event1")
    analytics_service.track("event1")
    analytics_service.track("event2")
    analytics_service.track_timing("timing1", 100.0)
    analytics_service.track_timing("timing1", 200.0)
    analytics_service.track_timing("timing2", 50.0)

    summary = analytics_service.get_summary()

    assert "uptime_seconds" in summary
    assert isinstance(summary["uptime_seconds"], int)
    assert summary["total_events"] == 3
    assert summary["event_counts"] == {"event1": 2, "event2": 1}
    assert summary["timing_averages"] == {
        "timing1": 150.0,
        "timing2": 50.0
    }

def test_get_recent_events(analytics_service):
    for i in range(5):
        analytics_service.track("event_a", {"val": i})
    for i in range(5):
        analytics_service.track("event_b", {"val": i})

    # Get all recent
    recent_all = analytics_service.get_recent_events(limit=3)
    assert len(recent_all) == 3
    assert recent_all[0]["type"] == "event_b"
    assert recent_all[0]["properties"]["val"] == 2
    assert recent_all[-1]["properties"]["val"] == 4

    # Filter by type
    recent_a = analytics_service.get_recent_events(limit=10, event_type="event_a")
    assert len(recent_a) == 5
    for e in recent_a:
        assert e["type"] == "event_a"

def test_get_timing_stats(analytics_service):
    # Empty stats
    empty_stats = analytics_service.get_timing_stats("nonexistent")
    assert empty_stats == {"count": 0}

    # Some stats
    for i in range(1, 101):  # 1 to 100
        analytics_service.track_timing("test_timing", float(i))

    stats = analytics_service.get_timing_stats("test_timing")

    assert stats["count"] == 100
    assert stats["min"] == 1.0
    assert stats["max"] == 100.0
    assert stats["avg"] == 50.5
    assert stats["p50"] == 51.0  # sorted_times[100 // 2] -> sorted_times[50] -> 51.0
    assert stats["p95"] == 96.0  # sorted_times[int(100 * 0.95)] -> sorted_times[95] -> 96.0
    assert stats["p99"] == 100.0 # sorted_times[int(100 * 0.99)] -> sorted_times[99] -> 100.0

def test_get_timing_stats_small_sample(analytics_service):
    # Less than 20 items for p95 fallback
    for i in range(1, 11):  # 1 to 10
        analytics_service.track_timing("small_timing", float(i))

    stats = analytics_service.get_timing_stats("small_timing")
    assert stats["count"] == 10
    assert stats["p95"] == 10.0  # falls back to [-1]
    assert stats["p99"] == 10.0  # falls back to [-1]

    # Between 20 and 100 items for p99 fallback
    for i in range(11, 51):  # 11 to 50
        analytics_service.track_timing("medium_timing", float(i))

    stats2 = analytics_service.get_timing_stats("medium_timing")
    assert stats2["count"] == 40
    assert stats2["p95"] == 49.0  # sorted_times[int(40 * 0.95)] -> sorted_times[38]
    assert stats2["p99"] == 50.0  # falls back to [-1]
