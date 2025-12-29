import json
import re
from typing import Dict, Any, Callable, Awaitable, List

REVIEW_PROMPT = """
You are a Senior Algorithmic Trading Strategist. Review the provided trading strategy (Blockly XML).

STRATEGY XML:
{xml}

Analyze the strategy and provide a structured review in JSON format with the following fields:
1. "explanation": A clear, non-technical explanation of the strategy's logic (entry, exit, risk management).
2. "weaknesses": A list of potential weaknesses or logical flaws (e.g. "No stop loss", "Conflicting conditions").
3. "overfitting_risks": A specific assessment of overfitting risks (High/Medium/Low) with reasoning.
4. "improvement_suggestions": A list of actionable suggestions to improve the strategy.

Return ONLY the valid JSON object. No markdown formatting.
"""

async def review_strategy(xml: str, llm_call: Callable[[List[Dict[str, str]]], Awaitable[str]]) -> Dict[str, Any]:
    """
    Analyze a strategy XML and return a structured review.
    
    Args:
        xml: The Blockly XML string
        llm_call: Async function that takes messages list and returns string response
    
    Returns:
        Dict containing review fields
    """
    messages = [
        {"role": "system", "content": "You are a helpful assistant that analyzes trading strategies and outputs JSON."},
        {"role": "user", "content": REVIEW_PROMPT.format(xml=xml)}
    ]
    
    try:
        response = await llm_call(messages)
        
        # Clean response
        cleaned = response.strip()
        # Handle markdown code blocks
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        
        result = json.loads(cleaned.strip())
        return result
        
    except json.JSONDecodeError as e:
        return {
            "explanation": "Failed to parse AI response",
            "weaknesses": [f"Parse error: {str(e)}"],
            "overfitting_risks": "Unknown",
            "improvement_suggestions": ["Retry the analysis"]
        }
    except Exception as e:
        return {
            "explanation": "Error during review",
            "weaknesses": [str(e)],
            "overfitting_risks": "Unknown",
            "improvement_suggestions": []
        }