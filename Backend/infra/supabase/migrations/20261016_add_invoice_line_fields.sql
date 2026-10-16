ALTER TABLE public.lignes_facture
  ADD COLUMN IF NOT EXISTS numero_ligne integer,
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS nombre_passagers numeric(18,2),
  ADD COLUMN IF NOT EXISTS cout_unitaire numeric(18,2),
  ADD COLUMN IF NOT EXISTS cout_total numeric(18,2);

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lignes_facture'
      AND column_name IN ('description', 'quantite', 'prix_unitaire', 'montant')
  ) = 4 THEN
    UPDATE public.lignes_facture
    SET designation = COALESCE(designation, description),
        nombre_passagers = COALESCE(nombre_passagers, quantite),
        cout_unitaire = COALESCE(cout_unitaire, prix_unitaire),
        cout_total = COALESCE(cout_total, montant);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
