# RAG Pipeline Architecture

## Overview

The RAG (Retrieval-Augmented Generation) method is an advanced approach to strategy generation that dynamically selects only the relevant blocks for each user request, rather than sending the entire 2800+ line prompt to the LLM.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER REQUEST                                   │
│                    "Create RSI oversold strategy"                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         STAGE 1: BLOCK RETRIEVAL                         │
│  ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐  │
│  │  Keyword Matching │ ──► │  RAG Router LLM  │ ──► │ Block Selection │  │
│  │  (INDICATOR_      │     │  (Semantic Query)│     │ (Merge Results) │  │
│  │   SYNONYMS)       │     │                  │     │                 │  │
│  └──────────────────┘     └──────────────────┘     └─────────────────┘  │
│                                                              │           │
│                                                              ▼           │
│                                          ┌──────────────────────────┐   │
│                                          │ BLOCK_CATALOG.xml        │   │
│                                          │ - 93 blocks available    │   │
│                                          │ - XML templates          │   │
│                                          │ - Organized by category  │   │
│                                          └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (Selected blocks: ~8-15)
┌─────────────────────────────────────────────────────────────────────────┐
│                         STAGE 2: GCG PLANNING                            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      GCG Planner LLM                              │   │
│  │  Input: User request + Selected block XML templates               │   │
│  │  Output: JSON execution plan                                      │   │
│  │                                                                   │   │
│  │  {                                                                │   │
│  │    "timeframe": 60,                                               │   │
│  │    "variables": [{"id": "rsi", "type": "ta_rsi", ...}],          │   │
│  │    "entry_conditions": [{"operator": "less", "left": "rsi", ...}],│   │
│  │    "entry_action": {"direction": "long", "size": 0.1, ...}       │   │
│  │  }                                                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      STAGE 3: XML COMPILATION                            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                   Strategy Compiler                               │   │
│  │  - Deterministic code (no LLM)                                    │   │
│  │  - Converts JSON plan to Blockly XML                              │   │
│  │  - Uses block templates from BLOCK_CATALOG.xml                    │   │
│  │  - Generates unique block IDs                                     │   │
│  │  - Proper nesting and connections                                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           FINAL OUTPUT                                   │
│                    <xml>                                                 │
│                      <block type="control_forever" x="50" y="50">       │
│                        ...complete strategy XML...                       │
│                      </block>                                            │
│                    </xml>                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

## Pipeline Stages

### Stage 1: Block Retrieval (RAG)

**Purpose:** Select only the blocks relevant to the user's request.

**Components:**

1. **Keyword Matching** (`rag_system.py`)
   - Uses synonym dictionaries to map user terms to block types
   - Example: "RSI" → `ta_rsi`, "buy" → `trade_order`
   ```python
   INDICATOR_SYNONYMS = {
       'rsi': ['ta_rsi', 'relative strength', 'overbought', 'oversold'],
       'macd': ['macd_value', 'moving average convergence'],
       'bollinger': ['ta_bb', 'bb', 'bands'],
       ...
   }
   ```

2. **RAG Router LLM**
   - Semantic understanding of user request
   - Returns JSON array of needed block types
   - Input: User request + available block summary
   - Output: `["ta_rsi", "operator_less", "trade_order"]`

3. **Block Selection**
   - Merges keyword + LLM results
   - Retrieves XML templates from `BLOCK_CATALOG.xml`
   - Always includes core blocks (control_forever, control_if, etc.)

**Output:** Dictionary of 8-15 relevant block types with their XML templates

### Stage 2: GCG Planning

**Purpose:** Create a structured execution plan in JSON format.

**GCG = Grammar-Constrained Generation**
- LLM outputs JSON following a strict schema
- Prevents hallucination of non-existent blocks
- Ensures type safety in comparisons

**JSON Schema:**
```json
{
  "timeframe": 60,
  "variables": [
    {
      "id": "rsi",
      "type": "ta_rsi",
      "params": {"period": 14, "timeframe": 60}
    }
  ],
  "entry_conditions": [
    {"operator": "operator_less", "left": "rsi", "right": 30}
  ],
  "exit_conditions": [
    {"operator": "operator_greater", "left": "rsi", "right": 70}
  ],
  "entry_action": {
    "direction": "long",
    "size": 0.1,
    "sl_pips": 50,
    "tp_pips": 100
  },
  "exit_action": {
    "type": "close_all"
  }
}
```

**Grammar Rules Enforced:**
1. Never compare two identical indicators
2. Scale compatibility (Price vs Price, Oscillator vs Level)
3. Type safety (Numbers on both sides of comparisons)

### Stage 3: XML Compilation

**Purpose:** Convert JSON plan to valid Blockly XML.

**Compiler** (`strategy_compiler.py`)
- 100% deterministic (no LLM)
- Uses block templates from catalog
- Generates proper structure:
  - `control_forever` wrapper
  - `environment_new_candle_open` timing
  - Nested conditions with `control_if`
  - Trade orders with SL/TP

**Benefits:**
- Guaranteed valid XML syntax
- No hallucinated blocks
- Consistent output format

---

## File Structure

```
backend/
├── main.py                    # API endpoints
├── rag_system.py              # Block retrieval & synonym matching
├── strategy_compiler.py       # JSON to XML conversion
├── FULL_SYSTEM_PROMPT.txt     # Legacy mode (2811 lines)
│
BLOCK_CATALOG.xml              # Master block definitions (93 blocks)
├── <rules>                    # 17 critical rules
├── <templates>                # 7 strategy examples
└── <blocks_catalog>           # All block XML templates
```

---

## Comparison: RAG vs Legacy Mode

| Feature | RAG Mode | Legacy Mode |
|---------|----------|-------------|
| Prompt Size | ~2KB (dynamic) | ~100KB (fixed) |
| Block Selection | Intelligent | All blocks |
| LLM Calls | 2 (Router + Planner) | 1-3 |
| Output Generation | Compiler (deterministic) | LLM (variable) |
| Error Rate | Lower (grammar-constrained) | Higher |
| Speed | Faster (smaller prompts) | Slower |
| Flexibility | High | Highest |

---

## API Endpoints

### RAG Mode
```
POST /strategy/generate
{
  "message": "Create an RSI oversold buy strategy",
  "ai_model": "gemini"  // or "deepseek"
}
```

### Legacy Mode
```
POST /strategy/legacy
{
  "message": "Create an RSI oversold buy strategy",
  "ai_model": "gemini"  // Uses Lovable Gateway by default
}
```

---

## Environment Variables

```env
# Required for RAG/Legacy Mode with Gemini
LOVABLE_API_KEY=your_lovable_api_key

# Required for DeepSeek
DEEPSEEK_API_KEY=your_deepseek_api_key

# Optional (direct Gemini API - not used by default)
GEMINI_API_KEY=your_gemini_api_key
```

---

## Benefits of RAG Approach

1. **Token Efficiency** - Only send relevant blocks (~2KB vs 100KB)
2. **Reduced Hallucination** - LLM can't invent blocks not in the selection
3. **Grammar Enforcement** - JSON schema prevents type errors
4. **Faster Response** - Smaller prompts = faster LLM processing
5. **Deterministic Output** - Compiler guarantees valid XML
6. **Maintainability** - Single source of truth in BLOCK_CATALOG.xml
