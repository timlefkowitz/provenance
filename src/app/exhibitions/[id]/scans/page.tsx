import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, MapPin, ScanLine } from 'lucide-react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getExhibitionScans } from '../../_helpers/exhibition-scans';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'QR scans | Provenance',
};

function formatDate(value: string | null, withYear = true) {
  if (!value) return null;
  const bare = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = new Date(bare ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: bare ? 'UTC' : undefined,
  });
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

/**
 * How often visitors scanned each work's QR code during the show. Organisers
 * (gallery, institution, curator and their team) see every work; artists see
 * their own. Counts and city-level places only — see exhibition-scan-stats.
 */
export default async function ExhibitionScansPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=/exhibitions/${id}/scans`);

  const data = await getExhibitionScans(user.id, id);
  if (!data) notFound();

  const { exhibition, works, scope, window } = data;
  const duringShow = works.reduce((n, w) => n + w.stats.duringShow, 0);
  const people = works.reduce((n, w) => n + w.stats.peopleDuringShow, 0);
  const scanned = works.filter((w) => w.stats.duringShow > 0).length;
  const top = works[0]?.stats.duringShow ? works[0] : null;

  const from = formatDate(window.from);
  const to = formatDate(window.to);
  const period = from ? (to ? `${from} – ${to}` : `since ${from}`) : 'since each work joined the show';

  return (
    <div className="min-h-screen">
      <div className="border-b border-wine/15">
        <div className="container mx-auto max-w-6xl px-4 py-10 md:py-14">
          <Link
            href={`/exhibitions/${id}`}
            className="mb-6 inline-flex items-center gap-1.5 font-serif text-xs text-ink/50 hover:text-wine"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to exhibition
          </Link>
          <p className="mb-2 font-serif text-[11px] uppercase tracking-widest text-wine/50">
            QR scans{scope === 'artist' ? ' · your works' : ''}
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink md:text-5xl">
            {exhibition.title}
          </h1>
          <p className="mt-4 max-w-2xl font-serif text-sm leading-relaxed text-ink/60">
            How many visitors scanned each work&apos;s QR code during the show ({period}). A work
            counts scans of its wall label and of the artist&apos;s certificate it was shown from.
            Scans by a certificate&apos;s own holder aren&apos;t counted, and places are shown by
            city only.
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Scans during the show', value: duringShow.toLocaleString('en-US') },
              { label: 'People', value: people.toLocaleString('en-US') },
              {
                label: 'Works scanned',
                value: `${scanned.toLocaleString('en-US')} of ${works.length.toLocaleString('en-US')}`,
              },
              { label: 'Most scanned', value: top ? top.title : '—' },
            ].map((s) => (
              <div key={s.label} className="border border-wine/15 bg-parchment/40 p-4">
                <dt className="font-serif text-[11px] uppercase tracking-widest text-ink/50">
                  {s.label}
                </dt>
                <dd className="mt-1 truncate font-display text-2xl font-bold text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-10 pb-16">
        {works.length === 0 ? (
          <p className="font-serif text-sm text-ink/60">No works in the show yet.</p>
        ) : (
          <ul className="divide-y divide-wine/10 border-y border-wine/10">
            {works.map((w) => (
              <li key={w.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start">
                <Link href={`/artworks/${w.id}/certificate`} className="flex min-w-0 flex-1 gap-4">
                  {w.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.imageUrl}
                      alt=""
                      className="h-16 w-16 flex-shrink-0 border border-wine/10 object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 flex-shrink-0 border border-wine/10 bg-parchment/60" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-semibold text-ink hover:text-wine">
                      {w.title}
                    </p>
                    {w.artistName && (
                      <p className="truncate font-serif text-sm text-ink/60">{w.artistName}</p>
                    )}
                  </div>
                </Link>

                <div className="flex flex-col gap-1 sm:w-64 sm:text-right">
                  <p className="flex items-center gap-1.5 font-serif text-sm text-ink sm:justify-end">
                    <ScanLine className="h-4 w-4 text-wine" />
                    <span className="font-semibold">
                      {w.stats.duringShow > 0 ? plural(w.stats.duringShow, 'scan') : 'No scans yet'}
                    </span>
                    {w.stats.peopleDuringShow > 0 && (
                      <span className="text-ink/60">
                        {' '}
                        by {plural(w.stats.peopleDuringShow, 'person', 'people')}
                      </span>
                    )}
                  </p>
                  {w.stats.lastScannedAt && (
                    <p className="font-serif text-xs text-ink/50">
                      Last {formatDate(w.stats.lastScannedAt)}
                    </p>
                  )}
                  {w.stats.allTime > w.stats.duringShow && (
                    <p className="font-serif text-xs text-ink/50">
                      {plural(w.stats.allTime, 'scan')} in all
                    </p>
                  )}
                </div>

                {w.stats.places.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5 sm:w-56 sm:justify-end">
                    {w.stats.places.map((p) => (
                      <li
                        key={p.label}
                        className="inline-flex items-center gap-1 border border-wine/15 px-2 py-0.5 font-serif text-xs text-ink/70"
                      >
                        <MapPin className="h-3 w-3 text-wine/60" />
                        {p.label}
                        <span className="text-ink/40">{p.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
