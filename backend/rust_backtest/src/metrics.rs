//! Performance metrics calculation

use crate::types::{Metrics, Trade};

/// Calculate all performance metrics from trades and equity curve
pub fn calculate_metrics(
    trades: &[Trade],
    equity_curve: &[f64],
    initial_capital: f64,
    timestamps: &[i64],
) -> Metrics {
    if equity_curve.is_empty() {
        return Metrics::default();
    }
    
    let equity_final = *equity_curve.last().unwrap_or(&initial_capital);
    let equity_peak = equity_curve.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let net_profit = equity_final - initial_capital;
    let total_return = (equity_final / initial_capital - 1.0) * 100.0;
    
    // Calculate returns
    let returns: Vec<f64> = equity_curve.windows(2)
        .map(|w| (w[1] / w[0]) - 1.0)
        .collect();
    
    // CAGR
    let cagr = if timestamps.len() >= 2 {
        let days = (timestamps.last().unwrap() - timestamps.first().unwrap()) as f64 / 86400.0;
        let years = days / 365.25;
        if years > 0.0 {
            ((equity_final / initial_capital).powf(1.0 / years) - 1.0) * 100.0
        } else {
            0.0
        }
    } else {
        0.0
    };
    
    // Volatility (Annualized)
    let return_volatility = if returns.len() > 1 {
        let mean: f64 = returns.iter().sum::<f64>() / returns.len() as f64;
        let variance: f64 = returns.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / returns.len() as f64;
        variance.sqrt() * (252.0_f64).sqrt() * 100.0
    } else {
        0.0
    };
    
    // Sharpe Ratio (assuming 0 risk-free rate)
    let sharpe_ratio = if return_volatility > 0.0 {
        (cagr / 100.0) / (return_volatility / 100.0)
    } else {
        0.0
    };
    
    // Sortino Ratio
    let downside_returns: Vec<f64> = returns.iter().filter(|&&r| r < 0.0).cloned().collect();
    let downside_deviation = if downside_returns.len() > 1 {
        let variance: f64 = downside_returns.iter().map(|r| r.powi(2)).sum::<f64>() / downside_returns.len() as f64;
        variance.sqrt() * (252.0_f64).sqrt()
    } else {
        0.0
    };
    let sortino_ratio = if downside_deviation > 0.0 {
        (cagr / 100.0) / downside_deviation
    } else {
        0.0
    };
    
    // Maximum Drawdown
    let (max_drawdown, max_drawdown_duration) = calculate_max_drawdown(equity_curve, timestamps);
    
    // Calmar Ratio
    let calmar_ratio = if max_drawdown.abs() > 0.0 {
        (cagr / 100.0) / max_drawdown.abs()
    } else {
        0.0
    };
    
    // Skewness and Kurtosis
    let (skewness, kurtosis) = calculate_skewness_kurtosis(&returns);
    
    // VaR and CVaR (95%)
    let (var_95, cvar_95) = calculate_var_cvar(&returns, 0.05);
    
    // Trade statistics
    let total_trades = trades.len() as u32;
    let winning_trades: Vec<&Trade> = trades.iter().filter(|t| t.pnl > 0.0).collect();
    let losing_trades: Vec<&Trade> = trades.iter().filter(|t| t.pnl < 0.0).collect();
    
    let win_rate = if total_trades > 0 {
        (winning_trades.len() as f64 / total_trades as f64) * 100.0
    } else {
        0.0
    };
    let loss_rate = 100.0 - win_rate;
    
    // Average win/loss
    let avg_win = if !winning_trades.is_empty() {
        winning_trades.iter().map(|t| t.pnl).sum::<f64>() / winning_trades.len() as f64
    } else {
        0.0
    };
    let avg_loss = if !losing_trades.is_empty() {
        losing_trades.iter().map(|t| t.pnl.abs()).sum::<f64>() / losing_trades.len() as f64
    } else {
        0.0
    };
    
    // Payoff Ratio
    let payoff_ratio = if avg_loss > 0.0 {
        avg_win / avg_loss
    } else {
        0.0
    };
    
    // Profit Factor
    let gross_profit: f64 = winning_trades.iter().map(|t| t.pnl).sum();
    let gross_loss: f64 = losing_trades.iter().map(|t| t.pnl.abs()).sum();
    let profit_factor = if gross_loss > 0.0 {
        gross_profit / gross_loss
    } else if gross_profit > 0.0 {
        f64::INFINITY
    } else {
        0.0
    };
    
    // Expectancy
    let expectancy = if total_trades > 0 {
        trades.iter().map(|t| t.pnl).sum::<f64>() / total_trades as f64
    } else {
        0.0
    };
    
    // SQN (System Quality Number)
    let sqn = if trades.len() > 1 {
        let pnls: Vec<f64> = trades.iter().map(|t| t.pnl).collect();
        let pnl_mean = pnls.iter().sum::<f64>() / pnls.len() as f64;
        let pnl_variance = pnls.iter().map(|p| (p - pnl_mean).powi(2)).sum::<f64>() / pnls.len() as f64;
        let pnl_std = pnl_variance.sqrt();
        if pnl_std > 0.0 {
            (pnl_mean / pnl_std) * (trades.len() as f64).sqrt()
        } else {
            0.0
        }
    } else {
        0.0
    };
    
    // Kelly Criterion
    let kelly_criterion = if payoff_ratio > 0.0 {
        let w = win_rate / 100.0;
        (w - (1.0 - w) / payoff_ratio) * 100.0
    } else {
        0.0
    };
    
    // Average holding time
    let avg_holding_time = if !trades.is_empty() {
        let total_time: i64 = trades.iter().map(|t| t.exit_time - t.entry_time).sum();
        total_time as f64 / trades.len() as f64
    } else {
        0.0
    };
    
    Metrics {
        total_return,
        cagr,
        net_profit,
        profit_factor,
        expectancy,
        payoff_ratio,
        max_drawdown,
        max_drawdown_duration,
        calmar_ratio,
        sharpe_ratio,
        sortino_ratio,
        var_95,
        cvar_95,
        sqn,
        kelly_criterion,
        win_rate,
        loss_rate,
        total_trades,
        avg_holding_time,
        return_volatility,
        skewness,
        kurtosis,
        equity_final,
        equity_peak,
    }
}

/// Calculate maximum drawdown and its duration
fn calculate_max_drawdown(equity_curve: &[f64], timestamps: &[i64]) -> (f64, i64) {
    if equity_curve.is_empty() {
        return (0.0, 0);
    }
    
    let mut peak = equity_curve[0];
    let mut max_drawdown = 0.0;
    let mut max_dd_duration: i64 = 0;
    
    let mut dd_start_idx = 0;
    let mut in_drawdown = false;
    
    for (i, &equity) in equity_curve.iter().enumerate() {
        if equity > peak {
            if in_drawdown && i > 0 && timestamps.len() > i {
                let duration = timestamps[i] - timestamps[dd_start_idx];
                if duration > max_dd_duration {
                    max_dd_duration = duration;
                }
            }
            peak = equity;
            in_drawdown = false;
        } else {
            let drawdown = (peak - equity) / peak * 100.0;
            if drawdown > max_drawdown {
                max_drawdown = drawdown;
            }
            if !in_drawdown {
                dd_start_idx = i;
                in_drawdown = true;
            }
        }
    }
    
    (-max_drawdown, max_dd_duration)
}

/// Calculate skewness and kurtosis of returns
fn calculate_skewness_kurtosis(returns: &[f64]) -> (f64, f64) {
    if returns.len() < 3 {
        return (0.0, 0.0);
    }
    
    let n = returns.len() as f64;
    let mean = returns.iter().sum::<f64>() / n;
    
    let variance = returns.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / n;
    let std_dev = variance.sqrt();
    
    if std_dev == 0.0 {
        return (0.0, 0.0);
    }
    
    // Skewness
    let skewness = returns.iter()
        .map(|r| ((r - mean) / std_dev).powi(3))
        .sum::<f64>() / n;
    
    // Kurtosis (excess kurtosis, subtract 3)
    let kurtosis = returns.iter()
        .map(|r| ((r - mean) / std_dev).powi(4))
        .sum::<f64>() / n - 3.0;
    
    (skewness, kurtosis)
}

/// Calculate Value at Risk and Conditional VaR
fn calculate_var_cvar(returns: &[f64], confidence: f64) -> (f64, f64) {
    if returns.is_empty() {
        return (0.0, 0.0);
    }
    
    let mut sorted_returns = returns.to_vec();
    sorted_returns.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    
    let index = (returns.len() as f64 * confidence).floor() as usize;
    let var = sorted_returns.get(index).copied().unwrap_or(0.0) * 100.0;
    
    // CVaR is the average of returns below VaR
    let cvar = if index > 0 {
        sorted_returns[..index].iter().sum::<f64>() / index as f64 * 100.0
    } else {
        var
    };
    
    (var, cvar)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_calculate_max_drawdown() {
        let equity = vec![100.0, 110.0, 105.0, 95.0, 100.0, 120.0];
        let timestamps: Vec<i64> = (0..6).map(|i| i * 86400).collect();
        let (dd, _duration) = calculate_max_drawdown(&equity, &timestamps);
        
        // Max drawdown from 110 to 95 = 13.64%
        assert!(dd < 0.0);
        assert!((dd.abs() - 13.636363636363635).abs() < 0.01);
    }
    
    #[test]
    fn test_var_cvar() {
        let returns = vec![-0.05, -0.03, -0.01, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07];
        let (var, cvar) = calculate_var_cvar(&returns, 0.1);
        
        // At 10%, VaR should be around -5%
        assert!(var < 0.0);
        assert!(cvar <= var);
    }
}
