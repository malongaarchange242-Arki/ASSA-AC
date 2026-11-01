CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('admin', 'superviseur', 'operateur', 'company')),
  account_id uuid NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email_created_at
  ON public.password_reset_otps (email, created_at DESC);

ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_otps FROM anon, authenticated;
GRANT ALL ON public.password_reset_otps TO service_role;

NOTIFY pgrst, 'reload schema';
