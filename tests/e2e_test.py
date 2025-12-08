import requests
import json
import time
import sys
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"

def print_result(step, success, details=""):
    print(f"[{'PASS' if success else 'FAIL'}] {step}")
    if details:
        print(f"       Details: {details}")
    if not success:
        sys.exit(1)

def test_health():
    try:
        # The root endpoint might not return anything or 404, usually /docs is a safe bet for fastapi
        # or we check if connection is accepted.
        # Let's try to just connect.
        response = requests.get(f"{BASE_URL}/docs")
        print_result("Backend Health Check", response.status_code == 200, f"Status: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print_result("Backend Health Check", False, "Could not connect to backend at localhost:8000")

def test_strategy_generation():
    print("\nTesting Strategy Generation...")
    payload = {
        "message": "buy every week",
        "use_rag": False,
        "ai_model": "deepseek"
    }
    
    try:
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/generate-strategy", json=payload)
        duration = time.time() - start_time
        
        if response.status_code != 200:
            print_result("Generate Strategy Request", False, f"Status: {response.status_code}, Body: {response.text}")
        
        data = response.json()
        xml = data.get("xml", "")
        
        is_valid_xml = "<xml" in xml and "</xml>" in xml
        print_result("Generate Strategy XML", is_valid_xml, f"Length: {len(xml)} chars, Time: {duration:.2f}s")
        
        return xml
    except Exception as e:
        print_result("Generate Strategy Exception", False, str(e))

def test_backtest(xml):
    print("\nTesting Backtest...")
    
    # 1 Year period
    start_date = "2024-01-01"
    end_date = "2025-01-01"
    
    payload = {
        "workspaceXml": xml,
        "symbol": "EURUSD", # Using valid symbol
        "startDate": start_date,
        "endDate": end_date,
        "initialBalance": 10000,
        "engine": "backtesting.py"
    }
    
    try:
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/backtest", json=payload)
        duration = time.time() - start_time
        
        if response.status_code != 200:
            print_result("Backtest Request", False, f"Status: {response.status_code}, Body: {response.text}")
        
        data = response.json()
        
        success = data.get("success", False)
        print_result("Backtest Execution", success, f"Time: {duration:.2f}s")
        
        if not success:
            print(f"Error: {data.get('error')}")
            return
            
        metrics = data.get("metrics", {})
        total_trades = metrics.get("total_trades", 0)
        
        # Validation Logic for "Buy Every Week"
        # 52 weeks in a year. Expect roughly 52 trades.
        # Allow some margin for market holidays or data gaps.
        
        expected_trades = 52
        margin = 10 
        
        is_valid_count = (expected_trades - margin) <= total_trades <= (expected_trades + margin)
        
        print_result("Trade Count Validation", is_valid_count, f"Expected ~{expected_trades}, Got {total_trades}")
        
        equity_final = metrics.get("equity_final", 0)
        print(f"       Final Equity: ${equity_final:.2f}")
        
    except Exception as e:
        print_result("Backtest Exception", False, str(e))

if __name__ == "__main__":
    print("Starting E2E Test Suite for PPM Project")
    print("=======================================")
    
    test_health()
    xml = test_strategy_generation()
    if xml:
        test_backtest(xml)
