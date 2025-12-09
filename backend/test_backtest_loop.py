#!/usr/bin/env python3
"""
Automated Backtest Testing Script

This script:
1. Generates strategy XML using FULL_SYSTEM_PROMPT via /strategy/legacy endpoint
2. Runs Python backtests via /backtest endpoint
3. Verifies results and logs findings
4. Iterates with different strategies

Usage:
    python test_backtest_loop.py
"""

import asyncio
import httpx
import json
import sys
from datetime import datetime
from typing import Dict, Any, List, Optional

# Configuration
BACKEND_URL = "http://127.0.0.1:8000"
DEFAULT_SYMBOL = "AAPL"
DEFAULT_PERIOD = "1y"

# Test strategies to iterate through
TEST_STRATEGIES = [
    {
        "name": "RSI Oversold Buy",
        "prompt": "Create a simple RSI strategy: buy when RSI(14) is below 30, use 1 hour timeframe",
        "expected_trades": ">0",
        "description": "Basic momentum strategy"
    },
    {
        "name": "SMA Crossover",
        "prompt": "Create a golden cross strategy: buy when SMA(10) crosses above SMA(20) on 1 hour timeframe",
        "expected_trades": ">0",
        "description": "Trend following strategy"
    },
    {
        "name": "Weekly Buy",
        "prompt": "Buy every week on Monday, use daily timeframe",
        "expected_trades": "~52",
        "description": "Simple time-based strategy"
    }
]


class BacktestTester:
    def __init__(self):
        self.results: List[Dict] = []
        self.current_strategy = None
        
    async def generate_strategy_xml(self, prompt: str) -> Dict[str, Any]:
        """Generate strategy XML using /strategy/legacy endpoint."""
        async with httpx.AsyncClient(timeout=180.0) as client:  # Increased timeout
            response = await client.post(
                f"{BACKEND_URL}/strategy/legacy",
                json={"message": prompt}
            )
            
            if response.status_code != 200:
                return {"success": False, "error": f"HTTP {response.status_code}: {response.text[:200]}"}
            
            data = response.json()
            return {
                "success": True,
                "xml": data.get("xml", ""),
                "ai_fixed": data.get("ai_fixed", False)
            }
    
    async def run_backtest(self, xml: str, symbol: str = DEFAULT_SYMBOL) -> Dict[str, Any]:
        """Run backtest using /backtest endpoint."""
        async with httpx.AsyncClient(timeout=240.0) as client:  # Increased timeout
            response = await client.post(
                f"{BACKEND_URL}/backtest",
                json={
                    "workspaceXml": xml,
                    "symbol": symbol,
                    "startDate": "2024-01-01",
                    "endDate": "2024-12-01",
                    "initialBalance": 100000,
                    "tradeSize": 10000,
                    "engine": "backtesting.py",
                    "use_llm": True,
                    "data_source": "yfinance",
                    "interval": "1d"
                }
            )
            
            if response.status_code != 200:
                return {"success": False, "error": f"HTTP {response.status_code}: {response.text[:500]}"}
            
            return response.json()
    
    def analyze_result(self, backtest_result: Dict) -> Dict[str, Any]:
        """Analyze backtest result for issues."""
        analysis = {
            "valid": True,
            "issues": [],
            "metrics_summary": {}
        }
        
        if not backtest_result.get("success"):
            analysis["valid"] = False
            analysis["issues"].append(f"Backtest failed: {backtest_result.get('error', 'Unknown error')}")
            return analysis
        
        metrics = backtest_result.get("metrics", {})
        trades = backtest_result.get("trades", [])
        
        # Extract key metrics - use actual key names from API
        analysis["metrics_summary"] = {
            "return_pct": metrics.get("total_return", 0),
            "win_rate": metrics.get("win_rate", 0),
            "num_trades": metrics.get("total_trades", len(trades)),
            "max_drawdown": metrics.get("max_drawdown", 0),
            "sharpe": metrics.get("sharpe_ratio", 0)
        }
        
        num_trades = analysis["metrics_summary"]["num_trades"]
        
        # Check for issues
        if num_trades == 0:
            analysis["valid"] = False
            analysis["issues"].append("No trades executed - strategy logic may be broken")
        
        if num_trades < 0:
            analysis["valid"] = False
            analysis["issues"].append(f"Invalid trade count: {num_trades}")
        
        return analysis
    
    async def test_strategy(self, strategy: Dict) -> Dict[str, Any]:
        """Test a single strategy end-to-end."""
        self.current_strategy = strategy
        result = {
            "strategy_name": strategy["name"],
            "prompt": strategy["prompt"],
            "timestamp": datetime.now().isoformat(),
            "generation": {},
            "backtest": {},
            "analysis": {},
            "success": False
        }
        
        print(f"\n{'='*60}")
        print(f"Testing: {strategy['name']}")
        print(f"Prompt: {strategy['prompt'][:80]}...")
        print(f"{'='*60}")
        
        # Step 1: Generate XML
        print("\n[1/3] Generating XML...")
        gen_result = await self.generate_strategy_xml(strategy["prompt"])
        result["generation"] = gen_result
        
        if not gen_result.get("success"):
            print(f"  ❌ Generation failed: {gen_result.get('error', 'Unknown')}")
            return result
        
        xml = gen_result["xml"]
        print(f"  ✓ Generated XML ({len(xml)} chars)")
        if gen_result.get("ai_fixed"):
            print("  ⚠ AI applied fixes to the XML")
        
        # Step 2: Run backtest
        print("\n[2/3] Running backtest...")
        backtest_result = await self.run_backtest(xml)
        result["backtest"] = backtest_result
        
        if not backtest_result.get("success"):
            print(f"  ❌ Backtest failed: {backtest_result.get('error', 'Unknown')[:100]}")
            return result
        
        print(f"  ✓ Backtest completed")
        
        # Step 3: Analyze
        print("\n[3/3] Analyzing results...")
        analysis = self.analyze_result(backtest_result)
        result["analysis"] = analysis
        
        metrics = analysis["metrics_summary"]
        print(f"  Return: {metrics.get('return_pct', 0):.2f}%")
        print(f"  Trades: {metrics.get('num_trades', 0)}")
        print(f"  Win Rate: {metrics.get('win_rate', 0):.1f}%")
        print(f"  Max DD: {metrics.get('max_drawdown', 0):.2f}%")
        
        if analysis["valid"]:
            print("\n  ✅ Strategy test PASSED")
            result["success"] = True
        else:
            print(f"\n  ❌ Strategy test FAILED")
            for issue in analysis["issues"]:
                print(f"     - {issue}")
        
        return result
    
    async def run_all_tests(self):
        """Run all test strategies."""
        print("\n" + "="*60)
        print("AUTOMATED BACKTEST TESTING PIPELINE")
        print(f"Started: {datetime.now().isoformat()}")
        print("="*60)
        
        for strategy in TEST_STRATEGIES:
            result = await self.test_strategy(strategy)
            self.results.append(result)
        
        # Summary
        print("\n" + "="*60)
        print("SUMMARY")
        print("="*60)
        
        passed = sum(1 for r in self.results if r["success"])
        total = len(self.results)
        
        for r in self.results:
            status = "✅ PASS" if r["success"] else "❌ FAIL"
            trades = r.get("analysis", {}).get("metrics_summary", {}).get("num_trades", "N/A")
            print(f"  {status} | {r['strategy_name']} | Trades: {trades}")
        
        print(f"\nResult: {passed}/{total} strategies passed")
        
        # Save results to file
        output_file = f"test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        print(f"\nDetailed results saved to: {output_file}")
        
        return self.results


async def main():
    tester = BacktestTester()
    results = await tester.run_all_tests()
    
    # Return exit code based on results
    failed = sum(1 for r in results if not r["success"])
    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    asyncio.run(main())
