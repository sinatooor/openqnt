import requests
import time
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def run_test(template_id, iterations=1):
    print(f"\n{'='*60}")
    print(f"TESTING TEMPLATE: {template_id} ({iterations} iterations)")
    print(f"{'='*60}")
    
    success_count = 0
    trade_count = 0
    
    for i in range(1, iterations + 1):
        print(f"  Run {i}/{iterations}...", end="", flush=True)
        try:
            start_time = time.time()
            response = requests.post(f"{BASE_URL}/backtest", json={
                "symbol": "EURUSD",
                "startDate": "2024-01-01",
                "endDate": "2024-03-31",
                "cash": 10000,
                "engine": "nautilus",
                "templateId": template_id,
                "workspaceXml": "<xml></xml>"
            }, timeout=60)
            duration = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    metrics = result.get("metrics", {})
                    trades = metrics.get("total_trades", 0)
                    ret = metrics.get("total_return", 0)
                    print(f" ✓ Success ({duration:.1f}s) | Trades: {trades} | Return: {ret}%")
                    success_count += 1
                    trade_count += trades
                else:
                    error = result.get("error", "Unknown error")
                    print(f" ✗ Application Error: {error}")
            else:
                print(f" ✗ HTTP Error: {response.status_code}")
                print(response.text[:100])
                
        except Exception as e:
            print(f" ✗ Exception: {e}")
        
        time.sleep(1)

    return success_count, trade_count

# 1. Loop Test RSI
success, trades = run_test("rsi-oversold-reversal", 8)
if trades == 0:
    print("\nWARNING: No trades executed in RSI test!")

# 2. Test Others
other_templates = [
    "simple-ma-crossover",
    "bollinger-breakout",
    "macd-momentum",
    "triple-ema-trend"
]

for tmpl in other_templates:
    run_test(tmpl, 1)
