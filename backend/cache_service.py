"""
Cache Service

In-memory caching with TTL support for expensive operations.
"""
from datetime import datetime, timedelta
from typing import Any, Optional, Dict, Callable, TypeVar
from functools import wraps
import hashlib
import json

T = TypeVar('T')


class CacheEntry:
    def __init__(self, value: Any, expires_at: datetime):
        self.value = value
        self.expires_at = expires_at
        self.created_at = datetime.utcnow()
        self.hits = 0
    
    def is_expired(self) -> bool:
        return datetime.utcnow() > self.expires_at


class CacheService:
    """
    Simple in-memory cache with TTL.
    
    For production, use Redis or similar.
    """
    
    def __init__(self, default_ttl_seconds: int = 300):
        self._cache: Dict[str, CacheEntry] = {}
        self.default_ttl = default_ttl_seconds
        self.stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "evictions": 0
        }
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        entry = self._cache.get(key)
        
        if entry is None:
            self.stats["misses"] += 1
            return None
        
        if entry.is_expired():
            del self._cache[key]
            self.stats["misses"] += 1
            self.stats["evictions"] += 1
            return None
        
        entry.hits += 1
        self.stats["hits"] += 1
        return entry.value
    
    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None):
        """Set value in cache with optional TTL."""
        ttl = ttl_seconds or self.default_ttl
        expires_at = datetime.utcnow() + timedelta(seconds=ttl)
        self._cache[key] = CacheEntry(value, expires_at)
        self.stats["sets"] += 1
    
    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if key in self._cache:
            del self._cache[key]
            return True
        return False
    
    def clear(self):
        """Clear all cache entries."""
        self._cache.clear()
    
    def cleanup_expired(self) -> int:
        """Remove expired entries. Returns count removed."""
        now = datetime.utcnow()
        expired_keys = [
            k for k, v in self._cache.items()
            if v.is_expired()
        ]
        for key in expired_keys:
            del self._cache[key]
        self.stats["evictions"] += len(expired_keys)
        return len(expired_keys)
    
    def get_or_set(
        self,
        key: str,
        factory: Callable[[], T],
        ttl_seconds: Optional[int] = None
    ) -> T:
        """Get from cache or compute and store."""
        value = self.get(key)
        if value is not None:
            return value
        
        value = factory()
        self.set(key, value, ttl_seconds)
        return value
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total = self.stats["hits"] + self.stats["misses"]
        hit_rate = self.stats["hits"] / total if total > 0 else 0
        
        return {
            **self.stats,
            "size": len(self._cache),
            "hit_rate": round(hit_rate, 3)
        }


# Decorator for caching function results
def cached(ttl_seconds: int = 300, key_prefix: str = ""):
    """
    Decorator to cache function results.
    
    @cached(ttl_seconds=600)
    def expensive_operation(param1, param2):
        ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            # Generate cache key from function name and arguments
            key_parts = [key_prefix or func.__name__]
            key_parts.extend(str(a) for a in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            key = hashlib.md5(":".join(key_parts).encode()).hexdigest()
            
            cached_value = cache.get(key)
            if cached_value is not None:
                return cached_value
            
            result = func(*args, **kwargs)
            cache.set(key, result, ttl_seconds)
            return result
        
        return wrapper
    return decorator


# Singleton instance
cache = CacheService(default_ttl_seconds=300)


# Pre-configured caches for specific use cases
market_data_cache = CacheService(default_ttl_seconds=60)  # 1 minute for market data
llm_cache = CacheService(default_ttl_seconds=3600)  # 1 hour for LLM responses
strategy_cache = CacheService(default_ttl_seconds=1800)  # 30 min for strategies
