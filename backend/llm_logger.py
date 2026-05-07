"""
LLM Logger - Comprehensive logging for all LLM interactions

Features:
- Logs all LLM inputs and outputs
- Structured JSON format
- Timestamps with timezone
- Weekly log rotation
- Separate files for different log types
"""

import os
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
import traceback

# Log directory. In desktop builds OPENQWNT_DATA_DIR is the user-data path; the
# in-tree default keeps `scripts/start-all.sh` behavior unchanged.
_DATA_DIR = Path(os.environ.get("OPENQWNT_DATA_DIR", str(Path(__file__).parent)))
LOG_DIR = _DATA_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Log file paths
LLM_LOG_FILE = LOG_DIR / "llm_interactions.jsonl"
GENERAL_LOG_FILE = LOG_DIR / "backend.log"
ERROR_LOG_FILE = LOG_DIR / "errors.log"


def get_week_number() -> str:
    """Get current ISO week number as string."""
    return datetime.now().strftime("%Y-W%W")


def get_timestamp() -> str:
    """Get current timestamp in ISO format."""
    return datetime.now().isoformat()


def check_weekly_reset():
    """Reset log files if it's a new week."""
    week_file = LOG_DIR / ".current_week"
    current_week = get_week_number()
    
    if week_file.exists():
        stored_week = week_file.read_text().strip()
        if stored_week != current_week:
            # New week - archive and reset logs
            archive_logs()
            week_file.write_text(current_week)
    else:
        week_file.write_text(current_week)


def archive_logs():
    """Archive current logs and start fresh."""
    archive_dir = LOG_DIR / "archive"
    archive_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    for log_file in [LLM_LOG_FILE, GENERAL_LOG_FILE, ERROR_LOG_FILE]:
        if log_file.exists():
            archive_path = archive_dir / f"{log_file.stem}_{timestamp}{log_file.suffix}"
            log_file.rename(archive_path)
            print(f"Archived {log_file.name} to {archive_path.name}")


def log_llm_call(
    model: str,
    endpoint: str,
    messages: List[Dict[str, str]],
    response: str,
    duration_ms: float,
    tokens_input: Optional[int] = None,
    tokens_output: Optional[int] = None,
    temperature: float = 0.7,
    success: bool = True,
    error: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Log a complete LLM interaction.
    
    Args:
        model: LLM model name (e.g., "deepseek-chat", "gemini-2.0-flash")
        endpoint: API endpoint called
        messages: Full message history sent to LLM
        response: Complete LLM response
        duration_ms: Request duration in milliseconds
        tokens_input: Input token count (if available)
        tokens_output: Output token count (if available)
        temperature: Temperature setting used
        success: Whether the call succeeded
        error: Error message if failed
        metadata: Additional context (mode, user_prompt, etc.)
    """
    check_weekly_reset()
    
    log_entry = {
        "timestamp": get_timestamp(),
        "week": get_week_number(),
        "type": "llm_call",
        "model": model,
        "endpoint": endpoint,
        "temperature": temperature,
        "success": success,
        "duration_ms": round(duration_ms, 2),
        "tokens": {
            "input": tokens_input,
            "output": tokens_output
        },
        "messages": messages,
        "response": response,
        "error": error,
        "metadata": metadata or {}
    }
    
    # Write to JSONL file (one JSON object per line)
    with open(LLM_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
    
    # Also log summary to general log
    summary = f"[{log_entry['timestamp']}] LLM Call: {model} | {endpoint} | {'✓' if success else '✗'} | {duration_ms:.0f}ms"
    if tokens_input and tokens_output:
        summary += f" | {tokens_input}→{tokens_output} tokens"
    log_general(summary)


def log_conversion(
    conversion_type: str,
    input_data: str,
    output_data: str,
    success: bool = True,
    duration_ms: float = 0,
    error: Optional[str] = None
):
    """
    Log a code conversion (XML → Python, etc.)
    """
    check_weekly_reset()
    
    log_entry = {
        "timestamp": get_timestamp(),
        "type": "conversion",
        "conversion_type": conversion_type,
        "success": success,
        "duration_ms": round(duration_ms, 2),
        "input_length": len(input_data),
        "output_length": len(output_data),
        "input": input_data[:5000] + ("..." if len(input_data) > 5000 else ""),
        "output": output_data[:5000] + ("..." if len(output_data) > 5000 else ""),
        "error": error
    }
    
    with open(LLM_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
    
    log_general(f"[{log_entry['timestamp']}] Conversion: {conversion_type} | {'✓' if success else '✗'} | {duration_ms:.0f}ms | {len(input_data)}→{len(output_data)} chars")


def log_backtest(
    symbol: str,
    engine: str,
    period: str,
    success: bool,
    trades: int = 0,
    return_pct: float = 0,
    duration_ms: float = 0,
    error: Optional[str] = None,
    strategy_input: Optional[str] = None,
    full_metrics: Optional[Dict[str, Any]] = None
):
    """Log a backtest execution with full details."""
    check_weekly_reset()
    
    log_entry = {
        "timestamp": get_timestamp(),
        "type": "backtest",
        "symbol": symbol,
        "engine": engine,
        "period": period,
        "success": success,
        "trades": trades,
        "return_pct": return_pct,
        "duration_ms": round(duration_ms, 2),
        "error": error,
        "strategy_input": strategy_input[:10000] + "..." if strategy_input and len(strategy_input) > 10000 else strategy_input,
        "full_metrics": full_metrics
    }
    
    with open(LLM_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
    
    log_general(f"[{log_entry['timestamp']}] Backtest: {symbol} | {engine} | {'✓' if success else '✗'} | {trades} trades | {return_pct:.2f}%")


def log_strategy_generation(
    mode: str,
    user_prompt: str,
    generated_xml: str,
    ai_model: str,
    success: bool,
    ai_fixed: bool = False,
    duration_ms: float = 0,
    error: Optional[str] = None
):
    """Log a strategy generation request."""
    check_weekly_reset()
    
    log_entry = {
        "timestamp": get_timestamp(),
        "type": "strategy_generation",
        "mode": mode,
        "ai_model": ai_model,
        "success": success,
        "ai_fixed": ai_fixed,
        "duration_ms": round(duration_ms, 2),
        "user_prompt": user_prompt,
        "generated_xml_length": len(generated_xml),
        "generated_xml": generated_xml[:10000] + ("..." if len(generated_xml) > 10000 else ""),
        "error": error
    }
    
    with open(LLM_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
    
    log_general(f"[{log_entry['timestamp']}] Strategy Gen: {mode} | {ai_model} | {'✓' if success else '✗'} | fixed={ai_fixed} | {duration_ms:.0f}ms")


def log_general(message: str, level: str = "INFO"):
    """Log a general message."""
    timestamp = get_timestamp()
    log_line = f"[{timestamp}] [{level}] {message}\n"
    
    with open(GENERAL_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_line)
    
    # Also print to console
    print(f"[{level}] {message}")


def log_error(error: Exception, context: str = ""):
    """Log an error with full traceback."""
    check_weekly_reset()
    
    timestamp = get_timestamp()
    tb = traceback.format_exc()
    
    error_entry = f"""
{'='*80}
[{timestamp}] ERROR: {context}
{'='*80}
Exception: {type(error).__name__}: {str(error)}
Traceback:
{tb}
{'='*80}

"""
    
    with open(ERROR_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(error_entry)
    
    log_general(f"ERROR in {context}: {str(error)}", level="ERROR")


def log_api_request(
    endpoint: str,
    method: str,
    request_body: Optional[Dict] = None,
    response_status: int = 200,
    duration_ms: float = 0
):
    """Log an API request."""
    timestamp = get_timestamp()
    body_summary = ""
    if request_body:
        body_summary = f" | body_keys={list(request_body.keys())}"
    
    log_general(f"API: {method} {endpoint} | {response_status} | {duration_ms:.0f}ms{body_summary}")


def get_log_stats() -> Dict[str, Any]:
    """Get statistics about current logs."""
    stats = {
        "week": get_week_number(),
        "llm_calls": 0,
        "conversions": 0,
        "backtests": 0,
        "strategy_generations": 0,
        "errors": 0,
        "log_size_kb": 0
    }
    
    if LLM_LOG_FILE.exists():
        stats["log_size_kb"] = LLM_LOG_FILE.stat().st_size / 1024
        
        with open(LLM_LOG_FILE, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    entry = json.loads(line)
                    entry_type = entry.get("type", "")
                    if entry_type == "llm_call":
                        stats["llm_calls"] += 1
                    elif entry_type == "conversion":
                        stats["conversions"] += 1
                    elif entry_type == "backtest":
                        stats["backtests"] += 1
                    elif entry_type == "strategy_generation":
                        stats["strategy_generations"] += 1
                except:
                    pass
    
    if ERROR_LOG_FILE.exists():
        with open(ERROR_LOG_FILE, "r", encoding="utf-8") as f:
            stats["errors"] = f.read().count("ERROR:")
    
    return stats


# Initialize logging on import
check_weekly_reset()
log_general("="*60)
log_general("Backend Logger Initialized")
log_general(f"Log directory: {LOG_DIR}")
log_general(f"Current week: {get_week_number()}")
log_general("="*60)
