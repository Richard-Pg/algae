"""Cleaning helpers for contributed scientific fields."""

import json
from typing import Any, Optional

TEXT_FIELDS = [
    "proposed_species",
    "location_found",
    "user_notes",
    "submitted_morphology",
    "collection_date",
    "sample_type",
    "microscopy_method",
    "contributor_confidence",
]
DICT_FIELDS = ["submitted_taxonomy", "submitted_toxin", "submitted_ecology"]


def parse_json(value: Optional[str], fallback):
    if not value:
        return fallback
    try:
        parsed = json.loads(value)
        return parsed if parsed is not None else fallback
    except json.JSONDecodeError:
        return fallback


def clean_dict(value: Any) -> dict:
    if not isinstance(value, dict):
        return {}
    return {k: v.strip() if isinstance(v, str) else v for k, v in value.items() if v not in (None, "", [])}


def clean_references(value: Any) -> list:
    if not isinstance(value, list):
        return []
    cleaned = []
    for item in value:
        if isinstance(item, str) and item.strip():
            cleaned.append({"label": "", "url": item.strip(), "notes": ""})
        elif isinstance(item, dict) and any(str(item.get(k, "")).strip() for k in ("label", "url", "notes")):
            cleaned.append({k: str(item.get(k, "")).strip() for k in ("label", "url", "notes")})
    return cleaned


def clean_payload(payload: dict) -> dict:
    """Normalise an edit payload in place-safe fashion (only keys present)."""
    out = {}
    if "proposed_genus" in payload:
        out["proposed_genus"] = (payload["proposed_genus"] or "").strip()
    for key in TEXT_FIELDS:
        if key in payload:
            out[key] = str(payload[key] or "").strip()
    for key in DICT_FIELDS:
        if key in payload:
            out[key] = clean_dict(payload[key])
    if "submitted_references" in payload:
        out["submitted_references"] = clean_references(payload["submitted_references"])
    return out


def merge_unique(existing: list, incoming: list) -> list:
    merged = list(existing or [])
    for item in incoming or []:
        if item and item not in merged:
            merged.append(item)
    return merged


def species_entry(data: dict, public_image_url: Optional[str]) -> dict:
    """Build an algae_species row from an approved submission.

    Contributor-supplied fields win; AI and existing database details only
    fill gaps.
    """
    ai = data.get("ai_analysis") or {}
    db = ai.get("database_info") or {}
    generated = ai.get("generated_details") or {}
    return {
        "genus": data["proposed_genus"],
        "common_species": [data["proposed_species"]] if data.get("proposed_species") else [],
        "taxonomy": clean_dict(data.get("submitted_taxonomy")) or db.get("taxonomy") or {},
        "toxin": clean_dict(data.get("submitted_toxin")) or db.get("toxin") or generated.get("toxin") or {},
        "ecology": clean_dict(data.get("submitted_ecology")) or db.get("ecology") or generated.get("ecology") or {},
        "description": db.get("description") or generated.get("description")
        or f"Community-contributed record. First submitted by {data.get('user_name') or 'a community member'}.",
        "morphology": (data.get("submitted_morphology") or "").strip() or db.get("morphology") or generated.get("morphology") or "",
        "reference_images": [public_image_url] if public_image_url else [],
        "references": clean_references(data.get("submitted_references")),
    }
