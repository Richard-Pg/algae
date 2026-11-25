-- Create algae_species knowledge base table
CREATE TABLE IF NOT EXISTS public.algae_species (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    genus VARCHAR(100) NOT NULL UNIQUE,
    common_species TEXT[], -- Array of strings
    taxonomy JSONB,
    toxin JSONB,
    ecology JSONB,
    description TEXT,
    morphology TEXT,
    reference_images TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Anyone can read the species database
ALTER TABLE public.algae_species ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" 
ON public.algae_species FOR SELECT 
USING (true);

-- Only authenticated services (like our backend with service_role key) can insert/update
-- Users cannot modify this table directly from the frontend
CREATE POLICY "Enable insert for authenticated backend only" 
ON public.algae_species FOR INSERT 
WITH CHECK (false); -- Prevent all client-side inserts

CREATE POLICY "Enable update for authenticated backend only" 
ON public.algae_species FOR UPDATE 
USING (false);

-- Create an index to make genus lookups lightning fast
CREATE INDEX IF NOT EXISTS idx_algae_species_genus ON public.algae_species(genus);
