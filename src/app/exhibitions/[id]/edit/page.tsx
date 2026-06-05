import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { getExhibitionWithDetails } from '../../_actions/get-exhibitions';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { ExhibitionForm } from '../../_components/exhibition-form';
import { ExhibitionDetails } from '../../_components/exhibition-details';

export const metadata = {
  title: 'Edit Exhibition | Provenance',
};

export default async function EditExhibitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Verify user is a gallery
  const { data: account } = await client
    .from('accounts')
    .select('public_data')
    .eq('id', user.id)
    .single();

  if (!account) {
    redirect('/registry');
  }

  const userRole = getUserRole(account.public_data as Record<string, any>);
  const allowedRoles = new Set([
    USER_ROLES.GALLERY,
    USER_ROLES.INSTITUTION,
    USER_ROLES.ARTIST,
    USER_ROLES.COLLECTOR,
  ]);
  if (!userRole || !allowedRoles.has(userRole)) {
    redirect('/registry');
  }

  // Get exhibition with details
  const exhibition = await getExhibitionWithDetails(id, { viewerUserId: user.id });

  if (!exhibition || !(await canManageExhibition(user.id, exhibition.gallery_id))) {
    redirect('/exhibitions');
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Edit Exhibition
        </h1>
        <p className="text-ink/70 font-serif">
          Update exhibition details
        </p>
      </div>

      <ExhibitionForm exhibition={exhibition} />

      <section id="artworks" className="mt-16 pt-12 border-t border-wine/15 scroll-mt-8">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-widest text-wine/50 font-serif mb-2">
            Draft listings
          </p>
          <h2 className="text-2xl font-display font-bold text-ink">
            Artworks in this exhibition
          </h2>
          <p className="text-ink/55 font-serif text-sm mt-2 max-w-2xl">
            Search and add quick listings here. Drafts stay visible only to you until you publish each work.
          </p>
        </div>
        <ExhibitionDetails exhibition={exhibition} isOwner />
      </section>
    </div>
  );
}

