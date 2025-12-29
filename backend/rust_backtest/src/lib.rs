//! Rust Backtesting Engine with PyO3 bindings
//! 
//! High-performance backtesting engine for trading strategies.
//! Provides 10-100x speedup over Python implementations.

use pyo3::prelude::*;

mod types;
mod indicators;
mod metrics;
mod backtest;

pub use types::{Bar, Trade, Metrics, BacktestResult};
pub use backtest::Backtester;

/// A Python module implemented in Rust for high-performance backtesting.
#[pymodule]
fn rust_backtest(m: &Bound<'_, PyModule>) -> PyResult<()> {
    // Register types
    m.add_class::<types::Bar>()?;
    m.add_class::<types::Trade>()?;
    m.add_class::<types::Metrics>()?;
    m.add_class::<types::BacktestResult>()?;
    
    // Register backtester
    backtest::register_backtester(m)?;
    
    // Register indicators
    indicators::register_indicators(m)?;
    
    // Add version info
    m.add("__version__", "0.1.0")?;
    m.add("__doc__", "Rust-powered backtesting engine with PyO3 bindings")?;
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_sma() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let result = indicators::sma(data, 3);
        assert_eq!(result.len(), 5);
    }
    
    #[test]
    fn test_bar_creation() {
        let bar = Bar::new(1234567890, 100.0, 105.0, 95.0, 102.0, 1000.0);
        assert_eq!(bar.timestamp, 1234567890);
        assert_eq!(bar.close, 102.0);
    }
}
