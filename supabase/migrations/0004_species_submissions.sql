-- =============================================
-- Species Submissions Table
-- Community contribution system for AlgaeAI
-- =============================================

CREATE TABLE IF NOT EXISTS public.species_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user_email TEXT,
    user_name TEXT,

    -- Submission status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

    -- User-provided info
    proposed_genus TEXT NOT NULL,
    proposed_species TEXT,
    location_found TEXT,
    user_notes TEXT,

    -- Image
    image_url TEXT,

    -- AI pre-analysis (populated automatically on submission)
    ai_analysis JSONB,

    -- Admin review
    admin_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.species_submissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own submissions
CREATE POLICY "Users can view own submissions"
ON public.species_submissions FOR SELECT
USING (auth.uid() = user_id);

-- Authenticated users can insert new submissions
CREATE POLICY "Authenticated users can submit"
ON public.species_submissions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only backend (service role) can update status
-- Frontend cannot approve/reject directly - must go through backend API

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_species_submissions_user_id ON public.species_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_species_submissions_status  ON public.species_submissions(status);
