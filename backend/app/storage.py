"""Supabase Storage helpers.

Raw uploads live in a private bucket and are served through short-lived
signed URLs. Images only move to the public bucket when an admin approves a
contribution for the open database.
"""

import logging
import uuid
from typing import Iterable, Optional

from app.config import get_settings
from app.db import get_supabase

log = logging.getLogger(__name__)


def upload_private(prefix: str, data: bytes, content_type: str = "image/jpeg") -> str:
    """Upload to the private bucket and return the object path."""
    settings = get_settings()
    path = f"{prefix.strip('/')}/{uuid.uuid4()}.jpg"
    get_supabase().storage.from_(settings.uploads_bucket).upload(
        path, data, {"content-type": content_type}
    )
    return path


def download_private(path: str) -> bytes:
    settings = get_settings()
    return get_supabase().storage.from_(settings.uploads_bucket).download(path)


def publish(data: bytes, prefix: str = "species") -> str:
    """Upload to the public bucket and return its public URL."""
    settings = get_settings()
    path = f"{prefix.strip('/')}/{uuid.uuid4()}.jpg"
    bucket = get_supabase().storage.from_(settings.public_bucket)
    bucket.upload(path, data, {"content-type": "image/jpeg"})
    return bucket.get_public_url(path)


def _signed_url_value(response) -> Optional[str]:
    if isinstance(response, dict):
        return response.get("signedURL") or response.get("signedUrl") or response.get("signed_url")
    return getattr(response, "signed_url", None) or getattr(response, "signedURL", None)


def signed_url(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    settings = get_settings()
    try:
        response = get_supabase().storage.from_(settings.uploads_bucket).create_signed_url(
            path, settings.signed_url_ttl
        )
        return _signed_url_value(response)
    except Exception as exc:
        log.warning("Could not sign %s: %s", path, exc)
        return None


def signed_urls(paths: Iterable[Optional[str]]) -> dict:
    """Sign several paths in one request; returns {path: url}."""
    unique = [p for p in dict.fromkeys(paths) if p]
    if not unique:
        return {}
    settings = get_settings()
    try:
        response = get_supabase().storage.from_(settings.uploads_bucket).create_signed_urls(
            unique, settings.signed_url_ttl
        )
        result = {}
        for item in response or []:
            path = item.get("path") if isinstance(item, dict) else getattr(item, "path", None)
            url = _signed_url_value(item)
            if path and url:
                result[path] = url
        return result
    except Exception as exc:
        log.warning("Batch signing failed, falling back to one-by-one: %s", exc)
        return {p: u for p in unique if (u := signed_url(p))}


def display_url(row: dict, signed: Optional[dict] = None) -> Optional[str]:
    """Best URL to show for a row that has image_path (private) and/or image_url (legacy public)."""
    path = row.get("image_path")
    if path:
        if signed is not None and path in signed:
            return signed[path]
        return signed_url(path)
    return row.get("image_url")
