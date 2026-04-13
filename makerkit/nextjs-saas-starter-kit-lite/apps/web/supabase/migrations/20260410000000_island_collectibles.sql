-- Planet: Collectibles
-- Stores collectible items (coins, stamps, cards, memorabilia, etc.)
CREATE TABLE IF NOT EXISTS public.collectibles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title               varchar(255) NOT NULL,
  description         text,
  category            varchar(100),
  subcategory         varchar(100),
  manufacturer        varchar(255),
  year                integer,
  condition           varchar(50),
  grading_service     varchar(100),
  grading_score       varchar(50),
  serial_number       varchar(255),
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

CREATE INDEX IF NOT EXISTS idx_collectibles_account ON public.collectibles(account_id);
CREATE INDEX IF NOT EXISTS idx_collectibles_category ON public.collectibles(category);
CREATE INDEX IF NOT EXISTS idx_collectibles_status ON public.collectibles(status);

ALTER TABLE public.collectibles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collectibles_select_public ON public.collectibles;
DROP POLICY IF EXISTS collectibles_select_own ON public.collectibles;
DROP POLICY IF EXISTS collectibles_insert_own ON public.collectibles;
DROP POLICY IF EXISTS collectibles_update_own ON public.collectibles;
DROP POLICY IF EXISTS collectibles_delete_own ON public.collectibles;

CREATE POLICY collectibles_select_public ON public.collectibles
  FOR SELECT USING (is_public = true);

CREATE POLICY collectibles_select_own ON public.collectibles
  FOR SELECT USING (account_id = auth.uid());

CREATE POLICY collectibles_insert_own ON public.collectibles
  FOR INSERT WITH CHECK (account_id = auth.uid());

CREATE POLICY collectibles_update_own ON public.collectibles
  FOR UPDATE USING (account_id = auth.uid());

CREATE POLICY collectibles_delete_own ON public.collectibles
  FOR DELETE USING (account_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_collectibles_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_collectibles_updated_at ON public.collectibles;
CREATE TRIGGER trg_collectibles_updated_at
  BEFORE UPDATE ON public.collectibles
  FOR EACH ROW EXECUTE FUNCTION public.update_collectibles_updated_at();
