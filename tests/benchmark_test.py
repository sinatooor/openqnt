import requests
import json
import time
import sys
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

BASE_URL = "http://127.0.0.1:8000"

SCENARIOS = [
    {
        "name": "Buy and Hold EURUSD 2024",
        "prompt": "Buy at the beginning and hold until the end",
        "start_date": "2024-01-01",
        "end_date": "2024-12-08"
    },
    {
        "name": "Golden Cross EURUSD 2024",
        "prompt": "Buy when SMA 50 crosses above SMA 200, sell when SMA 50 crosses below SMA 200",
        "start_date": "2024-01-01",
        "end_date": "2024-12-08"
    }
]

def run_benchmark():
    results = {}
    
    for scenario in SCENARIOS:
        logger.info(f"--- Running Benchmark: {scenario['name']} ---")
        
        # 1. Generate
        try:
            resp = requests.post(
                f"{BASE_URL}/generate-strategy",
                json={"message": scenario["prompt"], "use_rag": False, "ai_model": "deepseek"},
                timeout=120
            ) 
            if resp.status_code != 200:
                logger.error(f"Generation failed: {resp.text}")
                continue
            xml = resp.json().get("xml")
        except Exception as e:
            logger.error(f"Generation Exception: {e}")
            continue

        # 2. Backtest
        try:
            payload = {
                "workspaceXml": xml,
                "symbol": "EURUSD",
                "startDate": scenario["start_date"],
                "endDate": scenario["end_date"],
                "initialBalance": 10000,
                "engine": "backtesting.py",
                "use_llm": True
            }
            resp = requests.post(f"{BASE_URL}/backtest", json=payload, timeout=120)
            if resp.status_code != 200:
                logger.error(f"Backtest failed: {resp.text}")
                continue
            
            data = resp.json()
            metrics = data.get("metrics", {})
            
            check_result = {
                "return_pct": metrics.get("total_return"),
                "trades": metrics.get("total_trades"),
                "final_equity": metrics.get("equity_final"),
                "buy_hold_return": metrics.get("buy_hold_return") # Not usually returned but we can infer or added if beneficial
            }
            results[scenario["name"]] = check_result
            logger.info(f"Result: {check_result}")
            
        except Exception as e:
            logger.error(f"Backtest Exception: {e}")
            continue
            
    print("\n=== BENCHMARK SUMMARY ===")
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    run_benchmark()
