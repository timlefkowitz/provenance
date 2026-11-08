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
 * Every work in the show in one place, whoever holds its certificate. The
 * gallery edits its own Certificates of Show directly; for a certificate held
 * by someone else (an artist's COA) the curator suggests changes, which the
 * holder accepts or declines from their portal.
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
  const { exhibition, works } = show;

  const galleryCount = works.filter((w) => w.editHref).length;
  const otherCount = works.length - galleryCount;
  const coaCount = works.filter(
    (w) => !w.editHref && w.certificateType === CERTIFICATE_TYPES.AUTHENTICITY,
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
            certificates you can edit, {otherCount} held by{' '}
            {coaCount === otherCount ? 'the artists' : 'artists and others'}. Changes to a certificate
            someone else holds are sent to them to accept or decline.
          </p>
        </div>
      </div>
      <div className="container mx-auto max-w-6xl px-4 py-10 pb-16">
        <CuratorWorksList works={works} exhibitionId={id} />
      </div>
    </div>
  );
}
