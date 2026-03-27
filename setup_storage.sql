-- Create a new storage bucket 'algae_images' if it doesn't exist
INSERT INTO storage.buckets (id, name, public) VALUES ('algae_images', 'algae_images', true) ON CONFLICT (id) DO NOTHING;

-- Set up access controls for the new bucket
-- 1. Allow public read access to all files in the algae_images bucket
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'algae_images');

-- 2. Allow authenticated users to insert files into the algae_images bucket
-- We ensure the user is logged in by checking auth.role() = 'authenticated'
CREATE POLICY "Authenticated users can upload images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'algae_images' AND auth.role() = 'authenticated');

-- 3. Allow users to update or delete their own uploaded images
CREATE POLICY "Users can update own images" ON storage.objects FOR UPDATE USING (bucket_id = 'algae_images' AND auth.uid() = owner);
CREATE POLICY "Users can delete own images" ON storage.objects FOR DELETE USING (bucket_id = 'algae_images' AND auth.uid() = owner);
