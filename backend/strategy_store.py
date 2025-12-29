import uuid
import time
import hashlib
import json
from typing import List, Dict, Any, Optional

# In-memory storage
# strategy_id -> list of version records
_versions: Dict[str, List[Dict[str, Any]]] = {} 
# content_hash -> content dict
_content_store: Dict[str, Dict[str, Any]] = {} 

def _compute_hash(content: Dict[str, Any]) -> str:
    # serializing with sort_keys to ensure deterministic hash
    serialized = json.dumps(content, sort_keys=True, default=str) 
    return hashlib.sha256(serialized.encode('utf-8')).hexdigest()

def save_strategy_version(
    xml: str, 
    code: str, 
    metadata: Dict[str, Any], 
    strategy_id: Optional[str] = None,
    language: str = "python",
    source: str = "unknown"
) -> Dict[str, Any]:
    
    if strategy_id is None:
        strategy_id = str(uuid.uuid4())
    
    if strategy_id not in _versions:
        _versions[strategy_id] = []
        
    content = {
        "xml": xml,
        "code": code,
        "language": language,
        "source": source,
        "metadata": metadata
    }
    content_hash = _compute_hash(content)
    
    if content_hash not in _content_store:
        _content_store[content_hash] = content
        
    version_num = len(_versions[strategy_id]) + 1
    
    record = {
        "id": strategy_id,
        "version": version_num,
        "timestamp": time.time(),
        "content_hash": content_hash
    }
    
    _versions[strategy_id].append(record)
    
    # Return the full record as expected by the manager (merged)
    return {**record, **content}

def load_by_id(strategy_id: str) -> Optional[Dict[str, Any]]:
    """Load the latest version of the strategy."""
    if strategy_id in _versions and _versions[strategy_id]:
        latest_record = _versions[strategy_id][-1]
        content = _content_store.get(latest_record["content_hash"], {})
        return {**latest_record, **content}
    return None

def get_history(strategy_id: str) -> List[Dict[str, Any]]:
    if strategy_id in _versions:
        history = []
        for rec in _versions[strategy_id]:
            content = _content_store.get(rec["content_hash"], {})
            history.append({**rec, **content})
        return history
    return []


def hash_xml(xml: str) -> str:
    """Hash XML content for caching/deduplication."""
    return hashlib.sha256(xml.encode('utf-8')).hexdigest()


def hash_xml_structure(xml: str) -> str:
    """Hash XML structure (alias for hash_xml)."""
    return hash_xml(xml)


def load_latest_by_hash(content_hash: str) -> Optional[Dict[str, Any]]:
    """Load strategy by content hash."""
    if content_hash in _content_store:
        return _content_store[content_hash]
    return None
