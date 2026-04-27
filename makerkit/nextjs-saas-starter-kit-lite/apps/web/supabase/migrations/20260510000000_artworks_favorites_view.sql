/*
 * -------------------------------------------------------
 * View: artworks_with_favorites
 *
 * Joins artworks with their aggregate favorite counts so the
 * /artworks feed can sort by popularity and trending (7-day)
 * without N+1 queries. Queried via the service-role admin client,
 * which bypasses RLS.
 * -------------------------------------------------------
 */

CREATE OR REPLACE VIEW public.artworks_with_favorites AS
SELECT
    a.id,
    a.account_id,
    a.title,
    a.artist_name,
    a.image_url,
    a.medium,
    a.created_at,
    a.certificate_number,
    a.status,
    a.is_public,
    a.artist_account_id,
    a.artist_profile_id,
    COUNT(af.id)                                                               AS favorites_count,
    COUNT(af.id) FILTER (
        WHERE af.created_at >= NOW() - INTERVAL '7 days'
    )                                                                          AS trending_count
FROM public.artworks a
LEFT JOIN public.artwork_favorites af ON af.artwork_id = a.id
GROUP BY a.id;

COMMENT ON VIEW public.artworks_with_favorites IS
    'Artworks enriched with total and 7-day trending favorite counts';

-- Grant read access so authenticated and anonymous roles can use it.
-- (Service-role queries from the admin client don't need explicit grants,
--  but granting here allows future RLS-aware queries if needed.)
GRANT SELECT ON public.artworks_with_favorites TO authenticated;
GRANT SELECT ON public.artworks_with_favorites TO anon;
