"""
Feature Flags System

Allows enabling/disabling features without code deployment.
"""
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum
import os
import json


class FeatureState(Enum):
    ENABLED = "enabled"
    DISABLED = "disabled"
    PERCENTAGE = "percentage"  # Enable for X% of users


@dataclass
class FeatureFlag:
    name: str
    state: FeatureState
    description: str
    percentage: float = 100.0  # For percentage rollouts
    metadata: Dict[str, Any] = None
    
    def is_enabled(self, user_id: Optional[str] = None) -> bool:
        """Check if feature is enabled for a user."""
        if self.state == FeatureState.DISABLED:
            return False
        if self.state == FeatureState.ENABLED:
            return True
        if self.state == FeatureState.PERCENTAGE:
            if user_id:
                # Consistent hashing for same user
                hash_value = hash(f"{self.name}:{user_id}") % 100
                return hash_value < self.percentage
            return False
        return False


class FeatureFlagsService:
    """
    Feature flags management.
    
    In production, this would integrate with a service like LaunchDarkly.
    """
    
    def __init__(self):
        self._flags: Dict[str, FeatureFlag] = {}
        self._load_defaults()
    
    def _load_defaults(self):
        """Load default feature flags."""
        defaults = [
            FeatureFlag(
                name="ai_fast_mode",
                state=FeatureState.ENABLED,
                description="Enable fast AI generation mode"
            ),
            FeatureFlag(
                name="rust_backtest_engine",
                state=FeatureState.PERCENTAGE,
                description="Use Rust backtest engine",
                percentage=50.0
            ),
            FeatureFlag(
                name="live_trading",
                state=FeatureState.ENABLED,
                description="Enable live trading features"
            ),
            FeatureFlag(
                name="advanced_position_management",
                state=FeatureState.ENABLED,
                description="Enable pyramiding, partial exits, etc."
            ),
            FeatureFlag(
                name="trade_journaling",
                state=FeatureState.ENABLED,
                description="Enable trade tagging and journaling"
            ),
            FeatureFlag(
                name="strategy_export",
                state=FeatureState.ENABLED,
                description="Enable strategy export to multiple formats"
            ),
            FeatureFlag(
                name="market_screener",
                state=FeatureState.ENABLED,
                description="Enable market screener functionality"
            ),
            FeatureFlag(
                name="websocket_updates",
                state=FeatureState.DISABLED,
                description="Enable real-time WebSocket updates"
            ),
            FeatureFlag(
                name="dark_mode",
                state=FeatureState.ENABLED,
                description="Enable dark mode UI"
            ),
            FeatureFlag(
                name="experimental_ui",
                state=FeatureState.DISABLED,
                description="Enable experimental UI features"
            ),
        ]
        
        for flag in defaults:
            self._flags[flag.name] = flag
    
    def is_enabled(self, flag_name: str, user_id: Optional[str] = None) -> bool:
        """Check if a feature is enabled."""
        flag = self._flags.get(flag_name)
        if flag is None:
            return False
        return flag.is_enabled(user_id)
    
    def get_flag(self, flag_name: str) -> Optional[FeatureFlag]:
        """Get a specific flag."""
        return self._flags.get(flag_name)
    
    def set_flag(
        self,
        flag_name: str,
        state: FeatureState,
        percentage: float = 100.0
    ):
        """Update a flag's state."""
        flag = self._flags.get(flag_name)
        if flag:
            flag.state = state
            flag.percentage = percentage
    
    def get_all_flags(self) -> Dict[str, Dict[str, Any]]:
        """Get all flags as a dictionary."""
        return {
            name: {
                "state": flag.state.value,
                "description": flag.description,
                "percentage": flag.percentage if flag.state == FeatureState.PERCENTAGE else None
            }
            for name, flag in self._flags.items()
        }
    
    def get_enabled_features(self, user_id: Optional[str] = None) -> list:
        """Get list of enabled features for a user."""
        return [
            name for name, flag in self._flags.items()
            if flag.is_enabled(user_id)
        ]


# Singleton instance
feature_flags = FeatureFlagsService()


# Convenience function
def is_feature_enabled(flag_name: str, user_id: Optional[str] = None) -> bool:
    """Check if a feature is enabled."""
    return feature_flags.is_enabled(flag_name, user_id)
