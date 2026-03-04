-- Migration: create invoice_counters table and increment_invoice_counter function
-- Run this on your Postgres database (Supabase) to enable atomic invoice counters.

-- Table to track per-airport/month counters
CREATE TABLE IF NOT EXISTS invoice_counters (
  id bigserial PRIMARY KEY,
  airport_code TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (airport_code, year, month)
);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION invoice_counters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_counters_updated_at ON invoice_counters;
CREATE TRIGGER trg_invoice_counters_updated_at
BEFORE UPDATE ON invoice_counters
FOR EACH ROW EXECUTE PROCEDURE invoice_counters_updated_at();

-- Atomic increment function: returns the new counter value
-- Usage: SELECT increment_invoice_counter('PNR', 2026, 1);
CREATE OR REPLACE FUNCTION increment_invoice_counter(p_airport_code TEXT, p_year INTEGER, p_month INTEGER)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_counter INTEGER;
BEGIN
  LOOP
    -- Try to lock existing row
    SELECT counter INTO v_counter
    FROM invoice_counters
    WHERE airport_code = p_airport_code AND year = p_year AND month = p_month
    FOR UPDATE;

    IF FOUND THEN
      UPDATE invoice_counters
      SET counter = counter + 1
      WHERE airport_code = p_airport_code AND year = p_year AND month = p_month
      RETURNING counter INTO v_counter;

      RETURN v_counter;
    ELSE
      BEGIN
        INSERT INTO invoice_counters (airport_code, year, month, counter)
        VALUES (p_airport_code, p_year, p_month, 1)
        RETURNING counter INTO v_counter;

        RETURN v_counter;
      EXCEPTION WHEN unique_violation THEN
        -- concurrent insert happened, retry loop
      END;
    END IF;
  END LOOP;
END;
$$;

-- Grant execute to authenticated role if using Supabase (adjust role as needed)
-- GRANT EXECUTE ON FUNCTION increment_invoice_counter(TEXT, INTEGER, INTEGER) TO authenticated;
