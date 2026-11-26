-- 0009 · Compiled (not yet reviewed) species records and image credits.
-- Additive: existing rows stay "reviewed".

ALTER TABLE public.algae_species
    ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'reviewed',
    ADD COLUMN IF NOT EXISTS image_credits JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'algae_species_review_status_check'
    ) THEN
        ALTER TABLE public.algae_species
            ADD CONSTRAINT algae_species_review_status_check
            CHECK (review_status IN ('draft', 'reviewed'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_algae_species_review_status
    ON public.algae_species (review_status);
