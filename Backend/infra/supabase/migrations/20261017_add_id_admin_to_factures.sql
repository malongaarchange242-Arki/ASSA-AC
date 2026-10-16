ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS id_admin uuid;

NOTIFY pgrst, 'reload schema';
