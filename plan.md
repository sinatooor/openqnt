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
**status:** doing  

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
**status:** todo  

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
**status:** todo  

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
**status:** todo  

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
**status:** todo

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
**status:** todo  

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
**status:** todo

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
**status:** todo  

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

## Improve Loop Rules (Hard Constraints)

* Never modify the Vision section
* Never mark an objective `done` without passing validation
* All validation must be headless (no GUI/windows). CI/server-safe only.
* Never invent validations
* Never delete tests to pass validation
* Commit only after successful validation
* One objective per commit
