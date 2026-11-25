"""Authentication dependencies."""

from dataclasses import dataclass, field
from typing import Optional

from fastapi import Depends, Header, HTTPException
from starlette.concurrency import run_in_threadpool

from app.config import get_settings
from app.db import verify_access_token


@dataclass
class CurrentUser:
    id: str
    email: str
    metadata: dict = field(default_factory=dict)

    @property
    def display_name(self) -> str:
        return (
            self.metadata.get("display_name")
            or self.metadata.get("full_name")
            or (self.email.split("@")[0] if self.email else "")
        )

    @property
    def is_admin(self) -> bool:
        return get_settings().is_admin_email(self.email)


def _to_current_user(user) -> CurrentUser:
    if isinstance(user, dict):
        return CurrentUser(
            id=str(user.get("id") or ""),
            email=str(user.get("email") or ""),
            metadata=user.get("user_metadata") or {},
        )
    return CurrentUser(
        id=str(getattr(user, "id", "") or ""),
        email=str(getattr(user, "email", "") or ""),
        metadata=getattr(user, "user_metadata", None) or {},
    )


def _bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    return token or None


async def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[CurrentUser]:
    """The signed-in user, or None for anonymous requests.

    A token that is present but invalid is an error rather than silently
    anonymous, so an expired session is noticed by the client.
    """
    token = _bearer(authorization)
    if not token:
        return None
    try:
        user = await run_in_threadpool(verify_access_token, token)
    except Exception:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")
    return _to_current_user(user)


async def get_current_user(user: Optional[CurrentUser] = Depends(get_optional_user)) -> CurrentUser:
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in required")
    return user


async def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
