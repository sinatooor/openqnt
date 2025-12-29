# Plan 2 - Additional Objectives

Generated: 2025-12-29

This file contains additional high-impact improvement objectives for the PPM trading platform.

---

## Objective P2-001

**id:** P2-001  
**title:** Add correlation analysis between strategies  
**status:** todo  

**details:**
Implement correlation analysis to:
- Calculate return correlation between multiple strategies
- Identify diversification opportunities
- Warn when strategies are too correlated
- Suggest portfolio weights for uncorrelated combination

**why it matters:**
Running correlated strategies multiplies risk without proportional return. Correlation analysis enables intelligent portfolio construction and risk budgeting.

**acceptance_criteria:**

* `CorrelationAnalyzer` class takes multiple `SimulationResult` objects
* Returns correlation matrix as pandas DataFrame
* Flags pairs with correlation > 0.7
* Suggests optimal weights using simple mean-variance

**validation:**

* `python -m pytest tests/test_correlation_analysis.py`

---

## Objective P2-002

**id:** P2-002  
**title:** Add market regime detection  
**status:** todo  

**details:**
Implement regime detection that classifies market conditions:
- Trending up / Trending down / Ranging
- High volatility / Low volatility
- Use rolling statistics (ATR, ADX, etc.)
- Tag each bar with regime for filtering

**why it matters:**
Many strategies only work in specific market conditions. Regime detection enables conditional trading and explains why strategies fail in certain periods.

**acceptance_criteria:**

* `RegimeDetector` class with configurable lookback
* Returns regime classification per bar
* At least 3 distinct regimes identified
* Can be used as IR condition filter

**validation:**

* `python -m pytest tests/test_regime_detection.py`

---

## Objective P2-003

**id:** P2-003  
**title:** Add slippage and commission modeling  
**status:** todo  

**details:**
Enhance IR simulator with realistic cost modeling:
- Configurable spread/slippage per instrument
- Fixed and percentage-based commissions
- Market impact for large orders
- Cost breakdown in simulation results

**why it matters:**
Backtests without costs are unrealistic. Many profitable-looking strategies become losers when realistic costs are applied. Essential for production viability assessment.

**acceptance_criteria:**

* `CostModel` class with slippage, commission, impact
* Simulator applies costs to each trade
* Results include total cost breakdown
* Can simulate different broker fee structures

**validation:**

* `python -m pytest tests/test_cost_modeling.py`

---

## Objective P2-004

**id:** P2-004  
**title:** Add strategy heatmap visualization data  
**status:** todo  

**details:**
Generate data for parameter sensitivity heatmaps:
- Sweep 2 parameters and record performance
- Output as 2D matrix suitable for plotting
- Identify stable parameter regions
- Warn about cliff edges (sensitive parameters)

**why it matters:**
Parameters that produce good results in a narrow range indicate overfitting. Heatmaps reveal robustness and guide parameter selection.

**acceptance_criteria:**

* `ParameterSweeper` class with configurable ranges
* Returns 2D numpy array of metrics
* Calculates stability score (avg/std of neighbors)
* Works with any 2 numeric IR parameters

**validation:**

* `python -m pytest tests/test_parameter_sweep.py`

---

## Objective P2-005

**id:** P2-005  
**title:** Add drawdown recovery analysis  
**status:** todo  

**details:**
Analyze drawdown patterns:
- Time to recover from each drawdown
- Longest drawdown duration
- Drawdown frequency distribution
- Probability of recovering within N days

**why it matters:**
Drawdown depth alone doesn't capture pain. A 10% drawdown lasting 2 years is worse than 15% lasting 2 weeks. Recovery analysis informs realistic expectations.

**acceptance_criteria:**

* `DrawdownAnalyzer` class accepts equity curve
* Returns recovery times for each drawdown
* Calculates underwater curve
* Statistics include mean/max recovery time

**validation:**

* `python -m pytest tests/test_drawdown_analysis.py`

---
