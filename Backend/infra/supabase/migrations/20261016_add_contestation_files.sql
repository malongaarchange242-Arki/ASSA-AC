ALTER TABLE public.contestation
  ADD COLUMN IF NOT EXISTS fichiers jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
