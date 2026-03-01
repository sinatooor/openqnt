import pytest
import pandas as pd
import numpy as np
from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.routers.compute import router

app = FastAPI()
app.include_router(router)

client = TestClient(app)

def test_compute_rsi():
    # Simple RSI test
    close_prices = list(range(100)) # Simple increasing prices
    response = client.post("/compute/indicators", json={
        "indicatorType": "rsi",
        "params": {"period": 14},
        "priceData": {
            "close": close_prices,
            "high": close_prices,
            "low": close_prices,
            "open": close_prices,
            "volume": [1000] * 100
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert "values" in data
    assert "output" in data["values"]
    assert len(data["values"]["output"]) == 100
    # RSI of constantly increasing series should be 100 eventually, but talib needs time to warm up
    # The first 14 values will be NaN (or 0 if nan_to_num applied)
    # With nan_to_num, NaN becomes 0.
    # RSI increases.
    assert data["values"]["output"][-1] > 90

def test_compute_ta_prefix():
    # Test ta_rsi -> rsi
    close_prices = list(range(100))
    response = client.post("/compute/indicators", json={
        "indicatorType": "ta_rsi",
        "params": {"period": 14},
        "priceData": {
            "close": close_prices,
            "high": close_prices,
            "low": close_prices,
            "open": close_prices,
            "volume": [1000] * 100
        }
    })
    assert response.status_code == 200
    assert "values" in response.json()

def test_compute_supertrend():
    # Test SuperTrend (custom implementation)
    # Create a volatile market
    high = [10, 12, 11, 13, 15, 14, 16, 18, 17, 19, 21, 20, 22, 24, 23]
    low =  [8,  10, 9,  11, 13, 12, 14, 16, 15, 17, 19, 18, 20, 22, 21]
    close =[9,  11, 10, 12, 14, 13, 15, 17, 16, 18, 20, 19, 21, 23, 22]

    response = client.post("/compute/indicators", json={
        "indicatorType": "supertrend",
        "params": {"period": 3, "multiplier": 1.5},
        "priceData": {
            "high": high,
            "low": low,
            "close": close
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert "output" in data["values"]
    assert "trend" in data["values"]
    assert len(data["values"]["output"]) == len(close)

def test_compute_vwap():
    # Test VWAP
    high = [10, 12, 14]
    low = [8, 10, 12]
    close = [9, 11, 13]
    volume = [100, 200, 300]

    response = client.post("/compute/indicators", json={
        "indicatorType": "vwap",
        "priceData": {
            "high": high,
            "low": low,
            "close": close,
            "volume": volume
        }
    })
    assert response.status_code == 200
    values = response.json()["values"]["output"]
    assert abs(values[0] - 9.0) < 0.01
    assert abs(values[1] - 10.33) < 0.01
    assert abs(values[2] - 11.66) < 0.01

def test_compute_ichimoku():
    # Test Ichimoku
    prices = list(range(100))
    response = client.post("/compute/indicators", json={
        "indicatorType": "ichimoku",
        "params": {"tenkan": 9, "kijun": 26, "senkou_b": 52},
        "priceData": {
            "high": prices,
            "low": prices,
            "close": prices
        }
    })
    assert response.status_code == 200
    data = response.json()["values"]
    assert "tenkan" in data
    assert "kijun" in data
    assert "senkou_a" in data
    assert "senkou_b" in data
    assert "chikou" in data
