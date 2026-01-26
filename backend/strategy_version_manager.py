import dataclasses
from typing import List, Dict, Any, Optional
from strategy_ir import StrategyIR
import strategy_store

class StrategyVersionManager:
    """
    Manages strategy versioning, including creation, updates, cloning, and diffing.
    Wraps the underlying strategy_store persistence.
    """
    
    def _ir_to_dict(self, ir: StrategyIR) -> Dict[str, Any]:
        """Convert StrategyIR dataclass to dictionary."""
        if dataclasses.is_dataclass(ir):
            return dataclasses.asdict(ir)
        return ir.__dict__

    def create_strategy(self, ir: StrategyIR, xml: str = "", code: str = "") -> str:
        """
        Create a new strategy series.
        Returns the strategy_id.
        """
        metadata = {"ir": self._ir_to_dict(ir)}
        # strategy_store generates a new ID if strategy_id is None
        record = strategy_store.save_strategy_version(
            xml=xml,
            code=code,
            metadata=metadata,
            strategy_id=None
        )
        return record["id"]

    def update_strategy(self, strategy_id: str, ir: StrategyIR, xml: str = "", code: str = "") -> str:
        """
        Save a new version of an existing strategy.
        Returns the strategy_id.
        """
        metadata = {"ir": self._ir_to_dict(ir)}
        strategy_store.save_strategy_version(
            xml=xml,
            code=code,
            metadata=metadata,
            strategy_id=strategy_id
        )
        return strategy_id

    def clone_strategy(self, source_strategy_id: str) -> Optional[str]:
        """
        Clone the latest version of source_strategy_id to a new strategy ID.
        Returns new strategy_id or None if source not found.
        """
        latest = strategy_store.load_by_id(source_strategy_id)
        if not latest:
            return None
        
        # Save as a new strategy (strategy_id=None) but keeping content
        new_record = strategy_store.save_strategy_version(
            xml=latest.get("xml", ""),
            code=latest.get("code", ""),
            language=latest.get("language", "python"),
            source=latest.get("source", "unknown"),
            metadata=latest.get("metadata", {}),
            strategy_id=None # Force new ID creation
        )
        return new_record["id"]

    def get_history(self, strategy_id: str) -> List[Dict[str, Any]]:
        """Return version history for a strategy."""
        return strategy_store.get_history(strategy_id)

    def get_latest_version(self, strategy_id: str) -> Optional[Dict[str, Any]]:
        """Return the latest version of a strategy."""
        return strategy_store.load_by_id(strategy_id)

    def diff_versions(self, version1: Dict[str, Any], version2: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compare two versions, primarily focusing on IR diff.
        Returns a dictionary representing changes.
        """
        ir1 = version1.get("metadata", {}).get("ir", {})
        ir2 = version2.get("metadata", {}).get("ir", {})
        
        return self._diff_dicts(ir1, ir2)

    def _diff_dicts(self, d1: Dict[str, Any], d2: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recursive difference between two dictionaries.
        """
        diff = {}
        all_keys = set(d1.keys()) | set(d2.keys())
        for k in all_keys:
            if k not in d1:
                diff[k] = {"old": None, "new": d2[k]}
            elif k not in d2:
                diff[k] = {"old": d1[k], "new": None}
            else:
                if isinstance(d1[k], dict) and isinstance(d2[k], dict):
                    nested_diff = self._diff_dicts(d1[k], d2[k])
                    if nested_diff:
                        diff[k] = nested_diff
                elif d1[k] != d2[k]:
                     diff[k] = {"old": d1[k], "new": d2[k]}
        return diff
