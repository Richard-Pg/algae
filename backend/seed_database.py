import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

ALGAE_DATABASE = {
    # ==========================================
    # CYANOBACTERIA
    # ==========================================
    "Microcystis": {
        "genus": "Microcystis",
        "common_species": ["Microcystis aeruginosa", "Microcystis flos-aquae", "Microcystis wesenbergii"],
        "taxonomy": {
            "kingdom": "Bacteria",
            "phylum": "Cyanobacteria",
            "class": "Cyanophyceae",
            "order": "Chroococcales",
            "family": "Microcystaceae",
            "genus": "Microcystis"
        },
        "toxin": {
            "produces_toxin": True,
            "toxin_type": "Microcystin (hepatotoxin)",
            "risk_level": "High",
            "health_effects": "Liver damage, skin irritation, gastrointestinal issues. Can be lethal to animals."
        },
        "ecology": {
            "habitat": "Freshwater lakes, reservoirs, slow-moving rivers",
            "bloom_conditions": "Temperature: 20–30°C, High phosphorus concentration, Eutrophic water bodies",
            "temperature_range": "20–30°C",
            "nutrient_preference": "High phosphorus and nitrogen",
            "water_type": "Eutrophic freshwater",
            "seasonal_pattern": "Summer to early autumn blooms",
            "indicator_of": "Eutrophication, nutrient pollution"
        },
        "description": "Microcystis is one of the most common and problematic cyanobacterial genera worldwide. It forms dense, blue-green surface scums in eutrophic freshwater bodies. Microcystis aeruginosa is a major producer of microcystins, potent hepatotoxins that pose serious risks to drinking water safety and aquatic ecosystems.",
        "morphology": "Colonial, irregularly shaped colonies with gas vesicles. Cells are spherical, 3–7 μm in diameter, arranged in a mucilaginous matrix.",
        "reference_images": [
            "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Microcystis_aeruginosa.jpg/800px-Microcystis_aeruginosa.jpg"
        ]
    },
    "Dolichospermum": {
        "genus": "Dolichospermum",
        "common_species": ["Dolichospermum flos-aquae", "Dolichospermum circinale", "Dolichospermum spiroides"],
        "taxonomy": {
            "kingdom": "Bacteria",
            "phylum": "Cyanobacteria",
            "class": "Cyanophyceae",
            "order": "Nostocales",
            "family": "Nostocaceae",
            "genus": "Dolichospermum"
        },
        "toxin": {
            "produces_toxin": True,
            "toxin_type": "Anatoxin-a, Microcystin, Saxitoxin",
            "risk_level": "High",
            "health_effects": "Neurotoxicity, liver damage, respiratory paralysis in severe cases."
        },
        "ecology": {
            "habitat": "Freshwater lakes, ponds, reservoirs",
            "bloom_conditions": "Temperature: 18–25°C, Calm waters with thermal stratification",
            "temperature_range": "18–25°C",
            "nutrient_preference": "Nitrogen-fixing; thrives in low-nitrogen, high-phosphorus conditions",
            "water_type": "Mesotrophic to eutrophic freshwater",
            "seasonal_pattern": "Late spring to summer",
            "indicator_of": "Nutrient imbalance, particularly phosphorus enrichment"
        },
        "description": "Formerly classified as Anabaena (planktonic forms), Dolichospermum is a filamentous cyanobacterium capable of nitrogen fixation. It can produce multiple toxin types including anatoxin-a and microcystins, making it one of the most versatile toxin producers among cyanobacteria.",
        "morphology": "Filamentous, with heterocysts (nitrogen-fixing cells) and akinetes (resting cells). Trichomes are straight or coiled, cells 5–12 μm wide.",
        "reference_images": []
    },
    "Aphanizomenon": {
        "genus": "Aphanizomenon",
        "common_species": ["Aphanizomenon flos-aquae", "Aphanizomenon issatschenkoi"],
        "taxonomy": {
            "kingdom": "Bacteria",
            "phylum": "Cyanobacteria",
            "class": "Cyanophyceae",
            "order": "Nostocales",
            "family": "Aphanizomenonaceae",
            "genus": "Aphanizomenon"
        },
        "toxin": {
            "produces_toxin": True,
            "toxin_type": "Cylindrospermopsin, Saxitoxin",
            "risk_level": "Medium",
            "health_effects": "Liver and kidney damage, neurotoxicity. Some strains are non-toxic."
        },
        "ecology": {
            "habitat": "Freshwater lakes, reservoirs",
            "bloom_conditions": "Temperature: 16–22°C, Moderate to high nutrient levels",
            "temperature_range": "16–22°C",
            "nutrient_preference": "Nitrogen-fixing; favors phosphorus-rich waters",
            "water_type": "Mesotrophic to eutrophic freshwater",
            "seasonal_pattern": "Summer, sometimes persisting into autumn",
            "indicator_of": "Eutrophication"
        },
        "description": "Aphanizomenon forms distinctive grass-like bundles or rafts on the water surface. While some strains are marketed as dietary supplements ('blue-green algae'), wild populations can produce dangerous neurotoxins and cytotoxins.",
        "morphology": "Filamentous, forming parallel bundles (fascicles). Trichomes with heterocysts and akinetes. Cells cylindrical, 4–6 μm wide.",
        "reference_images": []
    },
    "Planktothrix": {
        "genus": "Planktothrix",
        "common_species": ["Planktothrix agardhii", "Planktothrix rubescens"],
        "taxonomy": {
            "kingdom": "Bacteria",
            "phylum": "Cyanobacteria",
            "class": "Cyanophyceae",
            "order": "Oscillatoriales",
            "family": "Microcoleaceae",
            "genus": "Planktothrix"
        },
        "toxin": {
            "produces_toxin": True,
            "toxin_type": "Microcystin",
            "risk_level": "High",
            "health_effects": "Liver toxicity, potential tumor promotion with chronic exposure."
        },
        "ecology": {
            "habitat": "Deep stratified lakes, reservoirs",
            "bloom_conditions": "Temperature: 10–20°C, Can bloom in cold conditions",
            "temperature_range": "10–20°C",
            "nutrient_preference": "High phosphorus",
            "water_type": "Mesotrophic to eutrophic freshwater",
            "seasonal_pattern": "Year-round; can persist through winter in deep lakes",
            "indicator_of": "Long-term eutrophication"
        },
        "description": "Planktothrix is notable for its ability to form blooms in cold water and deep lakes, unlike most cyanobacteria. P. rubescens forms deep chlorophyll maxima in stratified lakes and produces a distinctive red pigment (phycoerythrin). It is a significant microcystin producer in European lakes.",
        "morphology": "Solitary filaments, no heterocysts or akinetes. Trichomes straight, 5–10 μm wide, with distinctive red or blue-green coloration.",
        "reference_images": []
    },
    "Oscillatoria": {
        "genus": "Oscillatoria",
        "common_species": ["Oscillatoria limnetica", "Oscillatoria tenuis", "Oscillatoria princeps"],
        "taxonomy": {
            "kingdom": "Bacteria",
            "phylum": "Cyanobacteria",
            "class": "Cyanophyceae",
            "order": "Oscillatoriales",
            "family": "Oscillatoriaceae",
            "genus": "Oscillatoria"
        },
        "toxin": {
            "produces_toxin": True,
            "toxin_type": "Microcystin, Anatoxin-a",
            "risk_level": "Medium",
            "health_effects": "Liver damage, neurotoxicity in some strains."
        },
        "ecology": {
            "habitat": "Freshwater and brackish environments, sediment surfaces",
            "bloom_conditions": "Temperature: 15–30°C, Nutrient-rich shallow waters",
            "temperature_range": "15–30°C",
            "nutrient_preference": "High nutrients, organic matter",
            "water_type": "Eutrophic freshwater, wastewater",
            "seasonal_pattern": "Spring to autumn",
            "indicator_of": "Organic pollution, high nutrient loading"
        },
        "description": "Oscillatoria is a benthic or planktonic cyanobacterium named for the oscillating movement of its filaments. It is commonly found in nutrient-rich environments including wastewater treatment facilities. Some species produce toxins, though many are non-toxic.",
        "morphology": "Unbranched filaments that exhibit gliding motility. Cells disc-shaped, 2–60 μm wide depending on species. No heterocysts.",
        "reference_images": []
    },

    # ==========================================
    # DIATOMS
    # ==========================================
    "Navicula": {
        "genus": "Navicula",
        "common_species": ["Navicula radiosa", "Navicula cryptocephala", "Navicula tripunctata"],
        "taxonomy": {
            "kingdom": "Chromista",
            "phylum": "Bacillariophyta",
            "class": "Bacillariophyceae",
            "order": "Naviculales",
            "family": "Naviculaceae",
            "genus": "Navicula"
        },
        "toxin": {
            "produces_toxin": False,
            "toxin_type": "None",
            "risk_level": "None",
            "health_effects": "Not toxic. Important ecological indicator species."
        },
        "ecology": {
            "habitat": "Freshwater and marine benthic environments",
            "bloom_conditions": "Spring diatom blooms in nutrient-rich waters",
            "temperature_range": "5–25°C",
            "nutrient_preference": "Moderate to high silica and nutrients",
            "water_type": "Various freshwater to brackish",
            "seasonal_pattern": "Spring and autumn peaks",
            "indicator_of": "General water quality indicator; different species indicate varying pollution levels"
        },
        "description": "Navicula is one of the largest and most diverse diatom genera, found in virtually all aquatic environments. Its boat-shaped (naviculoid) frustule is a classic diatom form. Navicula species are widely used as bioindicators for water quality assessment.",
        "morphology": "Bilaterally symmetrical, boat-shaped (naviculoid) frustule. Raphe present. Size varies from 5–100 μm in length.",
        "reference_images": []
    },
    "Nitzschia": {
        "genus": "Nitzschia",
        "common_species": ["Nitzschia palea", "Nitzschia linearis", "Nitzschia acicularis"],
        "taxonomy": {
            "kingdom": "Chromista",
            "phylum": "Bacillariophyta",
            "class": "Bacillariophyceae",
            "order": "Bacillariales",
            "family": "Bacillariaceae",
            "genus": "Nitzschia"
        },
        "toxin": {
            "produces_toxin": True,
            "toxin_type": "Domoic acid (some marine species)",
            "risk_level": "Low",
            "health_effects": "Marine species (e.g., N. pungens) can produce domoic acid causing amnesic shellfish poisoning. Freshwater species are generally non-toxic."
        },
        "ecology": {
            "habitat": "Freshwater, brackish, and marine environments",
            "bloom_conditions": "Nutrient-rich, often polluted waters",
            "temperature_range": "5–30°C",
            "nutrient_preference": "Tolerant of high organic pollution",
            "water_type": "Eutrophic to hypertrophic, including polluted waters",
            "seasonal_pattern": "Year-round, peaks in warmer months",
            "indicator_of": "Organic pollution, high nutrient loading (alpha-mesosaprobic indicator)"
        },
        "description": "Nitzschia is a highly diverse genus of pennate diatoms. Freshwater species like N. palea are among the most pollution-tolerant diatoms and are used as indicators of organic contamination. Some marine species are notable producers of domoic acid, a potent neurotoxin.",
        "morphology": "Linear to lanceolate frustule with eccentric raphe (on one side). Fibulae visible. Size typically 10–100 μm.",
        "reference_images": []
    },
    "Cyclotella": {
        "genus": "Cyclotella",
        "common_species": ["Cyclotella meneghiniana", "Cyclotella ocellata", "Cyclotella stelligera"],
        "taxonomy": {
            "kingdom": "Chromista",
            "phylum": "Bacillariophyta",
            "class": "Mediophyceae",
            "order": "Stephanodiscales",
            "family": "Stephanodiscaceae",
            "genus": "Cyclotella"
        },
        "toxin": {
            "produces_toxin": False,
            "toxin_type": "None",
            "risk_level": "None",
            "health_effects": "Not toxic. Commonly used in water quality monitoring."
        },
        "ecology": {
            "habitat": "Planktonic in freshwater lakes and rivers",
            "bloom_conditions": "Spring mixing and nutrient availability",
            "temperature_range": "5–25°C",
            "nutrient_preference": "Moderate nutrients, sufficient silica",
            "water_type": "Oligotrophic to mesotrophic freshwater",
            "seasonal_pattern": "Spring and autumn blooms during lake mixing",
            "indicator_of": "Clean to moderately impacted water; C. meneghiniana indicates nutrient enrichment"
        },
        "description": "Cyclotella is a centric diatom commonly found in the plankton of freshwater lakes and rivers. Different species have different ecological preferences, making them valuable paleoclimate and water quality indicators. C. meneghiniana is cosmopolitan and tolerant of nutrient enrichment.",
        "morphology": "Disc-shaped (centric) frustule with radiate striae pattern. Central area may be smooth or with fultoportulae. Diameter 5–40 μm.",
        "reference_images": []
    },
    "Fragilaria": {
        "genus": "Fragilaria",
        "common_species": ["Fragilaria crotonensis", "Fragilaria capucina", "Fragilaria vaucheriae"],
        "taxonomy": {
            "kingdom": "Chromista",
            "phylum": "Bacillariophyta",
            "class": "Bacillariophyceae",
            "order": "Fragilariales",
            "family": "Fragilariaceae",
            "genus": "Fragilaria"
        },
        "toxin": {
            "produces_toxin": False,
            "toxin_type": "None",
            "risk_level": "None",
            "health_effects": "Not toxic. Can cause filter clogging in water treatment at high densities."
        },
        "ecology": {
            "habitat": "Freshwater lakes, rivers, epilithic and planktonic",
            "bloom_conditions": "Cool, turbulent waters with silica availability",
            "temperature_range": "4–20°C",
            "nutrient_preference": "Low to moderate nutrients",
            "water_type": "Oligotrophic to mesotrophic freshwater",
            "seasonal_pattern": "Late winter to spring; also autumn blooms",
            "indicator_of": "Alkaline, nutrient-moderate waters"
        },
        "description": "Fragilaria forms characteristic ribbon-like colonies (chains) of cells joined at their valve faces. F. crotonensis can form nuisance blooms in lakes, causing water treatment issues. Different species span a range of trophic conditions, making them useful bioindicators.",
        "morphology": "Elongated, needle-like frustules forming ribbon colonies. Araphid (no raphe). Length 10–100+ μm, width 2–5 μm.",
        "reference_images": []
    },
    "Thalassiosira": {
        "genus": "Thalassiosira",
        "common_species": ["Thalassiosira weissflogii", "Thalassiosira pseudonana", "Thalassiosira rotula"],
        "taxonomy": {
            "kingdom": "Chromista",
            "phylum": "Bacillariophyta",
            "class": "Mediophyceae",
            "order": "Thalassiosirales",
            "family": "Thalassiosiraceae",
            "genus": "Thalassiosira"
        },
        "toxin": {
            "produces_toxin": False,
            "toxin_type": "None",
            "risk_level": "None",
            "health_effects": "Not toxic. Key primary producer in marine ecosystems."
        },
        "ecology": {
            "habitat": "Marine and estuarine planktonic environments",
            "bloom_conditions": "Nutrient upwelling, spring mixing events",
            "temperature_range": "2–25°C",
            "nutrient_preference": "High silica, nitrogen, and phosphorus during upwelling",
            "water_type": "Marine, coastal, estuarine",
            "seasonal_pattern": "Spring blooms, sometimes autumn secondary bloom",
            "indicator_of": "Productive marine waters, upwelling zones"
        },
        "description": "Thalassiosira is a major marine centric diatom genus and one of the most important primary producers in the ocean. T. pseudonana was the first diatom to have its genome sequenced. These diatoms play a crucial role in the marine carbon cycle and silica cycling.",
        "morphology": "Disc-shaped (centric) frustule with strutted processes (fultoportulae) at the margin. Diameter 5–50+ μm. Cells often connected in chains by threads of chitin.",
        "reference_images": []
    }
}

def seed_supabase_database():
    """Seeds the hardcoded algae database into the new Supabase algae_species table"""
    # Load environment variables
    load_dotenv()
    
    # We need the SERVICE_ROLE key to bypass RLS for inserting
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
        print("Please ensure your .env file is correctly configured for the backend.")
        sys.exit(1)
        
    print(f"Connecting to Supabase at {supabase_url}...")
    supabase: Client = create_client(supabase_url, supabase_key)
    
    success_count = 0
    error_count = 0
    
    print("\nStarting database seed...")
    for genus, data in ALGAE_DATABASE.items():
        try:
            # Map the Python dictionary format to our Supabase SQL columns
            payload = {
                "genus": data["genus"],
                "common_species": data.get("common_species", []),
                "taxonomy": data.get("taxonomy", {}),
                "toxin": data.get("toxin", {}),
                "ecology": data.get("ecology", {}),
                "description": data.get("description", ""),
                "morphology": data.get("morphology", ""),
                "reference_images": data.get("reference_images", [])
            }
            
            # Upsert (insert or update) based on genus
            # In Supabase JS it's .upsert(), in Python we use upsert but must handle conflicts
            response = supabase.table("algae_species").insert(payload).execute()
            print(f"✅ Successfully inserted: {genus}")
            success_count += 1
            
        except Exception as e:
            # Check if error is because it already exists (Unique constraint violation)
            error_msg = str(e)
            if "duplicate key value" in error_msg.lower() or "unique constraint" in error_msg.lower() or "23505" in error_msg:
                print(f"⚠️ Skipped {genus} (Already exists in database)")
            else:
                print(f"❌ Failed to insert {genus}: {error_msg}")
                error_count += 1
                
    print(f"\nSeeding complete! {success_count} inserted, {error_count} errors.")

if __name__ == "__main__":
    seed_supabase_database()
