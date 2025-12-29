//! Core backtesting engine

use pyo3::prelude::*;
use crate::types::{Bar, Trade, Position, BacktestResult};
use crate::metrics::calculate_metrics;

/// Main backtester class exposed to Python
#[pyclass]
pub struct Backtester {
    bars: Vec<Bar>,
    cash: f64,
    initial_cash: f64,
    margin: f64,
    commission: f64,
    position: Position,
    trades: Vec<Trade>,
    equity_curve: Vec<f64>,
    timestamps: Vec<i64>,
}

#[pymethods]
impl Backtester {
    /// Create a new backtester instance
    #[new]
    #[pyo3(signature = (cash=10000.0, margin=1.0, commission=0.002))]
    pub fn new(cash: f64, margin: f64, commission: f64) -> Self {
        Backtester {
            bars: Vec::new(),
            cash,
            initial_cash: cash,
            margin,
            commission,
            position: Position::new(),
            trades: Vec::new(),
            equity_curve: Vec::new(),
            timestamps: Vec::new(),
        }
    }
    
    /// Load OHLCV data from Python lists
    pub fn load_data(
        &mut self,
        timestamps: Vec<i64>,
        opens: Vec<f64>,
        highs: Vec<f64>,
        lows: Vec<f64>,
        closes: Vec<f64>,
        volumes: Vec<f64>,
    ) -> PyResult<()> {
        if timestamps.len() != opens.len() 
            || opens.len() != highs.len() 
            || highs.len() != lows.len() 
            || lows.len() != closes.len() 
            || closes.len() != volumes.len() 
        {
            return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
                "All data arrays must have the same length"
            ));
        }
        
        self.bars = timestamps.iter()
            .zip(opens.iter())
            .zip(highs.iter())
            .zip(lows.iter())
            .zip(closes.iter())
            .zip(volumes.iter())
            .map(|(((((t, o), h), l), c), v)| Bar {
                timestamp: *t,
                open: *o,
                high: *h,
                low: *l,
                close: *c,
                volume: *v,
            })
            .collect();
        
        self.timestamps = timestamps;
        
        Ok(())
    }
    
    /// Run backtest with pre-computed strategy signals
    /// signals: 1 = buy/long, -1 = sell/close, 0 = hold
    pub fn run(&mut self, signals: Vec<i8>) -> PyResult<BacktestResult> {
        if signals.len() != self.bars.len() {
            return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
                format!("Signals length ({}) must match data length ({})", signals.len(), self.bars.len())
            ));
        }
        
        // Reset state
        self.cash = self.initial_cash;
        self.position = Position::new();
        self.trades.clear();
        self.equity_curve.clear();
        
        // Clone bars to avoid borrow issues
        let bars_clone: Vec<Bar> = self.bars.clone();
        
        for (i, bar) in bars_clone.iter().enumerate() {
            let signal = signals[i];
            
            match signal {
                1 => {
                    // Open long position if not already in position
                    if !self.position.is_open {
                        self.open_long(bar.close, bar.timestamp);
                    }
                }
                -1 => {
                    // Close position if open
                    if self.position.is_open {
                        self.close_position(bar.close, bar.timestamp);
                    }
                }
                2 => {
                    // Open short position (if supported)
                    if !self.position.is_open {
                        self.open_short(bar.close, bar.timestamp);
                    }
                }
                _ => {
                    // Hold - do nothing
                }
            }
            
            // Update equity
            self.update_equity(bar.close);
        }
        
        // Close any remaining position at the end
        if self.position.is_open && !bars_clone.is_empty() {
            let last_bar = bars_clone.last().unwrap();
            self.close_position(last_bar.close, last_bar.timestamp);
        }
        
        // Calculate metrics
        let metrics = calculate_metrics(
            &self.trades, 
            &self.equity_curve, 
            self.initial_cash,
            &self.timestamps,
        );
        
        // Create equity curve with timestamps
        let equity_with_time: Vec<(i64, f64)> = self.timestamps.iter()
            .zip(self.equity_curve.iter())
            .map(|(&t, &e)| (t, e))
            .collect();
        
        Ok(BacktestResult {
            success: true,
            trades: self.trades.clone(),
            equity_curve: equity_with_time,
            metrics,
            error: None,
        })
    }
    
    /// Run backtest with indicator-based strategy
    /// Uses crossover signals from two indicator arrays
    pub fn run_crossover_strategy(
        &mut self,
        fast_indicator: Vec<f64>,
        slow_indicator: Vec<f64>,
    ) -> PyResult<BacktestResult> {
        if fast_indicator.len() != self.bars.len() || slow_indicator.len() != self.bars.len() {
            return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
                "Indicator arrays must match data length"
            ));
        }
        
        // Generate signals from crossover
        let mut signals = vec![0i8; self.bars.len()];
        
        for i in 1..self.bars.len() {
            let prev_fast = fast_indicator[i - 1];
            let prev_slow = slow_indicator[i - 1];
            let curr_fast = fast_indicator[i];
            let curr_slow = slow_indicator[i];
            
            if prev_fast.is_nan() || prev_slow.is_nan() || curr_fast.is_nan() || curr_slow.is_nan() {
                continue;
            }
            
            // Bullish crossover
            if prev_fast <= prev_slow && curr_fast > curr_slow {
                signals[i] = 1;
            }
            // Bearish crossover
            else if prev_fast >= prev_slow && curr_fast < curr_slow {
                signals[i] = -1;
            }
        }
        
        self.run(signals)
    }
    
    /// Get current equity
    pub fn get_equity(&self) -> f64 {
        if let Some(&last) = self.equity_curve.last() {
            last
        } else {
            self.initial_cash
        }
    }
    
    /// Get number of bars loaded
    pub fn get_bar_count(&self) -> usize {
        self.bars.len()
    }
}

impl Backtester {
    fn open_long(&mut self, price: f64, timestamp: i64) {
        // Calculate position size based on available capital and margin
        let available_capital = self.cash / self.margin;
        let size = available_capital * 0.95;  // Use 95% of available capital
        
        // Deduct commission
        let commission_cost = size * self.commission;
        self.cash -= commission_cost;
        
        self.position.open_long(price, timestamp, size);
    }
    
    fn open_short(&mut self, price: f64, timestamp: i64) {
        let available_capital = self.cash / self.margin;
        let size = available_capital * 0.95;
        
        let commission_cost = size * self.commission;
        self.cash -= commission_cost;
        
        self.position.open_short(price, timestamp, size);
    }
    
    fn close_position(&mut self, exit_price: f64, exit_time: i64) {
        let trade = self.position.close(exit_price, exit_time);
        
        // Add PnL to cash
        self.cash += trade.pnl;
        
        // Deduct exit commission
        let commission_cost = trade.size.abs() * self.commission;
        self.cash -= commission_cost;
        
        self.trades.push(trade);
    }
    
    fn update_equity(&mut self, current_price: f64) {
        let equity = if self.position.is_open {
            // Mark to market
            let unrealized_pnl = if self.position.is_long {
                (current_price - self.position.entry_price) * self.position.size
            } else {
                (self.position.entry_price - current_price) * self.position.size
            };
            self.cash + unrealized_pnl
        } else {
            self.cash
        };
        
        self.equity_curve.push(equity);
    }
}

/// Convenience function for quick backtesting
#[pyfunction]
#[pyo3(signature = (timestamps, opens, highs, lows, closes, volumes, signals, cash=10000.0, margin=1.0, commission=0.002))]
pub fn quick_backtest(
    timestamps: Vec<i64>,
    opens: Vec<f64>,
    highs: Vec<f64>,
    lows: Vec<f64>,
    closes: Vec<f64>,
    volumes: Vec<f64>,
    signals: Vec<i8>,
    cash: f64,
    margin: f64,
    commission: f64,
) -> PyResult<BacktestResult> {
    let mut bt = Backtester::new(cash, margin, commission);
    bt.load_data(timestamps, opens, highs, lows, closes, volumes)?;
    bt.run(signals)
}

/// Register backtester to Python module
pub fn register_backtester(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_class::<Backtester>()?;
    m.add_function(wrap_pyfunction!(quick_backtest, m)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    fn create_test_data() -> (Vec<i64>, Vec<f64>, Vec<f64>, Vec<f64>, Vec<f64>, Vec<f64>) {
        let timestamps: Vec<i64> = (0..10).map(|i| i * 86400).collect();
        let prices = vec![100.0, 102.0, 104.0, 103.0, 105.0, 107.0, 106.0, 108.0, 110.0, 109.0];
        let opens = prices.clone();
        let highs: Vec<f64> = prices.iter().map(|p| p + 1.0).collect();
        let lows: Vec<f64> = prices.iter().map(|p| p - 1.0).collect();
        let closes = prices;
        let volumes = vec![1000.0; 10];
        
        (timestamps, opens, highs, lows, closes, volumes)
    }
    
    #[test]
    fn test_backtester_creation() {
        let bt = Backtester::new(10000.0, 1.0, 0.002);
        assert_eq!(bt.cash, 10000.0);
        assert_eq!(bt.margin, 1.0);
    }
    
    #[test]
    fn test_backtester_load_data() {
        let mut bt = Backtester::new(10000.0, 1.0, 0.002);
        let (timestamps, opens, highs, lows, closes, volumes) = create_test_data();
        
        bt.load_data(timestamps, opens, highs, lows, closes, volumes).unwrap();
        assert_eq!(bt.bars.len(), 10);
    }
    
    #[test]
    fn test_backtester_run() {
        let mut bt = Backtester::new(10000.0, 1.0, 0.002);
        let (timestamps, opens, highs, lows, closes, volumes) = create_test_data();
        
        bt.load_data(timestamps, opens, highs, lows, closes, volumes).unwrap();
        
        // Buy at bar 2, sell at bar 5
        let signals = vec![0, 0, 1, 0, 0, -1, 0, 0, 0, 0];
        let result = bt.run(signals).unwrap();
        
        assert!(result.success);
        assert_eq!(result.trades.len(), 1);
        assert!(result.trades[0].pnl > 0.0);  // Price went up
    }
}
