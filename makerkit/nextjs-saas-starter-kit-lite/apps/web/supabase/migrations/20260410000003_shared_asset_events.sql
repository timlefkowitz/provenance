-- Shared: Asset Events (append-only event store spanning all planets)
-- Every mutation to any asset across any planet is recorded here.
CREATE TABLE IF NOT EXISTS public.asset_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planet      varchar(50) NOT NULL,
  asset_id    uuid NOT NULL,
  event_type  varchar(50) NOT NULL,
  actor_id    uuid REFERENCES public.accounts(id),
  payload     jsonb DEFAULT '{}'::jsonb,
  signature   text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_events_lookup ON public.asset_events(planet, asset_id, created_at);
CREATE INDEX IF NOT EXISTS idx_asset_events_type ON public.asset_events(event_type);
CREATE INDEX IF NOT EXISTS idx_asset_events_actor ON public.asset_events(actor_id);

ALTER TABLE public.asset_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asset_events_select_all ON public.asset_events;
DROP POLICY IF EXISTS asset_events_insert_auth ON public.asset_events;

-- Events are publicly readable (transparency is the point of provenance)
CREATE POLICY asset_events_select_all ON public.asset_events
  FOR SELECT USING (true);

-- Only authenticated users can create events
CREATE POLICY asset_events_insert_auth ON public.asset_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Events are immutable — no updates or deletes
-- (enforced by not creating UPDATE/DELETE policies)
