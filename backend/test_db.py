import os
from dotenv import load_dotenv

# Try to load normally first
load_dotenv()
url = os.environ.get("SUPABASE_URL")
if url and url.startswith("'"):
    print("Found single quotes in URL! Fixing .env...")
    # Strip quotes
    with open(".env", "r") as f:
        content = f.read()
    content = content.replace("'", "")
    with open(".env", "w") as f:
        f.write(content)
    
    # Reload
    load_dotenv(override=True)

from algae_database import get_species_info, get_all_genera, fetch_gbif_taxonomy
import json

print("\n--- Testing Supabase Lookup (Microcystis) ---")
info = get_species_info("Microcystis")
if info:
    print(f"Found! Toxin: {info.get('toxin', {}).get('produces_toxin')}")
else:
    print("Not found in Supabase.")

print("\n--- Testing GBIF Fallback (Spirogyra) ---")
spiro = get_species_info("Spirogyra")
if spiro:
    print(f"Found! Kingdom: {spiro.get('taxonomy', {}).get('kingdom')}")
else:
    print("Not found in GBIF.")
