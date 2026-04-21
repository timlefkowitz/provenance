import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES } from '~/lib/user-roles';
import { getActiveSubscription } from '~/lib/subscription';
import { getOpenCallsList, type OpenCallListEntry } from '../_actions/get-open-calls-list';
import { qualifiesByLocation } from '../_lib/open-call-utils';
import { getMediumLabel } from '../_actions/open-call-constants';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { OpenCallsBrowseFilters } from './_components/open-calls-browse-filters';

export const metadata = {
  title: 'Browse Open Calls | Provenance',
  description: 'Find open calls from galleries and submit your work',
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function OpenCallCard({
  openCall,
  artistLocation,
}: {
  openCall: OpenCallListEntry;
  artistLocation: string | null;
}) {
  const qualifies = qualifiesByLocation(openCall, artistLocation);
  const subOpen = openCall.submission_open_date
    ? formatDate(openCall.submission_open_date)
    : null;
  const subClose = openCall.submission_closing_date
    ? formatDate(openCall.submission_closing_date)
    : null;

  return (
    <Card className="border-wine/20 bg-parchment/60">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          {openCall.medium && (
            <span className="text-xs font-serif uppercase tracking-wider text-ink/60">
              {getMediumLabel(openCall.medium)}
            </span>
          )}
          {qualifies && (
            <span className="text-xs font-serif px-2 py-0.5 rounded bg-wine/15 text-wine">
              Qualifies for your location
            </span>
          )}
        </div>
        <CardTitle className="font-display text-xl text-wine">
          {openCall.exhibition.title}
        </CardTitle>
        {openCall.gallery_name && (
          <p className="text-sm text-ink/60 font-serif">
            {openCall.gallery_name}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {subOpen && subClose && (
          <p className="text-sm text-ink/70 font-serif">
            Submissions: {subOpen} – {subClose}
          </p>
        )}
        {openCall.exhibition.location && (
          <p className="text-sm text-ink/70 font-serif">
            {openCall.exhibition.location}
          </p>
        )}
        {openCall.exhibition.description && (
          <p className="text-sm text-ink/80 font-serif line-clamp-2">
            {openCall.exhibition.description}
          </p>
        )}
        <div className="pt-2">
          <Button
            asChild
            size="sm"
            className="font-serif bg-wine text-parchment hover:bg-wine/90"
          >
            <Link href={`/open-calls/${openCall.slug}`}>View & Submit</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function BrowseOpenCallsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; medium?: string; location?: string }>;
}) {
  const params = await searchParams;
  const search = params.q?.trim() || undefined;
  const medium = params.medium && params.medium !== 'all' ? params.medium : undefined;
  const locationParam = params.location; // 'all' | 'my' | 'none'

  let artistLocation: string | null = null;
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (user) {
    const artistProfile = await getUserProfileByRole(user.id, USER_ROLES.ARTIST);
    if (artistProfile) {
      artistLocation =
        (artistProfile.artist_cv_json as { location?: string })?.location ??
        artistProfile.location ??
        null;
      const artistSubscription = await getActiveSubscription(user.id);
      if (!artistSubscription) {
        redirect('/subscription?upgrade=1');
      }
    }
  }

  const locationFilter: 'my' | 'none' | undefined =
    locationParam === 'my' ? 'my' : locationParam === 'none' ? 'none' : undefined;

  const filters = {
    search: search ?? undefined,
    medium: medium ?? undefined,
    locationFilter,
    userLocation: artistLocation ?? undefined,
  };

  const openCalls = await getOpenCallsList(filters);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Open Calls
        </h1>
        <p className="text-ink/70 font-serif mb-4">
          Exhibition open calls currently open for submissions. Search by title, description, gallery, or medium; filter by medium and location.
        </p>
        <OpenCallsBrowseFilters artistLocation={artistLocation} />
      </div>

      {openCalls.length === 0 ? (
        <Card className="border-wine/20 bg-parchment/60">
          <CardContent className="p-8 text-center">
            <p className="text-ink/60 font-serif">
              No open calls match your search or filters. Try different keywords, medium, or location.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {openCalls.map((openCall) => (
            <OpenCallCard
              key={openCall.id}
              openCall={openCall}
              artistLocation={artistLocation}
            />
          ))}
        </div>
      )}
    </div>
  );
}
