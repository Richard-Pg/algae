"""
Algae Identifier using Google Gemini Vision API
Sends images to Gemini for analysis and returns structured algae identification results.
"""

import io
import json
import os
import time

from google import genai
from google.genai import types
from PIL import Image

from algae_database import get_species_info


DEFAULT_GEMINI_MODEL = "gemini-4-hydrogen"


def get_gemini_model_name() -> str:
    return os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL


THINKING_LEVELS = {"minimal", "low", "medium", "high"}


def get_thinking_level() -> str | None:
    """GEMINI_THINKING_LEVEL: minimal, low, medium or high. Unset uses the model default."""
    level = os.getenv("GEMINI_THINKING_LEVEL", "").strip().lower()
    return level if level in THINKING_LEVELS else None


def create_gemini_client() -> genai.Client:
    """Create a Gemini client from the configured API key."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError(
            "GEMINI_API_KEY not set. Get a free key at https://aistudio.google.com/app/apikey"
        )
    return genai.Client(api_key=api_key)


IDENTIFICATION_PROMPT = """You are a highly distinguished phycologist and taxonomist with decades of experience in microscopic algae and diatom identification. 

Your objective is to perform a rigorous morphological analysis of the provided image and identify the algae or diatom to the lowest possible taxonomic level (Genus or Species).

### GUIDELINES FOR SCIENTIFIC RIGOR:
1. **Remove Bias**: DO NOT restrict your search to common genera. Consider the entire global biodiversity of Cyanobacteria, Chlorophyta, Bacillariophyta (Diatoms), and other relevant phyla.
2. **Deep Morphological Analysis**: Analyze beyond simple outlines. Focus on:
   - **Cell Shape & Symmetry**: Is it boat-shaped (naviculoid), spindle-shaped (fusiform), or branched?
   - **Internal Structure**: Observe chloroplast position, presence of pyrenoids, vacuoles, or toxic pseudo-vacuoles.
   - **Valve Features (for Diatoms)**: Look for raphe visibility, striae patterns, and apex sharping.
3. **Expert Diagnostic Key**: Use the following diagnostic hints for common look-alikes to cross-check your primary ID:
   - **Fusiform/Naviculoid Look-alikes**: 
     - *Navicula*: Usually larger, distinct siliceous valves, central raphe, distinct transverse striae.
     - *Phaeodactylum tricornutum*: Variable morphotypes (fusiform, triradiate, oval). Fusiform morphotype is thinner, less silicified (striae often invisible), chloroplasts often off-center or single/bi-lobed.
     - *Nitzschia*: Often very thin, linear, with characteristic keeled raphe and fibulae.
   - **Small Coccoid Look-alikes**: Contrast *Chlorella* (single cells, cup-shaped chloroplast) vs *Microcystis* (often in mucilaginous colonies, gas vesicles/pseudo-vacuoles).
4. **Confidence Scoring**: Be intellectually honest. A high confidence (0.8+) must be supported by visible characteristic features beyond just general shape.

You MUST respond with ONLY a valid JSON object in this exact format:
{
    "identified": true,
    "primary_identification": {
        "genus": "GenusName",
        "species": "Full species name or 'spp.' if uncertain",
        "confidence": 0.87,
        "morphological_notes": "Detailed scientific description of key features that led to this ID"
    },
    "alternative_identifications": [
        {
            "genus": "AltGenus1",
            "species": "Alt species name",
            "confidence": 0.09,
            "reason_for_exclusion": "Why this was passed over for the primary ID"
        }
    ],
    "image_quality": "good|moderate|poor",
    "image_type": "microscope|bloom|surface_water|field_sample|unknown",
    "is_harmful": true,
    "hab_alert": "Description of potential harmful algal bloom risk, or null if not harmful",
    "analysis_notes": "Internal expert reasoning (e.g., Comparison of candidate X vs Y)",
    "trivia": {
        "discovery_history": "Brief history of how this genus/species was first discovered or classified",
        "fun_fact": "An interesting, engaging story or fun fact about it",
        "references": ["Scientific reference 1", "Scientific reference 2"]
    },
    "generated_details": {
        "toxin": {
            "produces_toxin": false,
            "toxin_type": "None or specific toxin",
            "risk_level": "Low/Medium/High/None",
            "health_effects": "Brief description"
        },
        "ecology": {
            "habitat": "Typical habitat",
            "bloom_conditions": "When it typically blooms",
            "temperature_range": "e.g., 10-25C",
            "water_type": "Freshwater/Marine",
            "indicator_of": "What its presence indicates"
        },
        "description": "General scientific description",
        "morphology": "Morphological details"
    }
}

If the image does not appear to contain algae or is unrecognizable:
{
    "identified": false,
    "error_message": "Scientific description of what was seen instead",
    "image_quality": "good|moderate|poor",
    "image_type": "unknown",
    "suggestions": "Expert advice for better sample preparation or capture"
}
### RESPONSE CONSTRAINTS:
- Answer ONLY in a single JSON object.
- Keep all text descriptions (notes, analysis, trivia) extremely concise (under 40 words per field).
- Ensure the JSON is complete and valid.
"""


def _as_fraction(value) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    if number > 1:  # the model occasionally answers in percent
        number = number / 100
    return max(0.0, min(1.0, number))


def normalize_result(result: dict) -> dict:
    """Make the model output safe for the UI: numeric confidences, lists, sorted alternatives."""
    if not isinstance(result, dict):
        return {"identified": False, "error_message": "Unexpected AI response."}
    if result.get("identified"):
        primary = result.get("primary_identification") or {}
        primary["confidence"] = _as_fraction(primary.get("confidence"))
        result["primary_identification"] = primary
        alternatives = [a for a in (result.get("alternative_identifications") or []) if isinstance(a, dict)]
        for alt in alternatives:
            alt["confidence"] = _as_fraction(alt.get("confidence"))
        alternatives.sort(key=lambda a: a["confidence"], reverse=True)
        result["alternative_identifications"] = alternatives
        trivia = result.get("trivia") or {}
        if not isinstance(trivia.get("references"), list):
            trivia["references"] = []
        result["trivia"] = trivia
    return result


def _database_view(db_info: dict) -> dict:
    keys = [
        "taxonomy", "toxin", "ecology", "description", "morphology",
        "common_species", "reference_images", "references",
        "source", "is_fallback", "gbif_key", "gbif_name",
    ]
    return {key: db_info.get(key) for key in keys if key in db_info}


async def identify_algae(image_bytes: bytes, filename: str = "image.jpg", normalized: bool = False) -> dict:
    """
    Identify algae from image bytes using the Gemini vision model.
    Returns structured identification results enriched with database info.
    Pass normalized=True when image_bytes is already the PNG from app.images.
    """
    if normalized:
        png_bytes = image_bytes
    else:
        with Image.open(io.BytesIO(image_bytes)) as source_image:
            if source_image.mode not in ("RGB", "L"):
                source_image = source_image.convert("RGB")
            buffer = io.BytesIO()
            source_image.save(buffer, format="PNG")
            png_bytes = buffer.getvalue()

    image_part = types.Part.from_bytes(data=png_bytes, mime_type="image/png")

    # Only supported options are set; sampling controls are ignored by this model family.
    model_name = get_gemini_model_name()
    thinking_level = get_thinking_level()
    config_args = {"max_output_tokens": 4096, "response_mime_type": "application/json"}
    if thinking_level:
        config_args["thinking_config"] = types.ThinkingConfig(thinking_level=thinking_level.upper())
    started = time.perf_counter()
    async with create_gemini_client().aio as client:
        response = await client.models.generate_content(
            model=model_name,
            contents=[IDENTIFICATION_PROMPT, image_part],
            config=types.GenerateContentConfig(**config_args),
        )
    latency_ms = round((time.perf_counter() - started) * 1000)

    text = (response.text or "").strip()
    try:
        result = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        cleaned = text
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        try:
            result = json.loads(cleaned)
        except (json.JSONDecodeError, ValueError) as exc:
            result = {
                "identified": False,
                "error_message": f"The AI response could not be read ({exc}). Please try again.",
                "image_quality": "unknown",
                "image_type": "unknown",
            }

    result = normalize_result(result)

    if result.get("identified"):
        genus = (result.get("primary_identification") or {}).get("genus", "")
        db_info = await get_species_info(genus, result.get("generated_details") or {})
        result["database_info"] = _database_view(db_info) if db_info else None

    result["ai_model"] = model_name
    result["ai_thinking_level"] = thinking_level or "default"
    result["ai_latency_ms"] = latency_ms
    result["ai_provider"] = "google_gemini"
    return result
