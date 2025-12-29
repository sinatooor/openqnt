//! Technical indicators implemented in Rust for high performance

use pyo3::prelude::*;

/// Simple Moving Average
#[pyfunction]
pub fn sma(data: Vec<f64>, period: usize) -> Vec<f64> {
    if data.len() < period || period == 0 {
        return vec![f64::NAN; data.len()];
    }
    
    let mut result = vec![f64::NAN; period - 1];
    let mut sum: f64 = data[..period].iter().sum();
    result.push(sum / period as f64);
    
    for i in period..data.len() {
        sum = sum - data[i - period] + data[i];
        result.push(sum / period as f64);
    }
    result
}

/// Exponential Moving Average
#[pyfunction]
pub fn ema(data: Vec<f64>, period: usize) -> Vec<f64> {
    if data.is_empty() || period == 0 {
        return vec![];
    }
    
    let alpha = 2.0 / (period as f64 + 1.0);
    let mut result = Vec::with_capacity(data.len());
    
    // First value is the first data point
    result.push(data[0]);
    
    for i in 1..data.len() {
        let prev = result[i - 1];
        if prev.is_nan() {
            result.push(data[i]);
        } else {
            result.push(alpha * data[i] + (1.0 - alpha) * prev);
        }
    }
    result
}

/// Relative Strength Index
#[pyfunction]
pub fn rsi(data: Vec<f64>, period: usize) -> Vec<f64> {
    if data.len() < period + 1 || period == 0 {
        return vec![f64::NAN; data.len()];
    }
    
    let mut result = vec![f64::NAN; period];
    
    // Calculate price changes
    let mut gains = Vec::with_capacity(data.len() - 1);
    let mut losses = Vec::with_capacity(data.len() - 1);
    
    for i in 1..data.len() {
        let change = data[i] - data[i - 1];
        if change > 0.0 {
            gains.push(change);
            losses.push(0.0);
        } else {
            gains.push(0.0);
            losses.push(-change);
        }
    }
    
    // First RSI using SMA
    let mut avg_gain: f64 = gains[..period].iter().sum::<f64>() / period as f64;
    let mut avg_loss: f64 = losses[..period].iter().sum::<f64>() / period as f64;
    
    if avg_loss == 0.0 {
        result.push(100.0);
    } else {
        let rs = avg_gain / avg_loss;
        result.push(100.0 - (100.0 / (1.0 + rs)));
    }
    
    // Subsequent RSI using Wilder's smoothing
    for i in period..gains.len() {
        avg_gain = (avg_gain * (period - 1) as f64 + gains[i]) / period as f64;
        avg_loss = (avg_loss * (period - 1) as f64 + losses[i]) / period as f64;
        
        if avg_loss == 0.0 {
            result.push(100.0);
        } else {
            let rs = avg_gain / avg_loss;
            result.push(100.0 - (100.0 / (1.0 + rs)));
        }
    }
    
    result
}

/// MACD - Moving Average Convergence Divergence
/// Returns (macd_line, signal_line, histogram)
#[pyfunction]
pub fn macd(data: Vec<f64>, fast_period: usize, slow_period: usize, signal_period: usize) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    let fast_ema = ema(data.clone(), fast_period);
    let slow_ema = ema(data, slow_period);
    
    // MACD line = fast EMA - slow EMA
    let macd_line: Vec<f64> = fast_ema.iter()
        .zip(slow_ema.iter())
        .map(|(f, s)| f - s)
        .collect();
    
    // Signal line = EMA of MACD line
    let signal_line = ema(macd_line.clone(), signal_period);
    
    // Histogram = MACD line - signal line
    let histogram: Vec<f64> = macd_line.iter()
        .zip(signal_line.iter())
        .map(|(m, s)| m - s)
        .collect();
    
    (macd_line, signal_line, histogram)
}

/// Bollinger Bands
/// Returns (upper_band, middle_band, lower_band)
#[pyfunction]
pub fn bollinger_bands(data: Vec<f64>, period: usize, num_std: f64) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    let middle = sma(data.clone(), period);
    
    let mut upper = Vec::with_capacity(data.len());
    let mut lower = Vec::with_capacity(data.len());
    
    for i in 0..data.len() {
        if i < period - 1 {
            upper.push(f64::NAN);
            lower.push(f64::NAN);
        } else {
            // Calculate standard deviation
            let slice = &data[i + 1 - period..=i];
            let mean = slice.iter().sum::<f64>() / period as f64;
            let variance = slice.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / period as f64;
            let std_dev = variance.sqrt();
            
            upper.push(middle[i] + num_std * std_dev);
            lower.push(middle[i] - num_std * std_dev);
        }
    }
    
    (upper, middle, lower)
}

/// Average True Range
#[pyfunction]
pub fn atr(high: Vec<f64>, low: Vec<f64>, close: Vec<f64>, period: usize) -> Vec<f64> {
    if high.len() != low.len() || low.len() != close.len() || high.len() < 2 {
        return vec![f64::NAN; high.len()];
    }
    
    // Calculate True Range
    let mut tr = vec![high[0] - low[0]];
    
    for i in 1..high.len() {
        let hl = high[i] - low[i];
        let hc = (high[i] - close[i - 1]).abs();
        let lc = (low[i] - close[i - 1]).abs();
        tr.push(hl.max(hc).max(lc));
    }
    
    // ATR is EMA of True Range (using Wilder's smoothing)
    let mut result = vec![f64::NAN; period - 1];
    
    if tr.len() >= period {
        // First ATR is SMA
        let first_atr: f64 = tr[..period].iter().sum::<f64>() / period as f64;
        result.push(first_atr);
        
        // Subsequent ATR using Wilder's smoothing
        let mut prev_atr = first_atr;
        for i in period..tr.len() {
            let curr_atr = (prev_atr * (period - 1) as f64 + tr[i]) / period as f64;
            result.push(curr_atr);
            prev_atr = curr_atr;
        }
    }
    
    result
}

/// Standard Deviation
#[pyfunction]
pub fn stddev(data: Vec<f64>, period: usize) -> Vec<f64> {
    if data.len() < period || period == 0 {
        return vec![f64::NAN; data.len()];
    }
    
    let mut result = vec![f64::NAN; period - 1];
    
    for i in (period - 1)..data.len() {
        let slice = &data[i + 1 - period..=i];
        let mean = slice.iter().sum::<f64>() / period as f64;
        let variance = slice.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / period as f64;
        result.push(variance.sqrt());
    }
    
    result
}

/// Stochastic Oscillator
/// Returns (%K, %D)
#[pyfunction]
pub fn stochastic(high: Vec<f64>, low: Vec<f64>, close: Vec<f64>, k_period: usize, d_period: usize) -> (Vec<f64>, Vec<f64>) {
    if high.len() != low.len() || low.len() != close.len() || high.len() < k_period {
        return (vec![f64::NAN; high.len()], vec![f64::NAN; high.len()]);
    }
    
    let mut k_values = vec![f64::NAN; k_period - 1];
    
    for i in (k_period - 1)..high.len() {
        let start = i + 1 - k_period;
        let highest_high = high[start..=i].iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let lowest_low = low[start..=i].iter().cloned().fold(f64::INFINITY, f64::min);
        
        let range = highest_high - lowest_low;
        if range > 0.0 {
            k_values.push(((close[i] - lowest_low) / range) * 100.0);
        } else {
            k_values.push(50.0);  // Middle value if no range
        }
    }
    
    // %D is SMA of %K
    let d_values = sma(k_values.clone(), d_period);
    
    (k_values, d_values)
}

/// Crossover detection
/// Returns true at indices where series1 crosses above series2
#[pyfunction]
pub fn crossover(series1: Vec<f64>, series2: Vec<f64>) -> Vec<bool> {
    if series1.len() != series2.len() || series1.len() < 2 {
        return vec![false; series1.len()];
    }
    
    let mut result = vec![false];
    
    for i in 1..series1.len() {
        let prev1 = series1[i - 1];
        let prev2 = series2[i - 1];
        let curr1 = series1[i];
        let curr2 = series2[i];
        
        // Crossover: was below, now above
        let crossed = prev1 <= prev2 && curr1 > curr2;
        result.push(crossed && !prev1.is_nan() && !prev2.is_nan() && !curr1.is_nan() && !curr2.is_nan());
    }
    
    result
}

/// Crossunder detection
/// Returns true at indices where series1 crosses below series2
#[pyfunction]
pub fn crossunder(series1: Vec<f64>, series2: Vec<f64>) -> Vec<bool> {
    if series1.len() != series2.len() || series1.len() < 2 {
        return vec![false; series1.len()];
    }
    
    let mut result = vec![false];
    
    for i in 1..series1.len() {
        let prev1 = series1[i - 1];
        let prev2 = series2[i - 1];
        let curr1 = series1[i];
        let curr2 = series2[i];
        
        // Crossunder: was above, now below
        let crossed = prev1 >= prev2 && curr1 < curr2;
        result.push(crossed && !prev1.is_nan() && !prev2.is_nan() && !curr1.is_nan() && !curr2.is_nan());
    }
    
    result
}

/// Register all indicator functions to the Python module
pub fn register_indicators(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(sma, m)?)?;
    m.add_function(wrap_pyfunction!(ema, m)?)?;
    m.add_function(wrap_pyfunction!(rsi, m)?)?;
    m.add_function(wrap_pyfunction!(macd, m)?)?;
    m.add_function(wrap_pyfunction!(bollinger_bands, m)?)?;
    m.add_function(wrap_pyfunction!(atr, m)?)?;
    m.add_function(wrap_pyfunction!(stddev, m)?)?;
    m.add_function(wrap_pyfunction!(stochastic, m)?)?;
    m.add_function(wrap_pyfunction!(crossover, m)?)?;
    m.add_function(wrap_pyfunction!(crossunder, m)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_sma() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let result = sma(data, 3);
        assert!(result[0].is_nan());
        assert!(result[1].is_nan());
        assert!((result[2] - 2.0).abs() < 1e-10);
        assert!((result[3] - 3.0).abs() < 1e-10);
        assert!((result[4] - 4.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_ema() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let result = ema(data, 3);
        assert_eq!(result.len(), 5);
        assert!((result[0] - 1.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_rsi() {
        let data = vec![44.0, 44.25, 44.5, 43.75, 44.5, 44.25, 44.5, 45.0, 45.5, 45.0, 45.5, 46.0, 45.5, 46.0, 46.5];
        let result = rsi(data, 14);
        assert_eq!(result.len(), 15);
        // RSI should be between 0 and 100
        for val in result.iter() {
            if !val.is_nan() {
                assert!(*val >= 0.0 && *val <= 100.0);
            }
        }
    }
    
    #[test]
    fn test_crossover() {
        let s1 = vec![1.0, 2.0, 3.0, 2.0, 1.0];
        let s2 = vec![2.0, 2.0, 2.0, 2.0, 2.0];
        let result = crossover(s1, s2);
        assert!(!result[0]);
        assert!(!result[1]);
        assert!(result[2]);  // 3.0 crosses above 2.0
        assert!(!result[3]);
        assert!(!result[4]);
    }
}
