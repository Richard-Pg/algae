import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

supabase: Client = create_client(url, key)

print("Checking 'algae_images' bucket contents...")
try:
    response = supabase.storage.from_("algae_images").list()
    print(f"Found {len(response)} files in bucket.")
    for f in response[:5]:
        print(f" - {f}")
except Exception as e:
    print(f"Error listing bucket: {e}")
