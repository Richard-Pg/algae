"""The open species library: reviewed and compiled records."""

from typing import Optional

from fastapi import APIRouter, HTTPException

from algae_database import get_curated_species, list_curated_species
from app.db import get_supabase

router = APIRouter(prefix="/api/species", tags=["species"])

GROUPS = {
    "cyanobacteria": "Cyanobacteria",
    "diatoms": "Diatoms",
    "green-algae": "Green algae",
    "dinoflagellates": "Dinoflagellates",
    "other": "Other algae",
}


def group_of(taxonomy: Optional[dict]) -> str:
    t = {k: str(v or "").lower() for k, v in (taxonomy or {}).items()}
    phylum, klass = t.get("phylum", ""), t.get("class", "")
    if "cyanobacteri" in phylum or "cyanophyceae" in klass:
        return "cyanobacteria"
    if "bacillariophy" in phylum or "bacillariophy" in klass or "coscinodiscophyceae" in klass or "mediophyceae" in klass:
        return "diatoms"
    if "chlorophyta" in phylum or "charophyta" in phylum or "chlorophyceae" in klass:
        return "green-algae"
    if "dinoflagell" in phylum or "myzozoa" in phylum or "dinophyceae" in klass:
        return "dinoflagellates"
    return "other"


def thumbnail_of(row: dict) -> Optional[str]:
    images = row.get("reference_images") or []
    if images:
        return images[0]
    for credit in row.get("image_credits") or []:
        url = (credit or {}).get("thumb") or (credit or {}).get("url")
        if url:
            return url
    return None


def _summary(row: dict) -> dict:
    toxin = row.get("toxin") or {}
    return {
        "genus": row.get("genus"),
        "group": group_of(row.get("taxonomy")),
        "phylum": (row.get("taxonomy") or {}).get("phylum"),
        "family": (row.get("taxonomy") or {}).get("family"),
        "risk_level": toxin.get("risk_level") or "Unknown",
        "produces_toxin": bool(toxin.get("produces_toxin")),
        "water_type": (row.get("ecology") or {}).get("water_type"),
        "species_count": len(row.get("common_species") or []),
        "thumbnail": thumbnail_of(row),
        "description": (row.get("description") or "")[:220],
        "updated_at": row.get("updated_at"),
        "review_status": row.get("review_status") or "reviewed",
    }


@router.get("")
def list_species(q: str = "", group: str = "", harmful: bool = False):
    rows = list_curated_species()
    items = [_summary(r) for r in rows]
    needle = q.strip().lower()
    if needle:
        items = [
            i for i in items
            if needle in (i["genus"] or "").lower()
            or needle in (i["description"] or "").lower()
            or needle in (i["family"] or "").lower()
        ]
    if group:
        items = [i for i in items if i["group"] == group]
    if harmful:
        items = [i for i in items if i["produces_toxin"]]
    counts = {key: 0 for key in GROUPS}
    for row in rows:
        counts[group_of(row.get("taxonomy"))] += 1
    return {
        "items": items,
        "total": len(items),
        "groups": [{"id": k, "label": v, "count": counts[k]} for k, v in GROUPS.items()],
    }


@router.get("/{genus}")
def get_species(genus: str):
    row = get_curated_species(genus)
    if not row:
        raise HTTPException(status_code=404, detail=f"{genus} is not in the curated library yet.")
    try:
        contributions = (
            get_supabase().table("species_submissions")
            .select("id, user_name, created_at, reviewed_at, location_found, proposed_species, published_image_url")
            .eq("status", "approved")
            .ilike("proposed_genus", row["genus"])
            .order("reviewed_at", desc=True)
            .limit(24)
            .execute()
        ).data or []
    except Exception:
        contributions = []
    return {**row, "group": group_of(row.get("taxonomy")), "contributions": contributions}
