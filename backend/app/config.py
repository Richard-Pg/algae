"""Runtime settings read from the environment."""

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()
# Local development convenience: reuse the frontend's public Supabase values.
load_dotenv("../frontend/.env.local")


def env(name: str, default: str = "") -> str:
    """Read an env var, trimming whitespace and stray surrounding quotes."""
    value = os.environ.get(name, default).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1].strip()
    return value


def env_flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    try:
        return int(env(name, str(default)))
    except ValueError:
        return default


class Settings:
    def __init__(self) -> None:
        self.supabase_url = env("SUPABASE_URL") or env("NEXT_PUBLIC_SUPABASE_URL")
        self.supabase_service_key = env("SUPABASE_SERVICE_ROLE_KEY")
        self.supabase_anon_key = env("SUPABASE_ANON_KEY") or env("NEXT_PUBLIC_SUPABASE_ANON_KEY")

        # Comma-separated list. ADMIN_EMAIL (singular) is still honoured.
        raw_admins = env("ADMIN_EMAILS") or env("ADMIN_EMAIL", "haiming.peng@outlook.com")
        self.admin_emails = {e.strip().lower() for e in raw_admins.split(",") if e.strip()}
        self.notification_email = env("ADMIN_EMAIL") or next(iter(sorted(self.admin_emails)), "")

        self.frontend_url = env("FRONTEND_URL", "http://localhost:3000").rstrip("/")
        extra_origins = [o.strip() for o in env("CORS_ORIGINS").split(",") if o.strip()]
        self.cors_origins = [
            "http://localhost:3000",
            "http://localhost:3001",
            *extra_origins,
        ]
        self.cors_origin_regex = env("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app")

        # Storage: private bucket for raw uploads, public bucket for approved records.
        self.uploads_bucket = env("UPLOADS_BUCKET", "uploads")
        self.public_bucket = env("PUBLIC_BUCKET", "algae_images")
        self.signed_url_ttl = env_int("SIGNED_URL_TTL_SECONDS", 3600)

        # Rate limits (per rolling 24 hours).
        self.anon_daily_limit = env_int("ANON_DAILY_IDENTIFY_LIMIT", 3)
        self.user_daily_limit = env_int("USER_DAILY_IDENTIFY_LIMIT", 100)

        self.max_upload_bytes = env_int("MAX_UPLOAD_MB", 20) * 1024 * 1024

    def is_admin_email(self, email: str) -> bool:
        return bool(email) and email.strip().lower() in self.admin_emails


@lru_cache
def get_settings() -> Settings:
    return Settings()
