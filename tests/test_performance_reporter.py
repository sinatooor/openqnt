import pytest
import pandas as pd
from datetime import datetime, timedelta
from backend.ir_simulator import SimulationResult, Trade
from backend.performance_reporter import PerformanceReporter

@pytest.fixture
def sample_trades():
    t1 = Trade(
        entry_time=datetime(2023, 1, 2, 10, 0),
        entry_price=100.0,
        direction='LONG',
        size=10,
        exit_time=datetime(2023, 1, 2, 11, 0),
        exit_price=105.0,
        pnl=50.0, # Win
        status='CLOSED'
    )
    t2 = Trade(
        entry_time=datetime(2023, 1, 3, 14, 0),
        entry_price=110.0,
        direction='SHORT',
        size=10,
        exit_time=datetime(2023, 1, 5, 10, 0),
        exit_price=112.0,
        pnl=-20.0, # Loss
        status='CLOSED'
    )
    return [t1, t2]

@pytest.fixture
def sample_result(sample_trades):
    # Create dummy equity curve
    dates = pd.date_range(start='2023-01-01', periods=10, freq='D')
    equity = [10000 + i*10 for i in range(10)]
    equity_df = pd.DataFrame({'equity': equity}, index=dates)
    
    return SimulationResult(
        trades=sample_trades,
        initial_equity=10000.0,
        final_equity=10090.0,
        equity_curve=equity_df,
        metrics={'return_pct': 0.9},
        processed_data=pd.DataFrame(),
        risk_violations=[]
    )

def test_generate_report_structure(sample_result):
    reporter = PerformanceReporter(sample_result)
    report = reporter.generate()
    
    assert "summary" in report
    assert "monthly_breakdown" in report
    assert "day_of_week_stats" in report
    assert "trade_duration_stats" in report
    assert "extreme_trades" in report

def test_monthly_breakdown(sample_result):
    reporter = PerformanceReporter(sample_result)
    report = reporter.generate()
    monthly = report['monthly_breakdown']
    
    assert len(monthly) == 1
    assert monthly[0]['month'] == '2023-01'
    # Check trade count (both trades in Jan)
    assert monthly[0]['trade_count'] == 2

def test_day_of_week_stats(sample_result):
    reporter = PerformanceReporter(sample_result)
    report = reporter.generate()
    stats = report['day_of_week_stats']
    
    # 2023-01-02 was a Monday
    assert 'Monday' in stats
    assert stats['Monday']['total'] == 1
    assert stats['Monday']['win_rate'] == 100.0
    
    # 2023-01-03 was a Tuesday
    assert 'Tuesday' in stats
    assert stats['Tuesday']['total'] == 1
    assert stats['Tuesday']['win_rate'] == 0.0

def test_duration_stats(sample_result):
    reporter = PerformanceReporter(sample_result)
    report = reporter.generate()
    dur = report['trade_duration_stats']
    
    # T1: 1 hour (3600s)
    # T2: ~2 days (44 hours = 158400s)
    
    assert dur['min_duration_seconds'] == 3600.0
    assert dur['max_duration_seconds'] == 158400.0
    assert dur['avg_duration_seconds'] == (3600.0 + 158400.0) / 2

def test_extreme_trades(sample_result):
    reporter = PerformanceReporter(sample_result)
    report = reporter.generate()
    extremes = report['extreme_trades']
    
    assert extremes['best_trade']['pnl'] == 50.0
    assert extremes['worst_trade']['pnl'] == -20.0

def test_empty_results():
    empty_result = SimulationResult(
        trades=[],
        initial_equity=10000,
        final_equity=10000,
        equity_curve=pd.DataFrame(),
        metrics={},
        processed_data=pd.DataFrame()
    )
    reporter = PerformanceReporter(empty_result)
    report = reporter.generate()
    
    assert report['day_of_week_stats'] == {}
    assert report['monthly_breakdown'] == []
    assert report['trade_duration_stats'] == {}
    assert report['extreme_trades'] == {}

def test_export_formats(sample_result):
    reporter = PerformanceReporter(sample_result)
    
    # Test JSON
    json_out = reporter.to_json()
    assert isinstance(json_out, str)
    assert "summary" in json_out
    
    # Test Markdown
    md_out = reporter.to_markdown()
    assert isinstance(md_out, str)
    assert "Strategy Performance Report" in md_out
    assert "Monthly Returns" in md_out
    assert "Best Trade" in md_out
