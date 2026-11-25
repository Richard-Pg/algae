-- =============================================
-- Admin Settings
-- Stores administrator-controlled app settings.
-- =============================================

CREATE TABLE IF NOT EXISTS public.admin_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Settings are managed only through the backend service role.
CREATE POLICY "Block client reads for admin settings"
ON public.admin_settings FOR SELECT
USING (false);

CREATE POLICY "Block client writes for admin settings"
ON public.admin_settings FOR INSERT
WITH CHECK (false);

CREATE POLICY "Block client updates for admin settings"
ON public.admin_settings FOR UPDATE
USING (false);

INSERT INTO public.admin_settings (key, value)
VALUES ('contribution_email_notifications', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
