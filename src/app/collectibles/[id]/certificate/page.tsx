import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { formatCategoryLabel, type CollectibleRow } from '~/lib/collectibles/constants';
import { CollectibleCertificate } from './_components/collectible-certificate';
import appConfig from '~/config/app.config';

export const dynamic = 'force-dynamic';

const COLLECTIBLE_SELECT = `
  id, account_id, title, description, category, subcategory, manufacturer, year,
  condition, grading_service, grading_score, serial_number, image_url,
  certificate_number, certificate_status, provenance_history, metadata, status,
  is_public, value, value_is_public, created_at, updated_at
`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = getSupabaseServerClient();
  const { data: collectible } = await (client as any)
    .from('collectibles')
    .select('title, category, image_url')
    .eq('id', id)
    .single();

  const title = collectible?.title
    ? `${collectible.title} — Certificate of Ownership | Provenance`
    : 'Certificate of Ownership | Provenance';
  const description = collectible?.title
    ? `Certificate of Ownership for "${collectible.title}"${
        collectible.category ? ` (${formatCategoryLabel(collectible.category)})` : ''
      }. Verified on Provenance.`
    : 'Verified certificate of ownership on Provenance.';
  const images = collectible?.image_url
    ? [{ url: collectible.image_url, width: 1200, height: 630, alt: collectible.title ?? 'Collectible' }]
    : [];

  return {
    title,
    description,
    openGraph: { title, description, type: 'website', images },
    twitter: {
      card: images.length ? 'summary_large_image' : 'summary',
      title,
      description,
      images: images.map((i) => i.url),
    },
  };
}

export default async function CollectibleCertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  console.log('[Collectibles] Certificate page loading', { collectibleId: id });

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  let collectible: CollectibleRow | null = null;

  if (user) {
    const { data } = await (client as any)
      .from('collectibles')
      .select(COLLECTIBLE_SELECT)
      .eq('id', id)
      .or(`account_id.eq.${user.id},and(status.eq.verified,is_public.eq.true)`)
      .maybeSingle();
    collectible = (data as CollectibleRow) ?? null;
  } else {
    const { data } = await (client as any)
      .from('collectibles')
      .select(COLLECTIBLE_SELECT)
      .eq('id', id)
      .eq('status', 'verified')
      .eq('is_public', true)
      .maybeSingle();
    collectible = (data as CollectibleRow) ?? null;
  }

  if (!collectible) {
    console.log('[Collectibles] Certificate not found or not visible, redirecting', {
      collectibleId: id,
      authenticated: !!user,
    });
    redirect('/collectibles');
  }

  const isOwner = !!(user && collectible.account_id === user.id);

  // Owner display name (best effort).
  let ownerName: string | null = null;
  try {
    const { data: account } = await client
      .from('accounts')
      .select('name')
      .eq('id', collectible.account_id)
      .single();
    ownerName = account?.name ?? null;
  } catch (err) {
    console.error('[Collectibles] owner name lookup failed', err);
  }

  const pageUrl = new URL(`/collectibles/${collectible.id}/certificate`, appConfig.url).href;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: collectible.title,
    url: pageUrl,
    ...(collectible.description ? { description: collectible.description } : {}),
    ...(collectible.image_url ? { image: collectible.image_url } : {}),
    ...(collectible.manufacturer ? { manufacturer: { '@type': 'Organization', name: collectible.manufacturer } } : {}),
    ...(collectible.certificate_number ? { productID: String(collectible.certificate_number) } : {}),
    isPartOf: { '@type': 'WebSite', name: 'Provenance', url: appConfig.url },
  };

  return (
    <>
      <script
        key="ld:collectible"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CollectibleCertificate collectible={collectible} isOwner={isOwner} ownerName={ownerName} />
    </>
  );
}
