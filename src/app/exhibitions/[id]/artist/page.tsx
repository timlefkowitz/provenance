import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import pathsConfig from '~/config/paths.config';
import { EditorialPageHeader } from '~/components/editorial-form';
import { getArtistWorkspace } from '../../_actions/exhibition-artist-workspace';
import { SHOW_TYPE_LABELS } from '../../_helpers/show-collaboration';
import { ArtistWorkspaceClient } from './artist-workspace-client';

export const metadata = {
  title: 'Your show | Provenance',
};

export default async function ArtistShowPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ added?: string }>;
}) {
  const { id } = await params;
  const { added } = await searchParams;
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser();

  if (!user) {
    redirect(`${pathsConfig.auth.signIn}?next=${encodeURIComponent(`/exhibitions/${id}/artist`)}`);
  }

  const result = await getArtistWorkspace(id);
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
        <h1 className="text-wine text-xl mb-2">Can&apos;t open this show</h1>
        <p className="text-ink/80 mb-6">{result.error}</p>
        <Link href="/exhibitions" className="text-wine underline underline-offset-2">
          Your exhibitions
        </Link>
      </div>
    );
  }

  const { workspace } = result;
  const addedCount = Number.parseInt(added ?? '', 10);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <EditorialPageHeader
        eyebrow={[
          workspace.showType ? SHOW_TYPE_LABELS[workspace.showType] : 'Exhibition',
          workspace.galleryName,
        ]
          .filter(Boolean)
          .join(' · ')}
        title={workspace.values.title ?? 'Exhibition'}
        description={
          workspace.canEditShow
            ? 'Fill in your show. Anything the gallery has set, you can ask them to change.'
            : 'Tell the gallery about your part of the show and add your works. Ask the gallery if any show details need changing.'
        }
      />
      {Number.isFinite(addedCount) && addedCount > 0 && (
        <p className="mb-6 border border-emerald-200 bg-emerald-50 px-4 py-3 font-serif text-sm text-emerald-900">
          {addedCount === 1 ? 'Your artwork was added to the show.' : `${addedCount} artworks were added to the show.`}
        </p>
      )}
      <ArtistWorkspaceClient workspace={workspace} />
    </div>
  );
}
