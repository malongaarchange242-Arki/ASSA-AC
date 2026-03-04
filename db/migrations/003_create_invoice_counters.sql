-- Migration: create invoice_counters table and atomic increment function
-- Usage: Call the SQL function `increment_invoice_counter(p_airport_code, p_year, p_month)`
-- which returns the new integer counter for the given airport/year/month.

BEGIN;

-- Table to hold per-airport monthly counters
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  airport_code text NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  counter integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (airport_code, year, month)
);

-- Function to atomically insert-or-increment the counter and return the new value
CREATE OR REPLACE FUNCTION public.increment_invoice_counter(
  p_airport_code text,
  p_year integer,
  p_month integer
) RETURNS integer AS $$
DECLARE
  v_counter integer;
BEGIN
  INSERT INTO public.invoice_counters (airport_code, year, month, counter, updated_at)
  VALUES (p_airport_code, p_year, p_month, 1, now())
  ON CONFLICT (airport_code, year, month) DO UPDATE
    SET counter = invoice_counters.counter + 1,
        updated_at = now()
  RETURNING counter INTO v_counter;

  RETURN v_counter;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
