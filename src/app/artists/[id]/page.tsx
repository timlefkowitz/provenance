import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';
import { ArtworkCard } from '../../artworks/_components/artwork-card';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import {
  getExhibitionsForGallery,
  getExhibitionsForArtistAccount,
} from '../../exhibitions/_actions/get-exhibitions';
import { getArtworksFromGalleryExhibitions } from '../../exhibitions/_actions/get-exhibition-artworks';
import {
  getUserProfileByRole,
  getUserProfileById,
  accountHasActiveGalleryProfile,
} from '../../profiles/_actions/get-user-profiles';
import { Calendar, MapPin, Newspaper } from 'lucide-react';
import { AccountSettingsButton } from '~/components/account-settings-button';
import {
  UnclaimedArtistPublicView,
  type ExhibitionSummary,
  type UnclaimedArtistProfileRow,
} from './_components/unclaimed-artist-public-view';
import { GalleryPublicLinks } from './_components/gallery-public-links';
import { SocialLinkItem } from './_components/social-link-item';
import { getUserStreak } from '~/app/profile/_actions/get-user-streak';
import { StreakStar } from '~/components/streak-star';

export const metadata = {
  title: 'Artist Profile | Provenance',
};

type Account = {
  id: string;
  name: string;
  picture_url: string | null;
  public_data: any;
  created_at: string | null;
};

export default async function ArtistProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ role?: string; profileId?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedRole = resolvedSearchParams?.role;
  const requestedProfileId = resolvedSearchParams?.profileId;
  
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  const { data: account, error } = await client
    .from('accounts')
    .select('id, name, picture_url, public_data, created_at')
    .eq('id', id)
    .maybeSingle<Account>();

  if (error || !account) {
    // schema client omits user_profiles / artworks in generated types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = client as any;

    const { data: profileRow } = await sb
      .from('user_profiles')
      .select(
        'id, name, picture_url, bio, medium, location, website, links, galleries, news_publications, user_id, role, is_active',
      )
      .eq('id', id)
      .eq('role', USER_ROLES.ARTIST)
      .eq('is_active', true)
      .maybeSingle();

    if (!profileRow) {
      redirect('/registry');
    }

    if (profileRow.user_id) {
      redirect(`/artists/${profileRow.user_id}`);
    }

    const profile = profileRow as UnclaimedArtistProfileRow;

    let profileArtworksQuery = sb
      .from('artworks')
      .select(
        'id, title, artist_name, image_url, created_at, certificate_number, account_id, artist_account_id, artist_profile_id, is_public, status',
      )
      .eq('artist_profile_id', id)
      .eq('status', 'verified')
      .order('created_at', { ascending: false })
      .limit(48);

    if (!user) {
      profileArtworksQuery = profileArtworksQuery.eq('is_public', true);
    } else {
      profileArtworksQuery = profileArtworksQuery.or(
        `is_public.eq.true,account_id.eq.${user.id}`,
      );
    }

    const { data: profileArtworks } = await profileArtworksQuery;

    const artworkIds = (profileArtworks || []).map((a: { id: string }) => a.id).filter(Boolean);
    const exhibitions: ExhibitionSummary[] = [];

    if (artworkIds.length > 0) {
      const { data: exLinks } = await sb
        .from('exhibition_artworks')
        .select(
          `
          exhibition_id,
          exhibitions!exhibition_artworks_exhibition_id_fkey (
            id,
            title,
            start_date,
            end_date,
            location
          )
        `,
        )
        .in('artwork_id', artworkIds);

      const seen = new Set<string>();
      for (const row of exLinks || []) {
        const ex = row.exhibitions;
        if (ex?.id && !seen.has(ex.id)) {
          seen.add(ex.id);
          exhibitions.push({
            id: ex.id,
            title: ex.title,
            start_date: ex.start_date,
            end_date: ex.end_date ?? null,
            location: ex.location ?? null,
          });
        }
      }
      exhibitions.sort(
        (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
      );
    }

    return (
      <UnclaimedArtistPublicView
        profile={profile}
        artworks={profileArtworks || []}
        exhibitions={exhibitions}
        currentUserId={user?.id}
      />
    );
  }

  const isOwner = user?.id === account.id;
  
  // Resolve role: never honor ?role=gallery unless this account is actually a gallery (account role or gallery profile).
  const primaryRole = getUserRole(account.public_data as Record<string, any>);
  let userRole: string | null = null;
  if (requestedRole && ['artist', 'collector', 'gallery'].includes(requestedRole)) {
    if (requestedRole === USER_ROLES.GALLERY) {
      const canPresentAsGallery =
        primaryRole === USER_ROLES.GALLERY ||
        (await accountHasActiveGalleryProfile(account.id));
      if (!canPresentAsGallery) {
        console.warn('[ArtistProfile] Ignoring role=gallery — account has no gallery capability', {
          accountId: account.id,
        });
      }
      userRole = canPresentAsGallery ? USER_ROLES.GALLERY : primaryRole;
    } else {
      userRole = requestedRole;
    }
  } else {
    userRole = primaryRole;
  }
  
  const isGallery = userRole === USER_ROLES.GALLERY;
  const isArtistProfile = userRole === USER_ROLES.ARTIST;

  // Try to get role-specific profile, fallback to account data
  // For galleries, if profileId is provided, use that specific profile
  let roleProfile = null;
  if (userRole) {
    if (isGallery && requestedProfileId) {
      // For galleries with a specific profileId, fetch that profile
      const specificProfile = await getUserProfileById(requestedProfileId);
      // Verify it belongs to this user and is a gallery profile
      if (specificProfile && specificProfile.user_id === account.id && specificProfile.role === USER_ROLES.GALLERY) {
        roleProfile = specificProfile;
      } else {
        // If profileId is invalid, fall back to first gallery profile
        roleProfile = await getUserProfileByRole(account.id, USER_ROLES.GALLERY);
      }
    } else if (isArtistProfile && requestedProfileId) {
      const specificProfile = await getUserProfileById(requestedProfileId);
      if (specificProfile && specificProfile.user_id === account.id && specificProfile.role === USER_ROLES.ARTIST) {
        roleProfile = specificProfile;
      } else {
        roleProfile = await getUserProfileByRole(account.id, USER_ROLES.ARTIST);
      }
    } else {
      // For other roles or profiles without profileId, get by role
      roleProfile = await getUserProfileByRole(account.id, userRole as any);
    }
  }
  
  // Use profile data if available, otherwise fall back to account public_data
  const displayName = roleProfile?.name || account.name;
  const medium = roleProfile?.medium || account.public_data?.medium || '';
  const links = roleProfile?.links || (account.public_data?.links as string[]) || [];
  const galleries = roleProfile?.galleries || (account.public_data?.galleries as string[]) || [];
  const bio = roleProfile?.bio || '';
  const location = roleProfile?.location || '';
  const website = roleProfile?.website || '';
  const establishedYear = roleProfile?.established_year;
  const pictureUrl = roleProfile?.picture_url || account.picture_url;
  const newsPublications = (roleProfile?.news_publications as { title: string; url: string; publication_name?: string; date?: string }[] | undefined) || [];

  const streak = !isGallery ? await getUserStreak(account.id) : null;

  let allExhibitions: Awaited<ReturnType<typeof getExhibitionsForGallery>> = [];
  if (isGallery) {
    allExhibitions = await getExhibitionsForGallery(account.id);
  } else if (isArtistProfile) {
    allExhibitions = await getExhibitionsForArtistAccount(account.id, {
      artistProfileId: roleProfile?.id ?? null,
    });
  }
  const exhibitions = allExhibitions.slice(0, 6);

  // For galleries, fetch artworks from their exhibitions
  // For artists/collectors, fetch their own artworks
  let artworks = null;
  if (isGallery) {
    // Get artworks from gallery's exhibitions
    const exhibitionArtworks = await getArtworksFromGalleryExhibitions(account.id, 12);
    
    // Filter for public artworks if not owner
    if (!isOwner) {
      artworks = exhibitionArtworks.filter((artwork: any) => artwork.is_public === true);
    } else {
      artworks = exhibitionArtworks;
    }
  } else {
    // Artists: uploads, works credited via artist_account_id, or legacy profile link; collectors: own uploads only
    let artworksQuery = (client as any)
      .from('artworks')
      .select(
        'id, title, artist_name, image_url, created_at, certificate_number, account_id, artist_account_id, artist_profile_id, is_public, status',
      )
      .eq('status', 'verified')
      .order('created_at', { ascending: false })
      .limit(12);

    if (userRole === USER_ROLES.ARTIST) {
      const orParts: string[] = [`artist_account_id.eq.${account.id}`];
      if (roleProfile?.id) {
        orParts.push(`artist_profile_id.eq.${roleProfile.id}`);
      }
      orParts.push(
        `and(account_id.eq.${account.id},artist_account_id.is.null,artist_profile_id.is.null)`,
      );
      artworksQuery = artworksQuery.or(orParts.join(','));
      console.log('[ArtistProfile] artist works filter applied', {
        accountId: account.id,
        hasRoleProfile: Boolean(roleProfile?.id),
      });
    } else {
      artworksQuery = artworksQuery.eq('account_id', account.id);
    }

    if (!isOwner) {
      artworksQuery = artworksQuery.eq('is_public', true);
    }

    const { data: artworksData } = await artworksQuery;
    artworks = artworksData;
  }

  const hasSidebarContent =
    Boolean(bio) ||
    galleries.length > 0 ||
    newsPublications.length > 0 ||
    (isGallery && isOwner && roleProfile?.id);

  const exhibitionDetailHref = (exhibitionId: string) => {
    if (isGallery) {
      return `/exhibitions/${exhibitionId}?from=gallery${requestedProfileId ? `&profileId=${requestedProfileId}` : ''}`;
    }
    if (isArtistProfile) {
      const q = new URLSearchParams({ from: 'artist', artistId: account.id });
      if (roleProfile?.id) q.set('profileId', roleProfile.id);
      return `/exhibitions/${exhibitionId}?${q.toString()}`;
    }
    return `/exhibitions/${exhibitionId}`;
  };

  return (
    <div className="min-h-screen">
      {/* ── HERO HEADER ─────────────────────────────────────────── */}
      <div className="border-b border-wine/15">
        <div className="container mx-auto px-4 max-w-6xl py-10 md:py-14">
          <div className="flex flex-col sm:flex-row gap-7 sm:gap-10 items-start">

            {/* Avatar — square for galleries, circle for artists */}
            <div
              className={[
                'relative flex-shrink-0 overflow-hidden border border-wine/20 bg-wine/5',
                isGallery
                  ? 'w-24 h-24 md:w-32 md:h-32 rounded-xl shadow-sm'
                  : 'w-24 h-24 md:w-28 md:h-28 rounded-full',
              ].join(' ')}
            >
              {pictureUrl ? (
                <Image
                  src={pictureUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  unoptimized
                  loading="eager"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-wine/8">
                  <span className="text-3xl md:text-4xl font-display font-bold text-wine/60 uppercase select-none">
                    {displayName?.charAt(0) || '?'}
                  </span>
                </div>
              )}
            </div>

            {/* Identity block */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0">
                  {/* Type label */}
                  <p className="text-[11px] uppercase tracking-widest text-wine/50 font-serif mb-2">
                    {isGallery ? 'Gallery' : medium || 'Artist'}
                  </p>

                  {/* Name */}
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-ink leading-tight tracking-tight mb-3 break-words">
                    {displayName}
                  </h1>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink/50 font-serif">
                    {location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-wine/40" />
                        {location}
                        {isGallery && establishedYear && ` · Est. ${establishedYear}`}
                      </span>
                    )}
                    {!isGallery && account.created_at && (
                      <span>
                        Member since{' '}
                        {new Date(account.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                        })}
                      </span>
                    )}
                  </div>

                  {/* Streak */}
                  {streak && (
                    <div className="mt-3 flex items-center gap-3">
                      <StreakStar tier={streak.starTier} streakDays={streak.currentStreakDays} />
                      {streak.longestStreakDays > 0 && (
                        <span className="text-xs text-ink/45 font-serif">
                          Longest streak: {streak.longestStreakDays} days
                        </span>
                      )}
                    </div>
                  )}

                  {/* Social links — inline horizontal */}
                  {(links.length > 0 || website) && (
                    <div className="flex flex-wrap gap-4 mt-4">
                      {website && <SocialLinkItem url={website} />}
                      {links.map((link) => (
                        <SocialLinkItem key={link} url={link} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Owner actions */}
                {isOwner && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      asChild
                      size="sm"
                      className="bg-wine text-parchment hover:bg-wine/90 font-serif"
                    >
                      <Link
                        href={
                          requestedProfileId && roleProfile
                            ? `/profiles/${roleProfile.id}/edit`
                            : '/profile'
                        }
                      >
                        Edit Profile
                      </Link>
                    </Button>
                    {isGallery && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="font-serif border-wine/30 hover:bg-wine/10"
                      >
                        <Link href="/exhibitions">Manage Exhibitions</Link>
                      </Button>
                    )}
                    <AccountSettingsButton />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 max-w-6xl py-10 md:py-14 pb-20">
        <div
          className={
            hasSidebarContent
              ? 'grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10 lg:gap-16 items-start'
              : ''
          }
        >
          {/* ── SIDEBAR ── */}
          {hasSidebarContent && (
            <aside className="space-y-8 lg:sticky lg:top-8">

              {bio && (
                <section>
                  <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-3">
                    About
                  </p>
                  <p className="text-ink/80 font-serif text-sm leading-relaxed whitespace-pre-wrap">
                    {bio}
                  </p>
                </section>
              )}

              {galleries.length > 0 && (
                <section className={bio ? 'border-t border-wine/10 pt-8' : ''}>
                  <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-3">
                    Gallery Affiliations
                  </p>
                  <ul className="space-y-2">
                    {galleries.map((gallery) => (
                      <li key={gallery} className="font-serif text-sm text-ink/80 flex items-start gap-2">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-wine/40 flex-shrink-0" />
                        {gallery}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {newsPublications.length > 0 && (
                <section className="border-t border-wine/10 pt-8">
                  <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-4 flex items-center gap-1.5">
                    <Newspaper className="h-3 w-3" />
                    Press
                  </p>
                  <ul className="space-y-4">
                    {newsPublications.map((pub, index) => (
                      <li key={index}>
                        <a
                          href={pub.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-wine/90 hover:text-wine font-serif text-sm font-medium leading-snug hover:underline block"
                        >
                          {pub.title}
                        </a>
                        {(pub.publication_name || pub.date) && (
                          <p className="text-xs text-ink/45 font-serif mt-1">
                            {[pub.publication_name, pub.date].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {isGallery && isOwner && roleProfile?.id && (
                <section className="border-t border-wine/10 pt-8">
                  <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-3">
                    Public Links
                  </p>
                  <GalleryPublicLinks profileId={roleProfile.id} slug={roleProfile.slug} />
                </section>
              )}
            </aside>
          )}

          {/* ── MAIN CONTENT ── */}
          <main className="min-w-0">

            {/* Exhibitions (galleries + artists) */}
            {(isGallery || isArtistProfile) && exhibitions.length > 0 && (
              <section className="mb-12">
                <div className="flex items-baseline justify-between mb-6">
                  <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif">
                    Exhibitions
                  </p>
                  {isOwner && isGallery && (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="font-serif text-xs text-wine/70 hover:text-wine h-auto py-0"
                    >
                      <Link href="/exhibitions">Manage all</Link>
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-wine/10 rounded-lg overflow-hidden border border-wine/10">
                  {exhibitions.slice(0, 6).map((exhibition) => (
                    <Link
                      key={exhibition.id}
                      href={exhibitionDetailHref(exhibition.id)}
                      className="group block p-5 bg-parchment hover:bg-wine/5 transition-colors"
                    >
                      <h3 className="font-display font-semibold text-ink group-hover:text-wine transition-colors mb-3 leading-snug">
                        {exhibition.title}
                      </h3>
                      <div className="space-y-1.5 text-xs text-ink/50 font-serif">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-wine/40" />
                          <span>
                            {new Date(exhibition.start_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                            {exhibition.end_date &&
                              ` – ${new Date(exhibition.end_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}`}
                          </span>
                        </div>
                        {exhibition.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3 text-wine/40" />
                            <span>{exhibition.location}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>

                {allExhibitions.length > 6 && (
                  <div className="mt-4 text-center">
                    <Button asChild variant="ghost" size="sm" className="font-serif text-wine/70 hover:text-wine">
                      <Link href="/exhibitions">
                        View all {allExhibitions.length} exhibitions
                      </Link>
                    </Button>
                  </div>
                )}
              </section>
            )}

            {/* Artworks */}
            <section>
              <div className="flex items-baseline justify-between mb-6">
                <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif">
                  {isGallery ? 'Exhibition Artworks' : 'Works'}
                </p>
                {isOwner && !isGallery && (
                  <Button
                    asChild
                    size="sm"
                    className="bg-wine text-parchment hover:bg-wine/90 font-serif text-xs"
                  >
                    <Link href="/artworks/add">Add Artwork</Link>
                  </Button>
                )}
              </div>

              {artworks && artworks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
                  {artworks.map((artwork) => (
                    <ArtworkCard
                      key={artwork.id}
                      artwork={artwork as any}
                      currentUserId={user?.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 border border-dashed border-wine/15 rounded-xl">
                  <p className="text-ink/50 font-serif text-sm mb-4">
                    {isGallery
                      ? isOwner
                        ? 'No artworks have been added to your exhibitions yet.'
                        : 'This gallery has no artworks in their exhibitions yet.'
                      : isOwner
                        ? 'You have not added any artworks yet.'
                        : 'This artist has not added any artworks yet.'}
                  </p>
                  {isOwner && !isGallery && (
                    <Button asChild size="sm" className="bg-wine text-parchment hover:bg-wine/90 font-serif">
                      <Link href="/artworks/add">Add Your First Artwork</Link>
                    </Button>
                  )}
                  {isOwner && isGallery && (
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button asChild size="sm" className="bg-wine text-parchment hover:bg-wine/90 font-serif">
                        <Link href="/exhibitions">Manage Exhibitions</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="font-serif border-wine/30 hover:bg-wine/10">
                        <Link href="/artworks/add">Add Artwork to Exhibition</Link>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}


