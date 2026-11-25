-- =============================================================
-- 0007 · Open database redesign
--
-- Run once in the Supabase SQL editor after 0001–0006.
-- Safe to run more than once, and safe to run BEFORE the new code is
-- deployed: it only adds things. 0008 removes the old browser-write
-- policies and should be run after the new frontend is live.
--
-- * Identifications are written by the backend (service role), may be
--   anonymous, keep their image in a PRIVATE bucket and can be shared.
-- * Submissions can come from an identification, keep their raw image
--   private until approved, and can be returned for revision.
-- =============================================================

-- ---------- identification_history ----------
ALTER TABLE public.identification_history
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.identification_history
    ADD COLUMN IF NOT EXISTS image_path TEXT,
    ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false;

-- ---------- species_submissions ----------
ALTER TABLE public.species_submissions
    ADD COLUMN IF NOT EXISTS image_path TEXT,
    ADD COLUMN IF NOT EXISTS identification_id UUID
        REFERENCES public.identification_history(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS published_image_url TEXT;

ALTER TABLE public.species_submissions
    DROP CONSTRAINT IF EXISTS species_submissions_status_check;
ALTER TABLE public.species_submissions
    ADD CONSTRAINT species_submissions_status_check
    CHECK (status IN ('pending', 'needs_revision', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_species_submissions_genus
    ON public.species_submissions (lower(proposed_genus));

-- ---------- algae_species ----------
ALTER TABLE public.algae_species
    ADD COLUMN IF NOT EXISTS "references" JSONB DEFAULT '[]'::jsonb;

-- ---------- storage ----------
-- Private bucket for raw uploads. Served only through signed URLs that the
-- backend creates after checking who is asking.
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false)
ON CONFLICT (id) DO UPDATE SET public = false;
