import { asUntyped } from '~/lib/supabase-untyped';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Card, CardContent } from '@kit/ui/card';
import { formatMoneyCents, sumCollectibleValueCents } from '~/lib/collectibles/value';

/**
 * Portal card showing the user's collectibles count and total declared value.
 * Hides itself when the user has no collectibles.
 */
export async function CollectiblesValueCard({ userId }: { userId: string }) {
  const client = getSupabaseServerClient();
  const { data, error } = await asUntyped(client)
    .from('collectibles')
    .select('value')
    .eq('account_id', userId);

  if (error) {
    console.error('[Collectibles] portal value card fetch failed', error);
    return null;
  }

  const rows = (data ?? []) as { value: string | null }[];
  if (rows.length === 0) {
    return null;
  }

  const totalCents = sumCollectibleValueCents(rows);
  console.log('[Collectibles] portal value card', { userId, count: rows.length, totalCents });

  return (
    <Card className="border-wine/20 bg-parchment/60">
      <CardContent className="p-6">
        <Link href="/collectibles/my" className="block">
          <div className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity">
            <div>
              <p className="text-sm text-ink/60 font-serif mb-1">Collectibles Value</p>
              <p className="text-3xl font-display font-bold text-wine">
                {formatMoneyCents(totalCents)}
              </p>
              <p className="text-xs text-ink/50 font-serif mt-1">
                {rows.length} collectible{rows.length === 1 ? '' : 's'}
              </p>
            </div>
            <Package className="h-8 w-8 text-wine/50" />
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
