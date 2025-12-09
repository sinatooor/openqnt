#!/usr/bin/env python3
"""
Comprehensive Multi-Engine Backtest Test Script

Iterates through 5 strategies and tests them on 3 different backtest generation engines:
1. AI Generated (backtesting.py + LLM)
2. Simple Generated (backtesting.py + Regex/AST, mirroring frontend logic)
3. NautilusTrader (Institutional Engine) 

Also compares results for rationality.
"""

import asyncio
import httpx
import json
import sys
import os
from datetime import datetime
from typing import Dict, Any, List

# Configuration
BACKEND_URL = "http://127.0.0.1:8000"
TIMEOUT_GEN = 180.0
TIMEOUT_BACKTEST = 300.0

STRATEGIES = [
    {
        "type": "MOMENTUM",
        "name": "RSI Oversold",
        "prompt": "Create a simple RSI strategy: buy when RSI(14) < 30, sell when RSI(14) > 70. 1h timeframe.",
        "expected_trades": ">0"
    },
    {
        "type": "TREND",
        "name": "SMA Crossover",
        "prompt": "Create a golden cross strategy: buy when SMA(10) crosses above SMA(20). Sell on death cross. 1h timeframe.",
        "expected_trades": ">0"
    },
    {
        "type": "BREAKOUT",
        "name": "Donchian Channels",
        "prompt": "Create a Donchian Channel breakout strategy: Buy when Close > Upper Channel(20). 1h timeframe.",
        "expected_trades": ">0"
    },
    {
        "type": "VOLATILITY",
        "name": "Bollinger Bands",
        "prompt": "Create a Bollinger Band mean reversion strategy: Buy when Close < Lower Band(20, 2). Sell when Close > Upper Band. 1h timeframe.",
        "expected_trades": ">0"
    },
    {
        "type": "SCALPING",
        "name": "Simple Scalping",
        "prompt": "Buy when Close > Open (Green Candle) and RSI(14) > 50. Sell when Close < Open. 1h timeframe.",
        "expected_trades": ">0"
    }
]

ENGINES = [
    {
        "name": "Python (AI-Generated)",
        "params": {"engine": "backtesting.py", "use_llm": True}
    },
    {
        "name": "Simple (Fast/Browser Logic)",
        "params": {"engine": "backtesting.py", "use_llm": False}  # Trigger simple parser
    },
    {
        "name": "NautilusTrader (Institutional)",
        "params": {"engine": "nautilus"}
    }
]

class MultiEngineTester:
    def __init__(self):
        self.results = []

    async def generate_xml(self, prompt: str) -> Dict[str, Any]:
        """Generate XML from prompt using /strategy/legacy"""
        print(f"  [Gen] Generating XML for: '{prompt[:30]}...'")
        async with httpx.AsyncClient(timeout=TIMEOUT_GEN) as client:
            resp = await client.post(f"{BACKEND_URL}/strategy/legacy", json={"message": prompt})
            if resp.status_code != 200:
                print(f"  ❌ Gen Error: {resp.text[:100]}")
                return {"success": False, "error": resp.text}
            
            data = resp.json()
            if not data.get("xml"):
                return {"success": False, "error": "No XML returned"}
                
            return {"success": True, "xml": data["xml"]}

    async def run_backtest(self, xml: str, engine_name: str, params: Dict) -> Dict[str, Any]:
        """Run backtest on specific engine"""
        print(f"  [Backtest] Running on {engine_name}...")
        
        payload = {
            "workspaceXml": xml,
            "symbol": "AAPL",
            "startDate": "2024-01-01",
            "endDate": "2024-12-01",
            "initialBalance": 100000,
            "tradeSize": 10000,
            "data_source": "yfinance",
            "interval": "1d",
            "forceRegenerate": True  # Bypass cache
        }
        payload.update(params)

        try:
            async with httpx.AsyncClient(timeout=TIMEOUT_BACKTEST) as client:
                resp = await client.post(f"{BACKEND_URL}/backtest", json=payload)
                if resp.status_code != 200:
                    return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
                return resp.json()
        except Exception as e:
            return {"success": False, "error": str(e)}

    def analyze_result(self, result: Dict) -> Dict:
        """Analyze backtest result"""
        if not result.get("success"):
            return {"valid": False, "reason": result.get("error")}
        
        metrics = result.get("metrics", {})
        trades = result.get("trades", [])
        
        num_trades = metrics.get("total_trades", len(trades))
        ret_pct = metrics.get("total_return", 0)
        
        valid = True
        reason = "OK"
        
        if num_trades == 0:
            valid = False
            reason = "Zero trades"
            
        return {
            "valid": valid, 
            "reason": reason, 
            "trades": num_trades, 
            "return": ret_pct,
            "win_rate": metrics.get("win_rate", 0)
        }

    async def run(self):
        print("=== Starting Multi-Engine Test Suite ===")
        print(f"Testing {len(STRATEGIES)} strategies on {len(ENGINES)} engines")
        
        overall_stats = {"passed": 0, "failed": 0, "total": 0}

        for i, strat in enumerate(STRATEGIES):
            print(f"\n\n>>> STRATEGY {i+1}: {strat['name']} ({strat['type']})")
            
            # 1. Generate XML
            gen_res = await self.generate_xml(strat['prompt'])
            if not gen_res.get("success"):
                print("  ❌ XML Generation Failed. Skipping strategy.")
                continue
                
            xml = gen_res.get("xml")
            print(f"  ✓ XML Generated ({len(xml)} chars)")
            
            strat_results = []
            
            # 2. Test on each engine
            for engine in ENGINES:
                print(f"\n  --- Engine: {engine['name']} ---")
                bt_res = await self.run_backtest(xml, engine['name'], engine['params'])
                
                analysis = self.analyze_result(bt_res)
                
                status = "✅ PASS" if analysis["valid"] else "❌ FAIL"
                print(f"    Result: {status} | Trades: {analysis.get('trades', 0)} | Return: {analysis.get('return', 0):.2f}%")
                if not analysis["valid"]:
                    print(f"    Reason: {analysis['reason']}")
                
                strat_results.append({
                    "engine": engine['name'],
                    "valid": analysis["valid"],
                    "trades": analysis.get('trades', 0),
                    "return": analysis.get("return", 0)
                })
                
                overall_stats["total"] += 1
                if analysis["valid"]: overall_stats["passed"] += 1 
                else: overall_stats["failed"] += 1

            # 3. Compare Results
            print("\n  [Comparison]")
            valid_results = [r for r in strat_results if r["valid"]]
            if not valid_results:
                print("  ⚠️ All engines failed for this strategy.")
            elif len(valid_results) == len(strat_results):
                # Check for rational consistency (Are returns somewhat similar? Or at least directionally same?)
                returns = [r["return"] for r in valid_results]
                print(f"  ✓ All engines produced valid results. Returns: {returns}")
            else:
                print(f"  ⚠️ Mixed results: {len(valid_results)}/{len(strat_results)} engines passed.")

        print("\n\n=== TEST SUITE COMPLETE ===")
        print(f"Total Tests: {overall_stats['total']}")
        print(f"Passed: {overall_stats['passed']}")
        print(f"Failed: {overall_stats['failed']}")
        
        # Save results
        with open("multi_engine_results.json", "w") as f:
            json.dump(self.results, f, indent=2)

if __name__ == "__main__":
    asyncio.run(MultiEngineTester().run())
