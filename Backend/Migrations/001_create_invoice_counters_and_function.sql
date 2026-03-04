-- Migration: create invoice_counters table and generate_invoice_ref function
-- Run this on your Postgres / Supabase DB

CREATE TABLE IF NOT EXISTS invoice_counters (
  city_code VARCHAR(8) NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  counter INT NOT NULL DEFAULT 0,
  PRIMARY KEY (city_code, year, month)
);

-- Ensure unique invoice reference on factures (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='factures') THEN
    BEGIN
      ALTER TABLE factures ADD CONSTRAINT IF NOT EXISTS unique_numero_facture UNIQUE (numero_facture);
    EXCEPTION WHEN duplicate_object THEN
      -- ignore
    END;
  END IF;
END$$;

-- Function to atomically increment per-city monthly counter and return formatted reference
CREATE OR REPLACE FUNCTION generate_invoice_ref(city_code_in VARCHAR, in_date DATE)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  y INT := EXTRACT(YEAR FROM in_date)::INT;
  m INT := EXTRACT(MONTH FROM in_date)::INT;
  cnt INT;
  padded TEXT;
  ref TEXT;
BEGIN
  INSERT INTO invoice_counters (city_code, year, month, counter)
  VALUES (city_code_in, y, m, 1)
  ON CONFLICT (city_code, year, month)
  DO UPDATE SET counter = invoice_counters.counter + 1
  RETURNING counter INTO cnt;

  padded := lpad(cnt::text, 3, '0');
  ref := city_code_in || '-' || padded || '/' || lpad(m::text,2,'0') || '/' || y::text || '/ASSA-AC/DAF';
  RETURN ref;
END;
$$;
