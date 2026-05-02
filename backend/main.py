"""
FastAPI Backend for AI Algae Identification System
Provides endpoints for image upload/identification, species lookup, and history.
"""

import os
import smtplib
import json
import uuid
from datetime import datetime
from email.message import EmailMessage
from typing import Optional, List, Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client

from algae_identifier import identify_algae
from algae_database import get_species_info, get_all_genera

# Load environment variables
load_dotenv()
load_dotenv("../frontend/.env.local")


def clean_env(name: str, default: str = "") -> str:
    value = os.environ.get(name, default).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1].strip()
    return value

app = FastAPI(
    title="AI Algae Identification System",
    description="Identify harmful algae and diatoms from uploaded images",
    version="1.0.0",
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://algae-production.up.railway.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory history storage (for demo purposes)
identification_history: List[dict] = []

# Supported image formats
SUPPORTED_FORMATS = {
    "image/jpeg", "image/jpg", "image/png", "image/heic",
    "image/heif", "image/tiff", "image/tif", "image/webp"
}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


@app.get("/")
async def root():
    return {
        "name": "AI Algae Identification System",
        "version": "1.0.0",
        "endpoints": {
            "identify": "POST /api/identify",
            "species": "GET /api/species/{genus_name}",
            "all_species": "GET /api/species",
            "history": "GET /api/history",
        },
    }


@app.post("/api/identify")
async def identify_image(file: UploadFile = File(...)):
    """
    Upload an image for algae identification.
    Supports JPG, PNG, HEIC, TIFF formats.
    Returns predicted species with confidence, taxonomy, toxin, and ecological information.
    """
    # Validate file type
    content_type = file.content_type or ""
    if content_type not in SUPPORTED_FORMATS:
        # Also check file extension
        ext = os.path.splitext(file.filename or "")[1].lower()
        valid_extensions = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".tiff", ".tif", ".webp"}
        if ext not in valid_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported image format: {content_type}. Supported: JPG, PNG, HEIC, TIFF, WebP"
            )

    # Read file
    image_bytes = await file.read()

    # Validate file size
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
        )

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    # Run identification
    try:
        result = await identify_algae(image_bytes, file.filename or "image.jpg")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Identification failed: {str(e)}"
        )

    # Create history entry
    history_entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(),
        "filename": file.filename,
        "result": result,
    }
    identification_history.insert(0, history_entry)

    # Keep only last 50 entries
    if len(identification_history) > 50:
        identification_history.pop()

    return {
        "id": history_entry["id"],
        "timestamp": history_entry["timestamp"],
        "filename": file.filename,
        **result,
    }


@app.get("/api/species")
async def list_species():
    """List all algae genera in the database."""
    genera = get_all_genera()
    species_list = []
    for genus in genera:
        info = get_species_info(genus)
        if info:
            species_list.append({
                "genus": genus,
                "phylum": info["taxonomy"]["phylum"],
                "risk_level": info["toxin"]["risk_level"],
                "produces_toxin": info["toxin"]["produces_toxin"],
                "description": info["description"][:150] + "...",
            })
    return {"species": species_list, "total": len(species_list)}


@app.get("/api/species/{genus_name}")
async def get_species(genus_name: str):
    """Get detailed information about an algae genus."""
    info = get_species_info(genus_name)
    if not info:
        raise HTTPException(
            status_code=404,
            detail=f"Species '{genus_name}' not found. Available: {', '.join(get_all_genera())}"
        )
    return info


@app.get("/api/history")
async def get_history(limit: int = 20):
    """Get recent identification history."""
    return {
        "history": identification_history[:limit],
        "total": len(identification_history),
    }



@app.delete("/api/history")
async def clear_history():
    """Clear identification history."""
    identification_history.clear()
    return {"message": "History cleared"}


# ============================================================
# Community Contribution Endpoints
# ============================================================

ADMIN_EMAIL = clean_env("ADMIN_EMAIL", "haiming.peng@outlook.com")
_auth_supabase = None


class AdminActionRequest(BaseModel):
    admin_notes: str = ""


class NotificationSettingsRequest(BaseModel):
    enabled: bool


class AdminSubmissionEditRequest(BaseModel):
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


def _extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")
    return authorization.removeprefix("Bearer ").strip()


async def get_current_user(authorization: Optional[str] = Header(None)):
    """Verify the Supabase access token and return the authenticated user."""
    token = _extract_bearer_token(authorization)
    try:
        response = get_user_from_supabase_token(token)
        user = getattr(response, "user", None)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
        return user
    except HTTPException:
        raise
    except Exception as e:
        print(f"Supabase auth verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication token")


def get_auth_supabase():
    """Use an anon-key client for end-user JWT verification."""
    global _auth_supabase
    if not _auth_supabase:
        supabase_url = clean_env("SUPABASE_URL")
        anon_key = clean_env("SUPABASE_ANON_KEY") or clean_env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not supabase_url or not anon_key:
            raise HTTPException(status_code=500, detail="Missing Supabase auth configuration")
        _auth_supabase = create_client(supabase_url, anon_key)
    return _auth_supabase


def get_user_from_supabase_token(token: str):
    """Verify a user JWT, tolerating cloud env mistakes around anon keys.

    Cloud providers make it easy to paste a malformed anon key. The service role
    key is still server-only here, so it is safe as a backend fallback for the
    Supabase Auth /user check.
    """
    supabase_url = clean_env("SUPABASE_URL")
    candidate_keys = [
        ("SUPABASE_ANON_KEY", clean_env("SUPABASE_ANON_KEY")),
        ("NEXT_PUBLIC_SUPABASE_ANON_KEY", clean_env("NEXT_PUBLIC_SUPABASE_ANON_KEY")),
        ("SUPABASE_SERVICE_ROLE_KEY", clean_env("SUPABASE_SERVICE_ROLE_KEY")),
    ]
    last_error = None
    for key_name, key in candidate_keys:
        if not supabase_url or not key:
            continue
        try:
            return create_client(supabase_url, key).auth.get_user(token)
        except Exception as e:
            last_error = e
            print(f"Supabase auth verification failed with {key_name}: {e}")
    if last_error:
        raise last_error
    raise RuntimeError("Missing Supabase auth configuration")


async def require_admin(current_user=Depends(get_current_user)):
    user_email = _get_user_email(current_user)
    if not _is_admin_email(user_email):
        print(f"Admin access denied for {user_email!r}; expected {ADMIN_EMAIL!r}")
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _get_user_email(user) -> str:
    if isinstance(user, dict):
        return str(user.get("email") or "")
    return str(getattr(user, "email", "") or "")


def _get_user_id(user) -> str:
    if isinstance(user, dict):
        return str(user.get("id") or "")
    return str(getattr(user, "id", "") or "")


def _is_admin_email(email: str) -> bool:
    return email.strip().lower() == ADMIN_EMAIL.strip().lower()


def _get_user_metadata(user) -> dict:
    return (
        getattr(user, "user_metadata", None)
        or getattr(user, "raw_user_meta_data", None)
        or {}
    )


def _validate_uploaded_image(file: UploadFile, image_bytes: bytes):
    content_type = file.content_type or ""
    if content_type not in SUPPORTED_FORMATS:
        ext = os.path.splitext(file.filename or "")[1].lower()
        valid_extensions = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".tiff", ".tif", ".webp"}
        if ext not in valid_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported image format: {content_type}. Supported: JPG, PNG, HEIC, TIFF, WebP"
            )

    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
        )

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")


def _parse_json_form_field(value: str, fallback):
    if not value:
        return fallback
    try:
        parsed = json.loads(value)
        return parsed if parsed is not None else fallback
    except json.JSONDecodeError:
        return fallback


def _clean_dict(value: Optional[dict]) -> dict:
    if not isinstance(value, dict):
        return {}
    return {key: val for key, val in value.items() if val not in (None, "", [])}


def _clean_references(value: Optional[list]) -> list:
    if not isinstance(value, list):
        return []
    cleaned = []
    for item in value:
        if isinstance(item, str) and item.strip():
            cleaned.append({"label": "", "url": item.strip(), "notes": ""})
        elif isinstance(item, dict) and any(str(item.get(key, "")).strip() for key in ("label", "url", "notes")):
            cleaned.append({
                "label": str(item.get("label", "")).strip(),
                "url": str(item.get("url", "")).strip(),
                "notes": str(item.get("notes", "")).strip(),
            })
    return cleaned


def _submission_species_entry(data: dict) -> dict:
    ai = data.get("ai_analysis") or {}
    database_info = ai.get("database_info") or {}
    generated_details = ai.get("generated_details") or {}
    submitted_taxonomy = _clean_dict(data.get("submitted_taxonomy"))
    submitted_toxin = _clean_dict(data.get("submitted_toxin"))
    submitted_ecology = _clean_dict(data.get("submitted_ecology"))
    submitted_references = _clean_references(data.get("submitted_references"))
    submitted_morphology = (data.get("submitted_morphology") or "").strip()

    return {
        "genus": data["proposed_genus"],
        "common_species": [data["proposed_species"]] if data.get("proposed_species") else [],
        "taxonomy": submitted_taxonomy or database_info.get("taxonomy") or ai.get("taxonomy") or {},
        "toxin": submitted_toxin or database_info.get("toxin") or generated_details.get("toxin") or ai.get("toxin") or ai.get("toxin_risk") or {},
        "ecology": submitted_ecology or database_info.get("ecology") or generated_details.get("ecology") or ai.get("ecology") or {},
        "description": (
            database_info.get("description")
            or generated_details.get("description")
            or ai.get("description")
            or f"Community-contributed species. Submitted by {data.get('user_name', 'a community member')}."
        ),
        "morphology": submitted_morphology or database_info.get("morphology") or generated_details.get("morphology") or ai.get("morphology") or "",
        "reference_images": [data["image_url"]] if data.get("image_url") else [],
        "references": submitted_references,
    }


def _merge_unique(existing: list, incoming: list) -> list:
    merged = list(existing or [])
    for item in incoming or []:
        if item and item not in merged:
            merged.append(item)
    return merged


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _smtp_configured() -> bool:
    return all([
        os.environ.get("SMTP_HOST"),
        os.environ.get("SMTP_USERNAME"),
        os.environ.get("SMTP_PASSWORD"),
    ])


def _get_email_notifications_enabled() -> bool:
    from algae_database import get_supabase

    try:
        result = get_supabase().table("admin_settings").select("value").eq("key", "contribution_email_notifications").single().execute()
        if result.data and isinstance(result.data.get("value"), dict):
            return bool(result.data["value"].get("enabled", False))
    except Exception as e:
        print(f"Notification settings lookup failed; using env default: {e}")
    return _env_flag("CONTRIBUTION_EMAIL_NOTIFICATIONS", False)


def _set_email_notifications_enabled(enabled: bool):
    from algae_database import get_supabase

    payload = {
        "key": "contribution_email_notifications",
        "value": {"enabled": enabled},
        "updated_at": datetime.now().isoformat(),
    }
    try:
        get_supabase().table("admin_settings").upsert(payload).execute()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save notification setting. Run admin_settings.sql in Supabase first. {str(e)}"
        )


def _send_contribution_email(submission: dict):
    if not _get_email_notifications_enabled():
        return
    if not _smtp_configured():
        print("Contribution email notification skipped: SMTP settings are not configured")
        return

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    from_email = os.environ.get("SMTP_FROM_EMAIL") or os.environ.get("SMTP_USERNAME")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    use_tls = _env_flag("SMTP_USE_TLS", True)

    species_name = submission["proposed_genus"]
    if submission.get("proposed_species"):
        species_name += f" {submission['proposed_species']}"

    message = EmailMessage()
    message["Subject"] = f"New AlgaeAI contribution: {species_name}"
    message["From"] = from_email
    message["To"] = ADMIN_EMAIL
    message.set_content(
        "\n".join([
            "A new community species submission is waiting for review.",
            "",
            f"Species: {species_name}",
            f"Contributor: {submission.get('user_name') or submission.get('user_email') or 'Unknown'}",
            f"Location: {submission.get('location_found') or 'Not provided'}",
            f"Image: {submission.get('image_url') or 'Not available'}",
            "",
            "Notes:",
            submission.get("user_notes") or "None",
            "",
            f"Review it here: {frontend_url}/admin",
        ])
    )

    try:
        with smtplib.SMTP(os.environ["SMTP_HOST"], smtp_port, timeout=10) as server:
            if use_tls:
                server.starttls()
            server.login(os.environ["SMTP_USERNAME"], os.environ["SMTP_PASSWORD"])
            server.send_message(message)
    except Exception as e:
        print(f"Contribution email notification failed: {e}")


def _send_review_result_email(submission: dict, status: str, admin_notes: str = ""):
    if not _smtp_configured():
        print("Review result email skipped: SMTP settings are not configured")
        return

    recipient = (submission.get("user_email") or "").strip()
    if not recipient:
        print("Review result email skipped: submission has no contributor email")
        return

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    from_email = os.environ.get("SMTP_FROM_EMAIL") or os.environ.get("SMTP_USERNAME")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    use_tls = _env_flag("SMTP_USE_TLS", True)

    species_name = submission.get("proposed_genus") or "your algae submission"
    if submission.get("proposed_species"):
        species_name += f" {submission['proposed_species']}"

    readable_status = "approved" if status == "approved" else "rejected"
    subject_action = "approved" if status == "approved" else "reviewed"

    message = EmailMessage()
    message["Subject"] = f"Your AlgaeAI contribution was {subject_action}: {species_name}"
    message["From"] = from_email
    message["To"] = recipient
    message.set_content(
        "\n".join([
            f"Your AlgaeAI contribution has been {readable_status}.",
            "",
            f"Species: {species_name}",
            f"Status: {readable_status.title()}",
            "",
            "Reviewer notes:",
            admin_notes.strip() or "No additional notes were provided.",
            "",
            f"View your contribution history: {frontend_url}/dashboard",
        ])
    )

    try:
        with smtplib.SMTP(os.environ["SMTP_HOST"], smtp_port, timeout=10) as server:
            if use_tls:
                server.starttls()
            server.login(os.environ["SMTP_USERNAME"], os.environ["SMTP_PASSWORD"])
            server.send_message(message)
    except Exception as e:
        print(f"Review result email failed: {e}")


@app.post("/api/submit-species")
async def submit_species(
    file: UploadFile = File(...),
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
    current_user=Depends(get_current_user),
):
    """
    Submit a community species discovery for admin review.
    Runs AI analysis and stores submission in Supabase.
    """
    from algae_database import get_supabase

    user_id = _get_user_id(current_user)
    user_email = _get_user_email(current_user)
    metadata = _get_user_metadata(current_user)
    user_name = metadata.get("display_name") or metadata.get("full_name") or user_email

    proposed_genus = proposed_genus.strip()
    proposed_species = proposed_species.strip()
    location_found = location_found.strip()
    user_notes = user_notes.strip()
    if not proposed_genus:
        raise HTTPException(status_code=400, detail="Genus is required")

    # Read uploaded image
    image_bytes = await file.read()
    _validate_uploaded_image(file, image_bytes)

    # Run AI analysis on the submitted image
    ai_result = None
    try:
        ai_result = await identify_algae(image_bytes, file.filename or "submission.jpg")
    except Exception as e:
        print(f"AI analysis failed for submission: {e}")

    # Upload image to Supabase Storage
    image_url = None
    try:
        supabase = get_supabase()
        file_ext = (file.filename or "jpg").split(".")[-1]
        storage_path = f"submissions/{user_id}-{uuid.uuid4()}.{file_ext}"
        supabase.storage.from_("algae_images").upload(storage_path, image_bytes)
        image_url = supabase.storage.from_("algae_images").get_public_url(storage_path)
    except Exception as e:
        print(f"Image upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image")

    # Insert submission record
    try:
        supabase = get_supabase()
        submission = {
            "user_id": user_id,
            "user_email": user_email,
            "user_name": user_name or user_email,
            "proposed_genus": proposed_genus or (ai_result.get("primary_identification", {}).get("genus", "Unknown") if ai_result else "Unknown"),
            "proposed_species": proposed_species or (ai_result.get("primary_identification", {}).get("species", "") if ai_result else ""),
            "location_found": location_found,
            "user_notes": user_notes,
            "submitted_taxonomy": _clean_dict(_parse_json_form_field(submitted_taxonomy, {})),
            "submitted_toxin": _clean_dict(_parse_json_form_field(submitted_toxin, {})),
            "submitted_ecology": _clean_dict(_parse_json_form_field(submitted_ecology, {})),
            "submitted_references": _clean_references(_parse_json_form_field(submitted_references, [])),
            "submitted_morphology": submitted_morphology.strip(),
            "collection_date": collection_date.strip(),
            "sample_type": sample_type.strip(),
            "microscopy_method": microscopy_method.strip(),
            "contributor_confidence": contributor_confidence.strip(),
            "image_url": image_url,
            "ai_analysis": ai_result,
            "status": "pending",
        }
        result = supabase.table("species_submissions").insert(submission).execute()
        saved_submission = result.data[0]
        _send_contribution_email(saved_submission)
        return {"success": True, "submission_id": saved_submission["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save submission: {str(e)}")


@app.get("/api/admin/notification-settings")
async def get_notification_settings(admin_user=Depends(require_admin)):
    return {
        "enabled": _get_email_notifications_enabled(),
        "configured": _smtp_configured(),
        "recipient": ADMIN_EMAIL,
    }


@app.put("/api/admin/notification-settings")
async def update_notification_settings(
    request: NotificationSettingsRequest,
    admin_user=Depends(require_admin),
):
    _set_email_notifications_enabled(request.enabled)
    return {
        "enabled": request.enabled,
        "configured": _smtp_configured(),
        "recipient": ADMIN_EMAIL,
    }


@app.get("/api/admin/submissions")
async def get_submissions(status: str = "pending", admin_user=Depends(require_admin)):
    """Get all species submissions (admin only)."""
    from algae_database import get_supabase
    if status not in {"pending", "approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Invalid submission status")
    try:
        supabase = get_supabase()
        result = supabase.table("species_submissions").select("*").eq("status", status).order("created_at", desc=True).execute()
        return {"submissions": result.data, "total": len(result.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/admin/submissions/{submission_id}")
async def edit_submission(
    submission_id: str,
    request: AdminSubmissionEditRequest,
    admin_user=Depends(require_admin),
):
    """Edit user-submitted scientific fields before approving or rejecting."""
    from algae_database import get_supabase

    payload = request.dict(exclude_unset=True)
    if "proposed_genus" in payload:
        payload["proposed_genus"] = (payload["proposed_genus"] or "").strip()
        if not payload["proposed_genus"]:
            raise HTTPException(status_code=400, detail="Genus is required")

    for key in [
        "proposed_species",
        "location_found",
        "user_notes",
        "submitted_morphology",
        "collection_date",
        "sample_type",
        "microscopy_method",
        "contributor_confidence",
    ]:
        if key in payload and payload[key] is not None:
            payload[key] = str(payload[key]).strip()

    for key in ["submitted_taxonomy", "submitted_toxin", "submitted_ecology"]:
        if key in payload:
            payload[key] = _clean_dict(payload[key])

    if "submitted_references" in payload:
        payload["submitted_references"] = _clean_references(payload["submitted_references"])

    payload["updated_at"] = datetime.now().isoformat()
    try:
        supabase = get_supabase()
        result = supabase.table("species_submissions").update(payload).eq("id", submission_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Submission not found")
        return {"success": True, "submission": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/submissions/{submission_id}/approve")
async def approve_submission(
    submission_id: str,
    request: AdminActionRequest,
    admin_user=Depends(require_admin),
):
    """Approve a submission and add it to the algae_species database."""
    from algae_database import get_supabase
    try:
        supabase = get_supabase()
        # Fetch the submission
        sub = supabase.table("species_submissions").select("*").eq("id", submission_id).single().execute()
        if not sub.data:
            raise HTTPException(status_code=404, detail="Submission not found")
        data = sub.data

        # Add new genera, or append submitted species/images to an existing genus.
        species_entry = _submission_species_entry(data)
        existing = supabase.table("algae_species").select("*").ilike("genus", data["proposed_genus"]).limit(1).execute()
        if existing.data:
            existing_row = existing.data[0]
            update_payload = {
                "common_species": _merge_unique(existing_row.get("common_species") or [], species_entry["common_species"]),
                "reference_images": _merge_unique(existing_row.get("reference_images") or [], species_entry["reference_images"]),
                "references": _merge_unique(existing_row.get("references") or [], species_entry.get("references") or []),
                "updated_at": datetime.now().isoformat(),
            }
            supabase.table("algae_species").update(update_payload).eq("id", existing_row["id"]).execute()
        else:
            supabase.table("algae_species").insert(species_entry).execute()

        admin_notes = request.admin_notes.strip()

        # Mark submission as approved
        supabase.table("species_submissions").update({
            "status": "approved",
            "admin_notes": admin_notes,
            "reviewed_by": getattr(admin_user, "email", ADMIN_EMAIL),
            "reviewed_at": datetime.now().isoformat(),
        }).eq("id", submission_id).execute()

        _send_review_result_email(data, "approved", admin_notes)

        return {"success": True, "message": f"Approved and added {data['proposed_genus']} to the database"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/submissions/{submission_id}/reject")
async def reject_submission(
    submission_id: str,
    request: AdminActionRequest,
    admin_user=Depends(require_admin),
):
    """Reject a submission with optional feedback."""
    from algae_database import get_supabase
    try:
        supabase = get_supabase()
        sub = supabase.table("species_submissions").select("*").eq("id", submission_id).single().execute()
        if not sub.data:
            raise HTTPException(status_code=404, detail="Submission not found")

        admin_notes = request.admin_notes.strip()
        supabase.table("species_submissions").update({
            "status": "rejected",
            "admin_notes": admin_notes,
            "reviewed_by": getattr(admin_user, "email", ADMIN_EMAIL),
            "reviewed_at": datetime.now().isoformat(),
        }).eq("id", submission_id).execute()

        _send_review_result_email(sub.data, "rejected", admin_notes)

        return {"success": True, "message": "Submission rejected"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
