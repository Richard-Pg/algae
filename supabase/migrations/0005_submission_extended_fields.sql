-- =============================================
-- Extended Contribution Fields
-- Adds optional scientific evidence fields to community submissions.
-- Safe to run multiple times.
-- =============================================

ALTER TABLE public.species_submissions
ADD COLUMN IF NOT EXISTS submitted_taxonomy JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS submitted_toxin JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS submitted_ecology JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS submitted_references JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS submitted_morphology TEXT,
ADD COLUMN IF NOT EXISTS collection_date TEXT,
ADD COLUMN IF NOT EXISTS sample_type TEXT,
ADD COLUMN IF NOT EXISTS microscopy_method TEXT,
ADD COLUMN IF NOT EXISTS contributor_confidence TEXT;

ALTER TABLE public.algae_species
ADD COLUMN IF NOT EXISTS "references" JSONB DEFAULT '[]'::jsonb;
