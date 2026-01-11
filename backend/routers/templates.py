"""
Strategy Templates Router

API endpoints for accessing pre-built strategy templates.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List

router = APIRouter(
    prefix="/api/templates",
    tags=["templates"]
)

# Define templates inline for this router
TEMPLATES = [
    {
        "id": "rsi_oversold_bounce",
        "name": "RSI Oversold Bounce",
        "description": "Buy when RSI drops below 30, sell when it rises above 70.",
        "category": "mean_reversion",
        "difficulty": "beginner",
        "tags": ["RSI", "oversold", "swing"],
        "recommended_timeframe": "1h"
    },
    {
        "id": "ma_crossover",
        "name": "Moving Average Crossover",
        "description": "Buy when fast MA crosses above slow MA, sell on reverse.",
        "category": "trend_following",
        "difficulty": "beginner",
        "tags": ["SMA", "crossover", "trend"],
        "recommended_timeframe": "4h"
    },
    {
        "id": "macd_signal",
        "name": "MACD Signal Line Cross",
        "description": "Buy when MACD crosses above signal line.",
        "category": "momentum",
        "difficulty": "intermediate",
        "tags": ["MACD", "momentum"],
        "recommended_timeframe": "1d"
    },
    {
        "id": "bollinger_bounce",
        "name": "Bollinger Band Bounce",
        "description": "Buy when price touches lower band.",
        "category": "mean_reversion",
        "difficulty": "intermediate",
        "tags": ["Bollinger", "volatility"],
        "recommended_timeframe": "1h"
    },
    {
        "id": "breakout_high",
        "name": "Breakout Above Recent High",
        "description": "Buy when price breaks above highest high of N bars.",
        "category": "breakout",
        "difficulty": "advanced",
        "tags": ["breakout", "momentum"],
        "recommended_timeframe": "1d"
    }
]


@router.get("/")
async def list_templates(
    category: Optional[str] = None,
    difficulty: Optional[str] = None
):
    """List all available strategy templates with optional filtering."""
    result = TEMPLATES
    
    if category:
        result = [t for t in result if t["category"] == category]
    if difficulty:
        result = [t for t in result if t["difficulty"] == difficulty]
    
    return {
        "templates": result,
        "total": len(result),
        "categories": list(set(t["category"] for t in TEMPLATES)),
        "difficulties": ["beginner", "intermediate", "advanced"]
    }


@router.get("/{template_id}")
async def get_template(template_id: str):
    """Get a specific template by ID."""
    for t in TEMPLATES:
        if t["id"] == template_id:
            return t
    raise HTTPException(status_code=404, detail="Template not found")
