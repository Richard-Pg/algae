import os
from supabase import create_client, Client

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

supabase: Client = create_client(url, key)

# Test total count
response = supabase.table("identification_history").select("*", count="exact").limit(0).execute()
print("Total count:", response.count)

# Test harmful count
response = supabase.table("identification_history").select("*", count="exact").eq("result->>is_harmful", "true").limit(0).execute()
print("Harmful count:", response.count)
