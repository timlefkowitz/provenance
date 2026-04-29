import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { getExhibitionWithDetails } from '../_actions/get-exhibitions';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { Button } from '@kit/ui/button';
import { ArrowLeft, Calendar, MapPin, User, Edit } from 'lucide-react';
import { ExhibitionDetails } from '../_components/exhibition-details';

export const metadata = {
  title: 'Exhibition | Provenance',
};

function getStatus(startDate: string, endDate: string | null): 'upcoming' | 'ongoing' | 'past' {
  const now = new Date();
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  if (start > now) return 'upcoming';
  if (!end || end >= now) return 'ongoing';
  return 'past';
}

const STATUS_STYLES = {
  upcoming: { dot: 'bg-sky-400',     label: 'Upcoming', text: 'text-sky-700' },
  ongoing:  { dot: 'bg-emerald-400', label: 'Ongoing',  text: 'text-emerald-700' },
  past:     { dot: 'bg-ink/25',      label: 'Past',     text: 'text-ink/40' },
};

function formatRange(start: string, end: string | null) {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  if (!e) return s.toLocaleDateString('en-US', opts);
  const sameYear = s.getFullYear() === e.getFullYear();
  const startStr = sameYear
    ? s.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : s.toLocaleDateString('en-US', opts);
  return `${startStr} – ${e.toLocaleDateString('en-US', opts)}`;
}

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

  const exhibition = await getExhibitionWithDetails(id, { viewerUserId: user?.id ?? null });
  if (!exhibition) redirect('/exhibitions');

  const isOwner = user?.id === exhibition.gallery_id;

  // Resolve back link
  let backLink = '/exhibitions';
  let backLabel = 'Exhibitions';
  if (resolvedSearchParams?.from === 'gallery' || exhibition.gallery_id) {
    try {
      const galleryProfile = await getUserProfileByRole(exhibition.gallery_id, USER_ROLES.GALLERY);
      if (galleryProfile) {
        const profileId = resolvedSearchParams?.profileId || galleryProfile.id;
        backLink = `/artists/${exhibition.gallery_id}?role=gallery&profileId=${profileId}`;
        backLabel = 'Gallery';
      } else {
        backLink = `/artists/${exhibition.gallery_id}?role=gallery`;
        backLabel = 'Gallery';
      }
    } catch {
      // fallback silently
    }
  }

  const status = getStatus(exhibition.start_date, exhibition.end_date ?? null);
  const statusStyle = STATUS_STYLES[status];
  const metadata = (exhibition as any).metadata as { curator?: string; theme?: string } | undefined;

  return (
    <div className="min-h-screen">
      {/* ── HERO ──────────────────────────────────────────────── */}
      <div className="border-b border-wine/15">
        <div className="container mx-auto px-4 max-w-6xl pt-8 pb-12 md:pb-16">

          {/* Back nav */}
          <Link
            href={backLink}
            className="inline-flex items-center gap-1.5 text-xs text-ink/40 hover:text-wine font-serif transition-colors mb-10 group"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            {backLabel}
          </Link>

          {/* Status + edit row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
              <span className={`text-[10px] uppercase tracking-widest font-serif ${statusStyle.text}`}>
                {statusStyle.label}
              </span>
            </div>
            {isOwner && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="font-serif text-ink/40 hover:text-wine h-8 gap-1.5"
              >
                <Link href={`/exhibitions/${id}/edit`}>
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </Link>
              </Button>
            )}
          </div>

          {/* Title */}
          <h1 className="font-display font-bold text-ink text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[0.92] tracking-tight mb-6 max-w-4xl">
            {exhibition.title}
          </h1>

          {/* Description */}
          {exhibition.description && (
            <p className="text-ink/55 font-serif text-base md:text-lg leading-relaxed max-w-2xl mb-8">
              {exhibition.description}
            </p>
          )}

          {/* Meta pills row */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink/45 font-serif">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-wine/40" />
              {formatRange(exhibition.start_date, exhibition.end_date ?? null)}
            </span>
            {exhibition.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-wine/40" />
                {exhibition.location}
              </span>
            )}
            {metadata?.curator && (
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-wine/40" />
                Curated by {metadata.curator}
              </span>
            )}
          </div>

          {/* Theme tag */}
          {metadata?.theme && (
            <div className="mt-4">
              <span className="inline-flex items-center text-xs font-serif border border-wine/20 rounded-full px-3 py-1 text-ink/50">
                {metadata.theme}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── ARTISTS STRIP ─────────────────────────────────────── */}
      {exhibition.artists.length > 0 && (
        <div className="border-b border-wine/10 bg-parchment/40">
          <div className="container mx-auto px-4 max-w-6xl py-5">
            <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
              <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mr-4">
                Artists
              </p>
              {exhibition.artists.map((artist, i) => (
                <span key={artist.id} className="flex items-center gap-1">
                  <Link
                    href={`/artists/${artist.id}`}
                    className="font-serif text-sm text-ink/70 hover:text-wine transition-colors"
                  >
                    {artist.name}
                  </Link>
                  {i < exhibition.artists.length - 1 && (
                    <span className="text-ink/25 mx-1">·</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ARTWORKS ──────────────────────────────────────────── */}
      <div className="container mx-auto px-4 max-w-6xl py-12 pb-24">
        {exhibition.artworks.length > 0 && (
          <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-8">
            Works in Exhibition · {exhibition.artworks.length}
          </p>
        )}
        <ExhibitionDetails exhibition={exhibition} isOwner={isOwner} />
      </div>
    </div>
  );
}
