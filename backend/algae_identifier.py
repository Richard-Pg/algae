"""
Algae Identifier using Google Gemini Vision API
Sends images to Gemini for analysis and returns structured algae identification results.
"""

import json
import os
import google.generativeai as genai
from PIL import Image
import io
from algae_database import get_species_info


def configure_gemini():
    """Configure the Gemini API with the API key."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError(
            "GEMINI_API_KEY not set. Get a free key at https://aistudio.google.com/app/apikey"
        )
    genai.configure(api_key=api_key)


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


async def identify_algae(image_bytes: bytes, filename: str = "image.jpg") -> dict:
    """
    Identify algae from image bytes using Gemini Vision API.
    Returns structured identification results enriched with database info.
    """
    configure_gemini()

    # Prepare image for Gemini
    image = Image.open(io.BytesIO(image_bytes))

    # Convert to RGB if needed (handles RGBA, etc.)
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    # Use Gemini 3.1 Flash-Lite for fast, cost-effective testing
    model = genai.GenerativeModel("gemini-3.1-flash-lite-preview")

    response = model.generate_content(
        [IDENTIFICATION_PROMPT, image],
        generation_config=genai.types.GenerationConfig(
            temperature=0.1,
            max_output_tokens=4096,
            response_mime_type="application/json",
        ),
    )

    # Parse response
    try:
        response_text = response.text.strip()
        result = json.loads(response_text)
    except (json.JSONDecodeError, ValueError) as e:
        # Fallback for very rare cases where it might still include fences despite mime_type
        cleaned_text = response.text.strip()
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text[7:-3].strip()
        elif cleaned_text.startswith("```"):
            cleaned_text = cleaned_text[3:-3].strip()
        
        try:
            result = json.loads(cleaned_text)
        except (json.JSONDecodeError, ValueError) as e2:
            result = {
                "identified": False,
                "error_message": f"Failed to parse AI response: {str(e2)}",
                "raw_response": response.text[:10000],  # Increased limit for better debugging
                "image_quality": "unknown",
                "image_type": "unknown",
            }

    # Enrich with database info if identified
    if result.get("identified"):
        genus = result.get("primary_identification", {}).get("genus", "")
        generated_details = result.get("generated_details", {})
        db_info = get_species_info(genus, generated_details)
        if db_info:
            result["database_info"] = {
                "taxonomy": db_info["taxonomy"],
                "toxin": db_info["toxin"],
                "ecology": db_info["ecology"],
                "description": db_info["description"],
                "morphology": db_info["morphology"],
                "common_species": db_info["common_species"],
                "reference_images": db_info["reference_images"],
            }
        else:
            result["database_info"] = None

    return result
