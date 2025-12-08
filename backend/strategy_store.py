"""
Lightweight strategy store for paired Blockly XML and executable code.
Records are appended to a JSONL file for easy audit/history and cache reuse.
"""
import json
import os
import uuid
import hashlib
from datetime import datetime
from typing import Any, Dict, Optional

STORE_PATH = os.path.join(os.path.dirname(__file__), "logs", "strategies.jsonl")


def _ensure_store_file() -> None:
    os.makedirs(os.path.dirname(STORE_PATH), exist_ok=True)
    if not os.path.exists(STORE_PATH):
        with open(STORE_PATH, "a", encoding="utf-8"):
            pass


def hash_xml(xml: str) -> str:
    """Deterministic hash for cache lookups."""
    return hashlib.sha256(xml.encode("utf-8")).hexdigest()


def _iter_records():
    if not os.path.exists(STORE_PATH):
        return
    with open(STORE_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def load_latest_by_hash(xml_hash: str) -> Optional[Dict[str, Any]]:
    """Return the most recent record matching the XML hash."""
    match = None
    for rec in _iter_records():
        if rec.get("xml_hash") == xml_hash:
            match = rec
    return match


def load_by_id(strategy_id: str) -> Optional[Dict[str, Any]]:
    """Return the first record with matching id (latest write wins)."""
    match = None
    for rec in _iter_records():
        if rec.get("id") == strategy_id:
            match = rec
    return match


def save_strategy_version(
    xml: str,
    code: str,
    language: str = "python",
    source: str = "unknown",
    metadata: Optional[Dict[str, Any]] = None,
    strategy_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Persist a strategy version to the JSONL store."""
    _ensure_store_file()
    record = {
        "id": strategy_id or str(uuid.uuid4()),
        "xml_hash": hash_xml(xml),
        "xml": xml,
        "code": code,
        "language": language,
        "source": source,
        "metadata": metadata or {},
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    with open(STORE_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")
    return record

