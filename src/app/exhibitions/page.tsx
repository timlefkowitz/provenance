import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { cn } from '@kit/ui/utils';
import { getRoleLabel, getUserRole } from '~/lib/user-roles';
import { getExhibitionsForGallery } from './_actions/get-exhibitions';
import { ExhibitionsList } from './_components/exhibitions-list';
import { getExhibitionCounts } from './_helpers/get-exhibition-counts';
import {
  defaultExhibitionOwnerRole,
  getExhibitionOwnerRoleOptions,
  type ExhibitionOwnerRole,
} from './_helpers/exhibition-owner-roles';
import { isInstitutionAccount } from '~/lib/institution-account';
import { SiteLegalFooter } from '~/components/legal/site-legal-footer';
import { getTeamGalleriesForUser } from '~/app/profiles/_actions/gallery-members';

import { asUntyped } from '~/lib/supabase-untyped';
export const metadata = {
  title: 'Exhibitions | Provenance',
};

export default async function ExhibitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as: requestedOwnerRole } = await searchParams;
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const { data: account } = await client
    .from('accounts')
    .select('id, public_data')
    .eq('id', user.id)
    .single();

  if (!account) {
    redirect('/registry');
  }

  const userRole = getUserRole(account.public_data as Record<string, unknown>);
  const institutionLocked = isInstitutionAccount(account.public_data as Record<string, unknown>);
  const ownerRoleOptions = getExhibitionOwnerRoleOptions(userRole, institutionLocked);
  const ownerRole = defaultExhibitionOwnerRole(userRole, requestedOwnerRole, institutionLocked);

  const [exhibitions, teamGalleries] = await Promise.all([
    getExhibitionsForGallery(user.id, { ownerRoles: [ownerRole] }),
    getTeamGalleriesForUser(user.id),
  ]);

  // Team members see every exhibition (drafts included) of the galleries they belong to.
  const teamExhibitions = (
    await Promise.all(
      teamGalleries.map(async (gallery) => ({
        gallery,
        exhibitions: await getExhibitionsForGallery(gallery.accountId, {
          ownerRoles: ['gallery', 'institution'],
        }),
      })),
    )
  ).filter((group) => group.exhibitions.length > 0);

  const counts = await getExhibitionCounts([
    ...exhibitions.map((ex) => ex.id),
    ...teamExhibitions.flatMap((group) => group.exhibitions.map((ex) => ex.id)),
  ]);

  return (
    <div className="min-h-screen">
      <div className="border-b border-wine/15">
        <div className="container mx-auto px-4 max-w-6xl py-10 md:py-14">
          <p className="text-[11px] uppercase tracking-widest text-wine/50 font-serif mb-2">
            {getRoleLabel(ownerRole)}
          </p>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-ink tracking-tight">
            Exhibitions
          </h1>
          {ownerRoleOptions.length > 1 && (
            <OwnerRoleTabs options={ownerRoleOptions} active={ownerRole} />
          )}
        </div>
      </div>
      <div className="container mx-auto px-4 max-w-6xl py-10 pb-12">
        <ExhibitionsList
          exhibitions={exhibitions}
          counts={counts}
          galleryId={user.id}
          newExhibitionHref={`/exhibitions/new?as=${ownerRole}`}
        />
        {teamExhibitions.map(({ gallery, exhibitions: galleryExhibitions }) => (
          <section key={gallery.accountId} className="mt-20">
            <p className="text-[11px] uppercase tracking-widest text-wine/50 font-serif mb-2">
              Team exhibitions
            </p>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-ink tracking-tight mb-8">
              {gallery.name}
            </h2>
            <ExhibitionsList
              exhibitions={galleryExhibitions}
              counts={counts}
              galleryId={gallery.accountId}
              showCreate={false}
              canDelete={gallery.isAdmin}
            />
          </section>
        ))}
      </div>
      <SiteLegalFooter />
    </div>
  );
}

function OwnerRoleTabs({
  options,
  active,
}: {
  options: ExhibitionOwnerRole[];
  active: ExhibitionOwnerRole;
}) {
  return (
    <nav
      aria-label="Exhibition owner"
      className="mt-6 inline-flex rounded-full border border-wine/20 p-1 font-serif text-sm"
    >
      {options.map((role) => (
        <Link
          key={role}
          href={`/exhibitions?as=${role}`}
          aria-current={role === active ? 'page' : undefined}
          className={cn(
            'rounded-full px-4 py-1.5 transition-colors',
            role === active
              ? 'bg-wine text-parchment'
              : 'text-ink/60 hover:text-ink',
          )}
        >
          As {getRoleLabel(role).toLowerCase()}
        </Link>
      ))}
    </nav>
  );
}
