# PPM Trading Platform - Improvement Plan

**Date:** 2025-12-29  
**Focus:** Fix Nautilus Engine Integration & Critical Backtesting/Execution Features

---

## Executive Summary

Project Prometheus (PPM) is an AI-powered algorithmic trading platform combining visual strategy building (Blockly), AI generation (DeepSeek/Gemini), backtesting, and live trading (IG Markets). The user wants to use **NautilusTrader** as the primary backtesting engine.

### Current State Analysis

| Component | Status | Issues |
|-----------|--------|--------|
| **Nautilus Adapter** | ❌ Broken | NameError on import - type hints reference undefined classes when imports fail |
| **Backtest Engine** | ⚠️ Partial | Falls back to simple engine; Nautilus integration blocked |
| **IR Simulator** | ✅ Working | 35/35 tests pass (excluding Nautilus tests) |
| **Strategy Runner** | ⚠️ Needs Review | Live execution depends on Nautilus being fixed |
| **Risk Controls** | ✅ Working | Tests pass |

---

## Phase 1: Fix Nautilus Adapter (Critical) 

### Issue 1.1: NameError in `nautilus_adapter.py`

**Problem:** When NautilusTrader imports fail partially, the code still defines functions with type hints referencing `Instrument`, `Bar`, etc. causing `NameError`.

**File:** [backend/nautilus_adapter.py](backend/nautilus_adapter.py)

**Fix:**
- Move type hints inside `if NAUTILUS_INSTALLED:` block
- Use string-based type hints or `Any` for fallback
- Ensure the module loads cleanly regardless of Nautilus availability

### Issue 1.2: Incomplete Nautilus Instrument Creation

**Problem:** `_create_instrument` uses outdated API - Nautilus 1.221.0 has different constructors.

**Fix:**
- Use `TestInstrumentProvider` for creating test instruments
- Or use proper `CurrencyPair` / `Equity` constructors per the new API

### Issue 1.3: Bar Data Loading Issues

**Problem:** `_dataframe_to_bars` may use deprecated bar creation patterns.

**Fix:**
- Update to use current Nautilus `Bar` constructor API
- Ensure `BarType` is properly created with `BarSpecification`

### Issue 1.4: Engine Configuration Updates

**Problem:** Engine API may have changed in 1.221.0.

**Fix:**
- Update `BacktestEngine` instantiation
- Update venue and account setup methods

---

## Phase 2: Improve Backtest Pipeline

### Issue 2.1: Engine Selection Logic

**File:** [backend/backtest_runner.py](backend/backtest_runner.py)

**Problem:** Fallback logic is confusing; doesn't clearly communicate which engine is used.

**Fix:**
- Add clear logging of which engine is being used
- Return metadata about engine used in results
- Make Nautilus the default when available

### Issue 2.2: Equity Curve Generation

**Problem:** Nautilus adapter only returns start/end equity points.

**Fix:**
- Implement proper equity curve sampling during backtest
- Use Nautilus account events to track equity over time

### Issue 2.3: Metrics Calculation

**Problem:** Max drawdown and Sharpe ratio are placeholders.

**Fix:**
- Calculate proper metrics from equity curve data
- Align with metrics calculated by IR Simulator

---

## Phase 3: Strategy Execution Improvements

### Issue 3.1: Strategy Code Generation for Nautilus

**Problem:** Generated Python code may not be valid Nautilus strategy classes.

**Fix:**
- Create proper Nautilus strategy template
- Update XML-to-Python converter to generate Nautilus-compatible code

### Issue 3.2: Live Trading Integration

**File:** [backend/strategy_runner.py](backend/strategy_runner.py)

**Problem:** Live runner uses `BlocklyXMLEvaluator` but should use Nautilus-style execution.

**Fix:**
- Ensure consistent logic between backtest and live execution
- Add better error handling and recovery

---

## Phase 4: Test Suite Fixes

### Issue 4.1: Nautilus Tests Collection Errors

**Files:**
- `tests/test_nautilus_backtest_adapter_contract.py`
- `tests/test_nautilus_backtest_smoke.py`
- `tests/test_ui_representation_compat.py`

**Fix:**
- Update tests to handle import errors gracefully
- Add proper `pytest.mark.skipif` decorators

---

## Implementation Order

1. **[CRITICAL]** Fix `nautilus_adapter.py` to load without errors
2. **[CRITICAL]** Update Nautilus API calls to 1.221.0
3. **[HIGH]** Fix equity curve and metrics calculation
4. **[MEDIUM]** Update test suite
5. **[MEDIUM]** Improve strategy code generation

---

## Validation Checklist

After implementation, verify:

- [ ] `python -m pytest tests/ -v` passes without collection errors
- [ ] `python -m pytest tests/test_nautilus_backtest_adapter_contract.py -v` passes
- [ ] `python -m pytest tests/test_nautilus_backtest_smoke.py -v` passes
- [ ] Backtest endpoint returns proper results with Nautilus engine
- [ ] Equity curve has more than 2 data points
- [ ] Metrics (Sharpe, Max DD) are calculated properly

---

## Files to Modify

| File | Changes |
|------|---------|
| `backend/nautilus_adapter.py` | Fix imports, update API calls, improve type safety |
| `backend/backtest_runner.py` | Improve engine selection, add logging |
| `backend/backtest_service.py` | Ensure Nautilus integration works |
| `tests/test_nautilus_*.py` | Fix import handling |

---

## Notes

- NautilusTrader 1.221.0 is installed and imports work directly
- The issue is conditional import handling in the adapter layer
- All non-Nautilus tests pass (35/35)
