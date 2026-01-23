import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { getExhibitionWithDetails } from '../_actions/get-exhibitions';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Calendar, MapPin, User, Image as ImageIcon, Edit } from 'lucide-react';
import { ExhibitionDetails } from '../_components/exhibition-details';

export const metadata = {
  title: 'Exhibition | Provenance',
};

export default async function ExhibitionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string; profileId?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  const exhibition = await getExhibitionWithDetails(id);

  if (!exhibition) {
    redirect('/exhibitions');
  }

  // Check if user is the gallery owner
  const isOwner = user?.id === exhibition.gallery_id;

  // Determine back link - if from gallery, link back to gallery profile
  let backLink = '/exhibitions';
  let backLabel = '← Back to Exhibitions';
  
  // Check if we came from a gallery (via query param or by checking if gallery_id exists)
  if (resolvedSearchParams?.from === 'gallery' || exhibition.gallery_id) {
    try {
      // Get gallery profile to build proper link
      const galleryProfile = await getUserProfileByRole(exhibition.gallery_id, USER_ROLES.GALLERY);
      
      if (galleryProfile) {
        // Use profileId from query param if provided, otherwise use the first gallery profile
        const profileId = resolvedSearchParams?.profileId || galleryProfile.id;
        backLink = `/artists/${exhibition.gallery_id}?role=gallery&profileId=${profileId}`;
        backLabel = '← Back to Gallery';
      } else {
        // Fallback to gallery account page without profileId
        backLink = `/artists/${exhibition.gallery_id}?role=gallery`;
        backLabel = '← Back to Gallery';
      }
    } catch (error) {
      // If error, fall back to exhibitions page
      console.error('Error fetching gallery profile:', error);
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <Button
          asChild
          variant="ghost"
          className="mb-4 font-serif"
        >
          <Link href={backLink}>{backLabel}</Link>
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold text-wine mb-2">
              {exhibition.title}
            </h1>
            {exhibition.description && (
              <p className="text-ink/70 font-serif text-lg mb-4">
                {exhibition.description}
              </p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-ink/70">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="font-serif">
                  {formatDate(exhibition.start_date)}
                  {exhibition.end_date && ` - ${formatDate(exhibition.end_date)}`}
                </span>
              </div>
              {exhibition.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span className="font-serif">{exhibition.location}</span>
                </div>
              )}
            </div>
          </div>
          {isOwner && (
            <Button
              asChild
              variant="outline"
              className="font-serif border-wine/30 hover:bg-wine/10"
            >
              <Link href={`/exhibitions/${id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
          )}
        </div>
      </div>

      <ExhibitionDetails exhibition={exhibition} isOwner={isOwner} />
    </div>
  );
}

