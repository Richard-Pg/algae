"""Supabase clients.

The service-role client is server-only and bypasses RLS, so every route that
uses it must do its own ownership checks.
"""

from typing import Optional

from supabase import Client, create_client

from app.config import get_settings

_service_client: Optional[Client] = None


class DatabaseNotConfigured(RuntimeError):
    pass


def get_supabase() -> Client:
    global _service_client
    if _service_client is None:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_service_key:
            raise DatabaseNotConfigured(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on the backend"
            )
        _service_client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _service_client


def verify_access_token(token: str):
    """Return the Supabase user for an access token, or raise."""
    settings = get_settings()
    keys = [k for k in (settings.supabase_anon_key, settings.supabase_service_key) if k]
    if not settings.supabase_url or not keys:
        raise DatabaseNotConfigured("Missing Supabase auth configuration")
    last_error: Optional[Exception] = None
    for key in keys:
        try:
            response = create_client(settings.supabase_url, key).auth.get_user(token)
            user = getattr(response, "user", None)
            if user:
                return user
        except Exception as exc:  # try the next key
            last_error = exc
    raise last_error or RuntimeError("Invalid token")
