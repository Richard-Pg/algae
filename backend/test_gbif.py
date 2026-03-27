import httpx
import json

genus_name = "Spirogyra"
print(f"Testing GBIF for {genus_name}...")
with httpx.Client(timeout=5.0) as client:
    response = client.get(f"https://api.gbif.org/v1/species/match?name={genus_name}")
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(json.dumps(data, indent=2))
