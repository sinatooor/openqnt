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


import re

def hash_xml(xml: str) -> str:
    """Deterministic hash for cache lookups."""
    # Normalize: remove whitespace between tags
    normalized = re.sub(r'>\s+<', '><', xml.strip())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def hash_xml_structure(xml: str) -> str:
    """
    Generate a hash of the XML structure, ignoring parameter values.
    Used to find re-usable code templates where only numbers/params changed.
    """
    # 1. Normalize whitespace first
    normalized = re.sub(r'>\s+<', '><', xml.strip())
    
    # 2. Mask numeric values between tags (e.g., <field name="NUM">14</field> -> <field name="NUM">#</field>)
    # Matches >123< or >12.34<
    normalized = re.sub(r'>\d+(\.\d+)?<', '>#<', normalized)
    
    # 3. Mask numeric attributes (e.g., ma_period="14" -> ma_period="#")
    # Be careful not to mask structural IDs if they are just numbers, but usually they are alphanumeric.
    # Simple heuristic: attributes often hold params.
    normalized = re.sub(r'="(\d+(\.\d+)?)"', '="#"', normalized)
    
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


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


def load_by_structure_hash(struct_hash: str) -> Optional[Dict[str, Any]]:
    """Return the most recent record matching the XML structure hash."""
    match = None
    for rec in _iter_records():
        if rec.get("structure_hash") == struct_hash:
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
        "structure_hash": hash_xml_structure(xml),
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

