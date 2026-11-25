"""A small in-process rolling-window rate limiter.

Good enough for a single backend instance. With several instances behind a
load balancer, move this to Redis or a Supabase table.
"""

import threading
import time
from collections import defaultdict, deque
from typing import Optional

from fastapi import Request

WINDOW_SECONDS = 24 * 60 * 60


class RollingLimiter:
    def __init__(self, window_seconds: int = WINDOW_SECONDS) -> None:
        self.window = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque:
        hits = self._hits[key]
        while hits and now - hits[0] >= self.window:
            hits.popleft()
        return hits

    def remaining(self, key: str, limit: int) -> int:
        with self._lock:
            return max(0, limit - len(self._prune(key, time.time())))

    def hit(self, key: str, limit: int) -> bool:
        """Record a hit. Returns False (and records nothing) when over the limit."""
        with self._lock:
            now = time.time()
            hits = self._prune(key, now)
            if len(hits) >= limit:
                return False
            hits.append(now)
            return True

    def refund(self, key: str) -> None:
        with self._lock:
            hits = self._hits.get(key)
            if hits:
                hits.pop()

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


identify_limiter = RollingLimiter()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def limiter_key(request: Request, user_id: Optional[str]) -> str:
    return f"user:{user_id}" if user_id else f"ip:{client_ip(request)}"
