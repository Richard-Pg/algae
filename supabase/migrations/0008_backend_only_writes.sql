-- =============================================================
-- 0008 · Writes go through the backend only
--
-- Run AFTER the redesigned frontend is deployed. The old frontend wrote
-- identification history and uploaded images straight from the browser;
-- the new one sends everything through the API, which uses the service
-- role and does its own ownership checks.
-- =============================================================

DROP POLICY IF EXISTS "Users can insert own history" ON public.identification_history;
DROP POLICY IF EXISTS "Authenticated users can submit" ON public.species_submissions;

-- The public bucket now only receives images the backend publishes on
-- approval, so browsers no longer need to upload into it directly.
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
