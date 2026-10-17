ALTER TABLE public.preuve_paiement
  ADD COLUMN IF NOT EXISTS numero_facture text,
  ADD COLUMN IF NOT EXISTS facture_id uuid,
  ADD COLUMN IF NOT EXISTS id_companie uuid,
  ADD COLUMN IF NOT EXISTS fichier_nom text,
  ADD COLUMN IF NOT EXISTS fichier_url text,
  ADD COLUMN IF NOT EXISTS type_fichier text,
  ADD COLUMN IF NOT EXISTS commentaire text,
  ADD COLUMN IF NOT EXISTS date_envoi timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.preuve_paiement AS preuve
SET
  facture_id = COALESCE(preuve.facture_id, facture.id),
  id_companie = COALESCE(preuve.id_companie, facture.id_companie),
  numero_facture = COALESCE(preuve.numero_facture, facture.numero_facture),
  fichier_url = COALESCE(preuve.fichier_url, preuve.file_url),
  file_url = COALESCE(preuve.file_url, preuve.fichier_url),
  fichier_nom = COALESCE(preuve.fichier_nom, preuve.file_name),
  file_name = COALESCE(preuve.file_name, preuve.fichier_nom),
  date_envoi = COALESCE(preuve.created_at, preuve.date_envoi, now())
FROM public.factures AS facture
WHERE preuve.numero_facture = facture.numero_facture
   OR preuve.facture_id = facture.id;

NOTIFY pgrst, 'reload schema';
