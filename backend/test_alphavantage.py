#!/usr/bin/env python3
"""
Test Alpha Vantage data fetching
"""

import sys
sys.path.insert(0, '.')

from backtest_service import fetch_alphavantage_data, fetch_historical_data

def test_alphavantage_direct():
    """Test Alpha Vantage data fetching directly"""
    print("=" * 50)
    print("Testing Alpha Vantage direct fetch...")
    print("=" * 50)
    
    try:
        # Test fetching SPY data
        df = fetch_alphavantage_data("SPY", period="1y", interval="1d")
        print(f"\n✓ Success! Fetched {len(df)} rows for SPY")
        print(f"Date range: {df.index[0]} to {df.index[-1]}")
        print(f"\nFirst 5 rows:")
        print(df.head())
        print(f"\nLast 5 rows:")
        print(df.tail())
        print(f"\nColumns: {list(df.columns)}")
        return True
    except Exception as e:
        print(f"\n✗ Error: {e}")
        return False


def test_fetch_historical_data():
    """Test the unified fetch function with Alpha Vantage as default"""
    print("\n" + "=" * 50)
    print("Testing unified fetch_historical_data...")
    print("=" * 50)
    
    try:
        # Should use Alpha Vantage by default
        df = fetch_historical_data("AAPL", period="1y", interval="1d")
        print(f"\n✓ Success! Fetched {len(df)} rows for AAPL")
        print(f"Date range: {df.index[0]} to {df.index[-1]}")
        print(f"\nSample data:")
        print(df.head(3))
        return True
    except Exception as e:
        print(f"\n✗ Error: {e}")
        return False


def test_yfinance_fallback():
    """Test yfinance fallback"""
    print("\n" + "=" * 50)
    print("Testing yfinance fallback...")
    print("=" * 50)
    
    try:
        # Explicitly use yfinance
        df = fetch_historical_data("MSFT", period="6mo", interval="1d", data_source="yfinance")
        print(f"\n✓ Success! Fetched {len(df)} rows for MSFT via yfinance")
        print(f"Date range: {df.index[0]} to {df.index[-1]}")
        print(f"\nSample data:")
        print(df.head(3))
        return True
    except Exception as e:
        print(f"\n✗ Error: {e}")
        return False


if __name__ == "__main__":
    print("🔍 Alpha Vantage Integration Test")
    print("=" * 50)
    
    results = []
    
    # Test 1: Direct Alpha Vantage
    results.append(("Alpha Vantage Direct", test_alphavantage_direct()))
    
    # Test 2: Unified fetch with Alpha Vantage default
    results.append(("Unified Fetch (Alpha Vantage)", test_fetch_historical_data()))
    
    # Test 3: yfinance fallback
    results.append(("yfinance Fallback", test_yfinance_fallback()))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {name}")
    
    all_passed = all(r[1] for r in results)
    print("\n" + ("🎉 All tests passed!" if all_passed else "⚠️ Some tests failed"))
    sys.exit(0 if all_passed else 1)
