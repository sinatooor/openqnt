# Strategy Generator Architecture

This document explains the RAG + GCG strategy generation pipeline and compares it to the previous approach.

---

## Previous Approach (Gemini + DeepSeek)

### Flow
```
User Request → Supabase Edge Function (Gemini) → DeepSeek Fix → Load XML
```

### How It Worked
1. **Massive Prompt**: The entire `BLOCK_CATALOG.xml` (~111KB) was sent to Gemini.
2. **Direct XML Output**: Gemini generated raw Blockly XML.
3. **Fix Pass**: DeepSeek validated and fixed common issues (crossover operators, etc.).

### Problems
| Issue | Description |
|-------|-------------|
| **Token Waste** | Sending 111KB of block definitions in every request. |
| **XML Errors** | LLMs are bad at generating valid XML (unclosed tags, wrong structure). |
| **No Grammar** | No enforcement of logical correctness (e.g., comparing Price vs RSI). |
| **Hallucination** | LLM could invent block types that don't exist. |

---

## New Approach: RAG + GCG

### Core Concepts

| Term | Meaning |
|------|---------|
| **RAG** | Retrieval-Augmented Generation: Only send *relevant* blocks. |
| **GCG** | Grammar-Constrained Generation: LLM outputs JSON, not XML. |

### Flow
```
User Request
     │
     ▼
┌─────────────────────────────────────────────┐
│ 1. RETRIEVAL (RAG)                          │
│    - Keyword matching + LLM selection       │
│    - "RSI" → ta_rsi, operator_less          │
│    - Returns only ~5-10 relevant blocks     │
└─────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────┐
│ 2. PLANNING (GCG)                           │
│    - LLM outputs structured JSON plan       │
│    - Strict schema: variables, conditions   │
│    - Grammar rules enforced by prompt       │
└─────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────┐
│ 3. COMPILATION                              │
│    - Python converts JSON → XML             │
│    - 100% valid Blockly XML guaranteed      │
│    - Auto-fix for identical indicators      │
└─────────────────────────────────────────────┘
     │
     ▼
     Load into Blockly Workspace
```

---

## Key Components

### 1. Block Library (`rag_system.py`)
- Loads `BLOCK_CATALOG.xml` once at startup.
- Indexes blocks by type and category.
- Provides `retrieve_relevant_blocks(query)` using keyword synonyms.

### 2. Strategy Compiler (`strategy_compiler.py`)
- Converts JSON → Blockly XML.
- Enforces grammar rules:
  - **No Identical Indicators**: Auto-fixes by assigning Fast/Slow periods.
  - **Scale Compatibility**: Rejects Price vs RSI comparisons.
  - **Type Safety**: Validates Boolean vs Number operations.

### 3. LLM Prompts (`main.py`)
- `RAG_ROUTER_PROMPT`: Selects relevant blocks.
- `GCG_PLANNER_PROMPT`: Generates JSON plan with strict rules.

---

## Comparison

| Aspect | Old (Gemini) | New (RAG + GCG) |
|--------|--------------|-----------------|
| **Prompt Size** | 111KB+ | ~2-5KB |
| **Output Format** | Raw XML | JSON → XML |
| **XML Validity** | Often broken | 100% guaranteed |
| **Grammar Rules** | None | Type safety, scale compatibility |
| **Block Selection** | All blocks sent | Only relevant blocks |
| **Hallucination Risk** | High | Low (constrained to available blocks) |
| **Auto-Fix** | Basic | Advanced (identical indicators) |

---

## Example

### User Request
> "Buy when RSI is below 30"

### Old Approach
- Send 111KB prompt with all blocks.
- Hope Gemini generates valid XML.
- Fix any issues with DeepSeek.

### New Approach
1. **Retrieve**: `ta_rsi`, `operator_less`, `trade_order`, `control_if`, etc.
2. **Plan**:
   ```json
   {
     "variables": [{"id": "rsi", "type": "ta_rsi", "params": {"period": 14}}],
     "entry_conditions": [{"operator": "operator_less", "left": "rsi", "right": 30}],
     "entry_action": {"direction": "long", "size": 0.1}
   }
   ```
3. **Compile**: Deterministic XML generation with unique IDs and correct structure.

---

## Enabling RAG + GCG

In the AI Chat Panel:
1. Click **"Generate Blocks"** mode.
2. Toggle **"⚡ DeepSeek Only"** to ON.
3. Enter your strategy.

The system will use the new RAG + GCG pipeline automatically.
