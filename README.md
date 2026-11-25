# AlgaeAI

An open, expert-reviewed database of algae and diatoms, with AI-assisted identification as the starting point.

- **Identify**: upload a microscope or bloom image (JPG, PNG, HEIC, TIFF, WebP). A vision model suggests the most likely genus, lists the candidates it ruled out and why, and flags harmful bloom species.
- **Check the evidence**: taxonomy, toxins and ecology come from the curated database where a record exists; otherwise GBIF taxonomy plus clearly labelled AI estimates.
- **Contribute**: signed-in users submit observations (prefilled from an identification). Reviewers approve, reject or return them for revision. Approved observations are published to the open species library with credit.

```
frontend/   Next.js 16 + React 19 + Tailwind CSS 4   (Vercel)
backend/    FastAPI + Gemini + Supabase               (Railway / Docker)
supabase/   SQL migrations, run in order in the Supabase SQL editor
```

## Running locally

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env        # fill in GEMINI_API_KEY and the Supabase keys
uvicorn main:app --reload --port 8000
python -m pytest tests      # uses an in-memory fake of Supabase; no network needed
```

API docs are served at http://localhost:8000/docs.

### Frontend

```bash
cd frontend
npm install
# .env.local
#   NEXT_PUBLIC_API_URL=http://localhost:8000
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
npm run dev
```

## Database

Run the files in `supabase/migrations` in order. Existing projects that already ran the old root-level SQL files need **`0007_open_database_redesign.sql`** before deploying and **`0008_backend_only_writes.sql`** after. 0007 only adds things:

- lets identifications be anonymous, adds `image_path` and `is_shared`;
- adds `needs_revision` as a submission status, plus `image_path`, `identification_id` and `published_image_url`;
- creates the private `uploads` storage bucket.

0008 then removes the policies that let browsers write history, submissions and public images directly, since all writes now go through the backend.

## How data flows

| Data | Where it lives | Who can see it |
| --- | --- | --- |
| Uploaded images | private `uploads` bucket, shown through short-lived signed URLs | the owner, reviewers, and anyone with the link if shared (guest results are link-viewable) |
| Identification results | `identification_history` | same as above |
| Submissions | `species_submissions` | the contributor and reviewers |
| Approved records | `algae_species`, images copied to the public `algae_images` bucket | everyone |

Rate limits (`ANON_DAILY_IDENTIFY_LIMIT`, `USER_DAILY_IDENTIFY_LIMIT`) are enforced on the server per IP or per account. The limiter is in-memory, so it assumes a single backend instance.

## Reviewers

Reviewers are the accounts listed in `ADMIN_EMAILS` on the backend (comma-separated). The frontend asks `/api/me` whether the signed-in user is a reviewer, so no admin email is baked into the client.
