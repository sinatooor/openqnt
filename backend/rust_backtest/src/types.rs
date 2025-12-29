use pyo3::prelude::*;

/// OHLCV bar data
#[pyclass]
#[derive(Clone, Debug)]
pub struct Bar {
    #[pyo3(get)]
    pub timestamp: i64,
    #[pyo3(get)]
    pub open: f64,
    #[pyo3(get)]
    pub high: f64,
    #[pyo3(get)]
    pub low: f64,
    #[pyo3(get)]
    pub close: f64,
    #[pyo3(get)]
    pub volume: f64,
}

#[pymethods]
impl Bar {
    #[new]
    pub fn new(timestamp: i64, open: f64, high: f64, low: f64, close: f64, volume: f64) -> Self {
        Bar { timestamp, open, high, low, close, volume }
    }
}

/// Trade record
#[pyclass]
#[derive(Clone, Debug)]
pub struct Trade {
    #[pyo3(get)]
    pub entry_time: i64,
    #[pyo3(get)]
    pub exit_time: i64,
    #[pyo3(get)]
    pub entry_price: f64,
    #[pyo3(get)]
    pub exit_price: f64,
    #[pyo3(get)]
    pub size: f64,
    #[pyo3(get)]
    pub pnl: f64,
    #[pyo3(get)]
    pub return_pct: f64,
    #[pyo3(get)]
    pub trade_type: String,  // "long" or "short"
}

#[pymethods]
impl Trade {
    #[new]
    pub fn new(
        entry_time: i64,
        exit_time: i64,
        entry_price: f64,
        exit_price: f64,
        size: f64,
        pnl: f64,
        return_pct: f64,
        trade_type: String,
    ) -> Self {
        Trade {
            entry_time,
            exit_time,
            entry_price,
            exit_price,
            size,
            pnl,
            return_pct,
            trade_type,
        }
    }
    
    fn __repr__(&self) -> String {
        format!(
            "Trade(entry={}, exit={}, pnl={:.2}, type={})",
            self.entry_time, self.exit_time, self.pnl, self.trade_type
        )
    }
}

/// Performance metrics
#[pyclass]
#[derive(Clone, Debug)]
pub struct Metrics {
    #[pyo3(get)]
    pub total_return: f64,
    #[pyo3(get)]
    pub cagr: f64,
    #[pyo3(get)]
    pub net_profit: f64,
    #[pyo3(get)]
    pub profit_factor: f64,
    #[pyo3(get)]
    pub expectancy: f64,
    #[pyo3(get)]
    pub payoff_ratio: f64,
    #[pyo3(get)]
    pub max_drawdown: f64,
    #[pyo3(get)]
    pub max_drawdown_duration: i64,
    #[pyo3(get)]
    pub calmar_ratio: f64,
    #[pyo3(get)]
    pub sharpe_ratio: f64,
    #[pyo3(get)]
    pub sortino_ratio: f64,
    #[pyo3(get)]
    pub var_95: f64,
    #[pyo3(get)]
    pub cvar_95: f64,
    #[pyo3(get)]
    pub sqn: f64,
    #[pyo3(get)]
    pub kelly_criterion: f64,
    #[pyo3(get)]
    pub win_rate: f64,
    #[pyo3(get)]
    pub loss_rate: f64,
    #[pyo3(get)]
    pub total_trades: u32,
    #[pyo3(get)]
    pub avg_holding_time: f64,  // in seconds
    #[pyo3(get)]
    pub return_volatility: f64,
    #[pyo3(get)]
    pub skewness: f64,
    #[pyo3(get)]
    pub kurtosis: f64,
    #[pyo3(get)]
    pub equity_final: f64,
    #[pyo3(get)]
    pub equity_peak: f64,
}

impl Default for Metrics {
    fn default() -> Self {
        Metrics {
            total_return: 0.0,
            cagr: 0.0,
            net_profit: 0.0,
            profit_factor: 0.0,
            expectancy: 0.0,
            payoff_ratio: 0.0,
            max_drawdown: 0.0,
            max_drawdown_duration: 0,
            calmar_ratio: 0.0,
            sharpe_ratio: 0.0,
            sortino_ratio: 0.0,
            var_95: 0.0,
            cvar_95: 0.0,
            sqn: 0.0,
            kelly_criterion: 0.0,
            win_rate: 0.0,
            loss_rate: 100.0,
            total_trades: 0,
            avg_holding_time: 0.0,
            return_volatility: 0.0,
            skewness: 0.0,
            kurtosis: 0.0,
            equity_final: 0.0,
            equity_peak: 0.0,
        }
    }
}

#[pymethods]
impl Metrics {
    fn __repr__(&self) -> String {
        format!(
            "Metrics(return={:.2}%, sharpe={:.2}, max_dd={:.2}%, trades={})",
            self.total_return, self.sharpe_ratio, self.max_drawdown, self.total_trades
        )
    }
    
    /// Convert metrics to a Python dict for JSON serialization
    pub fn to_dict(&self, py: Python) -> PyResult<PyObject> {
        let dict = pyo3::types::PyDict::new(py);
        dict.set_item("total_return", self.total_return)?;
        dict.set_item("cagr", self.cagr)?;
        dict.set_item("net_profit", self.net_profit)?;
        dict.set_item("profit_factor", self.profit_factor)?;
        dict.set_item("expectancy", self.expectancy)?;
        dict.set_item("payoff_ratio", self.payoff_ratio)?;
        dict.set_item("max_drawdown", self.max_drawdown)?;
        dict.set_item("max_drawdown_duration", self.max_drawdown_duration)?;
        dict.set_item("calmar_ratio", self.calmar_ratio)?;
        dict.set_item("sharpe_ratio", self.sharpe_ratio)?;
        dict.set_item("sortino_ratio", self.sortino_ratio)?;
        dict.set_item("var_95", self.var_95)?;
        dict.set_item("cvar_95", self.cvar_95)?;
        dict.set_item("sqn", self.sqn)?;
        dict.set_item("kelly_criterion", self.kelly_criterion)?;
        dict.set_item("win_rate", self.win_rate)?;
        dict.set_item("loss_rate", self.loss_rate)?;
        dict.set_item("total_trades", self.total_trades)?;
        dict.set_item("avg_holding_time", self.avg_holding_time)?;
        dict.set_item("return_volatility", self.return_volatility)?;
        dict.set_item("skewness", self.skewness)?;
        dict.set_item("kurtosis", self.kurtosis)?;
        dict.set_item("equity_final", self.equity_final)?;
        dict.set_item("equity_peak", self.equity_peak)?;
        Ok(dict.into())
    }
}

/// Backtest results containing trades, equity curve, and metrics
#[pyclass]
#[derive(Clone)]
pub struct BacktestResult {
    #[pyo3(get)]
    pub success: bool,
    #[pyo3(get)]
    pub trades: Vec<Trade>,
    #[pyo3(get)]
    pub equity_curve: Vec<(i64, f64)>,  // (timestamp, equity)
    #[pyo3(get)]
    pub metrics: Metrics,
    #[pyo3(get)]
    pub error: Option<String>,
}

#[pymethods]
impl BacktestResult {
    fn __repr__(&self) -> String {
        format!(
            "BacktestResult(success={}, trades={}, final_equity={:.2})",
            self.success, self.trades.len(), self.metrics.equity_final
        )
    }
}

/// Position state during backtest
#[derive(Clone, Debug)]
pub struct Position {
    pub is_open: bool,
    pub entry_price: f64,
    pub entry_time: i64,
    pub size: f64,
    pub is_long: bool,
}

impl Position {
    pub fn new() -> Self {
        Position {
            is_open: false,
            entry_price: 0.0,
            entry_time: 0,
            size: 0.0,
            is_long: true,
        }
    }
    
    pub fn open_long(&mut self, price: f64, time: i64, size: f64) {
        self.is_open = true;
        self.entry_price = price;
        self.entry_time = time;
        self.size = size;
        self.is_long = true;
    }
    
    pub fn open_short(&mut self, price: f64, time: i64, size: f64) {
        self.is_open = true;
        self.entry_price = price;
        self.entry_time = time;
        self.size = size;
        self.is_long = false;
    }
    
    pub fn close(&mut self, exit_price: f64, exit_time: i64) -> Trade {
        let pnl = if self.is_long {
            (exit_price - self.entry_price) * self.size
        } else {
            (self.entry_price - exit_price) * self.size
        };
        
        let return_pct = if self.entry_price > 0.0 {
            if self.is_long {
                (exit_price / self.entry_price - 1.0) * 100.0
            } else {
                (1.0 - exit_price / self.entry_price) * 100.0
            }
        } else {
            0.0
        };
        
        let trade = Trade {
            entry_time: self.entry_time,
            exit_time,
            entry_price: self.entry_price,
            exit_price,
            size: self.size,
            pnl,
            return_pct,
            trade_type: if self.is_long { "long".to_string() } else { "short".to_string() },
        };
        
        self.is_open = false;
        self.size = 0.0;
        
        trade
    }
}
