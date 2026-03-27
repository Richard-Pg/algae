import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(url, key)

print("Checking policies for storage.objects...")
try:
    response = supabase.table("pg_policies").select("*").eq("schemaname", "storage").eq("tablename", "objects").execute()
    for policy in response.data:
        print(f"Policy: {policy['policyname']} (Cmd: {policy['cmd']})")
except Exception as e:
    print(f"Error checking policies: {e}")
