import { asUntyped } from '~/lib/supabase-untyped';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSiteData } from '../../_data/get-site-data';
import { resolveAccent } from '../../../_templates/palette';
import { ArtworkInquireModal } from '../../../_components/artwork-inquire-modal';
import { ArtworkBuyButton } from '../../../_components/artwork-buy-button';
import { isSellingEnabled } from '~/lib/stripe-connect';

export const dynamic = 'force-dynamic';

export default async function SiteArtworkPage({
  params,
}: {
  params: Promise<{ handle: string; artworkId: string }>;
}) {
  const { handle, artworkId } = await params;

  const [site, artworkData] = await Promise.all([
    getSiteData(handle),
    fetchArtwork(artworkId),
  ]);

  if (!site || !site.published_at || !artworkData) {
    notFound();
  }

  const accentColor = resolveAccent(site.theme.accent);

  const sellingEnabled = artworkData.for_sale && !artworkData.sold_at
    ? await isSellingEnabled(artworkData.account_id)
    : false;

  const showInquireButton = artworkData.inquire_enabled && !artworkData.sold_at;
  const showBuyButton = sellingEnabled && !!artworkData.stripe_price_id;
  const isSold = !!artworkData.sold_at;

  const formattedPrice = artworkData.sale_price
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: (artworkData.sale_currency ?? 'usd').toUpperCase(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number(artworkData.sale_price))
    : null;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111', background: '#fff', minHeight: '100svh' }}>
      {/* Back link */}
      <div className="max-w-4xl mx-auto px-6 pt-8">
        <Link
          href="/"
          className="text-xs uppercase tracking-widest transition-opacity hover:opacity-60"
          style={{ color: accentColor }}
        >
          ← {site.name}
        </Link>
      </div>

      {/* Artwork detail */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Image */}
          <div className="relative aspect-square bg-gray-50 overflow-hidden">
            {artworkData.image_url ? (
              <Image
                src={artworkData.image_url}
                alt={artworkData.title}
                fill
                className="object-contain"
                unoptimized
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-xs text-gray-400">No image</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold leading-snug" style={{ color: '#111' }}>
                {artworkData.title}
              </h1>
              {artworkData.artist_name && (
                <p className="text-sm mt-1" style={{ color: '#666' }}>
                  {artworkData.artist_name}
                </p>
              )}
            </div>

            {artworkData.dimensions && (
              <div>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#aaa' }}>
                  Dimensions
                </p>
                <p className="text-sm" style={{ color: '#444' }}>{artworkData.dimensions}</p>
              </div>
            )}

            {artworkData.description && (
              <div>
                <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#aaa' }}>
                  About this work
                </p>
                <p className="text-sm leading-relaxed" style={{ color: '#444' }}>
                  {artworkData.description}
                </p>
              </div>
            )}

            {/* Price */}
            {(showBuyButton || isSold) && formattedPrice && (
              <div>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#aaa' }}>
                  {isSold ? 'Sold' : 'Price'}
                </p>
                <p className="text-lg font-semibold" style={{ color: '#111' }}>
                  {formattedPrice}
                  {isSold && (
                    <span
                      className="ml-2 text-xs uppercase tracking-widest px-2 py-0.5 rounded"
                      style={{ background: '#f0f0f0', color: '#888', verticalAlign: 'middle' }}
                    >
                      Sold
                    </span>
                  )}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#aaa' }}>
                Added
              </p>
              <p className="text-sm" style={{ color: '#444' }}>
                {new Date(artworkData.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            {/* CTAs */}
            {!isSold && (showInquireButton || showBuyButton) && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingTop: '8px' }}>
                {showInquireButton && (
                  <ArtworkInquireModal
                    artworkId={artworkData.id}
                    ownerAccountId={artworkData.account_id}
                    artworkTitle={artworkData.title}
                    accentColor={accentColor}
                  />
                )}
                {showBuyButton && formattedPrice && (
                  <ArtworkBuyButton
                    artworkId={artworkData.id}
                    label={`Buy — ${formattedPrice}`}
                    accentColor={accentColor}
                  />
                )}
              </div>
            )}

            {isSold && (
              <div
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '12px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#888',
                  border: '1px solid #ddd',
                  borderRadius: '2px',
                }}
              >
                This work has been sold
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


async function fetchArtwork(artworkId: string) {
  const admin = getSupabaseServerAdminClient();
  const { data } = await asUntyped(admin)
    .from('artworks')
    .select('id, account_id, title, artist_name, image_url, description, dimensions, created_at, inquire_enabled, for_sale, sale_price, sale_currency, stripe_price_id, sold_at')
    .eq('id', artworkId)
    .eq('status', 'verified')
    .eq('is_public', true)
    .maybeSingle();
  return data ?? null;
}
