import pytest
from backend.ai_strategy_reviewer import review_strategy

@pytest.mark.asyncio
async def test_review_strategy_structure():
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

    result = await review_strategy(mock_xml, mock_llm)
    
    assert result["explanation"] == "Test explanation"
    assert len(result["weaknesses"]) == 1
    assert result["overfitting_risks"] == "Low"
    assert result["improvement_suggestions"][0] == "Suggestion 1"

@pytest.mark.asyncio
async def test_review_strategy_json_error():
    mock_xml = "<xml>test</xml>"
    
    async def mock_llm(messages):
        return "Not JSON"

    result = await review_strategy(mock_xml, mock_llm)
    
    assert result["explanation"] == "Failed to parse AI response."
    assert "raw_response" in result
