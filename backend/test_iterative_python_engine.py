"""
Comprehensive Iterative Testing for Python Backtest Engine

This script tests 8 different trading strategies with full iteration:
1. Generate XML using FULL_SYSTEM_PROMPT
2. Backtest using Python (AI-generated)
3. Analyze XML vs Python code
4. Verify results for rationality
5. Fix any issues (parsing, prompts, new blocks)
6. Iterate until correct
7. Move to next strategy

Run with: python test_iterative_python_engine.py
"""

import asyncio
import httpx
import json
import re
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Tuple
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:8000"
TIMEOUT_GEN = 240.0  # 4 minutes for XML generation
TIMEOUT_BACKTEST = 360.0  # 6 minutes for backtest
MAX_ITERATIONS_PER_STRATEGY = 3  # Max fix attempts per strategy

# 8 Diverse Trading Strategies to Test
TEST_STRATEGIES = [
    {
        "name": "MACD Crossover",
        "type": "TREND",
        "prompt": "Create a MACD crossover strategy: Buy when MACD line crosses above signal line, sell when it crosses below. Use 12/26/9 periods. Set stop loss at 2x ATR below entry, take profit at 3x ATR above entry.",
        "expected_blocks": ["ta_macd", "operator_greater", "operator_less", "trade_order", "ta_atr"],
        "expected_trades_range": (5, 50),
    },
    {
        "name": "Stochastic Oversold/Overbought",
        "type": "OSCILLATOR",
        "prompt": "Create a Stochastic oscillator strategy: Buy when Stochastic %K crosses above 20 (oversold), sell when it crosses above 80 (overbought). Use 14/3/3 periods.",
        "expected_blocks": ["stochastic", "operator_greater", "operator_less", "trade_order"],
        "expected_trades_range": (10, 100),
    },
    {
        "name": "Keltner Channel Breakout",
        "type": "BREAKOUT",
        "prompt": "Create a Keltner Channel breakout strategy: Buy when price breaks above upper band, sell when price breaks below lower band. Use 20-period EMA and 2x ATR for bands.",
        "expected_blocks": ["ta_ema", "ta_atr", "operator_greater", "operator_less", "trade_order", "environment_price"],
        "expected_trades_range": (5, 40),
    },
    {
        "name": "ADX Trend Strength",
        "type": "TREND_STRENGTH",
        "prompt": "Create an ADX trend strength strategy: Only trade when ADX > 25 (strong trend). Buy when price > 20 EMA and ADX rising, sell when price < 20 EMA. Use 14-period ADX.",
        "expected_blocks": ["ta_adx", "ta_ema", "operator_greater", "operator_less", "trade_order", "environment_price"],
        "expected_trades_range": (5, 30),
    },
    {
        "name": "CCI Mean Reversion",
        "type": "MEAN_REVERSION",
        "prompt": "Create a CCI mean reversion strategy: Buy when CCI < -100 (oversold), sell when CCI > 100 (overbought). Use 20-period CCI.",
        "expected_blocks": ["ta_cci", "operator_greater", "operator_less", "trade_order"],
        "expected_trades_range": (10, 60),
    },
    {
        "name": "Triple EMA Crossover",
        "type": "MULTI_TIMEFRAME",
        "prompt": "Create a triple EMA strategy: Buy when fast EMA (9) > medium EMA (21) > slow EMA (55), sell when fast < medium. Use ATR-based stops.",
        "expected_blocks": ["ta_ema", "operator_greater", "operator_less", "operator_and", "trade_order", "ta_atr"],
        "expected_trades_range": (5, 40),
    },
    {
        "name": "Williams %R Reversal",
        "type": "OSCILLATOR",
        "prompt": "Create a Williams %R reversal strategy: Buy when Williams %R crosses above -80 (oversold exit), sell when it crosses below -20 (overbought exit). Use 14-period.",
        "expected_blocks": ["wpr", "operator_greater", "operator_less", "trade_order"],
        "expected_trades_range": (10, 70),
    },
    {
        "name": "Parabolic SAR Trend Following",
        "type": "TREND_FOLLOWING",
        "prompt": "Create a Parabolic SAR trend following strategy: Buy when price crosses above SAR, sell when price crosses below SAR. Use default SAR settings (0.02 step, 0.2 max).",
        "expected_blocks": ["parabolicSar", "operator_greater", "operator_less", "trade_order", "environment_price"],
        "expected_trades_range": (10, 60),
    },
]


class IterativeStrategyTester:
    def __init__(self):
        self.results = []
        self.fixes_applied = []
        
    async def generate_xml(self, prompt: str) -> Dict[str, Any]:
        """Step 1: Generate XML using FULL_SYSTEM_PROMPT"""
        print(f"  [Gen] Generating XML...")
        async with httpx.AsyncClient(timeout=TIMEOUT_GEN) as client:
            resp = await client.post(
                f"{BACKEND_URL}/strategy/legacy",
                json={"message": prompt}
            )
            if resp.status_code != 200:
                return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
            
            data = resp.json()
            if not data.get("xml"):
                return {"success": False, "error": "No XML returned"}
            
            return {
                "success": True,
                "xml": data["xml"],
                "code": data.get("code"),
                "strategy_id": data.get("strategy_id")
            }
    
    async def run_backtest(self, xml: str, force_regenerate: bool = False) -> Dict[str, Any]:
        """Step 2 & 5: Run backtest using Python (AI-generated) engine"""
        print(f"  [Backtest] Running Python engine...")
        payload = {
            "workspaceXml": xml,
            "symbol": "AAPL",
            "startDate": "2024-01-01",
            "endDate": "2024-12-01",
            "engine": "backtesting.py",
            "use_llm": True,  # Force AI generation (not simple parser)
            "data_source": "yfinance",
            "interval": "1d",
            "forceRegenerate": force_regenerate
        }
        
        async with httpx.AsyncClient(timeout=TIMEOUT_BACKTEST) as client:
            resp = await client.post(f"{BACKEND_URL}/backtest", json=payload)
            if resp.status_code != 200:
                return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
            
            return resp.json()
    
    def analyze_xml_structure(self, xml: str, expected_blocks: List[str]) -> Dict[str, Any]:
        """Step 3: Analyze XML code structure"""
        print(f"  [Analyze] Checking XML structure...")
        issues = []
        
        # Check for expected blocks
        for block_type in expected_blocks:
            if f'type="{block_type}"' not in xml:
                issues.append(f"Missing expected block: {block_type}")
        
        # Check for common issues
        if 'ma_period="14"' in xml and xml.count('ma_period="14"') > 3:
            # Multiple indicators with same period (potential crossover issue)
            if 'operator_greater' in xml or 'operator_less' in xml:
                issues.append("Potential identical indicator comparison (same ma_period)")
        
        # Check for invalid TRADE_ID characters
        trade_id_matches = re.findall(r'TRADE_ID">([^<]+)<', xml)
        for trade_id in trade_id_matches:
            if re.search(r'[^a-zA-Z0-9_-]', trade_id):
                issues.append(f"Invalid TRADE_ID: {trade_id} (contains special chars)")
        
        # Check for SIZE field
        if 'field name="SIZE"' not in xml and 'value name="SIZE"' not in xml:
            issues.append("Missing SIZE field in trade_order")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "block_count": xml.count('<block type=')
        }
    
    def analyze_python_code(self, code: str) -> Dict[str, Any]:
        """Step 3: Analyze generated Python code"""
        print(f"  [Analyze] Checking Python code...")
        issues = []
        
        if not code:
            return {"valid": False, "issues": ["No Python code generated"]}
        
        # Check for common issues
        if "talib" in code.lower():
            issues.append("Uses talib (should use custom implementations)")
        
        if ".shift(" in code:
            issues.append("Uses .shift() on backtesting arrays (not supported)")
        
        if "self.data.index %" in code:
            issues.append("Uses modulo on DateTimeIndex (TypeError)")
        
        # Check for required Strategy class
        if "class" not in code or "Strategy" not in code:
            issues.append("Missing Strategy class definition")
        
        # Check for init method
        if "def init(self)" not in code:
            issues.append("Missing init() method")
        
        # Check for next method
        if "def next(self)" not in code:
            issues.append("Missing next() method")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "has_indicators": bool(re.search(r'(RSI|SMA|EMA|ATR|MACD|BB)', code)),
            "has_trade_logic": "self.buy(" in code or "self.sell(" in code
        }
    
    def verify_backtest_results(
        self,
        result: Dict[str, Any],
        expected_trades_range: Tuple[int, int]
    ) -> Dict[str, Any]:
        """Step 6 & 8: Verify backtest results for rationality"""
        print(f"  [Verify] Checking result rationality...")
        issues = []
        warnings = []
        
        if not result.get("success"):
            error_msg = result.get("error", result.get("metrics", {}).get("error", "Unknown error"))
            return {
                "rational": False,
                "issues": [f"Backtest failed: {error_msg}"],
                "warnings": []
            }
        
        metrics = result.get("metrics", {})
        trades = metrics.get("total_trades", 0)
        total_return = metrics.get("total_return", 0)
        
        # Check trade count
        min_trades, max_trades = expected_trades_range
        if trades < min_trades:
            warnings.append(f"Low trade count: {trades} (expected {min_trades}-{max_trades})")
        elif trades > max_trades * 2:
            warnings.append(f"Very high trade count: {trades} (expected {min_trades}-{max_trades})")
        elif trades == 0:
            issues.append("Zero trades executed (strategy never triggered)")
        
        # Check return sanity
        if total_return < -99:
            issues.append(f"Extreme loss: {total_return:.2f}% (likely strategy error)")
        elif total_return > 1000:
            warnings.append(f"Unrealistic gain: {total_return:.2f}% (check leverage/sizing)")
        
        # Check win rate
        win_rate = metrics.get("win_rate", 0)
        if win_rate == 0 and trades > 5:
            warnings.append("0% win rate (all losing trades)")
        elif win_rate == 100 and trades > 5:
            warnings.append("100% win rate (suspiciously perfect)")
        
        return {
            "rational": len(issues) == 0,
            "issues": issues,
            "warnings": warnings,
            "trades": trades,
            "return": total_return,
            "win_rate": win_rate
        }
    
    def diagnose_failure(
        self,
        xml_analysis: Dict,
        code_analysis: Dict,
        result_verification: Dict
    ) -> Dict[str, Any]:
        """Step 7: Diagnose root cause of failure"""
        print(f"  [Diagnose] Finding root cause...")
        
        root_causes = []
        suggested_fixes = []
        
        # XML issues
        if not xml_analysis["valid"]:
            for issue in xml_analysis["issues"]:
                if "Missing expected block" in issue:
                    root_causes.append("PROMPT_INCOMPLETE")
                    suggested_fixes.append(f"Update FULL_SYSTEM_PROMPT to better handle: {issue}")
                elif "identical indicator" in issue:
                    root_causes.append("CROSSOVER_LOGIC_ERROR")
                    suggested_fixes.append("Fix crossover indicator periods in validation pass")
                elif "Invalid TRADE_ID" in issue:
                    root_causes.append("INVALID_TRADE_ID")
                    suggested_fixes.append("Add TRADE_ID sanitization in prompt")
        
        # Python code issues
        if not code_analysis["valid"]:
            for issue in code_analysis["issues"]:
                if "talib" in issue:
                    root_causes.append("TALIB_DEPENDENCY")
                    suggested_fixes.append("Ensure XML_TO_PYTHON_PROMPT forbids talib")
                elif ".shift()" in issue:
                    root_causes.append("PANDAS_SHIFT_ERROR")
                    suggested_fixes.append("Add rule to XML_TO_PYTHON_PROMPT: no .shift()")
                elif "modulo on DateTimeIndex" in issue:
                    root_causes.append("TIMESTAMP_MODULO_ERROR")
                    suggested_fixes.append("Add rule: use len(self.data) % n instead of self.data.index % n")
                elif "Missing" in issue and "method" in issue:
                    root_causes.append("INCOMPLETE_STRATEGY_CLASS")
                    suggested_fixes.append("Fix XML_TO_PYTHON_PROMPT template structure")
        
        # Result issues
        if not result_verification["rational"]:
            for issue in result_verification["issues"]:
                if "Zero trades" in issue:
                    root_causes.append("LOGIC_NEVER_TRIGGERS")
                    suggested_fixes.append("Check condition logic - may be too restrictive")
                elif "Extreme loss" in issue:
                    root_causes.append("RISK_MANAGEMENT_ERROR")
                    suggested_fixes.append("Check SL/TP calculation - may be inverted or missing")
                elif "failed" in issue.lower():
                    root_causes.append("RUNTIME_ERROR")
                    suggested_fixes.append(f"Fix runtime error: {issue}")
        
        return {
            "root_causes": list(set(root_causes)),
            "suggested_fixes": suggested_fixes,
            "fixable": len(root_causes) > 0
        }
    
    async def test_strategy(self, strategy: Dict[str, Any]) -> Dict[str, Any]:
        """Test a single strategy with iteration"""
        print(f"\n{'='*60}")
        print(f"🧪 TESTING: {strategy['name']} ({strategy['type']})")
        print(f"{'='*60}")
        
        iteration = 0
        final_result = None
        
        while iteration < MAX_ITERATIONS_PER_STRATEGY:
            iteration += 1
            print(f"\n--- Iteration {iteration}/{MAX_ITERATIONS_PER_STRATEGY} ---")
            
            # Step 1: Generate XML
            gen_result = await self.generate_xml(strategy["prompt"])
            if not gen_result["success"]:
                print(f"  ❌ XML Generation Failed: {gen_result['error']}")
                if iteration == MAX_ITERATIONS_PER_STRATEGY:
                    return {
                        "strategy": strategy["name"],
                        "success": False,
                        "iterations": iteration,
                        "final_error": gen_result["error"],
                        "stage": "XML_GENERATION"
                    }
                continue
            
            xml = gen_result["xml"]
            print(f"  ✅ XML Generated ({len(xml)} chars)")
            
            # Step 3: Analyze XML
            xml_analysis = self.analyze_xml_structure(xml, strategy["expected_blocks"])
            if not xml_analysis["valid"]:
                print(f"  ⚠️  XML Issues: {xml_analysis['issues']}")
            else:
                print(f"  ✅ XML Valid ({xml_analysis['block_count']} blocks)")
            
            # Step 2: Run backtest
            backtest_result = await self.run_backtest(xml, force_regenerate=(iteration > 1))
            
            # Step 3: Analyze Python code
            python_code = backtest_result.get("generated_code", gen_result.get("code", ""))
            code_analysis = self.analyze_python_code(python_code)
            if not code_analysis["valid"]:
                print(f"  ⚠️  Python Issues: {code_analysis['issues']}")
            else:
                print(f"  ✅ Python Code Valid")
            
            # Step 6 & 8: Verify results
            result_verification = self.verify_backtest_results(
                backtest_result,
                strategy["expected_trades_range"]
            )
            
            if result_verification["rational"]:
                print(f"  ✅ Results Rational:")
                print(f"     Trades: {result_verification['trades']}")
                print(f"     Return: {result_verification['return']:.2f}%")
                print(f"     Win Rate: {result_verification['win_rate']:.1f}%")
                
                if result_verification["warnings"]:
                    print(f"  ⚠️  Warnings: {result_verification['warnings']}")
                
                # Success!
                return {
                    "strategy": strategy["name"],
                    "success": True,
                    "iterations": iteration,
                    "trades": result_verification["trades"],
                    "return": result_verification["return"],
                    "win_rate": result_verification["win_rate"],
                    "warnings": result_verification["warnings"],
                    "xml_blocks": xml_analysis["block_count"]
                }
            else:
                print(f"  ❌ Results Invalid: {result_verification['issues']}")
                
                # Step 7: Diagnose
                diagnosis = self.diagnose_failure(xml_analysis, code_analysis, result_verification)
                print(f"  🔍 Root Causes: {diagnosis['root_causes']}")
                print(f"  💡 Suggested Fixes:")
                for fix in diagnosis['suggested_fixes']:
                    print(f"     - {fix}")
                
                # Store diagnosis for reporting
                self.fixes_applied.append({
                    "strategy": strategy["name"],
                    "iteration": iteration,
                    "diagnosis": diagnosis
                })
                
                # If last iteration, return failure
                if iteration == MAX_ITERATIONS_PER_STRATEGY:
                    return {
                        "strategy": strategy["name"],
                        "success": False,
                        "iterations": iteration,
                        "final_error": result_verification["issues"],
                        "diagnosis": diagnosis,
                        "stage": "VERIFICATION"
                    }
        
        # Should not reach here
        return {
            "strategy": strategy["name"],
            "success": False,
            "iterations": iteration,
            "final_error": "Max iterations reached",
            "stage": "UNKNOWN"
        }
    
    async def run_all_tests(self):
        """Run tests for all 8 strategies"""
        print("\n" + "="*60)
        print("🚀 COMPREHENSIVE PYTHON ENGINE TESTING")
        print("="*60)
        print(f"Testing {len(TEST_STRATEGIES)} strategies")
        print(f"Max iterations per strategy: {MAX_ITERATIONS_PER_STRATEGY}")
        print(f"Backend: {BACKEND_URL}")
        print("="*60)
        
        start_time = datetime.now()
        
        for idx, strategy in enumerate(TEST_STRATEGIES, 1):
            result = await self.test_strategy(strategy)
            self.results.append(result)
            
            # Brief pause between strategies
            if idx < len(TEST_STRATEGIES):
                await asyncio.sleep(2)
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        # Generate final report
        self.print_final_report(duration)
        
        # Save detailed results
        self.save_results()
    
    def print_final_report(self, duration: float):
        """Print comprehensive final report"""
        print("\n" + "="*60)
        print("📊 FINAL TEST REPORT")
        print("="*60)
        
        passed = sum(1 for r in self.results if r["success"])
        failed = len(self.results) - passed
        
        print(f"\n✅ Passed: {passed}/{len(self.results)}")
        print(f"❌ Failed: {failed}/{len(self.results)}")
        print(f"⏱️  Total Duration: {duration/60:.1f} minutes")
        
        print("\n" + "-"*60)
        print("STRATEGY RESULTS:")
        print("-"*60)
        
        for result in self.results:
            status = "✅ PASS" if result["success"] else "❌ FAIL"
            print(f"\n{status} | {result['strategy']}")
            print(f"  Iterations: {result['iterations']}")
            
            if result["success"]:
                print(f"  Trades: {result['trades']}")
                print(f"  Return: {result['return']:.2f}%")
                print(f"  Win Rate: {result['win_rate']:.1f}%")
                if result.get("warnings"):
                    print(f"  Warnings: {', '.join(result['warnings'])}")
            else:
                print(f"  Failed at: {result['stage']}")
                print(f"  Error: {result['final_error']}")
                if result.get("diagnosis"):
                    print(f"  Root Causes: {result['diagnosis']['root_causes']}")
        
        # Common issues summary
        if self.fixes_applied:
            print("\n" + "-"*60)
            print("COMMON ISSUES FOUND:")
            print("-"*60)
            
            all_causes = []
            for fix in self.fixes_applied:
                all_causes.extend(fix["diagnosis"]["root_causes"])
            
            from collections import Counter
            cause_counts = Counter(all_causes)
            
            for cause, count in cause_counts.most_common():
                print(f"  {cause}: {count} occurrences")
    
    def save_results(self):
        """Save detailed results to JSON"""
        output = {
            "timestamp": datetime.now().isoformat(),
            "total_strategies": len(self.results),
            "passed": sum(1 for r in self.results if r["success"]),
            "failed": sum(1 for r in self.results if not r["success"]),
            "results": self.results,
            "fixes_applied": self.fixes_applied
        }
        
        filename = "python_engine_test_results.json"
        with open(filename, "w") as f:
            json.dump(output, f, indent=2)
        
        print(f"\n💾 Detailed results saved to: {filename}")


async def main():
    tester = IterativeStrategyTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
