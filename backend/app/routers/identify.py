"""Identification: run the model, persist the result, read it back by id."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

import algae_identifier
from app.auth import CurrentUser, get_current_user, get_optional_user
from app.config import get_settings
from app.db import get_supabase
from app.images import normalize_image, validate_upload
from app.rate_limit import identify_limiter, limiter_key
from app.storage import display_url, signed_urls, upload_private

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["identify"])

TABLE = "identification_history"


def _limit_for(user: Optional[CurrentUser]) -> int:
    settings = get_settings()
    return settings.user_daily_limit if user else settings.anon_daily_limit


def _quota(request: Request, user: Optional[CurrentUser]) -> dict:
    limit = _limit_for(user)
    return {
        "limit": limit,
        "remaining": identify_limiter.remaining(limiter_key(request, user.id if user else None), limit),
        "signed_in": bool(user),
    }


def summarize(row: dict, signed: Optional[dict] = None) -> dict:
    """A light history entry: enough for a card, without the whole result."""
    result = row.get("result") or {}
    primary = result.get("primary_identification") or {}
    toxin = ((result.get("database_info") or {}).get("toxin") or {})
    return {
        "id": row["id"],
        "created_at": row.get("created_at"),
        "filename": row.get("filename"),
        "image_url": display_url(row, signed),
        "identified": bool(result.get("identified")),
        "genus": primary.get("genus"),
        "species": primary.get("species"),
        "confidence": primary.get("confidence"),
        "is_harmful": bool(result.get("is_harmful")),
        "risk_level": toxin.get("risk_level"),
        "is_shared": bool(row.get("is_shared")),
    }


def _persist(user: Optional[CurrentUser], filename: str, jpeg: bytes, result: dict) -> Optional[dict]:
    try:
        path = upload_private(f"identifications/{user.id if user else 'anonymous'}", jpeg)
    except Exception as exc:
        log.warning("Upload of identification image failed: %s", exc)
        path = None
    try:
        response = get_supabase().table(TABLE).insert({
            "user_id": user.id if user else None,
            "filename": filename,
            "image_path": path,
            "result": result,
        }).execute()
        return response.data[0] if response.data else None
    except Exception as exc:
        log.warning("Saving identification failed: %s", exc)
        return None


@router.get("/quota")
async def get_quota(request: Request, user: Optional[CurrentUser] = Depends(get_optional_user)):
    return _quota(request, user)


@router.post("/identify")
async def identify(
    request: Request,
    file: UploadFile = File(...),
    user: Optional[CurrentUser] = Depends(get_optional_user),
):
    settings = get_settings()
    data = await file.read()
    validate_upload(file.filename or "", file.content_type or "", data, settings.max_upload_bytes)

    key = limiter_key(request, user.id if user else None)
    if not identify_limiter.hit(key, _limit_for(user)):
        detail = (
            "You have reached today's identification limit. Please try again tomorrow."
            if user else
            "You have used today's free identifications. Sign in to keep identifying and save your history."
        )
        raise HTTPException(status_code=429, detail={"code": "rate_limited", "message": detail})

    try:
        image = await run_in_threadpool(normalize_image, data)
        result = await algae_identifier.identify_algae(image.model_png, file.filename or "image", normalized=True)
    except HTTPException:
        identify_limiter.refund(key)
        raise
    except ValueError as exc:  # configuration problems, e.g. missing API key
        identify_limiter.refund(key)
        log.error("Identification configuration error: %s", exc)
        raise HTTPException(status_code=503, detail="Identification is temporarily unavailable.")
    except Exception as exc:
        identify_limiter.refund(key)
        log.exception("Identification failed")
        raise HTTPException(status_code=502, detail=f"Identification failed: {exc}")

    row = await run_in_threadpool(_persist, user, file.filename or "image", image.storage_jpeg, result)
    image_url = await run_in_threadpool(display_url, row) if row else None

    return {
        **result,
        "id": row["id"] if row else None,
        "created_at": row.get("created_at") if row else None,
        "filename": file.filename,
        "image_url": image_url,
        "is_owner": True,
        "is_shared": False,
        "quota": _quota(request, user),
    }


def _load(identification_id: str) -> dict:
    try:
        response = get_supabase().table(TABLE).select("*").eq("id", identification_id).limit(1).execute()
    except Exception:
        raise HTTPException(status_code=404, detail="Result not found")
    if not response.data:
        raise HTTPException(status_code=404, detail="Result not found")
    return response.data[0]


def _can_view(row: dict, user: Optional[CurrentUser]) -> bool:
    owner = row.get("user_id")
    if owner is None or row.get("is_shared"):
        return True  # anonymous results and shared results are link-viewable
    return bool(user and (user.id == owner or user.is_admin))


@router.get("/identifications")
def list_identifications(
    limit: int = 24,
    offset: int = 0,
    harmful: bool = False,
    user: CurrentUser = Depends(get_current_user),
):
    limit = max(1, min(limit, 100))
    query = (
        get_supabase().table(TABLE)
        .select("id, created_at, filename, image_path, image_url, result, is_shared", count="exact")
        .eq("user_id", user.id)
    )
    if harmful:
        query = query.eq("result->>is_harmful", "true")
    response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    rows = response.data or []
    signed = signed_urls(r.get("image_path") for r in rows)
    return {"items": [summarize(r, signed) for r in rows], "total": response.count or 0}


@router.get("/identifications/{identification_id}")
def get_identification(identification_id: str, user: Optional[CurrentUser] = Depends(get_optional_user)):
    row = _load(identification_id)
    if not _can_view(row, user):
        raise HTTPException(status_code=404, detail="Result not found")
    return {
        **(row.get("result") or {}),
        "id": row["id"],
        "created_at": row.get("created_at"),
        "filename": row.get("filename"),
        "image_url": display_url(row),
        "is_owner": bool(user and row.get("user_id") == user.id),
        "is_shared": bool(row.get("is_shared")),
    }


class ShareRequest(BaseModel):
    is_shared: bool


@router.patch("/identifications/{identification_id}")
def update_identification(identification_id: str, body: ShareRequest, user: CurrentUser = Depends(get_current_user)):
    row = _load(identification_id)
    if row.get("user_id") != user.id:
        raise HTTPException(status_code=404, detail="Result not found")
    get_supabase().table(TABLE).update({"is_shared": body.is_shared}).eq("id", identification_id).execute()
    return {"id": identification_id, "is_shared": body.is_shared}


@router.delete("/identifications/{identification_id}")
def delete_identification(identification_id: str, user: CurrentUser = Depends(get_current_user)):
    row = _load(identification_id)
    if row.get("user_id") != user.id:
        raise HTTPException(status_code=404, detail="Result not found")
    get_supabase().table(TABLE).delete().eq("id", identification_id).execute()
    if row.get("image_path"):
        try:
            get_supabase().storage.from_(get_settings().uploads_bucket).remove([row["image_path"]])
        except Exception as exc:
            log.warning("Could not remove image %s: %s", row["image_path"], exc)
    return {"deleted": True}
