import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Package, Plus } from 'lucide-react';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';
import type { CollectibleRow } from '~/lib/collectibles/constants';
import { MyCollectiblesGrid } from './_components/my-collectibles-grid';

export const metadata = {
  title: 'My Collectibles | Provenance',
};

export const dynamic = 'force-dynamic';

export default async function MyCollectiblesPage() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const { data, error } = await (client as any)
    .from('collectibles')
    .select(
      'id, account_id, title, description, category, subcategory, manufacturer, year, condition, grading_service, grading_score, serial_number, image_url, certificate_number, certificate_status, metadata, status, is_public, value, value_is_public, created_at',
    )
    .eq('account_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Collectibles] my page fetch failed', error);
  }

  const collectibles = (data ?? []) as CollectibleRow[];
  console.log('[Collectibles] my page loaded', { userId: user.id, count: collectibles.length });

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-parchment pb-12">
      <div className="border-b border-wine/15 bg-gradient-to-b from-wine/[0.06] to-transparent">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-wine/35 shrink-0" aria-hidden />
                <p className="text-[11px] font-landing font-light tracking-[0.28em] text-ink/45 uppercase">
                  Your collection
                </p>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-wine tracking-tight">
                My Collectibles
              </h1>
              <p className="text-base sm:text-lg text-ink/70 font-serif leading-relaxed">
                Every collectible you own, its certificate of ownership, and your total collection
                value. Select items to print QR codes.
              </p>
            </div>
            <div className="shrink-0">
              <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
                <Link href="/collectibles/add">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Collectible
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {collectibles.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-wine/15 bg-white p-8 sm:p-10 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-wine/10 text-wine">
              <Package className="h-7 w-7" strokeWidth={1.25} aria-hidden />
            </div>
            <h2 className="font-display text-xl font-semibold text-wine sm:text-2xl">
              No collectibles yet
            </h2>
            <p className="mt-3 font-serif text-sm text-ink/65 leading-relaxed">
              Add your first collectible to receive a Certificate of Ownership with a printable QR
              code.
            </p>
            <Button asChild className="mt-6 bg-wine text-parchment hover:bg-wine/90 font-serif">
              <Link href="/collectibles/add">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Collectible
              </Link>
            </Button>
          </div>
        ) : (
          <MyCollectiblesGrid collectibles={collectibles} />
        )}
      </div>
    </div>
  );
}
