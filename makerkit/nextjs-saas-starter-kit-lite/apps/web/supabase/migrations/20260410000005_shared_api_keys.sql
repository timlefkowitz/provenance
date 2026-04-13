-- Shared: API Keys table for the unified verification API
CREATE TABLE IF NOT EXISTS public.api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  key_hash      text NOT NULL UNIQUE,
  name          varchar(255) NOT NULL,
  scopes        text[] DEFAULT '{}',
  planet        varchar(50),
  rate_limit    integer DEFAULT 1000,
  is_active     boolean DEFAULT true,
  last_used_at  timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_account ON public.api_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_keys_select_own ON public.api_keys;
DROP POLICY IF EXISTS api_keys_insert_own ON public.api_keys;
DROP POLICY IF EXISTS api_keys_update_own ON public.api_keys;
DROP POLICY IF EXISTS api_keys_delete_own ON public.api_keys;

-- Users can only see their own API keys
CREATE POLICY api_keys_select_own ON public.api_keys
  FOR SELECT USING (account_id = auth.uid());

CREATE POLICY api_keys_insert_own ON public.api_keys
  FOR INSERT WITH CHECK (account_id = auth.uid());

CREATE POLICY api_keys_update_own ON public.api_keys
  FOR UPDATE USING (account_id = auth.uid());

CREATE POLICY api_keys_delete_own ON public.api_keys
  FOR DELETE USING (account_id = auth.uid());
