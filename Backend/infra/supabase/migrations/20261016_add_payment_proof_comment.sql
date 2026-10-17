ALTER TABLE public.preuve_paiement
  ADD COLUMN IF NOT EXISTS commentaire text;

NOTIFY pgrst, 'reload schema';
