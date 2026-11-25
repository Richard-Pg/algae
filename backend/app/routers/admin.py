"""Review queue for community observations (admins only)."""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import CurrentUser, require_admin
from app.config import get_settings
from app.db import get_supabase
from app.notifications import (
    notifications_enabled,
    notify_review_result,
    set_notifications_enabled,
    smtp_configured,
)
from app.routers.submissions import SubmissionEdit
from app.storage import display_url, download_private, publish, signed_urls
from app.submission_fields import clean_payload, merge_unique, species_entry

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])

TABLE = "species_submissions"
STATUSES = {"pending", "needs_revision", "approved", "rejected"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load(submission_id: str) -> dict:
    rows = get_supabase().table(TABLE).select("*").eq("id", submission_id).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Submission not found")
    return rows[0]


class ReviewAction(BaseModel):
    admin_notes: str = ""


class NotificationSettings(BaseModel):
    enabled: bool


@router.get("/notification-settings")
def get_notification_settings(admin: CurrentUser = Depends(require_admin)):
    return {
        "enabled": notifications_enabled(),
        "configured": smtp_configured(),
        "recipient": get_settings().notification_email,
    }


@router.put("/notification-settings")
def put_notification_settings(body: NotificationSettings, admin: CurrentUser = Depends(require_admin)):
    try:
        set_notifications_enabled(body.enabled)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not save the setting: {exc}")
    return {"enabled": body.enabled, "configured": smtp_configured(), "recipient": get_settings().notification_email}


@router.get("/submissions")
def list_submissions(status: str = "pending", admin: CurrentUser = Depends(require_admin)):
    if status not in STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    rows = (
        get_supabase().table(TABLE).select("*")
        .eq("status", status).order("created_at", desc=True).limit(200).execute()
    ).data or []
    signed = signed_urls(r.get("image_path") for r in rows)
    for row in rows:
        row["image_url"] = display_url(row, signed)
    counts = {}
    for s in STATUSES:
        try:
            counts[s] = get_supabase().table(TABLE).select("id", count="exact", head=True).eq("status", s).execute().count or 0
        except Exception:
            counts[s] = None
    return {"submissions": rows, "total": len(rows), "counts": counts}


@router.put("/submissions/{submission_id}")
def edit_submission(submission_id: str, body: SubmissionEdit, admin: CurrentUser = Depends(require_admin)):
    payload = clean_payload(body.model_dump(exclude_unset=True))
    if "proposed_genus" in payload and not payload["proposed_genus"]:
        raise HTTPException(status_code=400, detail="Genus is required")
    payload["updated_at"] = _now()
    updated = get_supabase().table(TABLE).update(payload).eq("id", submission_id).execute().data
    if not updated:
        raise HTTPException(status_code=404, detail="Submission not found")
    row = updated[0]
    row["image_url"] = display_url(row)
    return {"success": True, "submission": row}


def _publish_image(data: dict) -> Optional[str]:
    """Copy the private upload into the public bucket for the open database."""
    if data.get("published_image_url"):
        return data["published_image_url"]
    if data.get("image_path"):
        try:
            return publish(download_private(data["image_path"]), prefix="species")
        except Exception as exc:
            log.warning("Publishing image for %s failed: %s", data.get("id"), exc)
            return None
    return data.get("image_url")  # legacy rows were already public


def _review(submission_id: str, status: str, admin: CurrentUser, notes: str, extra: Optional[dict] = None) -> dict:
    data = _load(submission_id)
    update = {
        "status": status,
        "admin_notes": notes.strip(),
        "reviewed_by": admin.email,
        "reviewed_at": _now(),
        "updated_at": _now(),
        **(extra or {}),
    }
    get_supabase().table(TABLE).update(update).eq("id", submission_id).execute()
    notify_review_result(data, status, notes)
    return data


@router.post("/submissions/{submission_id}/approve")
def approve(submission_id: str, body: ReviewAction, admin: CurrentUser = Depends(require_admin)):
    data = _load(submission_id)
    image_url = _publish_image(data)
    entry = species_entry(data, image_url)
    sb = get_supabase()
    existing = sb.table("algae_species").select("*").ilike("genus", data["proposed_genus"]).limit(1).execute().data
    if existing:
        row = existing[0]
        update = {
            "common_species": merge_unique(row.get("common_species") or [], entry["common_species"]),
            "reference_images": merge_unique(row.get("reference_images") or [], entry["reference_images"]),
            "references": merge_unique(row.get("references") or [], entry["references"]),
            "updated_at": _now(),
        }
        # Fill only what the curated record is missing.
        for key in ("taxonomy", "toxin", "ecology", "morphology", "description"):
            if not row.get(key) and entry.get(key):
                update[key] = entry[key]
        sb.table("algae_species").update(update).eq("id", row["id"]).execute()
        message = f"Added to the existing {row['genus']} record"
    else:
        sb.table("algae_species").insert(entry).execute()
        message = f"Created a new record for {entry['genus']}"
    _review(submission_id, "approved", admin, body.admin_notes, {"published_image_url": image_url})
    return {"success": True, "message": message}


@router.post("/submissions/{submission_id}/reject")
def reject(submission_id: str, body: ReviewAction, admin: CurrentUser = Depends(require_admin)):
    _review(submission_id, "rejected", admin, body.admin_notes)
    return {"success": True, "message": "Submission rejected"}


@router.post("/submissions/{submission_id}/request-revision")
def request_revision(submission_id: str, body: ReviewAction, admin: CurrentUser = Depends(require_admin)):
    if not body.admin_notes.strip():
        raise HTTPException(status_code=400, detail="Tell the contributor what to change")
    _review(submission_id, "needs_revision", admin, body.admin_notes)
    return {"success": True, "message": "Returned to the contributor for revision"}
