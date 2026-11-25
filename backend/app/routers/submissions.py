"""Community observations submitted for review."""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

import algae_identifier
from app.auth import CurrentUser, get_current_user
from app.config import get_settings
from app.db import get_supabase
from app.images import normalize_image, validate_upload
from app.notifications import notify_new_submission
from app.storage import display_url, signed_urls, upload_private
from app.submission_fields import clean_payload, parse_json

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["submissions"])

TABLE = "species_submissions"
EDITABLE_STATUSES = {"pending", "needs_revision"}


async def _create(
    user: CurrentUser,
    file: Optional[UploadFile],
    identification_id: str,
    fields: dict,
) -> dict:
    if not (fields.get("proposed_genus") or "").strip():
        raise HTTPException(status_code=400, detail="Genus is required")

    image_path: Optional[str] = None
    ai_result: Optional[dict] = None
    source_identification: Optional[str] = None

    if identification_id:
        rows = (
            get_supabase().table("identification_history").select("*")
            .eq("id", identification_id).limit(1).execute()
        ).data
        if not rows or rows[0].get("user_id") != user.id:
            raise HTTPException(status_code=404, detail="Identification not found")
        image_path = rows[0].get("image_path")
        ai_result = rows[0].get("result")
        source_identification = identification_id
        if not image_path and not rows[0].get("image_url"):
            raise HTTPException(status_code=400, detail="That identification has no stored image")
    elif file is not None:
        data = await file.read()
        validate_upload(file.filename or "", file.content_type or "", data, get_settings().max_upload_bytes)
        image = await run_in_threadpool(normalize_image, data)
        try:
            ai_result = await algae_identifier.identify_algae(image.model_png, file.filename or "image", normalized=True)
        except Exception as exc:  # AI is a helper here, not a requirement
            log.warning("AI pre-analysis failed for submission: %s", exc)
        try:
            image_path = await run_in_threadpool(upload_private, f"submissions/{user.id}", image.storage_jpeg)
        except Exception:
            log.exception("Submission image upload failed")
            raise HTTPException(status_code=500, detail="Failed to store the image. Please try again.")
    else:
        raise HTTPException(status_code=400, detail="Attach an image or choose one of your identifications")

    record = {
        **clean_payload(fields),
        "user_id": user.id,
        "user_email": user.email,
        "user_name": user.display_name or user.email,
        "image_path": image_path,
        "identification_id": source_identification,
        "ai_analysis": ai_result,
        "status": "pending",
    }
    if source_identification and not image_path:
        record["image_url"] = rows[0].get("image_url")  # legacy public image
    saved = (get_supabase().table(TABLE).insert(record).execute()).data[0]
    await run_in_threadpool(notify_new_submission, saved)
    return {"success": True, "submission_id": saved["id"]}


@router.post("/submissions")
@router.post("/submit-species", include_in_schema=False)  # old frontend path
async def submit(
    file: Optional[UploadFile] = File(None),
    identification_id: str = Form(""),
    proposed_genus: str = Form(...),
    proposed_species: str = Form(""),
    location_found: str = Form(""),
    user_notes: str = Form(""),
    submitted_taxonomy: str = Form("{}"),
    submitted_toxin: str = Form("{}"),
    submitted_ecology: str = Form("{}"),
    submitted_references: str = Form("[]"),
    submitted_morphology: str = Form(""),
    collection_date: str = Form(""),
    sample_type: str = Form(""),
    microscopy_method: str = Form(""),
    contributor_confidence: str = Form(""),
    user: CurrentUser = Depends(get_current_user),
):
    fields = {
        "proposed_genus": proposed_genus,
        "proposed_species": proposed_species,
        "location_found": location_found,
        "user_notes": user_notes,
        "submitted_morphology": submitted_morphology,
        "collection_date": collection_date,
        "sample_type": sample_type,
        "microscopy_method": microscopy_method,
        "contributor_confidence": contributor_confidence,
        "submitted_taxonomy": parse_json(submitted_taxonomy, {}),
        "submitted_toxin": parse_json(submitted_toxin, {}),
        "submitted_ecology": parse_json(submitted_ecology, {}),
        "submitted_references": parse_json(submitted_references, []),
    }
    return await _create(user, file, identification_id.strip(), fields)


def _public_view(row: dict, signed: dict) -> dict:
    hidden = {"ai_analysis", "user_email", "image_path"}
    view = {k: v for k, v in row.items() if k not in hidden}
    view["image_url"] = display_url(row, signed)
    return view


@router.get("/submissions/mine")
def my_submissions(user: CurrentUser = Depends(get_current_user)):
    rows = (
        get_supabase().table(TABLE).select("*")
        .eq("user_id", user.id).order("created_at", desc=True).limit(100).execute()
    ).data or []
    signed = signed_urls(r.get("image_path") for r in rows)
    counts = {"total": len(rows), "pending": 0, "needs_revision": 0, "approved": 0, "rejected": 0}
    for r in rows:
        counts[r.get("status", "pending")] = counts.get(r.get("status", "pending"), 0) + 1
    return {"items": [_public_view(r, signed) for r in rows], "counts": counts}


class SubmissionEdit(BaseModel):
    proposed_genus: Optional[str] = None
    proposed_species: Optional[str] = None
    location_found: Optional[str] = None
    user_notes: Optional[str] = None
    submitted_morphology: Optional[str] = None
    collection_date: Optional[str] = None
    sample_type: Optional[str] = None
    microscopy_method: Optional[str] = None
    contributor_confidence: Optional[str] = None
    submitted_taxonomy: Optional[dict[str, Any]] = None
    submitted_toxin: Optional[dict[str, Any]] = None
    submitted_ecology: Optional[dict[str, Any]] = None
    submitted_references: Optional[list[Any]] = None


@router.put("/submissions/{submission_id}")
def revise_submission(submission_id: str, body: SubmissionEdit, user: CurrentUser = Depends(get_current_user)):
    """Contributors can edit while pending, and resubmit after a revision request."""
    rows = get_supabase().table(TABLE).select("*").eq("id", submission_id).limit(1).execute().data
    if not rows or rows[0].get("user_id") != user.id:
        raise HTTPException(status_code=404, detail="Submission not found")
    if rows[0].get("status") not in EDITABLE_STATUSES:
        raise HTTPException(status_code=409, detail="This submission has already been reviewed")
    payload = clean_payload(body.model_dump(exclude_unset=True))
    if "proposed_genus" in payload and not payload["proposed_genus"]:
        raise HTTPException(status_code=400, detail="Genus is required")
    payload["status"] = "pending"
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    updated = get_supabase().table(TABLE).update(payload).eq("id", submission_id).execute().data
    return {"success": True, "submission": updated[0] if updated else None}
