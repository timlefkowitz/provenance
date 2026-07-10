import { asUntyped } from '~/lib/supabase-untyped';
import Link from 'next/link';
import { Plus, Package, ShieldCheck } from 'lucide-react';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';
import {
  COLLECTIBLE_CATEGORIES,
  formatCategoryLabel,
  type CollectibleRow,
} from '~/lib/collectibles/constants';
import { formatMoneyCents, parseDeclaredValueCents } from '~/lib/collectibles/value';

export const metadata = {
  title: 'Collectibles | Provenance',
};

export const dynamic = 'force-dynamic';

export default async function CollectiblesPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const resolved = (await searchParams) ?? {};
  const activeCategory =
    resolved.category && COLLECTIBLE_CATEGORIES.includes(resolved.category as never)
      ? resolved.category
      : null;

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  let query = asUntyped(client)
    .from('collectibles')
    .select(
      'id, account_id, title, category, subcategory, image_url, certificate_number, value, value_is_public, is_public, status, created_at',
    )
    .eq('status', 'verified')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(48);

  if (activeCategory) {
    query = query.eq('category', activeCategory);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Collectibles] browse fetch failed', error);
  }
  const collectibles = (data ?? []) as CollectibleRow[];
  console.log('[Collectibles] browse loaded', {
    count: collectibles.length,
    activeCategory,
  });

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-parchment pb-12">
      {/* Hero */}
      <div className="border-b border-wine/15 bg-gradient-to-b from-wine/[0.06] to-transparent">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14 text-center">
          <p className="text-[11px] font-landing font-light tracking-[0.28em] text-ink/45 uppercase mb-3">
            Provenance Collectibles
          </p>
          <h1 className="text-3xl sm:text-5xl font-display font-bold text-wine tracking-tight mb-4">
            Authenticate &amp; Track Your Collectibles
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-ink/70 font-serif leading-relaxed">
            Coins, cards, comics, memorabilia, watches and more. Add a collectible, get a
            Certificate of Ownership, and track it with a printable QR code.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
              <Link href="/collectibles/add">
                <Plus className="h-4 w-4 mr-2" />
                Add Collectible
              </Link>
            </Button>
            {user && (
              <Button asChild variant="outline" className="font-serif border-wine/30 hover:bg-wine/10">
                <Link href="/collectibles/my">
                  <Package className="h-4 w-4 mr-2" />
                  My Collectibles
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="font-serif border-wine/30 hover:bg-wine/10">
              <Link href="/collectibles/verify">
                <ShieldCheck className="h-4 w-4 mr-2" />
                Verify
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Link
            href="/collectibles"
            className={`rounded-full border px-4 py-1.5 text-sm font-serif transition-colors ${
              !activeCategory
                ? 'border-wine bg-wine text-parchment'
                : 'border-wine/25 text-ink/70 hover:border-wine/50 hover:bg-wine/5'
            }`}
          >
            All
          </Link>
          {COLLECTIBLE_CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/collectibles?category=${category}`}
              className={`rounded-full border px-4 py-1.5 text-sm font-serif transition-colors ${
                activeCategory === category
                  ? 'border-wine bg-wine text-parchment'
                  : 'border-wine/25 text-ink/70 hover:border-wine/50 hover:bg-wine/5'
              }`}
            >
              {formatCategoryLabel(category)}
            </Link>
          ))}
        </div>

        {/* Grid */}
        {collectibles.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-wine/15 bg-white p-8 sm:p-10 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-wine/10 text-wine">
              <Package className="h-7 w-7" strokeWidth={1.25} aria-hidden />
            </div>
            <h2 className="font-display text-xl font-semibold text-wine">
              {activeCategory
                ? `No public ${formatCategoryLabel(activeCategory).toLowerCase()} yet`
                : 'No public collectibles yet'}
            </h2>
            <p className="mt-3 font-serif text-sm text-ink/65 leading-relaxed">
              Be the first — add a collectible and choose to make it public.
            </p>
            <Button asChild className="mt-6 bg-wine text-parchment hover:bg-wine/90 font-serif">
              <Link href="/collectibles/add">
                <Plus className="h-4 w-4 mr-2" />
                Add Collectible
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {collectibles.map((c) => {
              const valueCents = c.value_is_public ? parseDeclaredValueCents(c.value) : 0;
              return (
                <Link
                  key={c.id}
                  href={`/collectibles/${c.id}/certificate`}
                  className="group rounded-xl border border-wine/15 bg-white overflow-hidden hover:border-wine/40 transition-colors"
                >
                  <div className="aspect-square bg-parchment">
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.image_url}
                        alt={c.title}
                        className="w-full h-full object-cover group-hover:opacity-95"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ink/30 font-serif">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-serif font-semibold text-ink truncate">{c.title}</p>
                    <p className="text-xs text-ink/60 font-serif">
                      {c.category ? formatCategoryLabel(c.category) : 'Collectible'}
                    </p>
                    {valueCents > 0 && (
                      <p className="text-sm font-display text-wine mt-1">
                        {formatMoneyCents(valueCents)}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
