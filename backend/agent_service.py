"""
Agent Service
Initializes and manages the ADK Agent Runner.
"""
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

def get_agent_runner():
    return agent_runner
