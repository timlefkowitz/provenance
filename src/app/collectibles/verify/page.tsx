import Link from 'next/link';
import { CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';
import { formatCategoryLabel } from '~/lib/collectibles/constants';

export const metadata = {
  title: 'Verify a Collectible | Provenance',
};

export const dynamic = 'force-dynamic';

export default async function VerifyCollectiblePage({
  searchParams,
}: {
  searchParams?: Promise<{ cert?: string }>;
}) {
  const resolved = (await searchParams) ?? {};
  const cert = (resolved.cert ?? '').trim();

  let result:
    | { found: true; id: string; title: string; category: string | null; isPublic: boolean }
    | { found: false }
    | null = null;

  if (cert) {
    const client = getSupabaseServerClient();
    console.log('[Collectibles] verify lookup', { cert });
    // Only public, verified collectibles are discoverable by certificate number.
    const { data, error } = await (client as any)
      .from('collectibles')
      .select('id, title, category, is_public, status')
      .eq('certificate_number', cert)
      .eq('status', 'verified')
      .eq('is_public', true)
      .maybeSingle();

    if (error) {
      console.error('[Collectibles] verify lookup failed', error);
    }
    result = data
      ? {
          found: true,
          id: data.id as string,
          title: data.title as string,
          category: (data.category as string) ?? null,
          isPublic: data.is_public as boolean,
        }
      : { found: false };
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-parchment">
      <div className="container mx-auto max-w-xl px-4 py-12 sm:py-16">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-wine/10 text-wine">
            <ShieldCheck className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="text-3xl font-display font-bold text-wine tracking-tight">
            Verify a Collectible
          </h1>
          <p className="mt-3 text-ink/70 font-serif leading-relaxed">
            Enter a certificate number to confirm the authenticity and ownership record of any
            registered collectible.
          </p>
        </div>

        <form method="get" className="flex items-center gap-2 max-w-md mx-auto">
          <input
            type="text"
            name="cert"
            defaultValue={cert}
            placeholder="e.g. PROV-XXXXXXXX"
            className="flex-1 rounded-md border border-wine/30 bg-white px-4 py-2 text-sm font-serif placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-wine/30"
          />
          <Button type="submit" className="bg-wine text-parchment hover:bg-wine/90 font-serif">
            Verify
          </Button>
        </form>

        {result && (
          <div className="mt-8">
            {result.found ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-3" />
                <p className="font-display text-lg text-green-800">Verified</p>
                <p className="font-serif text-ink/70 mt-1">
                  <strong>{result.title}</strong>
                  {result.category ? ` · ${formatCategoryLabel(result.category)}` : ''}
                </p>
                <Button asChild className="mt-4 bg-wine text-parchment hover:bg-wine/90 font-serif">
                  <Link href={`/collectibles/${result.id}/certificate`}>View Certificate</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
                <ShieldAlert className="h-8 w-8 text-amber-600 mx-auto mb-3" />
                <p className="font-display text-lg text-amber-800">Not found</p>
                <p className="font-serif text-ink/70 mt-1">
                  We couldn&apos;t find a public collectible with certificate number{' '}
                  <span className="font-mono">{cert}</span>. Check the number and try again.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
