-- Migration: add unique index/constraint on factures.numero_facture
-- WARNING: Ensure there are no duplicate `numero_facture` values before running this migration.
-- If duplicates exist, resolve them first (e.g. by manual review or temporary suffix),
-- then apply the unique index/constraint.

-- Example check for duplicates:
-- SELECT numero_facture, COUNT(*) FROM factures GROUP BY numero_facture HAVING COUNT(*) > 1;

-- Create a unique index on numero_facture (adjust schema if needed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_numero_facture ON public.factures (numero_facture);

-- Alternatively, to add a UNIQUE constraint use (only if no duplicates):
-- ALTER TABLE public.factures ADD CONSTRAINT uq_factures_numero_facture UNIQUE (numero_facture);
