# Platform Vision (Non-Executable)

## Core Principles

* Strategy logic is portable
* Execution is adaptive
* AI is assistive, explainable, and non-opaque
* Humans remain in control
* Platform is broker-agnostic
* Data compounds as a network effect
* Transparency > black-box automation

(This section is informational only and must not be modified by the improve loop.)

---

# Executable Objectives

## Objective 001

**id:** 001  
**title:** Make NautilusTrader the backtesting engine and match `backtesting.py` UI representation  
**status:** blocked

**notes:** Command failed: python -m pytest tests/test_nautilus_backtest_adapter_contract.py
Stdout: ============================= test session starts ==============================
platform darwin -- Python 3.13.2, pytest-9.0.2, pluggy-1.6.0
rootdir: /Users/sina/project-fire/PPM
plugins: anyio-4.12.0
collected 0 items / 1 error

==================================== ERRORS ====================================
______ ERROR collecting tests/test_nautilus_backtest_adapter_contract.py _______
tests/test_nautilus_backtest_adapter_contract.py:10: in <module>
    from backend.nautilus_adapter import run_nautilus_backtest, NAUTILUS_INSTALLED
backend/nautilus_adapter.py:37: in <module>
    def _create_instrument(symbol: str) -> Instrument:
                                           ^^^^^^^^^^
E   NameError: name 'Instrument' is not defined
=========================== short test summary info ============================
ERROR tests/test_nautilus_backtest_adapter_contract.py - NameError: name 'Ins...
!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
=============================== 1 error in 1.35s ===============================

Stderr:   

**details:**
Integrate NautilusTrader as the primary backtesting engine and ensure it outputs the same UI-facing backtest representation currently produced by `backtesting.py`.

Implementation requirements:

* Add an adapter layer (e.g. `nautilus_adapter.py`) which runs a Nautilus backtest headlessly and converts results into the existing `backtesting.py` UI representation contract (JSON/object shape used by the frontend).
* Do not break the existing frontend contract. If Nautilus provides richer detail, extend the UI representation in a backwards-compatible way (optional fields), such as:
  * order lifecycle events (submitted/accepted/filled/canceled)
  * fills and partial fills
  * slippage/latency parameters used (if configured)
  * per-trade attribution/metadata (if available)
* Ensure deterministic results for the same inputs/config (within reasonable floating-point tolerance).

**acceptance_criteria:**

* Running a Nautilus backtest produces an output object that matches the `backtesting.py` UI representation shape and semantics for a comparable scenario.
* Any added Nautilus-only fields are optional and do not break existing frontend rendering.
* Backtest is runnable headlessly (no GUI) and works in CI/server environments with no display.
* Output is deterministic for the same inputs/config (within tolerance).

**validation (headless only):**

* `python -m pytest tests/test_nautilus_backtest_adapter_contract.py`
* `python -m pytest tests/test_nautilus_backtest_smoke.py`
* `python -m pytest tests/test_ui_representation_compat.py`

---

## Objective 002

**id:** 002  
**title:** Define broker-agnostic strategy intermediate representation (IR)  
**status:** done  

**details:**
Create a minimal, explicit strategy IR that represents:

* signals
* entry conditions
* exit conditions
* position sizing  
  without referencing any broker, symbol format, or execution API.

**acceptance_criteria:**

* IR is defined as a typed Python structure or schema
* IR can represent at least one simple long-only strategy
* IR is documented inline with comments

**validation:**

* `python -m pytest tests/test_strategy_ir.py`

---

## Objective 003

**id:** 003  
**title:** Parse rule-based strategies into IR  
**status:** done  

**details:**
Implement a rule-based strategy builder that converts human-readable rules into the IR defined in Objective 002.

**acceptance_criteria:**

* Given a rule-based strategy definition, IR is produced deterministically
* Invalid rules fail with clear error messages

**validation:**

* `python -m pytest tests/test_rule_parser.py`

---

## Objective 004

**id:** 004  
**title:** Implement IR execution simulator (no broker)  
**status:** done  

**details:**
Create a pure simulation engine that executes IR strategies against historical price data without broker logic.

**acceptance_criteria:**

* Supports bar-based execution
* Generates trades and PnL
* Deterministic results for identical inputs

**validation:**

* `python -m pytest tests/test_ir_simulator.py`

---

## Objective 005

**id:** 005  
**title:** Add basic backtesting framework  
**status:** done  

**details:**
Wrap the IR simulator with a backtesting interface that supports:

* multiple date ranges
* strategy comparison

**acceptance_criteria:**

* Backtests can be run from CLI
* Results include return, drawdown, trade count

**validation:**

* `python -m pytest tests/test_backtesting.py`

---

## Objective 006

**id:** 006  
**title:** Add headless risk controls to IR execution  
**status:** done  

**details:**
Introduce risk constraints into execution:

* max drawdown
* max position size

**acceptance_criteria:**

* Trades are blocked when constraints are violated
* Violations are logged explicitly

**validation:**

* `python -m pytest tests/test_risk_controls.py`

---

## Objective 007

**id:** 007  
**title:** Add broker capability abstraction layer  
**status:** done

**notes:** Command failed: python -m pytest tests/test_broker_capabilities.py
Stdout: 
Stderr: /Users/sina/project-fire/PPM/backend/venv/bin/python: No module named pytest
  

**details:**
Define a broker capability interface describing:

* supported order types
* lot sizes
* market hours

No real broker integration yet.

**acceptance_criteria:**

* At least two mock brokers with differing capabilities
* Capability mismatches are detectable

**validation:**

* `python -m pytest tests/test_broker_capabilities.py`

---

## Objective 008

**id:** 008  
**title:** Adapt IR to broker capabilities  
**status:** done  

**details:**
Implement logic that adapts IR strategies when a broker lacks features (e.g. emulating OCO).

**acceptance_criteria:**

* Strategy adapts or fails with clear warnings
* Original intent is preserved where possible

**validation:**

* `python -m pytest tests/test_ir_adaptation.py`

---

## Objective 009

**id:** 009  
**title:** Add AI-assisted strategy review (read-only)  
**status:** done

**notes:** Command failed: python -m pytest tests/test_ai_strategy_review.py
Stdout: ============================= test session starts ==============================
platform darwin -- Python 3.13.2, pytest-9.0.2, pluggy-1.6.0
rootdir: /Users/sina/project-fire/PPM
plugins: anyio-4.12.0
collected 0 items / 1 error

==================================== ERRORS ====================================
______________ ERROR collecting tests/test_ai_strategy_review.py _______________
backend/venv/lib/python3.13/site-packages/_pytest/python.py:507: in importtestmodule
    mod = import_path(
backend/venv/lib/python3.13/site-packages/_pytest/pathlib.py:587: in import_path
    importlib.import_module(module_name)
/opt/homebrew/Cellar/python@3.13/3.13.2/Frameworks/Python.framework/Versions/3.13/lib/python3.13/importlib/__init__.py:88: in import_module
    return _bootstrap._gcd_import(name[level:], package, level)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
<frozen importlib._bootstrap>:1387: in _gcd_import
    ???
<frozen importlib._bootstrap>:1360: in _find_and_load
    ???
<frozen importlib._bootstrap>:1331: in _find_and_load_unlocked
    ???
<frozen importlib._bootstrap>:935: in _load_unlocked
    ???
backend/venv/lib/python3.13/site-packages/_pytest/assertion/rewrite.py:197: in exec_module
    exec(co, module.__dict__)
tests/test_ai_strategy_review.py:2: in <module>
    from backend.ai_strategy_reviewer import review_strategy
E     File "/Users/sina/project-fire/PPM/backend/ai_strategy_reviewer.py", line 42
E       if cleaned.startswith("
E                             ^
E   SyntaxError: unterminated string literal (detected at line 42)
=========================== short test summary info ============================
ERROR tests/test_ai_strategy_review.py
!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
=============================== 1 error in 0.09s ===============================

Stderr:   

**details:**
Allow AI to analyze an IR strategy and produce:

* explanation of logic
* identified weaknesses
* overfitting risks

No auto-modification allowed.

**acceptance_criteria:**

* AI output is structured
* No code changes are made automatically

**validation:**

* `python -m pytest tests/test_ai_strategy_review.py`

---

## Objective 010

**id:** 010  
**title:** Add AI-suggested improvements as proposals  
**status:** done  

**details:**
AI may propose improvements, but they must be:

* written as new `plan.md` objectives
* never auto-applied

**acceptance_criteria:**

* Suggestions appear as new `todo` objectives
* Each includes validation criteria
* All suggested objectives must include headless validation commands

**validation:**

* `python -m pytest tests/test_ai_proposals.py`

---

## Objective 011

**id:** 011  
**title:** Integrate risk_controls into IR simulator execution  
**status:** done  

**details:**
Connect the `RiskController` from `risk_controls.py` to `IRSimulator` so that:
- Trades are blocked when max drawdown is reached
- Position sizes are validated before execution
- All risk violations are logged with timestamps

**why it matters:**
Currently `risk_controls.py` exists but is not wired into the IR simulator. Without integration, strategies can ignore risk limits during simulation, producing unrealistic results.

**acceptance_criteria:**

* `IRSimulator` accepts an optional `RiskController` parameter
* When enabled, trades are rejected if they violate constraints
* Blocked trades appear in the simulation result with reason codes
* Existing tests continue to pass (backwards compatible)

**validation:**

* `python -m pytest tests/test_ir_simulator_risk_integration.py`

---

## Objective 012

**id:** 012  
**title:** Add multi-timeframe indicator support to IR  
**status:** done  

**details:**
Extend `strategy_ir.py` and `ir_simulator.py` to support indicators calculated on different timeframes than the primary data. For example:
- RSI on 1-hour bars while trading on 5-minute bars
- Daily SMA used as filter for hourly entries

**why it matters:**
Professional trading strategies often use higher timeframe indicators as filters. Without this, users are limited to single-timeframe strategies, reducing usefulness.

**acceptance_criteria:**

* `MarketComponent` can specify a `timeframe` parameter
* IR simulator resamples data to calculate higher-TF indicators
* At least one test demonstrates a 1h indicator on 15m data
* No changes to existing IR format break current tests

**validation:**

* `python -m pytest tests/test_multi_timeframe.py`

---

## Objective 013

**id:** 013  
**title:** Add strategy performance report generator  
**status:** done  

**details:**
Create a `PerformanceReporter` class that takes a `SimulationResult` and generates:
- Monthly/yearly return breakdown
- Win rate by day of week
- Average trade duration
- Best/worst trade details
- Exportable JSON and markdown formats

**why it matters:**
Users need actionable insights beyond raw metrics. A structured report enables pattern discovery and strategy refinement without manual analysis.

**acceptance_criteria:**

* `PerformanceReporter.generate(result)` returns a structured dict
* Report includes at least 5 distinct analysis sections
* Can export to both JSON and markdown
* Works with empty trade lists (edge case)

**validation:**

* `python -m pytest tests/test_performance_reporter.py`

---

## Objective 014

**id:** 014  
**title:** Add local database caching for market data  
**status:** done  

**details:**
Enhance `ir_simulator.py` and data fetching to:
- Check local SQLite database first before calling external APIs
- Cache fetched data for reuse
- Support configurable cache expiry

This leverages the existing `database/` infrastructure.

**why it matters:**
External API calls (Alpha Vantage, yfinance) are slow and rate-limited. Caching reduces backtest latency from seconds to milliseconds and enables offline development.

**acceptance_criteria:**

* Backtest uses cached data if available and fresh
* Cache hit produces identical results to fresh fetch
* Cache can be invalidated per symbol or globally
* Works with both daily and hourly data

**validation:**

* `python -m pytest tests/test_data_caching.py`

---

## Objective 015

**id:** 015  
**title:** Add walkforward validation to backtester  
**status:** todo  

**details:**
Implement walkforward analysis in the backtesting framework:
- Split data into in-sample and out-of-sample windows
- Optimize on in-sample, validate on out-of-sample
- Roll forward and repeat
- Aggregate results to detect overfitting

**why it matters:**
Standard backtests are prone to overfitting. Walkforward validation is an industry-standard method to assess strategy robustness and is essential for production trading.

**acceptance_criteria:**

* `WalkforwardValidator` class with configurable window sizes
* Returns aggregated OOS metrics across all windows
* Detects strategies that degrade out-of-sample
* Produces a degradation score (IS vs OOS performance ratio)

**validation:**

* `python -m pytest tests/test_walkforward.py`

---

## Objective 016

**id:** 016  
**title:** Add Monte Carlo simulation for strategy robustness  
**status:** todo  

**details:**
Implement Monte Carlo analysis that:
- Randomly reshuffles trade order to test sequence dependency
- Runs 1000+ simulated equity curves
- Calculates confidence intervals for drawdown and return
- Identifies fragile strategies

**why it matters:**
A strategy that looks profitable may rely on lucky trade sequencing. Monte Carlo reveals the probability distribution of outcomes, essential for realistic risk assessment.

**acceptance_criteria:**

* `MonteCarloSimulator` class with configurable iteration count
* Returns 5th/50th/95th percentile metrics
* Produces a distribution of max drawdowns
* Works with any `SimulationResult`

**validation:**

* `python -m pytest tests/test_monte_carlo.py`

---

## Objective 017

**id:** 017  
**title:** Add strategy cloning and versioning  
**status:** todo  

**details:**
Enable users to:
- Clone an existing strategy IR to a new version
- Track version history with timestamps
- Compare two strategy versions side by side
- Rollback to previous versions

**why it matters:**
Strategy development is iterative. Without versioning, users lose previous working versions and cannot track what changes improved or degraded performance.

**acceptance_criteria:**

* `StrategyVersionManager` class for CRUD operations
* Versions stored with hash-based deduplication
* Diff function shows changes between versions
* At least 3 versions can be maintained per strategy

**validation:**

* `python -m pytest tests/test_strategy_versioning.py`

---

## Objective 018

**id:** 018  
**title:** Add position management rules to IR  
**status:** todo  

**details:**
Extend the IR to support:
- Pyramiding (adding to winning positions)
- Partial exits (scale out)
- Break-even stop moves
- Time-based exits (e.g., close after N bars)

**why it matters:**
Real trading strategies often include dynamic position management. Without these primitives, the IR cannot express professional-grade strategies.

**acceptance_criteria:**

* New `PositionManagement` dataclass in strategy_ir.py
* IR simulator respects pyramid limits
* Partial exits reduce position size correctly
* Time-based exit closes after specified bars

**validation:**

* `python -m pytest tests/test_position_management.py`

---

## Objective 019

**id:** 019  
**title:** Add trade journaling and tagging  
**status:** todo  

**details:**
Allow trades to be tagged with metadata:
- Entry reason (which rule triggered)
- Market regime at entry (trending/ranging)
- Custom user tags
- Exportable trade journal

**why it matters:**
Understanding why trades happened enables pattern discovery. Tagged journals help identify which setups work best and in what conditions.

**acceptance_criteria:**

* `Trade` dataclass extended with `tags: Dict[str, str]`
* Rules can attach metadata to trades they generate
* Journal export includes all tags
* Filter trades by tag in reports

**validation:**

* `python -m pytest tests/test_trade_journaling.py`

---

## Objective 020

**id:** 020  
**title:** Add strategy export to multiple formats  
**status:** todo  

**details:**
Export IR strategies to:
- Python (for backtesting.py)
- JSON (for storage/transfer)
- Markdown (for documentation)
- Pine Script (for TradingView, best-effort)

**why it matters:**
Portability is a core principle. Users should be able to take their strategies to other platforms without lock-in.

**acceptance_criteria:**

* `StrategyExporter` class with format plugins
* Python export produces executable backtesting.py code
* JSON export is round-trip compatible with IR
* Markdown includes human-readable strategy description

**validation:**

* `python -m pytest tests/test_strategy_export.py`

---

## Improve Loop Rules (Hard Constraints)

* Never modify the Vision section
* Never mark an objective `done` without passing validation
* All validation must be headless (no GUI/windows). CI/server-safe only.
* Never invent validations
* Never delete tests to pass validation
* Commit only after successful validation
* One objective per commit
