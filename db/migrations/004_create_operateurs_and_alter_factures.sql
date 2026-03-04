-- Migration: create operateurs table and alter factures to add created_by, validated_by, validated_at, signed_at
BEGIN;

-- 1) Create operateurs table
CREATE TABLE IF NOT EXISTS public.operateurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Alter factures: add columns if they do not exist
ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS validated_by uuid,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz;

-- 3) Add foreign key constraints if target tables exist
DO $$
BEGIN
  -- created_by -> operateurs
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.conname = 'fk_factures_created_by_operateurs'
  ) THEN
    BEGIN
      ALTER TABLE public.factures
        ADD CONSTRAINT fk_factures_created_by_operateurs FOREIGN KEY (created_by)
        REFERENCES public.operateurs(id) ON DELETE SET NULL;
    EXCEPTION WHEN undefined_table THEN -- operateurs table might not exist in some environments
      RAISE NOTICE 'operateurs table missing, skipping FK created_by';
    END;
  END IF;

  -- validated_by -> superviseurs (only if superviseurs table exists)
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'superviseurs') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conname = 'fk_factures_validated_by_superviseurs'
    ) THEN
      ALTER TABLE public.factures
        ADD CONSTRAINT fk_factures_validated_by_superviseurs FOREIGN KEY (validated_by)
        REFERENCES public.superviseurs(id) ON DELETE SET NULL;
    END IF;
  ELSE
    RAISE NOTICE 'superviseurs table not found; skip adding FK for validated_by';
  END IF;
END$$;

COMMIT;
