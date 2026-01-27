"""
Agent Service
Initializes and manages the ADK Agent Runner.
"""

# Try to import Google ADK, make it optional
try:
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from adk_agents.trading_agent import trading_agent

    # Initialize Session Service
    session_service = InMemorySessionService()

    # Initialize Runner
    agent_runner = Runner(
        agent=trading_agent,
        app_name="trading_chat",
        session_service=session_service
    )
    ADK_AVAILABLE = True
except ImportError:
    print("Warning: google.adk not available. Agent features disabled.")
    agent_runner = None
    ADK_AVAILABLE = False

def get_agent_runner():
    if not ADK_AVAILABLE:
        raise RuntimeError("Google ADK is not installed. Install with: pip install google-adk")
    return agent_runner
