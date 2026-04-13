-- Planet: Vehicles
-- Stores vehicle provenance records with VIN tracking
CREATE TABLE IF NOT EXISTS public.vehicles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title               varchar(255) NOT NULL,
  description         text,
  vin                 varchar(17),
  make                varchar(100),
  model               varchar(100),
  year                integer,
  color               varchar(100),
  mileage             integer,
  engine              varchar(255),
  transmission        varchar(50),
  title_number        varchar(100),
  title_state         varchar(50),
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

CREATE INDEX IF NOT EXISTS idx_vehicles_account ON public.vehicles(account_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON public.vehicles(vin);
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON public.vehicles(make, model);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicles_select_public ON public.vehicles;
DROP POLICY IF EXISTS vehicles_select_own ON public.vehicles;
DROP POLICY IF EXISTS vehicles_insert_own ON public.vehicles;
DROP POLICY IF EXISTS vehicles_update_own ON public.vehicles;
DROP POLICY IF EXISTS vehicles_delete_own ON public.vehicles;

CREATE POLICY vehicles_select_public ON public.vehicles
  FOR SELECT USING (is_public = true);

CREATE POLICY vehicles_select_own ON public.vehicles
  FOR SELECT USING (account_id = auth.uid());

CREATE POLICY vehicles_insert_own ON public.vehicles
  FOR INSERT WITH CHECK (account_id = auth.uid());

CREATE POLICY vehicles_update_own ON public.vehicles
  FOR UPDATE USING (account_id = auth.uid());

CREATE POLICY vehicles_delete_own ON public.vehicles
  FOR DELETE USING (account_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_vehicles_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_vehicles_updated_at();
