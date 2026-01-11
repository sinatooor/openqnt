import sys
import os
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock

# Add backend to path so we can import modules
# Assuming this test file is in /tests/ and backend is in /backend/
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend"))
sys.path.insert(0, BACKEND_DIR)

# MOCKING GOOGLE ADK & GENAI BEFORE IMPORTS
# This prevents ImportErrors if these packages are missing in the test environment
try:
    import google.adk
    import google.adk.runners
    import google.adk.sessions
except ImportError:
    mock_adk = MagicMock()
    sys.modules["google.adk"] = mock_adk
    sys.modules["google.adk.runners"] = mock_adk
    sys.modules["google.adk.sessions"] = mock_adk

try:
    import google.genai
except ImportError:
    sys.modules["google.genai"] = MagicMock()

# Patch critical environment variables
with patch.dict(os.environ, {
    "DEEPSEEK_API_KEY": "mock-key", 
    "GEMINI_API_KEY": "mock-key",
    "USE_DEEPSEEK_ONLY": "false",
    "USE_RAG_FOR_BLOCKS": "false",
    "LOVABLE_API_KEY": "mock-key"
}):
    # Mock modules that might have side effects or external dependencies
    with patch("adk_agents.trading_agent.trading_agent", MagicMock()):
        with patch("backend.local_database.init_db", MagicMock()):
            with patch("backend.market_data_scheduler.start_scheduler", MagicMock()):
                # Import app after mocks are in place
                from backend.main import app

client = TestClient(app)

MOCK_XML_STRATEGY = """<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_forever" id="root">
    <statement name="DO">
      <block type="trade_order" id="order">
        <field name="DIRECTION">BUY</field>
        <value name="SIZE">
          <block type="math_number">
            <field name="NUM">0.1</field>
          </block>
        </value>
      </block>
    </statement>
  </block>
</xml>"""

def test_health_check():
    """Verify FastAPI app is initialized and responding."""
    response = client.get("/docs")
    assert response.status_code == 200

def test_end_to_end_headless_flow():
    """
    Test the full flow:
    1. Generate strategy (mocked LLM)
    2. Submit backtest (mocked code generation, simple engine)
    """
    
    # 1. Mock LLM for Strategy Generation
    # We patch the specific calls in backend.main
    with patch("backend.main.call_gemini", new_callable=AsyncMock) as mock_gemini, \
         patch("backend.main.call_deepseek", new_callable=AsyncMock) as mock_deepseek:
        
        # Setup mock return value for /generate-strategy
        # The API expects the LLM to return XML wrapped in markdown or raw
        mock_response = f"Here is the strategy:\n