import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { cn } from '@kit/ui/utils';
import { getUserRole } from '~/lib/user-roles';
import { getExhibitionsForGallery } from './_actions/get-exhibitions';
import { ExhibitionsList } from './_components/exhibitions-list';
import { getExhibitionCounts } from './_helpers/get-exhibition-counts';
import {
  defaultExhibitionOwnerRole,
  getExhibitionOwnerLabel,
  getExhibitionOwnerRoleOptions,
  type ExhibitionOwnerRole,
} from './_helpers/exhibition-owner-roles';
import { isInstitutionAccount } from '~/lib/institution-account';
import { SiteLegalFooter } from '~/components/legal/site-legal-footer';
import { getTeamGalleriesForUser } from '~/app/profiles/_actions/gallery-members';
import { listMyInvitedShows } from './_actions/exhibition-artist-workspace';
import { SHOW_TYPE_LABELS } from './_helpers/show-collaboration';
import { formatExhibitionDateRange } from '~/lib/certificate-claims/send-certificate-invite-email';

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

  const [exhibitions, teamGalleries, invitedShows] = await Promise.all([
    getExhibitionsForGallery(user.id, { ownerRoles: [ownerRole] }),
    getTeamGalleriesForUser(user.id),
    listMyInvitedShows(),
  ]);
  const canInvite = ownerRole !== 'collector';

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
            {getExhibitionOwnerLabel(ownerRole)}
          </p>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-ink tracking-tight">
            Exhibitions
          </h1>
          {ownerRoleOptions.length > 1 && (
            <OwnerRoleTabs options={ownerRoleOptions} active={ownerRole} />
          )}
          {canInvite && (
            <div className="mt-6 flex flex-wrap gap-3 font-serif text-sm">
              <Link
                href={`/exhibitions/new?as=${ownerRole}&type=solo`}
                className="rounded-full border border-wine/25 px-4 py-1.5 text-wine hover:bg-wine/5"
              >
                Invite an artist for a solo show
              </Link>
              <Link
                href={`/exhibitions/new?as=${ownerRole}&type=group`}
                className="rounded-full border border-wine/25 px-4 py-1.5 text-wine hover:bg-wine/5"
              >
                Plan a group show
              </Link>
              <Link
                href={`/exhibitions/new?as=${ownerRole}&type=open_call`}
                className="rounded-full border border-wine/25 px-4 py-1.5 text-wine hover:bg-wine/5"
              >
                Open call
              </Link>
            </div>
          )}
        </div>
      </div>
      <div className="container mx-auto px-4 max-w-6xl py-10 pb-12">
        {invitedShows.length > 0 && (
          <section className="mb-16">
            <p className="text-[11px] uppercase tracking-widest text-wine/50 font-serif mb-2">
              You&apos;re showing in
            </p>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-ink tracking-tight mb-6">
              Shows you&apos;ve been invited to
            </h2>
            <ul className="divide-y divide-wine/10 border border-wine/15">
              {invitedShows.map((show) => (
                <li key={show.exhibitionId}>
                  <Link
                    href={`/exhibitions/${show.exhibitionId}/artist`}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 font-serif hover:bg-wine/5"
                  >
                    <span className="text-ink">
                      {show.title}
                      {show.galleryName && (
                        <span className="text-ink/50"> · {show.galleryName}</span>
                      )}
                    </span>
                    <span className="text-xs text-ink/55">
                      {show.showType ? `${SHOW_TYPE_LABELS[show.showType]} · ` : ''}
                      {formatExhibitionDateRange(show.startDate, null)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
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
          As {getExhibitionOwnerLabel(role).toLowerCase()}
        </Link>
      ))}
    </nav>
  );
}
