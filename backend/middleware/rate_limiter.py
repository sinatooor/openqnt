"""
Rate Limiter Middleware

Simple in-memory rate limiting for API endpoints.
"""
import time
from collections import defaultdict
from typing import Dict, Tuple
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimiter:
    """
    Simple token bucket rate limiter.
    
    Limits requests per IP address with configurable rates.
    """
    
    def __init__(
        self,
        requests_per_minute: int = 60,
        burst_size: int = 10
    ):
        self.requests_per_minute = requests_per_minute
        self.burst_size = burst_size
        self.tokens: Dict[str, Tuple[float, int]] = defaultdict(
            lambda: (time.time(), burst_size)
        )
        self.refill_rate = requests_per_minute / 60.0  # tokens per second
    
    def is_allowed(self, client_id: str) -> bool:
        """Check if a request is allowed for the given client."""
        now = time.time()
        last_time, tokens = self.tokens[client_id]
        
        # Refill tokens based on time passed
        time_passed = now - last_time
        new_tokens = min(
            self.burst_size,
            tokens + int(time_passed * self.refill_rate)
        )
        
        if new_tokens >= 1:
            self.tokens[client_id] = (now, new_tokens - 1)
            return True
        else:
            self.tokens[client_id] = (now, new_tokens)
            return False
    
    def get_remaining(self, client_id: str) -> int:
        """Get remaining tokens for a client."""
        _, tokens = self.tokens[client_id]
        return tokens
    
    def cleanup_old_entries(self, max_age_seconds: int = 3600):
        """Remove entries older than max_age_seconds to prevent memory growth."""
        now = time.time()
        to_remove = [
            k for k, (t, _) in self.tokens.items()
            if now - t > max_age_seconds
        ]
        for k in to_remove:
            del self.tokens[k]


# Default rate limiters for different endpoint types
default_limiter = RateLimiter(requests_per_minute=120, burst_size=20)
strict_limiter = RateLimiter(requests_per_minute=30, burst_size=5)
llm_limiter = RateLimiter(requests_per_minute=10, burst_size=3)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for rate limiting.
    
    Applies different limits based on endpoint path.
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.default_limiter = default_limiter
        self.strict_limiter = strict_limiter
        self.llm_limiter = llm_limiter
        
        # Endpoints with strict limits
        self.strict_paths = [
            "/api/panic",
            "/api/live/start",
            "/strategy/start"
        ]
        
        # Endpoints with LLM limits (expensive operations)
        self.llm_paths = [
            "/api/generate-strategy",
            "/api/backtest",
            "/api/mql"
        ]
    
    async def dispatch(self, request: Request, call_next):
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        
        # Skip rate limiting for health checks
        if path.startswith("/api/health"):
            return await call_next(request)
        
        # Select appropriate limiter
        if any(path.startswith(p) for p in self.llm_paths):
            limiter = self.llm_limiter
        elif any(path.startswith(p) for p in self.strict_paths):
            limiter = self.strict_limiter
        else:
            limiter = self.default_limiter
        
        # Check rate limit
        if not limiter.is_allowed(client_ip):
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please slow down.",
                headers={"Retry-After": "60"}
            )
        
        # Add rate limit headers to response
        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(
            limiter.get_remaining(client_ip)
        )
        
        return response


def add_rate_limiting(app):
    """Add rate limiting middleware to a FastAPI app."""
    app.add_middleware(RateLimitMiddleware)
