ALTER TABLE public.preuve_paiement
  ADD COLUMN IF NOT EXISTS date_envoi timestamptz NOT NULL DEFAULT now();

NOTIFY pgrst, 'reload schema';
