import requests
import json
import time
import sys
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("tests/stress_test_report.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

BASE_URL = "http://127.0.0.1:8000"

SCENARIOS = [
    "Buy every week",
    "Buy every month",
    "Buy when RSI is below 30",
    "Sell when RSI is above 70",
    "Buy when SMA 10 crosses above SMA 50",
    "Sell when SMA 10 crosses below SMA 50",
    "Buy when EMA 12 crosses above EMA 26",
    "Sell when EMA 12 crosses below EMA 26",
    "Buy when Price crosses above Bollinger Band Upper",
    "Sell when Price crosses below Bollinger Band Lower",
    "Buy when MACD line crosses above Signal line",
    "Sell when MACD line crosses below Signal line",
    "Buy when Stochastic K is below 20",
    "Sell when Stochastic K is above 80",
    "Buy every Monday",
    "Buy every Friday",
    "Buy when Price is above SMA 200",
    "Sell when Price is below SMA 200",
    "Buy when ATR is greater than 0.005",
    "Buy when ADX is greater than 25"
]

def check_backend():
    try:
        requests.get(f"{BASE_URL}/docs", timeout=5)
        return True
    except:
        return False

def run_scenario(prompt, index):
    logger.info(f"--- Scenario {index+1}: '{prompt}' ---")
    
    # 1. Generate Strategy
    try:
        gen_start = time.time()
        response = requests.post(
            f"{BASE_URL}/generate-strategy", 
            json={"message": prompt, "use_rag": False, "ai_model": "deepseek"},
            timeout=120
        )
        gen_duration = time.time() - gen_start
        
        if response.status_code != 200:
            logger.error(f"Generation Failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        xml = data.get("xml", "")
        if not xml or "<xml" not in xml:
            logger.error(f"Invalid XML returned. Length: {len(xml)}")
            return False
            
        logger.info(f"Generation Success ({gen_duration:.2f}s)")
        
    except Exception as e:
        logger.error(f"Generation Exception: {e}")
        return False

    # 2. Backtest Strategy
    try:
        bt_start = time.time()
        payload = {
            "workspaceXml": xml,
            "symbol": "EURUSD",
            "startDate": "2024-01-01",
            "endDate": "2025-01-01",
            "initialBalance": 10000,
            "engine": "backtesting.py", # Use backtesting.py engine
            "use_llm": True # Enable LLM for code conversion
        }
        
        response = requests.post(f"{BASE_URL}/backtest", json=payload, timeout=120)
        bt_duration = time.time() - bt_start
        
        if response.status_code != 200:
            logger.error(f"Backtest Failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        success = data.get("success", False)
        trades = data.get("metrics", {}).get("total_trades", 0)
        
        if success:
            logger.info(f"Backtest Success ({bt_duration:.2f}s) | Trades: {trades}")
            return True
        else:
            logger.error(f"Backtest Logic Failed: {data.get('error')}")
            return False
            
    except Exception as e:
        logger.error(f"Backtest Exception: {e}")
        return False

def run_batch():
    logger.info("Starting Batch of 20 Tests...")
    batch_start = time.time()
    passed = 0
    
    for i, prompt in enumerate(SCENARIOS):
        if run_scenario(prompt, i):
            passed += 1
        time.sleep(1) # Brief pause between tests
        
    batch_duration = time.time() - batch_start
    logger.info(f"Batch Complete. Passed: {passed}/{len(SCENARIOS)}. Duration: {batch_duration/60:.2f} mins")
    
    return batch_duration

if __name__ == "__main__":
    if not check_backend():
        logger.error("Backend not reachable. Exiting.")
        sys.exit(1)
        
    logger.info("Stress Test Suite Initialized")
    
    cycle = 1
    while True:
        logger.info(f"=== CYCLE {cycle} ===")
        duration_seconds = run_batch()
        
        # User logic: "if it takes less than 30 minuts, run 20 more then go to step 1 again"
        # This effectively means "Run continuously", but we log the timing condition.
        if duration_seconds < 1800:
            logger.info("Batch took < 30 mins. Continuing immediately...")
        else:
            logger.info("Batch took > 30 mins. Continuing cycle...")
            
        cycle += 1
        time.sleep(5)
