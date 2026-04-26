-- Migration: Certificate Links and Chain Root ID
-- Purpose: Add chain_root_id for O(1) root lookup, certificate_links for bidirectional queries,
--          new claim kinds for COO-first and COS-first flows, and provenance event deduplication

-- ============================================================================
-- Part 1: Add chain_root_id column to artworks
-- ============================================================================

ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS chain_root_id uuid REFERENCES public.artworks(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.artworks.chain_root_id IS 
  'Precomputed root of the certificate chain. NULL if this artwork is the root certificate.';

CREATE INDEX IF NOT EXISTS artworks_chain_root_id_idx ON public.artworks(chain_root_id);

-- ============================================================================
-- Part 2: Create certificate_links junction table for bidirectional queries
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.certificate_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_artwork_id uuid NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  linked_artwork_id uuid NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  link_type text NOT NULL CHECK (link_type IN ('parent', 'sibling', 'child')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(source_artwork_id, linked_artwork_id, link_type)
);

COMMENT ON TABLE public.certificate_links IS 
  'Junction table for bidirectional certificate relationships. Allows efficient queries from any certificate to find related certificates.';

COMMENT ON COLUMN public.certificate_links.link_type IS 
  'Relationship type: parent (source links up to linked), child (source links down to linked), sibling (same level in chain)';

CREATE INDEX IF NOT EXISTS certificate_links_source_idx ON public.certificate_links(source_artwork_id);
CREATE INDEX IF NOT EXISTS certificate_links_linked_idx ON public.certificate_links(linked_artwork_id);
CREATE INDEX IF NOT EXISTS certificate_links_type_idx ON public.certificate_links(link_type);

-- Enable RLS
ALTER TABLE public.certificate_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can see links for artworks they own
CREATE POLICY "Users can view certificate links for their artworks"
  ON public.certificate_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.artworks a
      WHERE (a.id = source_artwork_id OR a.id = linked_artwork_id)
        AND a.account_id IN (
          SELECT aa.account_id FROM public.accounts_memberships aa
          WHERE aa.user_id = (SELECT auth.uid())
        )
    )
  );

-- Service role can do everything
CREATE POLICY "Service role has full access to certificate_links"
  ON public.certificate_links
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- Part 3: Add new claim kinds for COO-first and COS-first flows
-- ============================================================================

-- Drop existing constraint if it exists
ALTER TABLE public.certificate_claim_invites
  DROP CONSTRAINT IF EXISTS certificate_claim_invites_claim_kind_check;

-- Add updated constraint with new claim kinds
ALTER TABLE public.certificate_claim_invites
  ADD CONSTRAINT certificate_claim_invites_claim_kind_check
  CHECK (claim_kind IN (
    -- Existing claim kinds (COA-first flows)
    'owner_coownership_from_coa',
    'artist_coa_from_show',
    'artist_coa_from_coo',
    'gallery_show_from_coa',
    'gallery_cos_from_artist',
    -- New: COO-first flows (Collector creates root)
    'artist_coa_from_coo_root',
    'gallery_cos_from_coo',
    -- New: COS-first flows (Gallery creates root)
    'artist_coa_from_cos_root',
    'owner_coo_from_cos'
  ));

-- ============================================================================
-- Part 4: Add unique constraint for provenance event deduplication
-- ============================================================================

-- Add related_artwork_id column if it doesn't exist (for tracking which certificate caused the event)
ALTER TABLE public.provenance_events
  ADD COLUMN IF NOT EXISTS related_artwork_id uuid REFERENCES public.artworks(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.provenance_events.related_artwork_id IS 
  'The artwork that caused this provenance event (e.g., the newly created linked certificate)';

-- Create partial unique index for deduplication (only for propagated events)
CREATE UNIQUE INDEX IF NOT EXISTS provenance_events_dedup_idx 
  ON public.provenance_events (artwork_id, event_type, related_artwork_id)
  WHERE related_artwork_id IS NOT NULL;

-- ============================================================================
-- Part 5: Backfill chain_root_id for existing certificates
-- ============================================================================

-- Use recursive CTE to find root for each certificate and update chain_root_id
WITH RECURSIVE chain AS (
  -- Base case: certificates with no source (they are roots)
  SELECT id, source_artwork_id, id as root_id, 0 as depth
  FROM public.artworks
  WHERE source_artwork_id IS NULL
  
  UNION ALL
  
  -- Recursive case: certificates with a source
  SELECT a.id, a.source_artwork_id, c.root_id, c.depth + 1
  FROM public.artworks a
  INNER JOIN chain c ON a.source_artwork_id = c.id
  WHERE c.depth < 64
)
UPDATE public.artworks a
SET chain_root_id = c.root_id
FROM chain c
WHERE a.id = c.id
  AND a.source_artwork_id IS NOT NULL
  AND a.chain_root_id IS NULL;

-- ============================================================================
-- Part 6: Populate certificate_links from existing source_artwork_id relationships
-- ============================================================================

-- Create child links (parent → child)
INSERT INTO public.certificate_links (source_artwork_id, linked_artwork_id, link_type)
SELECT source_artwork_id, id, 'child'
FROM public.artworks
WHERE source_artwork_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Create parent links (child → parent) for reverse lookups
INSERT INTO public.certificate_links (source_artwork_id, linked_artwork_id, link_type)
SELECT id, source_artwork_id, 'parent'
FROM public.artworks
WHERE source_artwork_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Create sibling links (certificates that share the same parent)
INSERT INTO public.certificate_links (source_artwork_id, linked_artwork_id, link_type)
SELECT DISTINCT a1.id, a2.id, 'sibling'
FROM public.artworks a1
INNER JOIN public.artworks a2 ON a1.source_artwork_id = a2.source_artwork_id
WHERE a1.source_artwork_id IS NOT NULL
  AND a1.id != a2.id
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Part 7: Create helper function for efficient chain queries
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_certificate_chain(artwork_uuid uuid)
RETURNS TABLE(
  artwork_id uuid,
  account_id uuid,
  certificate_type text,
  title text,
  is_root boolean,
  depth int
) AS $$
BEGIN
  RETURN QUERY
  WITH root_id AS (
    SELECT COALESCE(a.chain_root_id, a.id) as rid
    FROM public.artworks a
    WHERE a.id = artwork_uuid
  )
  SELECT 
    a.id as artwork_id,
    a.account_id,
    a.certificate_type,
    a.title,
    (a.chain_root_id IS NULL) as is_root,
    CASE 
      WHEN a.chain_root_id IS NULL THEN 0
      ELSE 1 + (
        SELECT COUNT(*)::int 
        FROM public.artworks p 
        WHERE p.id = a.source_artwork_id
      )
    END as depth
  FROM public.artworks a, root_id r
  WHERE a.id = r.rid 
     OR a.chain_root_id = r.rid
  ORDER BY is_root DESC, depth ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_certificate_chain IS 
  'Returns all certificates in the same chain as the given artwork, ordered by root first then depth';
