"""
Tests for AI Strategy Review (Objective 009)
Uses synchronous wrapper to avoid pytest-asyncio dependency.
"""
import pytest
import asyncio
from backend.ai_strategy_reviewer import review_strategy


def run_async(coro):
    """Helper to run async code synchronously."""
    return asyncio.get_event_loop().run_until_complete(coro)


def test_review_strategy_structure():
    """Test that review_strategy returns structured output."""
    mock_xml = "<xml>test</xml>"
    
    mock_response = """
    {
        "explanation": "Test explanation",
        "weaknesses": ["Weakness 1"],
        "overfitting_risks": "Low",
        "improvement_suggestions": ["Suggestion 1"]
    }
    """
    
    async def mock_llm(messages):
        assert len(messages) == 2
        return mock_response

    result = run_async(review_strategy(mock_xml, mock_llm))
    
    assert result["explanation"] == "Test explanation"
    assert len(result["weaknesses"]) == 1
    assert result["overfitting_risks"] == "Low"
    assert result["improvement_suggestions"][0] == "Suggestion 1"


def test_review_strategy_json_error():
    """Test that invalid JSON returns error structure."""
    mock_xml = "<xml>test</xml>"
    
    async def mock_llm(messages):
        return "Not JSON"

    result = run_async(review_strategy(mock_xml, mock_llm))
    
    # Should return error structure per our implementation
    assert result["explanation"] == "Failed to parse AI response"
    assert len(result["weaknesses"]) > 0
    assert result["overfitting_risks"] == "Unknown"
