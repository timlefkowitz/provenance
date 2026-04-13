-- Shared: Certificates table (spans all planets)
-- Unified certificate registry — certificate numbers are globally unique.
CREATE TABLE IF NOT EXISTS public.certificates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet              varchar(50) NOT NULL,
  asset_id            uuid NOT NULL,
  certificate_number  varchar(100) UNIQUE NOT NULL,
  version             integer DEFAULT 1,
  verification_score  numeric(4,2),
  status              varchar(50) DEFAULT 'active',
  issued_at           timestamptz DEFAULT now(),
  issued_by           uuid REFERENCES public.accounts(id),
  metadata            jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_certificates_planet_asset ON public.certificates(planet, asset_id);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON public.certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON public.certificates(status);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS certificates_select_all ON public.certificates;
DROP POLICY IF EXISTS certificates_insert_auth ON public.certificates;
DROP POLICY IF EXISTS certificates_update_issuer ON public.certificates;

-- Certificates are publicly readable for verification
CREATE POLICY certificates_select_all ON public.certificates
  FOR SELECT USING (true);

-- Only authenticated users can issue certificates
CREATE POLICY certificates_insert_auth ON public.certificates
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only the issuer can update their certificates
CREATE POLICY certificates_update_issuer ON public.certificates
  FOR UPDATE USING (issued_by = auth.uid());
