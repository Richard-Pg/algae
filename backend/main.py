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
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
