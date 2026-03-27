import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    exit(1)

supabase: Client = create_client(url, key)

print("Starting cleanup of legacy Base64 image records...")
try:
    # Delete all rows where image_url starts with "data:" (Base64 data URIs)
    response = supabase.table("identification_history").delete().like("image_url", "data:%").execute()
    
    if getattr(response, 'data', None):
        print(f"Successfully deleted {len(response.data)} legacy records that were causing UI lag.")
    else:
        print("Successfully executed delete, but no records were returned. They might be already cleaned up.")
        
except Exception as e:
    print(f"An error occurred during cleanup: {e}")
