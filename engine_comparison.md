# Backtest Engine Comparison

This document compares **all 6 backtest engines** available in your PPM trading application and provides recommendations for when to use each.

---

## 📊 Engine Overview

![Backtest Engine Options](/Users/sina/.gemini/antigravity/brain/63b362f2-e912-449b-b10d-d2b5905b1914/uploaded_image_1765658218676.png)

| # | Engine Name | Value in Code | Description |
|---|-------------|--------------|-------------|
| 1 | Simple (Fast) | `frontend` | Backend: Regex-based XML parser → Simple loop simulator |
| 2 | TechnicalIndicators (Browser)| `frontend-ts` | Browser-only: TypeScript engine with technicalindicators library |
| 3 | **PyGenerator (Recommended)** | `pygenerator` | **NEW** Frontend generates Python → Backend executes with backtesting.py |
| 4 | Python (AI-Generated) | `backtesting.py` | Backend: LLM generates Python from XML → backtesting.py |
| 5 | NautilusTrader (Institutional) | `nautilus` | Backend: Professional event-driven engine (experimental) |
| 6 | AI Simulation (LLM) | `ai_simulation` | Backend: LLM interprets strategy and simulates outcomes |

---

## 🔬 Detailed Comparison

### 1. Simple (Fast) — `frontend`

| Aspect | Details |
|--------|---------|
| **How it works** | Sends XML to `/backtest` endpoint → `xml_evaluator.py` parses using regex → `backtest_runner.py` loops through bars |
| **Speed** | ⭐⭐⭐⭐ Fast (simple loop, no external deps) |
| **Reliability** | ⭐⭐ Medium (regex can miss complex nested blocks) |
| **Indicator Support** | Limited (custom SMA, EMA, RSI implementations) |
| **Best for** | Quick sanity checks, simple strategies |

---

### 2. TechnicalIndicators (Browser) — `frontend-ts`

| Aspect | Details |
|--------|---------|
| **How it works** | Runs entirely in browser using `technicalindicators` npm package → No backend call for execution |
| **Speed** | ⭐⭐⭐⭐⭐ Instant (no network latency) |
| **Reliability** | ⭐⭐⭐ Medium (JavaScript precision, limited to what's parsed client-side) |
| **Indicator Support** | Uses `technicalindicators` library (SMA, EMA, RSI, MACD, etc.) |
| **Best for** | Offline testing, rapid iteration |

---

### 3. 🌟 PyGenerator (Recommended) — `pygenerator`

| Aspect | Details |
|--------|---------|
| **How it works** | Frontend: `pyGenerator.ts` translates Blockly → Python source code → Sent to `/backtest-py-code` → `backtesting.py` executes |
| **Speed** | ⭐⭐⭐⭐⭐ Very Fast (vectorized numpy/TA-Lib calculations) |
| **Reliability** | ⭐⭐⭐⭐⭐ Highest (deterministic code generation, no LLM hallucination) |
| **Indicator Support** | Full TA-Lib library (60+ indicators with hybrid fallback) |
| **Best for** | **Production use**, accurate backtesting, complex strategies |

> **Why Recommended**: PyGenerator produces identical code every time. You can inspect it in the Code panel before running. It leverages professional-grade `backtesting.py` with TA-Lib optimization.

---

### 4. Python (AI-Generated) — `backtesting.py`

| Aspect | Details |
|--------|---------|
| **How it works** | Sends XML to `/backtest` → LLM (DeepSeek) writes Python code → `exec()` → `backtesting.py` |
| **Speed** | ⭐⭐ Slow (LLM API call latency: 5-30 seconds) |
| **Reliability** | ⭐⭐ Medium (LLM can hallucinate or produce syntax errors) |
| **Indicator Support** | High (LLM can implement almost anything) |
| **Best for** | Complex custom logic that PyGenerator can't handle |

---

### 5. NautilusTrader (Institutional) — `nautilus`

| Aspect | Details |
|--------|---------|
| **How it works** | Converts to NautilusTrader config → Event-driven C++/Python engine |
| **Speed** | ⭐⭐⭐⭐ Fast (C++ core) |
| **Reliability** | ⭐⭐ Experimental (complex setup, may not be fully configured) |
| **Indicator Support** | Professional-grade (Nautilus built-in indicators) |
| **Best for** | HFT simulation, institutional-grade accuracy (when fully set up) |

> **Note**: NautilusTrader requires significant configuration. Check if `NAUTILUS_AVAILABLE=True` in backend logs.

---

### 6. AI Simulation (LLM) — `ai_simulation`

| Aspect | Details |
|--------|---------|
| **How it works** | Sends strategy description to LLM → LLM *simulates* what trades would happen |
| **Speed** | ⭐ Slowest (full LLM reasoning chain) |
| **Reliability** | ⭐ Low (pure LLM interpretation, not actual market data simulation) |
| **Indicator Support** | Conceptual (LLM understands intent, not exact math) |
| **Best for** | Exploratory "what if" analysis, non-critical testing |

---

## 📈 Summary Matrix

| Engine | Speed | Reliability | LLM Dependent | Indicator Accuracy |
|--------|-------|-------------|---------------|-------------------|
| Simple (Fast) | ⭐⭐⭐⭐ | ⭐⭐ | No | ⭐⭐ |
| TechnicalIndicators | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | No | ⭐⭐⭐ |
| **PyGenerator** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **No** | ⭐⭐⭐⭐⭐ |
| Python (AI-Generated) | ⭐⭐ | ⭐⭐ | Yes | ⭐⭐⭐⭐ |
| NautilusTrader | ⭐⭐⭐⭐ | ⭐⭐ | Yes (conversion) | ⭐⭐⭐⭐⭐ |
| AI Simulation | ⭐ | ⭐ | Yes | ⭐ |

---

## ✅ Recommendation

**Use PyGenerator (Recommended)** for:
- All standard backtesting needs
- Production-quality results
- Strategies using common indicators (SMA, EMA, RSI, MACD, Bollinger Bands, etc.)
- When you need reproducible, inspectable code

**Use AI-Generated Python** when:
- PyGenerator doesn't cover an obscure indicator
- You need the LLM to "figure out" complex logic

**Use TechnicalIndicators (Browser)** when:
- Testing offline without backend
- Want instant feedback during strategy design
