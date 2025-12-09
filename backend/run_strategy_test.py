
import sys
import os
import datetime
# Ensure backend directory is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backtest_service import parse_xml_simple, fetch_local_db_data
from json_code_generator import generate_strategy_from_json
from backtesting import Backtest
import pandas as pd

def run_pipeline():
    # 1. Build XML for Moving Average Crossover (Fast SMA 10, Slow SMA 50)
    print("1. Building Blockly XML for Strategy...")
    xml = """
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="trade_definition" id="trade_def" x="10" y="10">
        <statement name="marketing_strategy">
           <block type="ta_sma">
              <mutation ma_period="10"/>
              <field name="PERIOD">10</field>
           </block>
           <block type="ta_sma">
              <mutation ma_period="50"/>
              <field name="PERIOD">50</field>
           </block>
        </statement>
      </block>
    </xml>
    """
    
    # 2. Parse XML using app's parser
    print("2. Parsing XML using parse_xml_simple...")
    parsed = parse_xml_simple(xml)
    print(f"   Parsed Dictionary: {parsed}")

    # 3. Generate Python Code using app's generator
    print("3. Converting to Python code using apps pipeline (json_code_generator)...")
    code, unknown = generate_strategy_from_json(parsed)
    print("   Generated Python Code Snippet:")
    print("-" * 40)
    print(code[:500] + "...") # Print first 500 chars
    print("-" * 40)

    # 4. Compile/Load Strategy Class
    print("4. Loading Strategy Class...")
    namespace = {}
    try:
        exec(code, namespace)
        StrategyClass = namespace.get('GeneratedStrategy')
        if not StrategyClass:
            raise ValueError("Class 'GeneratedStrategy' not found in generated code")
        print("   Strategy Class loaded successfully.")
    except Exception as e:
        print(f"   Error executing generated code: {e}")
        return

    # 5. Fetch Data from Local Database
    print("5. Fetching Data from user database (AAPL, 2 years, Daily)...")
    start_date = (datetime.datetime.now() - datetime.timedelta(days=730)).strftime("%Y-%m-%d")
    try:
        data = fetch_local_db_data(
            symbol="AAPL",
            start_date=start_date,
            interval="1d"
        )
        print(f"   Fetched {len(data)} rows.")
    except Exception as e:
        print(f"   Error fetching data: {e}")
        print("   CRITICAL: Ensure AAPL data is present in your local database.")
        # Attempt to see if we can fail gracefully or if we should stop.
        # User explicitly asked to use "my data base".
        return

    # 6. Run Backtest
    print("6. Running Backtest...")
    bt = Backtest(data, StrategyClass, cash=10000, commission=.002)
    stats = bt.run()
    print("   Backtest Results:")
    print(stats)

    # 7. Interactive Visualization
    print("7. Generating Interactive Visualization...")
    output_file = os.path.join(os.getcwd(), 'backtest_result.html')
    bt.plot(filename=output_file, open_browser=True)
    print(f"   Visualization saved to: {output_file}")
    print("   Browser should open automatically.")

if __name__ == "__main__":
    run_pipeline()
