#!/usr/bin/env python3
"""Simple single-strategy test for RSI Oversold Buy"""

import asyncio
import httpx
import json

BACKEND_URL = "http://127.0.0.1:8000"

async def test_rsi():
    prompt = "Create a simple RSI strategy: buy when RSI(14) is below 30, use 1 hour timeframe"
    
    print("=== Testing RSI Strategy ===")
    
    # Generate XML
    print("\n[1] Generating XML...")
    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.post(f"{BACKEND_URL}/strategy/legacy", json={"message": prompt})
        if resp.status_code != 200:
            print(f"ERROR: {resp.text}")
            return
        data = resp.json()
        xml = data.get("xml", "")
        print(f"Generated XML: {len(xml)} chars")
    
    # Run backtest
    print("\n[2] Running backtest...")
    async with httpx.AsyncClient(timeout=240.0) as client:
        resp = await client.post(f"{BACKEND_URL}/backtest", json={
            "workspaceXml": xml,
            "symbol": "AAPL",
            "startDate": "2024-01-01",
            "endDate": "2024-12-01",
            "initialBalance": 100000,
            "tradeSize": 10000,
            "engine": "backtesting.py",
            "use_llm": True,
            "data_source": "yfinance",
            "interval": "1d"
        })
        result = resp.json()
    
    # Analyze
    print("\n[3] Results:")
    print(f"Success: {result.get('success')}")
    
    metrics = result.get("metrics", {})
    trades = result.get("trades", [])
    
    print(f"Trade count from trades list: {len(trades)}")
    print(f"Metrics keys: {list(metrics.keys())}")
    
    # Find trade count
    num_trades = metrics.get("# Trades", metrics.get("total_trades", len(trades)))
    print(f"Calculated num_trades: {num_trades}")
    
    print(f"\nReturn: {metrics.get('Return [%]', 'N/A')}")
    print(f"Win Rate: {metrics.get('Win Rate [%]', 'N/A')}")
    print(f"Max DD: {metrics.get('Max. Drawdown [%]', 'N/A')}")
    
    if num_trades > 0:
        print("\n✅ SUCCESS - Strategy executed trades!")
    else:
        print("\n❌ FAIL - No trades executed")

if __name__ == "__main__":
    asyncio.run(test_rsi())
