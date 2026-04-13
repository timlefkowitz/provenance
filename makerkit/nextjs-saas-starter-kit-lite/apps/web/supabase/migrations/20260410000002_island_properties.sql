-- Planet: Real Estate
-- Stores property provenance and deed history
CREATE TABLE IF NOT EXISTS public.properties (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title               varchar(255) NOT NULL,
  description         text,
  address             text,
  city                varchar(100),
  state               varchar(50),
  zip                 varchar(20),
  country             varchar(100),
  parcel_number       varchar(100),
  property_type       varchar(50),
  lot_size            varchar(100),
  building_size       varchar(100),
  year_built          integer,
  deed_type           varchar(100),
  image_url           text,
  certificate_number  varchar(100) UNIQUE,
  certificate_status  varchar(50) DEFAULT 'pending',
  provenance_history  jsonb DEFAULT '[]'::jsonb,
  metadata            jsonb DEFAULT '{}'::jsonb,
  status              varchar(50) DEFAULT 'draft',
  is_public           boolean NOT NULL DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  created_by          uuid REFERENCES auth.users(id),
  updated_by          uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_properties_account ON public.properties(account_id);
CREATE INDEX IF NOT EXISTS idx_properties_parcel ON public.properties(parcel_number);
CREATE INDEX IF NOT EXISTS idx_properties_location ON public.properties(city, state);
CREATE INDEX IF NOT EXISTS idx_properties_type ON public.properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS properties_select_public ON public.properties;
DROP POLICY IF EXISTS properties_select_own ON public.properties;
DROP POLICY IF EXISTS properties_insert_own ON public.properties;
DROP POLICY IF EXISTS properties_update_own ON public.properties;
DROP POLICY IF EXISTS properties_delete_own ON public.properties;

CREATE POLICY properties_select_public ON public.properties
  FOR SELECT USING (is_public = true);

CREATE POLICY properties_select_own ON public.properties
  FOR SELECT USING (account_id = auth.uid());

CREATE POLICY properties_insert_own ON public.properties
  FOR INSERT WITH CHECK (account_id = auth.uid());

CREATE POLICY properties_update_own ON public.properties
  FOR UPDATE USING (account_id = auth.uid());

CREATE POLICY properties_delete_own ON public.properties
  FOR DELETE USING (account_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_properties_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_properties_updated_at ON public.properties;
CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_properties_updated_at();
