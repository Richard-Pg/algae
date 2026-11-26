"""
Algae species knowledge: the curated Supabase table first, GBIF as fallback.

GBIF calls are async and cached. Matching prefers kingdoms that contain algae,
because several genus names are shared with animals (e.g. Microcystis is
also a land-snail genus).
"""

import logging
import time
from typing import Any, Dict, List, Optional

import httpx
from starlette.concurrency import run_in_threadpool

from app.db import get_supabase  # re-exported for older scripts

log = logging.getLogger(__name__)

ALGAL_KINGDOMS = {"bacteria", "chromista", "plantae", "protozoa"}
GBIF_API = "https://api.gbif.org/v1"
_CACHE_TTL = 24 * 60 * 60
_gbif_cache: Dict[str, tuple[float, Optional[dict]]] = {}

__all__ = [
    "get_supabase",
    "get_curated_species",
    "get_species_info",
    "match_gbif",
    "list_curated_species",
]


def get_curated_species(genus_name: str) -> Optional[Dict[str, Any]]:
    """Case-insensitive exact lookup in the curated table."""
    if not genus_name:
        return None
    try:
        response = (
            get_supabase()
            .table("algae_species")
            .select("*")
            .ilike("genus", genus_name.strip())
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None
    except Exception as exc:
        log.warning("Curated lookup failed for %s: %s", genus_name, exc)
        return None


def list_curated_species() -> List[Dict[str, Any]]:
    response = get_supabase().table("algae_species").select("*").order("genus").execute()
    return response.data or []


def _pick_algal_match(data: dict) -> Optional[dict]:
    candidates = []
    if data.get("usageKey"):
        candidates.append(data)
    candidates.extend(data.get("alternatives") or [])
    usable = [
        c for c in candidates
        if c.get("usageKey") and c.get("matchType") != "NONE" and c.get("confidence", 0) >= 80
    ]
    for candidate in usable:
        if str(candidate.get("kingdom", "")).lower() in ALGAL_KINGDOMS:
            return candidate
    return None


async def match_gbif(genus_name: str) -> Optional[dict]:
    """Match a genus against the GBIF backbone, preferring algal kingdoms.

    Returns a dict with taxonomy and the GBIF key, or None. Cached for a day.
    """
    key = (genus_name or "").strip().lower()
    if not key or key == "unknown":
        return None
    cached = _gbif_cache.get(key)
    if cached and time.time() - cached[0] < _CACHE_TTL:
        return cached[1]

    result = None
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            response = await client.get(
                f"{GBIF_API}/species/match",
                params={"name": genus_name, "rank": "GENUS", "verbose": "true"},
            )
        if response.status_code == 200:
            match = _pick_algal_match(response.json())
            if match:
                result = {
                    "gbif_key": match.get("genusKey") or match.get("usageKey"),
                    "scientific_name": match.get("scientificName"),
                    "taxonomy": {
                        "kingdom": match.get("kingdom"),
                        "phylum": match.get("phylum"),
                        "class": match.get("class"),
                        "order": match.get("order"),
                        "family": match.get("family"),
                        "genus": match.get("genus") or genus_name,
                    },
                }
    except Exception as exc:
        log.warning("GBIF match failed for %s: %s", genus_name, exc)
        return None  # do not cache transient failures

    _gbif_cache[key] = (time.time(), result)
    return result


def _fallback_from_gbif(genus_name: str, gbif: dict, generated: Dict[str, Any]) -> Dict[str, Any]:
    details = generated or {}
    toxin = details.get("toxin") or {}
    return {
        "genus": gbif["taxonomy"].get("genus") or genus_name,
        "common_species": [],
        "is_fallback": True,
        "source": "gbif+ai",
        "taxonomy": {k: v for k, v in gbif["taxonomy"].items() if v},
        "toxin": {
            "produces_toxin": toxin.get("produces_toxin", False),
            "toxin_type": toxin.get("toxin_type") or "Unknown",
            "risk_level": toxin.get("risk_level") or "Unknown",
            "health_effects": toxin.get("health_effects") or "",
            "is_ai_generated": True,
        },
        "ecology": {**(details.get("ecology") or {}), "is_ai_generated": True},
        "description": details.get("description") or "",
        "morphology": details.get("morphology") or "",
        "reference_images": [],
        "references": [],
    }


async def get_species_info(
    genus_name: str, generated_details: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    """Curated record (with its GBIF key) or a GBIF + AI fallback record."""
    curated = await run_in_threadpool(get_curated_species, genus_name)
    gbif = await match_gbif(genus_name)
    if curated:
        info = dict(curated)
        # Records compiled from the literature but not yet expert-reviewed say so.
        info["source"] = "compiled" if curated.get("review_status") == "draft" else "curated"
        info["is_fallback"] = False
        if gbif:
            info["gbif_key"] = gbif["gbif_key"]
            info["gbif_name"] = gbif["scientific_name"]
        return info
    if gbif:
        info = _fallback_from_gbif(genus_name, gbif, generated_details or {})
        info["gbif_key"] = gbif["gbif_key"]
        info["gbif_name"] = gbif["scientific_name"]
        return info
    return None
