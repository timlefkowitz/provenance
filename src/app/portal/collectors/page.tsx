import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getUserGalleryProfiles } from '~/app/artworks/add/_actions/get-user-gallery-profiles';
import { loadGalleryCollectorData } from '~/lib/collectors/load-gallery-collector-data';
import { formatMoney } from '~/lib/portal-graphs/types';
import { CollectorsTable } from './_components/collectors-table';
import { SellThroughTable } from './_components/sell-through-table';
import { RepeatCollectorsPanel } from './_components/repeat-collectors-panel';

export const metadata = {
  title: 'Collectors | Provenance',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PortalCollectorsPage() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) redirect('/auth/sign-in');

  const galleryProfiles = await getUserGalleryProfiles(user.id);
  const galleryProfileIds = galleryProfiles
    .map((p: Record<string, unknown>) => p.id)
    .filter((id: unknown): id is string => typeof id === 'string');

  // Gallery owners and team members only.
  if (!galleryProfileIds.length) redirect('/portal');

  console.log('[Collectors] page loading', { userId: user.id, galleryProfileIds });
  const { exhibitions, collectors, sellThrough } = await loadGalleryCollectorData(galleryProfileIds);

  const galleryName = (galleryProfiles[0] as { name?: string | null } | undefined)?.name ?? null;
  const repeatCollectors = collectors.filter((c) => c.isRepeat);
  const totalSold = collectors.reduce((acc, c) => acc + c.totalSpentCents, 0);
  const averagePerCollector = collectors.length ? Math.round(totalSold / collectors.length) : 0;

  const tiles = [
    { label: 'Collectors', value: String(collectors.length) },
    { label: 'Repeat collectors', value: String(repeatCollectors.length) },
    { label: 'Total sold', value: formatMoney(totalSold) },
    { label: 'Average per collector', value: formatMoney(averagePerCollector) },
  ];

  return (
    <div className="min-h-screen bg-parchment/30">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-sm font-serif text-ink/50 hover:text-wine transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portal
        </Link>

        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold text-wine">
            {galleryName ? `${galleryName} Collectors` : 'Your Collectors'}
          </h1>
          <p className="font-serif text-ink/50 text-sm">
            Everyone who has bought from your gallery, what they spent, and which shows brought them in.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-xl border border-wine/20 bg-white/70 p-4">
              <p className="text-[11px] uppercase tracking-wide text-ink/50 font-serif">{tile.label}</p>
              <p className="mt-1 text-2xl font-display font-bold text-wine tabular-nums">{tile.value}</p>
            </div>
          ))}
        </div>

        {collectors.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-wine/20 mx-auto mb-4" />
            <p className="font-serif text-ink/60 text-base mb-2">No recorded sales yet.</p>
            <p className="font-serif text-ink/40 text-sm max-w-sm mx-auto">
              Mark an artwork as sold from its certificate page and the buyer will appear here.
            </p>
          </div>
        ) : (
          <>
            <RepeatCollectorsPanel collectors={repeatCollectors} exhibitions={exhibitions} />
            <CollectorsTable collectors={collectors} exhibitions={exhibitions} />
          </>
        )}

        <SellThroughTable exhibitions={exhibitions} sellThrough={sellThrough} />
      </div>
    </div>
  );
}
