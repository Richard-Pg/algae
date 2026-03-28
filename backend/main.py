"""
FastAPI Backend for AI Algae Identification System
Provides endpoints for image upload/identification, species lookup, and history.
"""

import os
import uuid
from datetime import datetime
from typing import Optional, List

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from algae_identifier import identify_algae
from algae_database import get_species_info, get_all_genera

# Load environment variables
load_dotenv()

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
        "https://*.vercel.app",
        "*",  # Temporarily allow all during initial deployment
    ],
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

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "haiming.peng@outlook.com")


@app.post("/api/submit-species")
async def submit_species(
    file: UploadFile = File(...),
    proposed_genus: str = "",
    proposed_species: str = "",
    location_found: str = "",
    user_notes: str = "",
    user_id: str = "",
    user_email: str = "",
    user_name: str = "",
):
    """
    Submit a community species discovery for admin review.
    Runs AI analysis and stores submission in Supabase.
    """
    from algae_database import get_supabase

    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required to submit")

    # Read uploaded image
    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

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
            "image_url": image_url,
            "ai_analysis": ai_result,
            "status": "pending",
        }
        result = supabase.table("species_submissions").insert(submission).execute()
        return {"success": True, "submission_id": result.data[0]["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save submission: {str(e)}")


@app.get("/api/admin/submissions")
async def get_submissions(status: str = "pending", admin_email: str = ""):
    """Get all species submissions (admin only)."""
    from algae_database import get_supabase
    if admin_email != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        supabase = get_supabase()
        result = supabase.table("species_submissions").select("*").eq("status", status).order("created_at", desc=True).execute()
        return {"submissions": result.data, "total": len(result.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/submissions/{submission_id}/approve")
async def approve_submission(submission_id: str, admin_email: str = "", admin_notes: str = ""):
    """Approve a submission and add it to the algae_species database."""
    from algae_database import get_supabase
    if admin_email != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        supabase = get_supabase()
        # Fetch the submission
        sub = supabase.table("species_submissions").select("*").eq("id", submission_id).single().execute()
        if not sub.data:
            raise HTTPException(status_code=404, detail="Submission not found")
        data = sub.data
        ai = data.get("ai_analysis") or {}

        # Write to algae_species table (will skip if genus already exists)
        species_entry = {
            "genus": data["proposed_genus"],
            "common_species": [data["proposed_species"]] if data.get("proposed_species") else [],
            "taxonomy": ai.get("taxonomy", {}),
            "toxin": ai.get("toxin_risk", {}),
            "ecology": ai.get("ecology", {}),
            "description": ai.get("description", f"Community-contributed species. Submitted by {data.get('user_name', 'a community member')}."),
            "morphology": ai.get("morphology", ""),
            "reference_images": [data["image_url"]] if data.get("image_url") else [],
        }
        try:
            supabase.table("algae_species").insert(species_entry).execute()
        except Exception:
            pass  # Species may already exist — that's OK

        # Mark submission as approved
        supabase.table("species_submissions").update({
            "status": "approved",
            "admin_notes": admin_notes,
            "reviewed_by": admin_email,
            "reviewed_at": datetime.now().isoformat(),
        }).eq("id", submission_id).execute()

        return {"success": True, "message": f"Approved and added {data['proposed_genus']} to the database"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/submissions/{submission_id}/reject")
async def reject_submission(submission_id: str, admin_email: str = "", admin_notes: str = ""):
    """Reject a submission with optional feedback."""
    from algae_database import get_supabase
    if admin_email != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        supabase = get_supabase()
        supabase.table("species_submissions").update({
            "status": "rejected",
            "admin_notes": admin_notes,
            "reviewed_by": admin_email,
            "reviewed_at": datetime.now().isoformat(),
        }).eq("id", submission_id).execute()
        return {"success": True, "message": "Submission rejected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
