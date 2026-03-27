"""
Algae Species Database & Dynamic Knowledge Engine
Fetches curated data from Supabase, or falls back to GBIF API for unknown species.
"""

from typing import Optional, List, Dict, Any
import os
import httpx
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables explicitly
load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")

# Cache the client
_supabase: Optional[Client] = None

def get_supabase() -> Client:
    global _supabase
    if not _supabase:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError(f"Missing Supabase credentials. URL: {'Set' if SUPABASE_URL else 'Missing'}, KEY: {'Set' if SUPABASE_KEY else 'Missing'}")
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase

def get_curated_species(genus_name: str) -> Optional[Dict[str, Any]]:
    """Look up curated species information from Supabase by genus name."""
    try:
        supabase = get_supabase()
        # Case-insensitive search using ilike
        response = supabase.table("algae_species").select("*").ilike("genus", genus_name).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        print(f"Error querying Supabase for {genus_name}: {str(e)}")
        return None

def fetch_gbif_taxonomy(genus_name: str, generated_details: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
    """
    Fallback method: Query the Global Biodiversity Information Facility (GBIF) API
    to get real-time taxonomy for an unknown species.
    If generated_details (from Gemini) are provided, merge them in as preliminary estimates.
    """
    try:
        # We use httpx for synchronous fallback, or we could use async if we refactored
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"https://api.gbif.org/v1/species/match?name={genus_name}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if confident match (usually 90+)
                if data.get("matchType") in ["EXACT", "FUZZY", "HIGHERRANK"] and data.get("confidence", 0) > 80:
                    
                    details = generated_details or {}
                    
                    return {
                        "genus": data.get("genus", genus_name),
                        "common_species": [],
                        "is_fallback": True, # Flag indicating this is not from our curated DB
                        "taxonomy": {
                            "kingdom": data.get("kingdom", "Unknown"),
                            "phylum": data.get("phylum", "Unknown"),
                            "class": data.get("class", "Unknown"),
                            "order": data.get("order", "Unknown"),
                            "family": data.get("family", "Unknown"),
                            "genus": data.get("genus", genus_name)
                        },
                        "toxin": {
                            "produces_toxin": details.get("toxin", {}).get("produces_toxin", False),
                            "toxin_type": details.get("toxin", {}).get("toxin_type", "Unknown"),
                            "risk_level": details.get("toxin", {}).get("risk_level", "Unknown"),
                            "health_effects": details.get("toxin", {}).get("health_effects", "This is an AI-generated estimation based on general morphological characteristics."),
                            "is_ai_generated": True
                        },
                        "ecology": {
                            **details.get("ecology", {}),
                            "is_ai_generated": True
                        },
                        "description": details.get("description", "Scientific classification dynamically retrieved from GBIF. Ecological details estimated by AI.") + "\n\n(Note: Ecology and Toxicity are AI-generated preliminary estimates. Verify with authoritative sources.)",
                        "morphology": details.get("morphology", "Unknown"),
                        "reference_images": []
                    }
        return None
    except Exception as e:
        print(f"Error querying GBIF for {genus_name}: {str(e)}")
        return None

def get_species_info(genus_name: str, generated_details: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
    """
    Primary lookup function.
    1. Try to get rich, curated data from Supabase.
    2. If not found, dynamically fetch taxonomy from GBIF and merge with AI predictions.
    """
    # 1. Try Curated Database
    curated_data = get_curated_species(genus_name)
    if curated_data:
        return curated_data
        
    print(f"Genus '{genus_name}' not in curated DB. Falling back to GBIF API...")
    
    # 2. Try GBIF API Fallback
    gbif_data = fetch_gbif_taxonomy(genus_name, generated_details)
    if gbif_data:
        print(f"GBIF Fallback successful for {genus_name}.")
        return gbif_data
        
    return None

def get_all_genera() -> List[str]:
    """Return list of all curated genera in the database."""
    try:
        supabase = get_supabase()
        response = supabase.table("algae_species").select("genus").execute()
        if response.data:
            return [item["genus"] for item in response.data]
        return []
    except Exception as e:
        print(f"Error fetching genera: {str(e)}")
        return []

def search_species(query: str) -> List[dict]:
    """Search for curated species matching a query string."""
    try:
        supabase = get_supabase()
        # Search genus or description for the query
        response = supabase.table("algae_species") \
            .select("*") \
            .or_(f"genus.ilike.%{query}%,description.ilike.%{query}%") \
            .execute()
            
        if response.data:
            return response.data
        return []
    except Exception as e:
        print(f"Error searching species: {str(e)}")
        return []
