import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Warning: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    exit(1)

supabase: Client = create_client(url, key)

print("Ensuring 'algae_images' bucket exists...")
try:
    buckets = supabase.storage.list_buckets()
    bucket_names = [b.name for b in buckets]
    
    if "algae_images" not in bucket_names:
        print("Bucket not found. Creating 'algae_images' bucket...")
        supabase.storage.create_bucket("algae_images", options={"public": True})
        print("✅ Bucket created successfully.")
    else:
        print("✅ Bucket 'algae_images' already exists.")
except Exception as e:
    print(f"Error checking/creating bucket: {e}")
