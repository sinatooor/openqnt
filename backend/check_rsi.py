"""Quick RSI analysis for AAPL"""
import sqlite3
import numpy as np
import pandas as pd

# Connect to database
db_path = 'data/market_data.db'
conn = sqlite3.connect(db_path)

# Get AAPL data
df = pd.read_sql_query('''
    SELECT date, close
    FROM daily_prices 
    WHERE symbol = 'AAPL'
    AND date BETWEEN '2024-01-01' AND '2024-06-01'
    ORDER BY date
''', conn)
conn.close()

# Calculate RSI
def calc_rsi(arr, period=14):
    arr = np.asarray(arr, dtype=float)
    deltas = np.diff(arr)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    
    avg_gain = np.zeros(len(arr))
    avg_loss = np.zeros(len(arr))
    if period < len(arr):
        avg_gain[period] = np.mean(gains[:period])
        avg_loss[period] = np.mean(losses[:period])
    
    for i in range(period + 1, len(arr)):
        avg_gain[i] = (avg_gain[i-1] * (period - 1) + gains[i-1]) / period
        avg_loss[i] = (avg_loss[i-1] * (period - 1) + losses[i-1]) / period
    
    rs = avg_gain / (avg_loss + 1e-10)
    rsi = 100 - (100 / (1 + rs))
    rsi[:period] = 50
    return rsi

rsi = calc_rsi(df['close'].values, 14)
df['rsi'] = rsi

print(f'Data points: {len(df)}')
print(f'Date range: {df.date.iloc[0]} to {df.date.iloc[-1]}')
print(f'RSI range: {df.rsi.min():.2f} - {df.rsi.max():.2f}')
print()
print('Days with RSI < 30 (oversold signals):')
oversold = df[df['rsi'] < 30]
for _, row in oversold.iterrows():
    print(f'  {row.date}: RSI = {row.rsi:.2f}, Close = {row.close:.2f}')

print()
print('Days with RSI > 70 (exit signals):')
overbought = df[df['rsi'] > 70]
for _, row in overbought.head(10).iterrows():
    print(f'  {row.date}: RSI = {row.rsi:.2f}, Close = {row.close:.2f}')
