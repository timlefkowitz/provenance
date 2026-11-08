import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import { loadCuratorWorks } from '../../_helpers/load-curator-works';
import { CuratorWorksList } from './_components/curator-works-list';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Curator view | Provenance',
};

/**
 * Every work in the show in one place, whoever holds its certificate. A work
 * selected from an artist's COA gets the show's Certificate of Show, which the
 * curator edits with the artist's approval (the artist accepts or declines
 * from their portal). The curator's other certificates are edited directly;
 * for a certificate held by someone else the curator suggests changes.
 */
export default async function CurateExhibitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) redirect(`/auth/sign-in?next=/exhibitions/${id}/curate`);

  const show = await loadCuratorWorks(user.id, id);
  if (!show) notFound();
  const { exhibition, works, awaitingCosCount } = show;

  const galleryCount = works.filter((w) => w.editable).length;
  const otherCount = works.length - galleryCount;
  const coaCount = works.filter(
    (w) => !w.editable && w.certificateType === CERTIFICATE_TYPES.AUTHENTICITY,
  ).length;

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
            Curator view
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink md:text-5xl">
            {exhibition.title as string}
          </h1>
          <p className="mt-4 max-w-2xl font-serif text-sm leading-relaxed text-ink/60">
            {works.length} work{works.length === 1 ? '' : 's'} in the show: {galleryCount} with
            certificates you hold, {otherCount} held by{' '}
            {coaCount === otherCount ? 'the artists' : 'artists and others'}. Changes to a
            Certificate of Show issued from an artist&apos;s certificate are sent to the artist to
            approve; changes to a certificate someone else holds are sent to them.
          </p>
        </div>
      </div>
      <div className="container mx-auto max-w-6xl px-4 py-10 pb-16">
        <CuratorWorksList works={works} exhibitionId={id} awaitingCosCount={awaitingCosCount} />
      </div>
    </div>
  );
}
