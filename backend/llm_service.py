"""
LLM Service - Handles LLM node execution for strategy flow

Supports multiple providers: OpenAI, Anthropic, Google
Executes different LLM node types: sentiment analysis, regime detection, etc.
"""

import os
import json
import httpx
from typing import Dict, Any, Optional, Literal
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# =============================================================================
# TYPES
# =============================================================================

LLMNodeType = Literal[
    'llmDecision',
    'sentimentAnalysis', 
    'regimeDetection',
    'nlStrategyRules',
    'parameterTuning',
    'marketRegimeClassification',
    'newsSentimentSignal',
    'customCode'
]

LLMModel = Literal[
    'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo',
    'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku',
    'gemini-pro', 'gemini-pro-1.5'
]

LLMProvider = Literal['openai', 'anthropic', 'google']

MODEL_TO_PROVIDER: Dict[LLMModel, LLMProvider] = {
    'gpt-4o': 'openai',
    'gpt-4o-mini': 'openai', 
    'gpt-4-turbo': 'openai',
    'claude-3-opus': 'anthropic',
    'claude-3-sonnet': 'anthropic',
    'claude-3-haiku': 'anthropic',
    'gemini-pro': 'google',
    'gemini-pro-1.5': 'google',
}

MODEL_API_NAMES: Dict[LLMModel, str] = {
    'gpt-4o': 'gpt-4o',
    'gpt-4o-mini': 'gpt-4o-mini',
    'gpt-4-turbo': 'gpt-4-turbo',
    'claude-3-opus': 'claude-3-opus-20240229',
    'claude-3-sonnet': 'claude-3-sonnet-20240229',
    'claude-3-haiku': 'claude-3-haiku-20240307',
    'gemini-pro': 'gemini-pro',
    'gemini-pro-1.5': 'gemini-1.5-pro',
}

# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class LLMNodeRequest(BaseModel):
    """Request to execute an LLM node"""
    nodeType: LLMNodeType
    model: LLMModel = 'gpt-4o-mini'
    prompt: str
    temperature: float = 0.3
    maxTokens: int = 1000
    schema: Optional[Dict[str, Any]] = None
    fallback: Optional[Dict[str, Any]] = None
    # API keys (passed from frontend, stored in browser localStorage)
    apiKeys: Dict[str, str] = {}
    # Context data
    marketData: Optional[Dict[str, Any]] = None
    indicators: Optional[Dict[str, Any]] = None
    newsData: Optional[list] = None
    # Type-specific params
    sentimentThreshold: Optional[float] = None
    lookbackPeriod: Optional[int] = None
    optimizationGoal: Optional[str] = None
    # Custom code
    code: Optional[str] = None
    language: Optional[str] = None


class LLMNodeResponse(BaseModel):
    """Response from LLM node execution"""
    success: bool
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    model: str
    tokensUsed: Optional[int] = None


# =============================================================================
# SYSTEM PROMPTS
# =============================================================================

SYSTEM_PROMPTS: Dict[LLMNodeType, str] = {
    'llmDecision': """You are a trading decision assistant. Analyze the provided market context and make a trading decision.
Always respond with valid JSON matching the specified schema. Be concise and decisive.""",

    'sentimentAnalysis': """You are a market sentiment analyst. Analyze the provided text, news, or social media content 
to determine market sentiment. Return a sentiment score from -1 (very bearish) to +1 (very bullish).
Consider: tone, specific numbers mentioned, historical comparisons, and market impact.
Always respond with valid JSON matching the specified schema.""",

    'regimeDetection': """You are a market regime analyst. Based on the provided price data and indicators,
classify the current market regime. Consider: trend strength, volatility levels, volume patterns, and momentum.
Regimes: trending_up, trending_down, ranging, volatile, breakout, consolidation.
Always respond with valid JSON matching the specified schema.""",

    'nlStrategyRules': """You are a trading rules interpreter. Convert the natural language trading rules into
actionable signals. Analyze the current market conditions against the stated rules.
Output clear buy/sell/hold signals with reasoning.
Always respond with valid JSON matching the specified schema.""",

    'parameterTuning': """You are a strategy optimization assistant. Based on the provided trading performance data
and current parameters, suggest improved parameter values. Consider: risk-adjusted returns, drawdown reduction,
and win rate improvement. Explain your reasoning.
Always respond with valid JSON matching the specified schema.""",

    'marketRegimeClassification': """You are an advanced market analyst. Classify the market across multiple dimensions:
- Trend: strong_up, weak_up, none, weak_down, strong_down
- Volatility: high, medium, low
- Momentum: bullish, neutral, bearish
- Volume: high, normal, low
Provide an overall confidence score and brief reasoning.
Always respond with valid JSON matching the specified schema.""",

    'newsSentimentSignal': """You are a news-to-signal converter. Analyze the provided news headlines and articles
about a specific symbol. Determine if the aggregate news is bullish, bearish, or neutral.
Consider: recency, source credibility, and potential market impact.
Output a trading signal with strength (0-1).
Always respond with valid JSON matching the specified schema.""",

    'customCode': """Execute the provided code and return the result as JSON.""",
}


# =============================================================================
# LLM API CALLS
# =============================================================================

async def call_openai(
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
    schema: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Call OpenAI API"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    body = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    
    # Add JSON mode if schema provided
    if schema:
        body["response_format"] = {"type": "json_object"}
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=body
        )
        
        if response.status_code != 200:
            raise Exception(f"OpenAI API error: {response.status_code} - {response.text}")
        
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        tokens = data.get("usage", {}).get("total_tokens", 0)
        
        return {"content": content, "tokens": tokens}


async def call_anthropic(
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
    schema: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Call Anthropic API"""
    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
    }
    
    # Add JSON instruction to prompt if schema provided
    if schema:
        user_prompt += f"\n\nRespond with valid JSON matching this schema: {json.dumps(schema)}"
    
    body = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}]
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=body
        )
        
        if response.status_code != 200:
            raise Exception(f"Anthropic API error: {response.status_code} - {response.text}")
        
        data = response.json()
        content = data["content"][0]["text"]
        tokens = data.get("usage", {}).get("input_tokens", 0) + data.get("usage", {}).get("output_tokens", 0)
        
        return {"content": content, "tokens": tokens}


async def call_google(
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
    schema: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Call Google Generative AI API"""
    
    # Add JSON instruction if schema provided
    if schema:
        user_prompt += f"\n\nRespond with valid JSON matching this schema: {json.dumps(schema)}"
    
    full_prompt = f"{system_prompt}\n\n{user_prompt}"
    
    body = {
        "contents": [{"parts": [{"text": full_prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        }
    }
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=body)
        
        if response.status_code != 200:
            raise Exception(f"Google API error: {response.status_code} - {response.text}")
        
        data = response.json()
        content = data["candidates"][0]["content"]["parts"][0]["text"]
        
        return {"content": content, "tokens": 0}  # Google doesn't return token count easily


# =============================================================================
# CUSTOM CODE EXECUTION
# =============================================================================

def execute_custom_code(
    code: str,
    language: str,
    data: Dict[str, Any],
    indicators: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Execute custom Python code in a sandboxed environment.
    WARNING: This is a simplified implementation. In production, use a proper sandbox.
    """
    if language != 'python':
        return {"error": "Only Python is currently supported"}
    
    try:
        # Create a restricted execution environment
        local_vars = {
            'data': data,
            'indicators': indicators,
            'context': context,
            'result': None
        }
        
        # Add safe built-ins
        safe_builtins = {
            'abs': abs, 'min': min, 'max': max, 'sum': sum, 'len': len,
            'range': range, 'round': round, 'sorted': sorted,
            'list': list, 'dict': dict, 'str': str, 'int': int, 'float': float, 'bool': bool,
        }
        
        exec_globals = {'__builtins__': safe_builtins}
        
        # Execute the code
        exec(code, exec_globals, local_vars)
        
        # Look for result from execute function or global result
        if 'execute' in local_vars:
            result = local_vars['execute'](data, indicators, context)
            return result
        elif local_vars.get('result'):
            return local_vars['result']
        else:
            return {"error": "No result returned. Define an 'execute(data, indicators, context)' function."}
            
    except Exception as e:
        return {"error": f"Code execution failed: {str(e)}"}


# =============================================================================
# MAIN EXECUTION FUNCTION
# =============================================================================

async def execute_llm_node(request: LLMNodeRequest) -> LLMNodeResponse:
    """Execute an LLM node and return the result"""
    
    try:
        # Handle custom code separately
        if request.nodeType == 'customCode':
            result = execute_custom_code(
                code=request.code or "",
                language=request.language or "python",
                data=request.marketData or {},
                indicators=request.indicators or {},
                context={}
            )
            
            if "error" in result:
                return LLMNodeResponse(
                    success=False,
                    error=result["error"],
                    model="custom",
                    result=request.fallback
                )
            
            return LLMNodeResponse(
                success=True,
                result=result,
                model="custom",
                tokensUsed=0
            )
        
        # Get provider and API key
        provider = MODEL_TO_PROVIDER.get(request.model, 'openai')
        api_key = request.apiKeys.get(provider, '')
        
        if not api_key:
            # Try environment variable as fallback
            env_key = os.getenv(f"{provider.upper()}_API_KEY", "")
            if not env_key:
                return LLMNodeResponse(
                    success=False,
                    error=f"No API key configured for {provider}. Add it in Settings → LLM.",
                    model=request.model,
                    result=request.fallback
                )
            api_key = env_key
        
        # Build the prompt
        system_prompt = SYSTEM_PROMPTS.get(request.nodeType, SYSTEM_PROMPTS['llmDecision'])
        
        # Build context for user prompt
        context_parts = [request.prompt]
        
        if request.marketData:
            context_parts.append(f"\n\nMarket Data:\n{json.dumps(request.marketData, indent=2)}")
        
        if request.indicators:
            context_parts.append(f"\n\nIndicators:\n{json.dumps(request.indicators, indent=2)}")
        
        if request.newsData:
            context_parts.append(f"\n\nNews:\n{json.dumps(request.newsData, indent=2)}")
        
        if request.schema:
            context_parts.append(f"\n\nRespond with JSON matching this schema:\n{json.dumps(request.schema, indent=2)}")
        
        user_prompt = "\n".join(context_parts)
        
        # Call the appropriate API
        model_name = MODEL_API_NAMES.get(request.model, request.model)
        
        if provider == 'openai':
            response = await call_openai(
                api_key, model_name, system_prompt, user_prompt,
                request.temperature, request.maxTokens, request.schema
            )
        elif provider == 'anthropic':
            response = await call_anthropic(
                api_key, model_name, system_prompt, user_prompt,
                request.temperature, request.maxTokens, request.schema
            )
        elif provider == 'google':
            response = await call_google(
                api_key, model_name, system_prompt, user_prompt,
                request.temperature, request.maxTokens, request.schema
            )
        else:
            return LLMNodeResponse(
                success=False,
                error=f"Unknown provider: {provider}",
                model=request.model,
                result=request.fallback
            )
        
        # Parse the response
        content = response["content"]
        
        # Try to extract JSON from the response
        try:
            # Try direct JSON parse
            result = json.loads(content)
        except json.JSONDecodeError:
            # Try to find JSON in the response
            import re
            json_match = re.search(r'\{[^{}]*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                # Return raw content wrapped
                result = {"raw": content}
        
        return LLMNodeResponse(
            success=True,
            result=result,
            model=request.model,
            tokensUsed=response.get("tokens", 0)
        )
        
    except Exception as e:
        return LLMNodeResponse(
            success=False,
            error=str(e),
            model=request.model,
            result=request.fallback
        )
